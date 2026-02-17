import express from 'express';
import { z } from 'zod';
import { workerAuthService } from '../services/workerAuth';
import { authenticateSupabase } from '../middleware/supabaseAuth.js';
import { storage } from '../storage';

const router = express.Router();

// Schema for worker login
const workerLoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  pin: z.string().length(6, 'PIN must be 6 digits').regex(/^\d+$/, 'PIN must be numeric'),
});

// Schema for PIN generation
const generatePinSchema = z.object({
  memberId: z.number().int().positive('Invalid member ID'),
});

/**
 * POST /api/worker-auth/login
 * Worker login with email + PIN
 */
router.post('/login', async (req, res) => {
  try {
    const validation = workerLoginSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.errors,
      });
    }

    const { email, pin } = validation.data;

    // Validate PIN
    const member = await workerAuthService.validatePin(email, pin);

    if (!member) {
      return res.status(401).json({
        error: 'Invalid email or PIN',
      });
    }

    // Get or create auth user and session
    const result = await workerAuthService.getOrCreateWorkerAuthUser(member);

    res.json({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
    });
  } catch (error: any) {
    console.error('Worker login error:', error);
    res.status(500).json({
      error: 'Login failed',
      message: error.message,
    });
  }
});

/**
 * POST /api/worker-auth/generate-pin
 * Generate PIN for a crew member (Leiter only)
 */
router.post('/generate-pin', authenticateSupabase, async (req, res) => {
  console.log('[WorkerAuth] POST /generate-pin called with body:', req.body);
  try {
    // Only admin or leiter can generate PINs
    if (req.user!.role !== 'admin' && req.user!.role !== 'leiter') {
      console.log('[WorkerAuth] Access denied - role:', req.user!.role);
      return res.status(403).json({
        error: 'Only admins and Leiters can generate PINs',
      });
    }

    const validation = generatePinSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.errors,
      });
    }

    const { memberId } = validation.data;

    // Get member info first
    const member = await workerAuthService.getCrewMemberById(memberId);

    if (!member) {
      return res.status(404).json({
        error: 'Crew member not found',
      });
    }

    if (!member.memberEmail) {
      return res.status(400).json({
        error: 'Crew member must have an email address to generate PIN',
      });
    }

    // If user is leiter, check they have access to this crew's firm
    if (req.user!.role === 'leiter') {
      const crew = await storage.getCrewById(member.crewId);
      if (!crew) {
        return res.status(404).json({
          error: 'Crew not found',
        });
      }

      const hasAccess = await storage.hasUserFirmAccess(req.user!.id, crew.firmId.toString());
      if (!hasAccess) {
        return res.status(403).json({
          error: 'You do not have access to this crew',
        });
      }
    }

    // Generate PIN
    console.log('[WorkerAuth] Generating PIN for member:', memberId);
    const pin = await workerAuthService.createPinForMember(memberId);
    console.log('[WorkerAuth] PIN generated:', pin);

    res.json({
      success: true,
      pin,
      memberEmail: member.memberEmail,
      message: 'PIN generated successfully. Share this PIN securely with the worker.',
    });
  } catch (error: any) {
    console.error('PIN generation error:', error);
    res.status(500).json({
      error: 'Failed to generate PIN',
      message: error.message,
    });
  }
});

/**
 * POST /api/worker-auth/revoke-pin
 * Revoke PIN for a crew member (Leiter only)
 */
router.post('/revoke-pin', authenticateSupabase, async (req, res) => {
  try {
    // Only admin or leiter can revoke PINs
    if (req.user!.role !== 'admin' && req.user!.role !== 'leiter') {
      return res.status(403).json({
        error: 'Only admins and Leiters can revoke PINs',
      });
    }

    const validation = generatePinSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.errors,
      });
    }

    const { memberId } = validation.data;

    // Get member info first
    const member = await workerAuthService.getCrewMemberById(memberId);

    if (!member) {
      return res.status(404).json({
        error: 'Crew member not found',
      });
    }

    // If user is leiter, check they have access to this crew's firm
    if (req.user!.role === 'leiter') {
      const crew = await storage.getCrewById(member.crewId);
      if (!crew) {
        return res.status(404).json({
          error: 'Crew not found',
        });
      }

      const hasAccess = await storage.hasUserFirmAccess(req.user!.id, crew.firmId.toString());
      if (!hasAccess) {
        return res.status(403).json({
          error: 'You do not have access to this crew',
        });
      }
    }

    // Revoke PIN
    await workerAuthService.revokePinForMember(memberId);

    res.json({
      success: true,
      message: 'PIN revoked successfully',
    });
  } catch (error: any) {
    console.error('PIN revoke error:', error);
    res.status(500).json({
      error: 'Failed to revoke PIN',
      message: error.message,
    });
  }
});

/**
 * GET /api/worker-auth/member-status/:memberId
 * Get PIN status for a crew member (Leiter only)
 */
router.get('/member-status/:memberId', authenticateSupabase, async (req, res) => {
  try {
    // Only admin or leiter can check status
    if (req.user!.role !== 'admin' && req.user!.role !== 'leiter') {
      return res.status(403).json({
        error: 'Only admins and Leiters can check PIN status',
      });
    }

    const memberId = parseInt(req.params.memberId);

    if (isNaN(memberId)) {
      return res.status(400).json({
        error: 'Invalid member ID',
      });
    }

    const member = await workerAuthService.getCrewMemberById(memberId);

    if (!member) {
      return res.status(404).json({
        error: 'Crew member not found',
      });
    }

    // If user is leiter, check they have access to this crew's firm
    if (req.user!.role === 'leiter') {
      const crew = await storage.getCrewById(member.crewId);
      if (!crew) {
        return res.status(404).json({
          error: 'Crew not found',
        });
      }

      const hasAccess = await storage.hasUserFirmAccess(req.user!.id, crew.firmId.toString());
      if (!hasAccess) {
        return res.status(403).json({
          error: 'You do not have access to this crew',
        });
      }
    }

    res.json({
      memberId: member.id,
      memberEmail: member.memberEmail,
      hasPin: member.hasPin,
      pinCreatedAt: member.pinCreatedAt,
      canGeneratePin: !!member.memberEmail,
    });
  } catch (error: any) {
    console.error('Member status error:', error);
    res.status(500).json({
      error: 'Failed to get member status',
      message: error.message,
    });
  }
});

export default router;
