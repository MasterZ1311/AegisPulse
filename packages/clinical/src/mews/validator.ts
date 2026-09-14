import type { MEWSInput, MEWSValidationResult } from './types';

export function validateMEWSInput(input: unknown): MEWSValidationResult {
  const errors: string[] = [];

  if (!input || typeof input !== 'object') {
    return {
      valid: false,
      errors: ['Input must be a valid object'],
    };
  }

  const raw = input as Record<string, unknown>;
  const sanitized: MEWSInput = {};

  // 1. Systolic BP
  if (raw.systolicBP !== undefined && raw.systolicBP !== null) {
    if (typeof raw.systolicBP !== 'number' || !Number.isFinite(raw.systolicBP)) {
      errors.push('systolicBP must be a finite number');
    } else if (raw.systolicBP < 30 || raw.systolicBP > 300) {
      errors.push(`systolicBP ${raw.systolicBP} mmHg is outside physiological bounds [30, 300]`);
    } else {
      sanitized.systolicBP = raw.systolicBP;
    }
  }

  // 2. Heart Rate
  if (raw.heartRate !== undefined && raw.heartRate !== null) {
    if (typeof raw.heartRate !== 'number' || !Number.isFinite(raw.heartRate)) {
      errors.push('heartRate must be a finite number');
    } else if (raw.heartRate < 20 || raw.heartRate > 300) {
      errors.push(`heartRate ${raw.heartRate} bpm is outside physiological bounds [20, 300]`);
    } else {
      sanitized.heartRate = raw.heartRate;
    }
  }

  // 3. Respiratory Rate
  if (raw.respiratoryRate !== undefined && raw.respiratoryRate !== null) {
    if (typeof raw.respiratoryRate !== 'number' || !Number.isFinite(raw.respiratoryRate)) {
      errors.push('respiratoryRate must be a finite number');
    } else if (raw.respiratoryRate < 2 || raw.respiratoryRate > 80) {
      errors.push(`respiratoryRate ${raw.respiratoryRate} /min is outside physiological bounds [2, 80]`);
    } else {
      sanitized.respiratoryRate = raw.respiratoryRate;
    }
  }

  // 4. Temperature
  if (raw.temperature !== undefined && raw.temperature !== null) {
    if (typeof raw.temperature !== 'number' || !Number.isFinite(raw.temperature)) {
      errors.push('temperature must be a finite number');
    } else if (raw.temperature < 25.0 || raw.temperature > 45.0) {
      errors.push(`temperature ${raw.temperature} °C is outside physiological bounds [25.0, 45.0]`);
    } else {
      sanitized.temperature = raw.temperature;
    }
  }

  // 5. AVPU
  if (raw.avpu !== undefined && raw.avpu !== null) {
    if (raw.avpu !== 'A' && raw.avpu !== 'V' && raw.avpu !== 'P' && raw.avpu !== 'U') {
      errors.push(`avpu must be one of 'A', 'V', 'P', 'U', received '${String(raw.avpu)}'`);
    } else {
      sanitized.avpu = raw.avpu;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitizedInput: errors.length === 0 ? sanitized : undefined,
  };
}
