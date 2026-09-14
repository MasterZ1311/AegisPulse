/**
 * quick Sepsis-related Organ Failure Assessment (qSOFA) Engine
 * Grounded in Singer et al. (JAMA 2016; 315(8):801-810 - Sepsis-3 Consensus)
 * Bedside tool identifying adult ward patients with suspected infection at high risk of death or prolonged ICU stay.
 */

export interface QSOFAInput {
  respiratoryRate?: number;
  systolicBP?: number;
  avpu?: 'A' | 'V' | 'P' | 'U';
}

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
 * Calculates Sepsis-3 qSOFA score from bedside parameters.
 */
export function calculateQSOFA(input: QSOFAInput): QSOFAResult {
  const tachypnea = (input.respiratoryRate ?? 0) >= 22;
  const alteredMentation = input.avpu !== undefined && input.avpu !== 'A';
  const hypotension = input.systolicBP !== undefined && input.systolicBP <= 100;

  let score = 0;
  const criteriaExplanations: string[] = [];

  if (tachypnea) {
    score += 1;
    criteriaExplanations.push(`RR ${input.respiratoryRate}/min >= 22`);
  }
  if (alteredMentation) {
    score += 1;
    criteriaExplanations.push(`Altered mentation (AVPU=${input.avpu})`);
  }
  if (hypotension) {
    score += 1;
    criteriaExplanations.push(`SBP ${input.systolicBP} mmHg <= 100`);
  }

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

  const isPositive = score >= 2;
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
