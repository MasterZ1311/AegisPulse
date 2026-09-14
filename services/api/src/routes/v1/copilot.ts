import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  CopilotQueryTypeEnum,
  type CopilotQueryType,
} from '@aegispulse/types';
import {
  buildStructuredEvidencePackage,
  ClinicalCopilotEngine,
  CopilotAuditLogger,
  AttentionPriorityEngine,
  type PatientStateInput,
} from '@aegispulse/clinical';
import { wardStateService } from '../../services/ward-state.service';
import { timelineService } from '../../services/timeline.service';
import { validateRequest } from '../../middleware/validator';
import { authenticate } from '../../middleware/auth';
import { requireRole, requirePatientWardAccess } from '../../middleware/rbac';
import { createRateLimiter } from '../../middleware/rate-limiter';

export const copilotRouter = Router({ mergeParams: true });

// Singletons for the API layer
const copilotAuditLogger = new CopilotAuditLogger();
const copilotEngine = new ClinicalCopilotEngine({ auditLogger: copilotAuditLogger });
const apsEngine = new AttentionPriorityEngine();

copilotRouter.use(authenticate());
copilotRouter.use(requirePatientWardAccess());

const copilotRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 30, // 30 copilot queries per minute per client
});

const CopilotQuerySchema = z
  .object({
    query: z.string().min(1).max(2000),
    queryType: CopilotQueryTypeEnum.default('QUESTION_ANSWER'),
    includeExplanations: z.boolean().default(true),
  })
  .strict();

function expandObservations(rawObs: any[], patient: any): any[] {
  const result: any[] = [];
  for (const ro of rawObs) {
    const base = {
      patientId: patient.id,
      bedId: patient.bedId,
      timestamp: ro.timestamp,
      source: ro.source,
      confidence: ro.confidence,
      qualityStatus: ro.qualityState ?? 'TRUSTED',
    };
    if (ro.heartRate !== undefined) result.push({ ...base, id: `${ro.id}-hr`, vitalType: 'HEART_RATE', value: ro.heartRate, unit: 'BPM' });
    if (ro.respiratoryRate !== undefined) result.push({ ...base, id: `${ro.id}-rr`, vitalType: 'RESPIRATORY_RATE', value: ro.respiratoryRate, unit: 'BREATHS_PER_MINUTE' });
    if (ro.systolicBP !== undefined) result.push({ ...base, id: `${ro.id}-sbp`, vitalType: 'SYSTOLIC_BP', value: ro.systolicBP, unit: 'MMHG' });
    if (ro.diastolicBP !== undefined) result.push({ ...base, id: `${ro.id}-dbp`, vitalType: 'DIASTOLIC_BP', value: ro.diastolicBP, unit: 'MMHG' });
    if (ro.spo2 !== undefined) result.push({ ...base, id: `${ro.id}-spo2`, vitalType: 'OXYGEN_SATURATION', value: ro.spo2, unit: 'PERCENT' });
    if (ro.temperature !== undefined) result.push({ ...base, id: `${ro.id}-temp`, vitalType: 'BODY_TEMPERATURE', value: ro.temperature, unit: 'CELSIUS' });
    if (ro.heartRate !== undefined && ro.systolicBP !== undefined && ro.systolicBP > 0) {
      result.push({ ...base, id: `${ro.id}-si`, vitalType: 'SHOCK_INDEX', value: Number((ro.heartRate / ro.systolicBP).toFixed(2)), unit: 'RATIO' });
    }
  }
  return result;
}

/**
 * POST /api/v1/patients/:patientId/copilot
 * Advisory AI Clinical Copilot endpoint bounded by read-only structured evidence.
 * Zero ungrounded extrapolation; multi-tier prompt injection defense; strict non-autonomous governance.
 */
copilotRouter.post(
  '/',
  requireRole(['WARD_NURSE', 'CHARGE_NURSE', 'RESIDENT_PHYSICIAN', 'ATTENDING_PHYSICIAN', 'ADMIN']),
  copilotRateLimiter,
  validateRequest({ body: CopilotQuerySchema }),
  (req: Request, res: Response) => {
    const patientId = String(req.params.patientId);
    const patient = wardStateService.getPatient(patientId);
    const body = req.body as z.infer<typeof CopilotQuerySchema>;

    const rawObs = wardStateService.getObservations(patientId);
    const labs = wardStateService.getLabs(patientId);
    const timelineEvents = timelineService.query(patientId, { limit: 15, order: 'desc' });
    const observations = expandObservations(rawObs, patient);

    // Evaluate current deterministic attention priority
    const state: PatientStateInput = {
      patientId: patient.id,
      bedNumber: patient.bedNumber,
      currentTimestamp: Date.now(),
      observations,
      labs,
    };
    const evaluationResult = apsEngine.evaluate(state);

    // Assemble immutable structured evidence package
    const evidence = buildStructuredEvidencePackage({
      patient: {
        id: patient.id,
        bedNumber: patient.bedNumber,
        name: patient.name,
        age: patient.age,
        gender: patient.gender,
        codeStatus: patient.codeStatus,
        admissionReason: patient.admissionDiagnosis,
        comorbidities: patient.history ?? [],
      },
      currentAps: {
        score: evaluationResult.score,
        category: evaluationResult.category,
        mewsScore: evaluationResult.mewsComponent,
        shockIndex: 0.7,
      },
      verifiedObservations: observations,
      recentLabs: labs.map((l) => ({
        testCode: l.testCode,
        testName: l.testName,
        value: l.value,
        unit: l.unit,
        timestamp: l.timestamp,
        isCritical: l.isCritical,
      })),
      timelineEvents: timelineEvents.map((t) => ({
        eventId: t.id,
        timestamp: t.timestamp,
        eventType: t.eventType,
        title: t.title,
        description: t.description,
      })),
    });

    const copilotResponse = copilotEngine.askSync({
      patientId,
      actorId: req.user?.userId ?? 'anonymous',
      actorRole: req.user?.role,
      query: body.query,
      queryType: body.queryType as CopilotQueryType,
      evidence,
    });

    res.status(200).json({
      data: {
        ...copilotResponse,
        evidenceHash: evidence.contextHash,
      },
      status: copilotResponse.status,
    });
  }
);
