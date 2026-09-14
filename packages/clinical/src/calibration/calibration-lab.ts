/**
 * @aegispulse/clinical - APS Calibration Laboratory
 * Central coordinator for empirical validation of the Attention Priority Score.
 * Produces structured audit reports, ranking concordance tables, and sensitivity matrices.
 */

import type { AttentionPriorityConfig } from '../attentionPriority/config';
import { DEFAULT_ATTENTION_CONFIG } from '../attentionPriority/config';
import { rankWardPatients } from '../attentionPriority/attention-engine';
import { generateBenchmarkScenarios, type CalibrationScenario } from './scenario-generator';
import { evaluateRankingConcordance, type RankingEvaluationReport } from './ranking-evaluator';
import { decomposeApsScore, type ScoreDecompositionReport } from './score-decomposer';
import { analyzeWeightSensitivity, type SensitivityAnalysisReport } from './sensitivity-analyzer';

export interface ApsCalibrationReport {
  timestamp: number;
  config: AttentionPriorityConfig;
  scenarioCount: number;
  rankingEvaluation: RankingEvaluationReport;
  decompositions: ScoreDecompositionReport[];
  sensitivityAnalysis: SensitivityAnalysisReport;
  summaryVerdict: {
    passed: boolean;
    concordanceVerdict: string;
    stabilityVerdict: string;
    keyTakeaway: string;
  };
}

export interface CalibrationLabOptions {
  baseTimestamp?: number;
  configOverride?: Partial<AttentionPriorityConfig>;
  perturbationFactors?: number[];
}

/**
 * Runs the complete APS Calibration Laboratory suite
 */
export function runCalibrationLab(options: CalibrationLabOptions = {}): ApsCalibrationReport {
  const baseTimestamp = options.baseTimestamp ?? 1700000000000;
  const config = options.configOverride
    ? { ...DEFAULT_ATTENTION_CONFIG, ...options.configOverride }
    : DEFAULT_ATTENTION_CONFIG;

  // 1. Generate Synthetic Benchmark Cohort (Patients A through F)
  const scenarios: CalibrationScenario[] = generateBenchmarkScenarios(baseTimestamp);

  // 2. Evaluate Ranking Concordance
  const rankingEvaluation = evaluateRankingConcordance(scenarios, config);

  // 3. Decompose Individual Scores
  const evaluatedStates = rankWardPatients(
    scenarios.map((s) => s.patientState),
    config
  );
  const decompositions: ScoreDecompositionReport[] = evaluatedStates.map((result) =>
    decomposeApsScore(result)
  );

  // 4. Execute Sensitivity Analysis
  const sensitivityAnalysis = analyzeWeightSensitivity(scenarios, {
    customBaseConfig: config,
    perturbationFactors: options.perturbationFactors,
  });

  // 5. Formulate Clinical Summary Verdict
  const passed =
    !rankingEvaluation.hasCriticalInversion &&
    rankingEvaluation.kendallTau >= 0.75 &&
    sensitivityAnalysis.rankingStabilityIndex >= 85;

  const keyTakeaway = passed
    ? `APS calibration successfully verified: Ranking concordance is strong (Kendall's Tau ${rankingEvaluation.kendallTau}, ${rankingEvaluation.pairwiseAccuracyPercentage}% pairwise accuracy), and weight sensitivity remains robust (Ranking Stability Index ${sensitivityAnalysis.rankingStabilityIndex}%). No clinically dangerous inversions detected.`
    : `APS calibration identified ranking flaws: Inversion detected (Kendall's Tau ${rankingEvaluation.kendallTau}, Stability Index ${sensitivityAnalysis.rankingStabilityIndex}%). Review weight tuning.`;

  return {
    timestamp: Date.now(),
    config,
    scenarioCount: scenarios.length,
    rankingEvaluation,
    decompositions,
    sensitivityAnalysis,
    summaryVerdict: {
      passed,
      concordanceVerdict: rankingEvaluation.clinicalVerdict,
      stabilityVerdict: sensitivityAnalysis.overallVerdict,
      keyTakeaway,
    },
  };
}

/**
 * Formats an ApsCalibrationReport into a human-readable Markdown / CLI string
 */
