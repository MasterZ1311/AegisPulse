import type {
  SensorProvider,
  SensorReading,
  SensorStatus,
  SensorSource,
  Unsubscribe,
  SignalQuality,
  QualityStatus,
  MeasurementStatus,
} from '@aegispulse/types';
import {
  RppgPipeline,
  type RgbTimeSeries,
  type VideoFrameRoi,
  type RppgAlgorithmType,
  type PipelineConfig,
  type ProcessRgbOptions,
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
  ): SensorReading {
    // 1. Guard against accidental raw video or frame buffers
    const roiKeys = Object.keys(roi);
    for (const key of roiKeys) {
      if (['video', 'rawFrame', 'pixels', 'buffer', 'imageData'].includes(key)) {
        throw new Error(
          `PRIVACY VIOLATION: Raw image data key '${key}' detected in ROI. Only spatial mean RGB values are permitted.`
        );
      }
    }

    // Strict Invariant: If face was lost or skinFraction below threshold (< 0.30), immediately purge buffer & emit NO_FACE
    if (roi.faceDetected === false || roi.skinFraction === 0 || (roi.skinFraction !== undefined && roi.skinFraction < 0.30)) {
      this.clearBuffer(patientId);
      const reading: SensorReading = {
        id: `sr-rppg-${patientId}-${roi.timestampMs}`,
        patientId,
        bedId,
        source: this.source,
        timestamp: roi.timestampMs,
        confidence: 0,
        signalQuality: {
          sqiPercentage: 0,
          snrDb: -20,
          illuminationLux: roi.illuminationLux ?? 240,
          motionArtifactIndex: roi.motionMagnitude ?? 0,
          state: 'LOST',
          isUsable: false,
          faceDetected: false,
          reason: 'No face detected in camera field of view (face lost or occluded)',
        },
        measurementStatus: 'NO_FACE',
        measurement_status: 'NO_FACE',
        heartRate: undefined,
        respiratoryRate: undefined,
      };
      this.notifyReading(reading);
      return reading;
    }

    // Check for insufficient light in frame
    if (roi.illuminationLux !== undefined && roi.illuminationLux < 30) {
      const reading: SensorReading = {
        id: `sr-rppg-${patientId}-${roi.timestampMs}`,
        patientId,
        bedId,
        source: this.source,
        timestamp: roi.timestampMs,
        confidence: 0,
        signalQuality: {
          sqiPercentage: 0,
          snrDb: -20,
          illuminationLux: roi.illuminationLux,
          motionArtifactIndex: roi.motionMagnitude ?? 0,
          state: 'DEGRADED',
          isUsable: false,
          faceDetected: true,
          reason: `Ambient illuminance (${roi.illuminationLux} lux) below 30 lux threshold`,
        },
        measurementStatus: 'INSUFFICIENT_LIGHT',
        measurement_status: 'INSUFFICIENT_LIGHT',
        heartRate: undefined,
        respiratoryRate: undefined,
      };
      this.notifyReading(reading);
      return reading;
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

    // If buffer is still accumulating (< 3 seconds of continuous signal), emit CALIBRATING state
    if (buffer.length < fps * 3) {
      const reading: SensorReading = {
        id: `sr-rppg-${patientId}-${roi.timestampMs}`,
        patientId,
        bedId,
        source: this.source,
        timestamp: roi.timestampMs,
        confidence: 0.10,
        signalQuality: {
          sqiPercentage: Math.round((buffer.length / (fps * 3)) * 40),
          snrDb: 0,
          illuminationLux: roi.illuminationLux ?? 240,
          motionArtifactIndex: roi.motionMagnitude ?? 0,
          state: 'DEGRADED',
          isUsable: false,
          faceDetected: true,
          reason: 'Accumulating optical window frames for frequency calibration',
        },
        measurementStatus: 'CALIBRATING',
        measurement_status: 'CALIBRATING',
        heartRate: undefined,
        respiratoryRate: undefined,
      };
      this.notifyReading(reading);
      return reading;
    }

    // Evaluate once we have at least 3 seconds of continuous signal
    const rgbSeries = this.pipeline.aggregateFrameRois(buffer, fps);
    return this.processRgbSeries(
      rgbSeries,
      patientId,
      bedId,
      roi.motionMagnitude ?? 0.05,
      roi.illuminationLux ? Math.min(1.0, roi.illuminationLux / 400) : 0.95
    );
  }

  /**
   * Processes an RGB time-series directly and produces a SensorReading.
   */
  public processRgbSeries(
    series: RgbTimeSeries,
    patientId: string = this.defaultPatientId,
    bedId: string = this.defaultBedId,
    motionMagnitude = 0.05,
    illuminationScore = 0.95,
    options?: ProcessRgbOptions
  ): SensorReading {
    const effectiveMotion = options?.motionMagnitude ?? motionMagnitude;
    const effectiveIllumScore = options?.illuminationScore ?? illuminationScore;
    const effectiveLux = options?.illuminationLux ?? Math.round(effectiveIllumScore * 400);

    const mergedOptions: ProcessRgbOptions = {
      ...options,
      algorithm: options?.algorithm ?? this.algorithm,
      motionMagnitude: effectiveMotion,
      illuminationScore: effectiveIllumScore,
      illuminationLux: effectiveLux,
    };

    const rawMeasurement = this.pipeline.processRgbSeries(
      series,
      mergedOptions,
      effectiveMotion,
      effectiveIllumScore
    );

    const timestamp = rawMeasurement.timestamp;
    const confidence = rawMeasurement.confidence;
    const snrDb = rawMeasurement.signalQuality.snrDb;
    const sqiScore = rawMeasurement.signalQuality.sqiScore;
    const motionDetected = rawMeasurement.signalQuality.motionDetected || effectiveMotion > 0.25;
    const lux = effectiveLux;

    // Map quality state
    let qualityState: QualityStatus;
    if (rawMeasurement.status === 'VALID' && confidence >= this.minConfidenceThreshold) {
      qualityState = 'TRUSTED';
    } else if (rawMeasurement.status === 'DEGRADED' || rawMeasurement.status === 'CALIBRATING') {
      qualityState = 'DEGRADED';
    } else {
      qualityState = 'UNRELIABLE';
    }

    // Map exact contactless measurement status
    let measurementStatus: MeasurementStatus = 'VALID';
    if (rawMeasurement.status === 'NO_FACE') {
      measurementStatus = 'NO_FACE';
    } else if (rawMeasurement.status === 'INSUFFICIENT_LIGHT') {
      measurementStatus = 'INSUFFICIENT_LIGHT';
    } else if (rawMeasurement.status === 'MOTION_CONTAMINATED') {
      measurementStatus = 'MOTION_CONTAMINATED';
    } else if (rawMeasurement.status === 'CALIBRATING') {
      measurementStatus = 'CALIBRATING';
    } else if (rawMeasurement.status === 'PHYSIOLOGICALLY_IMPLAUSIBLE') {
      measurementStatus = 'PHYSIOLOGICALLY_IMPLAUSIBLE';
    } else if (
      rawMeasurement.status === 'UNUSABLE' ||
      rawMeasurement.status === 'LOW_CONFIDENCE' ||
      confidence < this.minConfidenceThreshold ||
      motionDetected ||
      snrDb < 1.0
    ) {
      measurementStatus = 'LOW_CONFIDENCE';
    } else {
      measurementStatus = 'VALID';
    }

    const signalQuality: SignalQuality = {
      sqiPercentage: sqiScore,
      snrDb,
      illuminationLux: lux,
      motionArtifactIndex: effectiveMotion,
      motionDetected,
      state: qualityState,
      isUsable: measurementStatus === 'VALID' && confidence >= this.minConfidenceThreshold,
      faceDetected: rawMeasurement.signalQuality.faceDetected ?? true,
      reason: rawMeasurement.signalQuality.stateReason ?? (motionDetected
        ? 'Subject motion artifact detected'
        : snrDb < 1.0
          ? 'Optical signal-to-noise ratio below viable threshold'
          : undefined),
    };

    let reading: SensorReading;

    // STRICT INVARIANT: If status is not VALID, emit ZERO fabricated vitals
    if (measurementStatus !== 'VALID') {
      reading = {
        id: `sr-rppg-${patientId}-${timestamp}`,
        patientId,
        bedId,
        source: this.source,
        timestamp,
        confidence: Math.min(0.25, confidence),
        signalQuality: {
          ...signalQuality,
          state: qualityState === 'TRUSTED' ? 'DEGRADED' : qualityState,
          isUsable: false,
          reason: signalQuality.reason ?? `Optical signal gating active [${measurementStatus}]`,
        },
        measurementStatus,
        measurement_status: measurementStatus,
        // STRICT ZERO-FABRICATION GUARANTEE:
        heartRate: undefined,
        respiratoryRate: undefined,
        metadata: {
          algorithm: this.algorithm,
          rawSnrDb: snrDb,
          disclaimer: `Optical signal gated [${measurementStatus}]. Vitals withheld to protect patient safety.`,
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
   * Hardware & Environmental Lifecycle Recovery Handlers
   */
  public handleCameraDisconnect(
    patientId: string = this.defaultPatientId,
    bedId: string = this.defaultBedId
  ): SensorReading {
    this.roiBuffers.delete(patientId);
    const reading: SensorReading = {
      id: `sr-rppg-${patientId}-${Date.now()}`,
      patientId,
      bedId,
      source: this.source,
      timestamp: Date.now(),
      confidence: 0,
      signalQuality: {
        sqiPercentage: 0,
        snrDb: -20,
        illuminationLux: 0,
        motionArtifactIndex: 0,
        state: 'LOST',
        isUsable: false,
        faceDetected: false,
        reason: 'Camera hardware disconnected or video track closed',
      },
      measurementStatus: 'LOW_CONFIDENCE',
      measurement_status: 'LOW_CONFIDENCE',
      heartRate: undefined,
      respiratoryRate: undefined,
    };
    this.notifyStatus('Camera hardware disconnected');
    this.notifyReading(reading);
    return reading;
  }

  public handleCameraPermissionDenied(
    patientId: string = this.defaultPatientId,
    bedId: string = this.defaultBedId
  ): SensorReading {
    this.roiBuffers.delete(patientId);
    const reading: SensorReading = {
      id: `sr-rppg-${patientId}-${Date.now()}`,
      patientId,
      bedId,
      source: this.source,
      timestamp: Date.now(),
      confidence: 0,
      signalQuality: {
        sqiPercentage: 0,
        snrDb: -20,
        illuminationLux: 0,
        motionArtifactIndex: 0,
        state: 'LOST',
        isUsable: false,
        faceDetected: false,
        reason: 'Camera access permission denied by user or OS security policy',
      },
      measurementStatus: 'LOW_CONFIDENCE',
      measurement_status: 'LOW_CONFIDENCE',
      heartRate: undefined,
      respiratoryRate: undefined,
    };
    this.notifyStatus('Camera permission denied');
    this.notifyReading(reading);
    return reading;
  }

  public handleCameraReconnect(
    patientId: string = this.defaultPatientId,
    bedId: string = this.defaultBedId
  ): SensorReading {
    this.roiBuffers.delete(patientId);
    this.start();
    const reading: SensorReading = {
      id: `sr-rppg-${patientId}-${Date.now()}`,
      patientId,
      bedId,
      source: this.source,
      timestamp: Date.now(),
      confidence: 0.1,
      signalQuality: {
        sqiPercentage: 10,
        snrDb: 0,
        illuminationLux: 240,
        motionArtifactIndex: 0,
        state: 'DEGRADED',
        isUsable: false,
        faceDetected: true,
        reason: 'Camera reconnected. Re-initializing optical calibration buffer.',
      },
      measurementStatus: 'CALIBRATING',
      measurement_status: 'CALIBRATING',
      heartRate: undefined,
      respiratoryRate: undefined,
    };
    this.notifyStatus('Camera reconnected. Calibrating...');
    this.notifyReading(reading);
    return reading;
  }

  public handleFaceLost(
    patientId: string = this.defaultPatientId,
    bedId: string = this.defaultBedId
  ): SensorReading {
    this.clearBuffer(patientId);
    const reading: SensorReading = {
      id: `sr-rppg-lost-${patientId}-${Date.now()}`,
      patientId,
      bedId,
      source: this.source,
      timestamp: Date.now(),
      confidence: 0,
      signalQuality: {
        sqiPercentage: 0,
        snrDb: -20,
        illuminationLux: 0,
        motionArtifactIndex: 0,
        state: 'LOST',
        isUsable: false,
        faceDetected: false,
        reason: 'Face lost or subject moved out of camera field of view',
      },
      measurementStatus: 'NO_FACE',
      measurement_status: 'NO_FACE',
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

  public handleFaceReacquired(
    patientId: string = this.defaultPatientId,
    bedId: string = this.defaultBedId
  ): SensorReading {
    this.roiBuffers.delete(patientId);
    const reading: SensorReading = {
      id: `sr-rppg-${patientId}-${Date.now()}`,
      patientId,
      bedId,
      source: this.source,
      timestamp: Date.now(),
      confidence: 0.1,
      signalQuality: {
        sqiPercentage: 10,
        snrDb: 0,
        illuminationLux: 240,
        motionArtifactIndex: 0,
        state: 'DEGRADED',
        isUsable: false,
        faceDetected: true,
        reason: 'Face reacquired. Stabilizing optical tracking buffer.',
      },
      measurementStatus: 'CALIBRATING',
      measurement_status: 'CALIBRATING',
      heartRate: undefined,
      respiratoryRate: undefined,
    };
    this.notifyReading(reading);
    return reading;
  }

  public handleLightingRestored(
    patientId: string = this.defaultPatientId,
    bedId: string = this.defaultBedId
  ): SensorReading {
    this.roiBuffers.delete(patientId);
    const reading: SensorReading = {
      id: `sr-rppg-${patientId}-${Date.now()}`,
      patientId,
      bedId,
      source: this.source,
      timestamp: Date.now(),
      confidence: 0.1,
      signalQuality: {
        sqiPercentage: 10,
        snrDb: 0,
        illuminationLux: 240,
        motionArtifactIndex: 0,
        state: 'DEGRADED',
        isUsable: false,
        faceDetected: true,
        reason: 'Adequate lighting restored. Calibrating optical reflectance.',
      },
      measurementStatus: 'CALIBRATING',
      measurement_status: 'CALIBRATING',
      heartRate: undefined,
      respiratoryRate: undefined,
    };
    this.notifyReading(reading);
    return reading;
  }

  public handleMotionCeased(
    patientId: string = this.defaultPatientId,
    bedId: string = this.defaultBedId
  ): SensorReading {
    this.roiBuffers.delete(patientId);
    const reading: SensorReading = {
      id: `sr-rppg-${patientId}-${Date.now()}`,
      patientId,
      bedId,
      source: this.source,
      timestamp: Date.now(),
      confidence: 0.1,
      signalQuality: {
        sqiPercentage: 15,
        snrDb: 1.0,
        illuminationLux: 240,
        motionArtifactIndex: 0.05,
        state: 'DEGRADED',
        isUsable: false,
        faceDetected: true,
        reason: 'Subject motion ceased. Re-stabilizing cardiac spectral peak.',
      },
      measurementStatus: 'CALIBRATING',
      measurement_status: 'CALIBRATING',
      heartRate: undefined,
      respiratoryRate: undefined,
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
