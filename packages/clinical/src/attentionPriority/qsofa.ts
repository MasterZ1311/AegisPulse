/**
 * quick Sepsis-related Organ Failure Assessment (qSOFA) Engine Adapter for APS
 * Grounded in Singer et al. (JAMA 2016; 315(8):801-810 - Sepsis-3 Consensus)
 * Bedside tool identifying adult ward patients with suspected infection at high risk of death or prolonged ICU stay.
 * Delegates deterministic rule evaluation to the standalone @aegispulse/clinical/qsofa engine.
 */

import { calculateQSOFA as calculateClinicalQSOFA } from '../qsofa';
import type { QSOFAInput as ClinicalQSOFAInput } from '../qsofa';

export type QSOFAInput = ClinicalQSOFAInput;

export interface QSOFAResult {
  score: number; // 0 to 3
  normalizedScore: number; // 0 to 100
  isPositive: boolean; // score >= 2 indicates high risk
  criteriaMet: {
    tachypnea: boolean;
    alteredMentation: boolean;
    hypotension: boolean;
  };
  explanation: string;
}

/**
 * Calculates Sepsis-3 qSOFA score from bedside parameters by delegating to the clinical rule layer.
 */
export function calculateQSOFA(input: QSOFAInput): QSOFAResult {
  const clinicalResult = calculateClinicalQSOFA(input, { skipValidation: true });
  const score = clinicalResult.totalScore;

  const tachypnea = clinicalResult.subscores.respiratoryRate.points > 0;
  const alteredMentation = clinicalResult.subscores.alteredMentation.points > 0;
  const hypotension = clinicalResult.subscores.systolicBP.points > 0;

  // Normalization: qSOFA >= 2 is high mortality risk (Sepsis-3 consensus)
  let normalizedScore: number;
  if (score === 0) {
    normalizedScore = 0;
  } else if (score === 1) {
    normalizedScore = 35;
  } else if (score === 2) {
    normalizedScore = 80; // Positive sepsis screen
  } else {
    normalizedScore = 100;
  }

  const isPositive = clinicalResult.isPositive;
  const criteriaExplanations: string[] = [];

  if (tachypnea) {
    criteriaExplanations.push(`RR ${input.respiratoryRate}/min >= 22`);
  }
  if (alteredMentation) {
    criteriaExplanations.push(`Altered mentation (AVPU=${input.avpu ?? input.gcs})`);
  }
  if (hypotension) {
    criteriaExplanations.push(`SBP ${input.systolicBP} mmHg <= 100`);
  }

  const explanation = isPositive
    ? `qSOFA positive (${score}/3): ${criteriaExplanations.join(', ')} - high sepsis risk`
    : score === 1
      ? `qSOFA 1/3: ${criteriaExplanations.join(', ')} - monitor for sepsis development`
      : 'qSOFA 0/3: No bedside sepsis organ dysfunction criteria met';

  return {
    score,
    normalizedScore,
    isPositive,
    criteriaMet: {
      tachypnea,
      alteredMentation,
      hypotension,
    },
    explanation,
  };
}
