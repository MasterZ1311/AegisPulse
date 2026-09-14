/**
 * qSOFA Domain Types (Singer et al. JAMA 2016 Sepsis-3)
 */

export interface QSOFAInput {
  respiratoryRate?: number;
  systolicBP?: number;
  avpu?: 'A' | 'V' | 'P' | 'U';
  gcs?: number; // Optional Glasgow Coma Scale [3, 15]
}

export interface QSOFASubscore {
  rawValue?: number | string;
  points: number; // 0 or 1
  contributing: boolean;
  missing: boolean;
  criterion: string;
}

export interface QSOFAContributingVariable {
  variable: 'respiratoryRate' | 'systolicBP' | 'alteredMentation';
  name: string;
  value: number | string;
  unit: string;
  points: number;
  interpretation: string;
}

export interface QSOFAResult {
  totalScore: number; // Sum of points for verified parameters (0 to 3)
  maxPossibleScore: number; // Upper bound if missing parameters were positive
  uncertainty: number; // Fraction (0.0 to 1.0) of score uncertain due to missing parameters
  missingValues: ('respiratoryRate' | 'systolicBP' | 'alteredMentation')[];
  contributingVariables: QSOFAContributingVariable[];
  subscores: {
    respiratoryRate: QSOFASubscore;
    systolicBP: QSOFASubscore;
    alteredMentation: QSOFASubscore;
  };
  isPositive: boolean; // totalScore >= 2
  timestamp: number;
}

export interface QSOFAValidationResult {
  valid: boolean;
  errors: string[];
  sanitizedInput?: QSOFAInput;
}

export interface QSOFAExplanation {
  summary: string;
  isPositive: boolean;
  details: string[];
  missingDataWarning?: string;
  clinicalEscalation: string;
}

export interface QSOFAThresholds {
  respiratoryRate: {
    threshold: number; // >= 22
    points: number; // 1
    label: string;
  };
  systolicBP: {
    threshold: number; // <= 100
    points: number; // 1
    label: string;
  };
  alteredMentation: {
    gcsThreshold: number; // < 15
    avpuAbnormal: ('V' | 'P' | 'U')[];
    points: number; // 1
    label: string;
  };
  positiveScreenThreshold: number; // 2
}
