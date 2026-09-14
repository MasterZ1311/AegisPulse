import type { MEWSThresholds } from './types';

/**
 * Standard Subbe et al. (QJM 2001) Threshold Specification
 */
export const MEWS_THRESHOLDS: MEWSThresholds = {
  systolicBP: [
    { max: 70, points: 3, label: '<=70 mmHg (severe hypotension)' },
    { min: 71, max: 80, points: 2, label: '71-80 mmHg (moderate hypotension)' },
    { min: 81, max: 100, points: 1, label: '81-100 mmHg (mild hypotension)' },
    { min: 101, max: 199, points: 0, label: '101-199 mmHg (normal)' },
    { min: 200, points: 2, label: '>=200 mmHg (severe hypertension)' },
  ],
  heartRate: [
    { max: 40, points: 2, label: '<=40 bpm (severe bradycardia)' },
    { min: 41, max: 50, points: 1, label: '41-50 bpm (mild bradycardia)' },
    { min: 51, max: 100, points: 0, label: '51-100 bpm (normal)' },
    { min: 101, max: 110, points: 1, label: '101-110 bpm (mild tachycardia)' },
    { min: 111, max: 129, points: 2, label: '111-129 bpm (moderate tachycardia)' },
    { min: 130, points: 3, label: '>=130 bpm (severe tachycardia)' },
  ],
  respiratoryRate: [
    { max: 8, points: 2, label: '<=8 breaths/min (bradypnea)' },
    { min: 9, max: 14, points: 0, label: '9-14 breaths/min (normal)' },
    { min: 15, max: 20, points: 1, label: '15-20 breaths/min (mild tachypnea)' },
    { min: 21, max: 29, points: 2, label: '21-29 breaths/min (moderate tachypnea)' },
    { min: 30, points: 3, label: '>=30 breaths/min (severe tachypnea)' },
  ],
  temperature: [
    { max: 35.0, points: 2, label: '<=35.0 C (hypothermia)' },
    { min: 35.1, max: 38.4, points: 0, label: '35.1-38.4 C (normal)' },
    { min: 38.5, points: 2, label: '>=38.5 C (hyperthermia/fever)' },
  ],
  avpu: [
    { value: 'A', points: 0, label: 'Alert (A)' },
    { value: 'V', points: 1, label: 'Reacting to Voice (V)' },
    { value: 'P', points: 2, label: 'Reacting to Pain (P)' },
    { value: 'U', points: 3, label: 'Unresponsive (U)' },
  ],
  criticalScoreThreshold: 5,
};

export function getMEWSThresholds(): MEWSThresholds {
  return MEWS_THRESHOLDS;
}
