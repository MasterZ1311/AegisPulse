import { Request, Response, NextFunction } from 'express';
import type { UserRole } from '@aegispulse/types';
import { ForbiddenError, UnauthorizedError } from './errors';
import { wardStateService } from '../services/ward-state.service';

/**
 * Enforces Role-Based Access Control (RBAC).
 * Allows ADMIN and SYSTEM roles unconditionally.
 */
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

/**
 * Enforces Ward-Scoped Access Control.
 * Ensures the clinician's assignedWardIds permits access to the targeted ward.
 */
export function requireWardAccess(wardIdExtractor?: (req: Request) => string | undefined) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    // If user is not authenticated (optional auth mode), skip scoping
    if (!req.user) {
      return next();
    }

    // Admins and System services have full hospital-wide jurisdiction
    if (req.user.role === 'ADMIN' || req.user.role === 'SYSTEM') {
      return next();
    }

    const wardId =
      (wardIdExtractor ? wardIdExtractor(req) : undefined) ||
      (req.params.wardId as string) ||
      (req.query.wardId as string);

    if (!wardId) {
      return next();
    }

    const isAssigned =
      req.user.assignedWardIds.includes('*') || req.user.assignedWardIds.includes(wardId);

    if (!isAssigned) {
      return next(
        new ForbiddenError(
          `Unauthorized ward access: User '${req.user.username}' is not assigned to ward '${wardId}'. Clinical jurisdiction denied.`
        )
      );
    }

    return next();
  };
}

/**
 * Enforces Patient-Scoped Ward Access Control.
 * Resolves the patient's assigned ward and verifies clinician jurisdiction.
 */
export function requirePatientWardAccess() {
  return (req: Request, _res: Response, next: NextFunction): void => {
    // If user is not authenticated (optional auth mode), skip scoping
    if (!req.user) {
      return next();
    }

    // Admins and System services have full jurisdiction
    if (req.user.role === 'ADMIN' || req.user.role === 'SYSTEM') {
      return next();
    }

    const patientId = req.params.patientId as string | undefined;
    if (!patientId) {
      return next();
    }

    try {
      const patient = wardStateService.getPatient(patientId);
      const isAssigned =
        req.user.assignedWardIds.includes('*') || req.user.assignedWardIds.includes(patient.wardId);

      if (!isAssigned) {
        return next(
          new ForbiddenError(
            `Unauthorized patient access: Patient '${patientId}' belongs to ward '${patient.wardId}', which is outside the clinician's assigned jurisdiction [${req.user.assignedWardIds.join(', ')}].`
          )
        );
      }

      return next();
    } catch (err) {
      // If patient not found, let route handler handle 404
      return next(err);
    }
  };
}
