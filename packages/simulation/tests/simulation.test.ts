import { describe, it, expect } from 'vitest';
import { SCENARIO_CATALOG, generateSimulatedObservation, simulationModuleInfo } from '../src/index';

describe('@aegispulse/simulation scaffold', () => {
  it('exposes 4 standardized clinical scenarios', () => {
    expect(simulationModuleInfo.version).toBe('0.1.0');
    expect(Object.keys(SCENARIO_CATALOG)).toHaveLength(4);
    expect(SCENARIO_CATALOG.ACUTE_SEPSIS_CRASH).toBeDefined();
    expect(SCENARIO_CATALOG.INFORMATION_DECAY_BLINDSPOT).toBeDefined();
  });

  it('generates simulated observations for normal recovery', () => {
    const obs = generateSimulatedObservation('P001', 'NORMAL_RECOVERY', 0);
    expect(obs.patientId).toBe('P001');
    expect(obs.qualityState).toBe('TRUSTED');
    expect(obs.heartRate).toBeGreaterThanOrEqual(70);
    expect(obs.heartRate).toBeLessThanOrEqual(80);
  });

  it('generates severe hemodynamic markers for acute sepsis crash', () => {
    const obs = generateSimulatedObservation('P004', 'ACUTE_SEPSIS_CRASH', 0);
    expect(obs.patientId).toBe('P004');
    expect(obs.heartRate).toBeGreaterThanOrEqual(120);
    expect(obs.systolicBP).toBe(82);
    expect(obs.shockIndex).toBeGreaterThan(1.0);
  });
});
