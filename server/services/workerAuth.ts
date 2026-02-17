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
   */
  generatePin(): string {
    return crypto.randomInt(100000, 999999).toString();
  }

  /**
   * Create or regenerate PIN for a crew member
   */
  async createPinForMember(memberId: number): Promise<string> {
    const pin = this.generatePin();
    console.log('[WorkerAuth] Creating PIN for member:', memberId, 'PIN:', pin);

    const result = await db
      .update(crewMembers)
      .set({
        pin,
        pinCreatedAt: new Date(),
      })
      .where(eq(crewMembers.id, memberId))
      .returning({ id: crewMembers.id, pin: crewMembers.pin });

    console.log('[WorkerAuth] Update result:', result);

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

    // For local development, use signInWithPassword with a known password
    // In production, you might want to use magic links or other methods
    // Generate a session directly
    const { data: sessionData, error: sessionError } = await supabase.auth.admin.createUser({
      email: member.memberEmail,
      email_confirm: true,
    });

    // Since we can't easily create a session with admin API,
    // we'll use a workaround: sign in with a service token approach
    // The frontend will need to exchange the token for a session

    // For now, let's create a signed JWT that the frontend can use
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
