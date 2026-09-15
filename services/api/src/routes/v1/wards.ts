import { Router, Request, Response } from 'express';
import { wardStateService } from '../../services/ward-state.service';
import { authenticate } from '../../middleware/auth';
import { requireWardAccess } from '../../middleware/rbac';

export const wardsRouter = Router();

wardsRouter.use(authenticate());

wardsRouter.get('/', (req: Request, res: Response) => {
  let wards = wardStateService.getWards();

  // If user is authenticated without wildcard jurisdiction, filter to assigned wards
  if (req.user && !req.user.assignedWardIds.includes('*')) {
    wards = wards.filter((w) => req.user!.assignedWardIds.includes(w.id));
  }

  res.status(200).json({ data: wards, total: wards.length });
});


wardsRouter.get('/:wardId', requireWardAccess(), (req: Request, res: Response) => {
  const wardId = String(req.params.wardId);
  const ward = wardStateService.getWard(wardId);
  const beds = wardStateService.getBeds(ward.id);
  res.status(200).json({
    data: {
      ...ward,
      beds,
    },
  });
});

wardsRouter.get('/:wardId/overview', requireWardAccess(), (req: Request, res: Response) => {
  const wardId = String(req.params.wardId);
  const ward = wardStateService.getWard(wardId);
  const beds = wardStateService.getBeds(ward.id);
  const patients = wardStateService.getPatients(ward.id);

  res.status(200).json({
    data: {
      ward,
      totalBeds: beds.length,
      occupiedBeds: beds.filter((b) => b.status === 'OCCUPIED').length,
      availableBeds: beds.filter((b) => b.status === 'AVAILABLE').length,
      patientCount: patients.length,
      beds,
      patients,
    },
  });
});
