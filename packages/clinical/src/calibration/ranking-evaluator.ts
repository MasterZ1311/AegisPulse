/**
 * @aegispulse/clinical - APS Ranking Evaluator
 * Evaluates multi-patient ward triage ranking against clinical ground truth.
 * Computes Kendall's Tau, Spearman's Rho, pairwise inversions, and tier consistency.
 */

import type { AttentionPriorityConfig } from '../attentionPriority/config';
import type { AttentionPriorityResult } from '../attentionPriority/types';
import { rankWardPatients } from '../attentionPriority/attention-engine';
import type { CalibrationScenario } from './scenario-generator';

export interface ScenarioRankingComparison {
  patientId: string;
  name: string;
  archetype: string;
  expectedRankMin: number;
  expectedRankMax: number;
  expectedCategory: string;
  actualRank: number;
  actualScore: number;
  actualCategory: string;
  isRankConcordant: boolean;
  isCategoryConcordant: boolean;
  dominantReason: string;
}

export interface PairwiseInversion {
  higherPriorityPatientId: string;
  lowerPriorityPatientId: string;
  higherPriorityExpectedRank: number;
  lowerPriorityExpectedRank: number;
  actualHigherRank: number;
  actualLowerRank: number;
  clinicalSeverity: 'CRITICAL_INVERSION' | 'TIER_MISMATCH' | 'INTRA_TIER_SWAP';
  description: string;
}

export interface RankingEvaluationReport {
  comparisons: ScenarioRankingComparison[];
  kendallTau: number; // [-1.0, 1.0]
  spearmanRho: number; // [-1.0, 1.0]
  concordantPairCount: number;
  discordantPairCount: number;
  totalPairCount: number;
  pairwiseAccuracyPercentage: number;
  inversions: PairwiseInversion[];
  hasCriticalInversion: boolean;
  clinicalVerdict: 'PERFECT_CONCORDANCE' | 'ACCEPTABLE_CLINICAL_CONCORDANCE' | 'CLINICALLY_INVERTED';
}

/**
 * Evaluates ranking concordance between expected clinical ground truth and actual APS engine output
 */
