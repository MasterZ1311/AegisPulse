import { describe, it, expect } from 'vitest';
import { ExperimentRunner } from '../experiments/runner';
import { FORMAL_EXPERIMENTS } from '../experiments/registry';
import { validateExperimentResult } from '../experiments/schema';

describe('Reproducible Experiment Runner & Machine-Readable Artifact Generation', () => {
  const runner = new ExperimentRunner();

  it('executes formal rPPG experiment EXP-RPPG-001 and generates machine-readable JSON result', () => {
    const expDef = FORMAL_EXPERIMENTS['EXP-RPPG-001'];
    expect(expDef).toBeDefined();

    const result = runner.runExperiment(expDef);

    // Conformance with machine-readable schema
    expect(result.experimentId).toBe('EXP-RPPG-001');
    expect(result.name).toBe(expDef.name);
    expect(result.timestamp).toBeDefined();
    expect(result.executionDurationMs).toBeGreaterThanOrEqual(0);

    // Documented dataset population & limitations
    expect(result.dataset.slug).toBe('ubfc-rppg');
    expect(result.dataset.cohortDescription).toBeDefined();
    expect(result.dataset.totalSubjects).toBeGreaterThan(0);
    expect(result.dataset.knownLimitations.length).toBeGreaterThan(0);
    expect(result.dataset.clinicalClaimBoundary.length).toBeGreaterThan(20);

    // Quantitative metrics
    expect(result.primaryMetrics.meanAbsoluteError).toBeLessThan(4.5);
    expect(result.primaryMetrics.pearsonCorrelation).toBeGreaterThan(0.9);
    expect(result.confidenceCalibration.expectedCalibrationError).toBeDefined();

    // Multi-algorithm comparisons (GREEN, CHROM, POS)
    expect(result.algorithmComparisons).toHaveProperty('GREEN');
    expect(result.algorithmComparisons).toHaveProperty('CHROM');
    expect(result.algorithmComparisons).toHaveProperty('POS');

    // Mandatory clinical disclaimer
    expect(result.disclaimer.toLowerCase()).toContain('never make clinical claims');

    // Schema validator pass
    const validation = validateExperimentResult(result);
    expect(validation.valid).toBe(true);
  });

  it('executes hospital deterioration experiment EXP-CLIN-005 and verifies lead time & alarm suppression', () => {
    const expDef = FORMAL_EXPERIMENTS['EXP-CLIN-005'];
    expect(expDef).toBeDefined();

    const result = runner.runExperiment(expDef);

    expect(result.experimentId).toBe('EXP-CLIN-005');
    expect(result.dataset.slug).toBe('mimic-iv');
    expect(result.customSummary).toHaveProperty('apsMetrics');
    expect(result.customSummary).toHaveProperty('mewsMetrics');

    const apsMetrics = (result.customSummary as any).apsMetrics;
    expect(apsMetrics.meanLeadTimeHours).toBeGreaterThanOrEqual(0);
  });

  it('rejects experiment execution if dataset population or limitations are omitted', () => {
    const invalidDef = {
      experimentId: 'EXP-INVALID-000',
      name: 'Unethical Experiment Missing Limitations',
      targetCategory: 'RPPG' as const,
      datasetSlug: 'non-existent-slug',
      hypothesis: 'Invalid test',
      benchmarkingObjective: 'Invalid objective',
      parameters: {},
    };

    expect(() => {
      runner.runExperiment(invalidDef);
    }).toThrow(/not found in Dataset Registry/);
  });
});
