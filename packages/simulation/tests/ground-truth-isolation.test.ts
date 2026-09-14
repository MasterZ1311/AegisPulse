import { describe, it, expect } from 'vitest';
import { validateObservation } from '@aegispulse/types';
import { WardSimulator, DeveloperInspector } from '../src/index';

describe('Ground Truth Isolation & Safety Invariant Suite', () => {
  it('guarantees getWardSnapshot contains ZERO ground truth biological state', () => {
    const sim = new WardSimulator({ seed: 777 });
    sim.step(15000);

    const snapshot = sim.getWardSnapshot();

    // Verify snapshot structure
    expect(snapshot.patients).toHaveLength(6);
    expect(snapshot.beds).toHaveLength(6);

    // Assert that raw ground truth properties do not exist anywhere in clinical snapshot
    const serialized = JSON.stringify(snapshot);
    expect(serialized).not.toContain('groundTruthVitals');
    expect(serialized).not.toContain('trueVitals');
    expect(serialized).not.toContain('noiseDelta');
    expect(serialized).not.toContain('roomTemperatureCelsius');
  });

  it('guarantees all emitted observations pass strict @aegispulse/types validation', () => {
    const sim = new WardSimulator({ seed: 888 });
    sim.step(30000);

    const snapshot = sim.getWardSnapshot();

    for (const pid of Object.keys(snapshot.latestObservations)) {
      const observations = snapshot.latestObservations[pid]!;
      for (const obs of observations) {
        const validation = validateObservation(obs);
        expect(validation.success).toBe(true);
      }
    }
  });

  it('STRICT SAFETY ENFORCEMENT: SpO2 observations NEVER originate from OPTICAL_RPPG', () => {
    const sim = new WardSimulator({ seed: 999 });

    // Step across 60 minutes
    for (let i = 0; i < 10; i++) {
      sim.step(6 * 60 * 1000);
      const snapshot = sim.getWardSnapshot();

      for (const pid of Object.keys(snapshot.latestObservations)) {
        const observations = snapshot.latestObservations[pid]!;
        for (const obs of observations) {
          if (obs.vitalType === 'OXYGEN_SATURATION') {
            expect(obs.source).not.toBe('OPTICAL_RPPG');
            expect(obs.source).toBe('NURSE_MANUAL');
          }
        }
      }
    }
  });

  it('developer ground truth requires valid authentication key', () => {
    const sim = new WardSimulator();

    // Valid auth key succeeds
    const devSnap = sim.getDeveloperGroundTruth('AEGIS_DEV_INSPECT');
    expect(devSnap.patients).toHaveLength(6);
    expect(devSnap.patients[0]!.trueVitals).toBeDefined();

    // Invalid auth key throws unauthorized error
    expect(() => sim.getDeveloperGroundTruth('MALICIOUS_KEY')).toThrow('Unauthorized access');
  });

  it('developer inspector formats clean ASCII diagnostic report', () => {
    const sim = new WardSimulator({ scenarioId: 'SINGLE_PATIENT_DETERIORATION' });
    sim.step(30 * 60 * 1000);

    const devSnap = sim.getDeveloperGroundTruth();
    const report = DeveloperInspector.formatReport(devSnap);

    expect(report).toContain('AEGISPULSE DEVELOPER GROUND TRUTH DIAGNOSTIC REPORT');
    expect(report).toContain('P003');
    expect(report).toContain('Eleanor Vance');
    expect(report).toContain('GRADUAL_TACHYCARDIA');
  });
});
