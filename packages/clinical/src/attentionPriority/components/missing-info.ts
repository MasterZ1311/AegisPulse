import type { AttentionReason, ClinicalActionType, Provenance } from '@aegispulse/types';
import type { AttentionPriorityConfig } from '../config';
import type { ComponentScore, ExtractedVitals } from '../types';

export function evaluateMissingInformation(
  vitals: ExtractedVitals,
  config: AttentionPriorityConfig,
  evaluationTimestamp: number,
  sourceObservationIds: string[]
): ComponentScore {
  const missingVitals: string[] = [];
  const reasons: AttentionReason[] = [];
  const recommendedActions: ClinicalActionType[] = [];
  let penaltyTotal = 0;

  // 1. Blood pressure missing
  if (!vitals.SYSTOLIC_BP) {
    penaltyTotal += 30;
    missingVitals.push('Blood Pressure');
    recommendedActions.push('ATTACH_CUFF');
  }

  // 2. Respiratory rate missing
  if (!vitals.RESPIRATORY_RATE) {
    penaltyTotal += 25;
    missingVitals.push('Respiratory Rate');
    recommendedActions.push('MANUAL_VITALS_RECHECK');
  }

  // 3. Heart rate missing
  if (!vitals.HEART_RATE) {
    penaltyTotal += 25;
    missingVitals.push('Heart Rate');
  }

  // 4. Oxygen saturation missing
  if (!vitals.OXYGEN_SATURATION) {
    penaltyTotal += 15;
    missingVitals.push('SpO2');
  }

  // 5. Temperature missing
  if (!vitals.BODY_TEMPERATURE) {
    penaltyTotal += 5;
    missingVitals.push('Temperature');
  }

  const normalizedContribution = Math.min(100, penaltyTotal);

  if (normalizedContribution >= 30) {
    reasons.push({
      code: 'MISSING_VITAL_SIGNS',
      description: `Incomplete vital sign set: missing ${missingVitals.join(', ')}`,
      contributionWeight: 0.20,
      triggerValue: missingVitals.length,
      thresholdValue: 1,
      unit: 'COUNT',
      urgency: normalizedContribution >= 50 ? 'EVALUATE' : 'WATCH',
    });
    if (!recommendedActions.includes('MANUAL_VITALS_RECHECK')) {
      recommendedActions.push('MANUAL_VITALS_RECHECK');
    }
  }

  const weight = config.weights.missingInfo;
  const weightedContribution = Number((normalizedContribution * weight).toFixed(2));

  const explanation =
    normalizedContribution === 0
      ? 'Complete physiological observation set recorded'
      : `Missing information penalty ${normalizedContribution}/100: missing ${missingVitals.join(', ')}`;

  const provenance: Provenance = {
    derivedAt: evaluationTimestamp,
    algorithm: 'MISSING_INFORMATION_EVALUATOR',
    algorithmVersion: '1.0.0',
    sourceObservationIds:
      sourceObservationIds.length > 0 ? sourceObservationIds : ['OBS-DEFAULT'],
    confidence: 1.0,
    parameters: {
      missingCount: missingVitals.length,
      normalizedContribution,
    },
  };

  return {
    componentName: 'missingInfo',
    normalizedContribution,
    rawScore: missingVitals.length,
    weight,
    weightedContribution,
    explanation,
    provenance,
    reasons,
    recommendedActions,
  };
}
