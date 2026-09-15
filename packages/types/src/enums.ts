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

export const SensorSourceEnum = z.enum([
  'SIMULATION',
  'OPTICAL_RPPG',
  'WEBCAM',
  'WEARABLE',
  'BEDSIDE_DEVICE',
  'FUTURE_SENSOR',
]);
export type SensorSource = z.infer<typeof SensorSourceEnum>;

export const MeasurementStatusEnum = z.enum([
  'VALID',
  'LOW_CONFIDENCE',
  'CALIBRATING',
  'MOTION_CONTAMINATED',
  'INSUFFICIENT_LIGHT',
  'NO_FACE',
  'PHYSIOLOGICALLY_IMPLAUSIBLE',
  'DEGRADED',
  'UNRELIABLE',
  'TARGET_LOST',
  'DEVICE_DISCONNECTED',
]);
export type MeasurementStatus = z.infer<typeof MeasurementStatusEnum>;

export const SensorOperationalStateEnum = z.enum([
  'ONLINE',
  'STREAMING',
  'IDLE',
  'DEGRADED',
  'OFFLINE',
  'ERROR',
]);
export type SensorOperationalState = z.infer<typeof SensorOperationalStateEnum>;


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
  'ACKNOWLEDGE',
  'START_ASSESSMENT',
  'COMPLETE_ASSESSMENT',
  'DISMISS',
  'ESCALATE',
  'MARK_FALSE_POSITIVE',
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
  // Unified Timeline Event Types
  'VITAL_MEASUREMENT',
  'SIGNAL_QUALITY_CHANGE',
  'MANUAL_OBSERVATION',
  'MEWS_CHANGE',
  'QSOFA_CHANGE',
  'APS_CHANGE',
  'LAB_RESULT',
  'NURSE_VISIT',
  'ACKNOWLEDGEMENT',
  'RECOMMENDED_ACTION',
  'COMPLETED_ACTION',
  // Legacy / General Variants
  'VITAL_SIGN',
  'ATTENTION_ESCALATION',
  'CLINICAL_ACTION',
  'ALERT',
  'NOTE',
  'SYSTEM_EVENT',
]);
export type TimelineEventType = z.infer<typeof TimelineEventTypeEnum>;

export const UnifiedTimelineEventTypeEnum = z.enum([
  'VITAL_MEASUREMENT',
  'SIGNAL_QUALITY_CHANGE',
  'MANUAL_OBSERVATION',
  'MEWS_CHANGE',
  'QSOFA_CHANGE',
  'APS_CHANGE',
  'LAB_RESULT',
  'NURSE_VISIT',
  'ACKNOWLEDGEMENT',
  'RECOMMENDED_ACTION',
  'COMPLETED_ACTION',
]);
export type UnifiedTimelineEventType = z.infer<typeof UnifiedTimelineEventTypeEnum>;

export const PriorityChangeClassificationEnum = z.enum([
  'NEW_PRIORITY',
  'RISING_PRIORITY',
  'PERSISTENT_PRIORITY',
  'RESOLVED',
  'UNCONFIRMED',
  'SIGNAL_FAILURE',
]);
export type PriorityChangeClassification = z.infer<typeof PriorityChangeClassificationEnum>;

export const PolicyActionEnum = z.enum([
  'EMIT_ALERT',
  'ESCALATE',
  'SUPPRESS',
  'HOLD_UNCONFIRMED',
  'ACKNOWLEDGE',
  'RESOLVE',
  'DE_ESCALATE',
]);
export type PolicyAction = z.infer<typeof PolicyActionEnum>;

export const SuppressionReasonEnum = z.enum([
  'HYSTERESIS_HOLD',
  'PERSISTENCE_PENDING',
  'COOLDOWN_ACTIVE',
  'ACKNOWLEDGED_SILENT',
  'DUPLICATE_DEDUPED',
  'SIGNAL_UNRELIABLE',
]);
export type SuppressionReason = z.infer<typeof SuppressionReasonEnum>;

export const NurseWorkflowActionEnum = z.enum([
  'ACKNOWLEDGE',
  'START_ASSESSMENT',
  'COMPLETE_ASSESSMENT',
  'DISMISS',
  'ESCALATE',
  'MARK_FALSE_POSITIVE',
]);
export type NurseWorkflowAction = z.infer<typeof NurseWorkflowActionEnum>;

export const VerificationItemTypeEnum = z.enum([
  'BEDSIDE_VITAL_RECHECK',
  'MANUAL_BP_CONFIRMATION',
  'INSPECT_PATIENT',
  'CONFIRM_SIGNAL_QUALITY',
]);
export type VerificationItemType = z.infer<typeof VerificationItemTypeEnum>;

export const CopilotQueryTypeEnum = z.enum([
  'SUMMARIZE_TIMELINE',
  'EXPLAIN_APS_CHANGE',
  'DRAFT_SBAR',
  'IDENTIFY_MISSING_INFO',
  'EXPLAIN_CALCULATION',
  'QUESTION_ANSWER',
]);
export type CopilotQueryType = z.infer<typeof CopilotQueryTypeEnum>;

export const CopilotRefusalReasonEnum = z.enum([
  'ATTEMPTED_DIAGNOSIS',
  'ATTEMPTED_TREATMENT_RECOMMENDATION',
  'ATTEMPTED_APS_MUTATION',
  'ATTEMPTED_DATA_OVERWRITE',
  'UNSUPPORTED_OR_MISSING_DATA',
  'PROMPT_INJECTION_DETECTED',
  'SAFETY_OVERRIDE_ATTEMPT',
]);
export type CopilotRefusalReason = z.infer<typeof CopilotRefusalReasonEnum>;
