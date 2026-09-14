/**
 * @aegispulse/rppg - Fourier Analysis & Spectral Peak Detection
 * Windowed FFT, Power Spectral Density (PSD), parabolic peak interpolation, and SNR calculation
 */

export interface SpectralAnalysisResult {
  dominantFrequencyHz: number;
  dominantBpm: number;
  peakPower: number;
  snrDb: number;
  frequenciesHz: number[];
  powerSpectrum: number[];
}

/**
 * Applies a Hamming window to reduce spectral leakage
 */
export function applyHammingWindow(signal: number[]): number[] {
  const n = signal.length;
  if (n <= 1) return signal;
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const w = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (n - 1));
    out[i] = signal[i] * w;
  }
  return out;
}

/**
 * Next power of 2 for zero-padding FFT
 */
function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

/**
 * Radix-2 in-place Cooley-Tukey Fast Fourier Transform
 */
function fftRadix2(real: Float64Array, imag: Float64Array): void {
  const n = real.length;
  if ((n & (n - 1)) !== 0) {
    throw new Error('FFT length must be a power of 2');
  }

  // Bit reversal
  let j = 0;
  for (let i = 0; i < n - 1; i++) {
    if (i < j) {
      const tempR = real[i];
      const tempI = imag[i];
      real[i] = real[j];
      imag[i] = imag[j];
      real[j] = tempR;
      imag[j] = tempI;
    }
    let k = n >> 1;
    while (k <= j) {
      j -= k;
      k >>= 1;
    }
    j += k;
  }

  // Danielson-Lanczos section
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    const angle = (-2 * Math.PI) / len;
    const wStepR = Math.cos(angle);
    const wStepI = Math.sin(angle);

    for (let i = 0; i < n; i += len) {
      let wR = 1;
      let wI = 0;
      for (let k = 0; k < half; k++) {
        const tr = wR * real[i + k + half] - wI * imag[i + k + half];
        const ti = wR * imag[i + k + half] + wI * real[i + k + half];
        real[i + k + half] = real[i + k] - tr;
        imag[i + k + half] = imag[i + k] - ti;
        real[i + k] += tr;
        imag[i + k] += ti;

        const nextWR = wR * wStepR - wI * wStepI;
        const nextWI = wR * wStepI + wI * wStepR;
        wR = nextWR;
        wI = nextWI;
      }
    }
  }
}

/**
 * Computes Power Spectral Density (PSD) via zero-padded FFT with Hamming window
 */
export function computePsd(
  signal: number[],
  samplingRateHz: number,
  zeroPadFactor = 4
): { frequencies: number[]; power: number[] } {
  const n = signal.length;
  if (n === 0) return { frequencies: [], power: [] };

  const windowed = applyHammingWindow(signal);
  // Zero-pad to next power of 2 * zeroPadFactor for fine spectral resolution
  const fftLen = Math.max(256, nextPowerOfTwo(n * zeroPadFactor));

  const real = new Float64Array(fftLen);
  const imag = new Float64Array(fftLen);

  for (let i = 0; i < n; i++) {
    real[i] = windowed[i];
  }

  fftRadix2(real, imag);

  const numBins = Math.floor(fftLen / 2) + 1;
  const frequencies = new Array<number>(numBins);
  const power = new Array<number>(numBins);
  const freqStep = samplingRateHz / fftLen;

  for (let i = 0; i < numBins; i++) {
    frequencies[i] = i * freqStep;
    // Magnitude squared
    power[i] = (real[i] * real[i] + imag[i] * imag[i]) / fftLen;
  }

  return { frequencies, power };
}

/**
 * Estimates dominant physiological frequency within [minFreqHz, maxFreqHz]
 * and computes signal-to-noise ratio (SNR) in dB (de Haan & Jeanne / G. de Haan definition).
 */
export function analyzeSpectrumBand(
  frequencies: number[],
  power: number[],
  minFreqHz: number,
  maxFreqHz: number,
  harmonicToleranceHz = 0.15
): SpectralAnalysisResult {
  let peakIdx = -1;
  let maxPower = -Infinity;

  // 1. Locate highest peak within physiological band
  for (let i = 0; i < frequencies.length; i++) {
    const f = frequencies[i];
    if (f >= minFreqHz && f <= maxFreqHz) {
      if (power[i] > maxPower) {
        maxPower = power[i];
        peakIdx = i;
      }
    }
  }

  if (peakIdx <= 0 || peakIdx >= frequencies.length - 1) {
    return {
      dominantFrequencyHz: minFreqHz,
      dominantBpm: minFreqHz * 60,
      peakPower: 0,
      snrDb: -20,
      frequenciesHz: frequencies,
      powerSpectrum: power,
    };
  }

  // 2. Parabolic sub-bin interpolation for precise frequency estimation
  const y1 = power[peakIdx - 1];
  const y2 = power[peakIdx];
  const y3 = power[peakIdx + 1];
  const denom = y1 - 2 * y2 + y3;
  let deltaIdx = 0;
  if (denom !== 0) {
    deltaIdx = (0.5 * (y1 - y3)) / denom;
  }
  deltaIdx = Math.max(-0.5, Math.min(0.5, deltaIdx));

  const binWidth = frequencies[1] - frequencies[0];
  const dominantFrequencyHz = Math.max(
    minFreqHz,
    Math.min(maxFreqHz, frequencies[peakIdx] + deltaIdx * binWidth)
  );
  const dominantBpm = dominantFrequencyHz * 60;

  // 3. Signal-to-Noise Ratio (SNR) in dB
  // Fundamental band: [f0 - tol, f0 + tol]
  // First harmonic band: [2*f0 - tol, 2*f0 + tol]
  const f0 = dominantFrequencyHz;
  const fHarmonic = 2 * f0;

  let signalPower = 0;
  let totalBandPower = 0;

  for (let i = 0; i < frequencies.length; i++) {
    const f = frequencies[i];
    if (f >= minFreqHz && f <= maxFreqHz * 1.8) {
      totalBandPower += power[i];

      const inFundamental = Math.abs(f - f0) <= harmonicToleranceHz;
      const inHarmonic = Math.abs(f - fHarmonic) <= harmonicToleranceHz;

      if (inFundamental || inHarmonic) {
        signalPower += power[i];
      }
    }
  }

  const noisePower = Math.max(1e-9, totalBandPower - signalPower);
  const snrRatio = signalPower / noisePower;
  const snrDb = 10 * Math.log10(Math.max(1e-4, snrRatio));

  return {
    dominantFrequencyHz,
    dominantBpm,
    peakPower: maxPower,
    snrDb: isFinite(snrDb) ? Number(snrDb.toFixed(2)) : -10,
    frequenciesHz: frequencies,
    powerSpectrum: power,
  };
}
