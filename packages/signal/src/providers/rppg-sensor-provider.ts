import type {
  SensorProvider,
  SensorReading,
  SensorStatus,
  SensorSource,
  Unsubscribe,
  SignalQuality,
  QualityStatus,
} from '@aegispulse/types';
import {
  RppgPipeline,
  type RgbTimeSeries,
  type VideoFrameRoi,
  type RppgAlgorithmType,
  type PipelineConfig,
} from '@aegispulse/rppg';

export interface RppgSensorProviderOptions {
  providerId?: string;
  source?: 'OPTICAL_RPPG' | 'WEBCAM';
  algorithm?: RppgAlgorithmType;
  minConfidenceThreshold?: number; // Minimum confidence to accept vitals (default 0.60)
  pipelineConfig?: PipelineConfig;
  defaultPatientId?: string;
  defaultBedId?: string;
}

/**
 * RPPGSensorProvider
 * Connects the contactless optical rPPG research subsystem to AegisPulse.
 * Transforms spatial RGB skin signals into validated SensorReadings.
 *
 * Strict Privacy Guarantee: Never accepts, processes, or stores raw video frames.
 * Strict Clinical Safety: When confidence is insufficient, NO vitals are fabricated.
 */
export class RppgSensorProvider implements SensorProvider {
  private readonly providerId: string;
  private readonly source: 'OPTICAL_RPPG' | 'WEBCAM';
  private readonly algorithm: RppgAlgorithmType;
  private readonly minConfidenceThreshold: number;
  private readonly pipeline: RppgPipeline;
  private readonly defaultPatientId: string;
  private readonly defaultBedId: string;

  private isStreaming = false;
  private lastReadingTimestamp?: number;
  private lastReading: Map<string, SensorReading> = new Map();
  private statusMessage = 'Optical camera ready';

  // Ring buffer of ROIs per patient (maximum 300 frames = 10s at 30fps)
  private roiBuffers: Map<string, VideoFrameRoi[]> = new Map();

  private readingListeners: Set<(reading: SensorReading) => void> = new Set();
  private statusListeners: Set<(status: SensorStatus) => void> = new Set();

  constructor(options: RppgSensorProviderOptions = {}) {
    this.providerId = options.providerId ?? 'rppg-optical-sensor';
    this.source = options.source ?? 'OPTICAL_RPPG';
    this.algorithm = options.algorithm ?? 'POS';
    this.minConfidenceThreshold = options.minConfidenceThreshold ?? 0.60;
    this.pipeline = new RppgPipeline(options.pipelineConfig);
    this.defaultPatientId = options.defaultPatientId ?? 'PAT-UNKNOWN';
    this.defaultBedId = options.defaultBedId ?? 'BED-UNKNOWN';
  }

  public getProviderId(): string {
    return this.providerId;
  }

  public getSource(): SensorSource {
    return this.source;
  }

  public getAlgorithm(): RppgAlgorithmType {
    return this.algorithm;
  }

  public getStatus(): SensorStatus {
    return {
      providerId: this.providerId,
      source: this.source,
      state: this.isStreaming ? 'STREAMING' : 'IDLE',
      connected: true,
      isStreaming: this.isStreaming,
      lastReadingTimestamp: this.lastReadingTimestamp,
      message: this.statusMessage,
      metadata: {
        algorithm: this.algorithm,
        minConfidenceThreshold: this.minConfidenceThreshold,
        bufferedPatientsCount: this.roiBuffers.size,
      },
    };
  }

  public onReading(callback: (reading: SensorReading) => void): Unsubscribe {
    this.readingListeners.add(callback);
    return () => this.readingListeners.delete(callback);
  }

  public onStatusChange(callback: (status: SensorStatus) => void): Unsubscribe {
    this.statusListeners.add(callback);
    return () => this.statusListeners.delete(callback);
  }

  private notifyStatus(message?: string): void {
    if (message) this.statusMessage = message;
    const status = this.getStatus();
    for (const listener of this.statusListeners) {
      try {
        listener(status);
      } catch (err) {
        console.error('Error in status listener:', err);
      }
    }
  }

