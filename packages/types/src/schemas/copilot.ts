import { z } from 'zod';
import {
  CopilotQueryTypeEnum,
  CopilotRefusalReasonEnum,
  AttentionPriorityCategoryEnum,
  VitalTypeEnum,
  VitalUnitEnum,
  ObservationSourceEnum,
  QualityStatusEnum,
  GenderEnum,
  CodeStatusEnum,
  UserRoleEnum,
} from '../enums';
import { TimestampSchema } from '../provenance';

// ============================================================================
// 1. Source Reference Schema (Explicit Citations)
// ============================================================================
export const CopilotSourceReferenceSchema = z.object({
  observationId: z.string().optional(),
  vitalType: VitalTypeEnum.optional(),
  value: z.union([z.string(), z.number()]).optional(),
  label: z.string().min(1),
  timestamp: TimestampSchema.optional(),
  sourceChannel: z.string().optional(),
});
export type CopilotSourceReference = z.infer<typeof CopilotSourceReferenceSchema>;

// ============================================================================
// 2. Structured Evidence Package Schema (Bounded Read-Only Evidence)
// ============================================================================
export const StructuredEvidencePackageSchema = z.object({
  patientId: z.string().min(1),
  bedNumber: z.string().min(1),
  patientName: z.string().optional(),
  age: z.number().optional(),
  gender: GenderEnum.optional(),
  codeStatus: CodeStatusEnum.optional(),
  admissionReason: z.string().optional(),
  comorbidities: z.array(z.string()).default([]),
  verifiedVitals: z
    .record(
      z.string(),
      z.object({
        vitalType: VitalTypeEnum,
        value: z.number(),
        unit: VitalUnitEnum,
        timestamp: TimestampSchema,
        source: ObservationSourceEnum.optional(),
        observationId: z.string(),
        qualityStatus: QualityStatusEnum,
      })
    )
    .default({}),
  missingVitals: z.array(VitalTypeEnum).default([]),
  apsScore: z.number().min(0).max(100),
  priorityCategory: AttentionPriorityCategoryEnum,
  wardRank: z.number().int().min(1),
  dominantReasons: z.array(z.string()).default([]),
  mewsScore: z.number().default(0),
  shockIndex: z.number().optional(),
  recentLabs: z
    .array(
      z.object({
        testCode: z.string(),
        testName: z.string(),
        value: z.number(),
        unit: z.string(),
        timestamp: TimestampSchema,
        isCritical: z.boolean().default(false),
      })
    )
    .default([]),
  timelineSummary: z
    .array(
      z.object({
        eventId: z.string(),
        timestamp: TimestampSchema,
        eventType: z.string(),
        title: z.string(),
        description: z.string(),
      })
    )
    .default([]),
  contextHash: z.string().min(1),
  generatedAt: TimestampSchema,
});
export type StructuredEvidencePackage = z.infer<typeof StructuredEvidencePackageSchema>;

// ============================================================================
// 3. Copilot Response Schema (Audited Output Envelope)
// ============================================================================
export const CopilotResponseSchema = z.object({
  id: z.string().min(1),
  patientId: z.string().min(1),
  bedNumber: z.string().min(1),
  queryType: CopilotQueryTypeEnum,
  query: z.string().min(1),
  status: z.enum(['SUCCESS', 'REFUSED']),
  answer: z.string(),
  refusalReason: CopilotRefusalReasonEnum.optional(),
  refusalExplanation: z.string().optional(),
  sourceReferences: z.array(CopilotSourceReferenceSchema).default([]),
  missingDataIdentified: z.array(z.string()).default([]),
  disclaimer: z.string(),
  timestamp: TimestampSchema,
  auditLogId: z.string().min(1),
});
export type CopilotResponse = z.infer<typeof CopilotResponseSchema>;

// ============================================================================
// 4. Copilot Audit Record Schema (HIPAA / Med-Device Regulatory Ledger)
// ============================================================================
export const CopilotAuditRecordSchema = z.object({
  id: z.string().min(1),
  timestamp: TimestampSchema,
  actorId: z.string().min(1),
  actorRole: UserRoleEnum,
  patientId: z.string().min(1),
  query: z.string(),
  sanitizedQuery: z.string(),
  queryType: CopilotQueryTypeEnum,
  status: z.enum(['SUCCESS', 'REFUSED']),
  refusalReason: CopilotRefusalReasonEnum.optional(),
  contextHash: z.string(),
  sourceReferenceCount: z.number().int().min(0),
  responseTimeMs: z.number().min(0),
});
export type CopilotAuditRecord = z.infer<typeof CopilotAuditRecordSchema>;
