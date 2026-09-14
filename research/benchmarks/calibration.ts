/**
 * @aegispulse/research - Confidence Calibration & Reliability Analysis
 * Evaluates whether algorithmic confidence scores accurately reflect empirical measurement precision.
 * Computes Expected Calibration Error (ECE) and partitions samples into reliability diagram bins.
 */

import type { MetricSamplePair } from './metrics';

export interface CalibrationBin {
  binIndex: number;
  confidenceRange: [number, number];
  sampleCount: number;
  meanConfidence: number;
  empiricalAccuracy: number;
  meanAbsoluteError: number;
  calibrationGap: number; // |meanConfidence - empiricalAccuracy|
}

export interface CalibrationResult {
  expectedCalibrationError: number; // ECE in [0.0, 1.0]
  maximumCalibrationError: number;  // MCE in [0.0, 1.0]
  brierScore: number;
  bins: CalibrationBin[];
  diagnosis: 'WELL_CALIBRATED' | 'OVER_CONFIDENT' | 'UNDER_CONFIDENT';
}

export interface CalibrationOptions {
  numBins?: number;
  clinicalToleranceBpm?: number; // Error threshold below which an estimate is considered "accurate" (default: 3.0 bpm)
}

/**
 * Computes Expected Calibration Error (ECE) and generates reliability diagram bins
 */
export function evaluateConfidenceCalibration(
  pairs: MetricSamplePair[],
  options: CalibrationOptions = {}
): CalibrationResult {
  const { numBins = 10, clinicalToleranceBpm = 3.0 } = options;

  if (pairs.length === 0) {
    return {
      expectedCalibrationError: 0,
      maximumCalibrationError: 0,
      brierScore: 0,
      bins: [],
      diagnosis: 'WELL_CALIBRATED',
    };
  }

  const binStep = 1.0 / numBins;
  const bins: CalibrationBin[] = [];

  let totalEceNumerator = 0;
  let maxCalibError = 0;
  let brierSum = 0;

  let totalOverconfidence = 0;
  let totalUnderconfidence = 0;

  for (let b = 0; b < numBins; b++) {
    const rangeLow = b * binStep;
    const rangeHigh = (b + 1) * binStep;

    // Filter samples whose confidence falls in [rangeLow, rangeHigh)
    // The last bin is inclusive of 1.0
    const binSamples = pairs.filter((p) => {
      if (b === numBins - 1) {
        return p.confidence >= rangeLow && p.confidence <= rangeHigh;
      }
      return p.confidence >= rangeLow && p.confidence < rangeHigh;
    });

    const count = binSamples.length;

    if (count === 0) {
      bins.push({
        binIndex: b,
        confidenceRange: [rangeLow, rangeHigh],
        sampleCount: 0,
        meanConfidence: (rangeLow + rangeHigh) / 2,
        empiricalAccuracy: 0,
        meanAbsoluteError: 0,
        calibrationGap: 0,
      });
      continue;
    }

    const meanConf = binSamples.reduce((sum, p) => sum + p.confidence, 0) / count;

    // Accuracy: proportion of samples where absolute error <= clinical tolerance
    let accurateCount = 0;
    let absErrSum = 0;

    for (const p of binSamples) {
      const isAccurate = !p.isGatedOrUnusable && Math.abs(p.estimated - p.groundTruth) <= clinicalToleranceBpm;
      if (isAccurate) accurateCount++;
      absErrSum += p.isGatedOrUnusable ? 50.0 : Math.abs(p.estimated - p.groundTruth);

      // Brier score: (conf - binaryOutcome)^2
      const outcome = isAccurate ? 1 : 0;
      brierSum += (p.confidence - outcome) ** 2;
    }

    const empiricalAcc = accurateCount / count;
    const meanAbsErr = absErrSum / count;
    const gap = Math.abs(meanConf - empiricalAcc);

    if (meanConf > empiricalAcc) {
      totalOverconfidence += (meanConf - empiricalAcc) * count;
    } else {
      totalUnderconfidence += (empiricalAcc - meanConf) * count;
    }

    totalEceNumerator += count * gap;
    if (gap > maxCalibError) {
      maxCalibError = gap;
    }

    bins.push({
      binIndex: b,
      confidenceRange: [Number(rangeLow.toFixed(2)), Number(rangeHigh.toFixed(2))],
      sampleCount: count,
      meanConfidence: Number(meanConf.toFixed(3)),
      empiricalAccuracy: Number(empiricalAcc.toFixed(3)),
      meanAbsoluteError: Number(meanAbsErr.toFixed(2)),
      calibrationGap: Number(gap.toFixed(3)),
    });
  }

  const ece = totalEceNumerator / pairs.length;
  const brierScore = brierSum / pairs.length;

  let diagnosis: CalibrationResult['diagnosis'] = 'WELL_CALIBRATED';
  if (ece > 0.15) {
    diagnosis = totalOverconfidence > totalUnderconfidence ? 'OVER_CONFIDENT' : 'UNDER_CONFIDENT';
  }

  return {
    expectedCalibrationError: Number(ece.toFixed(4)),
    maximumCalibrationError: Number(maxCalibError.toFixed(4)),
    brierScore: Number(brierScore.toFixed(4)),
    bins,
    diagnosis,
  };
}