  private notifyReading(reading: SensorReading): void {
    this.lastReadingTimestamp = reading.timestamp;
    this.lastReading.set(reading.patientId, reading);
    for (const listener of this.readingListeners) {
      try {
        listener(reading);
      } catch (err) {
        console.error('Error in reading listener:', err);
      }
    }
  }

  public start(): void {
    if (this.isStreaming) return;
    this.isStreaming = true;
    this.notifyStatus('Optical rPPG stream active');
  }

  public stop(): void {
    if (!this.isStreaming) return;
    this.isStreaming = false;
    this.notifyStatus('Optical rPPG stream stopped');
  }

  /**
   * Ingests a privacy-safe face ROI measurement (spatially averaged RGB).
   * Automatically slides temporal window and evaluates vital estimates when buffer is sufficient.
   */
  public pushFrameRoi(
    roi: VideoFrameRoi,
    patientId: string = this.defaultPatientId,
    bedId: string = this.defaultBedId,
    fps = 30
  ): SensorReading | null {
    // 1. Guard against accidental raw video or frame buffers
    const roiKeys = Object.keys(roi);
    for (const key of roiKeys) {
      if (['video', 'rawFrame', 'pixels', 'buffer', 'imageData'].includes(key)) {
        throw new Error(
          `PRIVACY VIOLATION: Raw image data key '${key}' detected in ROI. Only spatial mean RGB values are permitted.`
        );
      }
    }

    // Strict Invariant: If ROI skinFraction is below viable threshold (< 0.30), face was lost or occluded
    if (roi.skinFraction < 0.30) {
      this.clearBuffer(patientId);
      return this.invalidatePatient(
        patientId,
        bedId,
        'Face ROI skinFraction below threshold (face lost or occluded)'
      );
    }

    let buffer = this.roiBuffers.get(patientId);
    if (!buffer) {
      buffer = [];
      this.roiBuffers.set(patientId, buffer);
    }

    buffer.push(roi);
    // Keep max 10 seconds of history at 30 fps
    if (buffer.length > fps * 10) {
      buffer.shift();
    }

    // Evaluate once we have at least 3 seconds of continuous signal
    if (buffer.length >= fps * 3) {
      const rgbSeries = this.pipeline.aggregateFrameRois(buffer, fps);
      return this.processRgbSeries(rgbSeries, patientId, bedId);
    }

    return null;
  }

