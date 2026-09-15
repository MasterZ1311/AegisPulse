/**
 * Comprehensive Adversarial Clinical Logic Verification Suite
 *
 * Rigorously audits the mathematical and algorithmic properties of the clinical intelligence engine:
 * 1. MEWS boundaries (Subbe et al. 2001)
 * 2. qSOFA boundaries (Singer et al. 2016)
 * 3. APS boundaries & floor overrides
 * 4. Velocity & acceleration derivatives
 * 5. Baseline calculations & personal envelope deviation
 * 6. Observation freshness & exponential half-life decay
 * 7. Signal confidence & optical SQI modulation
 * 8. Missing data handling (epistemic uncertainty vs confirmed deterioration)
 * 9. Stale data interactions (decoupling vs compounding)
 * 10. Sudden spikes & transient noise filtering
 * 11. Gradual deterioration trajectories
 * 12. Recovery & physiological de-escalation
 * 13. Simultaneous multi-system deterioration
 * 14. Extreme physiological values
 * 15. NaN input resilience
 * 16. Infinity / -Infinity input resilience
 * 17. Negative physiological values & timestamps
 * 18. Timestamp manipulation (out-of-order, future, identical, zero)
 * 19. Core APS Invariants: Boundedness, Determinism, Explainability, Monotonicity
 * 20. Property-based randomized Monte Carlo fuzz testing (1,000 permutations)
 *
 * DISCLAIMER: This test suite verifies software implementation behavior and mathematical
 * invariants. It does NOT constitute a clinical trial or proof of diagnostic efficacy.
 */

import { describe, it, expect } from 'vitest';
import {
  AttentionPriorityEngine,
  evaluateAttentionPriority,
  rankWardPatients,
} from '../src/attentionPriority';
import { calculateMEWS, getThresholds as getMEWSThresholds, validateMEWSInput } from '../src/mews';
import { calculateQSOFA, getThresholds as getQSOFAThresholds, validateQSOFAInput } from '../src/qsofa';
import { computeVitalVelocity, evaluateVelocityAndAcceleration } from '../src/attentionPriority/components/velocity';
import { evaluateInformationDecay } from '../src/attentionPriority/components/decay';
import { evaluateSignalConfidence } from '../src/attentionPriority/components/confidence';
import { evaluateMissingInformation } from '../src/attentionPriority/components/missing-info';
import { evaluateAbnormality } from '../src/attentionPriority/components/abnormality';
import { evaluateBaselineDeviation } from '../src/attentionPriority/components/baseline';
import { DEFAULT_ATTENTION_CONFIG } from '../src/attentionPriority/config';
import type { PatientStateInput } from '../src/attentionPriority/types';
import type { Observation, SensorReading, VitalType, VitalUnit } from '@aegispulse/types';