export function formatCalibrationReport(report: ApsCalibrationReport): string {
  const lines: string[] = [];

  lines.push('================================================================================');
  lines.push('                   AEGISPULSE APS CALIBRATION LABORATORY REPORT                 ');
  lines.push('================================================================================');
  lines.push(`Generated: ${new Date(report.timestamp).toISOString()}`);
  lines.push(`Overall Verdict: ${report.summaryVerdict.passed ? 'PASSED (Clinically Sensible & Stable)' : 'FAILED'}`);
  lines.push(`Takeaway: ${report.summaryVerdict.keyTakeaway}`);
  lines.push('');

  // 1. Ranking Table
  lines.push('--------------------------------------------------------------------------------');
  lines.push('1. CLINICAL TRIAGE RANKING & CONCORDANCE');
  lines.push('--------------------------------------------------------------------------------');
  lines.push('| Actual Rank | Expected | Patient Name                           | APS Score | Category        | Concordance | Dominant Reason');
  lines.push('| :---        | :---     | :---                                   | :---      | :---            | :---        | :---');
  for (const c of report.rankingEvaluation.comparisons) {
    const expStr = c.expectedRankMin === c.expectedRankMax ? `#${c.expectedRankMin}` : `#${c.expectedRankMin}-${c.expectedRankMax}`;
    const concStr = c.isRankConcordant ? 'CONCORDANT' : 'DISCORDANT';
    lines.push(
      `| #${c.actualRank}          | ${expStr.padEnd(8)} | ${c.name.padEnd(38)} | ${String(c.actualScore).padEnd(9)} | ${c.actualCategory.padEnd(15)} | ${concStr.padEnd(11)} | ${c.dominantReason}`
    );
  }
  lines.push('');
  lines.push(`Kendall's Tau: ${report.rankingEvaluation.kendallTau} | Spearman's Rho: ${report.rankingEvaluation.spearmanRho} | Pairwise Accuracy: ${report.rankingEvaluation.pairwiseAccuracyPercentage}%`);
  lines.push(`Critical Inversions: ${report.rankingEvaluation.hasCriticalInversion ? 'YES (UNSAFE)' : 'NONE (SAFE)'}`);
  lines.push('');

  // 2. Score Decomposition Table
  lines.push('--------------------------------------------------------------------------------');
  lines.push('2. SCORE DECOMPOSITION & EPISTEMIC BREAKDOWN');
  lines.push('--------------------------------------------------------------------------------');
  for (const d of report.decompositions) {
    lines.push(`[${d.patientId}] Final APS: ${d.finalScore}/100 (${d.category}) | Dominant: ${d.dominantClinicalDriver.componentName} (${d.dominantClinicalDriver.contributionPercentage}%)`);
    lines.push(`   Epistemic: Freshness ${d.epistemicVsPhysiological.freshnessScore}/100 (${d.epistemicVsPhysiological.epistemicCategory}), Uncertainty Index ${d.epistemicVsPhysiological.uncertaintyIndex}, Coupling x${d.epistemicVsPhysiological.couplingMultiplier}`);
    lines.push(`   Top Reason: ${d.topReasons[0] || 'Stable'}`);
  }
  lines.push('');

  // 3. Sensitivity Analysis Table
  lines.push('--------------------------------------------------------------------------------');
  lines.push('3. WEIGHT SENSITIVITY & STABILITY ANALYSIS (±50% Perturbation Range)');
  lines.push('--------------------------------------------------------------------------------');
  lines.push(`Ranking Stability Index: ${report.sensitivityAnalysis.rankingStabilityIndex}% (${report.sensitivityAnalysis.overallVerdict})`);
  lines.push('| Weight Component    | Base Weight | Mean Displacement | Max Displacement | Stability Score | Verdict');
  lines.push('| :---                | :---        | :---              | :---             | :---            | :---');
  for (const ws of report.sensitivityAnalysis.weightSummaries) {
    lines.push(
      `| ${ws.weightKey.padEnd(20)}| ${String(ws.baseWeight).padEnd(11)} | ${String(ws.meanRankDisplacement).padEnd(17)} | ${String(ws.maxRankDisplacement).padEnd(16)} | ${String(ws.stabilityScore).padEnd(15)} | ${ws.clinicalImpactSummary.slice(0, 40)}...`
    );
  }
  lines.push('================================================================================');

  return lines.join('\n');
}
