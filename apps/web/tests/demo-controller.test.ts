import { describe, it, expect, beforeEach } from 'vitest';
import { demoScenarioController, ORDERED_DEMO_STEPS } from '../src/services/demo-scenario-controller';

describe('Phase 27: Flagship Deterministic Demo Controller Suite', () => {
  beforeEach(() => {
    demoScenarioController.reset();
  });

  it('1. Initializes at Step 0 Baseline with all 6 beds stable and low priority', () => {
    const step = demoScenarioController.getCurrentStep();
    expect(step.stepId).toBe('STEP_0_BASELINE');
    expect(step.index).toBe(0);

    const patients = demoScenarioController.generatePatientsForStep('STEP_0_BASELINE');
    expect(patients.length).toBe(6);
    for (const p of patients) {
      expect(p.category).toBe('LOW');
      expect(p.apsScore).toBeLessThanOrEqual(25);
    }
  });

  it('2. Event 1: Transient spike in Bed 405 does not cause persistent critical escalation', () => {
    const patients = demoScenarioController.setStep(1);
    const step = demoScenarioController.getCurrentStep();

    expect(step.stepId).toBe('STEP_1_TRANSIENT_SPIKE');
    const p405 = patients.find((p) => p.patientId === 'P005');
    expect(p405).toBeDefined();
    expect(p405?.vitals.heartRate).toBe(106);
    expect(p405?.category).toBe('WATCH'); // Suppressed from CRITICAL
    expect(p405?.apsScore).toBeLessThanOrEqual(35);
  });

  it('3. Event 2: Sensor degradation in Bed 402 drops confidence without fabricating vitals', () => {
    const patients = demoScenarioController.setStep(2);
    const step = demoScenarioController.getCurrentStep();

    expect(step.stepId).toBe('STEP_2_SENSOR_UNRELIABLE');
    const p402 = patients.find((p) => p.patientId === 'P002');
    expect(p402).toBeDefined();
    expect(p402?.signalQuality.confidencePercent).toBeLessThan(30);
    expect(p402?.isStale).toBe(true);
    expect(p402?.whyNowSummary).toContain('rPPG confidence low');
  });

  it('4. Event 3: Bed 403 occult shock surges APS to 88 and elevates to Rank 1', () => {
    const patients = demoScenarioController.setStep(3);
    const step = demoScenarioController.getCurrentStep();

    expect(step.stepId).toBe('STEP_3_OCCULT_SHOCK');
    const p403 = patients.find((p) => p.patientId === 'P003');
    expect(p403).toBeDefined();
    expect(p403?.apsScore).toBe(88);
    expect(p403?.category).toBe('CRITICAL_REVIEW');
    expect(p403?.vitals.heartRate).toBe(114);
    expect(p403?.vitals.systolicBP).toBe(88);

    // Verify Bed 403 is highest score across ward
    const maxScore = Math.max(...patients.map((p) => p.apsScore));
    expect(maxScore).toBe(88);
  });

  it('5. Event 5: Bedside reassessment sets isAcknowledged and updates timeline', () => {
    const patients = demoScenarioController.setStep(5);
    const p403 = patients.find((p) => p.patientId === 'P003');

    expect(p403?.isAcknowledged).toBe(true);
    expect(p403?.lastAcknowledgedBy).toBe('RN Rachel Hayes');
    expect(p403?.lastTrustedElapsedMinutes).toBe(0);
    expect(p403?.timeline.length).toBeGreaterThan(0);
    expect(p403?.timeline[0].title).toContain('Rapid Response Team');
  });

  it('6. Event 6: Clinical recovery reduces APS down to 26 and normalizes vitals', () => {
    const patients = demoScenarioController.setStep(6);
    const p403 = patients.find((p) => p.patientId === 'P003');

    expect(p403?.apsScore).toBe(26);
    expect(p403?.category).toBe('WATCH');
    expect(p403?.vitals.heartRate).toBe(82);
    expect(p403?.vitals.systolicBP).toBe(114);
    expect(p403?.whyNowSummary).toContain('stabilization');
  });

  it('7. 1-Click Reset returns completely to Step 0 Baseline', () => {
    demoScenarioController.setStep(3); // Go to critical shock
    expect(demoScenarioController.getStepIndex()).toBe(3);

    const patients = demoScenarioController.reset();
    expect(demoScenarioController.getStepIndex()).toBe(0);
    expect(patients.every((p) => p.category === 'LOW')).toBe(true);
  });
});
