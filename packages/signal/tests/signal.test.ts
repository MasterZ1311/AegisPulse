import { describe, it, expect } from 'vitest';
import { evaluateSQI, signalModuleInfo } from '../src/index';

describe('@aegispulse/signal scaffold', () => {
  it('exposes POS algorithm metadata', () => {
    expect(signalModuleInfo.version).toBe('0.1.0');
    expect(signalModuleInfo.algorithm).toBe('POS');
  });

  it('correctly transitions through 4 SQI states', () => {
    const trusted = evaluateSQI(88);
    expect(trusted.state).toBe('TRUSTED');
    expect(trusted.isUsable).toBe(true);

    const degraded = evaluateSQI(62);
    expect(degraded.state).toBe('DEGRADED');
    expect(degraded.isUsable).toBe(true);

    const unreliable = evaluateSQI(35);
    expect(unreliable.state).toBe('UNRELIABLE');
    expect(unreliable.isUsable).toBe(false);

    const lost = evaluateSQI(10);
    expect(lost.state).toBe('LOST');
    expect(lost.isUsable).toBe(false);
  });
});
