import { describe, it, expect } from 'vitest';
import { SeededRandom } from '../src/index';

describe('Deterministic PRNG Suite (Mulberry32)', () => {
  it('produces identical pseudo-random sequence for identical seeds', () => {
    const prng1 = new SeededRandom(1337);
    const prng2 = new SeededRandom(1337);

    const seq1 = Array.from({ length: 10 }, () => prng1.next());
    const seq2 = Array.from({ length: 10 }, () => prng2.next());

    expect(seq1).toEqual(seq2);
  });

  it('produces distinct sequences for different seeds', () => {
    const prngA = new SeededRandom(100);
    const prngB = new SeededRandom(200);

    const seqA = Array.from({ length: 5 }, () => prngA.next());
    const seqB = Array.from({ length: 5 }, () => prngB.next());

    expect(seqA).not.toEqual(seqB);
  });

  it('resets to identical initial sequence upon reset()', () => {
    const prng = new SeededRandom(42);
    const initialRun = Array.from({ length: 8 }, () => prng.next());

    prng.reset();
    const resetRun = Array.from({ length: 8 }, () => prng.next());

    expect(initialRun).toEqual(resetRun);
  });

  it('generates integers within specified [min, max] inclusive bounds', () => {
    const prng = new SeededRandom(999);
    for (let i = 0; i < 100; i++) {
      const val = prng.nextInt(5, 12);
      expect(val).toBeGreaterThanOrEqual(5);
      expect(val).toBeLessThanOrEqual(12);
      expect(Number.isInteger(val)).toBe(true);
    }
  });

  it('generates Gaussian distribution centered near target mean', () => {
    const prng = new SeededRandom(777);
    const targetMean = 75;
    const targetStdDev = 5;

    let sum = 0;
    const N = 1000;
    for (let i = 0; i < N; i++) {
      sum += prng.nextGaussian(targetMean, targetStdDev);
    }
    const sampleMean = sum / N;

    // Within ~0.5 of mean over 1000 samples
    expect(sampleMean).toBeGreaterThan(targetMean - 0.5);
    expect(sampleMean).toBeLessThan(targetMean + 0.5);
  });

  it('randomly picks elements deterministically from an array', () => {
    const prng1 = new SeededRandom(555);
    const prng2 = new SeededRandom(555);
    const items = ['ALPHA', 'BETA', 'GAMMA', 'DELTA'];

    const picks1 = Array.from({ length: 5 }, () => prng1.pick(items));
    const picks2 = Array.from({ length: 5 }, () => prng2.pick(items));

    expect(picks1).toEqual(picks2);
  });
});
