import type {
  QSOFAInput,
  QSOFAResult,
  QSOFASubscore,
  QSOFAContributingVariable,
} from './types';
import { QSOFA_THRESHOLDS } from './thresholds';
import { validateQSOFAInput } from './validator';

export interface CalculateQSOFAOptions {
  timestamp?: number;
  skipValidation?: boolean;
}

export function calculateQSOFA(input: QSOFAInput, options?: CalculateQSOFAOptions): QSOFAResult {
  const timestamp = options?.timestamp ?? Date.now();

  if (!options?.skipValidation) {
    const validation = validateQSOFAInput(input);
    if (!validation.valid) {
      throw new Error(`Invalid qSOFA input: ${validation.errors.join('; ')}`);
    }
  }

  const missingValues: ('respiratoryRate' | 'systolicBP' | 'alteredMentation')[] = [];
  const contributingVariables: QSOFAContributingVariable[] = [];

  // 1. Respiratory Rate (>= 22 breaths/min)
  let rrSub: QSOFASubscore;
  if (input.respiratoryRate === undefined || input.respiratoryRate === null) {
    missingValues.push('respiratoryRate');
    rrSub = {
      rawValue: undefined,
      points: 0,
      contributing: false,
      missing: true,
      criterion: 'Respiratory rate >= 22 breaths/min',
    };
  } else {
    const val = input.respiratoryRate;
    const isAbnormal = val >= QSOFA_THRESHOLDS.respiratoryRate.threshold;
    const pts = isAbnormal ? 1 : 0;
    const label = isAbnormal ? '>=22 breaths/min (tachypneic)' : '<22 breaths/min (normal)';

    rrSub = {
      rawValue: val,
      points: pts,
      contributing: pts > 0,
      missing: false,
      criterion: 'Respiratory rate >= 22 breaths/min',
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

  // 2. Systolic Blood Pressure (<= 100 mmHg)
  let sbpSub: QSOFASubscore;
  if (input.systolicBP === undefined || input.systolicBP === null) {
    missingValues.push('systolicBP');
    sbpSub = {
      rawValue: undefined,
      points: 0,
      contributing: false,
      missing: true,
      criterion: 'Systolic blood pressure <= 100 mmHg',
    };
  } else {
    const val = input.systolicBP;
    const isAbnormal = val <= QSOFA_THRESHOLDS.systolicBP.threshold;
    const pts = isAbnormal ? 1 : 0;
    const label = isAbnormal ? '<=100 mmHg (hypotensive)' : '>100 mmHg (normotensive)';

    sbpSub = {
      rawValue: val,
      points: pts,
      contributing: pts > 0,
      missing: false,
      criterion: 'Systolic blood pressure <= 100 mmHg',
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

  // 3. Altered Mentation (GCS < 15 or AVPU != 'A')
  let mentationSub: QSOFASubscore;
  const hasAvpu = input.avpu !== undefined && input.avpu !== null;
  const hasGcs = input.gcs !== undefined && input.gcs !== null;

  if (!hasAvpu && !hasGcs) {
    missingValues.push('alteredMentation');
    mentationSub = {
      rawValue: undefined,
      points: 0,
      contributing: false,
      missing: true,
      criterion: 'Altered mentation (GCS < 15 or AVPU not Alert)',
    };
  } else {
    let isAbnormal = false;
    let rawDesc: string = '';

    if (hasGcs) {
      isAbnormal = input.gcs! < QSOFA_THRESHOLDS.alteredMentation.gcsThreshold;
      rawDesc = `GCS ${input.gcs}`;
    }
    if (hasAvpu) {
      const avpuAbnormal = input.avpu !== 'A';
      if (hasGcs) {
        isAbnormal = isAbnormal || avpuAbnormal;
        rawDesc += `, AVPU ${input.avpu}`;
      } else {
        isAbnormal = avpuAbnormal;
        rawDesc = `AVPU ${input.avpu}`;
      }
    }

    const pts = isAbnormal ? 1 : 0;
    const label = isAbnormal ? `${rawDesc} (altered mentation)` : `${rawDesc} (alert/normal mentation)`;

    mentationSub = {
      rawValue: rawDesc,
      points: pts,
      contributing: pts > 0,
      missing: false,
      criterion: 'Altered mentation (GCS < 15 or AVPU not Alert)',
    };

    if (pts > 0) {
      contributingVariables.push({
        variable: 'alteredMentation',
        name: 'Mental Status',
        value: rawDesc,
        unit: 'scale',
        points: pts,
        interpretation: label,
      });
    }
  }

  const totalScore = rrSub.points + sbpSub.points + mentationSub.points;
  const maxPossibleScore = totalScore + missingValues.length;
  const uncertainty = Number((missingValues.length / 3).toFixed(3));
  const isPositive = totalScore >= QSOFA_THRESHOLDS.positiveScreenThreshold;

  return {
    totalScore,
    maxPossibleScore,
    uncertainty,
    missingValues,
    contributingVariables,
    subscores: {
      respiratoryRate: rrSub,
      systolicBP: sbpSub,
      alteredMentation: mentationSub,
    },
    isPositive,
    timestamp,
  };
}
