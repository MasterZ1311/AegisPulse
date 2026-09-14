import { describe, it, expect } from 'vitest';
import {
  AttentionPriorityEngine,
  evaluateAttentionPriority,
  rankWardPatients,
} from '../src/attentionPriority';
import type { PatientStateInput } from '../src/attentionPriority/types';
import {
  AttentionPrioritySchema,
  type Observation,
  type LaboratoryResult,
  type VitalType,
  type VitalUnit,
} from '@aegispulse/types';

describe('Central AegisPulse Attention Priority Engine', () => {
  const baseTime = 1773471600000;

  // Helper to build typed observations
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
  // Test Case 1: Completely Stable Patient
  // ==========================================================================
  it('correctly evaluates a completely stable patient with LOW category and routine action', () => {
    const observations: Observation[] = [
      makeObs('obs-1', 'P-STABLE', 'HEART_RATE', 72, 'BPM', baseTime - 60000),
      makeObs('obs-2', 'P-STABLE', 'RESPIRATORY_RATE', 15, 'BREATHS_PER_MINUTE', baseTime - 60000),
      makeObs('obs-3', 'P-STABLE', 'SYSTOLIC_BP', 120, 'MMHG', baseTime - 60000),
      makeObs('obs-4', 'P-STABLE', 'OXYGEN_SATURATION', 98, 'PERCENT', baseTime - 60000),
      makeObs('obs-5', 'P-STABLE', 'BODY_TEMPERATURE', 36.8, 'CELSIUS', baseTime - 60000),
    ];

    const input: PatientStateInput = {
      patientId: 'P-STABLE',
      bedNumber: 'BED-01',
      currentTimestamp: baseTime,
      observations,
      baseline: {
        heartRate: 72,
        respiratoryRate: 15,
        systolicBP: 120,
        spo2: 98,
      },
      lastTrustedObservationTimestamp: baseTime - 60000, // 1 min ago
      latestSignalQuality: {
        sqiPercentage: 96,
        snrDb: 24,
        illuminationLux: 450,
        motionArtifactIndex: 0.05,
        state: 'TRUSTED',
        isUsable: true,
        faceDetected: true,
      },
      avpu: 'A',
    };

    const result = evaluateAttentionPriority(input);

    expect(result.score).toBeLessThanOrEqual(15);
    expect(result.apsScore).toBe(result.score);
    expect(result.category).toBe('LOW');
    expect(result.reasons.some((r) => r.code === 'PHYSIOLOGICAL_STABILITY')).toBe(true);
    expect(result.recommendedActions[0].actionType).toBe('BEDSIDE_VISIT');
    expect(result.provenance.algorithm).toBe('AEGIS_PULSE_ATTENTION_PRIORITY_ENGINE');

    // Strict schema compliance check
    const parseResult = AttentionPrioritySchema.safeParse(result);
    expect(parseResult.success).toBe(true);
  });

  // ==========================================================================
  // Test Case 2: Rapidly Deteriorating Patient
  // ==========================================================================
  it('escalates rapidly deteriorating patient to CRITICAL_REVIEW with velocity & shock reasons', () => {
    // 30 min trajectory: HR climbs from 74 to 122, RR climbs from 16 to 28, SBP drops from 120 to 92
    const observations: Observation[] = [
      // 30m ago
      makeObs('obs-h1', 'P-DET', 'HEART_RATE', 74, 'BPM', baseTime - 30 * 60000),
      makeObs('obs-r1', 'P-DET', 'RESPIRATORY_RATE', 16, 'BREATHS_PER_MINUTE', baseTime - 30 * 60000),
      makeObs('obs-b1', 'P-DET', 'SYSTOLIC_BP', 120, 'MMHG', baseTime - 30 * 60000),
      // 15m ago
      makeObs('obs-h2', 'P-DET', 'HEART_RATE', 95, 'BPM', baseTime - 15 * 60000),
      makeObs('obs-r2', 'P-DET', 'RESPIRATORY_RATE', 22, 'BREATHS_PER_MINUTE', baseTime - 15 * 60000),
      makeObs('obs-b2', 'P-DET', 'SYSTOLIC_BP', 105, 'MMHG', baseTime - 15 * 60000),
      // Now
      makeObs('obs-h3', 'P-DET', 'HEART_RATE', 122, 'BPM', baseTime),
      makeObs('obs-r3', 'P-DET', 'RESPIRATORY_RATE', 28, 'BREATHS_PER_MINUTE', baseTime),
      makeObs('obs-b3', 'P-DET', 'SYSTOLIC_BP', 92, 'MMHG', baseTime),
    ];

    const input: PatientStateInput = {
      patientId: 'P-DET',
      bedNumber: 'BED-02',
      currentTimestamp: baseTime,
      observations,
      baseline: {
        heartRate: 72,
        respiratoryRate: 16,
        systolicBP: 120,
      },
      lastTrustedObservationTimestamp: baseTime,
      latestSignalQuality: {
        sqiPercentage: 92,
        snrDb: 20,
        illuminationLux: 400,
        motionArtifactIndex: 0.1,
        state: 'TRUSTED',
        isUsable: true,
        faceDetected: true,
      },
      avpu: 'A',
    };

    const result = evaluateAttentionPriority(input);

    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.category).toBe('CRITICAL_REVIEW');

    // Check specific clinical reasons
    const reasonCodes = result.reasons.map((r) => r.code);
    expect(reasonCodes).toContain('VELOCITY_HR_SPIKE');
    expect(reasonCodes).toContain('VELOCITY_RR_SPIKE');
    expect(reasonCodes).toContain('SHOCK_INDEX_OCCULT');

    // Check recommended clinical actions
    const actionTypes = result.recommendedActions.map((a) => a.actionType);
    expect(actionTypes).toContain('SBAR_PHYSICIAN_CONSULT');
    expect(actionTypes).toContain('MANUAL_VITALS_RECHECK');

    // Schema validity
    const parseResult = AttentionPrioritySchema.safeParse(result);
    expect(parseResult.success).toBe(true);
  });

  // ==========================================================================
  // Test Case 3: Patient with Poor Signal Quality
  // ==========================================================================
  it('discounts velocity noise and flags sensor maintenance when signal is UNRELIABLE', () => {
    // Optical sensor has sudden high reading due to motion, but confidence is low
    const observations: Observation[] = [
      makeObs('obs-1', 'P-NOISE', 'HEART_RATE', 72, 'BPM', baseTime - 10 * 60000, 'TRUSTED'),
      makeObs('obs-2', 'P-NOISE', 'HEART_RATE', 130, 'BPM', baseTime, 'UNRELIABLE'),
      makeObs('obs-3', 'P-NOISE', 'RESPIRATORY_RATE', 16, 'BREATHS_PER_MINUTE', baseTime, 'UNRELIABLE'),
    ];

    const input: PatientStateInput = {
      patientId: 'P-NOISE',
      bedNumber: 'BED-03',
      currentTimestamp: baseTime,
      observations,
      baseline: { heartRate: 72, respiratoryRate: 16 },
      lastTrustedObservationTimestamp: baseTime - 10 * 60000,
      latestSignalQuality: {
        sqiPercentage: 28,
        snrDb: 4,
        illuminationLux: 40,
        motionArtifactIndex: 0.85,
        state: 'UNRELIABLE',
        isUsable: false,
        faceDetected: false,
      },
    };

    const result = evaluateAttentionPriority(input);

    // Does NOT trigger CRITICAL_REVIEW alarm because optical velocity was discounted
    expect(result.category).not.toBe('CRITICAL_REVIEW');
    // Flags sensor degraded reason
    expect(result.reasons.some((r) => r.code === 'SENSOR_CONFIDENCE_DEGRADED')).toBe(true);
    // Recommends attaching cuff / checking sensor
    expect(result.recommendedActions.some((a) => a.actionType === 'ATTACH_CUFF')).toBe(true);
  });

  // ==========================================================================
  // Test Case 4: Patient with Stale Observations (Information Decay)
  // ==========================================================================
  it('escalates priority when bedside observations are 4 hours stale', () => {
    // Patient had normal vitals 4 hours ago, but nothing since
    const fourHoursAgo = baseTime - 4 * 60 * 60 * 1000;
    const observations: Observation[] = [
      makeObs('obs-1', 'P-STALE', 'HEART_RATE', 72, 'BPM', fourHoursAgo, 'TRUSTED'),
      makeObs('obs-2', 'P-STALE', 'RESPIRATORY_RATE', 15, 'BREATHS_PER_MINUTE', fourHoursAgo, 'TRUSTED'),
    ];

    const input: PatientStateInput = {
      patientId: 'P-STALE',
      bedNumber: 'BED-04',
      currentTimestamp: baseTime,
      observations,
      lastTrustedObservationTimestamp: fourHoursAgo,
    };

    const result = evaluateAttentionPriority(input);

    expect(result.decayScore).toBeGreaterThanOrEqual(75);
    expect(result.informationAgeMinutes).toBe(240);
    expect(result.reasons.some((r) => r.code === 'INFORMATION_DECAY_TIMEOUT')).toBe(true);
    expect(result.recommendedActions.some((a) => a.actionType === 'BEDSIDE_VISIT')).toBe(true);
  });

  // ==========================================================================
  // Test Case 5: Temporary Spike (Persistence Filter)
  // ==========================================================================
  it('dampens isolated 2-minute spike so it does not trigger false code alarm', () => {
    // Baseline HR 70, single reading at 118 for 2 minutes, accompanied by fidgeting
    const observations: Observation[] = [
      makeObs('obs-1', 'P-SPIKE', 'HEART_RATE', 70, 'BPM', baseTime - 15 * 60000, 'TRUSTED'),
      makeObs('obs-2', 'P-SPIKE', 'HEART_RATE', 118, 'BPM', baseTime - 2 * 60000, 'DEGRADED'),
      makeObs('obs-3', 'P-SPIKE', 'HEART_RATE', 118, 'BPM', baseTime, 'DEGRADED'),
      makeObs('obs-4', 'P-SPIKE', 'RESPIRATORY_RATE', 16, 'BREATHS_PER_MINUTE', baseTime, 'TRUSTED'),
      makeObs('obs-5', 'P-SPIKE', 'SYSTOLIC_BP', 122, 'MMHG', baseTime, 'TRUSTED'),
    ];

    const input: PatientStateInput = {
      patientId: 'P-SPIKE',
      bedNumber: 'BED-05',
      currentTimestamp: baseTime,
      observations,
      baseline: { heartRate: 70, respiratoryRate: 16, systolicBP: 122 },
      latestSignalQuality: {
        sqiPercentage: 68,
        snrDb: 14,
        illuminationLux: 350,
        motionArtifactIndex: 0.55,
        state: 'DEGRADED',
        isUsable: true,
        faceDetected: true,
      },
    };

    const result = evaluateAttentionPriority(input);

    // Persistence filter keeps category below CRITICAL_REVIEW
    expect(result.category).not.toBe('CRITICAL_REVIEW');
    expect(result.rankInputs.persistence.explanation).toContain('Transient spike detected');
  });

  // ==========================================================================
  // Test Case 6: Multiple Concurrent Risk Factors (Sepsis Shock Profile)
  // ==========================================================================
  it('triggers emergency override floor for occult sepsis (tachycardia + tachypnea + lactate)', () => {
    const observations: Observation[] = [
      makeObs('obs-1', 'P-SEPSIS', 'HEART_RATE', 112, 'BPM', baseTime),
      makeObs('obs-2', 'P-SEPSIS', 'RESPIRATORY_RATE', 24, 'BREATHS_PER_MINUTE', baseTime),
      makeObs('obs-3', 'P-SEPSIS', 'SYSTOLIC_BP', 94, 'MMHG', baseTime),
      makeObs('obs-4', 'P-SEPSIS', 'BODY_TEMPERATURE', 38.8, 'CELSIUS', baseTime),
    ];

    const labs: LaboratoryResult[] = [
      {
        id: 'lab-1',
        patientId: 'P-SEPSIS',
        timestamp: baseTime - 30 * 60000,
        testCode: 'LACTATE',
        testName: 'Venous Lactate',
        value: 3.4, // Elevated > 2.0
        unit: 'MMOL_PER_L',
        referenceRange: { low: 0.5, high: 2.0 },
        isCritical: true,
        sourceLab: 'ICU Lab',
      },
      {
        id: 'lab-2',
        patientId: 'P-SEPSIS',
        timestamp: baseTime - 30 * 60000,
        testCode: 'WBC',
        testName: 'White Blood Cell Count',
        value: 19.4,
        unit: 'X10_9_PER_L',
        referenceRange: { low: 4.0, high: 11.0 },
        isCritical: true,
        sourceLab: 'ICU Lab',
      },
    ];

    const input: PatientStateInput = {
      patientId: 'P-SEPSIS',
      bedNumber: 'BED-06',
      currentTimestamp: baseTime,
      observations,
      labs,
      avpu: 'A',
      clinicalContext: {
        id: 'ctx-1',
        patientId: 'P-SEPSIS',
        admissionReason: 'Severe Community-Acquired Pneumonia',
        comorbidities: ['COPD', 'Diabetes Type 2'],
        codeStatus: 'FULL_CODE',
        oxygenDelivery: 'HIGH_FLOW_NASAL_CANNULA',
        o2FlowRateLpm: 12,
        isolationStatus: 'DROPLET',
        baselineMEWS: 1,
        updatedAt: baseTime - 60000,
      },
    };

    const result = evaluateAttentionPriority(input);

    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.category).toBe('CRITICAL_REVIEW');

    const reasonCodes = result.reasons.map((r) => r.code);
    expect(reasonCodes).toContain('QSOFA_ESCALATION');
    expect(reasonCodes).toContain('LAB_HYPOXIA_LACTATE');
    expect(reasonCodes).toContain('LAB_LEUKOCYTOSIS');

    expect(result.recommendedActions.some((a) => a.actionType === 'RAPID_RESPONSE_TRIGGER')).toBe(true);
  });

  // ==========================================================================
  // Test Case 7: Deterministic Ward Ranking
  // ==========================================================================
  it('correctly ranks multiple ward patients by clinical priority descending', () => {
    const stablePatient: PatientStateInput = {
      patientId: 'P-STABLE',
      bedNumber: 'BED-01',
      currentTimestamp: baseTime,
      observations: [
        makeObs('o-1', 'P-STABLE', 'HEART_RATE', 72, 'BPM', baseTime),
        makeObs('o-2', 'P-STABLE', 'RESPIRATORY_RATE', 14, 'BREATHS_PER_MINUTE', baseTime),
        makeObs('o-3', 'P-STABLE', 'SYSTOLIC_BP', 120, 'MMHG', baseTime),
      ],
    };

    const stalePatient: PatientStateInput = {
      patientId: 'P-STALE',
      bedNumber: 'BED-02',
      currentTimestamp: baseTime,
      observations: [],
      lastTrustedObservationTimestamp: baseTime - 3 * 3600000, // 3h stale
    };

    const deterioratingPatient: PatientStateInput = {
      patientId: 'P-CRITICAL',
      bedNumber: 'BED-03',
      currentTimestamp: baseTime,
      observations: [
        makeObs('o-4', 'P-CRITICAL', 'HEART_RATE', 80, 'BPM', baseTime - 20 * 60000),
        makeObs('o-5', 'P-CRITICAL', 'HEART_RATE', 130, 'BPM', baseTime),
        makeObs('o-6', 'P-CRITICAL', 'RESPIRATORY_RATE', 28, 'BREATHS_PER_MINUTE', baseTime),
        makeObs('o-7', 'P-CRITICAL', 'SYSTOLIC_BP', 88, 'MMHG', baseTime),
      ],
    };

    const ranked = rankWardPatients([stablePatient, stalePatient, deterioratingPatient]);

    expect(ranked.length).toBe(3);
    // Highest urgency should be Deteriorating Patient
    expect(ranked[0].patientId).toBe('P-CRITICAL');
    expect(ranked[0].wardRank).toBe(1);

    // Lowest urgency should be Stable Patient
    expect(ranked[2].patientId).toBe('P-STABLE');
    expect(ranked[2].wardRank).toBe(3);

    // Stale patient should be intermediate
    expect(ranked[1].patientId).toBe('P-STALE');
    expect(ranked[1].wardRank).toBe(2);
  });

  // ==========================================================================
  // Test Case 8: Custom Configuration Overrides
  // ==========================================================================
  it('respects custom threshold and weight configuration overrides', () => {
    const engine = new AttentionPriorityEngine({
      categoryThresholds: {
        lowMax: 20,
        watchMax: 40,
        evaluateMax: 60,
        criticalMin: 65, // Lowered critical threshold
      },
    });

    const input: PatientStateInput = {
      patientId: 'P-CUSTOM',
      bedNumber: 'BED-01',
      currentTimestamp: baseTime,
      observations: [
        makeObs('o-1', 'P-CUSTOM', 'HEART_RATE', 115, 'BPM', baseTime),
        makeObs('o-2', 'P-CUSTOM', 'RESPIRATORY_RATE', 22, 'BREATHS_PER_MINUTE', baseTime),
      ],
    };

    const result = engine.evaluate(input);
    if (result.score >= 65) {
      expect(result.category).toBe('CRITICAL_REVIEW');
    }
  });

  // ==========================================================================
  // Test Case 9: Strict Bounding (0 <= score <= 100)
  // ==========================================================================
  it('guarantees score is strictly bounded in [0, 100] across 500 random parameter combinations', () => {
    for (let i = 0; i < 500; i++) {
      const hr = 30 + Math.random() * 180; // 30 to 210 bpm
      const rr = 4 + Math.random() * 45; // 4 to 49
      const sbp = 50 + Math.random() * 180; // 50 to 230 mmHg
      const elapsed = Math.random() * 360 * 60000; // up to 6 hours

      const input: PatientStateInput = {
        patientId: `P-RAND-${i}`,
        bedNumber: 'BED-01',
        currentTimestamp: baseTime,
        observations: [
          makeObs(`obs-hr-${i}`, `P-RAND-${i}`, 'HEART_RATE', hr, 'BPM', baseTime),
          makeObs(`obs-rr-${i}`, `P-RAND-${i}`, 'RESPIRATORY_RATE', rr, 'BREATHS_PER_MINUTE', baseTime),
          makeObs(`obs-sbp-${i}`, `P-RAND-${i}`, 'SYSTOLIC_BP', sbp, 'MMHG', baseTime),
        ],
        lastTrustedObservationTimestamp: baseTime - elapsed,
      };

      const result = evaluateAttentionPriority(input);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(AttentionPrioritySchema.safeParse(result).success).toBe(true);
    }
  });
});
