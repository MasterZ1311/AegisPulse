import { z } from 'zod';
import {
  UnifiedTimelineEventTypeEnum,
  AlertSeverityEnum,
  ObservationSourceEnum,
  VitalTypeEnum,
  VitalUnitEnum,
  AttentionPriorityCategoryEnum,
} from '../enums';
import { TimestampSchema } from '../provenance';

// ============================================================================
// 1. Unified Timeline Event Schema
// ============================================================================
export const UnifiedTimelineEventSchema = z.object({
  id: z.string().min(1, 'Timeline event ID is required'),
  patientId: z.string().min(1, 'Patient ID is required'),
  bedNumber: z.string().optional(),
  timestamp: TimestampSchema,
  eventType: UnifiedTimelineEventTypeEnum,
  title: z.string().min(1, 'Event title is required'),
  description: z.string().min(1, 'Event description is required'),
  source: z.union([ObservationSourceEnum, z.literal('CLINICAL_ENGINE'), z.literal('MANUAL_ENTRY'), z.literal('LAB_LIS'), z.literal('SYSTEM')]).default('SYSTEM'),
  isTrusted: z.boolean().default(true),
  severity: AlertSeverityEnum.default('INFO'),
  actorUserId: z.string().optional(),
  actorRole: z.string().optional(),
  data: z.record(z.string(), z.any()).optional(),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
});
export type UnifiedTimelineEvent = z.infer<typeof UnifiedTimelineEventSchema>;

// ============================================================================
// 2. Timeline Query Filter Schema
// ============================================================================
export const TimelineQueryFilterSchema = z.object({
  since: TimestampSchema.optional(),
  until: TimestampSchema.optional(),
  eventTypes: z.array(UnifiedTimelineEventTypeEnum).optional(),
  trustedOnly: z.boolean().optional(),
  limit: z.number().int().min(1).max(1000).default(100),
  order: z.enum(['asc', 'desc']).default('asc'),
});
export type TimelineQueryFilter = z.infer<typeof TimelineQueryFilterSchema>;

// ============================================================================
// 3. Question 1: What changed during the last 4 hours?
// ============================================================================
export const VitalDeltaSummarySchema = z.object({
  vitalType: VitalTypeEnum,
  startValue: z.number(),
  endValue: z.number(),
  absoluteChange: z.number(),
  percentChange: z.number(),
  unit: VitalUnitEnum,
  trend: z.enum(['RISING', 'FALLING', 'STABLE']),
});
export type VitalDeltaSummary = z.infer<typeof VitalDeltaSummarySchema>;

export const ScoreTransitionSummarySchema = z.object({
  scoreName: z.enum(['APS', 'MEWS', 'QSOFA']),
  startScore: z.number(),
  endScore: z.number(),
  scoreDelta: z.number(),
  startCategoryOrLevel: z.string().optional(),
  endCategoryOrLevel: z.string().optional(),
  escalated: z.boolean(),
});
export type ScoreTransitionSummary = z.infer<typeof ScoreTransitionSummarySchema>;

export const TimelineWindowChangesResponseSchema = z.object({
  patientId: z.string(),
  windowHours: z.number(),
  startTime: TimestampSchema,
  endTime: TimestampSchema,
  narrativeSummary: z.string(),
  vitalDeltas: z.array(VitalDeltaSummarySchema),
  scoreTransitions: z.array(ScoreTransitionSummarySchema),
  newLabResults: z.array(z.record(z.string(), z.any())),
  signalQualityEvents: z.array(z.record(z.string(), z.any())),
  actionsRecommended: z.array(z.string()),
  actionsCompleted: z.array(z.string()),
  nurseVisitsCount: z.number(),
  totalEventsInWindow: z.number(),
});
export type TimelineWindowChangesResponse = z.infer<typeof TimelineWindowChangesResponseSchema>;

// ============================================================================
// 4. Question 2: What caused the patient's priority to rise?
// ============================================================================
export const PriorityAttributionFactorSchema = z.object({
  factor: z.string(),
  category: z.string(),
  pointsContribution: z.number(),
  percentageOfRise: z.number(),
  clinicalExplanation: z.string(),
  triggerValue: z.union([z.number(), z.string()]).optional(),
  referenceValue: z.union([z.number(), z.string()]).optional(),
});
export type PriorityAttributionFactor = z.infer<typeof PriorityAttributionFactorSchema>;

export const PriorityRiseAttributionResponseSchema = z.object({
  patientId: z.string(),
  evaluationWindowHours: z.number(),
  baselineApsScore: z.number(),
  currentApsScore: z.number(),
  scoreDelta: z.number(),
  baselineCategory: AttentionPriorityCategoryEnum,
  currentCategory: AttentionPriorityCategoryEnum,
  primaryDriver: z.string(),
  contributingFactors: z.array(PriorityAttributionFactorSchema),
  triggerEvents: z.array(UnifiedTimelineEventSchema),
  timestamp: TimestampSchema,
});
export type PriorityRiseAttributionResponse = z.infer<typeof PriorityRiseAttributionResponseSchema>;

// ============================================================================
// 5. Question 3: When was the patient last manually assessed?
// ============================================================================
export const LastManualAssessmentResponseSchema = z.object({
  patientId: z.string(),
  lastAssessedTimestamp: TimestampSchema.nullable(),
  referenceTimestamp: TimestampSchema,
  elapsedMinutes: z.number().nullable(),
  elapsedHuman: z.string(),
  assessedBy: z.string().nullable(),
  assessorRole: z.string().nullable(),
  assessmentType: z.enum(['MANUAL_OBSERVATION', 'NURSE_VISIT', 'CLINICAL_ACTION', 'NONE']),
  findings: z.string(),
  isOverdue: z.boolean(),
  overdueThresholdMinutes: z.number(),
});
export type LastManualAssessmentResponse = z.infer<typeof LastManualAssessmentResponseSchema>;

// ============================================================================
// 6. Question 4: Which measurements were trusted?
// ============================================================================
export const TrustedMeasurementItemSchema = z.object({
  observationId: z.string(),
  timestamp: TimestampSchema,
  vitalType: VitalTypeEnum,
  value: z.number(),
  unit: VitalUnitEnum,
  confidence: z.number(),
  source: ObservationSourceEnum,
  qualityStatus: z.string(),
  isTrusted: z.boolean(),
  untrustedReason: z.string().optional(),
});
export type TrustedMeasurementItem = z.infer<typeof TrustedMeasurementItemSchema>;

export const TrustedMeasurementsResponseSchema = z.object({
  patientId: z.string(),
  totalMeasurements: z.number(),
  trustedCount: z.number(),
  untrustedCount: z.number(),
  trustPercentage: z.number(),
  trustedMeasurements: z.array(TrustedMeasurementItemSchema),
  untrustedMeasurements: z.array(TrustedMeasurementItemSchema),
  commonSuppressionReasons: z.array(z.object({
    reason: z.string(),
    count: z.number(),
  })),
});
export type TrustedMeasurementsResponse = z.infer<typeof TrustedMeasurementsResponseSchema>;
