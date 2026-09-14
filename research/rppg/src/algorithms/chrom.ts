/**
 * @aegispulse/rppg - CHROM (Chrominance-Based) Pulse Signal Extraction
 * Reference: de Haan, G., & Jeanne, V. (2013).
 * "Robust pulse rate from chrominance-based rPPG." IEEE Transactions on Biomedical Engineering, 60(10), 2878-2886.
 */

import {
  mean,
  standardDeviation,
  designButterworthBandpass,
  filtfiltButterworth,
} from '../signal-processing/filter';

export interface ChromExtractionOptions {
  fps?: number;
  lowCutoffHz?: number;
  highCutoffHz?: number;
}

/**
 * Extracts motion-robust pulsatile signal using the CHROM method
 * Eliminates specular reflection specularities by projecting normalized RGB signals
 * onto two orthogonal chrominance axes:
 *   Xs = 3*Rn - 2*Gn
 *   Ys = 1.5*Rn + Gn - 1.5*Bn
 *   S_chrom = Xf - (std(Xf) / std(Yf)) * Yf
 */
export function extractPulseChrom(
  rChannel: number[],
  gChannel: number[],
  bChannel: number[],
  options: ChromExtractionOptions = {}
): number[] {
  const {
    fps = 30,
    lowCutoffHz = 0.7,
    highCutoffHz = 3.5,
  } = options;

  const n = Math.min(rChannel.length, gChannel.length, bChannel.length);
  if (n < 10) return new Array(n).fill(0);

  // 1. Channel mean normalization (temporal color normalization)
  const meanR = Math.max(1e-6, mean(rChannel.slice(0, n)));
  const meanG = Math.max(1e-6, mean(gChannel.slice(0, n)));
  const meanB = Math.max(1e-6, mean(bChannel.slice(0, n)));

  const Rn = new Array<number>(n);
  const Gn = new Array<number>(n);
  const Bn = new Array<number>(n);

  for (let i = 0; i < n; i++) {
    Rn[i] = rChannel[i] / meanR;
    Gn[i] = gChannel[i] / meanG;
    Bn[i] = bChannel[i] / meanB;
  }

  // 2. Project onto orthogonal chrominance vectors
  // Xs = 3*Rn - 2*Gn
  // Ys = 1.5*Rn + Gn - 1.5*Bn
  const Xs = new Array<number>(n);
  const Ys = new Array<number>(n);

  for (let i = 0; i < n; i++) {
    Xs[i] = 3.0 * Rn[i] - 2.0 * Gn[i];
    Ys[i] = 1.5 * Rn[i] + Gn[i] - 1.5 * Bn[i];
  }

  // 3. Bandpass filter chrominance components
  const coeffs = designButterworthBandpass(lowCutoffHz, highCutoffHz, fps);
  const Xf = filtfiltButterworth(Xs, coeffs);
  const Yf = filtfiltButterworth(Ys, coeffs);

  // 4. Calculate adaptive scaling ratio alpha = std(Xf) / std(Yf)
  const stdX = standardDeviation(Xf);
  const stdY = standardDeviation(Yf);
  const alpha = stdY > 1e-6 ? stdX / stdY : 0;

  // 5. Synthesize pulse signal S = Xf - alpha * Yf
  const pulse = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    pulse[i] = Xf[i] - alpha * Yf[i];
  }

  return pulse;
}
