import type {
  AttentionPriorityCategory,
  CodeStatus,
  Gender,
  LaboratoryResult,
  Observation,
  SBARReport,
  UnifiedTimelineEvent,
  VitalType,
  ClinicalContext,
} from '@aegispulse/types';
import type {
  AttentionPriorityResult,
  PatientBaselineVitals,
} from '../attentionPriority/types';

/**
 * Verified patient demographic and administrative context.
 */
export interface SbarPatientInfo {
  id: string;
  bedNumber: string;
  name?: string;
  age?: number;
  gender?: Gender;
  codeStatus?: CodeStatus;
  admissionReason?: string;
  postOpDay?: number;
  comorbidities?: string[];
}

/**
 * Strict verified input data envelope for SBAR generation.
 * Invariant: Inputs come ONLY from verified patient data and explicit observations.
 */
export interface SbarInputData {
  patient: SbarPatientInfo;
  apsResult: AttentionPriorityResult;
  observations: Observation[];
  baseline?: PatientBaselineVitals;
  clinicalContext?: ClinicalContext;
  labs?: LaboratoryResult[];
  recentTimelineEvents?: UnifiedTimelineEvent[];
  nurseNotes?: string[];
  currentTimestamp?: number;
}

/**
 * Inventory of missing information.
 * Invariant: When information is missing, explicitly state it is missing.
 */
export interface SbarMissingDataInventory {
  missingVitals: VitalType[];
  missingLabs: boolean;
  missingBaseline: boolean;
  missingComorbidities: boolean;
  missingAdmissionReason: boolean;
}

/**
 * Generated SBAR Report conforming to SBARReport from @aegispulse/types.
 */
export interface GeneratedSbar extends SBARReport {
  missingDataInventory: SbarMissingDataInventory;
  isAiEnhanced?: boolean;
  aiSummary?: string;
}

/**
 * Output of the optional AI-assisted summarization layer.
 */
export interface AISbarResult {
  enhancedSbar: GeneratedSbar;
  executiveHandoffNote: string;
  readOnlyAudit: {
    verifiedUnalteredAps: number;
    verifiedUnalteredCategory: AttentionPriorityCategory;
    preservedObservationCount: number;
    validatedAt: number;
  };
}
