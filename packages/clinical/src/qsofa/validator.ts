import type { QSOFAInput, QSOFAValidationResult } from './types';

export function validateQSOFAInput(input: unknown): QSOFAValidationResult {
  const errors: string[] = [];

  if (!input || typeof input !== 'object') {
    return {
      valid: false,
      errors: ['Input must be a valid object'],
    };
  }

  const raw = input as Record<string, unknown>;
  const sanitized: QSOFAInput = {};

  // 1. Respiratory Rate
  if (raw.respiratoryRate !== undefined && raw.respiratoryRate !== null) {
    if (typeof raw.respiratoryRate !== 'number' || !Number.isFinite(raw.respiratoryRate)) {
      errors.push('respiratoryRate must be a finite number');
    } else if (raw.respiratoryRate < 2 || raw.respiratoryRate > 80) {
      errors.push(`respiratoryRate ${raw.respiratoryRate} /min is outside physiological bounds [2, 80]`);
    } else {
      sanitized.respiratoryRate = raw.respiratoryRate;
    }
  }

  // 2. Systolic Blood Pressure
  if (raw.systolicBP !== undefined && raw.systolicBP !== null) {
    if (typeof raw.systolicBP !== 'number' || !Number.isFinite(raw.systolicBP)) {
      errors.push('systolicBP must be a finite number');
    } else if (raw.systolicBP < 30 || raw.systolicBP > 300) {
      errors.push(`systolicBP ${raw.systolicBP} mmHg is outside physiological bounds [30, 300]`);
    } else {
      sanitized.systolicBP = raw.systolicBP;
    }
  }

  // 3. AVPU
  if (raw.avpu !== undefined && raw.avpu !== null) {
    if (raw.avpu !== 'A' && raw.avpu !== 'V' && raw.avpu !== 'P' && raw.avpu !== 'U') {
      errors.push(`avpu must be one of 'A', 'V', 'P', 'U', received '${String(raw.avpu)}'`);
    } else {
      sanitized.avpu = raw.avpu;
    }
  }

  // 4. GCS
  if (raw.gcs !== undefined && raw.gcs !== null) {
    if (typeof raw.gcs !== 'number' || !Number.isFinite(raw.gcs)) {
      errors.push('gcs must be a finite number');
    } else if (raw.gcs < 3 || raw.gcs > 15) {
      errors.push(`gcs ${raw.gcs} is outside valid clinical bounds [3, 15]`);
    } else {
      sanitized.gcs = raw.gcs;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitizedInput: errors.length === 0 ? sanitized : undefined,
  };
}
