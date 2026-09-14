/**
 * @aegispulse/clinical - APS Sensitivity & Weight Perturbation Analyzer
 * Analyzes how adjustments to each weight in AttentionPriorityWeights affect triage ranking.
 * Evaluates ranking stability, detects tipping points, and assesses interpretability.
 */

import type { AttentionPriorityConfig, AttentionPriorityWeights } from '../attentionPriority/config';
import { DEFAULT_ATTENTION_CONFIG } from '../attentionPriority/config';
import type { CalibrationScenario } from './scenario-generator';
import { evaluateRankingConcordance } from './ranking-evaluator';

export interface WeightPerturbationResult {
  weightKey: keyof AttentionPriorityWeights;
  baseWeight: number;
  perturbedWeight: number;
  perturbationFactor: number; // e.g., 0.75 for -25%, 1.25 for +25%
  kendallTau: number;
  pairwiseAccuracy: number;
  rankChanges: { patientId: string; baseRank: number; perturbedRank: number; delta: number }[];
  inversionCount: number;
  hasCriticalInversion: boolean;
}

export interface WeightSensitivitySummary {
  weightKey: keyof AttentionPriorityWeights;
  baseWeight: number;
  meanRankDisplacement: number;
  maxRankDisplacement: number;
  inversionInducingPerturbations: number;
  stabilityScore: number; // 0 to 100
  clinicalImpactSummary: string;
}

export interface TippingPoint {
  weightKey: keyof AttentionPriorityWeights;
  direction: 'INCREASE' | 'DECREASE';
  criticalFactor: number;
  invertedPair: string;
  clinicalSignificance: string;
}

export interface SensitivityAnalysisReport {
  baselineKendallTau: number;
  baselinePairwiseAccuracy: number;
  rankingStabilityIndex: number; // Percentage of perturbations preserving clinical order [0, 100]
  weightSummaries: WeightSensitivitySummary[];
  tippingPoints: TippingPoint[];
  perturbationResults: WeightPerturbationResult[];
  overallVerdict: 'HIGHLY_STABLE' | 'MODERATELY_STABLE' | 'HYPER_SENSITIVE';
}

export interface SensitivityOptions {
  perturbationFactors?: number[]; // Default: [0.5, 0.75, 0.9, 1.1, 1.25, 1.5]
  customBaseConfig?: AttentionPriorityConfig;
}

/**
 * Executes systematic weight perturbation and sensitivity analysis across all 9 weights
 */
