/**
 * @aegispulse/rppg - End-to-End Contactless Sensing Pipeline
 * 12-stage optical processing pipeline delivering SignalMeasurement
 */

import type {
  SignalMeasurement,
  RgbTimeSeries,
  VideoFrameRoi,
  PipelineConfig,
  RppgAlgorithmType,
  SignalQualityStatus,
} from '../types';
import { extractPulseGreen } from '../algorithms/green';
import { extractPulseChrom } from '../algorithms/chrom';
import { extractPulsePos } from '../algorithms/pos';
import {
  designButterworthBandpass,
  filtfiltButterworth,
  normalizeZeroMeanUnitVariance,
} from '../signal-processing/filter';
import { computePsd, analyzeSpectrumBand } from '../signal-processing/fft';

export const DEFAULT_PIPELINE_CONFIG: Required<PipelineConfig> = {
  fps: 30,
  windowDurationSeconds: 8.0,       // 8-second sliding temporal window
  minHeartRateBpm: 42,              // 0.7 Hz
  maxHeartRateBpm: 210,             // 3.5 Hz
  minRespRateBpm: 8,                // ~0.133 Hz
  maxRespRateBpm: 36,               // 0.6 Hz
  snrValidThresholdDb: 3.0,         // Minimum SNR for VALID status
  snrDegradedThresholdDb: 0.5,      // Below 0.5 dB is considered UNUSABLE
  motionArtifactThreshold: 0.25,     // Normalized motion magnitude threshold
};

export class RppgPipeline {
  private readonly config: Required<PipelineConfig>;

  constructor(customConfig: PipelineConfig = {}) {
    this.config = { ...DEFAULT_PIPELINE_CONFIG, ...customConfig };
  }

