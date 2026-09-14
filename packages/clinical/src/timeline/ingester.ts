import type {
  UnifiedTimelineEvent,
  PhysiologicalObservation,
  LaboratoryResult,
  ClinicalAction,
} from '@aegispulse/types';

export function createVitalTimelineEvent(
  obs: PhysiologicalObservation,
  options?: { bedNumber?: string; isTrusted?: boolean; notes?: string }
): UnifiedTimelineEvent {
  const isTrusted = options?.isTrusted ?? (obs.qualityState === 'TRUSTED');
  const details: string[] = [];
  if (obs.heartRate !== undefined) details.push(`HR ${obs.heartRate} bpm`);
  if (obs.respiratoryRate !== undefined) details.push(`RR ${obs.respiratoryRate} /min`);
  if (obs.systolicBP !== undefined) details.push(`BP ${obs.systolicBP}/${obs.diastolicBP ?? '--'} mmHg`);
  if (obs.shockIndex !== undefined) details.push(`SI ${obs.shockIndex}`);

  return {
    id: `ev-obs-${obs.id}`,
    patientId: obs.patientId,
    bedNumber: options?.bedNumber,
    timestamp: obs.timestamp,
    eventType: 'VITAL_MEASUREMENT',
    title: 'Vital Sign Measurement',
    description: details.join(', ') || 'Bedside telemetry measurement recorded.',
    source: obs.source,
    isTrusted,
    severity: 'INFO',
    data: {
      observationId: obs.id,
      vitalType: obs.heartRate !== undefined ? 'HEART_RATE' : 'RESPIRATORY_RATE',
      value: obs.heartRate ?? obs.respiratoryRate ?? obs.systolicBP ?? 0,
      unit: obs.heartRate !== undefined ? 'BPM' : 'BREATHS_PER_MINUTE',
      confidence: obs.confidence,
      qualityStatus: obs.qualityState,
      notes: options?.notes,
    },
  };
}

export function createManualObservationTimelineEvent(params: {
  id?: string;
  patientId: string;
  bedNumber?: string;
  timestamp?: number;
  actorUserId?: string;
  actorRole?: string;
  title?: string;
  description: string;
  data?: Record<string, any>;
}): UnifiedTimelineEvent {
  return {
    id: params.id ?? `ev-manual-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    patientId: params.patientId,
    bedNumber: params.bedNumber,
    timestamp: params.timestamp ?? Date.now(),
    eventType: 'MANUAL_OBSERVATION',
    title: params.title ?? 'Manual Bedside Observation',
    description: params.description,
    source: 'MANUAL_ENTRY',
    isTrusted: true,
    severity: 'INFO',
    actorUserId: params.actorUserId,
    actorRole: params.actorRole ?? 'WARD_NURSE',
    data: params.data,
  };
}

export function createNurseVisitTimelineEvent(params: {
  id?: string;
  patientId: string;
  bedNumber?: string;
  timestamp?: number;
  actorUserId?: string;
  actorRole?: string;
  nurseName?: string;
  description: string;
  data?: Record<string, any>;
}): UnifiedTimelineEvent {
  return {
    id: params.id ?? `ev-visit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    patientId: params.patientId,
    bedNumber: params.bedNumber,
    timestamp: params.timestamp ?? Date.now(),
    eventType: 'NURSE_VISIT',
    title: 'Nurse Bedside Visit',
    description: params.description,
    source: 'MANUAL_ENTRY',
    isTrusted: true,
    severity: 'INFO',
    actorUserId: params.actorUserId,
    actorRole: params.actorRole ?? 'WARD_NURSE',
    data: {
      nurseName: params.nurseName ?? 'Staff Nurse',
      ...params.data,
    },
  };
}

export function createLabTimelineEvent(
  lab: LaboratoryResult,
  options?: { bedNumber?: string }
): UnifiedTimelineEvent {
  const isAbnormal = lab.isCritical || lab.value < lab.referenceRange.low || lab.value > lab.referenceRange.high;
  return {
    id: `ev-lab-${lab.id}`,
    patientId: lab.patientId,
    bedNumber: options?.bedNumber,
    timestamp: lab.timestamp,
    eventType: 'LAB_RESULT',
    title: `Lab: ${lab.testName} Resulted`,
    description: `${lab.testName}: ${lab.value} ${lab.unit} (Ref: ${lab.referenceRange.low}-${lab.referenceRange.high})`,
    source: 'LAB_LIS',
    isTrusted: true,
    severity: lab.isCritical ? 'CRITICAL' : isAbnormal ? 'WARNING' : 'INFO',
    data: {
      labId: lab.id,
      testName: lab.testName,
      testCode: lab.testCode,
      value: lab.value,
      unit: lab.unit,
      isAbnormal,
      isCritical: lab.isCritical,
    },
  };
}

