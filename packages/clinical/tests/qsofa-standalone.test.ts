import { describe, it, expect } from 'vitest';
import {
  calculate,
  explain,
  validate,
  getThresholds,
  QSOFA_THRESHOLDS,
} from '../src/qsofa';

describe('Standalone qSOFA Clinical Rule Engine (Singer et al. 2016 Sepsis-3)', () => {
  describe('getThresholds()', () => {
    it('exposes complete Sepsis-3 consensus threshold definitions', () => {
      const thresholds = getThresholds();
      expect(thresholds).toBe(QSOFA_THRESHOLDS);
      expect(thresholds.respiratoryRate.threshold).toBe(22);
      expect(thresholds.systolicBP.threshold).toBe(100);
      expect(thresholds.alteredMentation.gcsThreshold).toBe(15);
      expect(thresholds.positiveScreenThreshold).toBe(2);
    });
  });

  describe('validate()', () => {
    it('validates standard bedside inputs', () => {
      const res = validate({
        respiratoryRate: 18,
        systolicBP: 120,
        avpu: 'A',
        gcs: 15,
      });
      expect(res.valid).toBe(true);
      expect(res.errors).toHaveLength(0);
      expect(res.sanitizedInput?.systolicBP).toBe(120);
    });

    it('accepts partial inputs during rapid triage', () => {
      const res = validate({ respiratoryRate: 20 });
      expect(res.valid).toBe(true);
      expect(res.sanitizedInput?.respiratoryRate).toBe(20);
      expect(res.sanitizedInput?.systolicBP).toBeUndefined();
    });

    it('rejects invalid types and out-of-bound physiological ranges', () => {
      expect(validate(null).valid).toBe(false);
      expect(validate({ respiratoryRate: 1 }).valid).toBe(false); // RR < 2
      expect(validate({ respiratoryRate: 90 }).valid).toBe(false); // RR > 80
      expect(validate({ systolicBP: 20 }).valid).toBe(false); // SBP < 30
      expect(validate({ systolicBP: 320 }).valid).toBe(false); // SBP > 300
      expect(validate({ gcs: 2 }).valid).toBe(false); // GCS < 3
      expect(validate({ gcs: 16 }).valid).toBe(false); // GCS > 15
      expect(validate({ avpu: 'Alert' }).valid).toBe(false); // Non-standard AVPU
    });
  });

  describe('calculate() - Cutoff & Boundary Testing', () => {
    it('correctly evaluates Respiratory Rate cutoff (>= 22 breaths/min)', () => {
      // 21 is normal (0 pts), 22 triggers criterion (1 pt)
      const normalRR = calculate({ respiratoryRate: 21 }, { skipValidation: true });
      expect(normalRR.subscores.respiratoryRate.points).toBe(0);

      const abnormalRR = calculate({ respiratoryRate: 22 }, { skipValidation: true });
      expect(abnormalRR.subscores.respiratoryRate.points).toBe(1);
      expect(abnormalRR.subscores.respiratoryRate.contributing).toBe(true);
    });

    it('correctly evaluates Systolic Blood Pressure cutoff (<= 100 mmHg)', () => {
      // 101 is normal (0 pts), 100 triggers criterion (1 pt)
      const normalSBP = calculate({ systolicBP: 101 }, { skipValidation: true });
      expect(normalSBP.subscores.systolicBP.points).toBe(0);

      const abnormalSBP = calculate({ systolicBP: 100 }, { skipValidation: true });
      expect(abnormalSBP.subscores.systolicBP.points).toBe(1);
      expect(abnormalSBP.subscores.systolicBP.contributing).toBe(true);
    });

    it('correctly evaluates Altered Mentation using AVPU', () => {
      expect(calculate({ avpu: 'A' }, { skipValidation: true }).subscores.alteredMentation.points).toBe(0);
      expect(calculate({ avpu: 'V' }, { skipValidation: true }).subscores.alteredMentation.points).toBe(1);
      expect(calculate({ avpu: 'P' }, { skipValidation: true }).subscores.alteredMentation.points).toBe(1);
      expect(calculate({ avpu: 'U' }, { skipValidation: true }).subscores.alteredMentation.points).toBe(1);
    });

    it('correctly evaluates Altered Mentation using GCS (< 15)', () => {
      expect(calculate({ gcs: 15 }, { skipValidation: true }).subscores.alteredMentation.points).toBe(0);
      expect(calculate({ gcs: 14 }, { skipValidation: true }).subscores.alteredMentation.points).toBe(1);
      expect(calculate({ gcs: 8 }, { skipValidation: true }).subscores.alteredMentation.points).toBe(1);
      expect(calculate({ gcs: 3 }, { skipValidation: true }).subscores.alteredMentation.points).toBe(1);
    });

    it('evaluates completely normal patient as Negative screen (0/3)', () => {
      const res = calculate({
        respiratoryRate: 16,
        systolicBP: 125,
        avpu: 'A',
      });

      expect(res.totalScore).toBe(0);
      expect(res.isPositive).toBe(false);
      expect(res.maxPossibleScore).toBe(0);
      expect(res.uncertainty).toBe(0);
      expect(res.missingValues).toHaveLength(0);
      expect(res.contributingVariables).toHaveLength(0);
    });

    it('evaluates single criterion as Negative screen (1/3)', () => {
      const res = calculate({
        respiratoryRate: 25, // 1 pt
        systolicBP: 120, // 0 pts
        avpu: 'A', // 0 pts
      });

      expect(res.totalScore).toBe(1);
      expect(res.isPositive).toBe(false);
      expect(res.contributingVariables).toHaveLength(1);
      expect(res.contributingVariables[0].variable).toBe('respiratoryRate');
    });

    it('evaluates positive sepsis screen when 2 criteria met (score 2/3)', () => {
      const res = calculate({
        respiratoryRate: 24, // 1 pt
        systolicBP: 95, // 1 pt
        avpu: 'A', // 0 pts
      });

      expect(res.totalScore).toBe(2);
      expect(res.isPositive).toBe(true);
      expect(res.contributingVariables).toHaveLength(2);
    });

    it('evaluates maximal positive sepsis screen when all 3 criteria met (score 3/3)', () => {
      const res = calculate({
        respiratoryRate: 28, // 1 pt
        systolicBP: 85, // 1 pt
        avpu: 'P', // 1 pt
      });

      expect(res.totalScore).toBe(3);
      expect(res.isPositive).toBe(true);
      expect(res.contributingVariables).toHaveLength(3);
    });
  });

  describe('Missing Data & Uncertainty Invariants (No Silent Substitution)', () => {
    it('does NOT silently treat missing criteria as normal (0 pts)', () => {
      const res = calculate({
        respiratoryRate: 26, // 1 pt
      });

      expect(res.totalScore).toBe(1);
      expect(res.isPositive).toBe(false);
      expect(res.missingValues).toEqual(['systolicBP', 'alteredMentation']);
      expect(res.subscores.systolicBP.missing).toBe(true);
      expect(res.subscores.alteredMentation.missing).toBe(true);
      expect(res.subscores.respiratoryRate.missing).toBe(false);

      // Max possible: 1 + 2 = 3
      expect(res.maxPossibleScore).toBe(3);
      // Uncertainty: 2 / 3 = 0.667
      expect(res.uncertainty).toBeCloseTo(0.667, 2);
    });

    it('handles 100% missing data with full uncertainty and totalScore 0', () => {
      const res = calculate({});

      expect(res.totalScore).toBe(0);
      expect(res.isPositive).toBe(false);
      expect(res.missingValues).toHaveLength(3);
      expect(res.maxPossibleScore).toBe(3);
      expect(res.uncertainty).toBe(1.0);
    });

    it('recognizes screen can be POSITIVE despite missing criteria if verified criteria >= 2', () => {
      const res = calculate({
        respiratoryRate: 24, // 1 pt
        systolicBP: 90, // 1 pt
        // mental status missing
      });

      expect(res.totalScore).toBe(2);
      expect(res.isPositive).toBe(true); // Already positive regardless of missing mentation
      expect(res.missingValues).toEqual(['alteredMentation']);
      expect(res.maxPossibleScore).toBe(3);
      expect(res.uncertainty).toBeCloseTo(0.333, 2);
    });
  });

  describe('explain()', () => {
    it('generates clinical explanation for negative screen', () => {
      const result = calculate({
        respiratoryRate: 16,
        systolicBP: 120,
        avpu: 'A',
      });
      const exp = explain(result);

      expect(exp.isPositive).toBe(false);
      expect(exp.summary).toContain('qSOFA Score is 0/3 (Negative Screen - Low Risk)');
      expect(exp.clinicalEscalation).toContain('routine vital signs surveillance');
      expect(exp.missingDataWarning).toBeUndefined();
    });

    it('generates urgent clinical escalation for positive screen (>= 2)', () => {
      const result = calculate({
        respiratoryRate: 26,
        systolicBP: 92,
        avpu: 'A',
      });
      const exp = explain(result);

      expect(exp.isPositive).toBe(true);
      expect(exp.summary).toContain('qSOFA Score is 2/3 (POSITIVE Screen - High Risk)');
      expect(exp.clinicalEscalation).toContain('Immediately activate hospital sepsis pathway');
      expect(exp.details).toHaveLength(2);
    });

    it('alerts clinician when missing parameters could alter sepsis screen status', () => {
      const result = calculate({
        respiratoryRate: 24, // 1 pt
      });
      const exp = explain(result);

      expect(exp.missingDataWarning).toBeDefined();
      expect(exp.missingDataWarning).toContain('Incomplete data');
      expect(exp.missingDataWarning).toContain('Systolic BP');
      expect(exp.missingDataWarning).toContain('Mental Status');
      expect(exp.missingDataWarning).toContain('Screen may become POSITIVE');
    });
  });
});
