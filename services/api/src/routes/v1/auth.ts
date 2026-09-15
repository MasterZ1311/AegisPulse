import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { UserRole } from '@aegispulse/types';
import { tokenService, tokenRevocationStore } from '../../services/token.service';
import { authenticate } from '../../middleware/auth';
import { validateRequest } from '../../middleware/validator';
import { UnauthorizedError } from '../../middleware/errors';

export const authRouter = Router();

export interface InternalAuthUser {
  userId: string;
  username: string;
  fullName: string;
  role: UserRole;
  assignedWardIds: string[];
  passwordHash: string; // SHA-256 with salt
  salt: string;
  isActive: boolean;
}

// Helper to create password hash
function hashPassword(password: string, salt: string): string {
  return createHash('sha256').update(`${salt}:${password}`).digest('hex');
}

const nurseUser: InternalAuthUser = {
  userId: 'usr-nurse-101',
  username: 'nurse',
  fullName: 'Sarah Jenkins, RN',
  role: 'WARD_NURSE',
  assignedWardIds: ['WARD-A'],
  salt: 'salt_nurse_2026',
  passwordHash: hashPassword('NursePass123!', 'salt_nurse_2026'),
  isActive: true,
};

const doctorUser: InternalAuthUser = {
  userId: 'usr-phys-303',
  username: 'doctor',
  fullName: 'Dr. Elena Rostova, MD',
  role: 'ATTENDING_PHYSICIAN',
  assignedWardIds: ['WARD-A', 'WARD-4B'],
  salt: 'salt_doctor_2026',
  passwordHash: hashPassword('DoctorPass123!', 'salt_doctor_2026'),
  isActive: true,
};

const adminUser: InternalAuthUser = {
  userId: 'usr-admin-001',
  username: 'administrator',
  fullName: 'Aegis System Administrator',
  role: 'ADMIN',
  assignedWardIds: ['*'],
  salt: 'salt_admin_2026',
  passwordHash: hashPassword('AdminPass123!', 'salt_admin_2026'),
  isActive: true,
};

const unauthorizedUser: InternalAuthUser = {
  userId: 'usr-unauth-999',
  username: 'unauthorized user',
  fullName: 'Unauthorized Guest / Suspended Account',
  role: 'WARD_NURSE',
  assignedWardIds: [], // Empty assigned wards -> zero jurisdiction
  salt: 'salt_guest_2026',
  passwordHash: hashPassword('GuestPass123!', 'salt_guest_2026'),
  isActive: true,
};

// Built-in standard directory of clinical and administrative users
const AUTH_USERS_MAP: Record<string, InternalAuthUser> = {
  nurse: nurseUser,
  doctor: doctorUser,
  admin: adminUser,
  administrator: adminUser,
  guest: unauthorizedUser,
  unauthorized: unauthorizedUser,
  'unauthorized user': unauthorizedUser,
};

const LoginSchema = z
  .object({
    username: z.string().min(1).max(64),
    password: z.string().min(1).max(128),
  })
  .strict();

const RefreshSchema = z
  .object({
    refreshToken: z.string().min(1),
  })
  .strict();

/**
 * Validates hospital password complexity policy:
 * - Minimum 8 characters
 * - Must contain at least one letter and at least one number
 */
export function validatePasswordPolicy(password: string): { valid: boolean; reason?: string } {
  if (password.length < 8) {
    return { valid: false, reason: 'Password must be at least 8 characters long.' };
  }
  if (!/[a-zA-Z]/.test(password)) {
    return { valid: false, reason: 'Password must contain at least one alphabetical letter.' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, reason: 'Password must contain at least one numeric digit.' };
  }
  return { valid: true };
}

/**
 * POST /api/v1/auth/login
 * Authenticates credentials and issues signed access & refresh tokens.
 */
authRouter.post(
  '/login',
  validateRequest({ body: LoginSchema }),
  (req: Request, res: Response) => {
    const { username, password } = req.body;
    const user = AUTH_USERS_MAP[username.toLowerCase()];

    if (!user || !user.isActive) {
      throw new UnauthorizedError('Invalid username or password.');
    }

    // Verify password hash with timing-safe comparison
    const computedHash = hashPassword(password, user.salt);
    const computedBuf = Buffer.from(computedHash, 'utf8');
    const expectedBuf = Buffer.from(user.passwordHash, 'utf8');

    if (
      computedBuf.length !== expectedBuf.length ||
      !timingSafeEqual(computedBuf, expectedBuf)
    ) {
      throw new UnauthorizedError('Invalid username or password.');
    }

    const tokens = tokenService.issueTokens({
      userId: user.userId,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      assignedWardIds: user.assignedWardIds,
    });

    res.status(200).json({
      message: 'Authentication successful.',
      data: tokens,
    });
  }
);

/**
 * POST /api/v1/auth/refresh
 * Exchanges a valid, unrevoked refresh token for a newly signed access token.
 */
authRouter.post(
  '/refresh',
  validateRequest({ body: RefreshSchema }),
  (req: Request, res: Response) => {
    const { refreshToken } = req.body;

    let payload;
    try {
      payload = tokenService.verifyToken(refreshToken, 'refresh');
    } catch (err: any) {
      throw new UnauthorizedError(err.message || 'Invalid or expired refresh token.');
    }

    const newAccessToken = tokenService.generateToken(
      {
        userId: payload.sub,
        username: payload.username,
        fullName: payload.fullName,
        role: payload.role,
        assignedWardIds: payload.assignedWardIds,
      },
      'access',
      900
    );

    res.status(200).json({
      message: 'Session refreshed successfully.',
      data: {
        accessToken: newAccessToken.token,
        tokenType: 'Bearer',
        expiresInSeconds: 900,
      },
    });
  }
);

/**
 * POST /api/v1/auth/logout
 * Revokes the active session token and blacklists the token identifier (jti).
 */
authRouter.post(
  '/logout',
  authenticate(),
  (req: Request, res: Response) => {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      try {
        const payload = tokenService.verifyToken(token);
        tokenRevocationStore.revokeToken(payload.jti);
      } catch {
        // Even if token was close to expiry, mark revoked
      }
    }

    res.status(200).json({
      message: 'Successfully logged out and session revoked.',
    });
  }
);

/**
 * GET /api/v1/auth/me
 * Returns profile, active role, and assigned clinical jurisdictions for current session.
 */
authRouter.get(
  '/me',
  authenticate(),
  (req: Request, res: Response) => {
    res.status(200).json({
      data: req.user,
    });
  }
);
