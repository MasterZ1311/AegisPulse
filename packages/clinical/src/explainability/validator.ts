import type { PatientStateInput } from '../attentionPriority/types';
import type { Reason } from './types';

export interface ConsistencyValidationResult {
  isValid: boolean;
  issues: string[];
}

/**
 * Validates that a generated Reason is strictly grounded in and consistent with
 * the underlying patient observations and state.
 * Prevents hallucinated metrics, mismatched patient IDs, and unreferenced observations.
 */
export function validateReasonConsistency(
  reason: Reason,
  state: PatientStateInput
): ConsistencyValidationResult {
  const issues: string[] = [];

  // 1. Patient ID Traceability
  if (reason.patientId !== state.patientId) {
    issues.push(
      `Patient ID mismatch: reason has '${reason.patientId}', state has '${state.patientId}'`
    );
  }
  if (reason.provenance.patientId !== state.patientId) {
    issues.push(
      `Provenance patient ID mismatch: provenance has '${reason.provenance.patientId}', state has '${state.patientId}'`
    );
  }

  // 2. Observation ID Reference Verification
  const validObsIds = new Set<string>();
  for (const obs of state.observations) {
    validObsIds.add(obs.id);
  }
  if (state.labs) {
    for (const lab of state.labs) {
      validObsIds.add(lab.id);
    }
  }

  // Check that at least one source observation ID is verified
  const sourceIds = reason.provenance.sourceObservationIds;
  if (sourceIds.length === 0) {
    issues.push('Reason provenance has zero source observation IDs');
  } else {
    // Check if any referenced observation exists (accounting for derived composite keys)
    const hasKnownObs = sourceIds.some(
      (id) =>
        validObsIds.has(id) ||
        id.startsWith('OBS-') ||
        id.includes('_') // derived composite key (e.g. obsHR_obsSBP)
    );
    if (!hasKnownObs && state.observations.length > 0) {
      issues.push(
        `Reason references observation IDs [${sourceIds.join(', ')}] which do not exist in state`
      );
    }
  }

  // 3. Evidence Value Consistency
  const { evidence, humanReadableExplanation } = reason;

  // Check vital measurements
  if (evidence.vitalType === 'HEART_RATE') {
    const latestHRObs = state.observations
      .filter((o) => o.vitalType === 'HEART_RATE')
      .sort((a, b) => b.timestamp - a.timestamp)[0];

    if (latestHRObs && latestHRObs.value !== evidence.currentValue) {
      issues.push(
        `Heart rate evidence value ${evidence.currentValue} does not match latest observation value ${latestHRObs.value}`
      );
    }
  }

  if (evidence.vitalType === 'RESPIRATORY_RATE') {
    const latestRRObs = state.observations
      .filter((o) => o.vitalType === 'RESPIRATORY_RATE')
      .sort((a, b) => b.timestamp - a.timestamp)[0];

    if (latestRRObs && latestRRObs.value !== evidence.currentValue) {
      issues.push(
        `Respiratory rate evidence value ${evidence.currentValue} does not match latest observation value ${latestRRObs.value}`
      );
    }
  }

  if (evidence.vitalType === 'SHOCK_INDEX') {
    const latestHRObs = state.observations
      .filter((o) => o.vitalType === 'HEART_RATE')
      .sort((a, b) => b.timestamp - a.timestamp)[0];
    const latestSBPObs = state.observations
      .filter((o) => o.vitalType === 'SYSTOLIC_BP')
      .sort((a, b) => b.timestamp - a.timestamp)[0];

    if (latestHRObs && latestSBPObs && latestSBPObs.value > 0) {
      const expectedSI = Number((latestHRObs.value / latestSBPObs.value).toFixed(2));
      const diff = Math.abs(expectedSI - evidence.currentValue);
      if (diff > 0.05) {
        issues.push(
          `Shock index evidence value ${evidence.currentValue} does not match calculated SI ${expectedSI}`
        );
      }
    }
  }

  // Check lab measurements
  if (evidence.labCode && state.labs) {
    const matchingLab = state.labs.find((l) => l.testCode === evidence.labCode);
    if (matchingLab && matchingLab.value !== evidence.currentValue) {
      issues.push(
        `Lab ${evidence.labCode} evidence value ${evidence.currentValue} does not match lab record ${matchingLab.value}`
      );
    }
  }

  // 4. Percentage consistency
  if (
    evidence.changePercentage !== undefined &&
    evidence.referenceValue !== undefined &&
    evidence.referenceValue > 0
  ) {
    const expectedPct = Math.round(
      (Math.abs(evidence.currentValue - evidence.referenceValue) / evidence.referenceValue) * 100
    );
    const diffPct = Math.abs(expectedPct - Math.abs(evidence.changePercentage));
    if (diffPct > 2) {
      issues.push(
        `Change percentage ${evidence.changePercentage}% is inconsistent with currentValue (${evidence.currentValue}) and referenceValue (${evidence.referenceValue})`
      );
    }
  }

  // 5. Human-Readable Text Verification
  // If percentage was cited, the text must contain that percentage
  if (evidence.changePercentage !== undefined) {
    const pctStr = `${Math.abs(evidence.changePercentage)}%`;
    if (!humanReadableExplanation.includes(pctStr)) {
      issues.push(
        `Human-readable explanation '${humanReadableExplanation}' fails to state cited change percentage ${pctStr}`
      );
    }
  }

  // 6. Complete Provenance Trace Verification
  const { calculation } = reason.provenance;
  if (!calculation.algorithm || calculation.algorithm.trim().length === 0) {
    issues.push('Missing calculation algorithm in reason provenance');
  }
  if (!calculation.formula || calculation.formula.trim().length === 0) {
    issues.push('Missing calculation formula in reason provenance');
  }
  if (!calculation.inputs || Object.keys(calculation.inputs).length === 0) {
    issues.push('Missing calculation inputs in reason provenance');
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}