describe('Adversarial Clinical Logic Audit & Verification', () => {
  const engine = new AttentionPriorityEngine();
  const BASE_TIME = 1773471600000; // Fixed deterministic anchor

  // Helper to construct typed observations
  function makeObs(
    id: string,
    vitalType: VitalType,
    value: number,
    unit: VitalUnit,
    timestamp: number,
    qualityStatus: 'TRUSTED' | 'DEGRADED' | 'UNRELIABLE' = 'TRUSTED',
    confidence = 0.95
  ): Observation {
    return {
      id,
      patientId: 'PAT-ADV-01',
      bedId: 'BED-01',
      vitalType,
      value,
      unit,
      timestamp,
      source: 'BEDSIDE_MONITOR',
      confidence,
      qualityStatus,
    };
  }

  // ============================================================================
  // 1. MEWS BOUNDARIES (Subbe et al. 2001)
  // ============================================================================
  describe('1. MEWS Boundary Verification', () => {
    it('verifies exact Systolic Blood Pressure transitions', () => {
      // <=70: 3 pts, 71-80: 2 pts, 81-100: 1 pt, 101-199: 0 pts, >=200: 2 pts
      expect(calculateMEWS({ systolicBP: 70 }, { skipValidation: true }).subscores.systolicBP.points).toBe(3);
      expect(calculateMEWS({ systolicBP: 71 }, { skipValidation: true }).subscores.systolicBP.points).toBe(2);
      expect(calculateMEWS({ systolicBP: 80 }, { skipValidation: true }).subscores.systolicBP.points).toBe(2);
      expect(calculateMEWS({ systolicBP: 81 }, { skipValidation: true }).subscores.systolicBP.points).toBe(1);
      expect(calculateMEWS({ systolicBP: 100 }, { skipValidation: true }).subscores.systolicBP.points).toBe(1);
      expect(calculateMEWS({ systolicBP: 101 }, { skipValidation: true }).subscores.systolicBP.points).toBe(0);
      expect(calculateMEWS({ systolicBP: 199 }, { skipValidation: true }).subscores.systolicBP.points).toBe(0);
      expect(calculateMEWS({ systolicBP: 200 }, { skipValidation: true }).subscores.systolicBP.points).toBe(2);
    });

    it('verifies exact Heart Rate transitions', () => {
      // <=40: 2 pts, 41-50: 1 pt, 51-100: 0 pts, 101-110: 1 pt, 111-129: 2 pts, >=130: 3 pts
      expect(calculateMEWS({ heartRate: 40 }, { skipValidation: true }).subscores.heartRate.points).toBe(2);
      expect(calculateMEWS({ heartRate: 41 }, { skipValidation: true }).subscores.heartRate.points).toBe(1);
      expect(calculateMEWS({ heartRate: 50 }, { skipValidation: true }).subscores.heartRate.points).toBe(1);
      expect(calculateMEWS({ heartRate: 51 }, { skipValidation: true }).subscores.heartRate.points).toBe(0);
      expect(calculateMEWS({ heartRate: 100 }, { skipValidation: true }).subscores.heartRate.points).toBe(0);
      expect(calculateMEWS({ heartRate: 101 }, { skipValidation: true }).subscores.heartRate.points).toBe(1);
      expect(calculateMEWS({ heartRate: 110 }, { skipValidation: true }).subscores.heartRate.points).toBe(1);
      expect(calculateMEWS({ heartRate: 111 }, { skipValidation: true }).subscores.heartRate.points).toBe(2);
      expect(calculateMEWS({ heartRate: 129 }, { skipValidation: true }).subscores.heartRate.points).toBe(2);
      expect(calculateMEWS({ heartRate: 130 }, { skipValidation: true }).subscores.heartRate.points).toBe(3);
    });

    it('verifies exact Respiratory Rate transitions', () => {
      // <=8: 2 pts, 9-14: 0 pts, 15-20: 1 pt, 21-29: 2 pts, >=30: 3 pts
      expect(calculateMEWS({ respiratoryRate: 8 }, { skipValidation: true }).subscores.respiratoryRate.points).toBe(2);
      expect(calculateMEWS({ respiratoryRate: 9 }, { skipValidation: true }).subscores.respiratoryRate.points).toBe(0);
      expect(calculateMEWS({ respiratoryRate: 14 }, { skipValidation: true }).subscores.respiratoryRate.points).toBe(0);
      expect(calculateMEWS({ respiratoryRate: 15 }, { skipValidation: true }).subscores.respiratoryRate.points).toBe(1);
      expect(calculateMEWS({ respiratoryRate: 20 }, { skipValidation: true }).subscores.respiratoryRate.points).toBe(1);
      expect(calculateMEWS({ respiratoryRate: 21 }, { skipValidation: true }).subscores.respiratoryRate.points).toBe(2);
      expect(calculateMEWS({ respiratoryRate: 29 }, { skipValidation: true }).subscores.respiratoryRate.points).toBe(2);
      expect(calculateMEWS({ respiratoryRate: 30 }, { skipValidation: true }).subscores.respiratoryRate.points).toBe(3);
    });

    it('verifies exact Temperature transitions', () => {
      // <=35.0: 2 pts, 35.1-38.4: 0 pts, >=38.5: 2 pts
      expect(calculateMEWS({ temperature: 35.0 }, { skipValidation: true }).subscores.temperature.points).toBe(2);
      expect(calculateMEWS({ temperature: 35.1 }, { skipValidation: true }).subscores.temperature.points).toBe(0);
      expect(calculateMEWS({ temperature: 38.4 }, { skipValidation: true }).subscores.temperature.points).toBe(0);
      expect(calculateMEWS({ temperature: 38.5 }, { skipValidation: true }).subscores.temperature.points).toBe(2);
    });

    it('verifies exact AVPU scale scores', () => {
      expect(calculateMEWS({ avpu: 'A' }, { skipValidation: true }).subscores.avpu.points).toBe(0);
      expect(calculateMEWS({ avpu: 'V' }, { skipValidation: true }).subscores.avpu.points).toBe(1);
      expect(calculateMEWS({ avpu: 'P' }, { skipValidation: true }).subscores.avpu.points).toBe(2);
      expect(calculateMEWS({ avpu: 'U' }, { skipValidation: true }).subscores.avpu.points).toBe(3);
    });

    it('verifies theoretical maximum MEWS of 14 points and critical escalation trigger at 5', () => {
      const maxMEWS = calculateMEWS({
        systolicBP: 65,     // 3
        heartRate: 140,     // 3
        respiratoryRate: 35,// 3
        temperature: 34.5,  // 2
        avpu: 'U',          // 3
      }, { skipValidation: true });

      expect(maxMEWS.totalScore).toBe(14);
      expect(maxMEWS.isSevere).toBe(true);
      expect(maxMEWS.triageLevel).toBe('red');

      const criticalTrigger = calculateMEWS({
        systolicBP: 80, // 2
        heartRate: 130, // 3
      }, { skipValidation: true });
      expect(criticalTrigger.totalScore).toBe(5);
      expect(criticalTrigger.isSevere).toBe(true);
    });
  });

  // ============================================================================
  // 2. QSOFA BOUNDARIES (Singer et al. 2016)
  // ============================================================================
  describe('2. qSOFA Boundary Verification', () => {
    it('verifies exact Respiratory Rate threshold (>= 22 breaths/min)', () => {
      expect(calculateQSOFA({ respiratoryRate: 21 }, { skipValidation: true }).subscores.respiratoryRate.points).toBe(0);
      expect(calculateQSOFA({ respiratoryRate: 22 }, { skipValidation: true }).subscores.respiratoryRate.points).toBe(1);
      expect(calculateQSOFA({ respiratoryRate: 23 }, { skipValidation: true }).subscores.respiratoryRate.points).toBe(1);
    });

    it('verifies exact Systolic Blood Pressure threshold (<= 100 mmHg)', () => {
      expect(calculateQSOFA({ systolicBP: 101 }, { skipValidation: true }).subscores.systolicBP.points).toBe(0);
      expect(calculateQSOFA({ systolicBP: 100 }, { skipValidation: true }).subscores.systolicBP.points).toBe(1);
      expect(calculateQSOFA({ systolicBP: 99 }, { skipValidation: true }).subscores.systolicBP.points).toBe(1);
    });

    it('verifies altered mentation threshold (AVPU != A or GCS < 15)', () => {
      expect(calculateQSOFA({ avpu: 'A' }, { skipValidation: true }).subscores.alteredMentation.points).toBe(0);
      expect(calculateQSOFA({ avpu: 'V' }, { skipValidation: true }).subscores.alteredMentation.points).toBe(1);
      expect(calculateQSOFA({ avpu: 'P' }, { skipValidation: true }).subscores.alteredMentation.points).toBe(1);
      expect(calculateQSOFA({ avpu: 'U' }, { skipValidation: true }).subscores.alteredMentation.points).toBe(1);
      expect(calculateQSOFA({ gcs: 15 }, { skipValidation: true }).subscores.alteredMentation.points).toBe(0);
      expect(calculateQSOFA({ gcs: 14 }, { skipValidation: true }).subscores.alteredMentation.points).toBe(1);
    });

    it('verifies qSOFA positive sepsis alert trigger at score >= 2', () => {
      const negativeResult = calculateQSOFA({ respiratoryRate: 24 }, { skipValidation: true });
      expect(negativeResult.totalScore).toBe(1);
      expect(negativeResult.isPositive).toBe(false);

      const positiveResult = calculateQSOFA({ respiratoryRate: 24, systolicBP: 95 }, { skipValidation: true });
      expect(positiveResult.totalScore).toBe(2);
      expect(positiveResult.isPositive).toBe(true);

      const maxResult = calculateQSOFA({ respiratoryRate: 26, systolicBP: 85, avpu: 'V' }, { skipValidation: true });
      expect(maxResult.totalScore).toBe(3);
      expect(maxResult.isPositive).toBe(true);
    });
  });

  // ============================================================================
  // 3. APS BOUNDARIES & OVERRIDE FLOORS
  // ============================================================================
  describe('3. APS Boundaries & Clinical Override Floors', () => {
    it('guarantees APS is strictly bounded in [0, 100] on completely empty input', () => {
      const result = engine.evaluate({
        patientId: 'P-EMPTY',
        bedNumber: 'B1',
        observations: [],
        currentTimestamp: BASE_TIME,
      });
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(Number.isFinite(result.score)).toBe(true);
    });

    it('enforces qSOFA positive override floor (APS >= 60)', () => {
      const observations: Observation[] = [
        makeObs('o1', 'RESPIRATORY_RATE', 24, 'BREATHS_PER_MINUTE', BASE_TIME),
        makeObs('o2', 'SYSTOLIC_BP', 95, 'MMHG', BASE_TIME),
      ];
      const result = engine.evaluate({
        patientId: 'P-QSOFA',
        bedNumber: 'B1',
        observations,
        currentTimestamp: BASE_TIME,
      });
      expect(result.score).toBeGreaterThanOrEqual(DEFAULT_ATTENTION_CONFIG.overrideFloors.qsofaSevereMinScore);
    });

    it('enforces MEWS >= 5 severe override floor (APS >= 70)', () => {
      const observations: Observation[] = [
        makeObs('o1', 'HEART_RATE', 135, 'BPM', BASE_TIME), // 3 pts
        makeObs('o2', 'SYSTOLIC_BP', 75, 'MMHG', BASE_TIME),  // 2 pts -> total 5
      ];
      const result = engine.evaluate({
        patientId: 'P-MEWS',
        bedNumber: 'B1',
        observations,
        currentTimestamp: BASE_TIME,
      });
      expect(result.score).toBeGreaterThanOrEqual(DEFAULT_ATTENTION_CONFIG.overrideFloors.mewsSevereMinScore);
      expect(result.category).toBe('CRITICAL_REVIEW');
    });

    it('enforces Critical Shock Index floor (SI >= 1.10 -> APS >= 75)', () => {
      const observations: Observation[] = [
        makeObs('o1', 'HEART_RATE', 120, 'BPM', BASE_TIME),
        makeObs('o2', 'SYSTOLIC_BP', 90, 'MMHG', BASE_TIME), // SI = 120/90 = 1.33 >= 1.10
      ];
      const result = engine.evaluate({
        patientId: 'P-SI',
        bedNumber: 'B1',
        observations,
        currentTimestamp: BASE_TIME,
      });
      expect(result.score).toBeGreaterThanOrEqual(DEFAULT_ATTENTION_CONFIG.overrideFloors.criticalShockIndexMinScore);
      expect(result.reasons.some((r) => r.code === 'SHOCK_INDEX_OCCULT')).toBe(true);
    });

    it('enforces Critical Lactate floor (Lactate >= 4.0 -> APS >= 80)', () => {
      const result = engine.evaluate({
        patientId: 'P-LACT',
        bedNumber: 'B1',
        observations: [
          makeObs('o1', 'HEART_RATE', 72, 'BPM', BASE_TIME),
        ],
        labs: [
          {
            testCode: 'LACTATE',
            testName: 'Blood Lactate',
            value: 4.8,
            unit: 'MMOL_PER_L',
            isAbnormal: true,
            isCritical: true,
            timestamp: BASE_TIME,
            source: 'LAB_LIS',
          },
        ],
        currentTimestamp: BASE_TIME,
      });
      expect(result.score).toBeGreaterThanOrEqual(DEFAULT_ATTENTION_CONFIG.overrideFloors.criticalLactateMinScore);
    });

    it('guarantees ceiling saturation at 100 without numerical overflow when all floors overlap', () => {
      const observations: Observation[] = [
        // Deteriorating history 15m ago -> escalating velocity & baseline
        makeObs('o1-prev', 'HEART_RATE', 80, 'BPM', BASE_TIME - 15 * 60000),
        makeObs('o2-prev', 'RESPIRATORY_RATE', 18, 'BREATHS_PER_MINUTE', BASE_TIME - 15 * 60000),
        makeObs('o3-prev', 'SYSTOLIC_BP', 130, 'MMHG', BASE_TIME - 15 * 60000),
        // Acute collapse at BASE_TIME
        makeObs('o1', 'HEART_RATE', 180, 'BPM', BASE_TIME),
        makeObs('o2', 'RESPIRATORY_RATE', 42, 'BREATHS_PER_MINUTE', BASE_TIME),
        makeObs('o3', 'SYSTOLIC_BP', 55, 'MMHG', BASE_TIME),
        makeObs('o4', 'OXYGEN_SATURATION', 75, 'PERCENT', BASE_TIME),
        makeObs('o5', 'BODY_TEMPERATURE', 41.2, 'CELSIUS', BASE_TIME),
      ];
      const result = engine.evaluate({
        patientId: 'P-MAX',
        bedNumber: 'B1',
        observations,
        baseline: { heartRate: 72, respiratoryRate: 16, systolicBP: 120 },
        lastTrustedObservationTimestamp: BASE_TIME - 240 * 60000,
        avpu: 'U',
        labs: [
          {
            testCode: 'LACTATE',
            testName: 'Blood Lactate',
            value: 8.5,
            unit: 'MMOL_PER_L',
            isAbnormal: true,
            isCritical: true,
            timestamp: BASE_TIME,
            source: 'LAB_LIS',
          },
        ],
        currentTimestamp: BASE_TIME,
      });
      expect(result.score).toBe(100);
      expect(result.category).toBe('CRITICAL_REVIEW');
    });
  });

  // ============================================================================
  // 4. VELOCITY & ACCELERATION CALCULATIONS
  // ============================================================================
  describe('4. Velocity & Acceleration Calculation Verification', () => {
    it('discards intervals < 30 seconds as noise and returns null derivative', () => {
      const history: Observation[] = [
        makeObs('o1', 'HEART_RATE', 72, 'BPM', BASE_TIME - 15000), // 15s ago
        makeObs('o2', 'HEART_RATE', 95, 'BPM', BASE_TIME),
      ];
      const score = evaluateVelocityAndAcceleration(
        { HEART_RATE: history.map((o) => ({ value: o.value, timestamp: o.timestamp, confidence: 1.0, qualityStatus: 'TRUSTED', sourceObservationId: o.id })) },
        DEFAULT_ATTENTION_CONFIG,
        BASE_TIME,
        ['o1', 'o2']
      );
      // Interval too narrow (<30s) -> no derivative derived
      expect(score.normalizedContribution).toBe(0);
    });

    it('correctly derives hourly rate of change over a 30-minute interval', () => {
      // HR increases from 70 to 100 in 30 minutes -> +60 bpm/hr
      const history: Observation[] = [
        makeObs('o1', 'HEART_RATE', 70, 'BPM', BASE_TIME - 30 * 60000),
        makeObs('o2', 'HEART_RATE', 100, 'BPM', BASE_TIME),
      ];
      const score = evaluateVelocityAndAcceleration(
        { HEART_RATE: history.map((o) => ({ value: o.value, timestamp: o.timestamp, confidence: 1.0, qualityStatus: 'TRUSTED', sourceObservationId: o.id })) },
        DEFAULT_ATTENTION_CONFIG,
        BASE_TIME,
        ['o1', 'o2']
      );
      expect(score.normalizedContribution).toBeGreaterThanOrEqual(75);
      expect(score.reasons.some((r) => r.code === 'VELOCITY_HR_SPIKE')).toBe(true);
    });

    it('detects second-derivative acceleration across 3 sequential observations', () => {
      // t-30m: 70 bpm, t-15m: 80 bpm (v1 = +40/hr), t0: 105 bpm (v2 = +100/hr)
      // v2 > v1 -> acceleration detected
      const history = [
        { value: 70, timestamp: BASE_TIME - 30 * 60000, confidence: 1.0, qualityStatus: 'TRUSTED' as const, sourceObservationId: 'o1' },
        { value: 80, timestamp: BASE_TIME - 15 * 60000, confidence: 1.0, qualityStatus: 'TRUSTED' as const, sourceObservationId: 'o2' },
        { value: 105, timestamp: BASE_TIME, confidence: 1.0, qualityStatus: 'TRUSTED' as const, sourceObservationId: 'o3' },
      ];
      const score = evaluateVelocityAndAcceleration(
        { HEART_RATE: history },
        DEFAULT_ATTENTION_CONFIG,
        BASE_TIME,
        ['o1', 'o2', 'o3']
      );
      expect(score.explanation).toContain('[ACCELERATING]');
    });

    it('ignores observations older than 60 minutes for short-term derivative', () => {
      const history = [
        { value: 60, timestamp: BASE_TIME - 120 * 60000, confidence: 1.0, qualityStatus: 'TRUSTED' as const, sourceObservationId: 'o1' },
        { value: 72, timestamp: BASE_TIME - 10 * 60000, confidence: 1.0, qualityStatus: 'TRUSTED' as const, sourceObservationId: 'o2' },
        { value: 72, timestamp: BASE_TIME, confidence: 1.0, qualityStatus: 'TRUSTED' as const, sourceObservationId: 'o3' },
      ];
      const score = evaluateVelocityAndAcceleration(
        { HEART_RATE: history },
        DEFAULT_ATTENTION_CONFIG,
        BASE_TIME,
        ['o1', 'o2', 'o3']
      );
      // Constant 72 bpm in 10-minute window -> velocity = 0
      expect(score.normalizedContribution).toBe(0);
    });
  });

  // ============================================================================
  // 5. BASELINE CALCULATIONS & ENVELOPE DEVIATION
  // ============================================================================
  describe('5. Baseline Envelope Deviation Verification', () => {
    it('uses patient-specific baseline when provided over standard ward baseline', () => {
      // Patient personalized baseline HR = 55 bpm (athlete/beta-blocker)
      // Current HR = 85 bpm. Relative to 55: +54.5% (> severe threshold 40%)
      // Relative to ward standard (72 bpm): +18% (< mild threshold 20%)
      const vitals = {
        HEART_RATE: { value: 85, timestamp: BASE_TIME, confidence: 1.0, qualityStatus: 'TRUSTED' as const, sourceObservationId: 'o1' },
      };
      const scorePersonalized = evaluateBaselineDeviation(
        vitals,
        { heartRate: 55 },
        DEFAULT_ATTENTION_CONFIG,
        BASE_TIME,
        ['o1']
      );
      const scoreStandard = evaluateBaselineDeviation(
        vitals,
        undefined, // Ward default 72
        DEFAULT_ATTENTION_CONFIG,
        BASE_TIME,
        ['o1']
      );

      expect(scorePersonalized.normalizedContribution).toBeGreaterThan(scoreStandard.normalizedContribution);
      expect(scorePersonalized.reasons.some((r) => r.code === 'BASELINE_DEVIATION')).toBe(true);
    });

    it('detects precipitous systolic blood pressure drop relative to baseline', () => {
      // Baseline SBP 140, current SBP 95 -> drop = 45 / 140 = 32% (severe drop >= 30%)
      const vitals = {
        SYSTOLIC_BP: { value: 95, timestamp: BASE_TIME, confidence: 1.0, qualityStatus: 'TRUSTED' as const, sourceObservationId: 'o1' },
      };
      const score = evaluateBaselineDeviation(
        vitals,
        { systolicBP: 140 },
        DEFAULT_ATTENTION_CONFIG,
        BASE_TIME,
        ['o1']
      );
      expect(score.normalizedContribution).toBeGreaterThanOrEqual(60);
      expect(score.reasons.some((r) => r.code === 'BASELINE_DEVIATION')).toBe(true);
    });
  });

  // ============================================================================
  // 6. OBSERVATION FRESHNESS & EXPONENTIAL INFORMATION DECAY
  // ============================================================================
  describe('6. Observation Freshness & Exponential Decay Verification', () => {
    it('calculates monotonic decline in freshness score as elapsed time increases', () => {
      const fresh10m = evaluateInformationDecay(BASE_TIME - 10 * 60000, BASE_TIME, DEFAULT_ATTENTION_CONFIG, ['o1']);
      const fresh60m = evaluateInformationDecay(BASE_TIME - 60 * 60000, BASE_TIME, DEFAULT_ATTENTION_CONFIG, ['o1']);
      const fresh180m = evaluateInformationDecay(BASE_TIME - 180 * 60000, BASE_TIME, DEFAULT_ATTENTION_CONFIG, ['o1']);
      const fresh300m = evaluateInformationDecay(BASE_TIME - 300 * 60000, BASE_TIME, DEFAULT_ATTENTION_CONFIG, ['o1']);

      expect(fresh10m.informationFreshness.freshnessScore).toBeGreaterThan(fresh60m.informationFreshness.freshnessScore);
      expect(fresh60m.informationFreshness.freshnessScore).toBeGreaterThan(fresh180m.informationFreshness.freshnessScore);
      expect(fresh180m.informationFreshness.freshnessScore).toBeGreaterThan(fresh300m.informationFreshness.freshnessScore);

      expect(fresh10m.informationFreshness.epistemicRiskCategory).toBe('FRESH');
      expect(fresh300m.informationFreshness.epistemicRiskCategory).toBe('STALE');
    });

    it('strictly bounds epistemic uncertainty index in [0.0, 1.0]', () => {
      const immediate = evaluateInformationDecay(BASE_TIME, BASE_TIME, DEFAULT_ATTENTION_CONFIG, ['o1']);
      expect(immediate.informationFreshness.uncertaintyIndex).toBeCloseTo(0.0, 1);

      const ancient = evaluateInformationDecay(BASE_TIME - 24 * 3600 * 1000, BASE_TIME, DEFAULT_ATTENTION_CONFIG, ['o1']);
      expect(ancient.informationFreshness.uncertaintyIndex).toBeGreaterThanOrEqual(0.65);
      expect(ancient.informationFreshness.uncertaintyIndex).toBeLessThanOrEqual(1.0);
    });
  });

  // ============================================================================
  // 7. SIGNAL CONFIDENCE & OPTICAL SQI MODULATION
  // ============================================================================
  describe('7. Signal Confidence & Optical Dropout Verification', () => {
    it('modulates and discounts velocity when signal confidence degrades', () => {
      const trustedConf = evaluateSignalConfidence(
        { sqiPercentage: 95, state: 'TRUSTED', isUsable: true, faceDetected: true, motionArtifactIndex: 0.05, snrDb: 25, illuminationLux: 400 },
        95,
        DEFAULT_ATTENTION_CONFIG,
        BASE_TIME,
        ['o1']
      );
      expect(trustedConf.confidenceModulationFactor).toBe(1.0);

      const degradedConf = evaluateSignalConfidence(
        { sqiPercentage: 20, state: 'UNRELIABLE', isUsable: false, faceDetected: false, motionArtifactIndex: 0.8, snrDb: 4, illuminationLux: 50 },
        20,
        DEFAULT_ATTENTION_CONFIG,
        BASE_TIME,
        ['o1']
      );
      expect(degradedConf.confidenceModulationFactor).toBe(DEFAULT_ATTENTION_CONFIG.confidenceThresholds.lowConfidenceVelocityDiscount); // 0.20
      expect(degradedConf.componentScore.reasons.some((r) => r.code === 'SENSOR_CONFIDENCE_DEGRADED')).toBe(true);
    });

    it('STRICT INVARIANT: Optical dropout never synthesizes false tachycardia or shock', () => {
      // Sensor is LOST / 0 SQI, but patient has NO recorded observations
      const result = engine.evaluate({
        patientId: 'P-DROPOUT',
        bedNumber: 'B1',
        observations: [],
        latestSignalQuality: {
          sqiPercentage: 0,
          state: 'LOST',
          isUsable: false,
          faceDetected: false,
          motionArtifactIndex: 0,
          snrDb: 0,
          illuminationLux: 0,
        },
        currentTimestamp: BASE_TIME,
      });

      // Attention score is elevated due to sensor failure, but NOT at critical emergency level
      expect(result.score).toBeLessThan(DEFAULT_ATTENTION_CONFIG.categoryThresholds.criticalMin);
      expect(result.reasons.some((r) => r.code === 'SENSOR_CONFIDENCE_DEGRADED')).toBe(true);
      // Must not fabricate occult shock or critical MEWS
      expect(result.reasons.some((r) => r.code === 'SHOCK_INDEX_OCCULT')).toBe(false);
      expect(result.reasons.some((r) => r.code === 'MEWS_ESCALATION')).toBe(false);
    });
  });

  // ============================================================================
  // 8. MISSING DATA (EPISTEMIC UNCERTAINTY VS CONFIRMED CRISIS)
  // ============================================================================
  describe('8. Missing Information Invariant Verification', () => {
    it('penalizes incomplete vital sign sets without fabricating biological decompensation', () => {
      // Only HR provided, missing BP, RR, SpO2, Temp
      const vitals = {
        HEART_RATE: { value: 72, timestamp: BASE_TIME, confidence: 1.0, qualityStatus: 'TRUSTED' as const, sourceObservationId: 'o1' },
      };
      const score = evaluateMissingInformation(vitals, DEFAULT_ATTENTION_CONFIG, BASE_TIME, ['o1']);
      expect(score.normalizedContribution).toBe(75); // 30 (BP) + 25 (RR) + 15 (SpO2) + 5 (Temp)
      expect(score.reasons.some((r) => r.code === 'MISSING_VITAL_SIGNS')).toBe(true);
      expect(score.recommendedActions).toContain('ATTACH_CUFF');
    });

    it('does not trigger clinical override floors from absence of data alone', () => {
      // Completely empty patient record
      const result = engine.evaluate({
        patientId: 'P-MISSING-ALL',
        bedNumber: 'B1',
        observations: [],
        currentTimestamp: BASE_TIME,
      });

      // Category should be WATCH or EVALUATE due to epistemic uncertainty, but NOT CRITICAL_REVIEW
      expect(result.category).not.toBe('CRITICAL_REVIEW');
      expect(result.rankInputs.qsofa.rawScore).toBe(0);
      expect(result.rankInputs.mews.rawScore).toBe(0);
    });
  });

  // ============================================================================
  // 9. STALE DATA INTERACTIONS (DECOUPLING VS COMPOUNDING)
  describe('9. Stale Data Interaction Verification', () => {
    it('normal physiology + 4 hours stale data maps to WATCH category (~32), not crisis', () => {
      // Vitals normal 4 hours ago
      const observations = [
        makeObs('o1', 'HEART_RATE', 72, 'BPM', BASE_TIME - 240 * 60000),
        makeObs('o2', 'RESPIRATORY_RATE', 14, 'BREATHS_PER_MINUTE', BASE_TIME - 240 * 60000),
        makeObs('o3', 'SYSTOLIC_BP', 120, 'MMHG', BASE_TIME - 240 * 60000),
      ];
      const result = engine.evaluate({
        patientId: 'P-STALE-NORMAL',
        bedNumber: 'B1',
        observations,
        lastTrustedObservationTimestamp: BASE_TIME - 240 * 60000,
        currentTimestamp: BASE_TIME,
      });

      expect(result.category).toBe('WATCH');
      expect(result.score).toBeGreaterThanOrEqual(30);
      expect(result.score).toBeLessThan(DEFAULT_ATTENTION_CONFIG.categoryThresholds.watchMax);
      expect(result.recommendedActions.some((a) => a.actionType === 'MANUAL_VITALS_RECHECK')).toBe(true);
      expect(typeof result.recommendedAction).toBe('string');
    });

    it('abnormal trajectory + 4 hours stale data triggers compounded risk escalation (>= 76)', () => {
      // Abnormal vitals 4 hours ago: tachycardia and tachypnea left unmonitored
      const observations = [
        makeObs('o1', 'HEART_RATE', 115, 'BPM', BASE_TIME - 240 * 60000),
        makeObs('o2', 'RESPIRATORY_RATE', 26, 'BREATHS_PER_MINUTE', BASE_TIME - 240 * 60000),
        makeObs('o3', 'SYSTOLIC_BP', 105, 'MMHG', BASE_TIME - 240 * 60000),
      ];
      const result = engine.evaluate({
        patientId: 'P-STALE-ABNORMAL',
        bedNumber: 'B1',
        observations,
        lastTrustedObservationTimestamp: BASE_TIME - 240 * 60000,
        currentTimestamp: BASE_TIME,
      });

      expect(result.category).toBe('CRITICAL_REVIEW');
      expect(result.score).toBeGreaterThanOrEqual(76);
    });
  });

  // ============================================================================
  // 10. SUDDEN SPIKES (TRANSIENT NOISE FILTERING)
  // ============================================================================
  describe('10. Sudden Spikes & Transient Noise Filtering', () => {
    it('dampens isolated single-observation spike via persistence filter', () => {
      // 1-minute isolated spike to 135 bpm, preceded by normal readings
      const observations = [
        makeObs('o1', 'HEART_RATE', 72, 'BPM', BASE_TIME - 15 * 60000),
        makeObs('o2', 'HEART_RATE', 72, 'BPM', BASE_TIME - 2 * 60000),
        makeObs('o3', 'HEART_RATE', 135, 'BPM', BASE_TIME), // isolated spike (< 3m)
      ];
      const spikeResult = engine.evaluate({
        patientId: 'P-SPIKE',
        bedNumber: 'B1',
        observations,
        currentTimestamp: BASE_TIME,
      });

      // Compare with sustained tachycardia where HR escalated and remained abnormal for 15 minutes
      const sustainedObs = [
        makeObs('o1', 'HEART_RATE', 72, 'BPM', BASE_TIME - 30 * 60000),
        makeObs('o2', 'HEART_RATE', 135, 'BPM', BASE_TIME - 15 * 60000),
        makeObs('o3', 'HEART_RATE', 135, 'BPM', BASE_TIME - 8 * 60000),
        makeObs('o4', 'HEART_RATE', 135, 'BPM', BASE_TIME),
      ];
      const sustainedResult = engine.evaluate({
        patientId: 'P-SUSTAINED',
        bedNumber: 'B1',
        observations: sustainedObs,
        currentTimestamp: BASE_TIME,
      });

      expect(spikeResult.rankInputs.persistence.provenance.parameters?.isTransientSpike).toBe(true);
      expect(sustainedResult.rankInputs.persistence.provenance.parameters?.isTransientSpike).toBe(false);
      expect(
        (spikeResult.rankInputs.persistence.provenance.parameters?.persistenceFactor as number)
      ).toBeLessThan(
        sustainedResult.rankInputs.persistence.provenance.parameters?.persistenceFactor as number
      );
      expect(spikeResult.rankInputs.persistence.explanation).toContain('Transient spike');
    });
  });

  // ============================================================================
  // 11. GRADUAL DETERIORATION
  // ============================================================================
  describe('11. Gradual Deterioration Trajectory', () => {
    it('escalates monotonically as physiological trajectory worsens over 45 minutes', () => {
      const step1 = engine.evaluate({
        patientId: 'P-DET',
        bedNumber: 'B1',
        observations: [makeObs('o1', 'HEART_RATE', 75, 'BPM', BASE_TIME - 45 * 60000)],
        currentTimestamp: BASE_TIME - 45 * 60000,
      });

      const step2 = engine.evaluate({
        patientId: 'P-DET',
        bedNumber: 'B1',
        observations: [
          makeObs('o1', 'HEART_RATE', 75, 'BPM', BASE_TIME - 45 * 60000),
          makeObs('o2', 'HEART_RATE', 95, 'BPM', BASE_TIME - 30 * 60000),
        ],
        currentTimestamp: BASE_TIME - 30 * 60000,
      });

      const step3 = engine.evaluate({
        patientId: 'P-DET',
        bedNumber: 'B1',
        observations: [
          makeObs('o1', 'HEART_RATE', 75, 'BPM', BASE_TIME - 45 * 60000),
          makeObs('o2', 'HEART_RATE', 95, 'BPM', BASE_TIME - 30 * 60000),
          makeObs('o3', 'HEART_RATE', 115, 'BPM', BASE_TIME - 15 * 60000),
        ],
        currentTimestamp: BASE_TIME - 15 * 60000,
      });

      const step4 = engine.evaluate({
        patientId: 'P-DET',
        bedNumber: 'B1',
        observations: [
          makeObs('o1', 'HEART_RATE', 75, 'BPM', BASE_TIME - 45 * 60000),
          makeObs('o2', 'HEART_RATE', 95, 'BPM', BASE_TIME - 30 * 60000),
          makeObs('o3', 'HEART_RATE', 115, 'BPM', BASE_TIME - 15 * 60000),
          makeObs('o4', 'HEART_RATE', 135, 'BPM', BASE_TIME),
          makeObs('o5', 'RESPIRATORY_RATE', 30, 'BREATHS_PER_MINUTE', BASE_TIME),
          makeObs('o6', 'SYSTOLIC_BP', 75, 'MMHG', BASE_TIME),
        ],
        currentTimestamp: BASE_TIME,
      });

      expect(step2.score).toBeGreaterThanOrEqual(step1.score);
      expect(step3.score).toBeGreaterThan(step2.score);
      expect(step4.score).toBeGreaterThan(step3.score);
      expect(step4.category).toBe('CRITICAL_REVIEW');
    });
  });

  // ============================================================================
  // 12. RECOVERY TRAJECTORIES
  // ============================================================================
  describe('12. Recovery & Physiological De-escalation', () => {
    it('de-escalates priority score as vitals normalize after resuscitation', () => {
      // In crisis: HR 140, SBP 80 (SI = 1.75)
      const crisisResult = engine.evaluate({
        patientId: 'P-REC',
        bedNumber: 'B1',
        observations: [
          makeObs('o1', 'HEART_RATE', 140, 'BPM', BASE_TIME - 30 * 60000),
          makeObs('o2', 'SYSTOLIC_BP', 80, 'MMHG', BASE_TIME - 30 * 60000),
        ],
        currentTimestamp: BASE_TIME - 30 * 60000,
      });

      // Post-treatment 30m later: full complete vital panel within normal envelope
      const recoveredResult = engine.evaluate({
        patientId: 'P-REC',
        bedNumber: 'B1',
        observations: [
          makeObs('o1', 'HEART_RATE', 140, 'BPM', BASE_TIME - 30 * 60000),
          makeObs('o2', 'SYSTOLIC_BP', 80, 'MMHG', BASE_TIME - 30 * 60000),
          makeObs('o3', 'HEART_RATE', 72, 'BPM', BASE_TIME),
          makeObs('o4', 'SYSTOLIC_BP', 120, 'MMHG', BASE_TIME),
          makeObs('o5', 'RESPIRATORY_RATE', 14, 'BREATHS_PER_MINUTE', BASE_TIME),
          makeObs('o6', 'OXYGEN_SATURATION', 98, 'PERCENT', BASE_TIME),
          makeObs('o7', 'BODY_TEMPERATURE', 36.8, 'CELSIUS', BASE_TIME),
        ],
        currentTimestamp: BASE_TIME,
      });

      expect(recoveredResult.score).toBeLessThan(crisisResult.score);
      expect(recoveredResult.score).toBeLessThan(DEFAULT_ATTENTION_CONFIG.categoryThresholds.watchMax);
      expect(recoveredResult.reasons.some((r) => r.code === 'VELOCITY_HR_SPIKE' || r.code === 'PHYSIOLOGICAL_STABILITY')).toBe(true);
    });
  });

  // ============================================================================
  // 13. SIMULTANEOUS MULTI-SYSTEM DETERIORATION
  // ============================================================================
  describe('13. Simultaneous Multi-System Deterioration', () => {
    it('aggregates multi-organ failure across respiratory, hemodynamic, and metabolic systems', () => {
      const observations = [
        makeObs('o1', 'HEART_RATE', 145, 'BPM', BASE_TIME),
        makeObs('o2', 'RESPIRATORY_RATE', 34, 'BREATHS_PER_MINUTE', BASE_TIME),
        makeObs('o3', 'SYSTOLIC_BP', 75, 'MMHG', BASE_TIME),
        makeObs('o4', 'OXYGEN_SATURATION', 82, 'PERCENT', BASE_TIME),
        makeObs('o5', 'BODY_TEMPERATURE', 39.8, 'CELSIUS', BASE_TIME),
      ];
      const result = engine.evaluate({
        patientId: 'P-MULTI',
        bedNumber: 'B1',
        observations,
        avpu: 'P',
        labs: [
          {
            testCode: 'LACTATE',
            testName: 'Lactate',
            value: 5.2,
            unit: 'MMOL_PER_L',
            isAbnormal: true,
            isCritical: true,
            timestamp: BASE_TIME,
            source: 'LAB_LIS',
          },
        ],
        currentTimestamp: BASE_TIME,
      });

      expect(result.score).toBeGreaterThanOrEqual(75);
      expect(result.category).toBe('CRITICAL_REVIEW');
      expect(result.recommendedActions.some((a) => a.actionType === 'RAPID_RESPONSE_TRIGGER')).toBe(true);
      expect(result.reasons.length).toBeGreaterThanOrEqual(4);
    });
  });

  // ============================================================================
  // 14. EXTREME PHYSIOLOGICAL VALUES
  // ============================================================================
  describe('14. Extreme Physiological Value Verification', () => {
    it('handles maximum physiological limits without numerical overflow or crash', () => {
      const observations = [
        makeObs('o1', 'HEART_RATE', 300, 'BPM', BASE_TIME),
        makeObs('o2', 'RESPIRATORY_RATE', 80, 'BREATHS_PER_MINUTE', BASE_TIME),
        makeObs('o3', 'SYSTOLIC_BP', 30, 'MMHG', BASE_TIME),
        makeObs('o4', 'BODY_TEMPERATURE', 45.0, 'CELSIUS', BASE_TIME),
      ];
      const result = engine.evaluate({
        patientId: 'P-EXTREME',
        bedNumber: 'B1',
        observations,
        currentTimestamp: BASE_TIME,
      });
      expect(result.score).toBeGreaterThanOrEqual(75);
      expect(Number.isFinite(result.score)).toBe(true);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.category).toBe('CRITICAL_REVIEW');
    });
  });

  // ============================================================================
  // 15, 16, 17. ADVERSARIAL NUMERICAL INPUTS: NaN, INFINITY, NEGATIVE VALUES
  // ============================================================================
  describe('15-17. Adversarial Numerical Inputs (NaN, Infinity, Negative Values)', () => {
    it('defensively sanitizes NaN observation values without crashing or producing NaN score', () => {
      const observations = [
        makeObs('o1', 'HEART_RATE', NaN, 'BPM', BASE_TIME),
        makeObs('o2', 'SYSTOLIC_BP', 120, 'MMHG', BASE_TIME),
      ];
      const result = engine.evaluate({
        patientId: 'P-NAN',
        bedNumber: 'B1',
        observations,
        currentTimestamp: BASE_TIME,
      });
      expect(Number.isFinite(result.score)).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('defensively sanitizes Infinity observation values without crashing', () => {
      const observations = [
        makeObs('o1', 'HEART_RATE', Infinity, 'BPM', BASE_TIME),
        makeObs('o2', 'RESPIRATORY_RATE', -Infinity, 'BREATHS_PER_MINUTE', BASE_TIME),
      ];
      const result = engine.evaluate({
        patientId: 'P-INF',
        bedNumber: 'B1',
        observations,
        currentTimestamp: BASE_TIME,
      });
      expect(Number.isFinite(result.score)).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('defensively handles negative vital values without mathematical corruption', () => {
      const observations = [
        makeObs('o1', 'HEART_RATE', -50, 'BPM', BASE_TIME),
        makeObs('o2', 'SYSTOLIC_BP', -120, 'MMHG', BASE_TIME),
      ];
      const result = engine.evaluate({
        patientId: 'P-NEG',
        bedNumber: 'B1',
        observations,
        currentTimestamp: BASE_TIME,
      });
      expect(Number.isFinite(result.score)).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('recovers gracefully when patientState.currentTimestamp is NaN or non-finite', () => {
      const observations = [
        makeObs('o1', 'HEART_RATE', 72, 'BPM', BASE_TIME),
      ];
      const result = engine.evaluate({
        patientId: 'P-NAN-TIME',
        bedNumber: 'B1',
        observations,
        currentTimestamp: NaN,
      });
      expect(Number.isFinite(result.score)).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });
  });

  // ============================================================================
  // 18. TIMESTAMP MANIPULATION
  // ============================================================================
  describe('18. Timestamp Manipulation (Reversed, Future, Identical, Zero)', () => {
    it('correctly processes out-of-order and reversed observation time series', () => {
      // Given out-of-order array: t0, t-30m, t-15m
      const observations = [
        makeObs('o3', 'HEART_RATE', 120, 'BPM', BASE_TIME),
        makeObs('o1', 'HEART_RATE', 72, 'BPM', BASE_TIME - 30 * 60000),
        makeObs('o2', 'HEART_RATE', 105, 'BPM', BASE_TIME - 15 * 60000),
      ];
      const result = engine.evaluate({
        patientId: 'P-OUT-ORDER',
        bedNumber: 'B1',
        observations,
        currentTimestamp: BASE_TIME,
      });

      // Latest must be 120 bpm, velocity must be computed from 72 to 120
      expect(result.rankInputs.abnormality.rawScore).toBe(70); // 120 bpm is moderate tachycardia (score 70)
      expect(result.velocityScore).toBeGreaterThanOrEqual(75);
      expect(result.reasons.some((r) => r.code === 'VELOCITY_HR_SPIKE')).toBe(true);
    });

    it('safely handles observations with identical timestamps (Delta t = 0)', () => {
      const observations = [
        makeObs('o1', 'HEART_RATE', 72, 'BPM', BASE_TIME),
        makeObs('o2', 'HEART_RATE', 85, 'BPM', BASE_TIME),
      ];
      const result = engine.evaluate({
        patientId: 'P-IDENTICAL-TIME',
        bedNumber: 'B1',
        observations,
        currentTimestamp: BASE_TIME,
      });
      expect(Number.isFinite(result.score)).toBe(true);
      expect(result.velocityScore).toBe(0); // Zero interval -> no division by zero
    });

    it('safely handles future timestamps (clock skew where obs timestamp > now)', () => {
      const observations = [
        makeObs('o1', 'HEART_RATE', 80, 'BPM', BASE_TIME + 60000), // 1m in future
      ];
      const result = engine.evaluate({
        patientId: 'P-FUTURE',
        bedNumber: 'B1',
        observations,
        currentTimestamp: BASE_TIME,
      });
      expect(Number.isFinite(result.score)).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });
  });

  // ============================================================================
  // 19. CORE APS INVARIANTS: DETERMINISM, EXPLAINABILITY, MONOTONICITY
  // ============================================================================
  describe('19. Fundamental Algorithmic Invariants', () => {
    it('guarantees 100% Determinism across 100 consecutive evaluations', () => {
      const input: PatientStateInput = {
        patientId: 'P-DETERMINISM',
        bedNumber: 'BED-04',
        currentTimestamp: BASE_TIME,
        observations: [
          makeObs('o1', 'HEART_RATE', 108, 'BPM', BASE_TIME - 15 * 60000),
          makeObs('o2', 'RESPIRATORY_RATE', 22, 'BREATHS_PER_MINUTE', BASE_TIME - 15 * 60000),
          makeObs('o3', 'SYSTOLIC_BP', 98, 'MMHG', BASE_TIME - 15 * 60000),
          makeObs('o4', 'HEART_RATE', 125, 'BPM', BASE_TIME),
          makeObs('o5', 'RESPIRATORY_RATE', 26, 'BREATHS_PER_MINUTE', BASE_TIME),
          makeObs('o6', 'SYSTOLIC_BP', 90, 'MMHG', BASE_TIME),
        ],
        baseline: { heartRate: 72, respiratoryRate: 16, systolicBP: 120 },
      };

      const reference = engine.evaluate(input);
      for (let i = 0; i < 100; i++) {
        const next = engine.evaluate(input);
        expect(next.score).toBe(reference.score);
        expect(next.category).toBe(reference.category);
        expect(next.velocityScore).toBe(reference.velocityScore);
        expect(next.reasons.length).toBe(reference.reasons.length);
        expect(next.recommendedActions.length).toBe(reference.recommendedActions.length);
      }
    });

    it('guarantees Explainability: reasons and provenance are never empty', () => {
      const stableResult = engine.evaluate({
        patientId: 'P-EXP-STABLE',
        bedNumber: 'B1',
        observations: [
          makeObs('o1', 'HEART_RATE', 72, 'BPM', BASE_TIME),
          makeObs('o2', 'RESPIRATORY_RATE', 14, 'BREATHS_PER_MINUTE', BASE_TIME),
          makeObs('o3', 'SYSTOLIC_BP', 120, 'MMHG', BASE_TIME),
          makeObs('o4', 'OXYGEN_SATURATION', 98, 'PERCENT', BASE_TIME),
          makeObs('o5', 'BODY_TEMPERATURE', 36.8, 'CELSIUS', BASE_TIME),
        ],
        currentTimestamp: BASE_TIME,
      });

      expect(stableResult.reasons.length).toBeGreaterThan(0);
      expect(stableResult.reasons[0].code).toBe('PHYSIOLOGICAL_STABILITY');
      expect(stableResult.provenance.algorithm).toBe('AEGIS_PULSE_ATTENTION_PRIORITY_ENGINE');
      expect(stableResult.provenance.parameters).toBeDefined();

      const criticalResult = engine.evaluate({
        patientId: 'P-EXP-CRIT',
        bedNumber: 'B1',
        observations: [
          makeObs('o1', 'HEART_RATE', 140, 'BPM', BASE_TIME),
          makeObs('o2', 'SYSTOLIC_BP', 80, 'MMHG', BASE_TIME),
        ],
        currentTimestamp: BASE_TIME,
      });
      expect(criticalResult.reasons.length).toBeGreaterThan(0);
      for (const reason of criticalResult.reasons) {
        expect(reason.code).toBeDefined();
        expect(reason.description).toBeDefined();
        expect(reason.contributionWeight).toBeGreaterThanOrEqual(0);
        expect(reason.urgency).toBeDefined();
      }
    });

    it('guarantees Monotonicity: escalating vital sign derangement produces non-decreasing score', () => {
      const hrSequence = [55, 72, 95, 110, 125, 145, 170];
      let previousScore = 0;

      for (const hr of hrSequence) {
        const result = engine.evaluate({
          patientId: 'P-MONO',
          bedNumber: 'B1',
          observations: [
            makeObs('o-hr', 'HEART_RATE', hr, 'BPM', BASE_TIME),
            makeObs('o-sbp', 'SYSTOLIC_BP', 120, 'MMHG', BASE_TIME),
            makeObs('o-rr', 'RESPIRATORY_RATE', 15, 'BREATHS_PER_MINUTE', BASE_TIME),
          ],
          currentTimestamp: BASE_TIME,
        });

        if (hr >= 72) {
          expect(result.score).toBeGreaterThanOrEqual(previousScore);
        }
        previousScore = result.score;
      }
    });
  });

  // ============================================================================
  // 20. PROPERTY-BASED RANDOMIZED MONTE CARLO FUZZ TESTING (1,000 PERMUTATIONS)
  // ============================================================================
  describe('20. Property-Based Randomized Monte Carlo Fuzzing', () => {
    it('guarantees all invariants hold over 1,000 arbitrary patient states', () => {
      function getRandomInRange(min: number, max: number): number {
        return min + Math.random() * (max - min);
      }

      function getRandomChoice<T>(arr: T[]): T {
        return arr[Math.floor(Math.random() * arr.length)];
      }

      const avpuChoices: ('A' | 'V' | 'P' | 'U')[] = ['A', 'V', 'P', 'U'];
      const qualityChoices: ('TRUSTED' | 'DEGRADED' | 'UNRELIABLE')[] = ['TRUSTED', 'DEGRADED', 'UNRELIABLE'];

      for (let i = 0; i < 1000; i++) {
        // Randomly generate vitals spanning physiological, pathological, and edge values
        const hr = getRandomChoice([undefined, getRandomInRange(25, 250), NaN, Infinity, -10]);
        const rr = getRandomChoice([undefined, getRandomInRange(4, 60), NaN, Infinity, -5]);
        const sbp = getRandomChoice([undefined, getRandomInRange(35, 240), NaN, Infinity, -20]);
        const spo2 = getRandomChoice([undefined, getRandomInRange(65, 100)]);
        const temp = getRandomChoice([undefined, getRandomInRange(33.0, 42.0)]);
        const avpu = getRandomChoice(avpuChoices);
        const sqi = getRandomInRange(0, 100);
        const obsAgeMs = getRandomInRange(0, 360 * 60000); // 0 to 6 hours ago

        const obs: Observation[] = [];
        const timestamp = BASE_TIME - obsAgeMs;

        if (hr !== undefined) obs.push(makeObs(`hr-${i}`, 'HEART_RATE', hr, 'BPM', timestamp, getRandomChoice(qualityChoices)));
        if (rr !== undefined) obs.push(makeObs(`rr-${i}`, 'RESPIRATORY_RATE', rr, 'BREATHS_PER_MINUTE', timestamp, getRandomChoice(qualityChoices)));
        if (sbp !== undefined) obs.push(makeObs(`sbp-${i}`, 'SYSTOLIC_BP', sbp, 'MMHG', timestamp, getRandomChoice(qualityChoices)));
        if (spo2 !== undefined) obs.push(makeObs(`spo2-${i}`, 'OXYGEN_SATURATION', spo2, 'PERCENT', timestamp, getRandomChoice(qualityChoices)));
        if (temp !== undefined) obs.push(makeObs(`temp-${i}`, 'BODY_TEMPERATURE', temp, 'CELSIUS', timestamp, getRandomChoice(qualityChoices)));

        const result = engine.evaluate({
          patientId: `P-FUZZ-${i}`,
          bedNumber: `BED-${(i % 20) + 1}`,
          observations: obs,
          avpu,
          latestSignalQuality: {
            sqiPercentage: sqi,
            snrDb: sqi / 4,
            illuminationLux: 300,
            motionArtifactIndex: 1.0 - sqi / 100,
            state: sqi >= 60 ? 'TRUSTED' : sqi >= 35 ? 'DEGRADED' : 'UNRELIABLE',
            isUsable: sqi >= 35,
            faceDetected: sqi >= 35,
          },
          currentTimestamp: BASE_TIME,
        });

        // INVARIANT 1: Boundedness
        expect(Number.isFinite(result.score)).toBe(true);
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(100);

        // INVARIANT 2: Category Consistency
        if (result.score >= DEFAULT_ATTENTION_CONFIG.categoryThresholds.criticalMin) {
          expect(result.category).toBe('CRITICAL_REVIEW');
        } else if (result.score > DEFAULT_ATTENTION_CONFIG.categoryThresholds.watchMax) {
          expect(result.category).toBe('EVALUATE');
        } else if (result.score > DEFAULT_ATTENTION_CONFIG.categoryThresholds.lowMax) {
          expect(result.category).toBe('WATCH');
        } else {
          expect(result.category).toBe('LOW');
        }

        // INVARIANT 3: Explainability
        expect(result.reasons.length).toBeGreaterThan(0);
        expect(result.recommendedActions.length).toBeGreaterThan(0);
        expect(result.provenance.derivedAt).toBe(BASE_TIME);
      }
    });

    it('verifies deterministic ward ranking across randomized cohorts', () => {
      const cohort: PatientStateInput[] = Array.from({ length: 12 }, (_, idx) => ({
        patientId: `PAT-COHORT-${idx + 1}`,
        bedNumber: `BED-${idx + 1}`,
        observations: [
          makeObs(`obs-hr-${idx}`, 'HEART_RATE', 60 + idx * 8, 'BPM', BASE_TIME),
          makeObs(`obs-sbp-${idx}`, 'SYSTOLIC_BP', 130 - idx * 4, 'MMHG', BASE_TIME),
        ],
        currentTimestamp: BASE_TIME,
      }));

      const ranked1 = rankWardPatients(cohort);
      const ranked2 = rankWardPatients(cohort);

      expect(ranked1.length).toBe(12);
      expect(ranked2.length).toBe(12);

      // Verify rank order is deterministic
      for (let i = 0; i < ranked1.length; i++) {
        expect(ranked1[i].patientId).toBe(ranked2[i].patientId);
        expect(ranked1[i].wardRank).toBe(i + 1);
        if (i > 0) {
          expect(ranked1[i - 1].score).toBeGreaterThanOrEqual(ranked1[i].score);
        }
      }
    });
  });
});
