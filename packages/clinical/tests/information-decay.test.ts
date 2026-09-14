import { describe, it, expect } from 'vitest';
import {
  evaluateAttentionPriority,
  evaluateInformationDecay,
  extractVitalsFromObservations,
} from '../src';
import { DEFAULT_ATTENTION_CONFIG } from '../src/attentionPriority/config';
import type { PatientStateInput } from '../src/attentionPriority/types';
import type { Observation, SensorReading } from '@aegispulse/types';
import { validateInformationFreshness } from '@aegispulse/types';

describe('Information Decay Subsystem', () => {
  const now = 1700000000000; // Fixed integer epoch timestamp (Wed Nov 15 2023)

  // --------------------------------------------------------------------------
  // INTERACTION 1: NORMAL PHYSIOLOGY + FRESH OBSERVATION
  // → Low attention contribution
  // --------------------------------------------------------------------------
  describe('Interaction 1: Normal Physiology + Fresh Observation', () => {
    it('produces low attention contribution (LOW category, high freshness, low uncertainty)', () => {
      const normalObs: Observation[] = [
        {
          id: 'obs-hr-1',
          patientId: 'PT-001',
          bedId: 'BED-01',
          timestamp: now - 2 * 60 * 1000, // 2 minutes ago
          vitalType: 'HEART_RATE',
          value: 72,
          unit: 'BPM',
          confidence: 1.0,
          qualityStatus: 'TRUSTED',
          source: 'NURSE_MANUAL',
        },
        {
          id: 'obs-rr-1',
          patientId: 'PT-001',
          bedId: 'BED-01',
          timestamp: now - 2 * 60 * 1000,
          vitalType: 'RESPIRATORY_RATE',
          value: 14,
          unit: 'BREATHS_PER_MINUTE',
          confidence: 1.0,
          qualityStatus: 'TRUSTED',
          source: 'NURSE_MANUAL',
        },
        {
          id: 'obs-sbp-1',
          patientId: 'PT-001',
          bedId: 'BED-01',
          timestamp: now - 2 * 60 * 1000,
          vitalType: 'SYSTOLIC_BP',
          value: 120,
          unit: 'MMHG',
          confidence: 1.0,
          qualityStatus: 'TRUSTED',
          source: 'NURSE_MANUAL',
        },
      ];

      const patient: PatientStateInput = {
        patientId: 'PT-001',
        bedNumber: '101',
        currentTimestamp: now,
        observations: normalObs,
      };

      const result = evaluateAttentionPriority(patient);

      // Low attention contribution
      expect(result.score).toBeLessThanOrEqual(25);
      expect(result.category).toBe('LOW');

      // Information freshness & decay metrics
      expect(result.freshnessScore).toBeGreaterThanOrEqual(95);
      expect(result.uncertaintyIndex).toBeLessThanOrEqual(0.05);
      expect(result.decayScore).toBe(0);
      expect(result.informationAgeMinutes).toBe(2);

      // Decoupling verification
      expect(result.informationFreshness).toBeDefined();
      const freshness = result.informationFreshness!;
      expect(freshness.epistemicRiskCategory).toBe('FRESH');
      expect(freshness.isIntervalExceeded).toBe(false);
      expect(freshness.physiologicalRiskVsUncertainty.physiologicalScore).toBe(0);
      expect(freshness.physiologicalRiskVsUncertainty.uncertaintyScore).toBeLessThanOrEqual(5);
      expect(freshness.physiologicalRiskVsUncertainty.couplingMultiplier).toBe(1.0);

      // Strict schema compliance
      const validation = validateInformationFreshness(freshness);
      expect(validation.success).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // INTERACTION 2: NORMAL PHYSIOLOGY + 4 HOURS WITHOUT TRUSTED OBSERVATION
  // → Moderate attention contribution (WATCH category, explicit uncertainty, NOT deterioration)
  // --------------------------------------------------------------------------
  describe('Interaction 2: Normal Physiology + 4 Hours Without Trusted Observation', () => {
    it('produces moderate attention contribution (WATCH category) explicitly reflecting epistemic uncertainty without assuming deterioration', () => {
      const staleTimestamp = now - 240 * 60 * 1000; // 4 hours ago

      const normalStaleObs: Observation[] = [
        {
          id: 'obs-hr-old',
          patientId: 'PT-002',
          bedId: 'BED-02',
          timestamp: staleTimestamp,
          vitalType: 'HEART_RATE',
          value: 70, // Completely normal
          unit: 'BPM',
          confidence: 1.0,
          qualityStatus: 'TRUSTED',
          source: 'NURSE_MANUAL',
        },
        {
          id: 'obs-rr-old',
          patientId: 'PT-002',
          bedId: 'BED-02',
          timestamp: staleTimestamp,
          vitalType: 'RESPIRATORY_RATE',
          value: 14, // Completely normal (0 MEWS points)
          unit: 'BREATHS_PER_MINUTE',
          confidence: 1.0,
          qualityStatus: 'TRUSTED',
          source: 'NURSE_MANUAL',
        },
        {
          id: 'obs-sbp-old',
          patientId: 'PT-002',
          bedId: 'BED-02',
          timestamp: staleTimestamp,
          vitalType: 'SYSTOLIC_BP',
          value: 118, // Completely normal
          unit: 'MMHG',
          confidence: 1.0,
          qualityStatus: 'TRUSTED',
          source: 'NURSE_MANUAL',
        },
      ];

      const patient: PatientStateInput = {
        patientId: 'PT-002',
        bedNumber: '102',
        currentTimestamp: now,
        observations: normalStaleObs,
        lastTrustedObservationTimestamp: staleTimestamp,
      };

      const result = evaluateAttentionPriority(patient);

      // MODERATE ATTENTION CONTRIBUTION (WATCH category: 30 - 54)
      expect(result.score).toBeGreaterThanOrEqual(30);
      expect(result.score).toBeLessThanOrEqual(50);
      expect(result.category).toBe('WATCH');

      // Observation age is 4 hours (240 minutes)
      expect(result.informationAgeMinutes).toBe(240);
      expect(result.decayScore).toBe(80);

      // Freshness decayed and uncertainty increased
      expect(result.freshnessScore).toBeLessThanOrEqual(50);
      expect(result.uncertaintyIndex).toBeGreaterThanOrEqual(0.50);

      // CRITICAL INVARIANT: Reason must explicitly state timeout/uncertainty, NOT biological shock
      const timeoutReason = result.reasons.find((r) => r.code === 'INFORMATION_DECAY_TIMEOUT');
      expect(timeoutReason).toBeDefined();
      expect(timeoutReason?.description).toContain('Critical observation timeout');

      // Recommended action must guide human verification
      expect(result.recommendedActions.some((a) => a.actionType === 'BEDSIDE_VISIT')).toBe(true);

      // Decoupling verification: zero physiological derangement, purely epistemic uncertainty
      const freshness = result.informationFreshness!;
      expect(freshness.isIntervalExceeded).toBe(true);
      expect(freshness.physiologicalRiskVsUncertainty.physiologicalScore).toBe(0);
      expect(freshness.physiologicalRiskVsUncertainty.uncertaintyScore).toBeGreaterThanOrEqual(50);
      expect(freshness.physiologicalRiskVsUncertainty.explanation).toContain('NOT assumed clinical deterioration');

      // MEWS is 0 (normal physiology)
      expect(result.mewsComponent).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // INTERACTION 3: ABNORMAL TREND + 4 HOURS WITHOUT TRUSTED OBSERVATION
  // → Significantly higher attention contribution (CRITICAL_REVIEW category)
  // --------------------------------------------------------------------------
  describe('Interaction 3: Abnormal Trend + 4 Hours Without Trusted Observation', () => {
    it('produces significantly higher attention contribution (CRITICAL_REVIEW) compounding unmonitored risk', () => {
      const staleTimestamp = now - 240 * 60 * 1000; // 4 hours ago

      // History showing rapid acceleration before vitals stopped being recorded
      const acceleratingObs: Observation[] = [
        {
          id: 'obs-hr-t1',
          patientId: 'PT-003',
          bedId: 'BED-03',
          timestamp: staleTimestamp - 60 * 60 * 1000, // 5 hours ago
          vitalType: 'HEART_RATE',
          value: 75,
          unit: 'BPM',
          confidence: 1.0,
          qualityStatus: 'TRUSTED',
          source: 'NURSE_MANUAL',
        },
        {
          id: 'obs-hr-t2',
          patientId: 'PT-003',
          bedId: 'BED-03',
          timestamp: staleTimestamp, // 4 hours ago (accelerated by 25 bpm in 1 hr)
          vitalType: 'HEART_RATE',
          value: 100,
          unit: 'BPM',
          confidence: 1.0,
          qualityStatus: 'TRUSTED',
          source: 'NURSE_MANUAL',
        },
        {
          id: 'obs-rr-t2',
          patientId: 'PT-003',
          bedId: 'BED-03',
          timestamp: staleTimestamp,
          vitalType: 'RESPIRATORY_RATE',
          value: 24, // Tachypnea (elevated)
          unit: 'BREATHS_PER_MINUTE',
          confidence: 1.0,
          qualityStatus: 'TRUSTED',
          source: 'NURSE_MANUAL',
        },
      ];

      const patient: PatientStateInput = {
        patientId: 'PT-003',
        bedNumber: '103',
        currentTimestamp: now,
        observations: acceleratingObs,
        lastTrustedObservationTimestamp: staleTimestamp,
      };

      const result = evaluateAttentionPriority(patient);

      // SIGNIFICANTLY HIGHER ATTENTION CONTRIBUTION (CRITICAL_REVIEW: >= 75)
      expect(result.score).toBeGreaterThanOrEqual(75);
      expect(result.category).toBe('CRITICAL_REVIEW');

      // Both clinical velocity/abnormality and information decay are captured
      expect(result.reasons.some((r) => r.code === 'INFORMATION_DECAY_TIMEOUT')).toBe(true);
      expect(result.reasons.some((r) => r.code === 'VELOCITY_HR_SPIKE' || r.code === 'MEWS_ESCALATION')).toBe(true);

      // Decoupling verification: couplingMultiplier > 1.0 amplifying the unobserved risk
      const freshness = result.informationFreshness!;
      expect(freshness.physiologicalRiskVsUncertainty.physiologicalScore).toBeGreaterThan(0);
      expect(freshness.physiologicalRiskVsUncertainty.couplingMultiplier).toBeGreaterThan(1.0);
      expect(freshness.physiologicalRiskVsUncertainty.explanation).toContain('Compounded risk escalation');
    });
  });

  // --------------------------------------------------------------------------
  // INTERACTION 4: LOW-CONFIDENCE CAMERA SIGNAL
  // → Measurement uncertainty increases, zero-fabrication holds
  // --------------------------------------------------------------------------
  describe('Interaction 4: Low-Confidence Camera Signal', () => {
    it('increases measurement uncertainty, updates camera timestamp, but never fabricates trusted vitals', () => {
      const priorTrustedTime = now - 30 * 60 * 1000; // 30 mins ago
      const cameraReadingTime = now; // Just now

      const priorObservations: Observation[] = [
        {
          id: 'obs-prior-hr',
          patientId: 'PT-004',
          bedId: 'BED-04',
          timestamp: priorTrustedTime,
          vitalType: 'HEART_RATE',
          value: 74,
          unit: 'BPM',
          confidence: 0.95,
          qualityStatus: 'TRUSTED',
          source: 'NURSE_MANUAL',
        },
      ];

      // Low-confidence camera reading arriving now
      const lowConfidenceCameraReading: SensorReading = {
        id: 'sensor-rppg-low',
        patientId: 'PT-004',
        bedId: 'BED-04',
        timestamp: cameraReadingTime,
        source: 'OPTICAL_RPPG',
        confidence: 0.35, // Poor confidence (e.g. motion or low light)
        measurementStatus: 'LOW_CONFIDENCE',
        measurement_status: 'LOW_CONFIDENCE',
        signalQuality: {
          sqiPercentage: 35,
          snrDb: 1.0,
          illuminationLux: 20,
          motionArtifactIndex: 0.85,
          state: 'UNRELIABLE',
          isUsable: false,
          faceDetected: true,
        },
        heartRate: 140, // Should NOT be accepted into trusted vitals!
      };

      const extraction = extractVitalsFromObservations(
        priorObservations,
        now,
        [lowConfidenceCameraReading]
      );

      // 1. Camera timestamp MUST update to camera event
      expect(extraction.lastCameraTimestamp).toBe(cameraReadingTime);

      // 2. ZERO-FABRICATION: lastTrustedTimestamp MUST NOT update with unconfident reading
      expect(extraction.lastTrustedTimestamp).toBe(priorTrustedTime);

      // 3. ZERO-FABRICATION: Latest trusted heart rate remains 74, NOT 140!
      expect(extraction.latest.HEART_RATE?.value).toBe(74);

      // 4. Latest confidence reflects the degraded sensor
      expect(extraction.latestConfidence).toBe(0.35);

      // Now evaluate with attention priority engine
      const patient: PatientStateInput = {
        patientId: 'PT-004',
        bedNumber: '104',
        currentTimestamp: now,
        observations: priorObservations,
        sensorReadings: [lowConfidenceCameraReading],
      };

      const result = evaluateAttentionPriority(patient);

      // Measurement uncertainty increases
      expect(result.uncertaintyIndex).toBeGreaterThan(0.50);
      expect(result.freshnessScore).toBeLessThan(50);

      // Reason explicitly flags sensor degradation
      expect(
        result.reasons.some(
          (r) => r.code === 'SENSOR_CONFIDENCE_DEGRADED'
        )
      ).toBe(true);

      // Multi-channel timestamps tracked accurately
      expect(result.lastCameraTimestamp).toBe(cameraReadingTime);
      expect(result.lastManualTimestamp).toBe(priorTrustedTime);
      expect(result.lastTrustedTimestamp).toBe(priorTrustedTime);
    });
  });

  // --------------------------------------------------------------------------
  // MULTI-CHANNEL TRACKING: MANUAL VS CAMERA VS TRUSTED
  // --------------------------------------------------------------------------
  describe('Multi-Channel Tracking (Manual, Camera, and Trusted)', () => {
    it('accurately distinguishes nurse manual, optical camera, and trusted timestamps', () => {
      const manualTime = now - 180 * 60 * 1000; // 3 hours ago
      const cameraTrustedTime = now - 60 * 60 * 1000; // 1 hour ago
      const cameraDegradedTime = now - 5 * 60 * 1000; // 5 mins ago

      const mixedObservations: Observation[] = [
        {
          id: 'obs-manual-1',
          patientId: 'PT-005',
          bedId: 'BED-05',
          timestamp: manualTime,
          vitalType: 'HEART_RATE',
          value: 78,
          unit: 'BPM',
          confidence: 1.0,
          qualityStatus: 'TRUSTED',
          source: 'NURSE_MANUAL',
        },
        {
          id: 'obs-camera-trusted',
          patientId: 'PT-005',
          bedId: 'BED-05',
          timestamp: cameraTrustedTime,
          vitalType: 'HEART_RATE',
          value: 80,
          unit: 'BPM',
          confidence: 0.90,
          qualityStatus: 'TRUSTED',
          source: 'OPTICAL_RPPG',
        },
      ];

      const lowConfidenceCameraReading: SensorReading = {
        id: 'sensor-camera-degraded',
        patientId: 'PT-005',
        bedId: 'BED-05',
        timestamp: cameraDegradedTime,
        source: 'OPTICAL_RPPG',
        confidence: 0.40,
        measurementStatus: 'LOW_CONFIDENCE',
        signalQuality: {
          sqiPercentage: 40,
          snrDb: 2.0,
          illuminationLux: 50,
          motionArtifactIndex: 0.7,
          state: 'DEGRADED',
          isUsable: false,
          faceDetected: true,
        },
      };

      const result = evaluateAttentionPriority({
        patientId: 'PT-005',
        bedNumber: '105',
        currentTimestamp: now,
        observations: mixedObservations,
        sensorReadings: [lowConfidenceCameraReading],
      });

      // Verification of distinct channels:
      expect(result.lastManualTimestamp).toBe(manualTime);
      expect(result.lastCameraTimestamp).toBe(cameraDegradedTime);
      // Last trusted timestamp must be the camera reading from 1h ago, NOT the degraded one!
      expect(result.lastTrustedTimestamp).toBe(cameraTrustedTime);
      expect(result.informationAgeMinutes).toBe(60);
    });
  });

  // --------------------------------------------------------------------------
  // EXPECTED MONITORING INTERVAL SENSITIVITY
  // --------------------------------------------------------------------------
  describe('Expected Monitoring Interval Sensitivity', () => {
    it('escalates uncertainty earlier when expectedMonitoringInterval is short (high-acuity)', () => {
      const twoHoursAgo = now - 120 * 60 * 1000;

      // Patient A: High-acuity ward with 60-minute monitoring interval
      const highAcuityDecay = evaluateInformationDecay(
        twoHoursAgo,
        now,
        DEFAULT_ATTENTION_CONFIG,
        ['obs-1'],
        { expectedMonitoringIntervalMinutes: 60, confidence: 1.0 }
      );

      // Patient B: General ward with 240-minute (4h) monitoring interval
      const generalWardDecay = evaluateInformationDecay(
        twoHoursAgo,
        now,
        DEFAULT_ATTENTION_CONFIG,
        ['obs-2'],
        { expectedMonitoringIntervalMinutes: 240, confidence: 1.0 }
      );

      // At 2 hours (120 min), Patient A is 2x overdue (ratio 2.0)
      expect(highAcuityDecay.informationFreshness.isIntervalExceeded).toBe(true);
      expect(highAcuityDecay.informationFreshness.freshnessScore).toBeLessThanOrEqual(30);
      expect(highAcuityDecay.informationFreshness.uncertaintyIndex).toBeGreaterThanOrEqual(0.70);
      expect(highAcuityDecay.informationFreshness.epistemicRiskCategory).toBe('CRITICALLY_EXPIRED');

      // At 2 hours (120 min), Patient B is at half-life (ratio 0.5)
      expect(generalWardDecay.informationFreshness.isIntervalExceeded).toBe(false);
      expect(generalWardDecay.informationFreshness.freshnessScore).toBeGreaterThanOrEqual(60);
      expect(generalWardDecay.informationFreshness.uncertaintyIndex).toBeLessThanOrEqual(0.40);
      expect(generalWardDecay.informationFreshness.epistemicRiskCategory).toBe('MONITORING_DUE');
    });
  });
});
