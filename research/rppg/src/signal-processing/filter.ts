/**
 * @aegispulse/rppg - Signal Filtering & Normalization
 * Zero-phase digital filtering, temporal normalization, and detrending
 */

/**
 * Computes mean of a numeric array
 */
export function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((sum, val) => sum + val, 0) / arr.length;
}

/**
 * Computes standard deviation of a numeric array
 */
export function standardDeviation(arr: number[]): number {
  if (arr.length <= 1) return 0;
  const avg = mean(arr);
  const variance = arr.reduce((sum, val) => sum + (val - avg) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

/**
 * Normalizes an array to zero-mean and unit variance
 */
export function normalizeZeroMeanUnitVariance(arr: number[]): number[] {
  const avg = mean(arr);
  const std = standardDeviation(arr);
  if (std === 0 || !isFinite(std)) {
    return arr.map(() => 0);
  }
  return arr.map((x) => (x - avg) / std);
}

/**
 * Normalizes color channel by sliding-window local mean: Cn(t) = C(t) / mean_W(C(t))
 * Crucial for the POS (Plane-Orthogonal-to-Skin) method.
 */
export function slidingWindowMeanNormalize(arr: number[], windowSize: number): number[] {
  const n = arr.length;
  if (n === 0) return [];
  const halfWin = Math.max(1, Math.floor(windowSize / 2));
  const result = new Array<number>(n);

  for (let i = 0; i < n; i++) {
    const start = Math.max(0, i - halfWin);
    const end = Math.min(n, i + halfWin + 1);
    let winSum = 0;
    for (let j = start; j < end; j++) {
      winSum += arr[j];
    }
    const winMean = winSum / (end - start);
    result[i] = winMean !== 0 ? arr[i] / winMean : 1.0;
  }

  return result;
}

/**
 * Detrends a signal by subtracting a moving-average baseline
 */
export function detrendMovingAverage(signal: number[], windowSize: number): number[] {
  const n = signal.length;
  if (n === 0) return [];
  const halfWin = Math.max(1, Math.floor(windowSize / 2));
  const detrended = new Array<number>(n);

  for (let i = 0; i < n; i++) {
    const start = Math.max(0, i - halfWin);
    const end = Math.min(n, i + halfWin + 1);
    let sum = 0;
    for (let j = start; j < end; j++) {
      sum += signal[j];
    }
    const baseline = sum / (end - start);
    detrended[i] = signal[i] - baseline;
  }

  return detrended;
}

/**
 * 2nd-Order Butterworth Bandpass Filter Coefficients (Bilinear Transform)
 */
export interface BiquadCoefficients {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

/**
 * Designs a 2nd-order Butterworth bandpass filter
 * @param lowCutoffHz Lower cutoff frequency (e.g. 0.7 Hz)
 * @param highCutoffHz Upper cutoff frequency (e.g. 3.5 Hz)
 * @param samplingRateHz Sampling rate in Hz (e.g. 30 Hz)
 */
export function designButterworthBandpass(
  lowCutoffHz: number,
  highCutoffHz: number,
  samplingRateHz: number
): BiquadCoefficients {
  const nyquist = samplingRateHz / 2;
  const f1 = Math.max(0.001, Math.min(lowCutoffHz / nyquist, 0.99));
  const f2 = Math.max(f1 + 0.001, Math.min(highCutoffHz / nyquist, 0.999));

  // Angular frequencies
  const w1 = Math.tan((Math.PI * f1) / 2);
  const w2 = Math.tan((Math.PI * f2) / 2);
  const bw = w2 - w1;
  const w0sq = w1 * w2;

  // Direct Form II / Transposed Biquad coefficients
  const norm = 1 / (1 + bw + w0sq);
  const b0 = bw * norm;
  const b1 = 0;
  const b2 = -bw * norm;
  const a1 = 2 * (w0sq - 1) * norm;
  const a2 = (1 - bw + w0sq) * norm;

  return { b0, b1, b2, a1, a2 };
}

/**
 * Forward single-pass IIR filtering with Direct Form II Transposed
 */
export function applyIirFilter(signal: number[], coeffs: BiquadCoefficients): number[] {
  const n = signal.length;
  const out = new Array<number>(n);
  let d1 = 0;
  let d2 = 0;

  for (let i = 0; i < n; i++) {
    const x = signal[i];
    const y = coeffs.b0 * x + d1;
    d1 = coeffs.b1 * x - coeffs.a1 * y + d2;
    d2 = coeffs.b2 * x - coeffs.a2 * y;
    out[i] = y;
  }

  return out;
}

/**
 * Zero-phase forward-backward filtering (equivalent to SciPy `filtfilt`).
 * Eliminates phase delay so peak timestamps precisely match pulse beats.
 */
export function filtfiltButterworth(
  signal: number[],
  coeffs: BiquadCoefficients
): number[] {
  if (signal.length <= 4) return signal;

  const mu = mean(signal);
  const demeaned = new Array<number>(signal.length);
  for (let i = 0; i < signal.length; i++) {
    demeaned[i] = signal[i] - mu;
  }

  // Forward pass
  const forward = applyIirFilter(demeaned, coeffs);

  // Backward pass on reversed signal
  forward.reverse();
  const backward = applyIirFilter(forward, coeffs);
  backward.reverse();

  return backward;
}
