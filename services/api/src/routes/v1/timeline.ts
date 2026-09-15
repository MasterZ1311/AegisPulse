import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  UnifiedTimelineEventTypeEnum,
  AlertSeverityEnum,
  ObservationSourceEnum,
  type UnifiedTimelineEvent,
} from '@aegispulse/types';
import { timelineService } from '../../services/timeline.service';
import { validateRequest } from '../../middleware/validator';
import { authenticate } from '../../middleware/auth';
import { requirePatientWardAccess } from '../../middleware/rbac';

export const timelineRouter = Router({ mergeParams: true });

timelineRouter.use(authenticate());
timelineRouter.use(requirePatientWardAccess());

const TimelineEventCreateSchema = z
  .object({
    id: z.string().optional(),
    timestamp: z.number().int().min(0).optional(),
    eventType: UnifiedTimelineEventTypeEnum,
    title: z.string().min(1).max(200),
    description: z.string().min(1).max(1000),
    severity: AlertSeverityEnum.default('INFO'),
    source: z.union([ObservationSourceEnum, z.literal('CLINICAL_ENGINE'), z.literal('MANUAL_ENTRY'), z.literal('LAB_LIS'), z.literal('SYSTEM')]).default('MANUAL_ENTRY'),
    isTrusted: z.boolean().optional(),
    data: z.record(z.string(), z.any()).optional(),
  })
  .strict();

// 1. Chronological Timeline Stream
timelineRouter.get('/', (req: Request, res: Response) => {
  const patientId = String(req.params.patientId);
  const since = req.query.since ? Number(req.query.since) : undefined;
  const until = req.query.until ? Number(req.query.until) : undefined;
  const trustedOnly = req.query.trustedOnly === 'true';
  const limit = req.query.limit ? Math.min(Number(req.query.limit), 500) : 100;
  const order = req.query.order === 'desc' ? 'desc' : 'asc';

  let eventTypes: any = undefined;
  if (req.query.types) {
    eventTypes = String(req.query.types).split(',').map((t) => t.trim());
  }

  const events = timelineService.query(patientId, {
    since,
    until,
    trustedOnly,
    limit,
    order,
    eventTypes,
  });

  res.status(200).json({
    data: events,
    total: events.length,
    patientId,
  });
});

// 2. Ingest Timeline Event (Manual observation, nurse visit, etc.)
timelineRouter.post(
  '/events',
  validateRequest({ body: TimelineEventCreateSchema }),
  (req: Request, res: Response) => {
    const patientId = String(req.params.patientId);
    const body = req.body as z.infer<typeof TimelineEventCreateSchema>;
    const now = Date.now();
    const timestamp = body.timestamp ?? now;

    if (timestamp > now + 300000) {
      res.status(400).json({
        statusCode: 400,
        error: 'Invalid Timestamp',
        message: 'Timeline event timestamp cannot be in the future (max allowable clock skew is 5 minutes).',
      });
      return;
    }

    const id = body.id ?? `ev-user-${patientId}-${timestamp}-${Math.random().toString(36).substring(2, 6)}`;
    const actorUserId = req.user!.userId;
    const actorRole = req.user!.role;

    const event: UnifiedTimelineEvent = {
      id,
      patientId,
      timestamp,
      eventType: body.eventType,
      title: body.title,
      description: body.description,
      severity: body.severity,
      source: body.source,
      isTrusted: true, // Authoritative: Authenticated clinical user actions are trusted
      actorUserId,
      actorRole,
      data: body.data,
    };

    timelineService.addEvent(event);

    res.status(201).json({
      message: 'Timeline event recorded.',
      data: event,
    });
  }
);


// 3. Question 1: "What changed during the last 4 hours?"
timelineRouter.get('/changes', (req: Request, res: Response) => {
  const patientId = String(req.params.patientId);
  const hours = req.query.hours ? Number(req.query.hours) : 4;

  const result = timelineService.getChangesInWindow(patientId, hours);
  res.status(200).json({ data: result });
});

// 4. Question 2: "What caused the patient's priority to rise?"
timelineRouter.get('/priority-rise', (req: Request, res: Response) => {
  const patientId = String(req.params.patientId);
  const hours = req.query.hours ? Number(req.query.hours) : 4;

  const result = timelineService.getPriorityRiseAttribution(patientId, hours);
  res.status(200).json({ data: result });
});

// 5. Question 3: "When was the patient last manually assessed?"
timelineRouter.get('/last-manual-assessment', (req: Request, res: Response) => {
  const patientId = String(req.params.patientId);

  const result = timelineService.getLastManualAssessment(patientId);
  res.status(200).json({ data: result });
});

// 6. Question 4: "Which measurements were trusted?"
timelineRouter.get('/trusted-measurements', (req: Request, res: Response) => {
  const patientId = String(req.params.patientId);
  const since = req.query.since ? Number(req.query.since) : undefined;
  const until = req.query.until ? Number(req.query.until) : undefined;
  const vitalType = req.query.vitalType as string | undefined;

  const result = timelineService.getTrustedMeasurements(patientId, { since, until, vitalType });
  res.status(200).json({ data: result });
});
