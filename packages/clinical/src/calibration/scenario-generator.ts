/**
 * @aegispulse/clinical - APS Calibration Scenario Generator
 * Generates synthetic clinical patient scenarios with ground-truth severity ordering.
 *
 * Scenarios:
 * - Patient A: Stable / Normal physiology
 * - Patient B: Isolated transient spike (cough/movement, dampened by persistence filter)
 * - Patient C: Sustained deterioration (active acute multisystem collapse)
 * - Patient D: Poor signal / unknown state (degraded camera telemetry, high uncertainty)
 * - Patient E: Abnormal labs but stable trend (metabolic stress, normal vitals)
 * - Patient F: Rising HR/RR + stale observation (accelerating vitals + 4h epistemic blindspot)
 */

import type { Observation, SensorReading, LaboratoryResult } from '@aegispulse/types';
import type { PatientStateInput } from '../attentionPriority/types';

export interface CalibrationScenarioMetadata {
  id: string;
  name: string;
  archetype: 'STABLE' | 'TRANSIENT_SPIKE' | 'SUSTAINED_DETERIORATION' | 'POOR_SIGNAL' | 'ABNORMAL_LABS' | 'RISING_AND_STALE';
  expectedRankMin: number; // 1-based (1 is highest priority)
  expectedRankMax: number;
  expectedCategory: 'LOW' | 'WATCH' | 'EVALUATE' | 'CRITICAL_REVIEW';
  clinicalRationale: string;
  primaryDrivingFactor: string;
}

export interface CalibrationScenario {
  metadata: CalibrationScenarioMetadata;
  patientState: PatientStateInput;
}

/**
 * Generates the canonical benchmark cohort of 6 clinical archetypes (Patients A through F)
 */
