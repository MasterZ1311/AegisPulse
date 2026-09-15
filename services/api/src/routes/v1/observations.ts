import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  ObservationSourceEnum,
  QualityStatusEnum,
  type PhysiologicalObservation,
} from '@aegispulse/types';
import { createVitalTimelineEvent } from '@aegispulse/clinical';
import { wardStateService } from '../../services/ward-state.service';
import { timelineService } from '../../services/timeline.service';
import { telemetryPipelineService } from '../../services/telemetry-pipeline.service';
import { validateRequest } from '../../middleware/validator';
import { authenticate } from '../../middleware/auth';
import { requirePatientWardAccess } from '../../middleware/rbac';
import { createRateLimiter } from '../../middleware/rate-limiter';

export const observationsRouter = Router({ mergeParams: true });

observationsRouter.use(authenticate());

const ingestionRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 100,
});

const IngestObservationSchema = z
  .object({
    id: z.string().optional(),
    timestamp: z.number().int().min(0).optional(),
    source: ObservationSourceEnum.default('BEDSIDE_DEVICE'),
    confidence: z.number().min(0).max(1).default(0.95),
    qualityState: QualityStatusEnum.default('TRUSTED'),
    heartRate: z.number().min(20).max(300).optional(),
    respiratoryRate: z.number().min(2).max(80).optional(),
    systolicBP: z.number().min(30).max(300).optional(),
    diastolicBP: z.number().min(10).max(200).optional(),
    temperature: z.number().min(25).max(45).optional(),
    spo2: z.number().min(40).max(100).optional(),
    shockIndex: z.number().min(0.1).max(5.0).optional(),
    notes: z.string().max(500).optional(),
  })
  .strict();

observationsRouter.get('/', requirePatientWardAccess(), (req: Request, res: Response) => {
  const patientId = String(req.params.patientId);
  const since = req.query.since ? Number(req.query.since) : undefined;
  const until = req.query.until ? Number(req.query.until) : undefined;

  const observations = wardStateService.getObservations(patientId, { since, until });
  res.status(200).json({ data: observations, total: observations.length });
});

observationsRouter.post(
  '/',
  requirePatientWardAccess(),
  ingestionRateLimiter,
  validateRequest({ body: IngestObservationSchema }),
  (req: Request, res: Response, next: import('express').NextFunction) => {
    try {
      const patientId = String(req.params.patientId);
      const patient = wardStateService.getPatient(patientId);

      const idempotencyKey = (req.headers['idempotency-key'] as string) || (req.headers['x-idempotency-key'] as string);
      if (idempotencyKey && wardStateService.getIdempotencyRepo().hasKey(idempotencyKey)) {
        res.status(409).json({
          type: 'https://aegispulse.internal/errors/DUPLICATE_ENTITY',
          title: 'Duplicate Event',
          status: 409,
          detail: `Event with idempotency key '${idempotencyKey}' has already been processed and ingested.`,
          code: 'DUPLICATE_ENTITY',
        });
        return;
      }

      const body = req.body as z.infer<typeof IngestObservationSchema>;
      const now = Date.now();
      const timestamp = body.timestamp ?? now;

      // Clock skew / timestamp attack protection: reject timestamps > 5 min in future
      if (timestamp > now + 300000) {
        res.status(400).json({
          statusCode: 400,
          error: 'Invalid Timestamp',
          message: 'Observation timestamp cannot be in the future (max allowable clock skew is 5 minutes).',
        });
        return;
      }

      // Historical timestamp bounds: reject timestamps older than 7 days
      if (timestamp < now - 7 * 86400000) {
        res.status(400).json({
          statusCode: 400,
          error: 'Invalid Timestamp',
          message: 'Observation timestamp is too far in the past (maximum allowable data age is 7 days).',
        });
        return;
      }

      // Authoritative Shock Index: Server recomputes authoritative value and NEVER trusts client-provided derived score
      let shockIndex: number | undefined = undefined;
      if (body.heartRate !== undefined && body.systolicBP !== undefined && body.systolicBP > 0) {
        shockIndex = Number((body.heartRate / body.systolicBP).toFixed(2));
      }

      // Stale telemetry handling: If data is older than 24h, mark quality as degraded
      const isStale = now - timestamp > 24 * 3600000;
      const qualityState = isStale ? 'DEGRADED' : body.qualityState;
      const confidence = isStale ? Math.min(body.confidence, 0.5) : body.confidence;

      const id = body.id ?? `obs-${patientId}-${timestamp}-${Math.random().toString(36).substring(2, 6)}`;

      const observation: PhysiologicalObservation = {
        id,
        patientId,
        timestamp,
        source: body.source,
        confidence,
        qualityState,
        heartRate: body.heartRate,
        respiratoryRate: body.respiratoryRate,
        systolicBP: body.systolicBP,
        diastolicBP: body.diastolicBP,
        temperature: body.temperature,
        spo2: body.spo2,
        shockIndex,
      };

      // Ingest into telemetry pipeline (persists, calculates APS, and broadcasts to event stream)
      telemetryPipelineService.processObservation(observation);

      // Record idempotency key if provided
      if (idempotencyKey) {
        wardStateService.getIdempotencyRepo().recordKey({
          key: idempotencyKey,
          itemType: 'OBSERVATION',
          patientId,
          status: 'SUCCESS',
        });
      }

      // Sync to unified patient timeline
      const timelineEvent = createVitalTimelineEvent(observation, {
        bedNumber: patient.bedNumber,
        notes: body.notes,
      });
      timelineService.addEvent(timelineEvent);
      telemetryPipelineService.processTimelineEvent(timelineEvent, patient.wardId);

      res.status(201).json({
        message: 'Physiological observation successfully ingested and indexed into timeline.',
        data: observation,
      });
    } catch (err) {
      next(err);
    }
  }
);

