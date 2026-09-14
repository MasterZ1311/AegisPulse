import type {
  Observation,
  SignalQuality,
  ClinicalContext,
  LaboratoryResult,
  AttentionReason,
  AttentionPriorityCategory,
  ClinicalActionType,
  Provenance,
  QualityStatus,
  VitalType,
} from '@aegispulse/types';

/**
 * Expected baseline physiological parameters for an individual patient.
 */
export interface PatientBaselineVitals {
  heartRate?: number;
  respiratoryRate?: number;
  systolicBP?: number;
  diastolicBP?: number;
  spo2?: number;
  temperature?: number;
}

/**
 * Atomic vital reading extracted from observation time series.
 */
export interface VitalReading {
  value: number;
  timestamp: number;
  confidence: number;
  qualityStatus: QualityStatus;
  sourceObservationId: string;
}

/**
 * Extracted vital readings dictionary across vital modalities.
 */
export type ExtractedVitals = Partial<Record<VitalType, VitalReading>>;
export type ExtractedVitalHistory = Partial<Record<VitalType, VitalReading[]>>;

/**
 * Comprehensive input payload representing an evaluated patient state.
 */
export interface PatientStateInput {
  patientId: string;
  bedNumber: string;
  currentTimestamp?: number;
  observations: Observation[];
  baseline?: PatientBaselineVitals;
  clinicalContext?: ClinicalContext;
  labs?: LaboratoryResult[];
  latestSignalQuality?: SignalQuality;
  avpu?: 'A' | 'V' | 'P' | 'U';
  lastTrustedObservationTimestamp?: number;
}

/**
 * Audit-ready component score conforming to the deterministic component contract.
 */
export interface ComponentScore {
  componentName: string;
  normalizedContribution: number; // 0.0 to 100.0
  rawScore: number;
  weight: number;
  weightedContribution: number;
  explanation: string;
  provenance: Provenance;
  reasons: AttentionReason[];
  recommendedActions: ClinicalActionType[];
  metadata?: Record<string, unknown>;
}

/**
 * Rank inputs detailing every scoring component contribution for ward sorting and triage.
 */
export interface RankInputs {
  abnormality: ComponentScore;
  baselineDeviation: ComponentScore;
  velocity: ComponentScore;
  persistence: ComponentScore;
  informationDecay: ComponentScore;
  signalConfidence: ComponentScore;
  mews: ComponentScore;
  qsofa: ComponentScore;
  biomarkers: ComponentScore;
  missingInfo: ComponentScore;
}

/**
 * Recommended clinical action structure.
 */
export interface ClinicalActionRecommended {
  actionType: ClinicalActionType;
  title: string;
  rationale: string;
  urgency: AttentionPriorityCategory;
  targetCompletionWindowMinutes: number;
}

/**
 * Attention Priority Result
 * Output of the central Attention Priority Engine.
 * Conforms both to specific user-requested properties (score, category, rankInputs, reasons, recommendedActions, confidence, timestamp)
 * and the strict AttentionPriority schema from @aegispulse/types.
 */
export interface AttentionPriorityResult {
  id: string;
  patientId: string;
  bedNumber: string;
  score: number; // 0 to 100 bounded
  apsScore: number; // Alias matching AttentionPrioritySchema
  category: AttentionPriorityCategory;
  rankInputs: RankInputs;
  reasons: AttentionReason[];
  recommendedActions: ClinicalActionRecommended[];
  recommendedAction: string; // Primary action string matching AttentionPrioritySchema
  confidence: number; // 0 to 100
  signalConfidence: number; // Alias matching AttentionPrioritySchema
  timestamp: number;
  calculatedAt: number; // Alias matching AttentionPrioritySchema
  wardRank: number; // Rank among ward beds (1 = highest priority)
  velocityScore: number;
  decayScore: number;
  mewsComponent: number;
  biomarkerComponent: number;
  informationAgeMinutes: number;
  provenance: Provenance;
}
