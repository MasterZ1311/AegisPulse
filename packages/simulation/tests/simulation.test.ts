import { describe, it, expect } from 'vitest';
import { SCENARIO_CATALOG, generateSimulatedObservation, simulationModuleInfo } from '../src/index';

describe('@aegispulse/simulation backward compatibility & scenario catalog', () => {
  it('exposes the 5 official hospital ward scenarios', () => {
    expect(simulationModuleInfo.version).toBe('0.1.0');
    expect(Object.keys(SCENARIO_CATALOG)).toHaveLength(5);
    expect(SCENARIO_CATALOG.NORMAL_SHIFT).toBeDefined();
    expect(SCENARIO_CATALOG.SINGLE_PATIENT_DETERIORATION).toBeDefined();
    expect(SCENARIO_CATALOG.FALSE_ALARM_SCENARIO).toBeDefined();
    expect(SCENARIO_CATALOG.SIGNAL_FAILURE_SCENARIO).toBeDefined();
    expect(SCENARIO_CATALOG.MULTIPLE_PATIENT_SCENARIO).toBeDefined();
  });

  it('generates simulated observations for normal recovery', () => {
    const obs = generateSimulatedObservation('P001', 'NORMAL_SHIFT', 0);
    expect(obs.patientId).toBe('P001');
    expect(obs.qualityState).toBe('TRUSTED');
    expect(obs.heartRate).toBeGreaterThanOrEqual(70);
    expect(obs.heartRate).toBeLessThanOrEqual(80);
  });

  it('generates severe hemodynamic markers for acute deterioration', () => {
    const obs = generateSimulatedObservation('P004', 'SINGLE_PATIENT_DETERIORATION', 0);
    expect(obs.patientId).toBe('P004');
    expect(obs.heartRate).toBeGreaterThanOrEqual(120);
    expect(obs.systolicBP).toBe(82);
    expect(obs.shockIndex).toBeGreaterThan(1.0);
  });
});
