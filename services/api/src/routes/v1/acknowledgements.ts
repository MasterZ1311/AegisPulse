import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { createAcknowledgementTimelineEvent } from '@aegispulse/clinical';
import { wardStateService } from '../../services/ward-state.service';
import { timelineService } from '../../services/timeline.service';
import { telemetryPipelineService } from '../../services/telemetry-pipeline.service';
import { validateRequest } from '../../middleware/validator';
import { authenticate } from '../../middleware/auth';
import { requireRole, requirePatientWardAccess } from '../../middleware/rbac';

export const acknowledgementsRouter = Router({ mergeParams: true });

acknowledgementsRouter.use(authenticate());
acknowledgementsRouter.use(requirePatientWardAccess());

const AcknowledgementCreateSchema = z
  .object({
    alertId: z.string().optional(),
    reason: z.string().min(1).max(500),
  })
  .strict();

acknowledgementsRouter.get('/', (req: Request, res: Response) => {
  const patientId = String(req.params.patientId);
  const acks = wardStateService.getAcknowledgements(patientId);
  res.status(200).json({ data: acks, total: acks.length });
});

acknowledgementsRouter.post(
  '/',
  requireRole(['WARD_NURSE', 'CHARGE_NURSE', 'RESIDENT_PHYSICIAN', 'ATTENDING_PHYSICIAN']),
  validateRequest({ body: AcknowledgementCreateSchema }),
  (req: Request, res: Response) => {
    const patientId = String(req.params.patientId);
    const patient = wardStateService.getPatient(patientId);
    const body = req.body as z.infer<typeof AcknowledgementCreateSchema>;
    const userId = req.user!.userId;
    const now = Date.now();

    const record = {
      id: `ack-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      patientId,
      alertId: body.alertId,
      acknowledgedByUserId: userId,
      acknowledgedAt: now,
      reason: body.reason,
    };

    wardStateService.addAcknowledgement(record);
    telemetryPipelineService.processAcknowledgement(record, patient.wardId);

    // Ingest into timeline
    const timelineEvent = createAcknowledgementTimelineEvent({
      patientId,
      bedNumber: patient.bedNumber,
      alertId: body.alertId,
      actorUserId: userId,
      actorRole: req.user!.role,
      reason: body.reason,
      timestamp: now,
    });
    timelineService.addEvent(timelineEvent);
    telemetryPipelineService.processTimelineEvent(timelineEvent, patient.wardId);

    res.status(201).json({
      message: 'Alert / escalation acknowledged successfully.',
      data: record,
    });
  }
);
