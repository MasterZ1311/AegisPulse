import type {
  AttentionReason,
  ClinicalActionType,
  Provenance,
  InformationFreshness,
  EpistemicRiskCategory,
} from '@aegispulse/types';
import { validateInformationFreshness } from '@aegispulse/types';
import type { AttentionPriorityConfig } from '../config';
import type { ComponentScore } from '../types';

export interface ExtendedDecayOptions {
  lastManualTimestamp?: number;
  lastCameraTimestamp?: number;
  confidence?: number;
  expectedMonitoringIntervalMinutes?: number;
  physiologicalAbnormalityScore?: number;
  rawVelocityScore?: number;
  mewsScore?: number;
}

export interface InformationDecayEvaluationResult extends ComponentScore {
  informationFreshness: InformationFreshness;
}

/**
 * Evaluates Information Decay and Freshness.
 *
 * UNCERTAINTY INVARIANT:
 * "No measurement" does NOT imply biological deterioration.
 * It strictly indicates increasing epistemic uncertainty.
 *
 * This evaluator explicitly calculates:
 * - Freshness score [0, 100]
 * - Epistemic uncertainty index [0.0, 1.0]
 * - Multi-channel tracking (trusted, manual, camera)
 * - Decoupling between physiological abnormality and epistemic uncertainty
 */
