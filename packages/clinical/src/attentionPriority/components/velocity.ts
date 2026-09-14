import type { AttentionReason, ClinicalActionType, Provenance } from '@aegispulse/types';
import type { AttentionPriorityConfig } from '../config';
import type { ComponentScore, ExtractedVitalHistory, VitalReading } from '../types';

interface VelocityCalculation {
  velocityPerHour: number;
  isAccelerating: boolean;
  score: number;
  explanation: string;
}

function computeVitalVelocity(
  series: VitalReading[] | undefined,
  mildThresh: number,
  moderateThresh: number,
  severeThresh: number,
  unitLabel: string,
  accelMult: number
): VelocityCalculation | null {
  if (!series || series.length < 2) {
    return null;
  }

  // Look at observations over the last 60 minutes
  const latest = series[series.length - 1];
  const windowMs = 60 * 60 * 1000;
  const cutoff = latest.timestamp - windowMs;
  const recent = series.filter((r) => r.timestamp >= cutoff);

  if (recent.length < 2) {
    return null;
  }

  const oldest = recent[0];
  const timeDeltaHours = (latest.timestamp - oldest.timestamp) / (3600 * 1000);

  // Require at least 30 seconds separation to compute meaningful derivative
  if (timeDeltaHours < 30 / 3600) {
    return null;
  }

  const valueDelta = latest.value - oldest.value;
  const velocityPerHour = Number((valueDelta / timeDeltaHours).toFixed(2));

  let score = 0;
  if (velocityPerHour >= severeThresh) {
    score = 100;
  } else if (velocityPerHour >= moderateThresh) {
    score = 75;
  } else if (velocityPerHour >= mildThresh) {
    score = 40;
  } else if (velocityPerHour <= -severeThresh) {
    // Precipitous drop
    score = 70;
  }

  // Check acceleration (second derivative) if at least 3 points available
  let isAccelerating = false;
  if (recent.length >= 3 && velocityPerHour > 0) {
    const mid = recent[Math.floor(recent.length / 2)];
    const dt1 = (mid.timestamp - oldest.timestamp) / (3600 * 1000);
    const dt2 = (latest.timestamp - mid.timestamp) / (3600 * 1000);

    if (dt1 >= 15 / 3600 && dt2 >= 15 / 3600) {
      const v1 = (mid.value - oldest.value) / dt1;
      const v2 = (latest.value - mid.value) / dt2;
      if (v2 > v1 && v2 > mildThresh) {
        isAccelerating = true;
        score = Math.min(100, Math.round(score * accelMult));
      }
    }
  }

  const explanation = `${velocityPerHour >= 0 ? '+' : ''}${velocityPerHour} ${unitLabel}/hr${
    isAccelerating ? ' [ACCELERATING]' : ''
  }`;

  return {
    velocityPerHour,
    isAccelerating,
    score,
    explanation,
  };
}

