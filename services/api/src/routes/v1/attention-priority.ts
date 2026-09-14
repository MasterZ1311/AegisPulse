import { Router, Request, Response } from 'express';
import {
  AttentionPriorityEngine,
  ExplainabilityEngine,
  type PatientStateInput,
} from '@aegispulse/clinical';
import { wardStateService } from '../../services/ward-state.service';
import { authenticate } from '../../middleware/auth';

export const attentionPriorityRouter = Router();

attentionPriorityRouter.use(authenticate({ optional: true }));

const apsEngine = new AttentionPriorityEngine();
const explainEngine = new ExplainabilityEngine();

// Patient Attention Priority Assessment
attentionPriorityRouter.get('/patients/:patientId/attention-priority', (req: Request, res: Response) => {
  const patientId = String(req.params.patientId);
  const patient = wardStateService.getPatient(patientId);
  const rawObs = wardStateService.getObservations(patient.id);
  const labs = wardStateService.getLabs(patient.id);

  // Convert raw observations into Observation[] format expected by engine
  const observations: any[] = rawObs.map((ro) => ({
    id: ro.id,
    patientId: patient.id,
    bedId: patient.bedId,
    timestamp: ro.timestamp,
    source: ro.source,
    vitalType: ro.heartRate !== undefined ? 'HEART_RATE' : 'RESPIRATORY_RATE',
    value: ro.heartRate ?? ro.respiratoryRate ?? ro.systolicBP ?? 0,
    unit: ro.heartRate !== undefined ? 'BPM' : 'BREATHS_PER_MINUTE',
    confidence: ro.confidence,
    qualityStatus: ro.qualityState,
  }));

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
});

// Ward Priority Radar
attentionPriorityRouter.get('/wards/:wardId/radar', (req: Request, res: Response) => {
  const wardId = String(req.params.wardId);
  const ward = wardStateService.getWard(wardId);
  const patients = wardStateService.getPatients(ward.id);

  const radarItems = patients.map((patient) => {
    const rawObs = wardStateService.getObservations(patient.id);
    const labs = wardStateService.getLabs(patient.id);

    const observations: any[] = rawObs.map((ro) => ({
      id: ro.id,
      patientId: patient.id,
      bedId: patient.bedId,
      timestamp: ro.timestamp,
      source: ro.source,
      vitalType: ro.heartRate !== undefined ? 'HEART_RATE' : 'RESPIRATORY_RATE',
      value: ro.heartRate ?? ro.respiratoryRate ?? ro.systolicBP ?? 0,
      unit: ro.heartRate !== undefined ? 'BPM' : 'BREATHS_PER_MINUTE',
      confidence: ro.confidence,
      qualityStatus: ro.qualityState,
    }));

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
