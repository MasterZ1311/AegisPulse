import type { AttentionReason, ClinicalActionType, Provenance, SignalQuality } from '@aegispulse/types';
import type { AttentionPriorityConfig } from '../config';
import type { ComponentScore } from '../types';

export interface SignalConfidenceEvaluationResult {
  confidenceModulationFactor: number; // 0.20 to 1.0 (scales velocity)
  componentScore: ComponentScore;
}

export function evaluateSignalConfidence(
  signalQuality: SignalQuality | undefined,
  averageObservationConfidence: number,
  config: AttentionPriorityConfig,
  evaluationTimestamp: number,
  sourceObservationIds: string[]
): SignalConfidenceEvaluationResult {
  const {
    unreliableThreshold,
    degradedThreshold,
    trustedThreshold,
    lowConfidenceVelocityDiscount,
  } = config.confidenceThresholds;

  // Confidence as a fraction (0.0 to 1.0)
  const confidenceFraction = signalQuality
    ? signalQuality.sqiPercentage / 100
    : averageObservationConfidence / 100;

  let normalizedContribution = 0;
  let confidenceModulationFactor = 1.0;
  const reasons: AttentionReason[] = [];
  const recommendedActions: ClinicalActionType[] = [];

  const qualityStatus = signalQuality?.state ?? (
    confidenceFraction >= trustedThreshold
      ? 'TRUSTED'
      : confidenceFraction >= degradedThreshold
        ? 'DEGRADED'
        : 'UNRELIABLE'
  );

  if (confidenceFraction < unreliableThreshold || qualityStatus === 'UNRELIABLE' || qualityStatus === 'LOST') {
    // Sensor is unreliable or lost
    normalizedContribution = 80;
    confidenceModulationFactor = lowConfidenceVelocityDiscount; // Strongly dampen velocity to avoid false code alarms
    reasons.push({
      code: 'SENSOR_CONFIDENCE_DEGRADED',
      description: `Sensor signal degraded to ${Math.round(confidenceFraction * 100)}% (${qualityStatus}) - physiological telemetry untrusted`,
      contributionWeight: 0.30,
      triggerValue: Math.round(confidenceFraction * 100),
      thresholdValue: Math.round(unreliableThreshold * 100),
      unit: 'PERCENT',
      urgency: 'EVALUATE',
    });
    recommendedActions.push('MANUAL_VITALS_RECHECK', 'ATTACH_CUFF');
  } else if (confidenceFraction < degradedThreshold || qualityStatus === 'DEGRADED') {
    // Sensor is degraded (e.g. low ambient light, patient fidgeting)
    normalizedContribution = 45;
    confidenceModulationFactor = Math.max(
      lowConfidenceVelocityDiscount,
      confidenceFraction
    );
    reasons.push({
      code: 'SENSOR_CONFIDENCE_DEGRADED',
      description: `Optical telemetry quality degraded (${Math.round(confidenceFraction * 100)}% confidence) - check camera line of sight and lighting`,
      contributionWeight: 0.20,
      triggerValue: Math.round(confidenceFraction * 100),
      thresholdValue: Math.round(degradedThreshold * 100),
      unit: 'PERCENT',
      urgency: 'WATCH',
    });
    recommendedActions.push('MANUAL_VITALS_RECHECK');
  } else {
    // Trusted signal
    normalizedContribution = 0;
    confidenceModulationFactor = 1.0;
  }

  const weight = config.weights.signalConfidence;
  const weightedContribution = Number((normalizedContribution * weight).toFixed(2));

  const explanation =
    normalizedContribution === 0
      ? `Signal quality trusted (${Math.round(confidenceFraction * 100)}% SQI, ${qualityStatus})`
      : `Telemetry degraded (${Math.round(confidenceFraction * 100)}% SQI, ${qualityStatus}) - attention score ${normalizedContribution}/100`;

  const provenance: Provenance = {
    derivedAt: evaluationTimestamp,
    algorithm: 'SIGNAL_CONFIDENCE_EVALUATOR',
    algorithmVersion: '1.0.0',
    sourceObservationIds:
      sourceObservationIds.length > 0 ? sourceObservationIds : ['OBS-DEFAULT'],
    confidence: confidenceFraction,
    parameters: {
      confidenceFraction: Number(confidenceFraction.toFixed(2)),
      qualityStatus,
      confidenceModulationFactor: Number(confidenceModulationFactor.toFixed(2)),
      normalizedContribution,
    },
  };

  const componentScore: ComponentScore = {
    componentName: 'signalConfidence',
    normalizedContribution,
    rawScore: Math.round(confidenceFraction * 100),
    weight,
    weightedContribution,
    explanation,
    provenance,
    reasons,
    recommendedActions,
    metadata: {
      confidenceFraction,
      qualityStatus,
      confidenceModulationFactor,
    },
  };

  return {
    confidenceModulationFactor,
    componentScore,
  };
}
