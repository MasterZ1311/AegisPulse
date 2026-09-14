import type { AttentionReason, ClinicalActionType, Provenance } from '@aegispulse/types';
import type { AttentionPriorityConfig } from '../config';
import type { ComponentScore, ExtractedVitals, PatientBaselineVitals } from '../types';

export function evaluateBaselineDeviation(
  vitals: ExtractedVitals,
  baseline: PatientBaselineVitals | undefined,
  config: AttentionPriorityConfig,
  evaluationTimestamp: number,
  sourceObservationIds: string[]
): ComponentScore {
  const scores: number[] = [];
  const explanations: string[] = [];
  const reasons: AttentionReason[] = [];
  const recommendedActions: ClinicalActionType[] = [];

  // Default ward standard baseline if patient-specific baseline not specified
  const effectiveBaseline: Required<PatientBaselineVitals> = {
    heartRate: baseline?.heartRate ?? 72,
    respiratoryRate: baseline?.respiratoryRate ?? 16,
    systolicBP: baseline?.systolicBP ?? 120,
    diastolicBP: baseline?.diastolicBP ?? 80,
    spo2: baseline?.spo2 ?? 98,
    temperature: baseline?.temperature ?? 36.8,
  };

  const {
    hrPercentMild,
    hrPercentModerate,
    hrPercentSevere,
    rrPercentMild,
    rrPercentModerate,
    rrPercentSevere,
    sbpDropPercentMild,
    sbpDropPercentSevere,
  } = config.baselineDeviationThresholds;

  // 1. Heart Rate deviation
  if (vitals.HEART_RATE) {
    const current = vitals.HEART_RATE.value;
    const base = effectiveBaseline.heartRate;
    const diff = current - base;
    const rel = diff / base;

    if (rel >= hrPercentSevere) {
      scores.push(90);
      explanations.push(`HR +${Math.round(rel * 100)}% over baseline (${current} vs ${base} bpm)`);
      reasons.push({
        code: 'BASELINE_DEVIATION',
        description: `Heart Rate elevated +${Math.round(rel * 100)}% above baseline (${current} bpm vs baseline ${base} bpm)`,
        contributionWeight: 0.25,
        triggerValue: current,
        thresholdValue: base,
        unit: 'BPM',
        urgency: 'EVALUATE',
      });
      recommendedActions.push('MANUAL_VITALS_RECHECK');
    } else if (rel >= hrPercentModerate) {
      scores.push(60);
      explanations.push(`HR +${Math.round(rel * 100)}% over baseline (${current} vs ${base} bpm)`);
    } else if (rel >= hrPercentMild) {
      scores.push(30);
      explanations.push(`HR +${Math.round(rel * 100)}% over baseline (${current} vs ${base} bpm)`);
    } else {
      scores.push(0);
    }
  }

  // 2. Respiratory Rate deviation
  if (vitals.RESPIRATORY_RATE) {
    const current = vitals.RESPIRATORY_RATE.value;
    const base = effectiveBaseline.respiratoryRate;
    const diff = current - base;
    const rel = diff / base;

    if (rel >= rrPercentSevere) {
      scores.push(90);
      explanations.push(`RR +${Math.round(rel * 100)}% over baseline (${current} vs ${base}/min)`);
      reasons.push({
        code: 'BASELINE_DEVIATION',
        description: `Respiratory Rate increased +${Math.round(rel * 100)}% over baseline (${current}/min vs baseline ${base}/min)`,
        contributionWeight: 0.30,
        triggerValue: current,
        thresholdValue: base,
        unit: 'BREATHS_PER_MINUTE',
        urgency: 'EVALUATE',
      });
      recommendedActions.push('BEDSIDE_VISIT');
    } else if (rel >= rrPercentModerate) {
      scores.push(60);
      explanations.push(`RR +${Math.round(rel * 100)}% over baseline (${current} vs ${base}/min)`);
    } else if (rel >= rrPercentMild) {
      scores.push(30);
      explanations.push(`RR +${Math.round(rel * 100)}% over baseline (${current} vs ${base}/min)`);
    } else {
      scores.push(0);
    }
  }

  // 3. Systolic BP drop
  if (vitals.SYSTOLIC_BP) {
    const current = vitals.SYSTOLIC_BP.value;
    const base = effectiveBaseline.systolicBP;
    const dropRel = (base - current) / base;

    if (dropRel >= sbpDropPercentSevere) {
      scores.push(85);
      explanations.push(`SBP dropped -${Math.round(dropRel * 100)}% from baseline (${current} vs ${base} mmHg)`);
      reasons.push({
        code: 'BASELINE_DEVIATION',
        description: `Systolic BP dropped -${Math.round(dropRel * 100)}% below patient baseline (${current} vs ${base} mmHg)`,
        contributionWeight: 0.30,
        triggerValue: current,
        thresholdValue: base,
        unit: 'MMHG',
        urgency: 'EVALUATE',
      });
      recommendedActions.push('ATTACH_CUFF');
    } else if (dropRel >= sbpDropPercentMild) {
      scores.push(50);
      explanations.push(`SBP dropped -${Math.round(dropRel * 100)}% from baseline (${current} vs ${base} mmHg)`);
    } else {
      scores.push(0);
    }
  }

  const maxScore = scores.length > 0 ? Math.max(...scores) : 0;
  const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const normalizedContribution = Math.round(
    Math.min(100, maxScore * 0.70 + avgScore * 0.30)
  );

  const weight = config.weights.baselineDeviation;
  const weightedContribution = Number((normalizedContribution * weight).toFixed(2));

  const explanation =
    normalizedContribution === 0
      ? 'Vitals tracking closely within patient personal baseline envelope'
      : `Baseline deviation score ${normalizedContribution}/100: ${explanations.join(', ')}`;

  const provenance: Provenance = {
    derivedAt: evaluationTimestamp,
    algorithm: 'BASELINE_DEVIATION_EVALUATOR',
    algorithmVersion: '1.0.0',
    sourceObservationIds:
      sourceObservationIds.length > 0 ? sourceObservationIds : ['OBS-DEFAULT'],
    confidence: 1.0,
    parameters: {
      maxScore,
      normalizedContribution,
      hasExplicitBaseline: baseline !== undefined,
    },
  };

  return {
    componentName: 'baselineDeviation',
    normalizedContribution,
    rawScore: maxScore,
    weight,
    weightedContribution,
    explanation,
    provenance,
    reasons,
    recommendedActions,
  };
}
