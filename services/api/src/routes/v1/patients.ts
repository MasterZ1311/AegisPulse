import { Router, Request, Response } from 'express';
import { wardStateService } from '../../services/ward-state.service';
import { authenticate } from '../../middleware/auth';
import { requirePatientWardAccess, requireWardAccess } from '../../middleware/rbac';

export const patientsRouter = Router();

patientsRouter.use(authenticate());


patientsRouter.get('/', requireWardAccess(), (req: Request, res: Response) => {
  const wardId = req.query.wardId ? String(req.query.wardId) : undefined;
  const category = req.query.category ? String(req.query.category) : undefined;

  let patients = wardStateService.getPatients(wardId, category);

  // If user is authenticated and does not have wildcard access, scope to assigned wards
  if (req.user && !req.user.assignedWardIds.includes('*') && !wardId) {
    patients = patients.filter((p) => req.user!.assignedWardIds.includes(p.wardId));
  }

  res.status(200).json({ data: patients, total: patients.length });
});

patientsRouter.get('/:patientId', requirePatientWardAccess(), (req: Request, res: Response) => {
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
