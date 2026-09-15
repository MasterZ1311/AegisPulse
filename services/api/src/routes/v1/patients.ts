import { Router, Request, Response } from 'express';
import { CreatePatientSchema, UpdatePatientSchema, type Patient } from '@aegispulse/types';
import { wardStateService } from '../../services/ward-state.service';
import { authenticate } from '../../middleware/auth';
import { requirePatientWardAccess, requireWardAccess, requireRole } from '../../middleware/rbac';
import { validateRequest } from '../../middleware/validator';

export const patientsRouter = Router();

patientsRouter.use(authenticate());

// 1. List Patients (Requires ward access)
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

// 2. Create / Admit Patient (Admin only)
patientsRouter.post(
  '/',
  requireRole(['ADMIN']),
  validateRequest({ body: CreatePatientSchema }),
  (req: Request, res: Response) => {
    const body = req.body;
    const now = Date.now();
    const patientId = body.id || `P${now.toString().slice(-4)}`;
    const mrn = body.mrn || `MRN-${Math.floor(10000 + Math.random() * 90000)}`;
    const bedId = body.bedId || `BED-${body.bedNumber.replace(/\s+/g, '-').toUpperCase()}`;

    const newPatient: Patient = {
      id: patientId,
      mrn,
      name: body.name,
      age: body.age,
      gender: body.gender,
      wardId: body.wardId || 'WARD-A',
      bedId,
      bedNumber: body.bedNumber,
      admissionDiagnosis: body.admissionDiagnosis,
      admissionTimestamp: body.admissionTimestamp || now,
      attendingPhysician: body.attendingPhysician || 'Staff Attending',
      primaryNurse: body.primaryNurse || req.user?.fullName || 'Staff RN',
      codeStatus: body.codeStatus || 'FULL_CODE',
      baselineMEWS: body.baselineMEWS ?? 0,
      allergies: body.allergies || [],
      isolationStatus: body.isolationStatus || 'NONE',
      isActive: body.isActive ?? true,
      history: body.history || [],
      notes: body.notes || [],
    };

    const created = wardStateService.createPatient(newPatient);

    res.status(201).json({
      data: created,
      message: `Patient '${created.name}' (${created.id}) admitted successfully.`,
    });
  }
);

// 3. Get Patient Detail
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

// 4. Update Patient Details (Admin only)
patientsRouter.put(
  '/:patientId',
  requireRole(['ADMIN']),
  validateRequest({ body: UpdatePatientSchema }),
  (req: Request, res: Response) => {
    const patientId = String(req.params.patientId);
    const updated = wardStateService.updatePatient(patientId, req.body);

    res.status(200).json({
      data: updated,
      message: `Patient '${patientId}' details updated successfully.`,
    });
  }
);

patientsRouter.patch(
  '/:patientId',
  requireRole(['ADMIN']),
  validateRequest({ body: UpdatePatientSchema }),
  (req: Request, res: Response) => {
    const patientId = String(req.params.patientId);
    const updated = wardStateService.updatePatient(patientId, req.body);

    res.status(200).json({
      data: updated,
      message: `Patient '${patientId}' details updated successfully.`,
    });
  }
);

// 5. Delete / Discharge Patient (Admin only)
patientsRouter.delete(
  '/:patientId',
  requireRole(['ADMIN']),
  (req: Request, res: Response) => {
    const patientId = String(req.params.patientId);
    wardStateService.deletePatient(patientId);

    res.status(200).json({
      success: true,
      message: `Patient '${patientId}' discharged and removed from active ward census.`,
    });
  }
);
