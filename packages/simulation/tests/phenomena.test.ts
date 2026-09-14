import { describe, it, expect } from 'vitest';
import {
  PhenomenonEngine,
  SeededRandom,
  type GroundTruthVitals,
  type EnvironmentalState,
  type PhenomenonConfig,
} from '../src/index';

describe('Ten Ward Phenomena Engine Suite', () => {
  const baseVitals: GroundTruthVitals = {
    heartRate: 75,
    respiratoryRate: 16,
    systolicBP: 120,
    diastolicBP: 76,
    bodyTemperature: 37.0,
    oxygenSaturation: 98,
    hrvRmssd: 40,
    shockIndex: 0.63,
  };

  const baseEnv: EnvironmentalState = {
    illuminationLux: 350,
    opticalLineOfSight: true,
    motionMagnitude: 0.05,
    contactSensorAttached: false,
    roomTemperatureCelsius: 22.0,
  };

  const startMs = 1773471600000;
  const prng = new SeededRandom(1234);

  it('1. Stable Patient maintains physiological homeostasis', () => {
    const config: PhenomenonConfig = {
      type: 'STABLE_PATIENT',
      patientId: 'P001',
      startVirtualMs: startMs,
      durationMs: 60000,
    };

    const res = PhenomenonEngine.applyPhenomena(
      'P001',
      startMs + 30000,
      baseVitals,
      baseEnv,
      [config],
      prng
    );

    expect(Math.abs(res.vitals.heartRate - baseVitals.heartRate)).toBeLessThanOrEqual(3);
    expect(Math.abs(res.vitals.respiratoryRate - baseVitals.respiratoryRate)).toBeLessThanOrEqual(2);
    expect(res.environment.opticalLineOfSight).toBe(true);
  });

  it('2. Gradual Tachycardia monotonically accelerates heart rate', () => {
    const durationMs = 40 * 60 * 1000; // 40 min
    const config: PhenomenonConfig = {
      type: 'GRADUAL_TACHYCARDIA',
      patientId: 'P001',
      startVirtualMs: startMs,
      durationMs,
      params: { hrDeltaTarget: 25 },
    };

    // At 50% progress (20 min), HR should be +12-13 BPM
    const midRes = PhenomenonEngine.applyPhenomena(
      'P001',
      startMs + 20 * 60 * 1000,
      baseVitals,
      baseEnv,
      [config],
      prng
    );
    expect(midRes.vitals.heartRate).toBeGreaterThanOrEqual(86);
    expect(midRes.vitals.heartRate).toBeLessThanOrEqual(89);

    // At 100% progress (40 min), HR should be ~100 BPM
    const endRes = PhenomenonEngine.applyPhenomena(
      'P001',
      startMs + durationMs,
      baseVitals,
      baseEnv,
      [config],
      prng
    );
    expect(endRes.vitals.heartRate).toBeGreaterThanOrEqual(98);
    expect(endRes.vitals.heartRate).toBeLessThanOrEqual(102);
  });

  it('3. Gradual Respiratory Deterioration accelerates tachypnea', () => {
    const config: PhenomenonConfig = {
      type: 'GRADUAL_RESPIRATORY_DETERIORATION',
      patientId: 'P001',
      startVirtualMs: startMs,
      durationMs: 30 * 60 * 1000,
      params: { rrDeltaTarget: 10 },
    };

    const res = PhenomenonEngine.applyPhenomena(
      'P001',
      startMs + 30 * 60 * 1000,
      baseVitals,
      baseEnv,
      [config],
      prng
    );
    expect(res.vitals.respiratoryRate).toBeGreaterThanOrEqual(25);
    expect(res.vitals.oxygenSaturation).toBeLessThan(baseVitals.oxygenSaturation);
  });

  it('4. Transient Physiological Spike rises and then resolves back to baseline', () => {
    const durationMs = 6 * 60 * 1000; // 6 minutes
    const config: PhenomenonConfig = {
      type: 'TRANSIENT_PHYSIOLOGICAL_SPIKE',
      patientId: 'P001',
      startVirtualMs: startMs,
      durationMs,
      params: { spikeMagnitudeHR: 30 },
    };

    // At peak (50% progress = 3 min)
    const peakRes = PhenomenonEngine.applyPhenomena(
      'P001',
      startMs + 3 * 60 * 1000,
      baseVitals,
      baseEnv,
      [config],
      prng
    );
    expect(peakRes.vitals.heartRate).toBeGreaterThanOrEqual(103);

    // At end (100% progress = 6 min), should return close to baseline 75
    const endRes = PhenomenonEngine.applyPhenomena(
      'P001',
      startMs + durationMs,
      baseVitals,
      baseEnv,
      [config],
      prng
    );
    expect(Math.abs(endRes.vitals.heartRate - baseVitals.heartRate)).toBeLessThanOrEqual(2);
  });

  it('5. Sensor Motion Artifact spikes motion magnitude', () => {
    const config: PhenomenonConfig = {
      type: 'SENSOR_MOTION_ARTIFACT',
      patientId: 'P001',
      startVirtualMs: startMs,
      durationMs: 4 * 60 * 1000,
      params: { motionPeak: 0.8 },
    };

    const peakRes = PhenomenonEngine.applyPhenomena(
      'P001',
      startMs + 2 * 60 * 1000,
      baseVitals,
      baseEnv,
      [config],
      prng
    );
    expect(peakRes.environment.motionMagnitude).toBeGreaterThanOrEqual(0.75);
  });

  it('6. Poor Lighting Low Confidence drops illumination lux', () => {
    const config: PhenomenonConfig = {
      type: 'POOR_LIGHTING_LOW_CONFIDENCE',
      patientId: 'P001',
      startVirtualMs: startMs,
      durationMs: 15 * 60 * 1000,
      params: { luxLevel: 15 },
    };

    const res = PhenomenonEngine.applyPhenomena(
      'P001',
      startMs + 5 * 60 * 1000,
      baseVitals,
      baseEnv,
      [config],
      prng
    );
    expect(res.environment.illuminationLux).toBe(15);
  });

  it('7. Missing Observations sets opticalLineOfSight to false', () => {
    const config: PhenomenonConfig = {
      type: 'MISSING_OBSERVATIONS',
      patientId: 'P001',
      startVirtualMs: startMs,
      durationMs: 10 * 60 * 1000,
    };

    const res = PhenomenonEngine.applyPhenomena(
      'P001',
      startMs + 5 * 60 * 1000,
      baseVitals,
      baseEnv,
      [config],
      prng
    );
    expect(res.environment.opticalLineOfSight).toBe(false);
  });

  it('8. Recovery returns decompensated parameters toward baseline', () => {
    const decompensated: GroundTruthVitals = {
      ...baseVitals,
      heartRate: 110,
      respiratoryRate: 26,
      systolicBP: 95,
      oxygenSaturation: 91,
    };

    const config: PhenomenonConfig = {
      type: 'RECOVERY',
      patientId: 'P001',
      startVirtualMs: startMs,
      durationMs: 20 * 60 * 1000,
    };

    const endRes = PhenomenonEngine.applyPhenomena(
      'P001',
      startMs + 20 * 60 * 1000,
      decompensated,
      baseEnv,
      [config],
      prng
    );
    expect(endRes.vitals.heartRate).toBeLessThan(90);
    expect(endRes.vitals.respiratoryRate).toBeLessThan(20);
    expect(endRes.vitals.systolicBP).toBeGreaterThan(110);
  });

  it('9. Persistent Deterioration induces multi-system collapse and shock index surge', () => {
    const config: PhenomenonConfig = {
      type: 'PERSISTENT_DETERIORATION',
      patientId: 'P001',
      startVirtualMs: startMs,
      durationMs: 30 * 60 * 1000,
      params: {
        hrDeltaTarget: 35,
        rrDeltaTarget: 12,
        sysBpDeltaTarget: -30,
      },
    };

    const res = PhenomenonEngine.applyPhenomena(
      'P001',
      startMs + 30 * 60 * 1000,
      baseVitals,
      baseEnv,
      [config],
      prng
    );
    expect(res.vitals.heartRate).toBeGreaterThanOrEqual(108);
    expect(res.vitals.systolicBP).toBeLessThanOrEqual(92);
    // Shock index HR / Systolic BP should surge past 1.0
    expect(res.vitals.shockIndex).toBeGreaterThan(1.1);
  });

  it('10. Simultaneous Deterioration coordinates multiple patients', () => {
    const config: PhenomenonConfig = {
      type: 'SIMULTANEOUS_DETERIORATION',
      patientId: 'MULTI',
      startVirtualMs: startMs,
      durationMs: 20 * 60 * 1000,
      params: {
        targetPatientIds: ['P003', 'P006'],
      },
    };

    const p3Res = PhenomenonEngine.applyPhenomena('P003', startMs + 20 * 60 * 1000, baseVitals, baseEnv, [config], prng);
    const p6Res = PhenomenonEngine.applyPhenomena('P006', startMs + 20 * 60 * 1000, baseVitals, baseEnv, [config], prng);
    const p1Res = PhenomenonEngine.applyPhenomena('P001', startMs + 20 * 60 * 1000, baseVitals, baseEnv, [config], prng);

    // P003 (orthopedic/bleeding profile) has HR elevation and BP drop
    expect(p3Res.vitals.heartRate).toBeGreaterThan(baseVitals.heartRate + 20);
    // P006 (pneumonia profile) has RR elevation
    expect(p6Res.vitals.respiratoryRate).toBeGreaterThan(baseVitals.respiratoryRate + 8);
    // P001 was not targeted by multi-patient phenomenon
    expect(Math.abs(p1Res.vitals.heartRate - baseVitals.heartRate)).toBeLessThanOrEqual(3);
  });
});
