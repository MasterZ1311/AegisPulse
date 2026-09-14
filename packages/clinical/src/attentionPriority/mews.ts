/**
 * Modified Early Warning Score (MEWS) Engine
 * Grounded in Subbe et al. (QJM 2001; 94:521-526)
 * Validated bedside physiological assessment tool for detecting adult medical ward decompensation.
 */

export interface MEWSInput {
  heartRate?: number;
  systolicBP?: number;
  respiratoryRate?: number;
  temperature?: number;
  avpu?: 'A' | 'V' | 'P' | 'U';
}

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
 * Calculates Subbe et al. MEWS score from vital parameters.
 */
export function calculateMEWS(input: MEWSInput): FullMEWSResult {
  let sbpScore = 0;
  let hrScore = 0;
  let rrScore = 0;
  let tempScore = 0;
  let avpuScore = 0;

  const explanations: string[] = [];

  // 1. Systolic Blood Pressure (mmHg)
  if (input.systolicBP !== undefined) {
    const sbp = input.systolicBP;
    if (sbp <= 70) {
      sbpScore = 3;
      explanations.push(`SBP ${sbp} mmHg (<=70: 3 pts)`);
    } else if (sbp <= 80) {
      sbpScore = 2;
      explanations.push(`SBP ${sbp} mmHg (71-80: 2 pts)`);
    } else if (sbp <= 100) {
      sbpScore = 1;
      explanations.push(`SBP ${sbp} mmHg (81-100: 1 pt)`);
    } else if (sbp >= 200) {
      sbpScore = 2;
      explanations.push(`SBP ${sbp} mmHg (>=200: 2 pts)`);
    } else {
      sbpScore = 0;
    }
  }

  // 2. Heart Rate (BPM)
  if (input.heartRate !== undefined) {
    const hr = input.heartRate;
    if (hr <= 40) {
      hrScore = 2;
      explanations.push(`HR ${hr} bpm (<=40: 2 pts)`);
    } else if (hr <= 50) {
      hrScore = 1;
      explanations.push(`HR ${hr} bpm (41-50: 1 pt)`);
    } else if (hr <= 100) {
      hrScore = 0;
    } else if (hr <= 110) {
      hrScore = 1;
      explanations.push(`HR ${hr} bpm (101-110: 1 pt)`);
    } else if (hr <= 129) {
      hrScore = 2;
      explanations.push(`HR ${hr} bpm (111-129: 2 pts)`);
    } else {
      hrScore = 3;
      explanations.push(`HR ${hr} bpm (>=130: 3 pts)`);
    }
  }

  // 3. Respiratory Rate (Breaths/min)
  if (input.respiratoryRate !== undefined) {
    const rr = input.respiratoryRate;
    if (rr <= 8) {
      rrScore = 2;
      explanations.push(`RR ${rr}/min (<=8: 2 pts)`);
    } else if (rr <= 14) {
      rrScore = 0;
    } else if (rr <= 20) {
      rrScore = 1;
      explanations.push(`RR ${rr}/min (15-20: 1 pt)`);
    } else if (rr <= 29) {
      rrScore = 2;
      explanations.push(`RR ${rr}/min (21-29: 2 pts)`);
    } else {
      rrScore = 3;
      explanations.push(`RR ${rr}/min (>=30: 3 pts)`);
    }
  }

  // 4. Body Temperature (°C)
  if (input.temperature !== undefined) {
    const temp = input.temperature;
    if (temp <= 35.0) {
      tempScore = 2;
      explanations.push(`Temp ${temp}°C (<=35.0: 2 pts)`);
    } else if (temp >= 38.5) {
      tempScore = 2;
      explanations.push(`Temp ${temp}°C (>=38.5: 2 pts)`);
    } else {
      tempScore = 0;
    }
  }

  // 5. Neurological AVPU
  if (input.avpu !== undefined) {
    const avpu = input.avpu;
    if (avpu === 'V') {
      avpuScore = 1;
      explanations.push('AVPU: Responds to Voice (1 pt)');
    } else if (avpu === 'P') {
      avpuScore = 2;
      explanations.push('AVPU: Responds to Pain (2 pts)');
    } else if (avpu === 'U') {
      avpuScore = 3;
      explanations.push('AVPU: Unresponsive (3 pts)');
    } else {
      avpuScore = 0;
    }
  }

  const score = sbpScore + hrScore + rrScore + tempScore + avpuScore;

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

  const isSevere = score >= 5;
  const triageLevel: 'green' | 'yellow' | 'red' =
    score >= 5 ? 'red' : score >= 3 ? 'yellow' : 'green';

  const explanation =
    score === 0
      ? 'MEWS 0: Stable baseline physiological parameters'
      : `MEWS ${score} (${triageLevel.toUpperCase()}): ${explanations.join(', ')}`;

  return {
    score,
    normalizedScore,
    subscores: {
      sbp: sbpScore,
      hr: hrScore,
      rr: rrScore,
      temp: tempScore,
      avpu: avpuScore,
    },
    triageLevel,
    isSevere,
    explanation,
  };
}
