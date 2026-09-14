import type { AttentionReason, ClinicalActionType, Provenance } from '@aegispulse/types';
import type { AttentionPriorityConfig } from '../config';
import type { ComponentScore } from '../types';

export function evaluateInformationDecay(
  lastTrustedTimestamp: number | undefined,
  evaluationTimestamp: number,
  config: AttentionPriorityConfig,
  sourceObservationIds: string[]
): ComponentScore {
  const { halfLifeMinutes, warnThresholdMinutes, criticalThresholdMinutes, maxDecayMinutes } =
    config.decayThresholds;

  let elapsedMinutes = 0;
  let hasTrustedHistory = false;

  if (lastTrustedTimestamp !== undefined) {
    elapsedMinutes = Math.min(
      maxDecayMinutes,
      Math.max(0, (evaluationTimestamp - lastTrustedTimestamp) / 60000)
    );
    hasTrustedHistory = true;
  } else {
    // If patient has never received a trusted observation, treat as critically stale (4 hours default)
    elapsedMinutes = criticalThresholdMinutes;
    hasTrustedHistory = false;
  }

  // Sigmoidal saturation model: 100 * (1 - 1 / (1 + (t / tau)^2))
  const ratio = elapsedMinutes / halfLifeMinutes;
  const decayFraction = 1 - 1 / (1 + ratio * ratio);
  const normalizedContribution = Math.min(100, Math.round(decayFraction * 100));

  const reasons: AttentionReason[] = [];
  const recommendedActions: ClinicalActionType[] = [];

  const hours = Math.floor(elapsedMinutes / 60);
  const minutes = Math.round(elapsedMinutes % 60);
  const timeString = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  if (elapsedMinutes >= criticalThresholdMinutes) {
    reasons.push({
      code: 'INFORMATION_DECAY_TIMEOUT',
      description: `Critical observation timeout: ${timeString} elapsed since last verified bedside vitals (threshold: ${criticalThresholdMinutes / 60}h)`,
      contributionWeight: 0.35,
      triggerValue: Math.round(elapsedMinutes),
      thresholdValue: criticalThresholdMinutes,
      unit: 'MINUTES',
      urgency: 'EVALUATE',
    });
    recommendedActions.push('BEDSIDE_VISIT', 'MANUAL_VITALS_RECHECK');
  } else if (elapsedMinutes >= warnThresholdMinutes) {
    reasons.push({
      code: 'INFORMATION_DECAY_TIMEOUT',
      description: `Information decay: ${timeString} since last verified observation (threshold: ${warnThresholdMinutes / 60}h)`,
      contributionWeight: 0.25,
      triggerValue: Math.round(elapsedMinutes),
      thresholdValue: warnThresholdMinutes,
      unit: 'MINUTES',
      urgency: 'WATCH',
    });
    recommendedActions.push('BEDSIDE_VISIT');
  }

  const weight = config.weights.informationDecay;
  const weightedContribution = Number((normalizedContribution * weight).toFixed(2));

  const explanation = !hasTrustedHistory
    ? `Information decay score ${normalizedContribution}/100: No verified bedside vitals on record (assumed ${timeString} stale)`
    : normalizedContribution < 25
      ? `Fresh clinical data: ${timeString} since verified bedside check (decay ${normalizedContribution}/100)`
      : `Information decay score ${normalizedContribution}/100: ${timeString} since verified bedside check`;

  const provenance: Provenance = {
    derivedAt: evaluationTimestamp,
    algorithm: 'INFORMATION_DECAY_EVALUATOR',
    algorithmVersion: '1.0.0',
    sourceObservationIds:
      sourceObservationIds.length > 0 ? sourceObservationIds : ['OBS-DEFAULT'],
    confidence: 1.0,
    parameters: {
      elapsedMinutes: Math.round(elapsedMinutes),
      halfLifeMinutes,
      hasTrustedHistory,
      normalizedContribution,
    },
  };

  return {
    componentName: 'informationDecay',
    normalizedContribution,
    rawScore: Math.round(elapsedMinutes),
    weight,
    weightedContribution,
    explanation,
    provenance,
    reasons,
    recommendedActions,
    metadata: {
      elapsedMinutes: Math.round(elapsedMinutes),
      timeString,
    },
  };
}
