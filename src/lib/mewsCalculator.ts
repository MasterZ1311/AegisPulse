import type { TriageLevel } from './types';

export interface MEWSInput {
  heartRate: number;
  systolicBP: number;
  respiratoryRate: number;
  temperature: number;
  avpu: 'A' | 'V' | 'P' | 'U'; // Alert, Voice, Pain, Unresponsive
}

export interface MEWSResult {
  score: number;
  triageLevel: TriageLevel;
  breakdown: {
    heartRateScore: number;
    systolicBPScore: number;
    respiratoryRateScore: number;
    temperatureScore: number;
    avpuScore: number;
  };
  recommendation: string;
}

export function calculateMEWS(input: MEWSInput): MEWSResult {
  const { heartRate, systolicBP, respiratoryRate, temperature, avpu } = input;

  // Heart Rate Score
  let hrScore = 0;
  if (heartRate <= 40) hrScore = 2;
  else if (heartRate <= 50) hrScore = 1;
  else if (heartRate <= 100) hrScore = 0;
  else if (heartRate <= 110) hrScore = 1;
  else if (heartRate <= 129) hrScore = 2;
  else hrScore = 3;

  // Systolic BP Score
  let sbpScore = 0;
  if (systolicBP <= 70) sbpScore = 3;
  else if (systolicBP <= 80) sbpScore = 2;
  else if (systolicBP <= 100) sbpScore = 1;
  else if (systolicBP <= 199) sbpScore = 0;
  else sbpScore = 2;

  // Respiratory Rate Score
  let rrScore = 0;
  if (respiratoryRate < 9) rrScore = 2;
  else if (respiratoryRate <= 14) rrScore = 0;
  else if (respiratoryRate <= 20) rrScore = 1;
  else if (respiratoryRate <= 29) rrScore = 2;
  else rrScore = 3;

  // Temperature Score
  let tempScore = 0;
  if (temperature < 35.0) tempScore = 2;
  else if (temperature <= 38.4) tempScore = 0;
  else tempScore = 2;

  // AVPU Score
  let avpuScore = 0;
  if (avpu === 'A') avpuScore = 0;
  else if (avpu === 'V') avpuScore = 1;
  else if (avpu === 'P') avpuScore = 2;
  else avpuScore = 3;

  const totalScore = hrScore + sbpScore + rrScore + tempScore + avpuScore;

  let triageLevel: TriageLevel = 'green';
  let recommendation = 'Patient clinically stable. Continue routine 4-6 hour ward vitals surveillance.';

  if (totalScore >= 5) {
    triageLevel = 'red';
    recommendation = 'CRITICAL ALERT: Rapid Response Team (RRT) and Senior Registrar notified immediately. Prepare bedside resuscitation equipment.';
  } else if (totalScore >= 3) {
    triageLevel = 'yellow';
    recommendation = 'MODERATE RISK: Physiological instability noted. Notify Charge Nurse, repeat contactless scan within 30 minutes, consider arterial blood gas.';
  }

  return {
    score: totalScore,
    triageLevel,
    breakdown: {
      heartRateScore: hrScore,
      systolicBPScore: sbpScore,
      respiratoryRateScore: rrScore,
      temperatureScore: tempScore,
      avpuScore: avpuScore,
    },
    recommendation,
  };
}

export function calculateQSOFA(respiratoryRate: number, systolicBP: number, alteredMentalState: boolean): {
  score: number;
  sepsisWarning: boolean;
  guidance: string;
} {
  let score = 0;
  if (respiratoryRate >= 22) score += 1;
  if (systolicBP <= 100) score += 1;
  if (alteredMentalState) score += 1;

  const sepsisWarning = score >= 2;
  const guidance = sepsisWarning
    ? 'High risk of sepsis-associated in-hospital decompensation. Measure serum lactate, draw blood cultures, and initiate Sepsis 6 Protocol.'
    : 'qSOFA criteria negative. Continue monitoring vital trends.';

  return { score, sepsisWarning, guidance };
}
