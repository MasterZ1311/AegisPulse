import type {
  AttentionPriorityCategory,
  AttentionReason,
  Provenance,
} from '@aegispulse/types';
import {
  type AttentionPriorityConfig,
  mergeAttentionConfig,
} from './config';
import type {
  AttentionPriorityResult,
  ComponentScore,
  PatientStateInput,
  RankInputs,
} from './types';
import { extractVitalsFromObservations } from './vital-extractor';
import { evaluateAbnormality } from './components/abnormality';
import { evaluateBaselineDeviation } from './components/baseline';
import { evaluateVelocityAndAcceleration } from './components/velocity';
import { evaluatePersistence } from './components/persistence';
import { evaluateInformationDecay } from './components/decay';
import { evaluateSignalConfidence } from './components/confidence';
import { evaluateBiomarkersAndContext } from './components/labs';
import { evaluateMissingInformation } from './components/missing-info';
import { calculateMEWS } from './mews';
import { calculateQSOFA } from './qsofa';
import { buildRecommendations } from './recommendations';

/**
 * Central AegisPulse Attention Priority Engine
 * 100% Deterministic, auditable, non-LLM clinical intelligence engine.
 */
export class AttentionPriorityEngine {
  private readonly config: AttentionPriorityConfig;

  constructor(customConfig?: Partial<AttentionPriorityConfig>) {
    this.config = mergeAttentionConfig(customConfig);
  }

