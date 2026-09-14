import { describe, it, expect } from 'vitest';
import {
  ExplainabilityEngine,
  explainPatient,
  explainWard,
} from '../src/explainability';
import type { PatientStateInput } from '../src/attentionPriority/types';
import type { Observation, LaboratoryResult, SignalQuality, VitalType, VitalUnit } from '@aegispulse/types';

describe('AegisPulse Explainability Engine', () => {
  const baseTime = 1773471600000;

  function makeObs(
    id: string,
    patientId: string,
    vitalType: VitalType,
    value: number,
    unit: VitalUnit,
    timestamp: number,
    qualityStatus: 'TRUSTED' | 'DEGRADED' | 'UNRELIABLE' = 'TRUSTED'
  ): Observation {
    return {
      id,
      patientId,
      bedId: 'BED-01',
      vitalType,
      value,
      unit,
      timestamp,
      source: 'SIMULATION',
      confidence: qualityStatus === 'TRUSTED' ? 0.95 : 0.40,
      qualityStatus,
    };
  }

  // ==========================================================================
  // Scenario 1: Heart Rate Velocity from Baseline over 30 Minutes
  // "Heart rate increased 21% from baseline over 30 minutes."
  // ==========================================================================
  it('generates exact explanation: "Heart rate increased 21% from baseline over 30 minutes."', () => {
    // Baseline HR is 70 bpm. 30 minutes later, HR is 85 bpm.
    // (85 - 70) / 70 = 21.4% -> 21%
    const thirtyMinAgo = baseTime - 30 * 60 * 1000;
    const observations: Observation[] = [
      makeObs('obs-hr-1', 'P-VEL', 'HEART_RATE', 70, 'BPM', thirtyMinAgo),
      makeObs('obs-hr-2', 'P-VEL', 'HEART_RATE', 85, 'BPM', baseTime),
      makeObs('obs-rr-1', 'P-VEL', 'RESPIRATORY_RATE', 16, 'BREATHS_PER_MINUTE', baseTime),
      makeObs('obs-bp-1', 'P-VEL', 'SYSTOLIC_BP', 120, 'MMHG', baseTime),
    ];

    const state: PatientStateInput = {
      patientId: 'P-VEL',
      bedNumber: 'BED-01',
      currentTimestamp: baseTime,
      observations,
      baseline: { heartRate: 70, respiratoryRate: 16, systolicBP: 120 },
      lastTrustedObservationTimestamp: baseTime,
    };

    const result = explainPatient(state);

    const hrReason = result.reasons.find((r) => r.category === 'PHYSIOLOGICAL_VELOCITY');
    expect(hrReason).toBeDefined();
    expect(hrReason?.humanReadableExplanation).toBe(
      'Heart rate increased 21% from baseline over 30 minutes.'
    );
    expect(hrReason?.evidence.changePercentage).toBe(21);
    expect(hrReason?.evidence.timeWindowMinutes).toBe(30);
    expect(hrReason?.provenance.sourceObservationIds).toContain('obs-hr-1');
    expect(hrReason?.provenance.sourceObservationIds).toContain('obs-hr-2');
  });

  // ==========================================================================
  // Scenario 2: Continuous Respiratory Rate Escalation over 18 Minutes
  // "Respiratory rate has increased continuously for 18 minutes."
  // ==========================================================================
  it('generates exact explanation: "Respiratory rate has increased continuously for 18 minutes."', () => {
    // RR rising continuously from 18 min ago (16 -> 19 -> 22 -> 25)
    const eighteenMinAgo = baseTime - 18 * 60 * 1000;
    const observations: Observation[] = [
      makeObs('obs-rr-1', 'P-RESP', 'RESPIRATORY_RATE', 16, 'BREATHS_PER_MINUTE', eighteenMinAgo),
      makeObs('obs-rr-2', 'P-RESP', 'RESPIRATORY_RATE', 19, 'BREATHS_PER_MINUTE', baseTime - 12 * 60 * 1000),
      makeObs('obs-rr-3', 'P-RESP', 'RESPIRATORY_RATE', 22, 'BREATHS_PER_MINUTE', baseTime - 6 * 60 * 1000),
      makeObs('obs-rr-4', 'P-RESP', 'RESPIRATORY_RATE', 25, 'BREATHS_PER_MINUTE', baseTime),
      makeObs('obs-hr-1', 'P-RESP', 'HEART_RATE', 72, 'BPM', baseTime),
    ];

    const state: PatientStateInput = {
      patientId: 'P-RESP',
      bedNumber: 'BED-02',
      currentTimestamp: baseTime,
      observations,
      baseline: { respiratoryRate: 16, heartRate: 72 },
      lastTrustedObservationTimestamp: baseTime,
    };

    const result = explainPatient(state);

    const rrReason = result.reasons.find((r) => r.category === 'SUSTAINED_ABNORMALITY');
    expect(rrReason).toBeDefined();
    expect(rrReason?.humanReadableExplanation).toBe(
      'Respiratory rate has increased continuously for 18 minutes.'
    );
    expect(rrReason?.evidence.timeWindowMinutes).toBe(18);
  });

  // ==========================================================================
  // Scenario 3: Information Decay Timeout
  // "No trusted observation has been recorded for 3h 41m."
  // ==========================================================================
  it('generates exact explanation: "No trusted observation has been recorded for 3h 41m."', () => {
    // 3 hours and 41 minutes = 221 minutes
    const elapsedMinutes = 3 * 60 + 41; // 221 min
    const lastCheck = baseTime - elapsedMinutes * 60 * 1000;

    const observations: Observation[] = [
      makeObs('obs-hr-old', 'P-STALE', 'HEART_RATE', 72, 'BPM', lastCheck, 'TRUSTED'),
      makeObs('obs-rr-old', 'P-STALE', 'RESPIRATORY_RATE', 16, 'BREATHS_PER_MINUTE', lastCheck, 'TRUSTED'),
    ];

    const state: PatientStateInput = {
      patientId: 'P-STALE',
      bedNumber: 'BED-03',
      currentTimestamp: baseTime,
      observations,
      lastTrustedObservationTimestamp: lastCheck,
    };

    const result = explainPatient(state);

    const decayReason = result.reasons.find((r) => r.category === 'INFORMATION_DECAY');
    expect(decayReason).toBeDefined();
    expect(decayReason?.humanReadableExplanation).toBe(
      'No trusted observation has been recorded for 3h 41m.'
    );
    expect(decayReason?.evidence.timeWindowMinutes).toBe(221);
  });

  // ==========================================================================
  // Scenario 4: Signal Confidence Degradation
  // "Current signal confidence is only 38%; physiological readings are therefore suppressed."
  // ==========================================================================
  it('generates exact explanation: "Current signal confidence is only 38%; physiological readings are therefore suppressed."', () => {
    const observations: Observation[] = [
      makeObs('obs-hr-1', 'P-SIGNAL', 'HEART_RATE', 125, 'BPM', baseTime, 'UNRELIABLE'),
      makeObs('obs-rr-1', 'P-SIGNAL', 'RESPIRATORY_RATE', 24, 'BREATHS_PER_MINUTE', baseTime, 'UNRELIABLE'),
    ];

    const signalQuality: SignalQuality = {
      sqiPercentage: 38,
      snrDb: 6,
      illuminationLux: 60,
      motionArtifactIndex: 0.82,
      state: 'UNRELIABLE',
      isUsable: false,
      faceDetected: false,
    };

    const state: PatientStateInput = {
      patientId: 'P-SIGNAL',
      bedNumber: 'BED-04',
      currentTimestamp: baseTime,
      observations,
      latestSignalQuality: signalQuality,
    };

    const result = explainPatient(state);

    const sigReason = result.reasons.find((r) => r.category === 'SIGNAL_CONFIDENCE');
    expect(sigReason).toBeDefined();
    expect(sigReason?.humanReadableExplanation).toBe(
      'Current signal confidence is only 38%; physiological readings are therefore suppressed.'
    );
    expect(sigReason?.evidence.currentValue).toBe(38);
  });

  // ==========================================================================
  // Scenario 5: Completely Stable Patient
  // ==========================================================================
  it('explains stability for a normal patient without alarm fatigue', () => {
    const observations: Observation[] = [
      makeObs('obs-1', 'P-STABLE', 'HEART_RATE', 72, 'BPM', baseTime),
      makeObs('obs-2', 'P-STABLE', 'RESPIRATORY_RATE', 15, 'BREATHS_PER_MINUTE', baseTime),
      makeObs('obs-3', 'P-STABLE', 'SYSTOLIC_BP', 120, 'MMHG', baseTime),
      makeObs('obs-4', 'P-STABLE', 'OXYGEN_SATURATION', 98, 'PERCENT', baseTime),
    ];

    const state: PatientStateInput = {
      patientId: 'P-STABLE',
      bedNumber: 'BED-05',
      currentTimestamp: baseTime,
      observations,
      baseline: { heartRate: 72, respiratoryRate: 15, systolicBP: 120 },
      lastTrustedObservationTimestamp: baseTime,
    };

    const result = explainPatient(state);

    expect(result.primaryExplanation).toContain('stable');
    expect(result.reasons[0].category).toBe('PHYSIOLOGICAL_STABILITY');
  });

  // ==========================================================================
  // Scenario 6: Curated Ranking (Top 3 to 5 Selection from 10+ Candidates)
  // ==========================================================================
  it('curates strictly 3 to 5 reasons even when acute patient has 8+ candidate triggers', () => {
    // Acute multisystem sepsis patient with many simultaneous triggers
    const thirtyMinAgo = baseTime - 30 * 60 * 1000;
    const observations: Observation[] = [
      makeObs('o1', 'P-MULTI', 'HEART_RATE', 75, 'BPM', thirtyMinAgo),
      makeObs('o2', 'P-MULTI', 'HEART_RATE', 125, 'BPM', baseTime),
      makeObs('o3', 'P-MULTI', 'RESPIRATORY_RATE', 16, 'BREATHS_PER_MINUTE', thirtyMinAgo),
      makeObs('o4', 'P-MULTI', 'RESPIRATORY_RATE', 28, 'BREATHS_PER_MINUTE', baseTime),
      makeObs('o5', 'P-MULTI', 'SYSTOLIC_BP', 88, 'MMHG', baseTime), // Shock Index 1.42
    ];

    const labs: LaboratoryResult[] = [
      {
        id: 'lab-1',
        patientId: 'P-MULTI',
        timestamp: baseTime,
        testCode: 'LACTATE',
        testName: 'Venous Lactate',
        value: 4.2,
        unit: 'MMOL_PER_L',
        referenceRange: { low: 0.5, high: 2.0 },
        isCritical: true,
        sourceLab: 'ICU Lab',
      },
      {
        id: 'lab-2',
        patientId: 'P-MULTI',
        timestamp: baseTime,
        testCode: 'WBC',
        testName: 'WBC',
        value: 21.0,
        unit: 'X10_9_PER_L',
        referenceRange: { low: 4.0, high: 11.0 },
        isCritical: true,
        sourceLab: 'ICU Lab',
      },
    ];

    const state: PatientStateInput = {
      patientId: 'P-MULTI',
      bedNumber: 'BED-06',
      currentTimestamp: baseTime,
      observations,
      labs,
      baseline: { heartRate: 75, respiratoryRate: 16, systolicBP: 120 },
      lastTrustedObservationTimestamp: baseTime - 120 * 60000,
    };

    const engine = new ExplainabilityEngine({ maxReasons: 4 });
    const result = engine.explainPatient(state);

    expect(result.allCandidateReasonsCount).toBeGreaterThanOrEqual(5);
    expect(result.reasons.length).toBeLessThanOrEqual(4);
    expect(result.reasons.length).toBeGreaterThanOrEqual(3);

    // Verify 1-indexed priority ranking
    result.reasons.forEach((r, idx) => {
      expect(r.priorityRank).toBe(idx + 1);
    });

    // Check category diversity: multiple distinct categories should be represented
    const categories = new Set(result.reasons.map((r) => r.category));
    expect(categories.size).toBeGreaterThanOrEqual(3);
  });

  // ==========================================================================
  // Scenario 7: Ward-Wide Explainability Helper
  // ==========================================================================
  it('generates multi-patient ward explanations correctly', () => {
    const p1: PatientStateInput = {
      patientId: 'P-1',
      bedNumber: 'BED-1',
      currentTimestamp: baseTime,
      observations: [makeObs('o1', 'P-1', 'HEART_RATE', 72, 'BPM', baseTime)],
    };
    const p2: PatientStateInput = {
      patientId: 'P-2',
      bedNumber: 'BED-2',
      currentTimestamp: baseTime,
      observations: [makeObs('o2', 'P-2', 'HEART_RATE', 115, 'BPM', baseTime)],
    };

    const wardResults = explainWard([p1, p2]);
    expect(wardResults['P-1']).toBeDefined();
    expect(wardResults['P-2']).toBeDefined();
    expect(wardResults['P-1'].patientId).toBe('P-1');
    expect(wardResults['P-2'].patientId).toBe('P-2');
  });
});
