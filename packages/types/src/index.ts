/**
 * AegisPulse Domain Model & Schema Validation Library
 * Strictly typed entities with runtime Zod contracts and provenance guarantees.
 * Zero `any`, zero untyped JSON, exhaustive enums, physiological boundary checks.
 */

// ============================================================================
// 1. Exhaustive Enums & Enum Types
// ============================================================================
export * from './enums';

// ============================================================================
// 2. Timestamp & Provenance Schemas
// ============================================================================
export * from './provenance';

// ============================================================================
// 3. Physiological Vitals & Signal Quality Schemas
// ============================================================================
export * from './schemas/vitals';

// ============================================================================
// 4. Clinical Context, Labs & Attention Allocation Schemas
// ============================================================================
export * from './schemas/clinical';

// ============================================================================
// 5. Ward & Patient Management Schemas
// ============================================================================
export * from './schemas/ward';

// ============================================================================
// 6. Events, Alerts, Users & Auditing Schemas
// ============================================================================
export * from './schemas/events';

// ============================================================================
// 7. Backward Compatibility & Integration Aliases
// ============================================================================
import { QualityStatus, QualityStatusEnum, ObservationSource } from './enums';
import { AttentionPriority, AttentionPrioritySchema } from './schemas/clinical';
import { Observation, ObservationSchema } from './schemas/events';

export const SensorQualityStateEnum = QualityStatusEnum;
export type SensorQualityState = QualityStatus;

export const AttentionAssessmentSchema = AttentionPrioritySchema;
export type AttentionAssessment = AttentionPriority;

export const SingleObservationSchema = ObservationSchema;
export type SingleObservation = Observation;

export interface PhysiologicalObservation {
  id: string;
  patientId: string;
  timestamp: number;
  source: ObservationSource;
  confidence: number;
  qualityState: QualityStatus;
  heartRate?: number;
  respiratoryRate?: number;
  systolicBP?: number;
  diastolicBP?: number;
  temperature?: number;
  hrv?: number;
  shockIndex?: number;
  spo2?: number;
  avpu?: 'A' | 'V' | 'P' | 'U';
}

// ============================================================================
// 8. Strongly-Typed Runtime Validation Helpers
// ============================================================================
import {
  VitalMeasurementSchema,
  SignalQualitySchema,
  BloodPressurePairSchema,
} from './schemas/vitals';
import {
  ClinicalContextSchema,
  LaboratoryResultSchema,
  ClinicalActionSchema,
} from './schemas/clinical';
import { PatientSchema, BedSchema, WardSchema } from './schemas/ward';
import {
  TimelineEventSchema,
  AlertSchema,
  UserSchema,
  AuditEventSchema,
  TrendVectorSchema,
  SBARReportSchema,
  HealthCheckResponseSchema,
} from './schemas/events';

export const validateVitalMeasurement = (data: unknown) =>
  VitalMeasurementSchema.safeParse(data);

export const validateObservation = (data: unknown) =>
  ObservationSchema.safeParse(data);

export const validateSignalQuality = (data: unknown) =>
  SignalQualitySchema.safeParse(data);

export const validateBloodPressurePair = (data: unknown) =>
  BloodPressurePairSchema.safeParse(data);

export const validatePatient = (data: unknown) =>
  PatientSchema.safeParse(data);

export const validateBed = (data: unknown) =>
  BedSchema.safeParse(data);

export const validateWard = (data: unknown) =>
  WardSchema.safeParse(data);

export const validateClinicalContext = (data: unknown) =>
  ClinicalContextSchema.safeParse(data);

export const validateLaboratoryResult = (data: unknown) =>
  LaboratoryResultSchema.safeParse(data);

export const validateAttentionPriority = (data: unknown) =>
  AttentionPrioritySchema.safeParse(data);

export const validateClinicalAction = (data: unknown) =>
  ClinicalActionSchema.safeParse(data);

export const validateTimelineEvent = (data: unknown) =>
  TimelineEventSchema.safeParse(data);

export const validateAlert = (data: unknown) =>
  AlertSchema.safeParse(data);

export const validateUser = (data: unknown) =>
  UserSchema.safeParse(data);

export const validateAuditEvent = (data: unknown) =>
  AuditEventSchema.safeParse(data);

export const validateTrendVector = (data: unknown) =>
  TrendVectorSchema.safeParse(data);

export const validateSBARReport = (data: unknown) =>
  SBARReportSchema.safeParse(data);

export const validateHealthCheck = (data: unknown) =>
  HealthCheckResponseSchema.safeParse(data);
