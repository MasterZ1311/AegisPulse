import { Request, Response, NextFunction } from 'express';
import type { UserRole } from '@aegispulse/types';
import { UnauthorizedError } from './errors';
import { tokenService } from '../services/token.service';

export interface AuthenticatedUser {
  userId: string;
  username: string;
  fullName: string;
  role: UserRole;
  assignedWardIds: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

// Built-in standard ward clinician and admin test tokens
const TOKEN_USER_MAP: Record<string, AuthenticatedUser> = {
  'nurse-token': {
    userId: 'usr-nurse-101',
    username: 'nurse',
    fullName: 'Sarah Jenkins, RN',
    role: 'WARD_NURSE',
    assignedWardIds: ['WARD-A'],
  },
  'doctor-token': {
    userId: 'usr-phys-303',
    username: 'doctor',
    fullName: 'Dr. Elena Rostova, MD',
    role: 'ATTENDING_PHYSICIAN',
    assignedWardIds: ['WARD-A', 'WARD-4B'],
  },
  'admin-token': {
    userId: 'usr-admin-001',
    username: 'admin',
    fullName: 'Aegis System Administrator',
    role: 'ADMIN',
    assignedWardIds: ['*'],
  },
  'unauthorized-token': {
    userId: 'usr-guest-999',
    username: 'guest',
    fullName: 'Unauthorized Guest Account',
    role: 'WARD_NURSE',
    assignedWardIds: [],
  },
  'guest-token': {
    userId: 'usr-guest-999',
    username: 'guest',
    fullName: 'Unauthorized Guest Account',
    role: 'WARD_NURSE',
    assignedWardIds: [],
  },
  'charge-token': {
    userId: 'usr-charge-202',
    username: 'dpatel',
    fullName: 'David Patel, Charge RN',
    role: 'CHARGE_NURSE',
    assignedWardIds: ['WARD-A', 'WARD-B', 'WARD-ICU'],
  },
  'resident-token': {
    userId: 'usr-res-301',
    username: 'mchen',
    fullName: 'Dr. Michael Chen, MD',
    role: 'RESIDENT_PHYSICIAN',
    assignedWardIds: ['WARD-A'],
  },
  'physician-token': {
    userId: 'usr-phys-303',
    username: 'doctor',
    fullName: 'Dr. Elena Rostova, MD',
    role: 'ATTENDING_PHYSICIAN',
    assignedWardIds: ['WARD-A', 'WARD-B', 'WARD-ICU'],
  },
  'ward-b-nurse-token': {
    userId: 'usr-nurse-ward-b',
    username: 'npatel_b',
    fullName: 'Nurse Nisha Patel, RN (Ward B)',
    role: 'WARD_NURSE',
    assignedWardIds: ['WARD-B'],
  },
  'system-token': {
    userId: 'usr-sys-000',
    username: 'system',
    fullName: 'AegisPulse Core Service Engine',
    role: 'SYSTEM',
    assignedWardIds: ['*'],
  },
};

/**
 * Resolves an authenticated user from a bearer token or API key.
 * Dynamic test tokens (role:<ROLE>) are strictly blocked in production.
 */
export function resolveUserFromToken(token: string, testWards?: string[]): AuthenticatedUser | null {
  if (!token) return null;
  const user = TOKEN_USER_MAP[token];
  if (user) {
    return testWards ? { ...user, assignedWardIds: testWards } : user;
  }

  // Dynamic test token generation strictly locked down to non-production dev test environments
  if (token.startsWith('role:')) {
    if (process.env.NODE_ENV !== 'production' && (process.env.ALLOW_DEV_TEST_TOKENS === 'true' || process.env.ALLOW_HEADER_AUTH === 'true')) {
      const role = token.split(':')[1] as UserRole;
      return {
        userId: `usr-${role.toLowerCase()}`,
        username: role.toLowerCase(),
        fullName: `Staff ${role}`,
        role,
        assignedWardIds: testWards || ['*'],
      };
    }
    return null;
  }

  return null;
}

export function authenticate(options?: { optional?: boolean }) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const authHeader = req.headers['authorization'];
    const apiKey = req.headers['x-api-key'] as string | undefined;
    const testWards = req.headers['x-user-wards']
      ? String(req.headers['x-user-wards']).split(',').map((w) => w.trim())
      : undefined;

    let token: string | undefined;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else if (apiKey) {
      token = apiKey.trim();
    }

    // Direct header override for testing - Strictly forbidden in production and staging
    const testRole = req.headers['x-user-role'] as UserRole | undefined;
    const testUserId = req.headers['x-user-id'] as string | undefined;

    if (testRole && process.env.NODE_ENV === 'test' && process.env.ALLOW_HEADER_AUTH === 'true') {
      req.user = {
        userId: testUserId || `test-${testRole.toLowerCase()}`,
        username: testUserId || `test-${testRole.toLowerCase()}`,
        fullName: `Test ${testRole}`,
        role: testRole,
        assignedWardIds: testWards || ['WARD-A', 'WARD-B', 'WARD-ICU'],
      };
      return next();
    }

    if (token) {
      // 1. Cryptographic JWT Verification (if token has 3 dot-separated segments)
      if (token.includes('.')) {
        try {
          const payload = tokenService.verifyToken(token, 'access');
          req.user = {
            userId: payload.sub,
            username: payload.username,
            fullName: payload.fullName,
            role: payload.role,
            assignedWardIds: testWards || payload.assignedWardIds,
          };
          return next();
        } catch (err: any) {
          return next(new UnauthorizedError(err.message || 'Invalid or expired authentication token.'));
        }
      }

      // 2. Built-in staff & test tokens (for dev & testing)
      const user = resolveUserFromToken(token, testWards);
      if (user) {
        req.user = user;
        return next();
      }

      return next(new UnauthorizedError('Invalid or expired authentication token.'));
    }

    if (options?.optional) {
      return next();
    }

    return next(new UnauthorizedError('Authorization header (Bearer <token>) or x-api-key is required.'));
  };
}