export function createScoreChangeEvent(params: {
  patientId: string;
  bedNumber?: string;
  scoreType: 'APS' | 'MEWS' | 'QSOFA';
  previousScore?: number;
  currentScore: number;
  previousCategoryOrLevel?: string;
  currentCategoryOrLevel?: string;
  reasons?: string[];
  timestamp?: number;
}): UnifiedTimelineEvent {
  const isEscalation = params.previousScore !== undefined && params.currentScore > params.previousScore;
  const eventType =
    params.scoreType === 'APS'
      ? 'APS_CHANGE'
      : params.scoreType === 'MEWS'
        ? 'MEWS_CHANGE'
        : 'QSOFA_CHANGE';

  return {
    id: `ev-score-${params.scoreType.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    patientId: params.patientId,
    bedNumber: params.bedNumber,
    timestamp: params.timestamp ?? Date.now(),
    eventType,
    title: `${params.scoreType} Score ${isEscalation ? 'Escalated' : 'Updated'}: ${params.currentScore}`,
    description: `${params.scoreType} transitioned to ${params.currentScore}${params.currentCategoryOrLevel ? ` (${params.currentCategoryOrLevel})` : ''}. ${params.reasons?.slice(0, 2).join('; ') ?? ''}`,
    source: 'CLINICAL_ENGINE',
    isTrusted: true,
    severity: isEscalation ? 'WARNING' : 'INFO',
    data: {
      score: params.currentScore,
      previousScore: params.previousScore,
      currentScore: params.currentScore,
      category: params.currentCategoryOrLevel,
      triageLevel: params.currentCategoryOrLevel,
      isPositive: params.scoreType === 'QSOFA' ? params.currentScore >= 2 : undefined,
      reasons: params.reasons,
    },
  };
}

export function createActionTimelineEvent(
  action: ClinicalAction,
  options?: { bedNumber?: string; actorUserId?: string }
): UnifiedTimelineEvent {
  const isCompleted = action.status === 'COMPLETED';
  return {
    id: `ev-action-${action.id}`,
    patientId: action.patientId,
    bedNumber: options?.bedNumber,
    timestamp: isCompleted && action.completedAt ? action.completedAt : action.recommendedAt,
    eventType: isCompleted ? 'COMPLETED_ACTION' : 'RECOMMENDED_ACTION',
    title: `${action.actionType.replace(/_/g, ' ')} (${action.status})`,
    description: action.rationale || `Clinical action ${action.status.toLowerCase()}`,
    source: isCompleted ? 'MANUAL_ENTRY' : 'CLINICAL_ENGINE',
    isTrusted: true,
    severity: action.status === 'COMPLETED' ? 'INFO' : 'WARNING',
    actorUserId: options?.actorUserId ?? action.completedByUserId,
    data: {
      actionId: action.id,
      actionType: action.actionType,
      status: action.status,
      rationale: action.rationale,
      performedBy: action.completedByUserId,
    },
  };
}

export function createAcknowledgementTimelineEvent(params: {
  patientId: string;
  bedNumber?: string;
  alertId?: string;
  actorUserId: string;
  actorRole?: string;
  reason?: string;
  timestamp?: number;
}): UnifiedTimelineEvent {
  return {
    id: `ev-ack-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    patientId: params.patientId,
    bedNumber: params.bedNumber,
    timestamp: params.timestamp ?? Date.now(),
    eventType: 'ACKNOWLEDGEMENT',
    title: 'Clinical Alert / Escalation Acknowledged',
    description: `Staff acknowledged alert. Note: ${params.reason || 'Reviewed at nurse station.'}`,
    source: 'MANUAL_ENTRY',
    isTrusted: true,
    severity: 'INFO',
    actorUserId: params.actorUserId,
    actorRole: params.actorRole ?? 'CHARGE_NURSE',
    data: {
      alertId: params.alertId,
      actorUserId: params.actorUserId,
      reason: params.reason,
    },
  };
}
