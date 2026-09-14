import type { QSOFAThresholds } from './types';

/**
 * Standard Singer et al. (JAMA 2016 Sepsis-3) qSOFA Threshold Specification
 */
export const QSOFA_THRESHOLDS: QSOFAThresholds = {
  respiratoryRate: {
    threshold: 22,
    points: 1,
    label: '>=22 breaths/min (tachypnea)',
  },
  systolicBP: {
    threshold: 100,
    points: 1,
    label: '<=100 mmHg (hypotension)',
  },
  alteredMentation: {
    gcsThreshold: 15,
    avpuAbnormal: ['V', 'P', 'U'],
    points: 1,
    label: 'GCS < 15 or AVPU not Alert (altered mentation)',
  },
  positiveScreenThreshold: 2,
};

export function getQSOFAThresholds(): QSOFAThresholds {
  return QSOFA_THRESHOLDS;
}
