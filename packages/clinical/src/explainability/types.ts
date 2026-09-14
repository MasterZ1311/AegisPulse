import type { VitalType } from '@aegispulse/types';

/**
 * Clinical categories for explainability reasons
 */
export type ReasonCategory =
  | 'PHYSIOLOGICAL_VELOCITY'
  | 'SUSTAINED_ABNORMALITY'
  | 'BASELINE_DEVIATION'
  | 'INFORMATION_DECAY'
  | 'SIGNAL_CONFIDENCE'
  | 'HEMODYNAMIC_INSTABILITY'
  | 'SEPSIS_RISK'
  | 'BIOMARKER_CRITICAL'
  | 'MISSING_TELEMETRY'
  | 'PHYSIOLOGICAL_STABILITY';

/**
 * Urgency severity levels for triage reasons
 */
export type ReasonSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/**
 * Concrete supporting evidence grounded in verified measurements
 */
export interface ReasonEvidence {
  vitalType?: VitalType;
  labCode?: string;
  currentValue: number;
  referenceValue?: number; // Baseline or safe biological threshold
  unit: string;
  timeWindowMinutes?: number;
  changePercentage?: number;
  observationIds: string[];
  measuredAt: number;
}

/**
 * Relative contribution of this reason to the overall Attention Priority Score
 */
export interface ReasonContribution {
  normalizedWeight: number; // 0.0 to 1.0
  scoreImpact: number; // Approximate points (0-100) contributed to final APS
  percentageOfTotal: number; // Percentage of total active score driven by this reason
}

/**
 * Traceable clinical calculation provenance:
 * patient -> observation -> calculation -> reason
 */
export interface ReasonProvenance {
  patientId: string;
  sourceObservationIds: string[];
  calculation: {
    algorithm: string;
    formula: string;
    inputs: Record<string, unknown>;
  };
  derivedAt: number;
}

/**
 * An individual clinical explanation reason
 */
export interface Reason {
  id: string;
  patientId: string;
  category: ReasonCategory;
  severity: ReasonSeverity;
  evidence: ReasonEvidence;
  contribution: ReasonContribution;
  timestamp: number;
  humanReadableExplanation: string;
  provenance: ReasonProvenance;
  priorityRank?: number; // 1, 2, 3...
}

/**
 * Configuration options for the Explainability Engine
 */
export interface ExplainabilityOptions {
  maxReasons?: number; // Default: 4 (within 3 to 5 range)
  minSeverity?: ReasonSeverity;
  enableDiversityFilter?: boolean; // Default: true
}

/**
 * Output of the Explainability Engine answering:
 * "Why is this patient higher priority right now?"
 */
export interface ExplainabilityResult {
  patientId: string;
  timestamp: number;
  primaryExplanation: string;
  reasons: Reason[]; // Curated top 3-5 reasons
  allCandidateReasonsCount: number;
  apsScore: number;
}