export function evaluateVelocityAndAcceleration(
  history: ExtractedVitalHistory,
  config: AttentionPriorityConfig,
  evaluationTimestamp: number,
  sourceObservationIds: string[]
): ComponentScore {
  const scores: number[] = [];
  const explanations: string[] = [];
  const reasons: AttentionReason[] = [];
  const recommendedActions: ClinicalActionType[] = [];

  const {
    hrBpmPerHourMild,
    hrBpmPerHourModerate,
    hrBpmPerHourSevere,
    rrBreathsPerHourMild,
    rrBreathsPerHourModerate,
    rrBreathsPerHourSevere,
    siPerHourMild,
    siPerHourSevere,
    accelerationMultiplier,
  } = config.velocityThresholds;

  // 1. HR Velocity
  const hrCalc = computeVitalVelocity(
    history.HEART_RATE,
    hrBpmPerHourMild,
    hrBpmPerHourModerate,
    hrBpmPerHourSevere,
    'bpm',
    accelerationMultiplier
  );
  if (hrCalc && hrCalc.score > 0) {
    scores.push(hrCalc.score);
    explanations.push(`HR trajectory ${hrCalc.explanation}`);
    if (hrCalc.score >= 40) {
      reasons.push({
        code: 'VELOCITY_HR_SPIKE',
        description: `Heart Rate velocity accelerating at ${hrCalc.explanation}`,
        contributionWeight: 0.30,
        triggerValue: hrCalc.velocityPerHour,
        thresholdValue: hrBpmPerHourMild,
        unit: 'BPM_PER_HOUR',
        urgency: hrCalc.score >= 75 ? 'CRITICAL_REVIEW' : 'EVALUATE',
      });
      recommendedActions.push('MANUAL_VITALS_RECHECK');
    }
  }

  // 2. RR Velocity
  const rrCalc = computeVitalVelocity(
    history.RESPIRATORY_RATE,
    rrBreathsPerHourMild,
    rrBreathsPerHourModerate,
    rrBreathsPerHourSevere,
    'breaths/min',
    accelerationMultiplier
  );
  if (rrCalc && rrCalc.score > 0) {
    scores.push(rrCalc.score);
    explanations.push(`RR trajectory ${rrCalc.explanation}`);
    if (rrCalc.score >= 40) {
      reasons.push({
        code: 'VELOCITY_RR_SPIKE',
        description: `Respiratory Rate velocity escalating at ${rrCalc.explanation}`,
        contributionWeight: 0.35,
        triggerValue: rrCalc.velocityPerHour,
        thresholdValue: rrBreathsPerHourMild,
        unit: 'BREATHS_PER_MINUTE_PER_HOUR',
        urgency: rrCalc.score >= 75 ? 'CRITICAL_REVIEW' : 'EVALUATE',
      });
      recommendedActions.push('BEDSIDE_VISIT');
    }
  }

  // 3. Shock Index Velocity
  const siCalc = computeVitalVelocity(
    history.SHOCK_INDEX,
    siPerHourMild,
    (siPerHourMild + siPerHourSevere) / 2,
    siPerHourSevere,
    'ratio',
    accelerationMultiplier
  );
  if (siCalc && siCalc.score > 0) {
    scores.push(siCalc.score);
    explanations.push(`Shock Index trajectory ${siCalc.explanation}`);
    if (siCalc.score >= 50) {
      reasons.push({
        code: 'SHOCK_INDEX_OCCULT',
        description: `Occult shock velocity: SI worsening at ${siCalc.explanation}`,
        contributionWeight: 0.30,
        triggerValue: siCalc.velocityPerHour,
        thresholdValue: siPerHourMild,
        unit: 'RATIO_PER_HOUR',
        urgency: 'CRITICAL_REVIEW',
      });
      recommendedActions.push('ATTACH_CUFF');
    }
  }

  const maxScore = scores.length > 0 ? Math.max(...scores) : 0;
  const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const normalizedContribution = Math.round(
    Math.min(100, maxScore * 0.80 + avgScore * 0.20)
  );

  const weight = config.weights.velocity;
  const weightedContribution = Number((normalizedContribution * weight).toFixed(2));

  const explanation =
    normalizedContribution === 0
      ? 'Physiological rates of change stable across all modalities'
      : `Physiological velocity score ${normalizedContribution}/100: ${explanations.join(', ')}`;

  const provenance: Provenance = {
    derivedAt: evaluationTimestamp,
    algorithm: 'VELOCITY_ACCELERATION_EVALUATOR',
    algorithmVersion: '1.0.0',
    sourceObservationIds:
      sourceObservationIds.length > 0 ? sourceObservationIds : ['OBS-DEFAULT'],
    confidence: 1.0,
    parameters: {
      hrVelocity: hrCalc?.velocityPerHour ?? 0,
      rrVelocity: rrCalc?.velocityPerHour ?? 0,
      siVelocity: siCalc?.velocityPerHour ?? 0,
      normalizedContribution,
    },
  };

  return {
    componentName: 'velocity',
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