export function evaluateInformationDecay(
  lastTrustedTimestamp: number | undefined,
  evaluationTimestamp: number,
  config: AttentionPriorityConfig,
  sourceObservationIds: string[],
  options?: ExtendedDecayOptions
): InformationDecayEvaluationResult {
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
  const baseDecayScore = Math.min(100, Math.round(decayFraction * 100));

  // Configuration and Tracking
  const confidence = Math.max(0.0, Math.min(1.0, options?.confidence ?? 1.0));
  const expectedMonitoringIntervalMinutes = Math.max(
    1,
    options?.expectedMonitoringIntervalMinutes ?? criticalThresholdMinutes
  );
  const isIntervalExceeded = elapsedMinutes >= expectedMonitoringIntervalMinutes;

  // Information Freshness Score:
  // Decays exponentially relative to expected monitoring interval, modulated by signal confidence
  const intervalRatio = elapsedMinutes / expectedMonitoringIntervalMinutes;
  const freshnessBase = Math.round(100 * Math.exp(-0.693 * intervalRatio));
  const freshnessScore = Math.max(
    0,
    Math.min(100, Math.round(freshnessBase * Math.max(0.1, confidence)))
  );

  // Epistemic Uncertainty Index [0.0, 1.0]:
  // 0.0 = total certainty (fresh, trusted bedside observation)
  // 1.0 = maximum epistemic uncertainty (critically overdue or unverified signal)
  const uncertaintyIndex = Math.max(
    0.0,
    Math.min(1.0, Number((1.0 - freshnessScore / 100).toFixed(2)))
  );

  // Categorize Epistemic Risk:
  // FRESH: >= 75 (recent observation within 50% of monitoring interval)
  // MONITORING_DUE: 50 - 74 (approaching monitoring interval)
  // STALE: 26 - 49 (exceeded interval, uncertainty elevated)
  // CRITICALLY_EXPIRED: <= 25 (at least 2x interval has elapsed without trusted observation)
  let epistemicRiskCategory: EpistemicRiskCategory;
  if (freshnessScore >= 75) {
    epistemicRiskCategory = 'FRESH';
  } else if (freshnessScore >= 50) {
    epistemicRiskCategory = 'MONITORING_DUE';
  } else if (freshnessScore > 25) {
    epistemicRiskCategory = 'STALE';
  } else {
    epistemicRiskCategory = 'CRITICALLY_EXPIRED';
  }

  // Explicit Decoupling: Physiological Abnormality vs Epistemic Uncertainty
  const physiologicalAbnormality = Math.max(
    0,
    Math.min(100, options?.physiologicalAbnormalityScore ?? 0)
  );
  const velocityScore = Math.max(0, Math.min(100, options?.rawVelocityScore ?? 0));
  const mewsScore = options?.mewsScore ?? 0;
  // Subbe MEWS <= 1 is clinically normal / green triage level
  const mewsNormalized =
    mewsScore <= 1
      ? 0
      : Math.max(0, Math.min(100, Math.round(((mewsScore - 1) / 13) * 100)));

  const physiologicalScore = Math.max(
    physiologicalAbnormality,
    velocityScore,
    mewsNormalized
  );

  const uncertaintyScore = Math.round(uncertaintyIndex * 100);

  // Compounded risk multiplier: when physiological instability is present,
  // prolonged lack of observations multiplies clinical risk because of unmonitored deterioration.
  const couplingMultiplier = Number(
    (
      1.0 +
      (physiologicalScore > 0 ? uncertaintyIndex * (physiologicalScore / 100) * 0.8 : 0)
    ).toFixed(2)
  );

  const compoundedScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(physiologicalScore * couplingMultiplier + uncertaintyScore * 0.2)
    )
  );

  let decouplingExplanation: string;
  if (physiologicalScore === 0) {
    if (uncertaintyIndex < 0.25) {
      decouplingExplanation =
        'Normal baseline physiology with fresh verified telemetry. Minimal epistemic uncertainty.';
    } else {
      decouplingExplanation =
        `Normal baseline physiology on record. Attention is driven by epistemic uncertainty (index ${uncertaintyIndex.toFixed(2)}) due to elapsed observation time, NOT assumed clinical deterioration.`;
    }
  } else {
    if (uncertaintyIndex >= 0.50) {
      decouplingExplanation =
        `Compounded risk escalation: Documented physiological abnormality (score ${physiologicalScore}/100) coincides with elevated epistemic uncertainty (index ${uncertaintyIndex.toFixed(2)}). Blindspot amplifies risk (x${couplingMultiplier.toFixed(2)}).`;
    } else {
      decouplingExplanation =
        `Physiological abnormality (score ${physiologicalScore}/100) actively monitored with high-confidence fresh telemetry (uncertainty index ${uncertaintyIndex.toFixed(2)}).`;
    }
  }

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

  // Low confidence signal creates explicit epistemic alert
  if (confidence < 0.60) {
    reasons.push({
      code: 'SENSOR_CONFIDENCE_DEGRADED',
      description: `Low-confidence sensor telemetry (${Math.round(confidence * 100)}%): epistemic measurement uncertainty increased`,
      contributionWeight: 0.20,
      triggerValue: Math.round(confidence * 100),
      thresholdValue: 60,
      unit: 'PERCENT',
      urgency: 'WATCH',
    });
    if (!recommendedActions.includes('MANUAL_VITALS_RECHECK')) {
      recommendedActions.push('MANUAL_VITALS_RECHECK');
    }
  }

  const normalizedContribution = baseDecayScore;
  const weight = config.weights.informationDecay;
  const weightedContribution = Number((normalizedContribution * weight).toFixed(2));

  const explanation = !hasTrustedHistory
    ? `Information decay score ${normalizedContribution}/100: No verified bedside vitals on record (assumed ${timeString} stale)`
    : normalizedContribution < 25
      ? `Fresh clinical data: ${timeString} since verified bedside check (decay ${normalizedContribution}/100)`
      : `Information decay score ${normalizedContribution}/100: ${timeString} since verified bedside check`;

  const stateDescription =
    `Freshness: ${freshnessScore}/100 (${epistemicRiskCategory}), Uncertainty: ${uncertaintyIndex.toFixed(2)}, Observation Age: ${timeString}`;

  const informationFreshness: InformationFreshness = {
    lastTrustedTimestamp:
      lastTrustedTimestamp !== undefined ? Math.round(lastTrustedTimestamp) : undefined,
    lastManualTimestamp:
      options?.lastManualTimestamp !== undefined
        ? Math.round(options.lastManualTimestamp)
        : undefined,
    lastCameraTimestamp:
      options?.lastCameraTimestamp !== undefined
        ? Math.round(options.lastCameraTimestamp)
        : undefined,
    observationAgeMinutes: Math.round(elapsedMinutes),
    confidence,
    expectedMonitoringIntervalMinutes,
    isIntervalExceeded,
    freshnessScore,
    uncertaintyIndex,
    decayScore: baseDecayScore,
    epistemicRiskCategory,
    physiologicalRiskVsUncertainty: {
      physiologicalScore,
      uncertaintyScore,
      compoundedScore,
      couplingMultiplier,
      explanation: decouplingExplanation,
    },
    stateDescription,
  };

  // Validate schema
  const validation = validateInformationFreshness(informationFreshness);
  if (!validation.success) {
    console.warn('InformationFreshness validation warnings:', validation.error.format());
  }

  const provenance: Provenance = {
    derivedAt: evaluationTimestamp,
    algorithm: 'INFORMATION_DECAY_EVALUATOR',
    algorithmVersion: '2.0.0',
    sourceObservationIds:
      sourceObservationIds.length > 0 ? sourceObservationIds : ['OBS-DEFAULT'],
    confidence,
    parameters: {
      elapsedMinutes: Math.round(elapsedMinutes),
      halfLifeMinutes,
      hasTrustedHistory,
      normalizedContribution,
      freshnessScore,
      uncertaintyIndex,
      couplingMultiplier,
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
    informationFreshness,
    metadata: {
      elapsedMinutes: Math.round(elapsedMinutes),
      timeString,
      freshnessScore,
      uncertaintyIndex,
      informationFreshness,
    },
  };
}
