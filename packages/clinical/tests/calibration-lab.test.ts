import { describe, it, expect } from 'vitest';
import {
  generateBenchmarkScenarios,
  evaluateRankingConcordance,
  decomposeApsScore,
  analyzeWeightSensitivity,
  runCalibrationLab,
  formatCalibrationReport,
} from '../src';
import { rankWardPatients } from '../src/attentionPriority/attention-engine';

describe('APS Calibration Laboratory Suite', () => {
  const fixedNow = 1700000000000;

  // --------------------------------------------------------------------------
  // 1. SCENARIO GENERATOR
  // --------------------------------------------------------------------------
  describe('Scenario Generator', () => {
    it('generates the canonical 6-patient benchmark cohort with complete metadata', () => {
      const scenarios = generateBenchmarkScenarios(fixedNow);

      expect(scenarios).toHaveLength(6);

      const archetypes = scenarios.map((s) => s.metadata.archetype);
      expect(archetypes).toContain('STABLE');
      expect(archetypes).toContain('TRANSIENT_SPIKE');
      expect(archetypes).toContain('SUSTAINED_DETERIORATION');
      expect(archetypes).toContain('POOR_SIGNAL');
      expect(archetypes).toContain('ABNORMAL_LABS');
      expect(archetypes).toContain('RISING_AND_STALE');

      for (const s of scenarios) {
        expect(s.patientState.patientId).toBe(s.metadata.id);
        expect(s.patientState.currentTimestamp).toBe(fixedNow);
        expect(s.metadata.expectedRankMin).toBeGreaterThanOrEqual(1);
        expect(s.metadata.expectedRankMax).toBeLessThanOrEqual(6);
        expect(s.metadata.clinicalRationale.length).toBeGreaterThan(10);
      }
    });
  });

  // --------------------------------------------------------------------------
  // 2. EXPECTED VS ACTUAL ORDERING EVALUATION
  // --------------------------------------------------------------------------
  describe('Ranking Concordance & Severity Ordering', () => {
    it('produces a 100% pairwise concordant clinical ordering matching medical ground truth', () => {
      const scenarios = generateBenchmarkScenarios(fixedNow);
      const report = evaluateRankingConcordance(scenarios);

      // Kendall's Tau must be exceptionally strong (>= 0.90)
      expect(report.kendallTau).toBeGreaterThanOrEqual(0.90);
      expect(report.spearmanRho).toBeGreaterThanOrEqual(0.90);
      expect(report.pairwiseAccuracyPercentage).toBe(100);

      // Must have ZERO critical inversions
      expect(report.hasCriticalInversion).toBe(false);
      expect(report.inversions).toHaveLength(0);
      expect(report.clinicalVerdict).toBe('PERFECT_CONCORDANCE');

      // Verify each patient individually conforms to expected rank range
      for (const comp of report.comparisons) {
        expect(comp.isRankConcordant).toBe(true);
        expect(comp.actualRank).toBeGreaterThanOrEqual(comp.expectedRankMin);
        expect(comp.actualRank).toBeLessThanOrEqual(comp.expectedRankMax);
      }
    });

    it('strictly enforces clinical priority hierarchy: {C, F} > E > D > B > A', () => {
      const scenarios = generateBenchmarkScenarios(fixedNow);
      const patientStates = scenarios.map((s) => s.patientState);
      const results = rankWardPatients(patientStates);

      const rankOf = (id: string) => results.find((r) => r.patientId === id)!.wardRank;
      const scoreOf = (id: string) => results.find((r) => r.patientId === id)!.score;

      // Tier 1: Acute Active Collapse (Patient C) & Unmonitored Accelerating Trajectory (Patient F)
      expect(rankOf('PT-F')).toBeLessThanOrEqual(2);
      expect(rankOf('PT-C')).toBeLessThanOrEqual(2);
      expect(scoreOf('PT-F')).toBeGreaterThanOrEqual(75);
      expect(scoreOf('PT-C')).toBeGreaterThanOrEqual(75);

      // Tier 2: Abnormal Metabolic Labs (Patient E with Lactate 3.2)
      expect(rankOf('PT-E')).toBe(3);
      expect(scoreOf('PT-E')).toBeGreaterThanOrEqual(30);

      // Tier 3: Poor Signal / Unknown State (Patient D)
      expect(rankOf('PT-D')).toBe(4);

      // Tier 4: Isolated Transient Spike (Patient B - Damped)
      expect(rankOf('PT-B')).toBe(5);
      expect(scoreOf('PT-B')).toBeLessThanOrEqual(20);

      // Tier 5: Baseline Stability (Patient A)
      expect(rankOf('PT-A')).toBe(6);
      expect(scoreOf('PT-A')).toBeLessThanOrEqual(5);

      // Strict Pairwise Assertions:
      expect(scoreOf('PT-C')).toBeGreaterThan(scoreOf('PT-E'));
      expect(scoreOf('PT-F')).toBeGreaterThan(scoreOf('PT-E'));
      expect(scoreOf('PT-E')).toBeGreaterThan(scoreOf('PT-D'));
      expect(scoreOf('PT-D')).toBeGreaterThan(scoreOf('PT-B'));
      expect(scoreOf('PT-B')).toBeGreaterThan(scoreOf('PT-A'));
    });
  });

  // --------------------------------------------------------------------------
  // 3. SCORE DECOMPOSITION
  // --------------------------------------------------------------------------
  describe('Score Decomposition', () => {
    it('deconstructs composite score into percentage contributions and identifies dominant clinical driver', () => {
      const scenarios = generateBenchmarkScenarios(fixedNow);
      const patientStates = scenarios.map((s) => s.patientState);
      const results = rankWardPatients(patientStates);

      for (const result of results) {
        const decomp = decomposeApsScore(result);

        expect(decomp.patientId).toBe(result.patientId);
        expect(decomp.finalScore).toBe(result.score);
        expect(decomp.category).toBe(result.category);

        // Component count must be 9
        expect(decomp.components).toHaveLength(9);

        // Epistemic vs Physiological properties populated
        expect(decomp.epistemicVsPhysiological).toBeDefined();
        expect(decomp.epistemicVsPhysiological.couplingMultiplier).toBeGreaterThanOrEqual(1.0);
        expect(decomp.epistemicVsPhysiological.freshnessScore).toBeGreaterThanOrEqual(0);
        expect(decomp.epistemicVsPhysiological.freshnessScore).toBeLessThanOrEqual(100);

        // Dominant clinical driver identified
        expect(decomp.dominantClinicalDriver).toBeDefined();
        expect(decomp.dominantClinicalDriver.componentName.length).toBeGreaterThan(0);
      }

      // Patient E specific check: Biomarkers should be dominant
      const ptEResult = results.find((r) => r.patientId === 'PT-E')!;
      const ptEDecomp = decomposeApsScore(ptEResult);
      expect(ptEDecomp.dominantClinicalDriver.componentName).toBe('biomarkers');
      expect(ptEDecomp.dominantClinicalDriver.contributionPercentage).toBeGreaterThan(50);
      expect(ptEDecomp.appliedOverrideFloor?.floorName).toBe('ELEVATED_LACTATE_FLOOR');
    });
  });

  // --------------------------------------------------------------------------
  // 4. SENSITIVITY ANALYSIS (WEIGHT PERTURBATION)
  // --------------------------------------------------------------------------
  describe('Weight Sensitivity Analysis', () => {
    it('demonstrates that triage ranking is highly stable across ±50% weight perturbations', () => {
      const scenarios = generateBenchmarkScenarios(fixedNow);
      const sensitivity = analyzeWeightSensitivity(scenarios, {
        perturbationFactors: [0.5, 0.75, 0.9, 1.1, 1.25, 1.5],
      });

      // Ranking Stability Index must be >= 95%
      expect(sensitivity.rankingStabilityIndex).toBeGreaterThanOrEqual(95);
      expect(sensitivity.overallVerdict).toBe('HIGHLY_STABLE');

      // Baseline correlation must be preserved
      expect(sensitivity.baselineKendallTau).toBeGreaterThanOrEqual(0.90);
      expect(sensitivity.baselinePairwiseAccuracy).toBe(100);

      // Check each weight summary
      expect(sensitivity.weightSummaries).toHaveLength(9);
      for (const summary of sensitivity.weightSummaries) {
        expect(summary.stabilityScore).toBeGreaterThanOrEqual(80);
        expect(summary.meanRankDisplacement).toBeLessThanOrEqual(0.5);
      }
    });
  });

  // --------------------------------------------------------------------------
  // 5. CALIBRATION LAB MASTER RUNNER & CLI REPORT
  // --------------------------------------------------------------------------
  describe('Master Calibration Lab Runner', () => {
    it('executes full calibration suite and formats audit report', () => {
      const report = runCalibrationLab({ baseTimestamp: fixedNow });

      expect(report.summaryVerdict.passed).toBe(true);
      expect(report.summaryVerdict.concordanceVerdict).toBe('PERFECT_CONCORDANCE');
      expect(report.summaryVerdict.stabilityVerdict).toBe('HIGHLY_STABLE');
      expect(report.decompositions).toHaveLength(6);

      const formatted = formatCalibrationReport(report);
      expect(formatted).toContain('AEGISPULSE APS CALIBRATION LABORATORY REPORT');
      expect(formatted).toContain('PASSED (Clinically Sensible & Stable)');
      expect(formatted).toContain('Kendall\'s Tau: 0.966');
      expect(formatted).toContain('Pairwise Accuracy: 100%');
      expect(formatted).toContain('Critical Inversions: NONE (SAFE)');
    });
  });
});