  /**
   * Evaluates a single patient state and produces a comprehensive AttentionPriorityResult.
   */
  public evaluate(
    patientState: PatientStateInput,
    overrideConfig?: Partial<AttentionPriorityConfig>
  ): AttentionPriorityResult {
    const config = overrideConfig ? mergeAttentionConfig(overrideConfig) : this.config;
    const now =
      typeof patientState.currentTimestamp === 'number' &&
      Number.isFinite(patientState.currentTimestamp)
        ? patientState.currentTimestamp
        : Date.now();

    // 1. Extract vitals and time series from observations and sensorReadings
    const {
      latest,
      history,
      lastTrustedTimestamp,
      lastManualTimestamp,
      lastCameraTimestamp,
      overallSignalConfidence,
      latestConfidence,
      observationIds,
    } = extractVitalsFromObservations(
      patientState.observations,
      now,
      patientState.sensorReadings
    );

    // If caller explicitly specified timestamps, use them
    const effectiveLastTrusted =
      typeof patientState.lastTrustedObservationTimestamp === 'number' &&
      Number.isFinite(patientState.lastTrustedObservationTimestamp)
        ? patientState.lastTrustedObservationTimestamp
        : lastTrustedTimestamp;
    const effectiveLastManual =
      typeof patientState.lastManualObservationTimestamp === 'number' &&
      Number.isFinite(patientState.lastManualObservationTimestamp)
        ? patientState.lastManualObservationTimestamp
        : lastManualTimestamp;
    const effectiveLastCamera =
      typeof patientState.lastCameraObservationTimestamp === 'number' &&
      Number.isFinite(patientState.lastCameraObservationTimestamp)
        ? patientState.lastCameraObservationTimestamp
        : lastCameraTimestamp;
    const expectedInterval =
      patientState.expectedMonitoringIntervalMinutes ??
      config.decayThresholds.criticalThresholdMinutes;

    const effectiveSignalQuality =
      patientState.latestSignalQuality ??
      (patientState.sensorReadings && patientState.sensorReadings.length > 0
        ? patientState.sensorReadings[patientState.sensorReadings.length - 1].signalQuality
        : undefined);

    // 2. Evaluate Base Components
    // 2.1 Physiological Abnormality
    const abnormalityScore = evaluateAbnormality(latest, config, now, observationIds);

    // 2.2 Baseline Deviation
    const baselineScore = evaluateBaselineDeviation(
      latest,
      patientState.baseline,
      config,
      now,
      observationIds
    );

    // 2.3 Velocity & Acceleration
    const rawVelocityScore = evaluateVelocityAndAcceleration(
      history,
      config,
      now,
      observationIds
    );

    // 2.4 Persistence & Transient Spike Filter
    const persistenceResult = evaluatePersistence(
      latest,
      history,
      effectiveSignalQuality,
      config,
      now,
      observationIds
    );

    // 2.5 MEWS Component
    const mewsResult = calculateMEWS({
      heartRate: latest.HEART_RATE?.value,
      respiratoryRate: latest.RESPIRATORY_RATE?.value,
      systolicBP: latest.SYSTOLIC_BP?.value,
      temperature: latest.BODY_TEMPERATURE?.value,
      avpu: patientState.avpu ?? 'A',
    });

    const mewsComponentScore: ComponentScore = {
      componentName: 'mews',
      normalizedContribution: mewsResult.normalizedScore,
      rawScore: mewsResult.score,
      weight: config.weights.mews,
      weightedContribution: Number(
        (mewsResult.normalizedScore * config.weights.mews).toFixed(2)
      ),
      explanation: mewsResult.explanation,
      provenance: {
        derivedAt: now,
        algorithm: 'SUBBE_MEWS_EVALUATOR',
        algorithmVersion: '1.0.0',
        sourceObservationIds: observationIds,
        confidence: 1.0,
        parameters: {
          mewsRaw: mewsResult.score,
          mewsNormalized: mewsResult.normalizedScore,
        },
      },
      reasons:
        mewsResult.score >= 4
          ? [
              {
                code: 'MEWS_ESCALATION',
                description: `MEWS escalated to ${mewsResult.score}/14 (${mewsResult.triageLevel.toUpperCase()})`,
                contributionWeight: 0.35,
                triggerValue: mewsResult.score,
                thresholdValue: 4,
                unit: 'SCORE',
                urgency: mewsResult.score >= 5 ? 'CRITICAL_REVIEW' : 'EVALUATE',
              },
            ]
          : [],
      recommendedActions: mewsResult.score >= 5 ? ['SBAR_PHYSICIAN_CONSULT'] : [],
    };

    // 2.6 Information Decay & Freshness
    const decayScore = evaluateInformationDecay(
      effectiveLastTrusted,
      now,
      config,
      observationIds,
      {
        lastManualTimestamp: effectiveLastManual,
        lastCameraTimestamp: effectiveLastCamera,
        confidence: latestConfidence,
        expectedMonitoringIntervalMinutes: expectedInterval,
        physiologicalAbnormalityScore: abnormalityScore.normalizedContribution,
        rawVelocityScore: rawVelocityScore.normalizedContribution,
        mewsScore: mewsResult.score,
      }
    );

    // 2.7 Signal Confidence
    const confidenceResult = evaluateSignalConfidence(
      effectiveSignalQuality,
      overallSignalConfidence,
      config,
      now,
      observationIds
    );

    // 2.8 qSOFA Component
    const qsofaResult = calculateQSOFA({
      respiratoryRate: latest.RESPIRATORY_RATE?.value,
      systolicBP: latest.SYSTOLIC_BP?.value,
      avpu: patientState.avpu ?? 'A',
    });

    const qsofaComponentScore: ComponentScore = {
      componentName: 'qsofa',
      normalizedContribution: qsofaResult.normalizedScore,
      rawScore: qsofaResult.score,
      weight: config.weights.qsofa,
      weightedContribution: Number(
        (qsofaResult.normalizedScore * config.weights.qsofa).toFixed(2)
      ),
      explanation: qsofaResult.explanation,
      provenance: {
        derivedAt: now,
        algorithm: 'SEPSIS3_QSOFA_EVALUATOR',
        algorithmVersion: '1.0.0',
        sourceObservationIds: observationIds,
        confidence: 1.0,
        parameters: {
          qsofaRaw: qsofaResult.score,
          qsofaNormalized: qsofaResult.normalizedScore,
          isPositive: qsofaResult.isPositive,
        },
      },
      reasons: qsofaResult.isPositive
        ? [
            {
              code: 'QSOFA_ESCALATION',
              description: `qSOFA positive (${qsofaResult.score}/3): high risk of sepsis mortality`,
              contributionWeight: 0.40,
              triggerValue: qsofaResult.score,
              thresholdValue: 2,
              unit: 'SCORE',
              urgency: 'CRITICAL_REVIEW',
            },
          ]
        : [],
      recommendedActions: qsofaResult.isPositive ? ['RAPID_RESPONSE_TRIGGER'] : [],
    };

    // 2.9 Biomarkers & Clinical Context
    const biomarkersScore = evaluateBiomarkersAndContext(
      patientState.labs,
      patientState.clinicalContext,
      config,
      now,
      observationIds
    );

    // 2.10 Missing Information
    const missingInfoScore = evaluateMissingInformation(latest, config, now, observationIds);

    // 3. Modulate Velocity using Persistence and Signal Confidence
    // If spike is transient, dampen velocity. If sensor is unreliable, discount optical velocity noise.
    const effectiveVelocityNormalized = Math.round(
      rawVelocityScore.normalizedContribution *
        persistenceResult.persistenceFactor *
        confidenceResult.confidenceModulationFactor
    );

    const modulatedVelocityScore: ComponentScore = {
      ...rawVelocityScore,
      normalizedContribution: effectiveVelocityNormalized,
      weightedContribution: Number(
        (effectiveVelocityNormalized * config.weights.velocity).toFixed(2)
      ),
      explanation:
        persistenceResult.isTransientSpike
          ? `${rawVelocityScore.explanation} (dampened by transient spike filter x${persistenceResult.persistenceFactor.toFixed(2)})`
          : confidenceResult.confidenceModulationFactor < 1.0
            ? `${rawVelocityScore.explanation} (discounted by sensor confidence x${confidenceResult.confidenceModulationFactor.toFixed(2)})`
            : rawVelocityScore.explanation,
    };

    // Rank Inputs object
    const rankInputs: RankInputs = {
      abnormality: abnormalityScore,
      baselineDeviation: baselineScore,
      velocity: modulatedVelocityScore,
      persistence: persistenceResult.componentScore,
      informationDecay: decayScore,
      signalConfidence: confidenceResult.componentScore,
      mews: mewsComponentScore,
      qsofa: qsofaComponentScore,
      biomarkers: biomarkersScore,
      missingInfo: missingInfoScore,
    };

    // 4. Calculate Composite Raw Score
    let compositeRaw =
      abnormalityScore.weightedContribution +
      baselineScore.weightedContribution +
      modulatedVelocityScore.weightedContribution +
      decayScore.weightedContribution +
      confidenceResult.componentScore.weightedContribution +
      mewsComponentScore.weightedContribution +
      qsofaComponentScore.weightedContribution +
      biomarkersScore.weightedContribution +
      missingInfoScore.weightedContribution;

    // Epistemic Uncertainty & Information Freshness Interactions:
    // Interaction 1: NORMAL PHYSIOLOGY + 4 HOURS WITHOUT TRUSTED OBSERVATION
    // → moderate attention contribution (category WATCH, ~32 score).
    // Epistemic uncertainty is high, so patient needs bedside vitals recheck, but NOT assuming deterioration.
    const isNormalPhysiology =
      abnormalityScore.normalizedContribution === 0 &&
      rawVelocityScore.normalizedContribution === 0 &&
      mewsResult.score <= 1;

    const isObservationOverdue =
      decayScore.informationFreshness.isIntervalExceeded ||
      decayScore.informationFreshness.observationAgeMinutes >=
        config.decayThresholds.criticalThresholdMinutes;

    if (isObservationOverdue) {
      if (isNormalPhysiology) {
        compositeRaw = Math.max(compositeRaw, config.categoryThresholds.lowMax + 3); // 32 = WATCH
      } else {
        // Interaction 2: ABNORMAL TREND + 4 HOURS WITHOUT TRUSTED OBSERVATION
        // → significantly higher attention contribution (category CRITICAL_REVIEW, >= 75).
        // Compounded risk escalation: unmonitored abnormal trajectory is an acute safety hazard.
        const physiologicalRisk = Math.max(
          abnormalityScore.normalizedContribution,
          rawVelocityScore.normalizedContribution,
          mewsComponentScore.normalizedContribution
        );
        if (physiologicalRisk >= 15) {
          const compoundingBoost = Math.round(
            decayScore.informationFreshness.uncertaintyIndex * physiologicalRisk * 0.8
          );
          compositeRaw = Math.max(compositeRaw, Math.max(76, compositeRaw + compoundingBoost));
        } else {
          // Mild physiological deviation + overdue: ensure at least WATCH status
          compositeRaw = Math.max(compositeRaw, config.categoryThresholds.lowMax + 3);
        }
      }
    }

    // 5. Apply Clinical Override Floors
    let scoreWithFloors = compositeRaw;
    const { overrideFloors } = config;

    // Sepsis qSOFA positive floor
    if (qsofaResult.isPositive) {
      scoreWithFloors = Math.max(scoreWithFloors, overrideFloors.qsofaSevereMinScore);
    }

    // MEWS >= 5 critical floor
    if (mewsResult.isSevere) {
      scoreWithFloors = Math.max(scoreWithFloors, overrideFloors.mewsSevereMinScore);
    }

    // Critical Shock Index floor (SI >= 1.10)
    if (latest.SHOCK_INDEX && latest.SHOCK_INDEX.value >= config.vitalThresholds.shockIndex.severeShock) {
      scoreWithFloors = Math.max(scoreWithFloors, overrideFloors.criticalShockIndexMinScore);
    }

    // Critical Lactate floor (Lactate >= 4.0)
    const criticalLactateLab = patientState.labs?.find(
      (l) => l.testCode === 'LACTATE' && l.value >= config.labThresholds.lactateCritical
    );
    if (criticalLactateLab) {
      scoreWithFloors = Math.max(scoreWithFloors, overrideFloors.criticalLactateMinScore);
    } else {
      // Elevated Lactate floor (Lactate >= 2.0) - occult tissue hypoperfusion screening
      const elevatedLactateLab = patientState.labs?.find(
        (l) => l.testCode === 'LACTATE' && l.value >= config.labThresholds.lactateElevated
      );
      if (elevatedLactateLab) {
        scoreWithFloors = Math.max(
          scoreWithFloors,
          overrideFloors.elevatedLactateMinScore ?? 35
        );
      }
    }

    // 6. Strict Bounding: 0 to 100
    const roundedScore = Math.round(scoreWithFloors);
    const finalScore = Number.isFinite(roundedScore)
      ? Math.max(0, Math.min(100, roundedScore))
      : 0;

    // 7. Urgency Category Assignment
    const { categoryThresholds } = config;
    let category: AttentionPriorityCategory;
    if (finalScore >= categoryThresholds.criticalMin) {
      category = 'CRITICAL_REVIEW';
    } else if (finalScore > categoryThresholds.watchMax) {
      category = 'EVALUATE';
    } else if (finalScore > categoryThresholds.lowMax) {
      category = 'WATCH';
    } else {
      category = 'LOW';
    }

    // 8. Collect and Sort Reasons
    const allReasons: AttentionReason[] = [
      ...abnormalityScore.reasons,
      ...baselineScore.reasons,
      ...(persistenceResult.isTransientSpike ? [] : rawVelocityScore.reasons),
      ...persistenceResult.componentScore.reasons,
      ...decayScore.reasons,
      ...confidenceResult.componentScore.reasons,
      ...mewsComponentScore.reasons,
      ...qsofaComponentScore.reasons,
      ...biomarkersScore.reasons,
      ...missingInfoScore.reasons,
    ];

    // If completely stable with no reasons triggered, provide baseline stability reason
    if (allReasons.length === 0) {
      allReasons.push({
        code: 'PHYSIOLOGICAL_STABILITY',
        description: 'All monitored physiological parameters within safe biological boundaries',
        contributionWeight: 0.0,
        triggerValue: finalScore,
        thresholdValue: categoryThresholds.lowMax,
        unit: 'APS',
        urgency: 'LOW',
      });
    }

    // Sort reasons by contribution weight descending
    allReasons.sort((a, b) => b.contributionWeight - a.contributionWeight);

    // 9. Collect and Prioritize Recommended Actions
    const actionCandidates = [
      ...abnormalityScore.recommendedActions,
      ...baselineScore.recommendedActions,
      ...rawVelocityScore.recommendedActions,
      ...decayScore.recommendedActions,
      ...confidenceResult.componentScore.recommendedActions,
      ...mewsComponentScore.recommendedActions,
      ...qsofaComponentScore.recommendedActions,
      ...biomarkersScore.recommendedActions,
      ...missingInfoScore.recommendedActions,
    ];

    const { recommendedActions, primaryRecommendedAction } = buildRecommendations({
      finalScore,
      category,
      isQSOFAPositive: qsofaResult.isPositive,
      isMEWSSevere: mewsResult.isSevere,
      hasOccultShock:
        (latest.SHOCK_INDEX?.value ?? 0) >= config.vitalThresholds.shockIndex.severeShock,
      hasDegradedSignal: confidenceResult.componentScore.normalizedContribution >= 45,
      isCriticallyStale: decayScore.normalizedContribution >= 60,
      actionCandidates,
    });

    // 10. Compute Information Age
    const rawAge =
      effectiveLastTrusted !== undefined && Number.isFinite(effectiveLastTrusted)
        ? (now - effectiveLastTrusted) / 60000
        : (decayScore.metadata?.elapsedMinutes as number) ?? 240;
    const informationAgeMinutes = Number.isFinite(rawAge) ? Math.max(0, rawAge) : 240;

    // 11. Master Provenance
    const provenance: Provenance = {
      derivedAt: now,
      algorithm: 'AEGIS_PULSE_ATTENTION_PRIORITY_ENGINE',
      algorithmVersion: '1.0.0',
      sourceObservationIds: observationIds,
      confidence: Number((overallSignalConfidence / 100).toFixed(2)),
      parameters: {
        compositeRaw: Number(compositeRaw.toFixed(2)),
        finalScore,
        category,
        overallSignalConfidence,
      },
    };

    return {
      id: `APS-${patientState.patientId}-${now}`,
      patientId: patientState.patientId,
      bedNumber: patientState.bedNumber,
      score: finalScore,
      apsScore: finalScore,
      category,
      rankInputs,
      reasons: allReasons,
      recommendedActions,
      recommendedAction: primaryRecommendedAction,
      confidence: overallSignalConfidence,
      signalConfidence: overallSignalConfidence,
      timestamp: now,
      calculatedAt: now,
      wardRank: 1, // Default 1, updated when ranking full ward
      velocityScore: modulatedVelocityScore.normalizedContribution,
      decayScore: decayScore.normalizedContribution,
      mewsComponent: mewsComponentScore.normalizedContribution,
      biomarkerComponent: biomarkersScore.normalizedContribution,
      informationAgeMinutes: Math.round(informationAgeMinutes),
      freshnessScore: decayScore.informationFreshness.freshnessScore,
      uncertaintyIndex: decayScore.informationFreshness.uncertaintyIndex,
      lastTrustedTimestamp: effectiveLastTrusted,
      lastManualTimestamp: effectiveLastManual,
      lastCameraTimestamp: effectiveLastCamera,
      expectedMonitoringIntervalMinutes: expectedInterval,
      informationFreshness: decayScore.informationFreshness,
      provenance,
    };
  }

