import type { AttentionReason, ClinicalActionType, Provenance } from '@aegispulse/types';
import type { AttentionPriorityConfig } from '../config';
import type { ComponentScore, ExtractedVitals } from '../types';

export function evaluateAbnormality(
  vitals: ExtractedVitals,
  config: AttentionPriorityConfig,
  evaluationTimestamp: number,
  sourceObservationIds: string[]
): ComponentScore {
  const scores: number[] = [];
  const explanations: string[] = [];
  const reasons: AttentionReason[] = [];
  const recommendedActions: ClinicalActionType[] = [];

  const { hr, rr, sbp, spo2, temp, shockIndex } = config.vitalThresholds;

  // 1. Heart Rate
  if (vitals.HEART_RATE) {
    const val = vitals.HEART_RATE.value;
    if (val >= hr.tachySevere || val <= hr.bradySevere) {
      scores.push(100);
      explanations.push(`Severe HR ${val} bpm`);
    } else if (val >= hr.tachyModerate) {
      scores.push(70);
      explanations.push(`Moderate tachycardia HR ${val} bpm`);
    } else if (val >= hr.tachyMild) {
      scores.push(40);
      explanations.push(`Mild tachycardia HR ${val} bpm`);
    } else if (val <= hr.bradyMild) {
      scores.push(50);
      explanations.push(`Bradycardia HR ${val} bpm`);
    } else {
      scores.push(0);
    }
  }

  // 2. Respiratory Rate
  if (vitals.RESPIRATORY_RATE) {
    const val = vitals.RESPIRATORY_RATE.value;
    if (val >= rr.tachySevere || val <= rr.bradySevere) {
      scores.push(100);
      explanations.push(`Critical RR ${val}/min`);
      recommendedActions.push('MANUAL_VITALS_RECHECK');
    } else if (val >= rr.tachyModerate) {
      scores.push(75);
      explanations.push(`Marked tachypnea RR ${val}/min`);
      recommendedActions.push('MANUAL_VITALS_RECHECK');
    } else if (val >= rr.tachyMild) {
      scores.push(45);
      explanations.push(`Mild tachypnea RR ${val}/min`);
    } else {
      scores.push(0);
    }
  }

  // 3. Systolic BP
  if (vitals.SYSTOLIC_BP) {
    const val = vitals.SYSTOLIC_BP.value;
    if (val <= sbp.hypoSevere) {
      scores.push(100);
      explanations.push(`Severe hypotension SBP ${val} mmHg`);
      recommendedActions.push('ATTACH_CUFF', 'MANUAL_VITALS_RECHECK');
    } else if (val <= sbp.hypoModerate) {
      scores.push(80);
      explanations.push(`Moderate hypotension SBP ${val} mmHg`);
      recommendedActions.push('ATTACH_CUFF');
    } else if (val <= sbp.hypoMild) {
      scores.push(50);
      explanations.push(`Mild hypotension SBP ${val} mmHg`);
    } else if (val >= sbp.hyperSevere) {
      scores.push(65);
      explanations.push(`Severe hypertension SBP ${val} mmHg`);
    } else {
      scores.push(0);
    }
  }

  // 4. SpO2
  if (vitals.OXYGEN_SATURATION) {
    const val = vitals.OXYGEN_SATURATION.value;
    if (val <= spo2.hypoxiaSevere) {
      scores.push(100);
      explanations.push(`Critical hypoxia SpO2 ${val}%`);
      recommendedActions.push('BEDSIDE_VISIT', 'MANUAL_VITALS_RECHECK');
    } else if (val <= spo2.hypoxiaModerate) {
      scores.push(75);
      explanations.push(`Moderate hypoxia SpO2 ${val}%`);
      recommendedActions.push('BEDSIDE_VISIT');
    } else if (val <= spo2.hypoxiaMild) {
      scores.push(40);
      explanations.push(`Mild hypoxia SpO2 ${val}%`);
    } else {
      scores.push(0);
    }
  }

  // 5. Shock Index
  if (vitals.SHOCK_INDEX) {
    const val = vitals.SHOCK_INDEX.value;
    if (val >= shockIndex.severeShock) {
      scores.push(100);
      explanations.push(`Severe occult shock SI ${val}`);
      reasons.push({
        code: 'SHOCK_INDEX_OCCULT',
        description: `Critical Shock Index ${val} (exceeds threshold ${shockIndex.severeShock}) - occult decompensation`,
        contributionWeight: 0.35,
        triggerValue: val,
        thresholdValue: shockIndex.severeShock,
        unit: 'RATIO',
        urgency: 'CRITICAL_REVIEW',
      });
      recommendedActions.push('ATTACH_CUFF', 'SBAR_PHYSICIAN_CONSULT');
    } else if (val >= shockIndex.occultShock) {
      scores.push(75);
      explanations.push(`Occult shock SI ${val}`);
      reasons.push({
        code: 'SHOCK_INDEX_OCCULT',
        description: `Elevated Shock Index ${val} (threshold ${shockIndex.occultShock})`,
        contributionWeight: 0.25,
        triggerValue: val,
        thresholdValue: shockIndex.occultShock,
        unit: 'RATIO',
        urgency: 'EVALUATE',
      });
      recommendedActions.push('ATTACH_CUFF');
    } else if (val >= shockIndex.mildElevated) {
      scores.push(40);
      explanations.push(`Mildly elevated SI ${val}`);
    } else {
      scores.push(0);
    }
  }

  // 6. Temperature
  if (vitals.BODY_TEMPERATURE) {
    const val = vitals.BODY_TEMPERATURE.value;
    if (val <= temp.hypothermia || val >= temp.feverHigh) {
      scores.push(65);
      explanations.push(`Severe temperature derangement ${val}°C`);
    } else if (val >= temp.feverMild) {
      scores.push(35);
      explanations.push(`Fever ${val}°C`);
    } else {
      scores.push(0);
    }
  }

  const maxScore = scores.length > 0 ? Math.max(...scores) : 0;
  const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  // Blend max (dominant acute failure) with average (multisystem derangement)
  const normalizedContribution = Math.round(
    Math.min(100, maxScore * 0.75 + avgScore * 0.25)
  );

  const weight = config.weights.abnormality;
  const weightedContribution = Number((normalizedContribution * weight).toFixed(2));

  const explanation =
    normalizedContribution === 0
      ? 'All physiological vitals within safe biological ranges'
      : `Physiological abnormality score ${normalizedContribution}/100: ${explanations.join(', ')}`;

  const provenance: Provenance = {
    derivedAt: evaluationTimestamp,
    algorithm: 'PHYSIOLOGICAL_ABNORMALITY_EVALUATOR',
    algorithmVersion: '1.0.0',
    sourceObservationIds:
      sourceObservationIds.length > 0 ? sourceObservationIds : ['OBS-DEFAULT'],
    confidence: 1.0,
    parameters: {
      maxScore,
      avgScore,
      normalizedContribution,
    },
  };

  return {
    componentName: 'abnormality',
    normalizedContribution,
    rawScore: maxScore,
    weight,
    weightedContribution,
    explanation,
    provenance,
    reasons,
    recommendedActions,
    metadata: { subscores: scores },
  };
}
