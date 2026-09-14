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
import { createRateLimiter } from '../../middleware/rate-limiter';

export const observationsRouter = Router({ mergeParams: true });

observationsRouter.use(authenticate({ optional: true }));

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

observationsRouter.get('/', (req: Request, res: Response) => {
  const patientId = String(req.params.patientId);
  const since = req.query.since ? Number(req.query.since) : undefined;
  const until = req.query.until ? Number(req.query.until) : undefined;

  const observations = wardStateService.getObservations(patientId, { since, until });
  res.status(200).json({ data: observations, total: observations.length });
});

observationsRouter.post(
  '/',
  ingestionRateLimiter,
  validateRequest({ body: IngestObservationSchema }),
  (req: Request, res: Response) => {
    const patientId = String(req.params.patientId);
    const patient = wardStateService.getPatient(patientId);

    const body = req.body as z.infer<typeof IngestObservationSchema>;
    const timestamp = body.timestamp ?? Date.now();
    const id = body.id ?? `obs-${patientId}-${timestamp}-${Math.random().toString(36).substring(2, 6)}`;

    // Derive shock index if HR and SBP present and not explicitly provided
    let shockIndex = body.shockIndex;
    if (shockIndex === undefined && body.heartRate && body.systolicBP) {
      shockIndex = Number((body.heartRate / body.systolicBP).toFixed(2));
    }

    const observation: PhysiologicalObservation = {
      id,
      patientId,
      timestamp,
      source: body.source,
      confidence: body.confidence,
      qualityState: body.qualityState,
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
  }
);
