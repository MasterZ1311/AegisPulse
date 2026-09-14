import { describe, it, expect } from 'vitest';
import {
  computeMae,
  computeRmse,
  computePearsonCorrelation,
  computeSpearmanCorrelation,
  computeFailureRate,
  computeCoverage,
  evaluateStatisticalMetrics,
} from '../benchmarks/metrics';
import { evaluateConfidenceCalibration } from '../benchmarks/calibration';

describe('Benchmark Metrics & Confidence Calibration Engine', () => {
  it('computes exact mathematical MAE and RMSE', () => {
    const est = [70, 75, 80, 85];
    const gt = [72, 75, 78, 88];

    // diffs: 2, 0, 2, 3 -> MAE = 7/4 = 1.75
    expect(computeMae(est, gt)).toBe(1.75);

    // squared: 4, 0, 4, 9 -> sum = 17 -> mean = 4.25 -> sqrt = 2.06
    expect(computeRmse(est, gt)).toBe(2.06);
  });

  it('computes Pearson and Spearman rank correlation coefficients', () => {
    const x = [50, 60, 70, 80, 90, 100];
    const y = [51, 59, 72, 81, 89, 102];

    const r = computePearsonCorrelation(x, y);
    expect(r).toBeGreaterThan(0.99);

    const rho = computeSpearmanCorrelation(x, y);
    expect(rho).toBeGreaterThan(0.99);
  });

  it('calculates failure rate and observation coverage', () => {
    const samples = [
      { estimated: 72, groundTruth: 72, confidence: 0.9, isGatedOrUnusable: false },
      { estimated: 75, groundTruth: 76, confidence: 0.85, isGatedOrUnusable: false },
      { estimated: 0, groundTruth: 80, confidence: 0.1, isGatedOrUnusable: true }, // Failure (gated)
      { estimated: 130, groundTruth: 70, confidence: 0.5, isGatedOrUnusable: false }, // Failure (> 20 bpm divergence)
    ];

    expect(computeFailureRate(samples, 20.0)).toBe(50.0); // 2 out of 4 = 50%
    expect(computeCoverage(samples)).toBe(75.0); // 3 out of 4 non-gated = 75%
  });

  it('evaluates Expected Calibration Error (ECE) and partitions reliability bins', () => {
    // 5 well-calibrated samples: high confidence -> low error, low confidence -> high error
    const samples = [
      { estimated: 72, groundTruth: 72, confidence: 0.95, isGatedOrUnusable: false }, // accurate, conf 0.95
      { estimated: 80, groundTruth: 81, confidence: 0.90, isGatedOrUnusable: false }, // accurate, conf 0.90
      { estimated: 65, groundTruth: 66, confidence: 0.85, isGatedOrUnusable: false }, // accurate, conf 0.85
      { estimated: 90, groundTruth: 110, confidence: 0.20, isGatedOrUnusable: false }, // inaccurate, conf 0.20
      { estimated: 0, groundTruth: 75, confidence: 0.10, isGatedOrUnusable: true }, // inaccurate, conf 0.10
    ];

    const calib = evaluateConfidenceCalibration(samples, { numBins: 5, clinicalToleranceBpm: 3.0 });

    expect(calib).toHaveProperty('expectedCalibrationError');
    expect(calib).toHaveProperty('maximumCalibrationError');
    expect(calib).toHaveProperty('brierScore');
    expect(calib).toHaveProperty('bins');
    expect(calib).toHaveProperty('diagnosis');

    expect(calib.bins.length).toBe(5);
    // Well calibrated because high confidence aligns with accurate and low confidence aligns with inaccurate
    expect(calib.expectedCalibrationError).toBeLessThan(0.15);
    expect(calib.diagnosis).toBe('WELL_CALIBRATED');
  });

  it('detects overconfidence when algorithm delivers high confidence on inaccurate estimates', () => {
    const overconfidentSamples = [
      { estimated: 60, groundTruth: 100, confidence: 0.95, isGatedOrUnusable: false },
      { estimated: 65, groundTruth: 110, confidence: 0.92, isGatedOrUnusable: false },
      { estimated: 70, groundTruth: 120, confidence: 0.88, isGatedOrUnusable: false },
    ];

    const calib = evaluateConfidenceCalibration(overconfidentSamples, { numBins: 5, clinicalToleranceBpm: 3.0 });

    expect(calib.expectedCalibrationError).toBeGreaterThan(0.5);
    expect(calib.diagnosis).toBe('OVER_CONFIDENT');
  });
});
