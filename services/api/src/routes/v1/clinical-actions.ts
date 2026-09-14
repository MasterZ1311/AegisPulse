import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  ClinicalActionTypeEnum,
  ClinicalActionStatusEnum,
  AttentionPriorityCategoryEnum,
  type ClinicalAction,
} from '@aegispulse/types';
import { createActionTimelineEvent } from '@aegispulse/clinical';
import { wardStateService } from '../../services/ward-state.service';
import { timelineService } from '../../services/timeline.service';
import { telemetryPipelineService } from '../../services/telemetry-pipeline.service';
import { validateRequest } from '../../middleware/validator';
import { authenticate } from '../../middleware/auth';
import { requireRole, requirePatientWardAccess } from '../../middleware/rbac';

export const clinicalActionsRouter = Router({ mergeParams: true });

clinicalActionsRouter.use(authenticate({ optional: true }));
clinicalActionsRouter.use(requirePatientWardAccess());

const CreateActionSchema = z
  .object({
    id: z.string().optional(),
    actionType: ClinicalActionTypeEnum,
    title: z.string().min(1).max(200),
    rationale: z.string().min(1).max(1000),
    urgency: AttentionPriorityCategoryEnum.default('WATCH'),
    targetCompletionMinutes: z.number().int().min(1).max(1440).default(60),
  })
  .strict();

const UpdateActionStatusSchema = z
  .object({
    status: ClinicalActionStatusEnum,
    outcomeNotes: z.string().max(1000).optional(),
  })
  .strict();

clinicalActionsRouter.get('/', (req: Request, res: Response) => {
  const patientId = String(req.params.patientId);
  const actions = wardStateService.getActions(patientId);
  res.status(200).json({ data: actions, total: actions.length });
});

clinicalActionsRouter.post(
  '/',
  authenticate(),
  validateRequest({ body: CreateActionSchema }),
  (req: Request, res: Response) => {
    const patientId = String(req.params.patientId);
    const patient = wardStateService.getPatient(patientId);
    const body = req.body as z.infer<typeof CreateActionSchema>;
    const now = Date.now();

    const action: ClinicalAction = {
      id: body.id ?? `act-${patientId}-${now}-${Math.random().toString(36).substring(2, 6)}`,
      patientId,
      bedId: patient.bedId,
      actionType: body.actionType,
      title: body.title,
      rationale: body.rationale,
      status: 'RECOMMENDED',
      urgency: body.urgency,
      recommendedAt: now,
      targetCompletionTimestamp: now + body.targetCompletionMinutes * 60 * 1000,
    };

    wardStateService.addAction(action);

    // Timeline event
    const timelineEvent = createActionTimelineEvent(action, { bedNumber: patient.bedNumber });
    timelineService.addEvent(timelineEvent);

    res.status(201).json({
      message: 'Clinical action recommended.',
      data: action,
    });
  }
);

clinicalActionsRouter.patch(
  '/:actionId',
  authenticate(),
  requireRole(['WARD_NURSE', 'CHARGE_NURSE', 'RESIDENT_PHYSICIAN', 'ATTENDING_PHYSICIAN']),
  validateRequest({ body: UpdateActionStatusSchema }),
  (req: Request, res: Response) => {
    const actionId = String(req.params.actionId);
    const patientId = String(req.params.patientId);
    const patient = wardStateService.getPatient(patientId);
    const body = req.body as z.infer<typeof UpdateActionStatusSchema>;
    const userId = req.user!.userId;

    const updated = wardStateService.updateActionStatus(actionId, body.status, userId, body.outcomeNotes);

    // Sync updated action to timeline
    const timelineEvent = createActionTimelineEvent(updated, {
      bedNumber: patient.bedNumber,
      actorUserId: userId,
    });
    timelineService.addEvent(timelineEvent);
    telemetryPipelineService.processTimelineEvent(timelineEvent, patient.wardId);

    if (body.status === 'COMPLETED') {
      telemetryPipelineService.processAcknowledgement(
        {
          id: `ack-action-${updated.id}`,
          patientId,
          alertId: updated.id,
          acknowledgedByUserId: userId,
          acknowledgedAt: Date.now(),
          reason: body.outcomeNotes || `Completed action: ${updated.title}`,
        },
        patient.wardId
      );
    }

    res.status(200).json({
      message: `Clinical action marked as ${body.status}.`,
      data: updated,
    });
  }
);
