import { Router, Request, Response } from 'express';
import { wardStateService } from '../../services/ward-state.service';
import { authenticate } from '../../middleware/auth';

export const wardsRouter = Router();

wardsRouter.use(authenticate({ optional: true }));

wardsRouter.get('/', (_req: Request, res: Response) => {
  const wards = wardStateService.getWards();
  res.status(200).json({ data: wards, total: wards.length });
});

wardsRouter.get('/:wardId', (req: Request, res: Response) => {
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

wardsRouter.get('/:wardId/overview', (req: Request, res: Response) => {
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
