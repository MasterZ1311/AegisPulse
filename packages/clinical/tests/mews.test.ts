import { describe, it, expect } from 'vitest';
import { calculateMEWS } from '../src/attentionPriority/mews';

describe('Modified Early Warning Score (MEWS) Engine', () => {
  it('calculates MEWS 0 for completely normal physiological vitals', () => {
    const res = calculateMEWS({
      heartRate: 72,
      respiratoryRate: 14,
      systolicBP: 120,
      temperature: 37.0,
      avpu: 'A',
    });

    expect(res.score).toBe(0);
    expect(res.normalizedScore).toBe(0);
    expect(res.triageLevel).toBe('green');
    expect(res.isSevere).toBe(false);
    expect(res.subscores).toEqual({
      sbp: 0,
      hr: 0,
      rr: 0,
      temp: 0,
      avpu: 0,
    });
  });

  it('correctly scores Systolic Blood Pressure ranges', () => {
    expect(calculateMEWS({ systolicBP: 65 }).subscores.sbp).toBe(3);
    expect(calculateMEWS({ systolicBP: 75 }).subscores.sbp).toBe(2);
    expect(calculateMEWS({ systolicBP: 95 }).subscores.sbp).toBe(1);
    expect(calculateMEWS({ systolicBP: 130 }).subscores.sbp).toBe(0);
    expect(calculateMEWS({ systolicBP: 210 }).subscores.sbp).toBe(2);
  });

  it('correctly scores Heart Rate ranges', () => {
    expect(calculateMEWS({ heartRate: 38 }).subscores.hr).toBe(2);
    expect(calculateMEWS({ heartRate: 45 }).subscores.hr).toBe(1);
    expect(calculateMEWS({ heartRate: 75 }).subscores.hr).toBe(0);
    expect(calculateMEWS({ heartRate: 105 }).subscores.hr).toBe(1);
    expect(calculateMEWS({ heartRate: 120 }).subscores.hr).toBe(2);
    expect(calculateMEWS({ heartRate: 140 }).subscores.hr).toBe(3);
  });

  it('correctly scores Respiratory Rate ranges', () => {
    expect(calculateMEWS({ respiratoryRate: 7 }).subscores.rr).toBe(2);
    expect(calculateMEWS({ respiratoryRate: 12 }).subscores.rr).toBe(0);
    expect(calculateMEWS({ respiratoryRate: 18 }).subscores.rr).toBe(1);
    expect(calculateMEWS({ respiratoryRate: 26 }).subscores.rr).toBe(2);
    expect(calculateMEWS({ respiratoryRate: 32 }).subscores.rr).toBe(3);
  });

  it('correctly scores Body Temperature ranges', () => {
    expect(calculateMEWS({ temperature: 34.8 }).subscores.temp).toBe(2);
    expect(calculateMEWS({ temperature: 37.1 }).subscores.temp).toBe(0);
    expect(calculateMEWS({ temperature: 39.2 }).subscores.temp).toBe(2);
  });

  it('correctly scores Neurological AVPU scale', () => {
    expect(calculateMEWS({ avpu: 'A' }).subscores.avpu).toBe(0);
    expect(calculateMEWS({ avpu: 'V' }).subscores.avpu).toBe(1);
    expect(calculateMEWS({ avpu: 'P' }).subscores.avpu).toBe(2);
    expect(calculateMEWS({ avpu: 'U' }).subscores.avpu).toBe(3);
  });

  it('detects critical threshold (MEWS >= 5) with red triage and normalized score >= 75', () => {
    const res = calculateMEWS({
      heartRate: 115, // 2 pts
      respiratoryRate: 24, // 2 pts
      systolicBP: 95, // 1 pt
      temperature: 37.0,
      avpu: 'A',
    });

    expect(res.score).toBe(5);
    expect(res.isSevere).toBe(true);
    expect(res.triageLevel).toBe('red');
    expect(res.normalizedScore).toBe(75);
  });

  it('scales severe MEWS beyond 5 towards 100', () => {
    const res = calculateMEWS({
      heartRate: 135, // 3 pts
      respiratoryRate: 32, // 3 pts
      systolicBP: 70, // 3 pts
      temperature: 34.5, // 2 pts
      avpu: 'P', // 2 pts
    });

    expect(res.score).toBe(13);
    expect(res.isSevere).toBe(true);
    expect(res.triageLevel).toBe('red');
    expect(res.normalizedScore).toBe(100);
  });
});
