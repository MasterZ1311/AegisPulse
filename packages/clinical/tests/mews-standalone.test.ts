import { describe, it, expect } from 'vitest';
import {
  calculate,
  explain,
  validate,
  getThresholds,
  MEWS_THRESHOLDS,
} from '../src/mews';

describe('Standalone MEWS Clinical Rule Engine (Subbe et al. 2001)', () => {
  describe('getThresholds()', () => {
    it('exposes complete Subbe et al. 2001 threshold specification', () => {
      const thresholds = getThresholds();
      expect(thresholds).toBe(MEWS_THRESHOLDS);
      expect(thresholds.criticalScoreThreshold).toBe(5);
      expect(thresholds.systolicBP.length).toBe(5);
      expect(thresholds.heartRate.length).toBe(6);
      expect(thresholds.respiratoryRate.length).toBe(5);
      expect(thresholds.temperature.length).toBe(3);
      expect(thresholds.avpu.length).toBe(4);
    });
  });

  describe('validate()', () => {
    it('accepts valid complete vital measurements', () => {
      const res = validate({
        systolicBP: 120,
        heartRate: 72,
        respiratoryRate: 14,
        temperature: 36.8,
        avpu: 'A',
      });
      expect(res.valid).toBe(true);
      expect(res.errors).toHaveLength(0);
      expect(res.sanitizedInput).toBeDefined();
      expect(res.sanitizedInput?.systolicBP).toBe(120);
    });

    it('accepts partial valid vital measurements without error', () => {
      const res = validate({ heartRate: 80, avpu: 'A' });
      expect(res.valid).toBe(true);
      expect(res.errors).toHaveLength(0);
      expect(res.sanitizedInput?.heartRate).toBe(80);
      expect(res.sanitizedInput?.systolicBP).toBeUndefined();
    });

    it('rejects non-object inputs', () => {
      expect(validate(null).valid).toBe(false);
      expect(validate('string').valid).toBe(false);
      expect(validate(123).valid).toBe(false);
    });

    it('rejects out-of-bound physiological vitals', () => {
      expect(validate({ systolicBP: 25 }).valid).toBe(false); // SBP < 30
      expect(validate({ systolicBP: 350 }).valid).toBe(false); // SBP > 300
      expect(validate({ heartRate: 15 }).valid).toBe(false); // HR < 20
      expect(validate({ heartRate: 350 }).valid).toBe(false); // HR > 300
      expect(validate({ respiratoryRate: 1 }).valid).toBe(false); // RR < 2
      expect(validate({ respiratoryRate: 85 }).valid).toBe(false); // RR > 80
      expect(validate({ temperature: 24.5 }).valid).toBe(false); // Temp < 25
      expect(validate({ temperature: 46.0 }).valid).toBe(false); // Temp > 45
      expect(validate({ avpu: 'X' }).valid).toBe(false); // Invalid AVPU
    });

    it('rejects non-finite number values', () => {
      expect(validate({ heartRate: NaN }).valid).toBe(false);
      expect(validate({ respiratoryRate: Infinity }).valid).toBe(false);
    });
  });

  describe('calculate() - Boundary & Threshold Testing', () => {
    it('correctly scores SBP transition boundaries', () => {
      // <=70: 3 pts, 71-80: 2 pts, 81-100: 1 pt, 101-199: 0 pts, >=200: 2 pts
      expect(calculate({ systolicBP: 70 }, { skipValidation: true }).totalScore).toBe(3);
      expect(calculate({ systolicBP: 71 }, { skipValidation: true }).totalScore).toBe(2);
      expect(calculate({ systolicBP: 80 }, { skipValidation: true }).totalScore).toBe(2);
      expect(calculate({ systolicBP: 81 }, { skipValidation: true }).totalScore).toBe(1);
      expect(calculate({ systolicBP: 100 }, { skipValidation: true }).totalScore).toBe(1);
      expect(calculate({ systolicBP: 101 }, { skipValidation: true }).totalScore).toBe(0);
      expect(calculate({ systolicBP: 199 }, { skipValidation: true }).totalScore).toBe(0);
      expect(calculate({ systolicBP: 200 }, { skipValidation: true }).totalScore).toBe(2);
    });

    it('correctly scores HR transition boundaries', () => {
      // <=40: 2, 41-50: 1, 51-100: 0, 101-110: 1, 111-129: 2, >=130: 3
      expect(calculate({ heartRate: 40 }, { skipValidation: true }).totalScore).toBe(2);
      expect(calculate({ heartRate: 41 }, { skipValidation: true }).totalScore).toBe(1);
      expect(calculate({ heartRate: 50 }, { skipValidation: true }).totalScore).toBe(1);
      expect(calculate({ heartRate: 51 }, { skipValidation: true }).totalScore).toBe(0);
      expect(calculate({ heartRate: 100 }, { skipValidation: true }).totalScore).toBe(0);
      expect(calculate({ heartRate: 101 }, { skipValidation: true }).totalScore).toBe(1);
      expect(calculate({ heartRate: 110 }, { skipValidation: true }).totalScore).toBe(1);
      expect(calculate({ heartRate: 111 }, { skipValidation: true }).totalScore).toBe(2);
      expect(calculate({ heartRate: 129 }, { skipValidation: true }).totalScore).toBe(2);
      expect(calculate({ heartRate: 130 }, { skipValidation: true }).totalScore).toBe(3);
    });

    it('correctly scores RR transition boundaries', () => {
      // <=8: 2, 9-14: 0, 15-20: 1, 21-29: 2, >=30: 3
      expect(calculate({ respiratoryRate: 8 }, { skipValidation: true }).totalScore).toBe(2);
      expect(calculate({ respiratoryRate: 9 }, { skipValidation: true }).totalScore).toBe(0);
      expect(calculate({ respiratoryRate: 14 }, { skipValidation: true }).totalScore).toBe(0);
      expect(calculate({ respiratoryRate: 15 }, { skipValidation: true }).totalScore).toBe(1);
      expect(calculate({ respiratoryRate: 20 }, { skipValidation: true }).totalScore).toBe(1);
      expect(calculate({ respiratoryRate: 21 }, { skipValidation: true }).totalScore).toBe(2);
      expect(calculate({ respiratoryRate: 29 }, { skipValidation: true }).totalScore).toBe(2);
      expect(calculate({ respiratoryRate: 30 }, { skipValidation: true }).totalScore).toBe(3);
    });

    it('correctly scores Temperature transition boundaries', () => {
      // <=35.0: 2, 35.1-38.4: 0, >=38.5: 2
      expect(calculate({ temperature: 35.0 }, { skipValidation: true }).totalScore).toBe(2);
      expect(calculate({ temperature: 35.1 }, { skipValidation: true }).totalScore).toBe(0);
      expect(calculate({ temperature: 38.4 }, { skipValidation: true }).totalScore).toBe(0);
      expect(calculate({ temperature: 38.5 }, { skipValidation: true }).totalScore).toBe(2);
    });

    it('correctly scores AVPU scale', () => {
      expect(calculate({ avpu: 'A' }, { skipValidation: true }).totalScore).toBe(0);
      expect(calculate({ avpu: 'V' }, { skipValidation: true }).totalScore).toBe(1);
      expect(calculate({ avpu: 'P' }, { skipValidation: true }).totalScore).toBe(2);
      expect(calculate({ avpu: 'U' }, { skipValidation: true }).totalScore).toBe(3);
    });

    it('evaluates completely normal patient as Green triage with zero score', () => {
      const res = calculate({
        systolicBP: 120,
        heartRate: 75,
        respiratoryRate: 12,
        temperature: 37.0,
        avpu: 'A',
      });

      expect(res.totalScore).toBe(0);
      expect(res.maxPossibleScore).toBe(0);
      expect(res.uncertainty).toBe(0);
      expect(res.missingValues).toHaveLength(0);
      expect(res.contributingVariables).toHaveLength(0);
      expect(res.triageLevel).toBe('green');
      expect(res.isSevere).toBe(false);
    });

    it('evaluates moderate derangement as Yellow triage (3-4 pts)', () => {
      const res = calculate({
        systolicBP: 95, // 1 pt
        heartRate: 105, // 1 pt
        respiratoryRate: 18, // 1 pt
        temperature: 37.0, // 0 pts
        avpu: 'A', // 0 pts
      });

      expect(res.totalScore).toBe(3);
      expect(res.triageLevel).toBe('yellow');
      expect(res.isSevere).toBe(false);
      expect(res.contributingVariables).toHaveLength(3);
    });

    it('evaluates critical decompensation as Red triage (>=5 pts)', () => {
      const res = calculate({
        systolicBP: 75, // 2 pts
        heartRate: 115, // 2 pts
        respiratoryRate: 24, // 2 pts
        temperature: 39.0, // 2 pts
        avpu: 'V', // 1 pt
      });

      expect(res.totalScore).toBe(9);
      expect(res.triageLevel).toBe('red');
      expect(res.isSevere).toBe(true);
      expect(res.contributingVariables).toHaveLength(5);
    });
  });

  describe('Missing Data & Uncertainty Invariants (No Silent Substitution)', () => {
    it('does NOT silently treat missing parameters as 0 points', () => {
      const res = calculate({
        heartRate: 72,
      });

      expect(res.totalScore).toBe(0);
      expect(res.missingValues).toEqual([
        'systolicBP',
        'respiratoryRate',
        'temperature',
        'avpu',
      ]);
      expect(res.subscores.systolicBP.missing).toBe(true);
      expect(res.subscores.respiratoryRate.missing).toBe(true);
      expect(res.subscores.temperature.missing).toBe(true);
      expect(res.subscores.avpu.missing).toBe(true);
      expect(res.subscores.heartRate.missing).toBe(false);

      // Missing max points: SBP(3) + RR(3) + Temp(2) + AVPU(3) = 11
      expect(res.maxPossibleScore).toBe(11);
      // Uncertainty: 11 / 14 = 0.786
      expect(res.uncertainty).toBeCloseTo(0.786, 2);
    });

    it('handles 100% missing data with maximal uncertainty and totalScore 0', () => {
      const res = calculate({});

      expect(res.totalScore).toBe(0);
      expect(res.missingValues).toHaveLength(5);
      expect(res.maxPossibleScore).toBe(14);
      expect(res.uncertainty).toBe(1.0);
    });

    it('tracks single missing parameter uncertainty accurately', () => {
      const res = calculate({
        systolicBP: 120, // 0
        heartRate: 72, // 0
        respiratoryRate: 14, // 0
        temperature: 37.0, // 0
        // avpu is missing (max 3 pts)
      });

      expect(res.totalScore).toBe(0);
      expect(res.missingValues).toEqual(['avpu']);
      expect(res.maxPossibleScore).toBe(3);
      expect(res.uncertainty).toBeCloseTo(3 / 14, 3);
    });
  });

  describe('explain()', () => {
    it('generates clinical explanation for stable patient', () => {
      const result = calculate({
        systolicBP: 120,
        heartRate: 72,
        respiratoryRate: 14,
        temperature: 36.8,
        avpu: 'A',
      });
      const exp = explain(result);

      expect(exp.triageLevel).toBe('green');
      expect(exp.summary).toContain('MEWS Score is 0/14');
      expect(exp.clinicalEscalation).toContain('routine vital signs monitoring');
      expect(exp.missingDataWarning).toBeUndefined();
    });

    it('generates clinical explanation for critical red patient with escalation protocol', () => {
      const result = calculate({
        systolicBP: 68, // 3 pts
        heartRate: 135, // 3 pts
        respiratoryRate: 32, // 3 pts
        temperature: 39.0, // 2 pts
        avpu: 'P', // 2 pts
      });
      const exp = explain(result);

      expect(exp.triageLevel).toBe('red');
      expect(exp.summary).toContain('MEWS Score is 13/14 (High Risk - Triage RED)');
      expect(exp.clinicalEscalation).toContain('Medical Emergency Team');
      expect(exp.details.length).toBe(5);
    });

    it('includes explicit missing data warning and uncertainty when vitals are incomplete', () => {
      const result = calculate({
        heartRate: 115, // 2 pts
      });
      const exp = explain(result);

      expect(exp.missingDataWarning).toBeDefined();
      expect(exp.missingDataWarning).toContain('Incomplete data');
      expect(exp.missingDataWarning).toContain('Systolic BP');
      expect(exp.missingDataWarning).toContain('Respiratory Rate');
      expect(exp.missingDataWarning).toContain('uncertainty');
    });
  });
});