export function analyzeWeightSensitivity(
  scenarios: CalibrationScenario[],
  options: SensitivityOptions = {}
): SensitivityAnalysisReport {
  const baseConfig = options.customBaseConfig ?? DEFAULT_ATTENTION_CONFIG;
  const factors = options.perturbationFactors ?? [0.5, 0.75, 0.9, 1.1, 1.25, 1.5];

  // 1. Evaluate baseline ranking
  const baselineEval = evaluateRankingConcordance(scenarios, baseConfig);
  const baseRankMap = new Map<string, number>();
  for (const comp of baselineEval.comparisons) {
    baseRankMap.set(comp.patientId, comp.actualRank);
  }

  const weightKeys: (keyof AttentionPriorityWeights)[] = [
    'abnormality',
    'baselineDeviation',
    'velocity',
    'informationDecay',
    'signalConfidence',
    'mews',
    'qsofa',
    'biomarkers',
    'missingInfo',
  ];

  const perturbationResults: WeightPerturbationResult[] = [];
  const tippingPoints: TippingPoint[] = [];

  let totalPerturbations = 0;
  let orderPreservingPerturbations = 0;

  // 2. Perturb each weight independently
  for (const key of weightKeys) {
    const baseVal = baseConfig.weights[key];

    for (const factor of factors) {
      totalPerturbations++;
      const perturbedVal = Number((baseVal * factor).toFixed(3));

      const perturbedWeights: AttentionPriorityWeights = {
        ...baseConfig.weights,
        [key]: perturbedVal,
      };

      const perturbedConfig: Partial<AttentionPriorityConfig> = {
        weights: perturbedWeights,
      };

      const evalReport = evaluateRankingConcordance(scenarios, perturbedConfig);

      const rankChanges = evalReport.comparisons.map((c) => {
        const baseRank = baseRankMap.get(c.patientId) ?? c.actualRank;
        return {
          patientId: c.patientId,
          baseRank,
          perturbedRank: c.actualRank,
          delta: c.actualRank - baseRank,
        };
      });

      if (!evalReport.hasCriticalInversion && evalReport.pairwiseAccuracyPercentage >= 90) {
        orderPreservingPerturbations++;
      }

      // Detect tipping points (flips relative to baseline)
      if (evalReport.inversions.length > baselineEval.inversions.length) {
        const newInversions = evalReport.inversions.filter(
          (inv) =>
            !baselineEval.inversions.some(
              (bi) =>
                bi.higherPriorityPatientId === inv.higherPriorityPatientId &&
                bi.lowerPriorityPatientId === inv.lowerPriorityPatientId
            )
        );

        for (const ni of newInversions) {
          tippingPoints.push({
            weightKey: key,
            direction: factor > 1.0 ? 'INCREASE' : 'DECREASE',
            criticalFactor: factor,
            invertedPair: `${ni.higherPriorityPatientId} inverted by ${ni.lowerPriorityPatientId}`,
            clinicalSignificance: ni.description,
          });
        }
      }

      perturbationResults.push({
        weightKey: key,
        baseWeight: baseVal,
        perturbedWeight: perturbedVal,
        perturbationFactor: factor,
        kendallTau: evalReport.kendallTau,
        pairwiseAccuracy: evalReport.pairwiseAccuracyPercentage,
        rankChanges,
        inversionCount: evalReport.inversions.length,
        hasCriticalInversion: evalReport.hasCriticalInversion,
      });
    }
  }

  // 3. Compute Summary per Weight
  const weightSummaries: WeightSensitivitySummary[] = weightKeys.map((key) => {
    const runsForWeight = perturbationResults.filter((p) => p.weightKey === key);
    let totalDisplacement = 0;
    let maxDisplacement = 0;
    let inversionInducingCount = 0;

    for (const run of runsForWeight) {
      const maxDelta = Math.max(...run.rankChanges.map((rc) => Math.abs(rc.delta)));
      const sumDelta = run.rankChanges.reduce((sum, rc) => sum + Math.abs(rc.delta), 0);

      totalDisplacement += sumDelta / run.rankChanges.length;
      if (maxDelta > maxDisplacement) maxDisplacement = maxDelta;
      if (run.inversionCount > baselineEval.inversions.length) {
        inversionInducingCount++;
      }
    }

    const meanDisplacement = Number((totalDisplacement / runsForWeight.length).toFixed(2));
    const stabilityScore = Math.max(
      0,
      Math.min(
        100,
        Math.round(100 - meanDisplacement * 25 - inversionInducingCount * 10)
      )
    );

    let impactSummary: string;
    if (meanDisplacement === 0) {
      impactSummary = 'Zero rank displacement under ±50% perturbation. Extremely robust priority boundary.';
    } else if (meanDisplacement <= 0.5 && inversionInducingCount === 0) {
      impactSummary = 'Minimal displacement without priority inversions. Well-calibrated clinical cushion.';
    } else {
      impactSummary = `Moderate sensitivity: triggered rank flips under extreme perturbations (max displacement: ${maxDisplacement}).`;
    }

    return {
      weightKey: key,
      baseWeight: baseConfig.weights[key],
      meanRankDisplacement: meanDisplacement,
      maxRankDisplacement: maxDisplacement,
      inversionInducingPerturbations: inversionInducingCount,
      stabilityScore,
      clinicalImpactSummary: impactSummary,
    };
  });

  // Ranking Stability Index
  const rankingStabilityIndex =
    totalPerturbations > 0
      ? Number(((orderPreservingPerturbations / totalPerturbations) * 100).toFixed(1))
      : 100;

  let overallVerdict: 'HIGHLY_STABLE' | 'MODERATELY_STABLE' | 'HYPER_SENSITIVE';
  if (rankingStabilityIndex >= 90) {
    overallVerdict = 'HIGHLY_STABLE';
  } else if (rankingStabilityIndex >= 70) {
    overallVerdict = 'MODERATELY_STABLE';
  } else {
    overallVerdict = 'HYPER_SENSITIVE';
  }

  return {
    baselineKendallTau: baselineEval.kendallTau,
    baselinePairwiseAccuracy: baselineEval.pairwiseAccuracyPercentage,
    rankingStabilityIndex,
    weightSummaries,
    tippingPoints,
    perturbationResults,
    overallVerdict,
  };
}
