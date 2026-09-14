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
// 6.1 Unified Timeline Schemas
// ============================================================================
export * from './schemas/timeline';

// ============================================================================
// 6.2 Real-Time Telemetry & Event Stream Schemas
// ============================================================================
export * from './schemas/telemetry-stream';

// ============================================================================
// 6.3 Sensor Adapter, Readings & Operational Status Schemas
// ============================================================================
export * from './schemas/sensors';

// ============================================================================
// 6.4 Information Decay, Freshness & Epistemic Uncertainty Schemas
// ============================================================================
export * from './schemas/decay';

// ============================================================================
// 6.5 Attention & Notification Event Policy Schemas
// ============================================================================
export * from './schemas/policy';

// ============================================================================
// 6.6 Human Action Workflow & Verification Schemas
// ============================================================================
export * from './schemas/workflow';

// ============================================================================
// 6.7 AI Clinical Copilot & Evidence Schemas
// ============================================================================
export * from './schemas/copilot';



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
import { UnifiedTimelineEventSchema } from './schemas/timeline';
import { SensorReadingSchema, SensorStatusSchema } from './schemas/sensors';
import { InformationFreshnessSchema } from './schemas/decay';
import {
  StructuredEvidencePackageSchema,
  CopilotResponseSchema,
  CopilotAuditRecordSchema,
} from './schemas/copilot';

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

export const validateUnifiedTimelineEvent = (data: unknown) =>
  UnifiedTimelineEventSchema.safeParse(data);

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

export const validateSensorReading = (data: unknown) =>
  SensorReadingSchema.safeParse(data);

export const validateSensorStatus = (data: unknown) =>
  SensorStatusSchema.safeParse(data);

export const validateInformationFreshness = (data: unknown) =>
  InformationFreshnessSchema.safeParse(data);

export const validateStructuredEvidencePackage = (data: unknown) =>
  StructuredEvidencePackageSchema.safeParse(data);

export const validateCopilotResponse = (data: unknown) =>
  CopilotResponseSchema.safeParse(data);

export const validateCopilotAuditRecord = (data: unknown) =>
  CopilotAuditRecordSchema.safeParse(data);


