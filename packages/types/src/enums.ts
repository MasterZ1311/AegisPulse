import { z } from 'zod';

/**
 * Exhaustive Enums for AegisPulse Domain Model
 * Zero unvalidated strings, zero any.
 */

export const VitalTypeEnum = z.enum([
  'HEART_RATE',
  'RESPIRATORY_RATE',
  'SYSTOLIC_BP',
  'DIASTOLIC_BP',
  'BODY_TEMPERATURE',
  'OXYGEN_SATURATION',
  'HRV_RMSSD',
  'SHOCK_INDEX',
]);
export type VitalType = z.infer<typeof VitalTypeEnum>;

export const VitalUnitEnum = z.enum([
  'BPM',
  'BREATHS_PER_MINUTE',
  'MMHG',
  'CELSIUS',
  'PERCENT',
  'MILLISECONDS',
  'RATIO',
]);
export type VitalUnit = z.infer<typeof VitalUnitEnum>;

export const ObservationSourceEnum = z.enum([
  'OPTICAL_RPPG',
  'NURSE_MANUAL',
  'BEDSIDE_DEVICE',
  'BLUETOOTH_PERIPHERAL',
  'SIMULATION',
  'DERIVED',
]);
export type ObservationSource = z.infer<typeof ObservationSourceEnum>;

export const QualityStatusEnum = z.enum([
  'TRUSTED',
  'DEGRADED',
  'UNRELIABLE',
  'LOST',
]);
export type QualityStatus = z.infer<typeof QualityStatusEnum>;

export const AttentionPriorityCategoryEnum = z.enum([
  'LOW',
  'WATCH',
  'EVALUATE',
  'CRITICAL_REVIEW',
]);
export type AttentionPriorityCategory = z.infer<typeof AttentionPriorityCategoryEnum>;

export const AttentionReasonCodeEnum = z.enum([
  'VELOCITY_HR_SPIKE',
  'VELOCITY_RR_SPIKE',
  'SHOCK_INDEX_OCCULT',
  'MEWS_ESCALATION',
  'INFORMATION_DECAY_TIMEOUT',
  'LAB_HYPOXIA_LACTATE',
  'LAB_LEUKOCYTOSIS',
  'SENSOR_CONFIDENCE_DEGRADED',
  'PHYSIOLOGICAL_STABILITY',
  'BASELINE_DEVIATION',
  'QSOFA_ESCALATION',
  'PERSISTENT_DETERIORATION',
  'MISSING_VITAL_SIGNS',
]);
export type AttentionReasonCode = z.infer<typeof AttentionReasonCodeEnum>;

export const ClinicalActionTypeEnum = z.enum([
  'BEDSIDE_VISIT',
  'MANUAL_VITALS_RECHECK',
  'ATTACH_CUFF',
  'SBAR_PHYSICIAN_CONSULT',
  'RAPID_RESPONSE_TRIGGER',
  'PATIENT_TRANSFER',
]);
export type ClinicalActionType = z.infer<typeof ClinicalActionTypeEnum>;

export const ClinicalActionStatusEnum = z.enum([
  'RECOMMENDED',
  'ACKNOWLEDGED',
  'IN_PROGRESS',
  'COMPLETED',
  'DISMISSED',
]);
export type ClinicalActionStatus = z.infer<typeof ClinicalActionStatusEnum>;

export const BedStatusEnum = z.enum([
  'OCCUPIED',
  'AVAILABLE',
  'CLEANING',
  'MAINTENANCE',
]);
export type BedStatus = z.infer<typeof BedStatusEnum>;

export const UserRoleEnum = z.enum([
  'WARD_NURSE',
  'CHARGE_NURSE',
  'RESIDENT_PHYSICIAN',
  'ATTENDING_PHYSICIAN',
  'ADMIN',
  'SYSTEM',
]);
export type UserRole = z.infer<typeof UserRoleEnum>;

export const AlertSeverityEnum = z.enum([
  'INFO',
  'WARNING',
  'CRITICAL',
  'EMERGENCY',
]);
export type AlertSeverity = z.infer<typeof AlertSeverityEnum>;

export const AuditActionEnum = z.enum([
  'CREATE',
  'UPDATE',
  'DELETE',
  'VIEW',
  'OVERRIDE',
  'SYSTEM_CALCULATION',
]);
export type AuditAction = z.infer<typeof AuditActionEnum>;

export const CodeStatusEnum = z.enum([
  'FULL_CODE',
  'DNR_DNI',
  'DNR',
  'LIMITED_INTERVENTION',
]);
export type CodeStatus = z.infer<typeof CodeStatusEnum>;

export const GenderEnum = z.enum([
  'MALE',
  'FEMALE',
  'OTHER',
  'UNKNOWN',
  'M',
  'F',
]);
export type Gender = z.infer<typeof GenderEnum>;

export const TrajectoryDirectionEnum = z.enum([
  'IMPROVING',
  'STABLE',
  'DECOMPENSATING',
  'RAPID_CRASH',
]);
export type TrajectoryDirection = z.infer<typeof TrajectoryDirectionEnum>;

export const ShockIndexTrendEnum = z.enum([
  'STABLE',
  'RISING',
  'FALLING',
]);
export type ShockIndexTrend = z.infer<typeof ShockIndexTrendEnum>;

export const AlertStatusEnum = z.enum([
  'ACTIVE',
  'ACKNOWLEDGED',
  'RESOLVED',
  'SUPPRESSED',
]);
export type AlertStatus = z.infer<typeof AlertStatusEnum>;

export const TimelineEventTypeEnum = z.enum([
  'VITAL_SIGN',
  'LAB_RESULT',
  'ATTENTION_ESCALATION',
  'CLINICAL_ACTION',
  'ALERT',
  'NOTE',
  'SYSTEM_EVENT',
]);
export type TimelineEventType = z.infer<typeof TimelineEventTypeEnum>;