export function generateBenchmarkScenarios(baseTimestamp?: number): CalibrationScenario[] {
  const now = baseTimestamp ?? 1700000000000; // Fixed integer epoch timestamp

  // ==========================================================================
  // PATIENT A: STABLE
  // Normal resting vitals, fresh verified observation (< 5m), normal labs, trusted signal
  // Expected Rank: 6 (Lowest attention contribution)
  // Expected Category: LOW
  // ==========================================================================
  const patientAObs: Observation[] = [
    {
      id: 'obs-a-hr',
      patientId: 'PT-A',
      bedId: 'BED-01',
      timestamp: now - 3 * 60 * 1000,
      vitalType: 'HEART_RATE',
      value: 72,
      unit: 'BPM',
      confidence: 1.0,
      qualityStatus: 'TRUSTED',
      source: 'NURSE_MANUAL',
    },
    {
      id: 'obs-a-rr',
      patientId: 'PT-A',
      bedId: 'BED-01',
      timestamp: now - 3 * 60 * 1000,
      vitalType: 'RESPIRATORY_RATE',
      value: 14,
      unit: 'BREATHS_PER_MINUTE',
      confidence: 1.0,
      qualityStatus: 'TRUSTED',
      source: 'NURSE_MANUAL',
    },
    {
      id: 'obs-a-sbp',
      patientId: 'PT-A',
      bedId: 'BED-01',
      timestamp: now - 3 * 60 * 1000,
      vitalType: 'SYSTOLIC_BP',
      value: 120,
      unit: 'MMHG',
      confidence: 1.0,
      qualityStatus: 'TRUSTED',
      source: 'NURSE_MANUAL',
    },
    {
      id: 'obs-a-dbp',
      patientId: 'PT-A',
      bedId: 'BED-01',
      timestamp: now - 3 * 60 * 1000,
      vitalType: 'DIASTOLIC_BP',
      value: 78,
      unit: 'MMHG',
      confidence: 1.0,
      qualityStatus: 'TRUSTED',
      source: 'NURSE_MANUAL',
    },
    {
      id: 'obs-a-spo2',
      patientId: 'PT-A',
      bedId: 'BED-01',
      timestamp: now - 3 * 60 * 1000,
      vitalType: 'OXYGEN_SATURATION',
      value: 98,
      unit: 'PERCENT',
      confidence: 1.0,
      qualityStatus: 'TRUSTED',
      source: 'NURSE_MANUAL',
    },
  ];

  const scenarioA: CalibrationScenario = {
    metadata: {
      id: 'PT-A',
      name: 'Patient A (Stable Baseline)',
      archetype: 'STABLE',
      expectedRankMin: 6,
      expectedRankMax: 6,
      expectedCategory: 'LOW',
      clinicalRationale: 'All monitored vitals within physiological norms; telemetry is fresh and fully trusted.',
      primaryDrivingFactor: 'BASELINE_STABILITY',
    },
    patientState: {
      patientId: 'PT-A',
      bedNumber: '101',
      currentTimestamp: now,
      observations: patientAObs,
      baseline: {
        heartRate: 72,
        systolicBP: 120,
        respiratoryRate: 14,
        spo2: 98,
      },
      latestSignalQuality: {
        sqiPercentage: 95,
        snrDb: 18,
        illuminationLux: 350,
        motionArtifactIndex: 0.05,
        state: 'TRUSTED',
        isUsable: true,
        faceDetected: true,
      },
    },
  };

  // ==========================================================================
  // PATIENT B: ISOLATED TRANSIENT SPIKE
  // Baseline vitals normal, but brief cough/motion artifact spike to HR 118 for < 1 min,
  // returning immediately to baseline. Persistence filter dampens transient artifact.
  // Expected Rank: 5
  // Expected Category: LOW
  // ==========================================================================
  const patientBObs: Observation[] = [
    {
      id: 'obs-b-hr-t1',
      patientId: 'PT-B',
      bedId: 'BED-02',
      timestamp: now - 15 * 60 * 1000,
      vitalType: 'HEART_RATE',
      value: 72,
      unit: 'BPM',
      confidence: 1.0,
      qualityStatus: 'TRUSTED',
      source: 'NURSE_MANUAL',
    },
    {
      id: 'obs-b-hr-t2',
      patientId: 'PT-B',
      bedId: 'BED-02',
      timestamp: now - 50 * 1000, // Spike occurred 50 seconds ago
      vitalType: 'HEART_RATE',
      value: 118,
      unit: 'BPM',
      confidence: 0.65,
      qualityStatus: 'DEGRADED',
      source: 'OPTICAL_RPPG',
    },
    {
      id: 'obs-b-hr-t3',
      patientId: 'PT-B',
      bedId: 'BED-02',
      timestamp: now, // Returned to baseline
      vitalType: 'HEART_RATE',
      value: 74,
      unit: 'BPM',
      confidence: 1.0,
      qualityStatus: 'TRUSTED',
      source: 'OPTICAL_RPPG',
    },
    {
      id: 'obs-b-rr',
      patientId: 'PT-B',
      bedId: 'BED-02',
      timestamp: now,
      vitalType: 'RESPIRATORY_RATE',
      value: 15,
      unit: 'BREATHS_PER_MINUTE',
      confidence: 1.0,
      qualityStatus: 'TRUSTED',
      source: 'NURSE_MANUAL',
    },
    {
      id: 'obs-b-sbp',
      patientId: 'PT-B',
      bedId: 'BED-02',
      timestamp: now,
      vitalType: 'SYSTOLIC_BP',
      value: 122,
      unit: 'MMHG',
      confidence: 1.0,
      qualityStatus: 'TRUSTED',
      source: 'NURSE_MANUAL',
    },
  ];

  const scenarioB: CalibrationScenario = {
    metadata: {
      id: 'PT-B',
      name: 'Patient B (Isolated Transient Spike)',
      archetype: 'TRANSIENT_SPIKE',
      expectedRankMin: 5,
      expectedRankMax: 5,
      expectedCategory: 'LOW',
      clinicalRationale: 'Isolated 45-second tachycardia spike damped by transient filter; current vitals normal.',
      primaryDrivingFactor: 'TRANSIENT_ARTIFACT_SUPPRESSED',
    },
    patientState: {
      patientId: 'PT-B',
      bedNumber: '102',
      currentTimestamp: now,
      observations: patientBObs,
      baseline: {
        heartRate: 72,
        systolicBP: 122,
        respiratoryRate: 15,
      },
      latestSignalQuality: {
        sqiPercentage: 70,
        snrDb: 10,
        illuminationLux: 300,
        motionArtifactIndex: 0.60,
        state: 'DEGRADED',
        isUsable: true,
        faceDetected: true,
      },
    },
  };

  // ==========================================================================
  // PATIENT C: SUSTAINED DETERIORATION
  // Sustained tachycardia (HR 125), tachypnea (RR 26), hypotension (SBP 95), MEWS >= 5.
  // Active, life-threatening multisystem decompensation confirmed over > 10 minutes.
  // Expected Rank: 1 or 2 (Top Tier)
  // Expected Category: CRITICAL_REVIEW
  // ==========================================================================
  const patientCObs: Observation[] = [
    {
      id: 'obs-c-hr-t1',
      patientId: 'PT-C',
      bedId: 'BED-03',
      timestamp: now - 15 * 60 * 1000,
      vitalType: 'HEART_RATE',
      value: 120,
      unit: 'BPM',
      confidence: 1.0,
      qualityStatus: 'TRUSTED',
      source: 'BEDSIDE_DEVICE',
    },
    {
      id: 'obs-c-hr-t2',
      patientId: 'PT-C',
      bedId: 'BED-03',
      timestamp: now - 5 * 60 * 1000,
      vitalType: 'HEART_RATE',
      value: 124,
      unit: 'BPM',
      confidence: 1.0,
      qualityStatus: 'TRUSTED',
      source: 'BEDSIDE_DEVICE',
    },
    {
      id: 'obs-c-hr-t3',
      patientId: 'PT-C',
      bedId: 'BED-03',
      timestamp: now,
      vitalType: 'HEART_RATE',
      value: 126,
      unit: 'BPM',
      confidence: 1.0,
      qualityStatus: 'TRUSTED',
      source: 'BEDSIDE_DEVICE',
    },
    {
      id: 'obs-c-rr',
      patientId: 'PT-C',
      bedId: 'BED-03',
      timestamp: now,
      vitalType: 'RESPIRATORY_RATE',
      value: 26,
      unit: 'BREATHS_PER_MINUTE',
      confidence: 1.0,
      qualityStatus: 'TRUSTED',
      source: 'BEDSIDE_DEVICE',
    },
    {
      id: 'obs-c-sbp',
      patientId: 'PT-C',
      bedId: 'BED-03',
      timestamp: now,
      vitalType: 'SYSTOLIC_BP',
      value: 92,
      unit: 'MMHG',
      confidence: 1.0,
      qualityStatus: 'TRUSTED',
      source: 'BEDSIDE_DEVICE',
    },
    {
      id: 'obs-c-spo2',
      patientId: 'PT-C',
      bedId: 'BED-03',
      timestamp: now,
      vitalType: 'OXYGEN_SATURATION',
      value: 91,
      unit: 'PERCENT',
      confidence: 1.0,
      qualityStatus: 'TRUSTED',
      source: 'BEDSIDE_DEVICE',
    },
  ];

  const scenarioC: CalibrationScenario = {
    metadata: {
      id: 'PT-C',
      name: 'Patient C (Sustained Deterioration)',
      archetype: 'SUSTAINED_DETERIORATION',
      expectedRankMin: 1,
      expectedRankMax: 2,
      expectedCategory: 'CRITICAL_REVIEW',
      clinicalRationale: 'Active persistent tachycardia, tachypnea, hypotension, and MEWS escalation; immediate resuscitation needed.',
      primaryDrivingFactor: 'ACTIVE_MULTISYSTEM_COLLAPSE',
    },
    patientState: {
      patientId: 'PT-C',
      bedNumber: '103',
      currentTimestamp: now,
      observations: patientCObs,
      baseline: {
        heartRate: 75,
        systolicBP: 125,
        respiratoryRate: 16,
      },
      latestSignalQuality: {
        sqiPercentage: 92,
        snrDb: 16,
        illuminationLux: 300,
        motionArtifactIndex: 0.05,
        state: 'TRUSTED',
        isUsable: true,
        faceDetected: true,
      },
    },
  };

  // ==========================================================================
  // PATIENT D: POOR SIGNAL / UNKNOWN STATE
  // Contactless camera signal is degraded (confidence 0.35, SQI 30%).
  // Zero vitals fabricated. High epistemic uncertainty index (0.65). Needs sensor check.
  // Expected Rank: 4
  // Expected Category: WATCH
  // ==========================================================================
  const patientDPriorObs: Observation[] = [
    {
      id: 'obs-d-hr-prior',
      patientId: 'PT-D',
      bedId: 'BED-04',
      timestamp: now - 35 * 60 * 1000,
      vitalType: 'HEART_RATE',
      value: 75,
      unit: 'BPM',
      confidence: 0.95,
      qualityStatus: 'TRUSTED',
      source: 'NURSE_MANUAL',
    },
  ];

  const patientDCameraReading: SensorReading = {
    id: 'sensor-d-rppg',
    patientId: 'PT-D',
    bedId: 'BED-04',
    timestamp: now,
    source: 'OPTICAL_RPPG',
    confidence: 0.35,
    measurementStatus: 'LOW_CONFIDENCE',
    measurement_status: 'LOW_CONFIDENCE',
    signalQuality: {
      sqiPercentage: 30,
      snrDb: 1.0,
      illuminationLux: 15,
      motionArtifactIndex: 0.85,
      state: 'UNRELIABLE',
      isUsable: false,
      faceDetected: true,
    },
    heartRate: undefined, // Strictly zero-fabrication!
  };

  const scenarioD: CalibrationScenario = {
    metadata: {
      id: 'PT-D',
      name: 'Patient D (Poor Signal / Unknown State)',
      archetype: 'POOR_SIGNAL',
      expectedRankMin: 4,
      expectedRankMax: 4,
      expectedCategory: 'WATCH',
      clinicalRationale: 'Unreliable optical signal elevates epistemic uncertainty; requires manual verification, not false alarm.',
      primaryDrivingFactor: 'EPISTEMIC_MEASUREMENT_UNCERTAINTY',
    },
    patientState: {
      patientId: 'PT-D',
      bedNumber: '104',
      currentTimestamp: now,
      observations: patientDPriorObs,
      sensorReadings: [patientDCameraReading],
      latestSignalQuality: patientDCameraReading.signalQuality,
    },
  };

  // ==========================================================================
  // PATIENT E: ABNORMAL LABS BUT STABLE TREND
  // High lactate (3.2 mmol/L) and leukocytosis (WBC 16.5), indicating metabolic stress.
  // Resting vitals are stable (HR 76, RR 14, SBP 120).
  // Expected Rank: 3
  // Expected Category: WATCH or EVALUATE
  // ==========================================================================
  const patientEObs: Observation[] = [
    {
      id: 'obs-e-hr',
      patientId: 'PT-E',
      bedId: 'BED-05',
      timestamp: now - 10 * 60 * 1000,
      vitalType: 'HEART_RATE',
      value: 76,
      unit: 'BPM',
      confidence: 1.0,
      qualityStatus: 'TRUSTED',
      source: 'NURSE_MANUAL',
    },
    {
      id: 'obs-e-rr',
      patientId: 'PT-E',
      bedId: 'BED-05',
      timestamp: now - 10 * 60 * 1000,
      vitalType: 'RESPIRATORY_RATE',
      value: 14,
      unit: 'BREATHS_PER_MINUTE',
      confidence: 1.0,
      qualityStatus: 'TRUSTED',
      source: 'NURSE_MANUAL',
    },
    {
      id: 'obs-e-sbp',
      patientId: 'PT-E',
      bedId: 'BED-05',
      timestamp: now - 10 * 60 * 1000,
      vitalType: 'SYSTOLIC_BP',
      value: 118,
      unit: 'MMHG',
      confidence: 1.0,
      qualityStatus: 'TRUSTED',
      source: 'NURSE_MANUAL',
    },
  ];

  const patientELabs: LaboratoryResult[] = [
    {
      id: 'lab-e-lactate',
      patientId: 'PT-E',
      testCode: 'LACTATE',
      testName: 'Serum Lactate',
      value: 3.2,
      unit: 'MMOL_PER_L',
      timestamp: now - 60 * 60 * 1000,
      referenceRange: { low: 0.5, high: 2.0 },
      isCritical: false,
      sourceLab: 'CENTRAL_PATHOLOGY',
    },
    {
      id: 'lab-e-wbc',
      patientId: 'PT-E',
      testCode: 'WBC',
      testName: 'White Blood Cell Count',
      value: 16.5,
      unit: 'X10_9_PER_L',
      timestamp: now - 60 * 60 * 1000,
      referenceRange: { low: 4.0, high: 11.0 },
      isCritical: false,
      sourceLab: 'CENTRAL_PATHOLOGY',
    },
  ];

  const scenarioE: CalibrationScenario = {
    metadata: {
      id: 'PT-E',
      name: 'Patient E (Abnormal Labs / Stable Trend)',
      archetype: 'ABNORMAL_LABS',
      expectedRankMin: 3,
      expectedRankMax: 3,
      expectedCategory: 'WATCH',
      clinicalRationale: 'Hyperlactatemia and leukocytosis indicate occult metabolic stress; vitals remain compensated.',
      primaryDrivingFactor: 'BIOMARKER_METABOLIC_STRESS',
    },
    patientState: {
      patientId: 'PT-E',
      bedNumber: '105',
      currentTimestamp: now,
      observations: patientEObs,
      labs: patientELabs,
      baseline: {
        heartRate: 74,
        systolicBP: 120,
        respiratoryRate: 14,
      },
    },
  };

  // ==========================================================================
  // PATIENT F: RISING HR/RR + STALE OBSERVATION
  // Documented accelerating trajectory (+25 bpm/h) and last trusted observation was 4h ago.
  // Compounded risk: unmonitored unstable patient.
  // Expected Rank: 1 or 2 (Top Tier)
  // Expected Category: CRITICAL_REVIEW
  // ==========================================================================
  const staleTimestamp = now - 240 * 60 * 1000; // 4 hours ago

  const patientFObs: Observation[] = [
    {
      id: 'obs-f-hr-t1',
      patientId: 'PT-F',
      bedId: 'BED-06',
      timestamp: staleTimestamp - 60 * 60 * 1000, // 5 hours ago
      vitalType: 'HEART_RATE',
      value: 75,
      unit: 'BPM',
      confidence: 1.0,
      qualityStatus: 'TRUSTED',
      source: 'NURSE_MANUAL',
    },
    {
      id: 'obs-f-hr-t2',
      patientId: 'PT-F',
      bedId: 'BED-06',
      timestamp: staleTimestamp, // 4 hours ago (accelerated by 25 bpm in 1h)
      vitalType: 'HEART_RATE',
      value: 100,
      unit: 'BPM',
      confidence: 1.0,
      qualityStatus: 'TRUSTED',
      source: 'NURSE_MANUAL',
    },
    {
      id: 'obs-f-rr',
      patientId: 'PT-F',
      bedId: 'BED-06',
      timestamp: staleTimestamp,
      vitalType: 'RESPIRATORY_RATE',
      value: 24,
      unit: 'BREATHS_PER_MINUTE',
      confidence: 1.0,
      qualityStatus: 'TRUSTED',
      source: 'NURSE_MANUAL',
    },
  ];

  const scenarioF: CalibrationScenario = {
    metadata: {
      id: 'PT-F',
      name: 'Patient F (Rising HR/RR + Stale Observation)',
      archetype: 'RISING_AND_STALE',
      expectedRankMin: 1,
      expectedRankMax: 2,
      expectedCategory: 'CRITICAL_REVIEW',
      clinicalRationale: 'Rapidly accelerating trajectory unmonitored for 4 hours; severe compounded epistemic hazard.',
      primaryDrivingFactor: 'COMPOUNDED_UNMONITORED_ACCELERATION',
    },
    patientState: {
      patientId: 'PT-F',
      bedNumber: '106',
      currentTimestamp: now,
      observations: patientFObs,
      lastTrustedObservationTimestamp: staleTimestamp,
      baseline: {
        heartRate: 75,
        systolicBP: 120,
        respiratoryRate: 15,
      },
    },
  };

  return [scenarioA, scenarioB, scenarioC, scenarioD, scenarioE, scenarioF];
}
