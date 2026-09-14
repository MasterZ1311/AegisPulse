import { describe, it, expect } from 'vitest';
import {
  DEFAULT_ATTENTION_CONFIG,
  evaluateAbnormality,
  evaluateBaselineDeviation,
  evaluateVelocityAndAcceleration,
  evaluatePersistence,
  evaluateInformationDecay,
  evaluateSignalConfidence,
  evaluateBiomarkersAndContext,
  evaluateMissingInformation,
} from '../src/attentionPriority';
import type { ExtractedVitals, ExtractedVitalHistory } from '../src/attentionPriority/types';
import type { LaboratoryResult, SignalQuality } from '@aegispulse/types';

describe('Attention Priority Deterministic Components', () => {
  const now = 1773471600000;

  // 1. Abnormality Component
  describe('evaluateAbnormality', () => {
    it('returns score 0 when all vitals are completely normal', () => {
      const vitals: ExtractedVitals = {
        HEART_RATE: { value: 72, timestamp: now, confidence: 1.0, qualityStatus: 'TRUSTED', sourceObservationId: 'obs-1' },
        RESPIRATORY_RATE: { value: 16, timestamp: now, confidence: 1.0, qualityStatus: 'TRUSTED', sourceObservationId: 'obs-2' },
        SYSTOLIC_BP: { value: 120, timestamp: now, confidence: 1.0, qualityStatus: 'TRUSTED', sourceObservationId: 'obs-3' },
        OXYGEN_SATURATION: { value: 98, timestamp: now, confidence: 1.0, qualityStatus: 'TRUSTED', sourceObservationId: 'obs-4' },
        SHOCK_INDEX: { value: 0.60, timestamp: now, confidence: 1.0, qualityStatus: 'TRUSTED', sourceObservationId: 'obs-5' },
      };

      const res = evaluateAbnormality(vitals, DEFAULT_ATTENTION_CONFIG, now, ['obs-1']);
      expect(res.normalizedContribution).toBe(0);
      expect(res.reasons.length).toBe(0);
      expect(res.provenance.algorithm).toBe('PHYSIOLOGICAL_ABNORMALITY_EVALUATOR');
    });

    it('detects severe occult shock index derangement (SI >= 1.10)', () => {
      const vitals: ExtractedVitals = {
        HEART_RATE: { value: 110, timestamp: now, confidence: 1.0, qualityStatus: 'TRUSTED', sourceObservationId: 'obs-1' },
        SYSTOLIC_BP: { value: 95, timestamp: now, confidence: 1.0, qualityStatus: 'TRUSTED', sourceObservationId: 'obs-2' },
        SHOCK_INDEX: { value: 1.16, timestamp: now, confidence: 1.0, qualityStatus: 'TRUSTED', sourceObservationId: 'obs-3' },
      };

      const res = evaluateAbnormality(vitals, DEFAULT_ATTENTION_CONFIG, now, ['obs-1', 'obs-2', 'obs-3']);
      expect(res.normalizedContribution).toBeGreaterThanOrEqual(75);
      expect(res.reasons.some((r) => r.code === 'SHOCK_INDEX_OCCULT')).toBe(true);
      expect(res.recommendedActions).toContain('ATTACH_CUFF');
    });
  });

  // 2. Baseline Deviation Component
  describe('evaluateBaselineDeviation', () => {
    it('detects stealth tachycardia relative to low baseline', () => {
      // Patient baseline HR is 58 bpm. Current is 95 bpm (+63.8% increase, but <100 absolute)
      const vitals: ExtractedVitals = {
        HEART_RATE: { value: 95, timestamp: now, confidence: 1.0, qualityStatus: 'TRUSTED', sourceObservationId: 'obs-1' },
      };
      const baseline = { heartRate: 58 };

      const res = evaluateBaselineDeviation(vitals, baseline, DEFAULT_ATTENTION_CONFIG, now, ['obs-1']);
      expect(res.normalizedContribution).toBeGreaterThanOrEqual(60);
      expect(res.reasons.some((r) => r.code === 'BASELINE_DEVIATION')).toBe(true);
      expect(res.explanation).toContain('+64% over baseline');
    });

    it('returns score 0 when vitals track baseline closely', () => {
      const vitals: ExtractedVitals = {
        HEART_RATE: { value: 74, timestamp: now, confidence: 1.0, qualityStatus: 'TRUSTED', sourceObservationId: 'obs-1' },
        RESPIRATORY_RATE: { value: 16, timestamp: now, confidence: 1.0, qualityStatus: 'TRUSTED', sourceObservationId: 'obs-2' },
      };
      const baseline = { heartRate: 72, respiratoryRate: 16 };

      const res = evaluateBaselineDeviation(vitals, baseline, DEFAULT_ATTENTION_CONFIG, now, ['obs-1']);
      expect(res.normalizedContribution).toBe(0);
    });
  });

  // 3. Velocity & Acceleration Component
  describe('evaluateVelocityAndAcceleration', () => {
    it('detects steep heart rate velocity (> 25 bpm/hr) with acceleration boost', () => {
      const history: ExtractedVitalHistory = {
        HEART_RATE: [
          { value: 70, timestamp: now - 30 * 60 * 1000, confidence: 1.0, qualityStatus: 'TRUSTED', sourceObservationId: 'obs-1' },
          { value: 80, timestamp: now - 15 * 60 * 1000, confidence: 1.0, qualityStatus: 'TRUSTED', sourceObservationId: 'obs-2' },
          { value: 98, timestamp: now, confidence: 1.0, qualityStatus: 'TRUSTED', sourceObservationId: 'obs-3' },
        ],
      };

      const res = evaluateVelocityAndAcceleration(history, DEFAULT_ATTENTION_CONFIG, now, ['obs-1', 'obs-2', 'obs-3']);
      expect(res.normalizedContribution).toBeGreaterThanOrEqual(75);
      expect(res.reasons.some((r) => r.code === 'VELOCITY_HR_SPIKE')).toBe(true);
      expect(res.explanation).toContain('ACCELERATING');
    });

    it('returns 0 score when vital rates of change are flat', () => {
      const history: ExtractedVitalHistory = {
        HEART_RATE: [
          { value: 72, timestamp: now - 30 * 60 * 1000, confidence: 1.0, qualityStatus: 'TRUSTED', sourceObservationId: 'obs-1' },
          { value: 73, timestamp: now, confidence: 1.0, qualityStatus: 'TRUSTED', sourceObservationId: 'obs-2' },
        ],
      };

      const res = evaluateVelocityAndAcceleration(history, DEFAULT_ATTENTION_CONFIG, now, ['obs-1', 'obs-2']);
      expect(res.normalizedContribution).toBe(0);
    });
  });

  // 4. Persistence Component
  describe('evaluatePersistence', () => {
    it('identifies transient spike (< 3 minutes) and dampens persistence factor', () => {
      const vitals: ExtractedVitals = {
        HEART_RATE: { value: 118, timestamp: now, confidence: 1.0, qualityStatus: 'DEGRADED', sourceObservationId: 'obs-2' },
      };
      const history: ExtractedVitalHistory = {
        HEART_RATE: [
          { value: 72, timestamp: now - 10 * 60 * 1000, confidence: 1.0, qualityStatus: 'TRUSTED', sourceObservationId: 'obs-1' },
          { value: 118, timestamp: now - 60 * 1000, confidence: 1.0, qualityStatus: 'DEGRADED', sourceObservationId: 'obs-2' },
          { value: 118, timestamp: now, confidence: 1.0, qualityStatus: 'DEGRADED', sourceObservationId: 'obs-3' },
        ],
      };
      const motionSignalQuality: SignalQuality = {
        sqiPercentage: 65,
        snrDb: 12,
        illuminationLux: 300,
        motionArtifactIndex: 0.6,
        state: 'DEGRADED',
        isUsable: true,
        faceDetected: true,
      };

      const res = evaluatePersistence(
        vitals,
        history,
        motionSignalQuality,
        DEFAULT_ATTENTION_CONFIG,
        now,
        ['obs-1', 'obs-2', 'obs-3']
      );

      expect(res.isTransientSpike).toBe(true);
      expect(res.persistenceFactor).toBeLessThanOrEqual(0.30);
      expect(res.sustainedDurationMinutes).toBeLessThanOrEqual(3.0);
    });

    it('identifies sustained decompensation (> 10 minutes) with persistence factor 1.0', () => {
      const vitals: ExtractedVitals = {
        HEART_RATE: { value: 125, timestamp: now, confidence: 1.0, qualityStatus: 'TRUSTED', sourceObservationId: 'obs-3' },
      };
      const history: ExtractedVitalHistory = {
        HEART_RATE: [
          { value: 120, timestamp: now - 15 * 60 * 1000, confidence: 1.0, qualityStatus: 'TRUSTED', sourceObservationId: 'obs-1' },
          { value: 122, timestamp: now - 10 * 60 * 1000, confidence: 1.0, qualityStatus: 'TRUSTED', sourceObservationId: 'obs-2' },
          { value: 125, timestamp: now, confidence: 1.0, qualityStatus: 'TRUSTED', sourceObservationId: 'obs-3' },
        ],
      };

      const res = evaluatePersistence(
        vitals,
        history,
        undefined,
        DEFAULT_ATTENTION_CONFIG,
        now,
        ['obs-1', 'obs-2', 'obs-3']
      );

      expect(res.isTransientSpike).toBe(false);
      expect(res.persistenceFactor).toBe(1.0);
      expect(res.componentScore.reasons.some((r) => r.code === 'PERSISTENT_DETERIORATION')).toBe(true);
    });
  });

  // 5. Information Decay Component
  describe('evaluateInformationDecay', () => {
    it('scores 0 for freshly verified observation', () => {
      const res = evaluateInformationDecay(now - 1000, now, DEFAULT_ATTENTION_CONFIG, ['obs-1']);
      expect(res.normalizedContribution).toBe(0);
      expect(res.reasons.length).toBe(0);
    });

    it('scores ~50 at half-life (120 minutes)', () => {
      const res = evaluateInformationDecay(now - 120 * 60 * 1000, now, DEFAULT_ATTENTION_CONFIG, ['obs-1']);
      expect(res.normalizedContribution).toBe(50);
    });

    it('scores >= 80 and flags timeout at 4 hours (240 minutes)', () => {
      const res = evaluateInformationDecay(now - 240 * 60 * 1000, now, DEFAULT_ATTENTION_CONFIG, ['obs-1']);
      expect(res.normalizedContribution).toBe(80);
      expect(res.reasons.some((r) => r.code === 'INFORMATION_DECAY_TIMEOUT')).toBe(true);
      expect(res.recommendedActions).toContain('BEDSIDE_VISIT');
    });
  });

  // 6. Signal Confidence Component
  describe('evaluateSignalConfidence', () => {
    it('produces score 0 and modulation 1.0 for trusted signal', () => {
      const trustedSignal: SignalQuality = {
        sqiPercentage: 92,
        snrDb: 22,
        illuminationLux: 500,
        motionArtifactIndex: 0.05,
        state: 'TRUSTED',
        isUsable: true,
        faceDetected: true,
      };

      const res = evaluateSignalConfidence(trustedSignal, 92, DEFAULT_ATTENTION_CONFIG, now, ['obs-1']);
      expect(res.componentScore.normalizedContribution).toBe(0);
      expect(res.confidenceModulationFactor).toBe(1.0);
    });

    it('discounts optical velocity and flags SENSOR_CONFIDENCE_DEGRADED when unreliable', () => {
      const badSignal: SignalQuality = {
        sqiPercentage: 35,
        snrDb: 5,
        illuminationLux: 50,
        motionArtifactIndex: 0.75,
        state: 'UNRELIABLE',
        isUsable: false,
        faceDetected: false,
      };

      const res = evaluateSignalConfidence(badSignal, 35, DEFAULT_ATTENTION_CONFIG, now, ['obs-1']);
      expect(res.componentScore.normalizedContribution).toBe(80);
      expect(res.confidenceModulationFactor).toBe(0.20); // Velocity discounted to 20%
      expect(res.componentScore.reasons.some((r) => r.code === 'SENSOR_CONFIDENCE_DEGRADED')).toBe(true);
      expect(res.componentScore.recommendedActions).toContain('ATTACH_CUFF');
    });
  });

  // 7. Biomarkers & Context Component
  describe('evaluateBiomarkersAndContext', () => {
    it('scores high and triggers LAB_HYPOXIA_LACTATE for elevated lactate', () => {
      const labs: LaboratoryResult[] = [
        {
          id: 'lab-1',
          patientId: 'P-1',
          timestamp: now,
          testCode: 'LACTATE',
          testName: 'Serum Lactate',
          value: 4.5,
          unit: 'MMOL_PER_L',
          referenceRange: { low: 0.5, high: 2.0 },
          isCritical: true,
          sourceLab: 'Central Lab',
        },
      ];

      const res = evaluateBiomarkersAndContext(labs, undefined, DEFAULT_ATTENTION_CONFIG, now, ['obs-1']);
      expect(res.normalizedContribution).toBeGreaterThanOrEqual(80);
      expect(res.reasons.some((r) => r.code === 'LAB_HYPOXIA_LACTATE')).toBe(true);
      expect(res.recommendedActions).toContain('RAPID_RESPONSE_TRIGGER');
    });

    it('detects severe leukocytosis (WBC 22.0)', () => {
      const labs: LaboratoryResult[] = [
        {
          id: 'lab-2',
          patientId: 'P-1',
          timestamp: now,
          testCode: 'WBC',
          testName: 'White Blood Cell Count',
          value: 22.0,
          unit: 'X10_9_PER_L',
          referenceRange: { low: 4.0, high: 11.0 },
          isCritical: true,
          sourceLab: 'Hematology Lab',
        },
      ];

      const res = evaluateBiomarkersAndContext(labs, undefined, DEFAULT_ATTENTION_CONFIG, now, ['obs-1']);
      expect(res.reasons.some((r) => r.code === 'LAB_LEUKOCYTOSIS')).toBe(true);
    });
  });

  // 8. Missing Information Component
  describe('evaluateMissingInformation', () => {
    it('scores 0 when complete vital set is present', () => {
      const vitals: ExtractedVitals = {
        HEART_RATE: { value: 70, timestamp: now, confidence: 1.0, qualityStatus: 'TRUSTED', sourceObservationId: 'obs-1' },
        RESPIRATORY_RATE: { value: 16, timestamp: now, confidence: 1.0, qualityStatus: 'TRUSTED', sourceObservationId: 'obs-2' },
        SYSTOLIC_BP: { value: 120, timestamp: now, confidence: 1.0, qualityStatus: 'TRUSTED', sourceObservationId: 'obs-3' },
        OXYGEN_SATURATION: { value: 98, timestamp: now, confidence: 1.0, qualityStatus: 'TRUSTED', sourceObservationId: 'obs-4' },
        BODY_TEMPERATURE: { value: 37.0, timestamp: now, confidence: 1.0, qualityStatus: 'TRUSTED', sourceObservationId: 'obs-5' },
      };

      const res = evaluateMissingInformation(vitals, DEFAULT_ATTENTION_CONFIG, now, ['obs-1']);
      expect(res.normalizedContribution).toBe(0);
      expect(res.reasons.length).toBe(0);
    });

    it('penalizes missing blood pressure and respiratory rate with MISSING_VITAL_SIGNS reason', () => {
      const vitals: ExtractedVitals = {
        HEART_RATE: { value: 70, timestamp: now, confidence: 1.0, qualityStatus: 'TRUSTED', sourceObservationId: 'obs-1' },
      };

      const res = evaluateMissingInformation(vitals, DEFAULT_ATTENTION_CONFIG, now, ['obs-1']);
      expect(res.normalizedContribution).toBeGreaterThanOrEqual(50);
      expect(res.reasons.some((r) => r.code === 'MISSING_VITAL_SIGNS')).toBe(true);
      expect(res.recommendedActions).toContain('ATTACH_CUFF');
    });
  });
});