  /**
   * Processes an RGB time-series directly and produces a SensorReading.
   */
  public processRgbSeries(
    series: RgbTimeSeries,
    patientId: string = this.defaultPatientId,
    bedId: string = this.defaultBedId,
    motionMagnitude = 0.05,
    illuminationScore = 0.95
  ): SensorReading {
    const rawMeasurement = this.pipeline.processRgbSeries(
      series,
      this.algorithm,
      motionMagnitude,
      illuminationScore
    );

    const timestamp = rawMeasurement.timestamp;
    const confidence = rawMeasurement.confidence;
    const snrDb = rawMeasurement.signalQuality.snrDb;
    const sqiScore = rawMeasurement.signalQuality.sqiScore;
    const motionDetected = rawMeasurement.signalQuality.motionDetected;

    // Quality state mapping
    let qualityState: QualityStatus;
    if (rawMeasurement.status === 'VALID' && confidence >= this.minConfidenceThreshold) {
      qualityState = 'TRUSTED';
    } else if (rawMeasurement.status === 'DEGRADED') {
      qualityState = 'DEGRADED';
    } else {
      qualityState = 'UNRELIABLE';
    }

    const signalQuality: SignalQuality = {
      sqiPercentage: sqiScore,
      snrDb,
      illuminationLux: Math.round(illuminationScore * 400),
      motionArtifactIndex: rawMeasurement.signalQuality.motionMagnitude,
      state: qualityState,
      isUsable: rawMeasurement.status === 'VALID' && confidence >= this.minConfidenceThreshold,
      faceDetected: true,
      reason: motionDetected
        ? 'Subject motion artifact detected'
        : snrDb < 1.0
          ? 'Optical signal-to-noise ratio below viable threshold'
          : undefined,
    };

    // Strict Invariant: If confidence is insufficient, emit LOW_CONFIDENCE with zero fabrication
    const isConfidenceInsufficient =
      confidence < this.minConfidenceThreshold ||
      rawMeasurement.status === 'UNUSABLE' ||
      rawMeasurement.status === 'SUPPRESSED' ||
      motionDetected ||
      snrDb < 1.0;

    let reading: SensorReading;

    if (isConfidenceInsufficient) {
      reading = {
        id: `sr-rppg-${patientId}-${timestamp}`,
        patientId,
        bedId,
        source: this.source,
        timestamp,
        confidence,
        signalQuality: {
          ...signalQuality,
          state: qualityState === 'TRUSTED' ? 'DEGRADED' : qualityState,
          isUsable: false,
          reason: signalQuality.reason ?? 'Insufficient optical confidence for cardiac extraction',
        },
        measurementStatus: 'LOW_CONFIDENCE',
        measurement_status: 'LOW_CONFIDENCE',
        // DO NOT FABRICATE PHYSIOLOGICAL MEASUREMENTS
        heartRate: undefined,
        respiratoryRate: undefined,
        metadata: {
          algorithm: this.algorithm,
          rawSnrDb: snrDb,
          disclaimer: 'Confidence below clinical threshold. Vitals withheld.',
        },
      };
    } else {
      reading = {
        id: `sr-rppg-${patientId}-${timestamp}`,
        patientId,
        bedId,
        source: this.source,
        timestamp,
        confidence,
        signalQuality,
        measurementStatus: 'VALID',
        measurement_status: 'VALID',
        heartRate: rawMeasurement.heartRate,
        respiratoryRate: rawMeasurement.respiratoryRate,
        metadata: {
          algorithm: this.algorithm,
          rawSnrDb: snrDb,
          dominantFrequencyHz: rawMeasurement.metadata?.dominantFrequencyHz,
        },
      };
    }

    this.notifyReading(reading);
    return reading;
  }

  /**
   * Immediately clears the temporal ROI signal buffer for a given patient.
   * Essential for eliminating the No-Face bug and cross-patient signal leakage.
   */
  public clearBuffer(patientId: string = this.defaultPatientId): void {
    this.roiBuffers.delete(patientId);
  }

  /**
   * Clears all buffered ROI histories across all patients.
   */
  public clearAllBuffers(): void {
    this.roiBuffers.clear();
  }

  /**
   * Hard Invalidation: Emits an explicit TARGET_LOST / NO_FACE event for a patient.
   * Immediately purges active buffers and guarantees zero vitals fabrication.
   */
  public invalidatePatient(
    patientId: string = this.defaultPatientId,
    bedId: string = this.defaultBedId,
    reason = 'Patient face not detected in sensing area'
  ): SensorReading {
    this.clearBuffer(patientId);
    const timestamp = Date.now();

    const reading: SensorReading = {
      id: `sr-rppg-lost-${patientId}-${timestamp}`,
      patientId,
      bedId,
      source: this.source,
      timestamp,
      confidence: 0,
      signalQuality: {
        sqiPercentage: 0,
        snrDb: -20,
        illuminationLux: 0,
        motionArtifactIndex: 0,
        state: 'LOST',
        isUsable: false,
        faceDetected: false,
        reason,
      },
      measurementStatus: 'TARGET_LOST',
      measurement_status: 'TARGET_LOST',
      heartRate: undefined,
      respiratoryRate: undefined,
      metadata: {
        algorithm: this.algorithm,
        disclaimer: 'Face lost. Vitals immediately invalidated and withheld.',
      },
    };

    this.notifyReading(reading);
    return reading;
  }

  /**
   * Reads the current cached reading for a patient.
   */
  public async read(patientId: string = this.defaultPatientId): Promise<SensorReading | null> {
    return this.lastReading.get(patientId) ?? null;
  }
}
