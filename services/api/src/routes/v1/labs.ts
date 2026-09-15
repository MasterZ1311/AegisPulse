import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  LabTestCodeEnum,
  LabUnitEnum,
  type LaboratoryResult,
} from '@aegispulse/types';
import { createLabTimelineEvent } from '@aegispulse/clinical';
import { wardStateService } from '../../services/ward-state.service';
import { timelineService } from '../../services/timeline.service';
import { validateRequest } from '../../middleware/validator';
import { authenticate } from '../../middleware/auth';
import { requirePatientWardAccess } from '../../middleware/rbac';

export const labsRouter = Router({ mergeParams: true });

labsRouter.use(authenticate());
labsRouter.use(requirePatientWardAccess());

const IngestLabSchema = z
  .object({
    id: z.string().optional(),
    testCode: LabTestCodeEnum,
    testName: z.string().min(1).max(200),
    value: z.number().min(0).max(100000),
    unit: LabUnitEnum,
    referenceRange: z.object({
      low: z.number().min(0),
      high: z.number().min(0),
    }),
    isCritical: z.boolean().optional(),
    sourceLab: z.string().max(200).default('CENTRAL_HOSPITAL_LAB'),
    timestamp: z.number().int().min(0).optional(),
  })
  .strict();

labsRouter.get('/', (req: Request, res: Response) => {
  const patientId = String(req.params.patientId);
  const labs = wardStateService.getLabs(patientId);
  res.status(200).json({ data: labs, total: labs.length });
});

labsRouter.post(
  '/',
  validateRequest({ body: IngestLabSchema }),
  (req: Request, res: Response) => {
    const patientId = String(req.params.patientId);
    const patient = wardStateService.getPatient(patientId);

    const body = req.body as z.infer<typeof IngestLabSchema>;
    const now = Date.now();
    const timestamp = body.timestamp ?? now;

    // Clock skew / timestamp attack protection
    if (timestamp > now + 300000) {
      res.status(400).json({
        statusCode: 400,
        error: 'Invalid Timestamp',
        message: 'Lab result timestamp cannot be in the future (max allowable clock skew is 5 minutes).',
      });
      return;
    }

    // Authoritative criticality derivation: Server determines critical status based on reference range
    const isCritical = body.value < body.referenceRange.low || body.value > body.referenceRange.high;

    const id = body.id ?? `lab-${patientId}-${timestamp}-${Math.random().toString(36).substring(2, 6)}`;

    const labResult: LaboratoryResult = {
      id,
      patientId,
      timestamp,
      testCode: body.testCode,
      testName: body.testName,
      value: body.value,
      unit: body.unit,
      referenceRange: body.referenceRange,
      isCritical,
      sourceLab: body.sourceLab,
    };

    wardStateService.addLab(labResult);

    // Sync to timeline
    const timelineEvent = createLabTimelineEvent(labResult, { bedNumber: patient.bedNumber });
    timelineService.addEvent(timelineEvent);

    res.status(201).json({
      message: 'Laboratory result successfully recorded and indexed into timeline.',
      data: labResult,
    });
  }
);

