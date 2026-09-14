import { describe, it, expect } from 'vitest';
import {
  explainPatient,
  validateReasonConsistency,
  type Reason,
} from '../src/explainability';
import type { PatientStateInput } from '../src/attentionPriority/types';
import type { Observation, LaboratoryResult, VitalType, VitalUnit } from '@aegispulse/types';

describe('Explainability Data Consistency & Provenance Verification', () => {
  const baseTime = 1773471600000;

  function makeObs(
    id: string,
    patientId: string,
    vitalType: VitalType,
    value: number,
    unit: VitalUnit,
    timestamp: number
  ): Observation {
    return {
      id,
      patientId,
      bedId: 'BED-01',
      vitalType,
      value,
      unit,
      timestamp,
      source: 'SIMULATION',
      confidence: 0.95,
      qualityStatus: 'TRUSTED',
    };
  }

  it('proves that all generated reasons pass strict data-consistency checks against underlying state', () => {
    const thirtyMinAgo = baseTime - 30 * 60 * 1000;
    const observations: Observation[] = [
      makeObs('obs-hr-1', 'P-CONSISTENT', 'HEART_RATE', 70, 'BPM', thirtyMinAgo),
      makeObs('obs-hr-2', 'P-CONSISTENT', 'HEART_RATE', 85, 'BPM', baseTime),
      makeObs('obs-rr-1', 'P-CONSISTENT', 'RESPIRATORY_RATE', 16, 'BREATHS_PER_MINUTE', thirtyMinAgo),
      makeObs('obs-rr-2', 'P-CONSISTENT', 'RESPIRATORY_RATE', 24, 'BREATHS_PER_MINUTE', baseTime),
      makeObs('obs-bp-1', 'P-CONSISTENT', 'SYSTOLIC_BP', 96, 'MMHG', baseTime),
    ];

    const labs: LaboratoryResult[] = [
      {
        id: 'lab-lactate-1',
        patientId: 'P-CONSISTENT',
        timestamp: baseTime,
        testCode: 'LACTATE',
        testName: 'Venous Lactate',
        value: 2.8,
        unit: 'MMOL_PER_L',
        referenceRange: { low: 0.5, high: 2.0 },
        isCritical: true,
        sourceLab: 'Ward Lab',
      },
    ];

    const state: PatientStateInput = {
      patientId: 'P-CONSISTENT',
      bedNumber: 'BED-01',
      currentTimestamp: baseTime,
      observations,
      labs,
      baseline: { heartRate: 70, respiratoryRate: 16, systolicBP: 120 },
      lastTrustedObservationTimestamp: baseTime,
    };

    const result = explainPatient(state);

    expect(result.reasons.length).toBeGreaterThan(0);

    for (const reason of result.reasons) {
      const validation = validateReasonConsistency(reason, state);
      expect(validation.isValid).toBe(true);
      expect(validation.issues).toEqual([]);

      // Verify Provenance Chain: patient -> observation -> calculation -> reason
      expect(reason.provenance.patientId).toBe('P-CONSISTENT');
      expect(reason.provenance.sourceObservationIds.length).toBeGreaterThan(0);
      expect(reason.provenance.calculation.algorithm.length).toBeGreaterThan(0);
      expect(reason.provenance.calculation.formula.length).toBeGreaterThan(0);
      expect(Object.keys(reason.provenance.calculation.inputs).length).toBeGreaterThan(0);
      expect(reason.provenance.derivedAt).toBe(baseTime);
    }
  });

  it('rejects fabricated/mismatched patient ID in reason', () => {
    const state: PatientStateInput = {
      patientId: 'P-REAL',
      bedNumber: 'BED-01',
      currentTimestamp: baseTime,
      observations: [makeObs('o1', 'P-REAL', 'HEART_RATE', 72, 'BPM', baseTime)],
    };

    const validResult = explainPatient(state);
    const tamperedReason: Reason = {
      ...validResult.reasons[0],
      patientId: 'P-FABRICATED',
    };

    const validation = validateReasonConsistency(tamperedReason, state);
    expect(validation.isValid).toBe(false);
    expect(validation.issues.some((i) => i.includes('Patient ID mismatch'))).toBe(true);
  });

  it('rejects ungrounded observation IDs not present in patient state', () => {
    const state: PatientStateInput = {
      patientId: 'P-TEST',
      bedNumber: 'BED-01',
      currentTimestamp: baseTime,
      observations: [makeObs('valid-obs-1', 'P-TEST', 'HEART_RATE', 72, 'BPM', baseTime)],
    };

    const validResult = explainPatient(state);
    const tamperedReason: Reason = {
      ...validResult.reasons[0],
      provenance: {
        ...validResult.reasons[0].provenance,
        sourceObservationIds: ['hallucinated-obs-999'],
      },
    };

    const validation = validateReasonConsistency(tamperedReason, state);
    expect(validation.isValid).toBe(false);
    expect(validation.issues.some((i) => i.includes('which do not exist in state'))).toBe(true);
  });

  it('rejects inconsistent vital measurement values cited in evidence', () => {
    const state: PatientStateInput = {
      patientId: 'P-TEST',
      bedNumber: 'BED-01',
      currentTimestamp: baseTime,
      observations: [makeObs('o1', 'P-TEST', 'HEART_RATE', 75, 'BPM', baseTime)],
    };

    const validResult = explainPatient(state);
    const tamperedReason: Reason = {
      ...validResult.reasons[0],
      evidence: {
        ...validResult.reasons[0].evidence,
        vitalType: 'HEART_RATE',
        currentValue: 145, // Fabricated value (actual is 75)
      },
    };

    const validation = validateReasonConsistency(tamperedReason, state);
    expect(validation.isValid).toBe(false);
    expect(validation.issues.some((i) => i.includes('does not match latest observation value'))).toBe(true);
  });
});
