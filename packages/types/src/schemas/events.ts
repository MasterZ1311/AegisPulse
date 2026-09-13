import { z } from 'zod';
import {
  VitalTypeEnum,
  VitalUnitEnum,
  ObservationSourceEnum,
  QualityStatusEnum,
  AlertSeverityEnum,
  AlertStatusEnum,
  AttentionReasonCodeEnum,
  UserRoleEnum,
  AuditActionEnum,
  TimelineEventTypeEnum,
  TrajectoryDirectionEnum,
  ShockIndexTrendEnum,
  AttentionPriorityCategoryEnum,
} from '../enums';
import { TimestampSchema, ProvenanceSchema } from '../provenance';
import { PHYSIOLOGICAL_LIMITS, SignalQualitySchema } from './vitals';

// Map vital type to allowed unit
const VITAL_TYPE_TO_UNIT: Record<z.infer<typeof VitalTypeEnum>, z.infer<typeof VitalUnitEnum>> = {
  HEART_RATE: 'BPM',
  RESPIRATORY_RATE: 'BREATHS_PER_MINUTE',
  SYSTOLIC_BP: 'MMHG',
  DIASTOLIC_BP: 'MMHG',
  BODY_TEMPERATURE: 'CELSIUS',
  OXYGEN_SATURATION: 'PERCENT',
  HRV_RMSSD: 'MILLISECONDS',
  SHOCK_INDEX: 'RATIO',
};

// ============================================================================
// 1. Physiological Observation Schema (Single Atomic Vital Observation)
// ============================================================================
export const ObservationSchema = z
  .object({
    id: z.string().min(1, 'Observation ID is required'),
    patientId: z.string().min(1, 'Patient ID is required'),
    bedId: z.string().min(1, 'Bed ID is required'),
    timestamp: TimestampSchema,
    source: ObservationSourceEnum,
    vitalType: VitalTypeEnum,
    value: z.number(),
    unit: VitalUnitEnum,
    confidence: z
      .number()
      .min(0.0, 'Confidence cannot be less than 0.0')
      .max(1.0, 'Confidence cannot exceed 1.0'),
    qualityStatus: QualityStatusEnum,
    provenance: ProvenanceSchema.optional(),
    notes: z.string().optional(),
    metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  })
  .superRefine((obs, ctx) => {
    if (obs.unit !== VITAL_TYPE_TO_UNIT[obs.vitalType]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Invalid unit '${obs.unit}' for vital type '${obs.vitalType}'. Expected '${VITAL_TYPE_TO_UNIT[obs.vitalType]}'`,
      });
    }
    const limits = PHYSIOLOGICAL_LIMITS[obs.vitalType];
    if (limits && (obs.value < limits.min || obs.value > limits.max)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Value ${obs.value} is outside physiological limits for ${obs.vitalType} [${limits.min}, ${limits.max}] ${obs.unit}`,
      });
    }
    if (obs.vitalType === 'OXYGEN_SATURATION' && obs.source === 'OPTICAL_RPPG') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'SAFETY VIOLATION: SpO2 cannot originate from OPTICAL_RPPG. Contact pulse oximeter or nurse entry required.',
      });
    }
    if ((obs.source === 'DERIVED' || obs.vitalType === 'SHOCK_INDEX') && !obs.provenance) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'PROVENANCE REQUIRED: Derived physiological observations must retain provenance details.',
      });
    }
  });
export type Observation = z.infer<typeof ObservationSchema>;

// ============================================================================
// 2. Observation Event Schema (Stream Ingestion Envelope)
// ============================================================================
export const ObservationEventSchema = z.object({
  id: z.string().min(1, 'Event ID is required'),
  patientId: z.string().min(1, 'Patient ID is required'),
  timestamp: TimestampSchema,
  eventType: z.enum([
    'OBSERVATION_INGESTED',
    'OBSERVATION_UPDATED',
    'OBSERVATION_INVALIDATED',
    'QUALITY_DEGRADED',
  ]),
  observation: ObservationSchema,
  signalQuality: SignalQualitySchema.optional(),
});
export type ObservationEvent = z.infer<typeof ObservationEventSchema>;

// ============================================================================
// 3. Timeline Event Schema (Patient Longitudinal Event)
// ============================================================================
export const TimelineEventSchema = z.object({
  id: z.string().min(1, 'Timeline event ID is required'),
  patientId: z.string().min(1, 'Patient ID is required'),
  bedNumber: z.string().min(1, 'Bed number is required'),
  timestamp: TimestampSchema,
  eventType: TimelineEventTypeEnum,
  title: z.string().min(1, 'Event title is required'),
  description: z.string().min(1, 'Event description is required'),
  severity: AlertSeverityEnum.optional(),
  actorUserId: z.string().optional(),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
});
export type TimelineEvent = z.infer<typeof TimelineEventSchema>;

