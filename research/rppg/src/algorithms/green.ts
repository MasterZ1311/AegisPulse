/**
 * @aegispulse/rppg - GREEN Channel Pulse Signal Extraction
 * Reference: Verkruysse, W., Svaasand, L. O., & Nelson, J. S. (2008).
 * "Remote plethysmographic imaging using ambient light." Optics Express, 16(26), 21434-21445.
 */

import {
  normalizeZeroMeanUnitVariance,
  detrendMovingAverage,
  designButterworthBandpass,
  filtfiltButterworth,
} from '../signal-processing/filter';

export interface GreenExtractionOptions {
  fps?: number;
  detrendWindowSeconds?: number;
  lowCutoffHz?: number;
  highCutoffHz?: number;
}

/**
 * Extracts raw cardiac pulsatile signal from temporal Green channel
 * Oxygenated hemoglobin (HbO2) has an optical absorption peak between 500-600 nm,
 * making the green component responsive to subcutaneous volumetric pulse waves.
 */
export function extractPulseGreen(
  greenChannel: number[],
  options: GreenExtractionOptions = {}
): number[] {
  const {
    fps = 30,
    detrendWindowSeconds = 1.0,
    lowCutoffHz = 0.7,   // 42 bpm
    highCutoffHz = 3.5,  // 210 bpm
  } = options;

  if (greenChannel.length < 10) return greenChannel;

  // 1. Zero-mean unit-variance temporal normalization
  const normalized = normalizeZeroMeanUnitVariance(greenChannel);

  // 2. Detrending by moving average baseline subtraction
  const detrendWinSize = Math.max(5, Math.floor(fps * detrendWindowSeconds));
  const detrended = detrendMovingAverage(normalized, detrendWinSize);

  // 3. 2nd-order Butterworth zero-phase bandpass filtering in cardiac band [0.7, 3.5] Hz
  const coeffs = designButterworthBandpass(lowCutoffHz, highCutoffHz, fps);
  const pulse = filtfiltButterworth(detrended, coeffs);

  return pulse;
}
