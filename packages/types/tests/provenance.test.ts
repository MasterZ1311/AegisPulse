import { describe, it, expect } from 'vitest';
import { TimestampSchema, ProvenanceSchema } from '../src/index';

describe('Timestamp and Provenance Validation Suite', () => {
  describe('TimestampSchema Rules', () => {
    it('accepts current valid timestamp in milliseconds', () => {
      const now = Date.now();
      const res = TimestampSchema.safeParse(now);
      expect(res.success).toBe(true);
    });

    it('rejects floating point timestamps', () => {
      const res = TimestampSchema.safeParse(Date.now() + 0.5);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toContain('must be an integer');
      }
    });

    it('rejects timestamps prior to year 2020 (1577836800000)', () => {
      const pre2020 = 1500000000000; // 2017
      const res = TimestampSchema.safeParse(pre2020);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toContain('prior to year 2020');
      }
    });

    it('rejects future timestamps exceeding 60s clock drift allowance', () => {
      const distantFuture = Date.now() + 120000; // 2 minutes ahead
      const res = TimestampSchema.safeParse(distantFuture);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toContain('exceeds clock drift threshold');
      }
    });

    it('tolerates small forward clock drift up to 60s', () => {
      const slightDrift = Date.now() + 25000; // 25s ahead
      const res = TimestampSchema.safeParse(slightDrift);
      expect(res.success).toBe(true);
    });
  });

  describe('ProvenanceSchema Rules', () => {
    const validProvenance = {
      derivedAt: Date.now(),
      algorithm: 'ATTENTION_PRIORITY_SCORE_CALCULATOR',
      algorithmVersion: '1.2.0',
      sourceObservationIds: ['obs-hr-001', 'obs-rr-001'],
      confidence: 0.94,
      operatorId: 'NURSE_04',
      parameters: {
        decayHalfLifeMinutes: 120,
        mewsWeight: 0.35,
      },
    };

    it('accepts fully qualified clinical provenance', () => {
      const res = ProvenanceSchema.safeParse(validProvenance);
      expect(res.success).toBe(true);
    });

    it('rejects provenance with empty algorithm identifier', () => {
      const res = ProvenanceSchema.safeParse({
        ...validProvenance,
        algorithm: '',
      });
      expect(res.success).toBe(false);
    });

    it('rejects provenance with empty sourceObservationIds array', () => {
      const res = ProvenanceSchema.safeParse({
        ...validProvenance,
        sourceObservationIds: [],
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toContain('must reference at least one source');
      }
    });

    it('rejects provenance with confidence out of bounds', () => {
      const resNegative = ProvenanceSchema.safeParse({
        ...validProvenance,
        confidence: -0.1,
      });
      const resHigh = ProvenanceSchema.safeParse({
        ...validProvenance,
        confidence: 1.05,
      });
      expect(resNegative.success).toBe(false);
      expect(resHigh.success).toBe(false);
    });
  });
});
