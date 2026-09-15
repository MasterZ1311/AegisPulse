import { Router, Request, Response } from 'express';
import { wardStateService } from '../../services/ward-state.service';
import { authenticate } from '../../middleware/auth';
import { ForbiddenError } from '../../middleware/errors';

export const bedsRouter = Router();

bedsRouter.use(authenticate());

bedsRouter.get('/', (req: Request, res: Response) => {
  const wardId = req.query.wardId ? String(req.query.wardId) : undefined;
  const status = req.query.status ? String(req.query.status) : undefined;

  // If specific ward requested, check jurisdiction
  if (wardId && req.user && !req.user.assignedWardIds.includes('*') && !req.user.assignedWardIds.includes(wardId)) {
    throw new ForbiddenError(`Unauthorized ward access: User '${req.user.username}' is not assigned to ward '${wardId}'.`);
  }

  let beds = wardStateService.getBeds(wardId, status);

  // Scope to assigned wards if not wildcard
  if (req.user && !req.user.assignedWardIds.includes('*') && !wardId) {
    beds = beds.filter((b) => req.user!.assignedWardIds.includes(b.wardId));
  }

  res.status(200).json({ data: beds, total: beds.length });
});

bedsRouter.get('/:bedId', (req: Request, res: Response) => {
  const bedId = String(req.params.bedId);
  const bed = wardStateService.getBed(bedId);

  // Check jurisdiction over this bed's ward
  if (req.user && !req.user.assignedWardIds.includes('*') && !req.user.assignedWardIds.includes(bed.wardId)) {
    throw new ForbiddenError(`Unauthorized bed access: Bed '${bedId}' belongs to ward '${bed.wardId}', which is outside user jurisdiction.`);
  }

  let patient = undefined;
  if (bed.currentPatientId) {
    try {
      patient = wardStateService.getPatient(bed.currentPatientId);
    } catch {
      // Patient might have been discharged
    }
  }

  res.status(200).json({
    data: {
      ...bed,
      patient,
    },
  });
});

