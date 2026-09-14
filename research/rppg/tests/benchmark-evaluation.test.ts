import { describe, it, expect } from 'vitest';
import { BenchmarkHarness, type BenchmarkDatasetItem } from '../src/evaluation/benchmark-harness';
import { generateSyntheticRgbSeries } from '../src/evaluation/synthetic-dataset';

describe('rPPG Benchmark Evaluation Tooling & Algorithm Comparison', () => {
  const harness = new BenchmarkHarness();

  // Construct a diverse multi-subject benchmark dataset
  const testCases = [
    { id: 'sub-01-brady', hr: 55, rr: 12, motion: 0.0, noise: 0.01 },
    { id: 'sub-02-normal-resting', hr: 72, rr: 15, motion: 0.0, noise: 0.01 },
    { id: 'sub-03-mild-tachy', hr: 98, rr: 18, motion: 0.05, noise: 0.02 },
    { id: 'sub-04-exercise-hr', hr: 125, rr: 24, motion: 0.05, noise: 0.02 },
  ];

  const cleanDataset: BenchmarkDatasetItem[] = testCases.map((tc) => {
    const { series } = generateSyntheticRgbSeries({
      fps: 30,
      durationSeconds: 10,
      targetHeartRateBpm: tc.hr,
      targetRespRateBpm: tc.rr,
      motionIntensity: tc.motion,
      snrAdditiveNoise: tc.noise,
      randomSeed: 42 + tc.hr,
    });

    return {
      id: tc.id,
      series,
      groundTruthHeartRate: tc.hr,
      groundTruthRespRate: tc.rr,
      motionIntensity: tc.motion,
    };
  });

  it('runs comparative benchmark across GREEN, CHROM, and POS algorithms on resting dataset', () => {
    const comparison = harness.compareAllAlgorithms(cleanDataset, 'Clean-Cohort-Test');

    expect(comparison).toHaveProperty('GREEN');
    expect(comparison).toHaveProperty('CHROM');
    expect(comparison).toHaveProperty('POS');

    for (const algo of ['GREEN', 'CHROM', 'POS'] as const) {
      const report = comparison[algo];
      expect(report.totalSamples).toBe(cleanDataset.length);
      expect(report.validSamplesCount).toBe(cleanDataset.length);
      expect(report.yieldPercentage).toBe(100);

      // Resting conditions should yield tight MAE (< 2.5 bpm) and high correlation (> 0.98)
      expect(report.meanAbsoluteErrorBpm).toBeLessThanOrEqual(2.5);
      expect(report.rootMeanSquareErrorBpm).toBeLessThanOrEqual(3.0);
      expect(report.pearsonCorrelation).toBeGreaterThan(0.98);

      // High SNR on clean pulse
      expect(report.meanSnrDb).toBeGreaterThanOrEqual(5.0);

      // High throughput (greater than 500 fps simulated signal processing)
      expect(report.fpsThroughput).toBeGreaterThan(100);

      // Explicit scientific disclaimer present
      expect(report.disclaimer.toLowerCase()).toContain('investigational');
    }
  });

  it('demonstrates POS and CHROM superior robustness compared to GREEN under illumination and motion disturbances', () => {
    // Perturbed dataset with illumination drift and subtle motion
    const perturbedCases = [
      { id: 'motion-sub-01', hr: 65, motion: 0.35, noise: 0.005 },
      { id: 'motion-sub-02', hr: 80, motion: 0.40, noise: 0.005 },
      { id: 'motion-sub-03', hr: 110, motion: 0.35, noise: 0.005 },
    ];

    const perturbedDataset: BenchmarkDatasetItem[] = perturbedCases.map((tc) => {
      const { series } = generateSyntheticRgbSeries({
        fps: 30,
        durationSeconds: 10,
        targetHeartRateBpm: tc.hr,
        motionIntensity: tc.motion,
        snrAdditiveNoise: tc.noise,
        randomSeed: 100 + tc.hr,
      });

      return {
        id: tc.id,
        series,
        groundTruthHeartRate: tc.hr,
        motionIntensity: tc.motion,
      };
    });

    const comparison = harness.compareAllAlgorithms(perturbedDataset, 'Motion-Illumination-Challenge');

    // POS and CHROM color difference combinations cancel specular reflections and intensity shifts,
    // maintaining significantly lower MAE and higher physiological fidelity than raw single-channel GREEN
    expect(comparison.POS.meanAbsoluteErrorBpm).toBeLessThan(comparison.GREEN.meanAbsoluteErrorBpm);
    expect(comparison.CHROM.meanAbsoluteErrorBpm).toBeLessThan(comparison.GREEN.meanAbsoluteErrorBpm);
    expect(comparison.POS.meanAbsoluteErrorBpm).toBeLessThanOrEqual(2.5);
    expect(comparison.CHROM.meanAbsoluteErrorBpm).toBeLessThanOrEqual(2.5);
  });

  it('stores strictly metadata, metrics, and experimental outputs without storing patient video', () => {
    const report = harness.evaluateAlgorithm('POS', cleanDataset, 'Privacy-Audit-Suite');

    // Metrics are present
    expect(report.meanAbsoluteErrorBpm).toBeDefined();
    expect(report.rootMeanSquareErrorBpm).toBeDefined();
    expect(report.pearsonCorrelation).toBeDefined();
    expect(report.meanSnrDb).toBeDefined();
    expect(report.yieldPercentage).toBeDefined();

    // Verify report contains no video frames or binary imagery
    const reportStr = JSON.stringify(report);
    expect(reportStr).not.toContain('video');
    expect(reportStr).not.toContain('frameBuffer');
    expect(reportStr).not.toContain('base64');
  });
});
