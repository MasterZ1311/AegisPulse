/**
 * Deterministic PRNG based on Mulberry32 algorithm.
 * Guarantees bit-exact reproducibility across platforms and runs when seeded with the same integer.
 */

export class SeededRandom {
  private state: number;
  private readonly initialSeed: number;

  constructor(seed: number = 1337) {
    this.initialSeed = seed >>> 0;
    this.state = this.initialSeed;
  }

  /**
   * Reset PRNG to its initial seed.
   */
  public reset(): void {
    this.state = this.initialSeed;
  }

  /**
   * Get the initial seed of this PRNG instance.
   */
  public getSeed(): number {
    return this.initialSeed;
  }

  /**
   * Generate next pseudo-random 32-bit float in [0, 1).
   */
  public next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Generate an integer in [min, max] inclusive.
   */
  public nextInt(min: number, max: number): number {
    const low = Math.ceil(min);
    const high = Math.floor(max);
    return Math.floor(this.next() * (high - low + 1)) + low;
  }

  /**
   * Generate a floating point number in [min, max).
   */
  public nextFloat(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /**
   * Return true with given probability in [0, 1].
   */
  public nextBoolean(probability: number = 0.5): boolean {
    return this.next() < probability;
  }

  /**
   * Gaussian distributed random number via Box-Muller transform.
   */
  public nextGaussian(mean: number = 0, stdDev: number = 1): number {
    let u1 = this.next();
    let u2 = this.next();
    // Avoid log(0)
    while (u1 === 0) {
      u1 = this.next();
    }
    while (u2 === 0) {
      u2 = this.next();
    }
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return z0 * stdDev + mean;
  }

  /**
   * Randomly pick an item from an array.
   */
  public pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error('Cannot pick from an empty array');
    }
    const idx = this.nextInt(0, items.length - 1);
    return items[idx]!;
  }
}
