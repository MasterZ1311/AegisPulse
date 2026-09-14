/**
 * @aegispulse/research - Benchmark Metrics Engine
 * Core statistical evaluation metrics: MAE, RMSE, Pearson r, Spearman rho, Failure Rate, Coverage.
 */

export interface MetricSamplePair {
  estimated: number;
  groundTruth: number;
  confidence: number;
  isGatedOrUnusable?: boolean;
}

export interface StatisticalMetricsResult {
  sampleCount: number;
  validCount: number;
  meanAbsoluteError: number;
  rootMeanSquareError: number;
  pearsonCorrelation: number;
  spearmanCorrelation: number;
  failureRatePercent: number;
  coveragePercent: number;
}

/**
 * Computes Mean Absolute Error: (1/N) * sum(|y_i - y_hat_i|)
 */
export function computeMae(estimates: number[], groundTruths: number[]): number {
  const n = Math.min(estimates.length, groundTruths.length);
  if (n === 0) return 0;

  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += Math.abs(estimates[i] - groundTruths[i]);
  }
  return Math.round((sum / n) * 100) / 100;
}

/**
 * Computes Root Mean Square Error: sqrt((1/N) * sum((y_i - y_hat_i)^2))
 */
export function computeRmse(estimates: number[], groundTruths: number[]): number {
  const n = Math.min(estimates.length, groundTruths.length);
  if (n === 0) return 0;

  let sumSq = 0;
  for (let i = 0; i < n; i++) {
    const diff = estimates[i] - groundTruths[i];
    sumSq += diff * diff;
  }
  return Math.round(Math.sqrt(sumSq / n) * 100) / 100;
}

/**
 * Computes Pearson correlation coefficient (r)
 */
export function computePearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n <= 1) return 0;

  const meanX = x.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const meanY = y.slice(0, n).reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let denX = 0;
  let denY = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }

  const denom = Math.sqrt(denX * denY);
  if (denom === 0 || !isFinite(denom)) return 0;
  return Math.round((num / denom) * 1000) / 1000;
}

/**
 * Computes Spearman rank correlation coefficient (rho)
 */
export function computeSpearmanCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n <= 1) return 0;

  const rankX = computeRanks(x.slice(0, n));
  const rankY = computeRanks(y.slice(0, n));

  return computePearsonCorrelation(rankX, rankY);
}

function computeRanks(arr: number[]): number[] {
  const sorted = arr.map((val, idx) => ({ val, idx })).sort((a, b) => a.val - b.val);
  const ranks = new Array<number>(arr.length);
  for (let i = 0; i < sorted.length; i++) {
    ranks[sorted[i].idx] = i + 1;
  }
  return ranks;
}

/**
 * Computes Failure Rate (% of samples where signal was unusable or divergence exceeded threshold)
 * Default clinical threshold: 20 BPM (standard medical device divergence threshold)
 */
export function computeFailureRate(
  pairs: MetricSamplePair[],
  divergenceThreshold = 20.0
): number {
  if (pairs.length === 0) return 0;

  let failures = 0;
  for (const p of pairs) {
    if (p.isGatedOrUnusable) {
      failures++;
      continue;
    }
    const absErr = Math.abs(p.estimated - p.groundTruth);
    if (absErr > divergenceThreshold || !isFinite(p.estimated) || p.estimated <= 0) {
      failures++;
    }
  }

  return Math.round((failures / pairs.length) * 1000) / 10;
}

/**
 * Computes Coverage (% of observation duration where valid estimates were delivered)
 */
export function computeCoverage(pairs: MetricSamplePair[]): number {
  if (pairs.length === 0) return 0;
  const valid = pairs.filter((p) => !p.isGatedOrUnusable && p.estimated > 0);
  return Math.round((valid.length / pairs.length) * 1000) / 10;
}

/**
 * Evaluates comprehensive suite of statistical metrics across sample pairs
 */
export function evaluateStatisticalMetrics(
  pairs: MetricSamplePair[],
  divergenceThreshold = 20.0
): StatisticalMetricsResult {
  const total = pairs.length;
  if (total === 0) {
    return {
      sampleCount: 0,
      validCount: 0,
      meanAbsoluteError: 99.9,
      rootMeanSquareError: 99.9,
      pearsonCorrelation: 0,
      spearmanCorrelation: 0,
      failureRatePercent: 100,
      coveragePercent: 0,
    };
  }

  const validPairs = pairs.filter((p) => !p.isGatedOrUnusable && p.estimated > 0);
  const validCount = validPairs.length;

  const validEst = validPairs.map((p) => p.estimated);
  const validGt = validPairs.map((p) => p.groundTruth);

  const mae = validCount > 0 ? computeMae(validEst, validGt) : 99.9;
  const rmse = validCount > 0 ? computeRmse(validEst, validGt) : 99.9;
  const pearson = validCount > 1 ? computePearsonCorrelation(validEst, validGt) : 0;
  const spearman = validCount > 1 ? computeSpearmanCorrelation(validEst, validGt) : 0;
  const failureRate = computeFailureRate(pairs, divergenceThreshold);
  const coverage = computeCoverage(pairs);

  return {
    sampleCount: total,
    validCount,
    meanAbsoluteError: mae,
    rootMeanSquareError: rmse,
    pearsonCorrelation: pearson,
    spearmanCorrelation: spearman,
    failureRatePercent: failureRate,
    coveragePercent: coverage,
  };
}
