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
  SignalQualityMetrics,
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

export interface ProcessRgbOptions {
  algorithm?: RppgAlgorithmType;
  motionMagnitude?: number;
  illuminationScore?: number;
  illuminationLux?: number;
  faceDetected?: boolean;
  skinFraction?: number;
  isCalibrating?: boolean;
  roiInstability?: number;
  frameDropRate?: number;
  talkingDetected?: boolean;
  headRotationDetected?: boolean;
  rapidBrightnessChange?: boolean;
  cameraDisconnected?: boolean;
  permissionDenied?: boolean;
}

function computeStdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((acc, val) => acc + (val - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

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
    algorithmOrOptions: RppgAlgorithmType | ProcessRgbOptions = 'POS',
    motionMagnitudeArg?: number,
    illuminationScoreArg?: number
  ): SignalMeasurement {
    let algorithm: RppgAlgorithmType = 'POS';
    let motionMagnitude = 0.05;
    let illuminationScore = 0.95;
    let illuminationLux = 240;
    let faceDetected = true;
    let skinFraction = 0.85;
    let isCalibrating = false;
    let roiInstability = 0.0;
    let frameDropRate = 0.0;
    let talkingDetected = false;
    let headRotationDetected = false;
    let rapidBrightnessChange = false;
    let cameraDisconnected = false;
    let permissionDenied = false;

    if (typeof algorithmOrOptions === 'object' && algorithmOrOptions !== null) {
      algorithm = algorithmOrOptions.algorithm ?? 'POS';
      motionMagnitude = algorithmOrOptions.motionMagnitude ?? 0.05;
      illuminationScore = algorithmOrOptions.illuminationScore ?? 0.95;
      illuminationLux = algorithmOrOptions.illuminationLux ?? Math.round(illuminationScore * 400);
      faceDetected = algorithmOrOptions.faceDetected ?? true;
      skinFraction = algorithmOrOptions.skinFraction ?? 0.85;
      isCalibrating = algorithmOrOptions.isCalibrating ?? false;
      roiInstability = algorithmOrOptions.roiInstability ?? 0.0;
      frameDropRate = algorithmOrOptions.frameDropRate ?? 0.0;
      talkingDetected = algorithmOrOptions.talkingDetected ?? false;
      headRotationDetected = algorithmOrOptions.headRotationDetected ?? false;
      rapidBrightnessChange = algorithmOrOptions.rapidBrightnessChange ?? false;
      cameraDisconnected = algorithmOrOptions.cameraDisconnected ?? false;
      permissionDenied = algorithmOrOptions.permissionDenied ?? false;
    } else if (typeof algorithmOrOptions === 'string') {
      algorithm = algorithmOrOptions;
      if (motionMagnitudeArg !== undefined) motionMagnitude = motionMagnitudeArg;
      if (illuminationScoreArg !== undefined) {
        illuminationScore = illuminationScoreArg;
        illuminationLux = Math.round(illuminationScore * 400);
      }
    }

    const fps = series.fps || this.config.fps;
    const n = Math.min(series.r.length, series.g.length, series.b.length);
    const minSamplesRequired = Math.floor(fps * 2.5); // Minimum 2.5 seconds required for frequency resolution

    const timestamp = series.timestampsMs.length > 0
      ? series.timestampsMs[series.timestampsMs.length - 1]
      : Date.now();

    // 1. Camera Permission Denied
    if (permissionDenied) {
      return this.buildEmptyMeasurement(
        timestamp,
        algorithm,
        'LOW_CONFIDENCE',
        'Camera permission denied by user or browser security policy',
        { illuminationLux: 0, faceDetected: false, motionMagnitude: 0 }
      );
    }

    // 2. Camera Disconnected
    if (cameraDisconnected) {
      return this.buildEmptyMeasurement(
        timestamp,
        algorithm,
        'LOW_CONFIDENCE',
        'Camera hardware disconnected or video track closed',
        { illuminationLux: 0, faceDetected: false, motionMagnitude: 0 }
      );
    }

    // 3. No Face Detected
    if (faceDetected === false || skinFraction === 0) {
      return this.buildEmptyMeasurement(
        timestamp,
        algorithm,
        'NO_FACE',
        'No face detected in camera field of view',
        { illuminationLux, faceDetected: false, skinFraction: 0, motionMagnitude }
      );
    }

    // 4. Face Partially Occluded
    if (skinFraction < 0.40) {
      return this.buildEmptyMeasurement(
        timestamp,
        algorithm,
        'LOW_CONFIDENCE',
        'Face partially occluded (viable skin fraction below 40%)',
        { illuminationLux, faceDetected: true, skinFraction, motionMagnitude }
      );
    }

    // 5. Insufficient Ambient Light (< 30 Lux)
    if (illuminationScore < 0.25 || illuminationLux < 30) {
      return this.buildEmptyMeasurement(
        timestamp,
        algorithm,
        'INSUFFICIENT_LIGHT',
        `Ambient illuminance (${illuminationLux} lux) below 30 lux threshold`,
        { illuminationLux, faceDetected: true, skinFraction, motionMagnitude }
      );
    }

    // 6. Calibrating Window (< 2.5s of samples or explicit calibration)
    if (isCalibrating || n < minSamplesRequired) {
      return this.buildEmptyMeasurement(
        timestamp,
        algorithm,
        'CALIBRATING',
        'Accumulating buffer frames for FFT spectral resolution',
        { illuminationLux, faceDetected: true, skinFraction, motionMagnitude }
      );
    }

    // 7. Low Frame Rate (Nyquist violation)
    if (fps < 16) {
      return this.buildEmptyMeasurement(
        timestamp,
        algorithm,
        'LOW_CONFIDENCE',
        `Camera frame rate (${fps} FPS) below 16 FPS minimum Nyquist bound`,
        { illuminationLux, faceDetected: true, effectiveFps: fps, motionMagnitude }
      );
    }

    // 8. Timestamp Jitter & Dropped Frames
    if (frameDropRate > 0.20) {
      return this.buildEmptyMeasurement(
        timestamp,
        algorithm,
        'LOW_CONFIDENCE',
        `High frame drop rate (${Math.round(frameDropRate * 100)}%) exceeding tolerance`,
        { illuminationLux, faceDetected: true, frameDropRate, motionMagnitude }
      );
    }

    if (series.timestampsMs.length >= 4) {
      let largeGaps = 0;
      const expectedDelta = 1000 / fps;
      for (let i = 1; i < series.timestampsMs.length; i++) {
        const delta = series.timestampsMs[i] - series.timestampsMs[i - 1];
        if (delta > expectedDelta * 2.5) {
          largeGaps++;
        }
      }
      if (largeGaps / series.timestampsMs.length > 0.15) {
        return this.buildEmptyMeasurement(
          timestamp,
          algorithm,
          'LOW_CONFIDENCE',
          'Intermittent frame timestamp jitter or packet drops',
          { illuminationLux, faceDetected: true, motionMagnitude }
        );
      }
    }

    // 9. Signal Dropout (Flatline / Sensor Failure)
    const stdR = computeStdDev(series.r);
    const stdG = computeStdDev(series.g);
    const stdB = computeStdDev(series.b);
    if (stdR < 0.001 && stdG < 0.001 && stdB < 0.001) {
      return this.buildEmptyMeasurement(
        timestamp,
        algorithm,
        'LOW_CONFIDENCE',
        'Optical signal dropout (flatline zero channel variance)',
        { illuminationLux, faceDetected: true, motionMagnitude: 0 }
      );
    }

    // 10. Rapid Brightness Change / Flash
    if (rapidBrightnessChange) {
      return this.buildEmptyMeasurement(
        timestamp,
        algorithm,
        'LOW_CONFIDENCE',
        'Rapid ambient brightness step-change detected in sliding window',
        { illuminationLux, faceDetected: true, motionMagnitude }
      );
    }

    // 11. Motion Contamination Check
    const isExplicitMotionFailure =
      typeof algorithmOrOptions === 'object' &&
      (motionMagnitude > this.config.motionArtifactThreshold ||
        headRotationDetected ||
        talkingDetected ||
        roiInstability > 0.15);

    if (isExplicitMotionFailure) {
      const reason = talkingDetected
        ? 'Mandibular speech motion artifact detected'
        : headRotationDetected
          ? 'Head rotation and angular specular reflection shift detected'
          : roiInstability > 0.15
            ? 'ROI tracking displacement / bounding box instability'
            : 'Subject motion artifact detected';

      return this.buildEmptyMeasurement(
        timestamp,
        algorithm,
        'MOTION_CONTAMINATED',
        reason,
        { illuminationLux, faceDetected: true, skinFraction, motionMagnitude }
      );
    }

    if (typeof algorithmOrOptions === 'string' && motionMagnitude > 0.6) {
      return this.buildEmptyMeasurement(
        timestamp,
        algorithm,
        'UNUSABLE',
        'Gross motion artifact exceeding 0.60 threshold',
        { illuminationLux, faceDetected: true, skinFraction, motionMagnitude }
      );
    }

    // 12. Pulse Signal Extraction (GREEN, CHROM, POS)
    // Pass broad clinical window for operational audit so out-of-band frequencies are detectable; standard cardiac band for benchmark algorithms
    const isOperationalPipeline = typeof algorithmOrOptions === 'object';
    const filterLowHz = isOperationalPipeline
      ? Math.min(0.35, this.config.minHeartRateBpm / 60)
      : this.config.minHeartRateBpm / 60;
    const filterHighHz = isOperationalPipeline
      ? Math.max(4.5, this.config.maxHeartRateBpm / 60)
      : this.config.maxHeartRateBpm / 60;

    let pulseSignal: number[];
    switch (algorithm) {
      case 'GREEN':
        pulseSignal = extractPulseGreen(series.g, {
          fps,
          lowCutoffHz: filterLowHz,
          highCutoffHz: filterHighHz,
        });
        break;
      case 'CHROM':
        pulseSignal = extractPulseChrom(series.r, series.g, series.b, {
          fps,
          lowCutoffHz: filterLowHz,
          highCutoffHz: filterHighHz,
        });
        break;
      case 'POS':
      default:
        pulseSignal = extractPulsePos(series.r, series.g, series.b, {
          fps,
          lowCutoffHz: filterLowHz,
          highCutoffHz: filterHighHz,
        });
        break;
    }

    // 13. Heart Rate Estimation via Windowed PSD
    const cardiacPsd = computePsd(pulseSignal, fps, 4);

    // Broad spectrum analysis (15 to 270 BPM) to detect out-of-band implausibilities
    const broadAnalysis = analyzeSpectrumBand(
      cardiacPsd.frequencies,
      cardiacPsd.power,
      0.25, // 15 BPM
      4.5   // 270 BPM
    );

    const cardiacAnalysis = analyzeSpectrumBand(
      cardiacPsd.frequencies,
      cardiacPsd.power,
      this.config.minHeartRateBpm / 60,
      this.config.maxHeartRateBpm / 60
    );

    const estimatedHrBpm = Math.round(cardiacAnalysis.dominantBpm * 10) / 10;
    const snrDb = cardiacAnalysis.snrDb;

    // 14. Physiological Plausibility Verification
    const broadDominantBpm = Math.round(broadAnalysis.dominantBpm * 10) / 10;
    const isBroadImplausible =
      (broadDominantBpm < this.config.minHeartRateBpm || broadDominantBpm > this.config.maxHeartRateBpm) &&
      (broadAnalysis.peakPower > 1.3 * cardiacAnalysis.peakPower || cardiacAnalysis.snrDb < 1.0);

    const isPhysiologicallyPlausible =
      !isBroadImplausible &&
      estimatedHrBpm >= this.config.minHeartRateBpm &&
      estimatedHrBpm <= this.config.maxHeartRateBpm;

    if (!isPhysiologicallyPlausible) {
      const implausibleBpm = isBroadImplausible ? broadDominantBpm : estimatedHrBpm;
      return this.buildEmptyMeasurement(
        timestamp,
        algorithm,
        'PHYSIOLOGICALLY_IMPLAUSIBLE',
        `Dominant frequency (${implausibleBpm} BPM) falls outside biological limits (42-210 BPM)`,
        {
          snrDb: broadAnalysis.snrDb,
          illuminationLux,
          faceDetected: true,
          motionMagnitude,
          isPhysiologicallyPlausible: false,
        }
      );
    }

    // 15. Respiratory Rate Estimation where defensible
    let estimatedRrBpm: number | undefined;
    let respFreqHz: number | undefined;

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

      if (respAnalysis.snrDb > -2.0) {
        estimatedRrBpm = Math.round(respAnalysis.dominantBpm * 10) / 10;
        respFreqHz = respAnalysis.dominantFrequencyHz;
      }
    }

    // 16. Signal Quality Index (SQI) & Confidence Calculation
    let sqiScore = Math.max(0, Math.min(100, (snrDb + 5.0) * 8.0));
    sqiScore = Math.round(sqiScore);

    let confidence = sqiScore / 100;
    if (illuminationScore < 0.5) {
      confidence *= illuminationScore * 2.0;
    }
    confidence = Math.max(0.0, Math.min(1.0, Math.round(confidence * 100) / 100));

    // 17. Quality Floor & Status Assessment
    const motionDetected = motionMagnitude > this.config.motionArtifactThreshold;

    let status: SignalQualityStatus;
    if (typeof algorithmOrOptions === 'object') {
      if (motionDetected) {
        status = 'MOTION_CONTAMINATED';
      } else if (snrDb < this.config.snrDegradedThresholdDb || confidence < 0.25) {
        status = 'LOW_CONFIDENCE';
      } else if (snrDb < this.config.snrValidThresholdDb || confidence < 0.60) {
        status = 'LOW_CONFIDENCE';
      } else {
        status = 'VALID';
      }
    } else {
      // Legacy benchmark classification
      if (motionMagnitude > 0.6 || snrDb < this.config.snrDegradedThresholdDb || confidence < 0.25) {
        status = 'UNUSABLE';
      } else if (motionDetected || snrDb < this.config.snrValidThresholdDb || confidence < 0.60) {
        status = 'DEGRADED';
      } else {
        status = 'VALID';
      }
    }

    const isSuppressed = status === 'UNUSABLE' || (typeof algorithmOrOptions === 'object' && status !== 'VALID');
    return {
      heartRate: isSuppressed ? 0 : estimatedHrBpm,
      respiratoryRate: isSuppressed ? undefined : estimatedRrBpm,
      signalQuality: {
        snrDb,
        sqiScore,
        motionDetected,
        motionMagnitude,
        illuminationAdequate: illuminationLux >= 30,
        illuminationScore,
        faceDetected: true,
        skinFraction,
        effectiveFps: fps,
        frameDropRate,
        isPhysiologicallyPlausible: true,
        stateReason: status === 'VALID' ? 'Valid photoplethysmographic signal within biological bounds' : `Quality status: ${status}`,
      },
      confidence: isSuppressed && status !== 'DEGRADED' ? Math.min(0.25, confidence) : confidence,
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
      if (roi.skinFraction > 0.40 && roi.faceDetected !== false) {
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
    reason: string,
    extraMetrics?: Partial<SignalQualityMetrics>
  ): SignalMeasurement {
    const lux = extraMetrics?.illuminationLux ?? 0;
    return {
      heartRate: 0,
      signalQuality: {
        snrDb: extraMetrics?.snrDb ?? -20,
        sqiScore: 0,
        motionDetected: (extraMetrics?.motionMagnitude ?? 0) > 0.25,
        motionMagnitude: extraMetrics?.motionMagnitude ?? 0,
        illuminationAdequate: lux >= 30,
        illuminationScore: Math.min(1.0, lux / 400),
        faceDetected: extraMetrics?.faceDetected ?? false,
        skinFraction: extraMetrics?.skinFraction ?? 0,
        effectiveFps: extraMetrics?.effectiveFps ?? this.config.fps,
        frameDropRate: extraMetrics?.frameDropRate ?? 0,
        isPhysiologicallyPlausible: extraMetrics?.isPhysiologicallyPlausible ?? true,
        stateReason: reason,
      },
      confidence: status === 'CALIBRATING' ? 0.10 : status === 'LOW_CONFIDENCE' ? 0.15 : 0.0,
      status,
      timestamp,
      source: 'OPTICAL_RPPG',
      algorithm,
      metadata: {
        fps: this.config.fps,
        windowSeconds: 0,
        dominantFrequencyHz: 0,
        rawSnrDb: extraMetrics?.snrDb ?? -20,
        disclaimer: `Investigational research output. Gated [${status}]: ${reason}`,
      },
    };
  }
}
