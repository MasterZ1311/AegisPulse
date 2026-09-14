/**
 * @aegispulse/rppg - Synthetic Dataset Generator for Benchmarking
 * Generates photophysiologically grounded RGB time series without recording or storing raw video.
 */

import type { RgbTimeSeries } from '../types';

export interface SyntheticDatasetParams {
  fps?: number;
  durationSeconds?: number;
  targetHeartRateBpm: number;
  targetRespRateBpm?: number;
  motionIntensity?: number;    // 0.0 (still) to 1.0 (heavy motion)
  snrAdditiveNoise?: number;   // Noise standard deviation (e.g. 0.05)
  skinTone?: 'LIGHT' | 'MEDIUM' | 'DARK';
  randomSeed?: number;
}

export function generateSyntheticRgbSeries(params: SyntheticDatasetParams): {
  series: RgbTimeSeries;
  groundTruthHr: number;
  groundTruthRr?: number;
} {
  const {
    fps = 30,
    durationSeconds = 12.0,
    targetHeartRateBpm,
    targetRespRateBpm = 16,
    motionIntensity = 0.0,
    snrAdditiveNoise = 0.02,
    skinTone = 'MEDIUM',
    randomSeed,
  } = params;

  const rand = randomSeed !== undefined ? createPrng(randomSeed) : Math.random;

  const totalFrames = Math.floor(fps * durationSeconds);
  const timestampsMs = new Array<number>(totalFrames);
  const r = new Array<number>(totalFrames);
  const g = new Array<number>(totalFrames);
  const b = new Array<number>(totalFrames);

  // Baseline skin reflectances (diffuse reflection vector)
  let baseR = 175;
  let baseG = 135;
  let baseB = 105;
  if (skinTone === 'LIGHT') {
    baseR = 210;
    baseG = 165;
    baseB = 140;
  } else if (skinTone === 'DARK') {
    baseR = 125;
    baseG = 90;
    baseB = 70;
  }

  const fCardiac = targetHeartRateBpm / 60;
  const fResp = targetRespRateBpm / 60;

  for (let i = 0; i < totalFrames; i++) {
    const t = i / fps;
    timestampsMs[i] = Math.round(t * 1000);

    // 1. Cardiac pulsatile arterial pulse waveform (dicrotic notch + 2nd harmonic)
    const cardiacWave =
      Math.sin(2 * Math.PI * fCardiac * t) +
      0.35 * Math.sin(4 * Math.PI * fCardiac * t + 0.4);

    // Green channel exhibits the highest photoplethysmographic absorption contrast (~1.5% amplitude)
    const ppgG = -0.015 * cardiacWave;
    // Red has approximately 33% of green absorption amplitude
    const ppgR = -0.005 * cardiacWave;
    // Blue has approximately 15% of green amplitude
    const ppgB = -0.002 * cardiacWave;

    // 2. Respiratory sinus arrhythmia and thoracic baseline drift (~0.4% amplitude)
    const respWave = 0.005 * Math.sin(2 * Math.PI * fResp * t);

    // 3. Specular motion artifact along illuminant vector [1, 1, 1]
    // Under head motion or tilt, specular surface reflection changes dynamically.
    // Specular reflection adds neutral white illuminant light, corrupting raw Green,
    // but canceled by skin-orthogonal projection in CHROM and POS.
    let specularNoise = 0;
    if (motionIntensity > 0) {
      // In-band rhythmic head motion (1.35 Hz / 81 bpm) + slow postural drift (0.3 Hz)
      specularNoise =
        motionIntensity * 12.0 * Math.sin(2 * Math.PI * 0.3 * t) +
        motionIntensity * 10.0 * Math.sin(2 * Math.PI * 1.35 * t + 0.5);
    }

    // 4. Gaussian sensor noise
    const noiseR = (rand() - 0.5) * 2 * snrAdditiveNoise * baseR;
    const noiseG = (rand() - 0.5) * 2 * snrAdditiveNoise * baseG;
    const noiseB = (rand() - 0.5) * 2 * snrAdditiveNoise * baseB;

    r[i] = baseR * (1.0 + ppgR + respWave) + specularNoise + noiseR;
    g[i] = baseG * (1.0 + ppgG + respWave) + specularNoise + noiseG;
    b[i] = baseB * (1.0 + ppgB + respWave) + specularNoise + noiseB;
  }

  return {
    series: { fps, timestampsMs, r, g, b },
    groundTruthHr: targetHeartRateBpm,
    groundTruthRr: targetRespRateBpm,
  };
}

function createPrng(seed: number) {
  let s = (seed % 2147483647) + 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
