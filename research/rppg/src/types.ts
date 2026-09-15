/**
 * @aegispulse/rppg - Types & Contracts
 * Contactless Sensing Research Module
 */

export type RppgAlgorithmType = 'GREEN' | 'CHROM' | 'POS';

export type ContactlessSensingState =
  | 'VALID'
  | 'LOW_CONFIDENCE'
  | 'CALIBRATING'
  | 'MOTION_CONTAMINATED'
  | 'INSUFFICIENT_LIGHT'
  | 'NO_FACE'
  | 'PHYSIOLOGICALLY_IMPLAUSIBLE';

export type SignalQualityStatus =
  | 'VALID'
  | 'DEGRADED'
  | 'SUPPRESSED'
  | 'UNUSABLE'
  | 'LOW_CONFIDENCE'
  | 'CALIBRATING'
  | 'MOTION_CONTAMINATED'
  | 'INSUFFICIENT_LIGHT'
  | 'NO_FACE'
  | 'PHYSIOLOGICALLY_IMPLAUSIBLE';

export interface SignalQualityMetrics {
  snrDb: number;                   // Signal-to-noise ratio in decibels
  sqiScore: number;                // 0 to 100 normalized quality score
  motionDetected: boolean;         // Motion flag exceeding threshold
  motionMagnitude: number;         // 0.0 (still) to 1.0 (violent motion)
  illuminationAdequate: boolean;   // Optical illumination adequate
  illuminationScore: number;       // Normalized lux adequacy (0.0 to 1.0)
  illuminationLux?: number;
  faceDetected?: boolean;
  skinFraction?: number;
  effectiveFps?: number;
  frameDropRate?: number;
  isPhysiologicallyPlausible?: boolean;
  stateReason?: string;
}

/**
 * Standard output contract required by AegisPulse specification
 */
export interface SignalMeasurement {
  heartRate: number;                                // Estimated heart rate in beats per minute (bpm)
  respiratoryRate?: number;                         // Estimated respiratory rate in breaths per minute (/min) where defensible
  signalQuality: SignalQualityMetrics;
  confidence: number;                               // Confidence bounded strictly in [0.0, 1.0]
  status: SignalQualityStatus;                      // Operational signal gating status
  timestamp: number;                                // Measurement Unix epoch milliseconds
  source: 'OPTICAL_RPPG';
  algorithm: RppgAlgorithmType;
  metadata?: {
    fps: number;
    windowSeconds: number;
    dominantFrequencyHz: number;
    respiratoryFrequencyHz?: number;
    rawSnrDb?: number;
    disclaimer: string;
  };
}

export interface RgbSample {
  timestampMs: number;
  r: number;
  g: number;
  b: number;
}

export interface RgbTimeSeries {
  fps: number;
  timestampsMs: number[];
  r: number[];
  g: number[];
  b: number[];
}

export interface VideoFrameRoi {
  frameIndex: number;
  timestampMs: number;
  // Bounding box: [x, y, width, height] in normalized coordinates [0.0, 1.0]
  boundingBox: [number, number, number, number];
  meanR: number;
  meanG: number;
  meanB: number;
  pixelCount: number;
  skinFraction: number; // 0.0 to 1.0 percentage of ROI identified as viable skin
  faceDetected?: boolean;
  motionMagnitude?: number;
  illuminationLux?: number;
}

export interface PipelineConfig {
  fps?: number;
  windowDurationSeconds?: number;      // Sliding analysis window (e.g. 8.0 seconds)
  minHeartRateBpm?: number;            // Lower physiological cardiac bound (default 42 bpm = 0.7 Hz)
  maxHeartRateBpm?: number;            // Upper physiological cardiac bound (default 210 bpm = 3.5 Hz)
  minRespRateBpm?: number;             // Lower respiratory bound (default 8 /min = 0.133 Hz)
  maxRespRateBpm?: number;             // Upper respiratory bound (default 36 /min = 0.6 Hz)
  snrValidThresholdDb?: number;        // Minimum SNR in dB for VALID status (default 3.0 dB)
  snrDegradedThresholdDb?: number;     // Minimum SNR for DEGRADED status (default 0.5 dB)
  motionArtifactThreshold?: number;    // Motion magnitude threshold (default 0.25)
}

export interface DatasetEvaluationSample {
  sampleId: string;
  groundTruthHeartRate: number;
  groundTruthRespRate?: number;
  estimatedMeasurement: SignalMeasurement;
  absoluteErrorHr: number;
  absoluteErrorRr?: number;
}

export interface AlgorithmBenchmarkReport {
  algorithm: RppgAlgorithmType;
  datasetName: string;
  totalSamples: number;
  validSamplesCount: number;
  yieldPercentage: number;             // Percentage of samples deemed usable
  meanAbsoluteErrorBpm: number;        // MAE in bpm
  rootMeanSquareErrorBpm: number;      // RMSE in bpm
  pearsonCorrelation: number;          // Correlation coefficient r
  meanSnrDb: number;
  meanConfidence: number;
  processingTimeMsTotal: number;
  fpsThroughput: number;
  disclaimer: string;
}
