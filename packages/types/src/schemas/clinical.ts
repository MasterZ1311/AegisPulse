import { z } from 'zod';
import {
  AttentionPriorityCategoryEnum,
  AttentionReasonCodeEnum,
  ClinicalActionTypeEnum,
  ClinicalActionStatusEnum,
  CodeStatusEnum,
} from '../enums';
import { TimestampSchema, TargetTimestampSchema, ProvenanceSchema } from '../provenance';

// ============================================================================
// 1. Clinical Context (Acuity & Comorbidity Envelope)
// ============================================================================
export const OxygenDeliveryModalityEnum = z.enum([
  'ROOM_AIR',
  'NASAL_CANNULA',
  'SIMPLE_MASK',
  'VENTURI_MASK',
  'NON_REBREATHER',
  'HIGH_FLOW_NASAL_CANNULA',
  'NON_INVASIVE_VENTILATION',
  'MECHANICAL_VENTILATION',
]);
export type OxygenDeliveryModality = z.infer<typeof OxygenDeliveryModalityEnum>;

export const IsolationStatusEnum = z.enum([
  'NONE',
  'CONTACT',
  'DROPLET',
  'AIRBORNE',
  'PROTECTIVE',
]);
export type IsolationStatus = z.infer<typeof IsolationStatusEnum>;

export const ClinicalContextSchema = z.object({
  id: z.string().min(1, 'Clinical context ID is required'),
  patientId: z.string().min(1, 'Patient ID is required'),
  admissionReason: z.string().min(1, 'Admission reason is required'),
  postOpDay: z
    .number()
    .int('Post-op day must be an integer')
    .min(0, 'Post-op day cannot be negative')
    .max(120, 'Post-op day exceeds ward horizon')
    .optional(),
  comorbidities: z.array(z.string()),
  codeStatus: CodeStatusEnum,
  oxygenDelivery: OxygenDeliveryModalityEnum,
  o2FlowRateLpm: z
    .number()
    .min(0, 'Flow rate cannot be negative')
    .max(70, 'O2 flow rate exceeds clinical delivery limits')
    .optional(),
  isolationStatus: IsolationStatusEnum,
  baselineMEWS: z
    .number()
    .int('Baseline MEWS must be an integer')
    .min(0, 'MEWS cannot be negative')
    .max(14, 'MEWS maximum is 14'),
  updatedAt: TimestampSchema,
});
export type ClinicalContext = z.infer<typeof ClinicalContextSchema>;

// ============================================================================
// 2. Laboratory Results (Quantitative Biomarkers)
// ============================================================================
export const LabTestCodeEnum = z.enum([
  'LACTATE',
  'WBC',
  'CREATININE',
  'PLATELETS',
  'CRP',
  'HEMOGLOBIN',
  'SODIUM',
  'POTASSIUM',
]);
export type LabTestCode = z.infer<typeof LabTestCodeEnum>;

export const LabUnitEnum = z.enum([
  'MMOL_PER_L',
  'X10_9_PER_L',
  'MG_PER_DL',
  'MG_PER_L',
  'G_PER_DL',
  'MEQ_PER_L',
]);
export type LabUnit = z.infer<typeof LabUnitEnum>;

// Physiological sanity limits for lab values
export const LAB_LIMITS = {
  LACTATE: { min: 0.1, max: 30.0, unit: LabUnitEnum.enum.MMOL_PER_L },
  WBC: { min: 0.1, max: 150.0, unit: LabUnitEnum.enum.X10_9_PER_L },
  CREATININE: { min: 0.1, max: 25.0, unit: LabUnitEnum.enum.MG_PER_DL },
  PLATELETS: { min: 1, max: 2500, unit: LabUnitEnum.enum.X10_9_PER_L },
  CRP: { min: 0.1, max: 500.0, unit: LabUnitEnum.enum.MG_PER_L },
  HEMOGLOBIN: { min: 2.0, max: 25.0, unit: LabUnitEnum.enum.G_PER_DL },
  SODIUM: { min: 90, max: 190, unit: LabUnitEnum.enum.MEQ_PER_L },
  POTASSIUM: { min: 1.0, max: 10.0, unit: LabUnitEnum.enum.MEQ_PER_L },
} as const;

