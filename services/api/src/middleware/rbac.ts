import { Request, Response, NextFunction } from 'express';
import type { UserRole } from '@aegispulse/types';
import { ForbiddenError, UnauthorizedError } from './errors';

export function requireRole(allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required before checking authorization.'));
    }

    // Admins and System services have full access across the platform
    if (req.user.role === 'ADMIN' || req.user.role === 'SYSTEM') {
      return next();
    }

    if (allowedRoles.includes(req.user.role)) {
      return next();
    }

    return next(
      new ForbiddenError(
        `User role '${req.user.role}' is not authorized to access this resource. Required: [${allowedRoles.join(', ')}]`
      )
    );
  };
}
