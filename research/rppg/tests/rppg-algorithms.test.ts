import { describe, it, expect } from 'vitest';
import { extractPulseGreen } from '../src/algorithms/green';
import { extractPulseChrom } from '../src/algorithms/chrom';
import { extractPulsePos } from '../src/algorithms/pos';
import { generateSyntheticRgbSeries } from '../src/evaluation/synthetic-dataset';
import { computePsd, analyzeSpectrumBand } from '../src/signal-processing/fft';

describe('rPPG Optical Algorithms: GREEN, CHROM, POS', () => {
  const fps = 30;
  const targetHrBpm = 75; // 1.25 Hz

  const { series } = generateSyntheticRgbSeries({
    fps,
    durationSeconds: 10,
    targetHeartRateBpm: targetHrBpm,
    targetRespRateBpm: 15,
    motionIntensity: 0.0,
    snrAdditiveNoise: 0.01,
  });

  it('extracts cardiac pulse using GREEN channel method and detects 75 bpm peak', () => {
    const pulseGreen = extractPulseGreen(series.g, { fps });
    expect(pulseGreen.length).toBe(series.g.length);

    const psd = computePsd(pulseGreen, fps, 4);
    const analysis = analyzeSpectrumBand(psd.frequencies, psd.power, 0.7, 3.5);

    // Estimated HR should be within ±1.5 bpm of 75 bpm
    expect(Math.abs(analysis.dominantBpm - targetHrBpm)).toBeLessThanOrEqual(1.5);
    expect(analysis.snrDb).toBeGreaterThan(5.0); // Clean pulse has positive SNR
  });

  it('extracts cardiac pulse using CHROM method and detects 75 bpm peak', () => {
    const pulseChrom = extractPulseChrom(series.r, series.g, series.b, { fps });
    expect(pulseChrom.length).toBe(series.r.length);

    const psd = computePsd(pulseChrom, fps, 4);
    const analysis = analyzeSpectrumBand(psd.frequencies, psd.power, 0.7, 3.5);

    expect(Math.abs(analysis.dominantBpm - targetHrBpm)).toBeLessThanOrEqual(1.5);
    expect(analysis.snrDb).toBeGreaterThan(6.0);
  });

  it('extracts cardiac pulse using POS (Plane-Orthogonal-to-Skin) method and detects 75 bpm peak', () => {
    const pulsePos = extractPulsePos(series.r, series.g, series.b, { fps });
    expect(pulsePos.length).toBe(series.r.length);

    const psd = computePsd(pulsePos, fps, 4);
    const analysis = analyzeSpectrumBand(psd.frequencies, psd.power, 0.7, 3.5);

    expect(Math.abs(analysis.dominantBpm - targetHrBpm)).toBeLessThanOrEqual(1.5);
    expect(analysis.snrDb).toBeGreaterThan(6.5);
  });

  it('reconstructs elevated heart rates (120 bpm / 2.0 Hz) accurately across all three algorithms', () => {
    const highHrTarget = 120;
    const { series: highSeries } = generateSyntheticRgbSeries({
      fps,
      durationSeconds: 10,
      targetHeartRateBpm: highHrTarget,
      motionIntensity: 0.0,
      snrAdditiveNoise: 0.01,
    });

    const pulseG = extractPulseGreen(highSeries.g, { fps });
    const pulseC = extractPulseChrom(highSeries.r, highSeries.g, highSeries.b, { fps });
    const pulseP = extractPulsePos(highSeries.r, highSeries.g, highSeries.b, { fps });

    const psdG = computePsd(pulseG, fps, 4);
    const psdC = computePsd(pulseC, fps, 4);
    const psdP = computePsd(pulseP, fps, 4);

    const hrG = analyzeSpectrumBand(psdG.frequencies, psdG.power, 0.7, 3.5).dominantBpm;
    const hrC = analyzeSpectrumBand(psdC.frequencies, psdC.power, 0.7, 3.5).dominantBpm;
    const hrP = analyzeSpectrumBand(psdP.frequencies, psdP.power, 0.7, 3.5).dominantBpm;

    expect(Math.abs(hrG - highHrTarget)).toBeLessThanOrEqual(2.0);
    expect(Math.abs(hrC - highHrTarget)).toBeLessThanOrEqual(2.0);
    expect(Math.abs(hrP - highHrTarget)).toBeLessThanOrEqual(2.0);
  });
});
