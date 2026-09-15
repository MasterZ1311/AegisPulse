import { z } from 'zod';
import {
  SensorSourceEnum,
  MeasurementStatusEnum,
  SensorOperationalStateEnum,
} from '../enums';
import { TimestampSchema } from '../provenance';
import { PHYSIOLOGICAL_LIMITS, SignalQualitySchema } from './vitals';

// ============================================================================
// 1. Sensor Reading Schema
// Universal contract for any sensor provider: simulator, webcam, wearable, bedside
// ============================================================================
export const SensorReadingSchema = z
  .object({
    id: z.string().min(1, 'Reading ID is required'),
    patientId: z.string().min(1, 'Patient ID is required'),
    bedId: z.string().optional(),
    source: SensorSourceEnum,
    timestamp: TimestampSchema,
    confidence: z
      .number()
      .min(0.0, 'Confidence must be at least 0.0')
      .max(1.0, 'Confidence cannot exceed 1.0'),
    signalQuality: SignalQualitySchema,
    measurementStatus: MeasurementStatusEnum,
    measurement_status: MeasurementStatusEnum.optional(), // snake_case alias matching specification
    // Physiological vitals - ONLY populated when confidence is sufficient
    heartRate: z
      .number()
      .min(PHYSIOLOGICAL_LIMITS.HEART_RATE.min)
      .max(PHYSIOLOGICAL_LIMITS.HEART_RATE.max)
      .optional(),
    respiratoryRate: z
      .number()
      .min(PHYSIOLOGICAL_LIMITS.RESPIRATORY_RATE.min)
      .max(PHYSIOLOGICAL_LIMITS.RESPIRATORY_RATE.max)
      .optional(),
    spo2: z
      .number()
      .min(PHYSIOLOGICAL_LIMITS.OXYGEN_SATURATION.min)
      .max(PHYSIOLOGICAL_LIMITS.OXYGEN_SATURATION.max)
      .optional(),
    systolicBP: z
      .number()
      .min(PHYSIOLOGICAL_LIMITS.SYSTOLIC_BP.min)
      .max(PHYSIOLOGICAL_LIMITS.SYSTOLIC_BP.max)
      .optional(),
    diastolicBP: z
      .number()
      .min(PHYSIOLOGICAL_LIMITS.DIASTOLIC_BP.min)
      .max(PHYSIOLOGICAL_LIMITS.DIASTOLIC_BP.max)
      .optional(),
    temperature: z
      .number()
      .min(PHYSIOLOGICAL_LIMITS.BODY_TEMPERATURE.min)
      .max(PHYSIOLOGICAL_LIMITS.BODY_TEMPERATURE.max)
      .optional(),
    rawWaveform: z.array(z.number()).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .superRefine((reading, ctx) => {
    // 1. Zero-fabrication enforcement: when status is unreliable/non-valid, no vitals can be fabricated
    const UNRELIABLE_STATES = [
      'LOW_CONFIDENCE',
      'CALIBRATING',
      'MOTION_CONTAMINATED',
      'INSUFFICIENT_LIGHT',
      'NO_FACE',
      'PHYSIOLOGICALLY_IMPLAUSIBLE',
      'UNRELIABLE',
      'TARGET_LOST',
      'DEVICE_DISCONNECTED',
    ];
    const isUnreliable =
      UNRELIABLE_STATES.includes(reading.measurementStatus) ||
      (reading.measurement_status !== undefined && UNRELIABLE_STATES.includes(reading.measurement_status));

    if (isUnreliable) {
      if (reading.heartRate !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            `ZERO-FABRICATION VIOLATION: heartRate must not be fabricated when measurement_status is '${reading.measurementStatus}'.`,
        });
      }
      if (reading.respiratoryRate !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            `ZERO-FABRICATION VIOLATION: respiratoryRate must not be fabricated when measurement_status is '${reading.measurementStatus}'.`,
        });
      }
    }

    // 2. Optical camera safety invariant: SpO2 cannot originate from optical camera / webcam
    if (
      (reading.source === 'OPTICAL_RPPG' || reading.source === 'WEBCAM') &&
      reading.spo2 !== undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'SAFETY VIOLATION: SpO2 cannot be measured via contactless camera rPPG. Must come from contact pulse oximeter or bedside monitor.',
      });
    }

    // 3. Pulse pressure validation if both BPs provided
    if (
      reading.systolicBP !== undefined &&
      reading.diastolicBP !== undefined &&
      reading.systolicBP <= reading.diastolicBP
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'PHYSIOLOGICAL INVARIANT: Systolic BP must be strictly greater than Diastolic BP.',
      });
    }
  });

export type SensorReading = z.infer<typeof SensorReadingSchema>;

// ============================================================================
// 2. Sensor Status Schema
// Tracks operational telemetry of a sensor provider hardware/software link
// ============================================================================
export const SensorStatusSchema = z.object({
  providerId: z.string().min(1, 'Provider ID is required'),
  source: SensorSourceEnum,
  state: SensorOperationalStateEnum,
  connected: z.boolean(),
  isStreaming: z.boolean(),
  lastReadingTimestamp: TimestampSchema.optional(),
  message: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type SensorStatus = z.infer<typeof SensorStatusSchema>;

// ============================================================================
// 3. Sensor Provider Interface Contract
// The clinical platform consumes this agnostic interface
// ============================================================================
export type Unsubscribe = () => void;

export interface SensorProvider {
  getProviderId(): string;
  getSource(): z.infer<typeof SensorSourceEnum>;
  getStatus(): SensorStatus;
  start(): Promise<void> | void;
  stop(): Promise<void> | void;
  read(patientId?: string): Promise<SensorReading | null>;
  onReading(callback: (reading: SensorReading) => void): Unsubscribe;
  onStatusChange(callback: (status: SensorStatus) => void): Unsubscribe;
}
