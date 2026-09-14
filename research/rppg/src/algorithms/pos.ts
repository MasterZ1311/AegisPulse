/**
 * @aegispulse/rppg - POS (Plane-Orthogonal-to-Skin) Pulse Signal Extraction
 * Reference: Wang, W., den Brinker, A. C., Stuijk, S., & de Haan, G. (2017).
 * "Algorithmic principles of remote PPG." IEEE Transactions on Biomedical Engineering, 64(7), 1479-1491.
 */

import {
  mean,
  standardDeviation,
  designButterworthBandpass,
  filtfiltButterworth,
} from '../signal-processing/filter';

export interface PosExtractionOptions {
  fps?: number;
  windowDurationSeconds?: number; // Temporal window length L (default 1.6s)
  lowCutoffHz?: number;
  highCutoffHz?: number;
}

/**
 * Extracts pulsatile signal using the Plane-Orthogonal-to-Skin (POS) projection method.
 * Computes color normalization over sliding temporal sub-windows, projects onto two
 * skin-orthogonal chrominance axes (Px, Py), dynamically matches their amplitudes,
 * and overlaps-adds windowed pulses to achieve high motion robustness.
 */
export function extractPulsePos(
  rChannel: number[],
  gChannel: number[],
  bChannel: number[],
  options: PosExtractionOptions = {}
): number[] {
  const {
    fps = 30,
    windowDurationSeconds = 1.6,
    lowCutoffHz = 0.7,
    highCutoffHz = 3.5,
  } = options;

  const n = Math.min(rChannel.length, gChannel.length, bChannel.length);
  const winLength = Math.max(8, Math.floor(fps * windowDurationSeconds));

  if (n < winLength) {
    // If signal shorter than window, fallback to single-window projection
    return extractPulsePosSingleWindow(rChannel, gChannel, bChannel, fps, lowCutoffHz, highCutoffHz);
  }

  // Final integrated reconstructed pulse signal H
  const H = new Array<number>(n).fill(0);

  // Overlap-add across sliding sub-windows
  for (let m = 0; m <= n - winLength; m++) {
    const end = m + winLength;
    const rWin = rChannel.slice(m, end);
    const gWin = gChannel.slice(m, end);
    const bWin = bChannel.slice(m, end);

    const meanR = Math.max(1e-6, mean(rWin));
    const meanG = Math.max(1e-6, mean(gWin));
    const meanB = Math.max(1e-6, mean(bWin));

    const Px = new Array<number>(winLength);
    const Py = new Array<number>(winLength);

    for (let k = 0; k < winLength; k++) {
      const rn = rWin[k] / meanR;
      const gn = gWin[k] / meanG;
      const bn = bWin[k] / meanB;

      // P = [ 0, 1, -1; -2, 1, 1 ]
      Px[k] = gn - bn;
      Py[k] = -2.0 * rn + gn + bn;
    }

    // Dynamic amplitude matching: h = std(Px) / std(Py)
    const stdPx = standardDeviation(Px);
    const stdPy = standardDeviation(Py);
    const h = stdPy > 1e-6 ? stdPx / stdPy : 0;

    // Sub-window pulse S = Px + h * Py
    const S = new Array<number>(winLength);
    for (let k = 0; k < winLength; k++) {
      S[k] = Px[k] + h * Py[k];
    }

    // Demean sub-window pulse
    const meanS = mean(S);
    for (let k = 0; k < winLength; k++) {
      H[m + k] += S[k] - meanS;
    }
  }

  // 2nd-order Butterworth zero-phase bandpass filtering in cardiac band
  const coeffs = designButterworthBandpass(lowCutoffHz, highCutoffHz, fps);
  const filteredPulse = filtfiltButterworth(H, coeffs);

  return filteredPulse;
}

function extractPulsePosSingleWindow(
  rChannel: number[],
  gChannel: number[],
  bChannel: number[],
  fps: number,
  lowCutoffHz: number,
  highCutoffHz: number
): number[] {
  const n = Math.min(rChannel.length, gChannel.length, bChannel.length);
  if (n < 4) return new Array(n).fill(0);

  const meanR = Math.max(1e-6, mean(rChannel));
  const meanG = Math.max(1e-6, mean(gChannel));
  const meanB = Math.max(1e-6, mean(bChannel));

  const Px = new Array<number>(n);
  const Py = new Array<number>(n);

  for (let i = 0; i < n; i++) {
    const rn = rChannel[i] / meanR;
    const gn = gChannel[i] / meanG;
    const bn = bChannel[i] / meanB;
    Px[i] = gn - bn;
    Py[i] = -2.0 * rn + gn + bn;
  }

  const stdPx = standardDeviation(Px);
  const stdPy = standardDeviation(Py);
  const h = stdPy > 1e-6 ? stdPx / stdPy : 0;

  const S = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    S[i] = Px[i] + h * Py[i];
  }

  const coeffs = designButterworthBandpass(lowCutoffHz, highCutoffHz, fps);
  return filtfiltButterworth(S, coeffs);
}
