import { Router, Request, Response } from 'express';
import { wardStateService } from '../../services/ward-state.service';
import { authenticate } from '../../middleware/auth';

export const bedsRouter = Router();

bedsRouter.use(authenticate({ optional: true }));

bedsRouter.get('/', (req: Request, res: Response) => {
  const wardId = req.query.wardId ? String(req.query.wardId) : undefined;
  const status = req.query.status ? String(req.query.status) : undefined;

  const beds = wardStateService.getBeds(wardId, status);
  res.status(200).json({ data: beds, total: beds.length });
});

bedsRouter.get('/:bedId', (req: Request, res: Response) => {
  const bedId = String(req.params.bedId);
  const bed = wardStateService.getBed(bedId);
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
