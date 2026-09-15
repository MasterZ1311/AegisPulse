import { Router, Request, Response } from 'express';
import {
  AttentionPriorityEngine,
  ExplainabilityEngine,
  type PatientStateInput,
} from '@aegispulse/clinical';
import { wardStateService } from '../../services/ward-state.service';
import { authenticate } from '../../middleware/auth';
import { requirePatientWardAccess, requireWardAccess } from '../../middleware/rbac';

export const attentionPriorityRouter = Router();

const apsEngine = new AttentionPriorityEngine();
const explainEngine = new ExplainabilityEngine();

function expandObservations(rawObs: any[], patient: any): any[] {
  const result: any[] = [];
  for (const ro of rawObs) {
    const base = {
      patientId: patient.id,
      bedId: patient.bedId,
      timestamp: ro.timestamp,
      source: ro.source,
      confidence: ro.confidence,
      qualityStatus: ro.qualityState,
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

// Patient Attention Priority Assessment
attentionPriorityRouter.get(
  '/patients/:patientId/attention-priority',
  authenticate(),
  requirePatientWardAccess(),
  (req: Request, res: Response) => {
    const patientId = String(req.params.patientId);
    const patient = wardStateService.getPatient(patientId);
    const rawObs = wardStateService.getObservations(patient.id);
    const labs = wardStateService.getLabs(patient.id);
    const observations = expandObservations(rawObs, patient);

    const state: PatientStateInput = {
      patientId: patient.id,
      bedNumber: patient.bedNumber,
      currentTimestamp: Date.now(),
      observations,
      labs,
    };

    const evaluationResult = apsEngine.evaluate(state);
    const explanationResult = explainEngine.explainPatient(state, evaluationResult);

    res.status(200).json({
      data: {
        patientId: patient.id,
        bedNumber: patient.bedNumber,
        apsScore: evaluationResult.score,
        category: evaluationResult.category,
        confidence: evaluationResult.confidence,
        rankInputs: evaluationResult.rankInputs,
        components: {
          velocityScore: evaluationResult.velocityScore,
          decayScore: evaluationResult.decayScore,
          mewsComponent: evaluationResult.mewsComponent,
          biomarkerComponent: evaluationResult.biomarkerComponent,
        },
        reasons: explanationResult.reasons,
        topReason: explanationResult.primaryExplanation,
        recommendedActions: evaluationResult.recommendedActions.map((a) => a.title || a.actionType),
        timestamp: evaluationResult.timestamp,
      },
    });
  }
);

// Ward Priority Radar
attentionPriorityRouter.get(
  '/wards/:wardId/radar',
  authenticate(),
  requireWardAccess(),
  (req: Request, res: Response) => {
    const wardId = String(req.params.wardId);
    const ward = wardStateService.getWard(wardId);

  const patients = wardStateService.getPatients(ward.id);

  const radarItems = patients.map((patient) => {
    const rawObs = wardStateService.getObservations(patient.id);
    const labs = wardStateService.getLabs(patient.id);
    const observations = expandObservations(rawObs, patient);

    const state: PatientStateInput = {
      patientId: patient.id,
      bedNumber: patient.bedNumber,
      currentTimestamp: Date.now(),
      observations,
      labs,
    };

    const evaluationResult = apsEngine.evaluate(state);
    const explanationResult = explainEngine.explainPatient(state, evaluationResult);

    return {
      patientId: patient.id,
      patientName: patient.name,
      bedNumber: patient.bedNumber,
      apsScore: evaluationResult.score,
      category: evaluationResult.category,
      topReason: explanationResult.primaryExplanation || 'Stable vitals',
      recommendedAction: evaluationResult.recommendedActions[0] || 'CONTINUE_MONITORING',
      timestamp: evaluationResult.timestamp,
    };
  });

  // Rank by APS score descending
  radarItems.sort((a, b) => b.apsScore - a.apsScore);

  res.status(200).json({
    data: {
      wardId: ward.id,
      wardName: ward.name,
      patientCount: radarItems.length,
      radar: radarItems,
    },
  });
});
