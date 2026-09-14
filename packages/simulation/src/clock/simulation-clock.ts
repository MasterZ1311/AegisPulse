/**
 * Configurable simulation clock with variable speed dilation.
 * Supports headless deterministic stepping and real-time execution.
 */

export interface ClockSnapshot {
  virtualTimeMs: number;
  virtualIso: string;
  elapsedVirtualMs: number;
  elapsedVirtualMinutes: number;
  speedMultiplier: number;
  isPaused: boolean;
  tickIndex: number;
}

export type ClockListener = (snapshot: ClockSnapshot) => void;

export class SimulationClock {
  private readonly startVirtualTimeMs: number;
  private currentVirtualTimeMs: number;
  private speedMultiplier: number;
  private isPaused: boolean = false;
  private tickIndex: number = 0;
  private listeners: Set<ClockListener> = new Set();

  /**
   * @param startVirtualTimeMs Initial epoch ms for virtual ward shift (default: reference date 07:00:00)
   * @param initialSpeedMultiplier Speed multiplier relative to real time (e.g., 10x, 30x)
   */
  constructor(
    startVirtualTimeMs: number = 1773471600000,
    initialSpeedMultiplier: number = 1.0
  ) {
    this.startVirtualTimeMs = startVirtualTimeMs;
    this.currentVirtualTimeMs = startVirtualTimeMs;
    this.speedMultiplier = Math.max(0.1, initialSpeedMultiplier);
  }

  /**
   * Current virtual epoch timestamp in milliseconds.
   */
  public getVirtualTimeMs(): number {
    return this.currentVirtualTimeMs;
  }

  /**
   * Virtual start time in milliseconds.
   */
  public getStartVirtualTimeMs(): number {
    return this.startVirtualTimeMs;
  }

  /**
   * Virtual time as ISO string.
   */
  public getVirtualIso(): string {
    return new Date(this.currentVirtualTimeMs).toISOString();
  }

  /**
   * Total virtual milliseconds elapsed since simulation start.
   */
  public getElapsedVirtualMs(): number {
    return this.currentVirtualTimeMs - this.startVirtualTimeMs;
  }

  /**
   * Total virtual minutes elapsed since simulation start.
   */
  public getElapsedVirtualMinutes(): number {
    return this.getElapsedVirtualMs() / (60 * 1000);
  }

  /**
   * Current speed multiplier.
   */
  public getSpeedMultiplier(): number {
    return this.speedMultiplier;
  }

  /**
   * Set speed multiplier (e.g. 1x, 5x, 10x, 60x).
   */
  public setSpeedMultiplier(multiplier: number): void {
    if (multiplier <= 0) {
      throw new Error('Speed multiplier must be strictly positive');
    }
    this.speedMultiplier = multiplier;
  }

  /**
   * Pause the clock.
   */
  public pause(): void {
    this.isPaused = true;
  }

  /**
   * Resume the clock.
   */
  public resume(): void {
    this.isPaused = false;
  }

  /**
   * Check if clock is currently paused.
   */
  public isClockPaused(): boolean {
    return this.isPaused;
  }

  /**
   * Current tick counter index.
   */
  public getTickIndex(): number {
    return this.tickIndex;
  }

  /**
   * Advance virtual time by exact virtual delta in milliseconds.
   * Useful for headless automated testing and deterministic steps.
   */
  public step(deltaVirtualMs: number): ClockSnapshot {
    if (deltaVirtualMs < 0) {
      throw new Error('deltaVirtualMs cannot be negative');
    }
    this.currentVirtualTimeMs += deltaVirtualMs;
    this.tickIndex++;

    const snapshot = this.getSnapshot();
    this.notifyListeners(snapshot);
    return snapshot;
  }

  /**
   * Advance clock by real-world delta milliseconds, scaled by speedMultiplier.
   * If clock is paused, virtual time does not advance.
   */
  public tick(realDeltaMs: number): ClockSnapshot {
    if (this.isPaused || realDeltaMs <= 0) {
      return this.getSnapshot();
    }
    const virtualDeltaMs = realDeltaMs * this.speedMultiplier;
    return this.step(virtualDeltaMs);
  }

  /**
   * Reset the clock back to the starting virtual time.
   */
  public reset(): void {
    this.currentVirtualTimeMs = this.startVirtualTimeMs;
    this.tickIndex = 0;
    this.isPaused = false;
  }

  /**
   * Capture an immutable snapshot of the current clock state.
   */
  public getSnapshot(): ClockSnapshot {
    return {
      virtualTimeMs: this.currentVirtualTimeMs,
      virtualIso: this.getVirtualIso(),
      elapsedVirtualMs: this.getElapsedVirtualMs(),
      elapsedVirtualMinutes: this.getElapsedVirtualMinutes(),
      speedMultiplier: this.speedMultiplier,
      isPaused: this.isPaused,
      tickIndex: this.tickIndex,
    };
  }

  /**
   * Subscribe to clock tick events.
   */
  public subscribe(listener: ClockListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(snapshot: ClockSnapshot): void {
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch (err) {
        console.error('Error in SimulationClock listener:', err);
      }
    }
  }
}
