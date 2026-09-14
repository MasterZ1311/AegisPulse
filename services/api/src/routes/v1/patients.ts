import { Router, Request, Response } from 'express';
import { wardStateService } from '../../services/ward-state.service';
import { authenticate } from '../../middleware/auth';

export const patientsRouter = Router();

patientsRouter.use(authenticate({ optional: true }));

patientsRouter.get('/', (req: Request, res: Response) => {
  const wardId = req.query.wardId ? String(req.query.wardId) : undefined;
  const category = req.query.category ? String(req.query.category) : undefined;

  const patients = wardStateService.getPatients(wardId, category);
  res.status(200).json({ data: patients, total: patients.length });
});

patientsRouter.get('/:patientId', (req: Request, res: Response) => {
  const patientId = String(req.params.patientId);
  const patient = wardStateService.getPatient(patientId);
  const observations = wardStateService.getObservations(patient.id);
  const latestObservation = observations.length > 0 ? observations[observations.length - 1] : undefined;

  res.status(200).json({
    data: {
      ...patient,
      latestObservation,
      observationCount: observations.length,
    },
  });
});
