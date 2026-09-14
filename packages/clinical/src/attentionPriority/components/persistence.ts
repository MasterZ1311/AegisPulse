import type { AttentionReason, Provenance, SignalQuality } from '@aegispulse/types';
import type { AttentionPriorityConfig } from '../config';
import type { ComponentScore, ExtractedVitalHistory, ExtractedVitals } from '../types';

export interface PersistenceEvaluationResult {
  persistenceFactor: number; // 0.15 to 1.0
  isTransientSpike: boolean;
  sustainedDurationMinutes: number;
  componentScore: ComponentScore;
}

export function evaluatePersistence(
  vitals: ExtractedVitals,
  history: ExtractedVitalHistory,
  signalQuality: SignalQuality | undefined,
  config: AttentionPriorityConfig,
  evaluationTimestamp: number,
  sourceObservationIds: string[]
): PersistenceEvaluationResult {
  const {
    transientWindowMinutes,
    sustainedWindowMinutes,
    minSpikeDampingFactor,
    motionArtifactDiscountFactor,
  } = config.persistenceThresholds;

  const hrThresh = config.vitalThresholds.hr;
  const rrThresh = config.vitalThresholds.rr;

  let maxAbnormalDurationMs = 0;
  let hasAbnormality = false;

  // Check HR history for duration of abnormality
  if (vitals.HEART_RATE && history.HEART_RATE && history.HEART_RATE.length > 0) {
    const isCurrentAbnormal =
      vitals.HEART_RATE.value >= hrThresh.tachyMild ||
      vitals.HEART_RATE.value <= hrThresh.bradyMild;

    if (isCurrentAbnormal) {
      hasAbnormality = true;
      // Trace backwards to find continuous onset
      const hrSeries = history.HEART_RATE;
      let onsetTimestamp = vitals.HEART_RATE.timestamp;
      for (let i = hrSeries.length - 1; i >= 0; i--) {
        const r = hrSeries[i];
        if (r.value >= hrThresh.tachyMild || r.value <= hrThresh.bradyMild) {
          onsetTimestamp = r.timestamp;
        } else {
          break; // Continuous run ended
        }
      }
      const durationMs = evaluationTimestamp - onsetTimestamp;
      if (durationMs > maxAbnormalDurationMs) {
        maxAbnormalDurationMs = durationMs;
      }
    }
  }

  // Check RR history for duration of abnormality
  if (vitals.RESPIRATORY_RATE && history.RESPIRATORY_RATE && history.RESPIRATORY_RATE.length > 0) {
    const isCurrentAbnormal =
      vitals.RESPIRATORY_RATE.value >= rrThresh.tachyMild ||
      vitals.RESPIRATORY_RATE.value <= rrThresh.bradySevere;

    if (isCurrentAbnormal) {
      hasAbnormality = true;
      const rrSeries = history.RESPIRATORY_RATE;
      let onsetTimestamp = vitals.RESPIRATORY_RATE.timestamp;
      for (let i = rrSeries.length - 1; i >= 0; i--) {
        const r = rrSeries[i];
        if (r.value >= rrThresh.tachyMild || r.value <= rrThresh.bradySevere) {
          onsetTimestamp = r.timestamp;
        } else {
          break;
        }
      }
      const durationMs = evaluationTimestamp - onsetTimestamp;
      if (durationMs > maxAbnormalDurationMs) {
        maxAbnormalDurationMs = durationMs;
      }
    }
  }

  const sustainedDurationMinutes = Number((maxAbnormalDurationMs / 60000).toFixed(1));

  let persistenceFactor = 1.0;
  let isTransientSpike = false;
  const reasons: AttentionReason[] = [];

  if (!hasAbnormality) {
    persistenceFactor = 1.0;
  } else if (sustainedDurationMinutes <= transientWindowMinutes) {
    // Transient spike detected
    isTransientSpike = true;
    const ratio = Math.max(0.1, sustainedDurationMinutes / sustainedWindowMinutes);
    persistenceFactor = Math.max(minSpikeDampingFactor, ratio);

    // If motion artifact coincides with transient spike, discount further
    const motionIndex = signalQuality?.motionArtifactIndex ?? 0;
    if (motionIndex > 0.4) {
      persistenceFactor = Math.max(0.15, persistenceFactor * motionArtifactDiscountFactor);
    }
  } else if (sustainedDurationMinutes >= sustainedWindowMinutes) {
    // Confirmed sustained deterioration
    persistenceFactor = 1.0;
    reasons.push({
      code: 'PERSISTENT_DETERIORATION',
      description: `Physiological abnormality sustained for ${sustainedDurationMinutes} minutes (exceeds ${sustainedWindowMinutes}m window)`,
      contributionWeight: 0.25,
      triggerValue: sustainedDurationMinutes,
      thresholdValue: sustainedWindowMinutes,
      unit: 'MINUTES',
      urgency: 'CRITICAL_REVIEW',
    });
  } else {
    // In transition between transient and sustained
    persistenceFactor = Math.min(1.0, sustainedDurationMinutes / sustainedWindowMinutes);
  }

  // Normalized contribution of persistence to ward attention
  const normalizedContribution = !hasAbnormality
    ? 0
    : Math.round(persistenceFactor * 100);

  const explanation = !hasAbnormality
    ? 'No sustained physiological abnormalities detected'
    : isTransientSpike
      ? `Transient spike detected (${sustainedDurationMinutes}m <= ${transientWindowMinutes}m threshold; persistence factor ${persistenceFactor.toFixed(2)} applied)`
      : `Sustained physiological decompensation (${sustainedDurationMinutes}m persistence; persistence factor ${persistenceFactor.toFixed(2)})`;

  const provenance: Provenance = {
    derivedAt: evaluationTimestamp,
    algorithm: 'PERSISTENCE_FILTER_EVALUATOR',
    algorithmVersion: '1.0.0',
    sourceObservationIds:
      sourceObservationIds.length > 0 ? sourceObservationIds : ['OBS-DEFAULT'],
    confidence: 1.0,
    parameters: {
      sustainedDurationMinutes,
      isTransientSpike,
      persistenceFactor,
      normalizedContribution,
    },
  };

  const componentScore: ComponentScore = {
    componentName: 'persistence',
    normalizedContribution,
    rawScore: Math.round(sustainedDurationMinutes),
    weight: 0, // Persistence acts primarily as a modulator on velocity and acute abnormality
    weightedContribution: 0,
    explanation,
    provenance,
    reasons,
    recommendedActions: isTransientSpike ? [] : ['BEDSIDE_VISIT'],
  };

  return {
    persistenceFactor,
    isTransientSpike,
    sustainedDurationMinutes,
    componentScore,
  };
}
