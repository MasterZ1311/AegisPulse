import type {
  MEWSInput,
  MEWSResult,
  MEWSSubscore,
  MEWSContributingVariable,
} from './types';
import { MEWS_THRESHOLDS } from './thresholds';
import { validateMEWSInput } from './validator';

const MAX_POINTS_MAP: Record<keyof MEWSInput, number> = {
  systolicBP: 3,
  heartRate: 3,
  respiratoryRate: 3,
  temperature: 2,
  avpu: 3,
};

const TOTAL_MAX_MEWS_POINTS = 14;

export interface CalculateMEWSOptions {
  timestamp?: number;
  skipValidation?: boolean;
}

export function calculateMEWS(input: MEWSInput, options?: CalculateMEWSOptions): MEWSResult {
  const timestamp = options?.timestamp ?? Date.now();

  if (!options?.skipValidation) {
    const validation = validateMEWSInput(input);
    if (!validation.valid) {
      throw new Error(`Invalid MEWS input: ${validation.errors.join('; ')}`);
    }
  }

  const missingValues: (keyof MEWSInput)[] = [];
  const contributingVariables: MEWSContributingVariable[] = [];

  // 1. Systolic BP
  let sbpSub: MEWSSubscore;
  if (input.systolicBP === undefined || input.systolicBP === null) {
    missingValues.push('systolicBP');
    sbpSub = { rawValue: undefined, points: 0, contributing: false, missing: true };
  } else {
    const val = input.systolicBP;
    let pts = 0;
    let label = '101-199 mmHg (normal)';

    if (val <= 70) {
      pts = 3;
      label = '<=70 mmHg (severe hypotension)';
    } else if (val <= 80) {
      pts = 2;
      label = '71-80 mmHg (moderate hypotension)';
    } else if (val <= 100) {
      pts = 1;
      label = '81-100 mmHg (mild hypotension)';
    } else if (val >= 200) {
      pts = 2;
      label = '>=200 mmHg (severe hypertension)';
    }

    sbpSub = {
      rawValue: val,
      points: pts,
      contributing: pts > 0,
      missing: false,
      thresholdTriggered: label,
    };

    if (pts > 0) {
      contributingVariables.push({
        variable: 'systolicBP',
        name: 'Systolic Blood Pressure',
        value: val,
        unit: 'mmHg',
        points: pts,
        interpretation: label,
      });
    }
  }

  // 2. Heart Rate
  let hrSub: MEWSSubscore;
  if (input.heartRate === undefined || input.heartRate === null) {
    missingValues.push('heartRate');
    hrSub = { rawValue: undefined, points: 0, contributing: false, missing: true };
  } else {
    const val = input.heartRate;
    let pts = 0;
    let label = '51-100 bpm (normal)';

    if (val <= 40) {
      pts = 2;
      label = '<=40 bpm (severe bradycardia)';
    } else if (val <= 50) {
      pts = 1;
      label = '41-50 bpm (mild bradycardia)';
    } else if (val >= 130) {
      pts = 3;
      label = '>=130 bpm (severe tachycardia)';
    } else if (val >= 111) {
      pts = 2;
      label = '111-129 bpm (moderate tachycardia)';
    } else if (val >= 101) {
      pts = 1;
      label = '101-110 bpm (mild tachycardia)';
    }

    hrSub = {
      rawValue: val,
      points: pts,
      contributing: pts > 0,
      missing: false,
      thresholdTriggered: label,
    };

    if (pts > 0) {
      contributingVariables.push({
        variable: 'heartRate',
        name: 'Heart Rate',
        value: val,
        unit: 'bpm',
        points: pts,
        interpretation: label,
      });
    }
  }

  // 3. Respiratory Rate
  let rrSub: MEWSSubscore;
  if (input.respiratoryRate === undefined || input.respiratoryRate === null) {
    missingValues.push('respiratoryRate');
    rrSub = { rawValue: undefined, points: 0, contributing: false, missing: true };
  } else {
    const val = input.respiratoryRate;
    let pts = 0;
    let label = '9-14 breaths/min (normal)';

    if (val <= 8) {
      pts = 2;
      label = '<=8 breaths/min (bradypnea)';
    } else if (val >= 30) {
      pts = 3;
      label = '>=30 breaths/min (severe tachypnea)';
    } else if (val >= 21) {
      pts = 2;
      label = '21-29 breaths/min (moderate tachypnea)';
    } else if (val >= 15) {
      pts = 1;
      label = '15-20 breaths/min (mild tachypnea)';
    }

    rrSub = {
      rawValue: val,
      points: pts,
      contributing: pts > 0,
      missing: false,
      thresholdTriggered: label,
    };

    if (pts > 0) {
      contributingVariables.push({
        variable: 'respiratoryRate',
        name: 'Respiratory Rate',
        value: val,
        unit: 'breaths/min',
        points: pts,
        interpretation: label,
      });
    }
  }

  // 4. Temperature
  let tempSub: MEWSSubscore;
  if (input.temperature === undefined || input.temperature === null) {
    missingValues.push('temperature');
    tempSub = { rawValue: undefined, points: 0, contributing: false, missing: true };
  } else {
    const val = input.temperature;
    let pts = 0;
    let label = '35.1-38.4 °C (normal)';

    if (val <= 35.0) {
      pts = 2;
      label = '<=35.0 °C (hypothermia)';
    } else if (val >= 38.5) {
      pts = 2;
      label = '>=38.5 °C (hyperthermia/fever)';
    }

    tempSub = {
      rawValue: val,
      points: pts,
      contributing: pts > 0,
      missing: false,
      thresholdTriggered: label,
    };

    if (pts > 0) {
      contributingVariables.push({
        variable: 'temperature',
        name: 'Body Temperature',
        value: val,
        unit: '°C',
        points: pts,
        interpretation: label,
      });
    }
  }

  // 5. AVPU
  let avpuSub: MEWSSubscore;
  if (input.avpu === undefined || input.avpu === null) {
    missingValues.push('avpu');
    avpuSub = { rawValue: undefined, points: 0, contributing: false, missing: true };
  } else {
    const val = input.avpu;
    let pts = 0;
    let label = 'Alert (A)';

    switch (val) {
      case 'U':
        pts = 3;
        label = 'Unresponsive (U)';
        break;
      case 'P':
        pts = 2;
        label = 'Reacting to Pain (P)';
        break;
      case 'V':
        pts = 1;
        label = 'Reacting to Voice (V)';
        break;
      case 'A':
      default:
        pts = 0;
        label = 'Alert (A)';
        break;
    }

    avpuSub = {
      rawValue: val,
      points: pts,
      contributing: pts > 0,
      missing: false,
      thresholdTriggered: label,
    };

    if (pts > 0) {
      contributingVariables.push({
        variable: 'avpu',
        name: 'Consciousness (AVPU)',
        value: val,
        unit: 'scale',
        points: pts,
        interpretation: label,
      });
    }
  }

  // Compute totals
  const totalScore = sbpSub.points + hrSub.points + rrSub.points + tempSub.points + avpuSub.points;

  const missingMaxPoints = missingValues.reduce((sum, key) => sum + MAX_POINTS_MAP[key], 0);
  const maxPossibleScore = totalScore + missingMaxPoints;
  const uncertainty = Number((missingMaxPoints / TOTAL_MAX_MEWS_POINTS).toFixed(3));

  let triageLevel: 'green' | 'yellow' | 'red' = 'green';
  if (totalScore >= MEWS_THRESHOLDS.criticalScoreThreshold) {
    triageLevel = 'red';
  } else if (totalScore >= 3) {
    triageLevel = 'yellow';
  }

  return {
    totalScore,
    maxPossibleScore,
    uncertainty,
    missingValues,
    contributingVariables,
    subscores: {
      systolicBP: sbpSub,
      heartRate: hrSub,
      respiratoryRate: rrSub,
      temperature: tempSub,
      avpu: avpuSub,
    },
    triageLevel,
    isSevere: totalScore >= MEWS_THRESHOLDS.criticalScoreThreshold,
    timestamp,
  };
}