export const LaboratoryResultSchema = z
  .object({
    id: z.string().min(1, 'Lab result ID is required'),
    patientId: z.string().min(1, 'Patient ID is required'),
    timestamp: TimestampSchema,
    testCode: LabTestCodeEnum,
    testName: z.string().min(1, 'Test name is required'),
    value: z.number(),
    unit: LabUnitEnum,
    referenceRange: z.object({
      low: z.number(),
      high: z.number(),
    }),
    isCritical: z.boolean(),
    sourceLab: z.string().min(1, 'Source laboratory name is required'),
  })
  .superRefine((lab, ctx) => {
    const limits = LAB_LIMITS[lab.testCode];
    if (limits && (lab.value < limits.min || lab.value > limits.max)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Lab value ${lab.value} is outside clinical sanity limits for ${lab.testCode} [${limits.min}, ${limits.max}]`,
      });
    }
  });
export type LaboratoryResult = z.infer<typeof LaboratoryResultSchema>;

// ============================================================================
// 3. Attention Reason (Auditable Driver)
// ============================================================================
export const AttentionReasonSchema = z.object({
  code: AttentionReasonCodeEnum,
  description: z.string().min(1, 'Reason description is required'),
  contributionWeight: z
    .number()
    .min(0.0, 'Weight must be >= 0.0')
    .max(1.0, 'Weight must be <= 1.0'),
  triggerValue: z.number(),
  thresholdValue: z.number(),
  unit: z.string(),
  urgency: AttentionPriorityCategoryEnum,
});
export type AttentionReason = z.infer<typeof AttentionReasonSchema>;

// ============================================================================
// 4. Attention Priority (System Master Output) - Strictly Retains Provenance
// ============================================================================
export const AttentionPrioritySchema = z.object({
  id: z.string().min(1, 'Attention priority ID is required'),
  patientId: z.string().min(1, 'Patient ID is required'),
  bedNumber: z.string().min(1, 'Bed number is required'),
  apsScore: z
    .number()
    .min(0, 'APS score cannot be below 0')
    .max(100, 'APS score cannot exceed 100'),
  wardRank: z
    .number()
    .int('Ward rank must be an integer')
    .min(1, 'Ward rank must be at least 1'),
  category: AttentionPriorityCategoryEnum,
  reasons: z.array(AttentionReasonSchema).min(1, 'At least one attention reason must be provided'),
  velocityScore: z.number().min(0).max(100),
  decayScore: z.number().min(0).max(100),
  mewsComponent: z.number().min(0).max(100),
  biomarkerComponent: z.number().min(0).max(100),
  informationAgeMinutes: z.number().min(0, 'Information age cannot be negative'),
  signalConfidence: z.number().min(0).max(100),
  recommendedAction: z.string().min(1, 'Recommended clinical action is required'),
  calculatedAt: TimestampSchema,
  provenance: ProvenanceSchema, // MANDATORY: Every derived attention score must retain provenance
});
export type AttentionPriority = z.infer<typeof AttentionPrioritySchema>;

// ============================================================================
// 5. Clinical Action (Prescribed Nurse Workflow)
// ============================================================================
export const ClinicalActionSchema = z.object({
  id: z.string().min(1, 'Action ID is required'),
  patientId: z.string().min(1, 'Patient ID is required'),
  bedId: z.string().min(1, 'Bed ID is required'),
  actionType: ClinicalActionTypeEnum,
  title: z.string().min(1, 'Action title is required'),
  rationale: z.string().min(1, 'Clinical rationale is required'),
  status: ClinicalActionStatusEnum,
  urgency: AttentionPriorityCategoryEnum,
  recommendedAt: TimestampSchema,
  targetCompletionTimestamp: TargetTimestampSchema,
  completedAt: TimestampSchema.optional(),
  completedByUserId: z.string().optional(),
  outcomeNotes: z.string().optional(),
});
export type ClinicalAction = z.infer<typeof ClinicalActionSchema>;
