import crypto from 'crypto';
import { db } from '../db';
import { crewMembers, profiles } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { supabase } from '../supabaseClient.js';

export interface WorkerCredentials {
  email: string;
  pin: string;
}

export interface WorkerLoginResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: 'worker';
    crewMemberId: number;
    crewId: number;
  };
}

export class WorkerAuthService {
  /**
   * Generate a random 6-digit PIN
   * TODO: Hash PINs before storing (bcrypt/argon2). Currently stored in plaintext.
   */
  generatePin(): string {
    return crypto.randomInt(100000, 999999).toString();
  }

  /**
   * Create or regenerate PIN for a crew member
   */
  async createPinForMember(memberId: number): Promise<string> {
    const pin = this.generatePin();
    console.log('[WorkerAuth] Creating PIN for member:', memberId);

    const result = await db
      .update(crewMembers)
      .set({
        pin,
        pinCreatedAt: new Date(),
      })
      .where(eq(crewMembers.id, memberId))
      .returning({ id: crewMembers.id, pin: crewMembers.pin });

    console.log('[WorkerAuth] PIN updated for member:', memberId);

    return pin;
  }

  /**
   * Revoke PIN for a crew member (remove access)
   */
  async revokePinForMember(memberId: number): Promise<void> {
    await db
      .update(crewMembers)
      .set({
        pin: null,
        pinCreatedAt: null,
      })
      .where(eq(crewMembers.id, memberId));
  }

  /**
   * Validate PIN and get crew member
   */
  async validatePin(email: string, pin: string): Promise<{
    id: number;
    crewId: number;
    firstName: string;
    lastName: string;
    memberEmail: string | null;
    authUserId: string | null;
  } | null> {
    const [member] = await db
      .select({
        id: crewMembers.id,
        crewId: crewMembers.crewId,
        firstName: crewMembers.firstName,
        lastName: crewMembers.lastName,
        memberEmail: crewMembers.memberEmail,
        pin: crewMembers.pin,
        authUserId: crewMembers.authUserId,
      })
      .from(crewMembers)
      .where(
        and(
          eq(crewMembers.memberEmail, email),
          eq(crewMembers.pin, pin),
          eq(crewMembers.archived, false)
        )
      );

    if (!member) {
      return null;
    }

    return {
      id: member.id,
      crewId: member.crewId,
      firstName: member.firstName,
      lastName: member.lastName,
      memberEmail: member.memberEmail,
      authUserId: member.authUserId,
    };
  }

  /**
   * Get or create Supabase Auth user for worker
   * Creates a new auth user if one doesn't exist
   */
  async getOrCreateWorkerAuthUser(member: {
    id: number;
    crewId: number;
    firstName: string;
    lastName: string;
    memberEmail: string | null;
    authUserId: string | null;
  }): Promise<WorkerLoginResult> {
    if (!member.memberEmail) {
      throw new Error('Member does not have an email address');
    }

    let authUserId = member.authUserId;
    let accessToken: string;

    if (!authUserId) {
      // First, try to find existing user by email
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existingUser = existingUsers?.users.find(u => u.email === member.memberEmail);

      if (existingUser) {
        // User already exists, use their ID
        authUserId = existingUser.id;
        console.log('[WorkerAuth] Found existing auth user:', authUserId);
      } else {
        // Create new Supabase Auth user for worker
        // Use a random password since they'll authenticate via PIN
        const randomPassword = crypto.randomBytes(32).toString('hex');

        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: member.memberEmail,
          password: randomPassword,
          email_confirm: true, // Auto-confirm email since Leiter already verified them
          user_metadata: {
            first_name: member.firstName,
            last_name: member.lastName,
            role: 'worker',
            crew_member_id: member.id,
          },
        });

        if (authError) {
          throw new Error(`Auth user creation failed: ${authError.message}`);
        }
        authUserId = authData.user.id;
        console.log('[WorkerAuth] Created new auth user:', authUserId);
      }

      // Create or update profile for worker
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: authUserId,
          email: member.memberEmail,
          first_name: member.firstName,
          last_name: member.lastName,
          role: 'worker',
          crew_member_id: member.id,
        }, {
          onConflict: 'id',
        });

      if (profileError) {
        console.error('Profile creation error:', profileError);
        throw new Error(`Profile creation failed: ${profileError.message}`);
      }

      // Link auth user to crew member
      await db
        .update(crewMembers)
        .set({ authUserId })
        .where(eq(crewMembers.id, member.id));
    }

    // Generate a new session for the worker
    const { data: signInData, error: signInError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: member.memberEmail,
    });

    if (signInError || !signInData) {
      throw new Error(`Failed to create session: ${signInError?.message}`);
    }

    // Get user data to create a session
    const { data: userData } = await supabase.auth.admin.getUserById(authUserId!);

    if (!userData?.user) {
      throw new Error('Failed to get user data');
    }

    // Use signInWithPassword by setting a temporary password
    const tempPassword = crypto.randomBytes(16).toString('hex');

    await supabase.auth.admin.updateUserById(authUserId!, {
      password: tempPassword,
    });

    const { data: sessionResult, error: sessionResultError } = await supabase.auth.signInWithPassword({
      email: member.memberEmail,
      password: tempPassword,
    });

    if (sessionResultError || !sessionResult.session) {
      throw new Error(`Failed to create session: ${sessionResultError?.message}`);
    }

    accessToken = sessionResult.session.access_token;
    const refreshToken = sessionResult.session.refresh_token;

    return {
      accessToken,
      refreshToken,
      user: {
        id: authUserId!,
        email: member.memberEmail,
        firstName: member.firstName,
        lastName: member.lastName,
        role: 'worker',
        crewMemberId: member.id,
        crewId: member.crewId,
      },
    };
  }

  /**
   * Get crew member by email
   */
  async getCrewMemberByEmail(email: string): Promise<{
    id: number;
    crewId: number;
    firstName: string;
    lastName: string;
    memberEmail: string | null;
    pin: string | null;
    pinCreatedAt: Date | null;
  } | null> {
    const [member] = await db
      .select({
        id: crewMembers.id,
        crewId: crewMembers.crewId,
        firstName: crewMembers.firstName,
        lastName: crewMembers.lastName,
        memberEmail: crewMembers.memberEmail,
        pin: crewMembers.pin,
        pinCreatedAt: crewMembers.pinCreatedAt,
      })
      .from(crewMembers)
      .where(
        and(
          eq(crewMembers.memberEmail, email),
          eq(crewMembers.archived, false)
        )
      );

    return member || null;
  }

  /**
   * Get crew member by ID with PIN info
   */
  async getCrewMemberById(memberId: number): Promise<{
    id: number;
    crewId: number;
    firstName: string;
    lastName: string;
    memberEmail: string | null;
    hasPin: boolean;
    pinCreatedAt: Date | null;
  } | null> {
    const [member] = await db
      .select({
        id: crewMembers.id,
        crewId: crewMembers.crewId,
        firstName: crewMembers.firstName,
        lastName: crewMembers.lastName,
        memberEmail: crewMembers.memberEmail,
        pin: crewMembers.pin,
        pinCreatedAt: crewMembers.pinCreatedAt,
      })
      .from(crewMembers)
      .where(eq(crewMembers.id, memberId));

    if (!member) {
      return null;
    }

    return {
      id: member.id,
      crewId: member.crewId,
      firstName: member.firstName,
      lastName: member.lastName,
      memberEmail: member.memberEmail,
      hasPin: !!member.pin,
      pinCreatedAt: member.pinCreatedAt,
    };
  }
}

export const workerAuthService = new WorkerAuthService();