export function evaluateRankingConcordance(
  scenarios: CalibrationScenario[],
  configOverride?: Partial<AttentionPriorityConfig>
): RankingEvaluationReport {
  const patientStates = scenarios.map((s) => s.patientState);
  const actualResults: AttentionPriorityResult[] = rankWardPatients(patientStates, configOverride);

  const resultMap = new Map<string, AttentionPriorityResult>();
  for (const res of actualResults) {
    resultMap.set(res.patientId, res);
  }

  // 1. Build Individual Comparisons
  const comparisons: ScenarioRankingComparison[] = scenarios.map((scenario) => {
    const actual = resultMap.get(scenario.metadata.id)!;
    const isRankConcordant =
      actual.wardRank >= scenario.metadata.expectedRankMin &&
      actual.wardRank <= scenario.metadata.expectedRankMax;
    const isCategoryConcordant = actual.category === scenario.metadata.expectedCategory;
    const dominantReason = actual.reasons.length > 0 ? actual.reasons[0].description : 'Stable Baseline';

    return {
      patientId: scenario.metadata.id,
      name: scenario.metadata.name,
      archetype: scenario.metadata.archetype,
      expectedRankMin: scenario.metadata.expectedRankMin,
      expectedRankMax: scenario.metadata.expectedRankMax,
      expectedCategory: scenario.metadata.expectedCategory,
      actualRank: actual.wardRank,
      actualScore: actual.score,
      actualCategory: actual.category,
      isRankConcordant,
      isCategoryConcordant,
      dominantReason,
    };
  });

  // Sort comparisons by actual rank ascending (Rank 1 first)
  comparisons.sort((a, b) => a.actualRank - b.actualRank);

  // 2. Compute Pairwise Concordance & Inversions
  let concordantPairs = 0;
  let discordantPairs = 0;
  let ties = 0;
  const inversions: PairwiseInversion[] = [];

  const n = scenarios.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const p1 = scenarios[i];
      const p2 = scenarios[j];

      const r1 = resultMap.get(p1.metadata.id)!;
      const r2 = resultMap.get(p2.metadata.id)!;

      // Expected order: lower number means higher priority
      // If expected ranges overlap, it's considered an acceptable intra-tier tie/indifference
      const expectedDiff = p1.metadata.expectedRankMin - p2.metadata.expectedRankMin;
      const actualDiff = r1.wardRank - r2.wardRank;

      if (expectedDiff === 0) {
        // Tied in expectation
        ties++;
      } else if ((expectedDiff < 0 && actualDiff < 0) || (expectedDiff > 0 && actualDiff > 0)) {
        concordantPairs++;
      } else {
        discordantPairs++;

        const higherExpected = expectedDiff < 0 ? p1 : p2;
        const lowerExpected = expectedDiff < 0 ? p2 : p1;
        const actualHigher = expectedDiff < 0 ? r1 : r2;
        const actualLower = expectedDiff < 0 ? r2 : r1;

        // Determine inversion severity
        let severity: 'CRITICAL_INVERSION' | 'TIER_MISMATCH' | 'INTRA_TIER_SWAP' = 'TIER_MISMATCH';
        const expectedGap = Math.abs(higherExpected.metadata.expectedRankMin - lowerExpected.metadata.expectedRankMin);

        if (expectedGap >= 3) {
          severity = 'CRITICAL_INVERSION'; // e.g., Stable outranked Deterioration
        } else if (expectedGap === 1) {
          severity = 'INTRA_TIER_SWAP';
        }

        inversions.push({
          higherPriorityPatientId: higherExpected.metadata.id,
          lowerPriorityPatientId: lowerExpected.metadata.id,
          higherPriorityExpectedRank: higherExpected.metadata.expectedRankMin,
          lowerPriorityExpectedRank: lowerExpected.metadata.expectedRankMin,
          actualHigherRank: actualHigher.wardRank,
          actualLowerRank: actualLower.wardRank,
          clinicalSeverity: severity,
          description: `${higherExpected.metadata.name} (Expected #${higherExpected.metadata.expectedRankMin}) was inverted behind ${lowerExpected.metadata.name} (Actual #${actualLower.wardRank} vs #${actualHigher.wardRank})`,
        });
      }
    }
  }

  const totalPairs = concordantPairs + discordantPairs;
  const pairwiseAccuracyPercentage =
    totalPairs > 0 ? Number(((concordantPairs / totalPairs) * 100).toFixed(1)) : 100;

  // 3. Statistical Rank Correlations
  // Kendall's Tau: (C - D) / sqrt((C + D + Tx) * (C + D + Ty))
  const denom = Math.sqrt((concordantPairs + discordantPairs + ties) * (concordantPairs + discordantPairs));
  const kendallTau = denom > 0 ? Number(((concordantPairs - discordantPairs) / denom).toFixed(3)) : 1.0;

  // Spearman's Rho
  let dSquaredSum = 0;
  for (const c of comparisons) {
    const expectedMid = (c.expectedRankMin + c.expectedRankMax) / 2;
    const diff = c.actualRank - expectedMid;
    dSquaredSum += diff * diff;
  }
  const spearmanRho =
    n > 1
      ? Number((1 - (6 * dSquaredSum) / (n * (n * n - 1))).toFixed(3))
      : 1.0;

  const hasCriticalInversion = inversions.some((inv) => inv.clinicalSeverity === 'CRITICAL_INVERSION');

  let clinicalVerdict: 'PERFECT_CONCORDANCE' | 'ACCEPTABLE_CLINICAL_CONCORDANCE' | 'CLINICALLY_INVERTED';
  if (discordantPairs === 0 && !hasCriticalInversion) {
    clinicalVerdict = 'PERFECT_CONCORDANCE';
  } else if (!hasCriticalInversion && kendallTau >= 0.70) {
    clinicalVerdict = 'ACCEPTABLE_CLINICAL_CONCORDANCE';
  } else {
    clinicalVerdict = 'CLINICALLY_INVERTED';
  }

  return {
    comparisons,
    kendallTau,
    spearmanRho,
    concordantPairCount: concordantPairs,
    discordantPairCount: discordantPairs,
    totalPairCount: totalPairs,
    pairwiseAccuracyPercentage,
    inversions,
    hasCriticalInversion,
    clinicalVerdict,
  };
}
