import { z } from 'zod';
import {
  AttentionPriorityCategoryEnum,
  PriorityChangeClassificationEnum,
  PolicyActionEnum,
  SuppressionReasonEnum,
  AttentionReasonCodeEnum,
} from '../enums';
import { TimestampSchema } from '../provenance';
import { AlertSchema } from './events';

// ============================================================================
// 1. Attention Policy Configuration Schema
// ============================================================================
export const AttentionPolicyConfigSchema = z.object({
  hysteresisMargin: z.number().min(1).max(20).default(6),
  persistenceWindowMs: z.number().min(0).max(600000).default(45000), // 45s default
  deEscalationWindowMs: z.number().min(0).max(1800000).default(120000), // 120s default
  cooldownPeriodMs: z.number().min(0).max(3600000).default(180000), // 3m default
  duplicateSuppressionWindowMs: z.number().min(0).max(3600000).default(300000), // 5m default
  reAlertIntervalMs: z.number().min(0).max(7200000).default(900000), // 15m default
  acknowledgementGracePeriodMs: z.number().min(0).max(7200000).default(900000), // 15m default
  fastPathMinScore: z.number().min(70).max(100).default(85),
  risingPriorityMinDelta: z.number().min(5).max(50).default(15),
  signalFailureConfidenceThreshold: z.number().min(0.0).max(1.0).default(0.35),
});
export type AttentionPolicyConfig = z.infer<typeof AttentionPolicyConfigSchema>;

// ============================================================================
// 2. Patient Attention State Schema (Stateful Per-Patient Lifecycle Tracker)
// ============================================================================
export const PatientAttentionStateSchema = z.object({
  patientId: z.string().min(1),
  bedNumber: z.string().min(1),
  confirmedCategory: AttentionPriorityCategoryEnum.default('LOW'),
  confirmedScore: z.number().min(0).max(100).default(0),
  activeAlert: AlertSchema.optional(),
  activeAlertId: z.string().optional(),
  candidateCategory: AttentionPriorityCategoryEnum.optional(),
  candidateFirstSeenTimestamp: z.number().optional(),
  candidateScore: z.number().optional(),
  candidateSampleCount: z.number().default(0),
  deEscalationFirstSeenTimestamp: z.number().optional(),
  lastNotificationTimestamp: z.number().optional(),
  lastAcknowledgedTimestamp: z.number().optional(),
  acknowledgedUntilTimestamp: z.number().optional(),
  acknowledgedByUserId: z.string().optional(),
  lastReasonCodes: z.array(AttentionReasonCodeEnum).default([]),
  updatedAt: TimestampSchema,
});
export type PatientAttentionState = z.infer<typeof PatientAttentionStateSchema>;

// ============================================================================
// 3. Attention Policy Event Schema (Engine Output Envelope)
// ============================================================================
export const AttentionPolicyEventSchema = z.object({
  id: z.string().min(1),
  patientId: z.string().min(1),
  bedNumber: z.string().min(1),
  timestamp: TimestampSchema,
  classification: PriorityChangeClassificationEnum,
  action: PolicyActionEnum,
  currentCategory: AttentionPriorityCategoryEnum,
  previousCategory: AttentionPriorityCategoryEnum,
  currentScore: z.number().min(0).max(100),
  previousScore: z.number().min(0).max(100),
  scoreDelta: z.number(),
  isEscalation: z.boolean(),
  alert: AlertSchema.optional(),
  suppressionReason: SuppressionReasonEnum.optional(),
  suppressionDetail: z.string().optional(),
  persistenceProgress: z
    .object({
      requiredMs: z.number(),
      elapsedMs: z.number(),
      isMet: z.boolean(),
    })
    .optional(),
  hysteresisMargin: z
    .object({
      currentScore: z.number(),
      upwardThreshold: z.number(),
      downwardThreshold: z.number(),
      margin: z.number(),
    })
    .optional(),
  reasons: z.array(AttentionReasonCodeEnum).default([]),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
});
export type AttentionPolicyEvent = z.infer<typeof AttentionPolicyEventSchema>;

// ============================================================================
// 4. Policy Benchmark & Quantitative Metrics Schema
// ============================================================================
export const PolicyMetricsSchema = z.object({
  totalEvaluations: z.number().int().min(0),
  alertCount: z.number().int().min(0),
  repeatedAlerts: z.number().int().min(0),
  suppressedCount: z.number().int().min(0),
  falseEscalations: z.number().int().min(0),
  confirmedEscalations: z.number().int().min(0),
  meanEscalationDelayMs: z.number().min(0),
  maxEscalationDelayMs: z.number().min(0),
  suppressionRatio: z.number().min(0).max(1.0),
  flappingEventsAvoided: z.number().int().min(0),
});
export type PolicyMetrics = z.infer<typeof PolicyMetricsSchema>;