  /**
   * Processes a temporal RGB time series extracted from facial skin ROIs.
   * NOTE: Video frames are NEVER stored. Only the spatially averaged RGB curves are consumed.
   */
  public processRgbSeries(
    series: RgbTimeSeries,
    algorithm: RppgAlgorithmType = 'POS',
    motionMagnitude = 0.05,
    illuminationScore = 0.95
  ): SignalMeasurement {
    const fps = series.fps || this.config.fps;
    const n = Math.min(series.r.length, series.g.length, series.b.length);
    const minSamplesRequired = Math.floor(fps * 2.5); // Minimum 2.5 seconds required for frequency resolution

    const timestamp = series.timestampsMs.length > 0
      ? series.timestampsMs[series.timestampsMs.length - 1]
      : Date.now();

    if (n < minSamplesRequired) {
      return this.buildEmptyMeasurement(timestamp, algorithm, 'UNUSABLE', 'Insufficient samples for FFT analysis');
    }

    // 1. Motion artifact gating
    const motionDetected = motionMagnitude > this.config.motionArtifactThreshold;

    // 2. Pulse Signal Extraction (GREEN, CHROM, POS)
    let pulseSignal: number[];
    switch (algorithm) {
      case 'GREEN':
        pulseSignal = extractPulseGreen(series.g, {
          fps,
          lowCutoffHz: this.config.minHeartRateBpm / 60,
          highCutoffHz: this.config.maxHeartRateBpm / 60,
        });
        break;
      case 'CHROM':
        pulseSignal = extractPulseChrom(series.r, series.g, series.b, {
          fps,
          lowCutoffHz: this.config.minHeartRateBpm / 60,
          highCutoffHz: this.config.maxHeartRateBpm / 60,
        });
        break;
      case 'POS':
      default:
        pulseSignal = extractPulsePos(series.r, series.g, series.b, {
          fps,
          lowCutoffHz: this.config.minHeartRateBpm / 60,
          highCutoffHz: this.config.maxHeartRateBpm / 60,
        });
        break;
    }

    // 3. Heart Rate Estimation via Windowed PSD
    const cardiacPsd = computePsd(pulseSignal, fps, 4);
    const cardiacAnalysis = analyzeSpectrumBand(
      cardiacPsd.frequencies,
      cardiacPsd.power,
      this.config.minHeartRateBpm / 60,
      this.config.maxHeartRateBpm / 60
    );

    const estimatedHrBpm = Math.round(cardiacAnalysis.dominantBpm * 10) / 10;
    const snrDb = cardiacAnalysis.snrDb;

    // 4. Respiratory Rate Estimation where defensible (Respiratory Sinus Arrhythmia / Baseline wander)
    let estimatedRrBpm: number | undefined;
    let respFreqHz: number | undefined;

    // Respiration extracted from baseline modulation of Green channel
    if (series.g.length >= Math.floor(fps * 6.0)) {
      const respBandCoeffs = designButterworthBandpass(
        this.config.minRespRateBpm / 60,
        this.config.maxRespRateBpm / 60,
        fps
      );
      const normG = normalizeZeroMeanUnitVariance(series.g);
      const respSignal = filtfiltButterworth(normG, respBandCoeffs);
      const respPsd = computePsd(respSignal, fps, 4);
      const respAnalysis = analyzeSpectrumBand(
        respPsd.frequencies,
        respPsd.power,
        this.config.minRespRateBpm / 60,
        this.config.maxRespRateBpm / 60,
        0.05
      );

      // Defensible check: only report RR if respiratory spectrum exhibits clear peak above baseline
      if (respAnalysis.snrDb > -2.0) {
        estimatedRrBpm = Math.round(respAnalysis.dominantBpm * 10) / 10;
        respFreqHz = respAnalysis.dominantFrequencyHz;
      }
    }

    // 5. Signal Quality Index (SQI) & Confidence Calculation
    let sqiScore = Math.max(0, Math.min(100, (snrDb + 5.0) * 8.0));
    if (motionDetected) {
      sqiScore *= Math.max(0.1, 1.0 - motionMagnitude);
    }
    sqiScore = Math.round(sqiScore);

    // Confidence strictly bounded in [0.0, 1.0]
    let confidence = sqiScore / 100;
    if (illuminationScore < 0.5) {
      confidence *= illuminationScore * 2.0;
    }
    confidence = Math.max(0.0, Math.min(1.0, Math.round(confidence * 100) / 100));

    // 6. Gating Status Determination
    let status: SignalQualityStatus;
    if (motionMagnitude > 0.6 || snrDb < this.config.snrDegradedThresholdDb || confidence < 0.25) {
      status = 'UNUSABLE';
    } else if (motionDetected || snrDb < this.config.snrValidThresholdDb || confidence < 0.60) {
      status = 'DEGRADED';
    } else {
      status = 'VALID';
    }

    return {
      heartRate: status === 'UNUSABLE' ? 0 : estimatedHrBpm,
      respiratoryRate: status === 'UNUSABLE' ? undefined : estimatedRrBpm,
      signalQuality: {
        snrDb,
        sqiScore,
        motionDetected,
        motionMagnitude,
        illuminationAdequate: illuminationScore >= 0.5,
        illuminationScore,
      },
      confidence,
      status,
      timestamp,
      source: 'OPTICAL_RPPG',
      algorithm,
      metadata: {
        fps,
        windowSeconds: n / fps,
        dominantFrequencyHz: cardiacAnalysis.dominantFrequencyHz,
        respiratoryFrequencyHz: respFreqHz,
        rawSnrDb: snrDb,
        disclaimer:
          'Investigational contactless rPPG research module. Not calibrated for diagnostic or standalone clinical triage without bedside contact validation.',
      },
    };
  }

  /**
   * Aggregates sequential frame ROI detections (forehead, cheeks) into RGB time series.
   * Masks out ocular and oral regions. Does NOT store raw pixel matrices.
   */
  public aggregateFrameRois(rois: VideoFrameRoi[], fps: number): RgbTimeSeries {
    const timestampsMs: number[] = [];
    const r: number[] = [];
    const g: number[] = [];
    const b: number[] = [];

    for (const roi of rois) {
      // Only include frames where face tracking was retained and skin percentage is viable
      if (roi.skinFraction > 0.40) {
        timestampsMs.push(roi.timestampMs);
        r.push(roi.meanR);
        g.push(roi.meanG);
        b.push(roi.meanB);
      }
    }

    return { fps, timestampsMs, r, g, b };
  }

  private buildEmptyMeasurement(
    timestamp: number,
    algorithm: RppgAlgorithmType,
    status: SignalQualityStatus,
    reason: string
  ): SignalMeasurement {
    return {
      heartRate: 0,
      signalQuality: {
        snrDb: -20,
        sqiScore: 0,
        motionDetected: false,
        motionMagnitude: 0,
        illuminationAdequate: false,
        illuminationScore: 0,
      },
      confidence: 0,
      status,
      timestamp,
      source: 'OPTICAL_RPPG',
      algorithm,
      metadata: {
        fps: this.config.fps,
        windowSeconds: 0,
        dominantFrequencyHz: 0,
        rawSnrDb: -20,
        disclaimer: `Investigational research output. Gated: ${reason}`,
      },
    };
  }
}