// ============================================================================
// 4. Alert Schema
// ============================================================================
export const AlertSchema = z.object({
  id: z.string().min(1, 'Alert ID is required'),
  patientId: z.string().min(1, 'Patient ID is required'),
  bedNumber: z.string().min(1, 'Bed number is required'),
  timestamp: TimestampSchema,
  severity: AlertSeverityEnum,
  status: AlertStatusEnum.default('ACTIVE'),
  code: AttentionReasonCodeEnum,
  title: z.string().min(1, 'Alert title is required'),
  message: z.string().min(1, 'Alert message is required'),
  isAcknowledged: z.boolean().default(false),
  acknowledgedByUserId: z.string().optional(),
  acknowledgedAt: TimestampSchema.optional(),
  resolvedAt: TimestampSchema.optional(),
});
export type Alert = z.infer<typeof AlertSchema>;

// ============================================================================
// 5. User Schema
// ============================================================================
export const UserSchema = z.object({
  id: z.string().min(1, 'User ID is required'),
  username: z.string().min(3, 'Username must be at least 3 characters'),
  fullName: z.string().min(1, 'Full name is required'),
  email: z.string().email('Invalid email address'),
  role: UserRoleEnum,
  assignedWardIds: z.array(z.string()).min(1, 'User must be assigned to at least one ward'),
  badgeNumber: z.string().min(1, 'Staff badge number is required'),
  isActive: z.boolean().default(true),
  createdAt: TimestampSchema,
});
export type User = z.infer<typeof UserSchema>;

// ============================================================================
// 6. Audit Event Schema (HIPAA / Med-Device Regulatory Provenance)
// ============================================================================
export const AuditEventSchema = z.object({
  id: z.string().min(1, 'Audit ID is required'),
  timestamp: TimestampSchema,
  actorId: z.string().min(1, 'Actor ID is required'),
  actorRole: UserRoleEnum,
  action: AuditActionEnum,
  targetEntity: z.string().min(1, 'Target entity is required'),
  targetEntityId: z.string().min(1, 'Target entity ID is required'),
  patientId: z.string().optional(),
  description: z.string().min(1, 'Audit description is required'),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  previousState: z.string().optional(),
  newState: z.string().optional(),
});
export type AuditEvent = z.infer<typeof AuditEventSchema>;

// ============================================================================
// 7. Trend Vector Schema (Physiological Velocity & Acceleration)
// ============================================================================
export const TrendVectorSchema = z.object({
  patientId: z.string().min(1, 'Patient ID is required'),
  timestamp: TimestampSchema,
  hrVelocityPerHour: z.number(), // % per hour
  rrVelocityPerHour: z.number(), // % per hour
  shockIndexCurrent: z.number().min(0.1).max(5.0),
  shockIndexTrend: ShockIndexTrendEnum,
  mewsDelta2Hour: z.number().int(),
  trajectoryDirection: TrajectoryDirectionEnum,
  provenance: ProvenanceSchema,
});
export type TrendVector = z.infer<typeof TrendVectorSchema>;

// ============================================================================
// 8. SBAR Report Schema (Clinical Handoff)
// ============================================================================
export const SBARReportSchema = z.object({
  id: z.string().min(1, 'Report ID is required'),
  patientId: z.string().min(1, 'Patient ID is required'),
  bedNumber: z.string().min(1, 'Bed number is required'),
  patientName: z.string().min(1, 'Patient name is required'),
  situation: z.string().min(1, 'Situation is required'),
  background: z.string().min(1, 'Background is required'),
  assessment: z.string().min(1, 'Assessment is required'),
  recommendation: z.string().min(1, 'Recommendation is required'),
  generatedAt: TimestampSchema,
  apsScore: z.number().min(0).max(100),
  priorityCategory: AttentionPriorityCategoryEnum,
  provenance: ProvenanceSchema,
});
export type SBARReport = z.infer<typeof SBARReportSchema>;

// ============================================================================
// 9. Health Check Response Schema (Infrastructure Telemetry)
// ============================================================================
export const HealthCheckResponseSchema = z.object({
  status: z.enum(['ok', 'degraded', 'error']),
  service: z.string().min(1),
  version: z.string().min(1),
  timestamp: z.string().min(1),
  uptimeSeconds: z.number().min(0),
  environment: z.string().min(1),
});
export type HealthCheckResponse = z.infer<typeof HealthCheckResponseSchema>;
