import { describe, it, expect } from 'vitest';
import {
  SensorReadingSchema,
  SensorStatusSchema,
  validateSensorReading,
  validateSensorStatus,
  type SensorReading,
  type SensorStatus,
} from '../src/index';

describe('Sensor Adapter Schemas & Invariant Suite', () => {
  const now = Date.now();

  const sampleSignalQuality = {
    sqiPercentage: 88,
    snrDb: 6.5,
    illuminationLux: 350,
    motionArtifactIndex: 0.05,
    state: 'TRUSTED' as const,
    isUsable: true,
    faceDetected: true,
  };

  describe('1. SensorReadingSchema Validation', () => {
    it('accepts a valid in-bounds sensor reading across modalities', () => {
      const reading: SensorReading = {
        id: 'sr-001',
        patientId: 'PAT-01',
        bedId: 'BED-01',
        source: 'OPTICAL_RPPG',
        timestamp: now,
        confidence: 0.92,
        signalQuality: sampleSignalQuality,
        measurementStatus: 'VALID',
        measurement_status: 'VALID',
        heartRate: 74,
        respiratoryRate: 16,
      };

      const result = validateSensorReading(reading);
      expect(result.success).toBe(true);
    });

    it('accepts valid LOW_CONFIDENCE reading when vitals are omitted (not fabricated)', () => {
      const lowConfidenceReading: SensorReading = {
        id: 'sr-002',
        patientId: 'PAT-02',
        bedId: 'BED-02',
        source: 'OPTICAL_RPPG',
        timestamp: now,
        confidence: 0.35,
        signalQuality: {
          ...sampleSignalQuality,
          sqiPercentage: 35,
          snrDb: -0.5,
          motionArtifactIndex: 0.72,
          state: 'UNRELIABLE',
          isUsable: false,
          reason: 'Excessive subject head motion',
        },
        measurementStatus: 'LOW_CONFIDENCE',
        measurement_status: 'LOW_CONFIDENCE',
        // Invariant: NO fabricated physiological measurements
        heartRate: undefined,
        respiratoryRate: undefined,
      };

      const result = validateSensorReading(lowConfidenceReading);
      expect(result.success).toBe(true);
    });

    it('REJECTS reading when heartRate is fabricated during LOW_CONFIDENCE', () => {
      const illegalReading = {
        id: 'sr-003',
        patientId: 'PAT-03',
        source: 'OPTICAL_RPPG',
        timestamp: now,
        confidence: 0.30,
        signalQuality: sampleSignalQuality,
        measurementStatus: 'LOW_CONFIDENCE',
        heartRate: 72, // FORBIDDEN: Fabricated HR!
      };

      const result = SensorReadingSchema.safeParse(illegalReading);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('ZERO-FABRICATION VIOLATION');
      }
    });

    it('REJECTS reading when respiratoryRate is fabricated during LOW_CONFIDENCE', () => {
      const illegalReading = {
        id: 'sr-004',
        patientId: 'PAT-04',
        source: 'WEBCAM',
        timestamp: now,
        confidence: 0.20,
        signalQuality: sampleSignalQuality,
        measurementStatus: 'LOW_CONFIDENCE',
        measurement_status: 'LOW_CONFIDENCE',
        respiratoryRate: 18, // FORBIDDEN: Fabricated RR!
      };

      const result = SensorReadingSchema.safeParse(illegalReading);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('ZERO-FABRICATION VIOLATION');
      }
    });

    it('REJECTS SpO2 originating from optical camera / webcam', () => {
      const opticalSpo2 = {
        id: 'sr-005',
        patientId: 'PAT-05',
        source: 'OPTICAL_RPPG',
        timestamp: now,
        confidence: 0.95,
        signalQuality: sampleSignalQuality,
        measurementStatus: 'VALID',
        heartRate: 75,
        spo2: 98, // FORBIDDEN: SpO2 cannot come from contactless camera
      };

      const result = SensorReadingSchema.safeParse(opticalSpo2);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('SAFETY VIOLATION');
      }
    });

    it('accepts contact wearable / bedside monitor with SpO2 and BP', () => {
      const bedsideReading: SensorReading = {
        id: 'sr-006',
        patientId: 'PAT-06',
        source: 'BEDSIDE_DEVICE',
        timestamp: now,
        confidence: 0.99,
        signalQuality: sampleSignalQuality,
        measurementStatus: 'VALID',
        heartRate: 68,
        respiratoryRate: 14,
        spo2: 99,
        systolicBP: 120,
        diastolicBP: 80,
      };

      const result = validateSensorReading(bedsideReading);
      expect(result.success).toBe(true);
    });

    it('REJECTS systolic BP less than or equal to diastolic BP', () => {
      const badBP = {
        id: 'sr-007',
        patientId: 'PAT-07',
        source: 'BEDSIDE_DEVICE',
        timestamp: now,
        confidence: 0.90,
        signalQuality: sampleSignalQuality,
        measurementStatus: 'VALID',
        systolicBP: 80,
        diastolicBP: 90,
      };

      const result = SensorReadingSchema.safeParse(badBP);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Systolic BP must be strictly greater than Diastolic BP');
      }
    });
  });

  describe('2. SensorStatusSchema Validation', () => {
    it('accepts a valid streaming sensor status', () => {
      const status: SensorStatus = {
        providerId: 'prov-sim-01',
        source: 'SIMULATION',
        state: 'STREAMING',
        connected: true,
        isStreaming: true,
        lastReadingTimestamp: now,
        message: 'Normal shift simulation active',
      };

      const result = validateSensorStatus(status);
      expect(result.success).toBe(true);
    });

    it('accepts degraded or disconnected sensor status', () => {
      const status: SensorStatus = {
        providerId: 'prov-rppg-cam-02',
        source: 'WEBCAM',
        state: 'DEGRADED',
        connected: true,
        isStreaming: true,
        lastReadingTimestamp: now - 5000,
        message: 'Low ambient light in patient room',
      };

      const result = validateSensorStatus(status);
      expect(result.success).toBe(true);
    });
  });
});