  /**
   * Evaluates all patients across a ward and assigns sequential ward rankings.
   */
  public rankWard(
    patientStates: PatientStateInput[],
    overrideConfig?: Partial<AttentionPriorityConfig>
  ): AttentionPriorityResult[] {
    const results = patientStates.map((state) => this.evaluate(state, overrideConfig));

    // Sort descending by score; break ties with velocityScore, then decayScore
    results.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      if (b.velocityScore !== a.velocityScore) {
        return b.velocityScore - a.velocityScore;
      }
      return b.decayScore - a.decayScore;
    });

    // Assign 1-indexed wardRank
    return results.map((res, index) => ({
      ...res,
      wardRank: index + 1,
    }));
  }
}

/**
 * Convenient singleton / functional evaluation helper
 */
export const defaultAttentionEngine = new AttentionPriorityEngine();

export function evaluateAttentionPriority(
  patientState: PatientStateInput,
  customConfig?: Partial<AttentionPriorityConfig>
): AttentionPriorityResult {
  return defaultAttentionEngine.evaluate(patientState, customConfig);
}

export function rankWardPatients(
  patientStates: PatientStateInput[],
  customConfig?: Partial<AttentionPriorityConfig>
): AttentionPriorityResult[] {
  return defaultAttentionEngine.rankWard(patientStates, customConfig);
}
