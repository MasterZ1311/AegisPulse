import { describe, it, expect } from 'vitest';
import { calculateQSOFA } from '../src/attentionPriority/qsofa';

describe('quick Sepsis-related Organ Failure Assessment (qSOFA) Engine', () => {
  it('returns qSOFA 0 for normal bedside parameters', () => {
    const res = calculateQSOFA({
      respiratoryRate: 16,
      systolicBP: 120,
      avpu: 'A',
    });

    expect(res.score).toBe(0);
    expect(res.normalizedScore).toBe(0);
    expect(res.isPositive).toBe(false);
    expect(res.criteriaMet).toEqual({
      tachypnea: false,
      alteredMentation: false,
      hypotension: false,
    });
    expect(res.explanation).toContain('qSOFA 0/3');
  });

  it('detects isolated criteria with score 1/3 and isPositive = false', () => {
    const tachypneaRes = calculateQSOFA({ respiratoryRate: 23, systolicBP: 115, avpu: 'A' });
    expect(tachypneaRes.score).toBe(1);
    expect(tachypneaRes.normalizedScore).toBe(35);
    expect(tachypneaRes.isPositive).toBe(false);
    expect(tachypneaRes.criteriaMet.tachypnea).toBe(true);

    const mentationRes = calculateQSOFA({ respiratoryRate: 18, systolicBP: 115, avpu: 'V' });
    expect(mentationRes.score).toBe(1);
    expect(mentationRes.isPositive).toBe(false);
    expect(mentationRes.criteriaMet.alteredMentation).toBe(true);

    const bpRes = calculateQSOFA({ respiratoryRate: 18, systolicBP: 95, avpu: 'A' });
    expect(bpRes.score).toBe(1);
    expect(bpRes.isPositive).toBe(false);
    expect(bpRes.criteriaMet.hypotension).toBe(true);
  });

  it('detects positive qSOFA screen (score >= 2) with sepsis escalation', () => {
    const res = calculateQSOFA({
      respiratoryRate: 24, // >= 22 (+1)
      systolicBP: 92, // <= 100 (+1)
      avpu: 'A',
    });

    expect(res.score).toBe(2);
    expect(res.normalizedScore).toBe(80);
    expect(res.isPositive).toBe(true);
    expect(res.explanation).toContain('qSOFA positive (2/3)');
  });

  it('detects critical qSOFA (score 3/3) with all criteria met', () => {
    const res = calculateQSOFA({
      respiratoryRate: 28,
      systolicBP: 85,
      avpu: 'P',
    });

    expect(res.score).toBe(3);
    expect(res.normalizedScore).toBe(100);
    expect(res.isPositive).toBe(true);
    expect(res.criteriaMet).toEqual({
      tachypnea: true,
      alteredMentation: true,
      hypotension: true,
    });
  });
});
