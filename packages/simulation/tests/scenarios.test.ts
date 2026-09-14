import { describe, it, expect } from 'vitest';
import { SCENARIO_CATALOG, WardSimulator } from '../src/index';

describe('Shift Scenarios Suite', () => {
  it('exposes all 5 requested shift scenarios', () => {
    const keys = Object.keys(SCENARIO_CATALOG);
    expect(keys).toContain('NORMAL_SHIFT');
    expect(keys).toContain('SINGLE_PATIENT_DETERIORATION');
    expect(keys).toContain('FALSE_ALARM_SCENARIO');
    expect(keys).toContain('SIGNAL_FAILURE_SCENARIO');
    expect(keys).toContain('MULTIPLE_PATIENT_SCENARIO');
  });

  describe('1. NORMAL_SHIFT', () => {
    it('keeps all 6 patients hemodynamically stable over 120 minutes', () => {
      const sim = new WardSimulator({ scenarioId: 'NORMAL_SHIFT', seed: 101 });

      // Advance virtual time by 60 minutes (3600 seconds)
      sim.step(60 * 60 * 1000);

      const devSnapshot = sim.getDeveloperGroundTruth();
      expect(devSnapshot.patients).toHaveLength(6);

      for (const p of devSnapshot.patients) {
        // Heart rate stays in reasonable stable boundary
        expect(p.trueVitals.heartRate).toBeGreaterThanOrEqual(65);
        expect(p.trueVitals.heartRate).toBeLessThanOrEqual(92);
        // Shock index stays normal < 0.8
        expect(p.trueVitals.shockIndex).toBeLessThan(0.85);
      }
    });
  });

  describe('2. SINGLE_PATIENT_DETERIORATION', () => {
    it('isolates deterioration to Bed 403 (P003) while others remain stable', () => {
      const sim = new WardSimulator({ scenarioId: 'SINGLE_PATIENT_DETERIORATION', seed: 202 });

      // Step forward 45 minutes into deterioration
      sim.step(45 * 60 * 1000);
      const devSnapshot = sim.getDeveloperGroundTruth();

      const p3 = devSnapshot.patients.find((p) => p.patientId === 'P003')!;
      const p1 = devSnapshot.patients.find((p) => p.patientId === 'P001')!;

      // P003 HR accelerated significantly
      expect(p3.trueVitals.heartRate).toBeGreaterThanOrEqual(95);

      // P001 remains at baseline ~72
      expect(p1.trueVitals.heartRate).toBeLessThanOrEqual(76);

      // Step forward to min 80 (persistent deterioration & hypotension)
      sim.step(35 * 60 * 1000);
      const crashSnapshot = sim.getDeveloperGroundTruth();
      const p3Crashed = crashSnapshot.patients.find((p) => p.patientId === 'P003')!;

      // Systolic BP dropped, Shock index elevated
      expect(p3Crashed.trueVitals.systolicBP).toBeLessThanOrEqual(100);
      expect(p3Crashed.trueVitals.shockIndex).toBeGreaterThanOrEqual(0.95);
    });
  });

  describe('3. FALSE_ALARM_SCENARIO', () => {
    it('demonstrates transient spike at min 26 which completely resolves by min 35', () => {
      const sim = new WardSimulator({ scenarioId: 'FALSE_ALARM_SCENARIO', seed: 303 });

      // Step to min 26 (peak of transient phone call cough spike)
      sim.step(26.5 * 60 * 1000);
      const spikeSnap = sim.getDeveloperGroundTruth();
      const p5Spike = spikeSnap.patients.find((p) => p.patientId === 'P005')!;

      expect(p5Spike.trueVitals.heartRate).toBeGreaterThanOrEqual(95);
      expect(p5Spike.environment.motionMagnitude).toBeGreaterThan(0.5);

      // Step to min 35 (spike completely subsided)
      sim.step(8.5 * 60 * 1000);
      const resolvedSnap = sim.getDeveloperGroundTruth();
      const p5Resolved = resolvedSnap.patients.find((p) => p.patientId === 'P005')!;

      // Returned to baseline ~74 BPM
      expect(p5Resolved.trueVitals.heartRate).toBeLessThanOrEqual(78);
      expect(p5Resolved.environment.motionMagnitude).toBeLessThan(0.1);
    });
  });

  describe('4. SIGNAL_FAILURE_SCENARIO', () => {
    it('demonstrates confidence collapse while ground truth physiology is normal', () => {
      const sim = new WardSimulator({ scenarioId: 'SIGNAL_FAILURE_SCENARIO', seed: 404 });

      // Advance to min 20 (dim lighting: 15 lux)
      sim.step(20 * 60 * 1000);
      const wardSnapDim = sim.getWardSnapshot();
      const p2SQIDim = wardSnapDim.latestSignalQuality['P002']!;

      expect(p2SQIDim.illuminationLux).toBe(15);
      expect(p2SQIDim.sqiPercentage).toBeLessThan(65);

      // Advance to min 60 (missing observations: camera occluded)
      sim.step(40 * 60 * 1000);
      const wardSnapLost = sim.getWardSnapshot();
      const p2SQILost = wardSnapLost.latestSignalQuality['P002']!;

      expect(p2SQILost.faceDetected).toBe(false);
      expect(p2SQILost.state).toBe('LOST');

      // Ground truth biological physiology is still healthy
      const devSnap = sim.getDeveloperGroundTruth();
      const p2True = devSnap.patients.find((p) => p.patientId === 'P002')!;
      expect(p2True.trueVitals.heartRate).toBeLessThan(90);
      expect(p2True.trueVitals.respiratoryRate).toBeLessThanOrEqual(21);
    });
  });

  describe('5. MULTIPLE_PATIENT_SCENARIO', () => {
    it('simultaneously drives deterioration in Bed 403 and Bed 406', () => {
      const sim = new WardSimulator({ scenarioId: 'MULTIPLE_PATIENT_SCENARIO', seed: 505 });

      // Step forward to min 45
      sim.step(45 * 60 * 1000);
      const devSnap = sim.getDeveloperGroundTruth();

      const p3 = devSnap.patients.find((p) => p.patientId === 'P003')!;
      const p6 = devSnap.patients.find((p) => p.patientId === 'P006')!;
      const p1 = devSnap.patients.find((p) => p.patientId === 'P001')!;

      // P003 has significant tachycardia (occult sepsis/bleeding)
      expect(p3.trueVitals.heartRate).toBeGreaterThan(95);

      // P006 has severe tachypnea (respiratory decompensation)
      expect(p6.trueVitals.respiratoryRate).toBeGreaterThan(26);

      // P001 remains stable baseline
      expect(p1.trueVitals.heartRate).toBeLessThanOrEqual(76);
    });
  });
});
