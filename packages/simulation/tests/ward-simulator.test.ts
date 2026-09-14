import { describe, it, expect } from 'vitest';
import { WardSimulator, createWardSimulator } from '../src/index';

describe('WardSimulator Integration Suite', () => {
  it('instantiates cleanly via createWardSimulator factory with 6 beds', () => {
    const sim = createWardSimulator({ seed: 12345 });
    const snap = sim.getWardSnapshot();

    expect(snap.patients).toHaveLength(6);
    expect(snap.beds).toHaveLength(6);
    expect(Object.keys(snap.clinicalContexts)).toHaveLength(6);
    expect(Object.keys(snap.labs)).toHaveLength(6);
    expect(snap.scenarioId).toBe('NORMAL_SHIFT');
  });

  it('tracks information age minutes when observations cease', () => {
    const sim = new WardSimulator({ scenarioId: 'SIGNAL_FAILURE_SCENARIO' });

    // Step 40 minutes (lights dim)
    sim.step(40 * 60 * 1000);
    // Step into missing observations (min 45 to 85)
    sim.step(30 * 60 * 1000);

    const snap = sim.getWardSnapshot();
    // P002 (Bed 402) has had missing observations for ~25 minutes
    const ageP2 = snap.informationAgeMinutes['P002']!;
    expect(ageP2).toBeGreaterThanOrEqual(20);

    // Other patients with active cameras have near-zero information age
    const ageP1 = snap.informationAgeMinutes['P001']!;
    expect(ageP1).toBeLessThan(1);
  });

  it('manual bedside check immediately updates full vitals and resets information age', () => {
    const sim = new WardSimulator({ scenarioId: 'SIGNAL_FAILURE_SCENARIO' });
    sim.step(60 * 60 * 1000);

    // Nurse performs manual bedside check on P002
    sim.recordManualBedsideCheck('P002');
    const snap = sim.getWardSnapshot();

    expect(snap.informationAgeMinutes['P002']).toBeLessThan(1);

    const p2Obs = snap.latestObservations['P002']!;
    const hasSysBP = p2Obs.some((o) => o.vitalType === 'SYSTOLIC_BP');
    const hasSpO2 = p2Obs.some((o) => o.vitalType === 'OXYGEN_SATURATION');

    expect(hasSysBP).toBe(true);
    expect(hasSpO2).toBe(true);
  });

  it('supports real-time ticks with speed multipliers', () => {
    const sim = new WardSimulator({ initialSpeedMultiplier: 30.0 }); // 30x
    const clock = sim.getClock();

    // 1000ms real delta * 30x = 30,000ms virtual
    sim.tick(1000);
    expect(clock.getElapsedVirtualMs()).toBe(30000);
  });

  it('resets completely back to shift start state', () => {
    const sim = new WardSimulator({ scenarioId: 'SINGLE_PATIENT_DETERIORATION', seed: 444 });
    sim.step(50 * 60 * 1000);

    const devMid = sim.getDeveloperGroundTruth();
    const p3Mid = devMid.patients.find((p) => p.patientId === 'P003')!;
    expect(p3Mid.trueVitals.heartRate).toBeGreaterThan(90);

    sim.reset();
    const devReset = sim.getDeveloperGroundTruth();
    const p3Reset = devReset.patients.find((p) => p.patientId === 'P003')!;

    expect(p3Reset.trueVitals.heartRate).toBe(78); // Back to baseline
    expect(sim.getClock().getElapsedVirtualMs()).toBe(0);
  });
});
