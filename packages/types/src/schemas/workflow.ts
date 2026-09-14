import { z } from 'zod';
import {
  NurseWorkflowActionEnum,
  VerificationItemTypeEnum,
  AttentionPriorityCategoryEnum,
  AttentionReasonCodeEnum,
  UserRoleEnum,
  VitalTypeEnum,
  VitalUnitEnum,
} from '../enums';
import { TimestampSchema } from '../provenance';
import { AuditEventSchema } from './events';

// ============================================================================
// 1. Verification Protocol Item Schema
// ============================================================================
export const VerificationProtocolItemSchema = z.object({
  id: z.string().min(1),
  type: VerificationItemTypeEnum,
  title: z.string().min(1),
  description: z.string().min(1),
  rationale: z.string().min(1),
  urgency: AttentionPriorityCategoryEnum,
  targetWindowMinutes: z.number().min(1).max(240),
  isCompleted: z.boolean().default(false),
  completedAt: z.number().optional(),
  completedByUserId: z.string().optional(),
});
export type VerificationProtocolItem = z.infer<typeof VerificationProtocolItemSchema>;

// ============================================================================
// 2. Patient Verification Protocol Schema (Triage Guidance Bundle)
// ============================================================================
export const PatientVerificationProtocolSchema = z.object({
  patientId: z.string().min(1),
  bedNumber: z.string().min(1),
  apsScore: z.number().min(0).max(100),
  category: AttentionPriorityCategoryEnum,
  dominantReason: AttentionReasonCodeEnum.optional(),
  items: z.array(VerificationProtocolItemSchema).min(1),
  generatedAt: TimestampSchema,
  clinicalDisclaimer: z.string().default(
    'Decision-support protocol only. Does not autonomously diagnose disease or prescribe treatment. Professional clinical judgment required.'
  ),
});
export type PatientVerificationProtocol = z.infer<typeof PatientVerificationProtocolSchema>;

// ============================================================================
// 3. New Observation Entry (Bedside Verified Vital Sign)
// ============================================================================
export const NewObservationEntrySchema = z.object({
  vitalType: VitalTypeEnum,
  value: z.number(),
  unit: VitalUnitEnum,
  confidence: z.number().min(0).max(1.0).default(1.0),
});
export type NewObservationEntry = z.infer<typeof NewObservationEntrySchema>;

// ============================================================================
// 4. Workflow Action Payload (Human Action Input)
// ============================================================================
export const WorkflowActionPayloadSchema = z.object({
  action: NurseWorkflowActionEnum,
  patientId: z.string().min(1),
  bedNumber: z.string().min(1),
  actorId: z.string().min(1),
  actorRole: UserRoleEnum.default('WARD_NURSE'),
  notes: z.string().optional(),
  dismissReason: z.string().optional(),
  escalationTarget: z
    .enum(['PHYSICIAN_SBAR', 'RAPID_RESPONSE', 'CHARGE_NURSE'])
    .optional(),
  falsePositiveReason: z
    .enum([
      'SENSOR_DISLODGED',
      'MOTION_ARTIFACT',
      'AMBULATING',
      'COUGH_TRANSIENT',
      'EQUIPMENT_NOISE',
      'OTHER',
    ])
    .optional(),
  newObservations: z.array(NewObservationEntrySchema).optional(),
  timestamp: z.number().optional(),
});
export type WorkflowActionPayload = z.infer<typeof WorkflowActionPayloadSchema>;

// ============================================================================
// 5. Workflow Action Result
// ============================================================================
export const WorkflowActionResultSchema = z.object({
  success: z.boolean(),
  action: NurseWorkflowActionEnum,
  patientId: z.string().min(1),
  bedNumber: z.string().min(1),
  previousState: z.string(),
  newState: z.string(),
  auditEvent: AuditEventSchema,
  disclaimer: z.string(),
  notes: z.string().optional(),
});
export type WorkflowActionResult = z.infer<typeof WorkflowActionResultSchema>;
