/**
 * MEWS Domain Types (Subbe et al. 2001)
 */

export interface MEWSInput {
  systolicBP?: number;
  heartRate?: number;
  respiratoryRate?: number;
  temperature?: number;
  avpu?: 'A' | 'V' | 'P' | 'U';
}

export interface MEWSSubscore {
  rawValue?: number | string;
  points: number;
  contributing: boolean;
  missing: boolean;
  thresholdTriggered?: string;
}

export interface MEWSContributingVariable {
  variable: 'systolicBP' | 'heartRate' | 'respiratoryRate' | 'temperature' | 'avpu';
  name: string;
  value: number | string;
  unit: string;
  points: number;
  interpretation: string;
}

export interface MEWSResult {
  totalScore: number; // Sum of points for verified parameters (0 to 14)
  maxPossibleScore: number; // Upper bound if missing parameters were maximal
  uncertainty: number; // Fraction (0.0 to 1.0) of score uncertain due to missing parameters
  missingValues: (keyof MEWSInput)[];
  contributingVariables: MEWSContributingVariable[];
  subscores: {
    systolicBP: MEWSSubscore;
    heartRate: MEWSSubscore;
    respiratoryRate: MEWSSubscore;
    temperature: MEWSSubscore;
    avpu: MEWSSubscore;
  };
  triageLevel: 'green' | 'yellow' | 'red';
  isSevere: boolean; // totalScore >= 5
  timestamp: number;
}

export interface MEWSValidationResult {
  valid: boolean;
  errors: string[];
  sanitizedInput?: MEWSInput;
}

export interface MEWSExplanation {
  summary: string;
  triageLevel: 'green' | 'yellow' | 'red';
  details: string[];
  missingDataWarning?: string;
  clinicalEscalation: string;
}

export interface MEWSThresholdBand {
  min?: number;
  max?: number;
  value?: string;
  points: number;
  label: string;
}

export interface MEWSThresholds {
  systolicBP: MEWSThresholdBand[];
  heartRate: MEWSThresholdBand[];
  respiratoryRate: MEWSThresholdBand[];
  temperature: MEWSThresholdBand[];
  avpu: MEWSThresholdBand[];
  criticalScoreThreshold: number; // 5
}
