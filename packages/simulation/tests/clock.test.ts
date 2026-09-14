import { describe, it, expect } from 'vitest';
import { SimulationClock, type ClockSnapshot } from '../src/index';

describe('Simulation Clock & Time Dilation Suite', () => {
  const startMs = 1773471600000; // 07:00:00

  it('initializes with correct virtual start time', () => {
    const clock = new SimulationClock(startMs, 1.0);
    expect(clock.getVirtualTimeMs()).toBe(startMs);
    expect(clock.getElapsedVirtualMs()).toBe(0);
    expect(clock.getElapsedVirtualMinutes()).toBe(0);
    expect(clock.isClockPaused()).toBe(false);
  });

  it('steps virtual time forward by exact deterministic delta', () => {
    const clock = new SimulationClock(startMs, 1.0);
    const snap = clock.step(60000); // 1 minute

    expect(snap.virtualTimeMs).toBe(startMs + 60000);
    expect(snap.elapsedVirtualMs).toBe(60000);
    expect(snap.elapsedVirtualMinutes).toBe(1);
    expect(snap.tickIndex).toBe(1);
  });

  it('dilates virtual time correctly based on speed multiplier', () => {
    const clock = new SimulationClock(startMs, 10.0); // 10x real-time
    clock.tick(1000); // 1 second real-time -> 10 seconds virtual

    expect(clock.getElapsedVirtualMs()).toBe(10000);
    expect(clock.getVirtualTimeMs()).toBe(startMs + 10000);
  });

  it('supports high speed multipliers (60x = 1 virtual minute per real second)', () => {
    const clock = new SimulationClock(startMs, 60.0);
    clock.tick(2000); // 2 seconds real-time -> 120 seconds (2 virtual minutes)

    expect(clock.getElapsedVirtualMinutes()).toBe(2);
  });

  it('halts virtual time advance when paused', () => {
    const clock = new SimulationClock(startMs, 10.0);
    clock.step(10000);

    clock.pause();
    expect(clock.isClockPaused()).toBe(true);

    clock.tick(5000); // Should have no effect
    expect(clock.getElapsedVirtualMs()).toBe(10000);

    clock.resume();
    expect(clock.isClockPaused()).toBe(false);

    clock.tick(1000); // 1s real * 10x = 10s virtual
    expect(clock.getElapsedVirtualMs()).toBe(20000);
  });

  it('notifies listeners on clock step/tick', () => {
    const clock = new SimulationClock(startMs, 1.0);
    const receivedSnapshots: ClockSnapshot[] = [];

    const unsubscribe = clock.subscribe((snap) => {
      receivedSnapshots.push(snap);
    });

    clock.step(1000);
    clock.step(2000);
    expect(receivedSnapshots).toHaveLength(2);
    expect(receivedSnapshots[1]!.elapsedVirtualMs).toBe(3000);

    unsubscribe();
    clock.step(1000);
    expect(receivedSnapshots).toHaveLength(2); // No further notifications
  });

  it('resets clock back to initial virtual time', () => {
    const clock = new SimulationClock(startMs, 5.0);
    clock.step(50000);
    expect(clock.getElapsedVirtualMs()).toBe(50000);

    clock.reset();
    expect(clock.getVirtualTimeMs()).toBe(startMs);
    expect(clock.getElapsedVirtualMs()).toBe(0);
    expect(clock.getTickIndex()).toBe(0);
  });
});
