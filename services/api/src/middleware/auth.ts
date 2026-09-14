import { Request, Response, NextFunction } from 'express';
import type { UserRole } from '@aegispulse/types';
import { UnauthorizedError } from './errors';

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
    username: 'sjenkins',
    fullName: 'Sarah Jenkins, RN',
    role: 'WARD_NURSE',
    assignedWardIds: ['WARD-A', 'WARD-B'],
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
    username: 'erostova',
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
  'admin-token': {
    userId: 'usr-admin-001',
    username: 'admin',
    fullName: 'Aegis System Administrator',
    role: 'ADMIN',
    assignedWardIds: ['*'],
  },
  'system-token': {
    userId: 'usr-sys-000',
    username: 'system',
    fullName: 'AegisPulse Core Service Engine',
    role: 'SYSTEM',
    assignedWardIds: ['*'],
  },
};

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

    // Direct header override for testing - Strictly forbidden in production and requires explicit opt-in
    const testRole = req.headers['x-user-role'] as UserRole | undefined;
    const testUserId = req.headers['x-user-id'] as string | undefined;

    if (testRole && process.env.NODE_ENV !== 'production' && process.env.ALLOW_HEADER_AUTH === 'true') {
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
      const user = TOKEN_USER_MAP[token];
      if (user) {
        req.user = testWards ? { ...user, assignedWardIds: testWards } : user;
        return next();
      }

      // If token format is "role:<ROLE>" for dynamic test generation
      if (token.startsWith('role:')) {
        const role = token.split(':')[1] as UserRole;
        req.user = {
          userId: `usr-${role.toLowerCase()}`,
          username: role.toLowerCase(),
          fullName: `Staff ${role}`,
          role,
          assignedWardIds: ['*'],
        };
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
