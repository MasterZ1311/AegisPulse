/**
 * Modified Early Warning Score (MEWS) Engine Adapter for APS
 * Grounded in Subbe et al. (QJM 2001; 94:521-526)
 * Validated bedside physiological assessment tool for detecting adult medical ward decompensation.
 * Delegates deterministic rule evaluation to the standalone @aegispulse/clinical/mews engine.
 */

import { calculateMEWS as calculateClinicalMEWS } from '../mews';
import type { MEWSInput as ClinicalMEWSInput } from '../mews';

export type MEWSInput = ClinicalMEWSInput;

export interface MEWSSubscores {
  sbp: number;
  hr: number;
  rr: number;
  temp: number;
  avpu: number;
}

export interface FullMEWSResult {
  score: number; // 0 to 14
  normalizedScore: number; // 0 to 100
  subscores: MEWSSubscores;
  triageLevel: 'green' | 'yellow' | 'red';
  isSevere: boolean;
  explanation: string;
}

/**
 * Calculates Subbe et al. MEWS score from vital parameters by delegating to the clinical rule layer.
 */
export function calculateMEWS(input: MEWSInput): FullMEWSResult {
  const clinicalResult = calculateClinicalMEWS(input, { skipValidation: true });
  const score = clinicalResult.totalScore;

  // Normalized score (0-100) with clinical inflection at severe threshold (score >= 5)
  let normalizedScore: number;
  if (score === 0) {
    normalizedScore = 0;
  } else if (score === 1) {
    normalizedScore = 15;
  } else if (score === 2) {
    normalizedScore = 30;
  } else if (score === 3) {
    normalizedScore = 45;
  } else if (score === 4) {
    normalizedScore = 60;
  } else if (score === 5) {
    normalizedScore = 75; // Clinical critical threshold
  } else {
    normalizedScore = Math.min(100, 75 + (score - 5) * 6);
  }

  const explanations: string[] = [];
  if (clinicalResult.subscores.systolicBP.contributing && input.systolicBP !== undefined) {
    const sbp = input.systolicBP;
    const band = sbp <= 70 ? '<=70' : sbp <= 80 ? '71-80' : sbp <= 100 ? '81-100' : '>=200';
    explanations.push(`SBP ${sbp} mmHg (${band}: ${clinicalResult.subscores.systolicBP.points} pts)`);
  }
  if (clinicalResult.subscores.heartRate.contributing && input.heartRate !== undefined) {
    const hr = input.heartRate;
    const band = hr <= 40 ? '<=40' : hr <= 50 ? '41-50' : hr >= 130 ? '>=130' : hr >= 111 ? '111-129' : '101-110';
    explanations.push(`HR ${hr} bpm (${band}: ${clinicalResult.subscores.heartRate.points} pts)`);
  }
  if (clinicalResult.subscores.respiratoryRate.contributing && input.respiratoryRate !== undefined) {
    const rr = input.respiratoryRate;
    const band = rr <= 8 ? '<=8' : rr >= 30 ? '>=30' : rr >= 21 ? '21-29' : '15-20';
    explanations.push(`RR ${rr}/min (${band}: ${clinicalResult.subscores.respiratoryRate.points} pts)`);
  }
  if (clinicalResult.subscores.temperature.contributing && input.temperature !== undefined) {
    const temp = input.temperature;
    const band = temp <= 35.0 ? '<=35.0' : '>=38.5';
    explanations.push(`Temp ${temp}°C (${band}: ${clinicalResult.subscores.temperature.points} pts)`);
  }
  if (clinicalResult.subscores.avpu.contributing && input.avpu !== undefined) {
    const avpuDesc = input.avpu === 'V' ? 'Responds to Voice' : input.avpu === 'P' ? 'Responds to Pain' : 'Unresponsive';
    explanations.push(`AVPU: ${avpuDesc} (${clinicalResult.subscores.avpu.points} pts)`);
  }

  const triageLevel = clinicalResult.triageLevel;
  const isSevere = clinicalResult.isSevere;

  const explanation =
    score === 0
      ? 'MEWS 0: Stable baseline physiological parameters'
      : `MEWS ${score} (${triageLevel.toUpperCase()}): ${explanations.join(', ')}`;

  return {
    score,
    normalizedScore,
    subscores: {
      sbp: clinicalResult.subscores.systolicBP.points,
      hr: clinicalResult.subscores.heartRate.points,
      rr: clinicalResult.subscores.respiratoryRate.points,
      temp: clinicalResult.subscores.temperature.points,
      avpu: clinicalResult.subscores.avpu.points,
    },
    triageLevel,
    isSevere,
    explanation,
  };
}
