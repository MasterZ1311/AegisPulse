import { describe, it, expect } from 'vitest';
import {
  AttentionPriorityEngine,
  type PatientStateInput,
} from '../src/index';
import type { SensorReading } from '@aegispulse/types';

describe('Clinical Engine Uncertainty & Agnostic Sensor Ingestion Suite', () => {
  const engine = new AttentionPriorityEngine();
  const baseTimestamp = 1773471600000;

  describe('1. Agnostic Sensor Ingestion', () => {
    it('scores identically whether measurements come from simulator, optical rppg, wearable, bedside, or future sensor', () => {
      const sources = [
        'SIMULATION',
        'OPTICAL_RPPG',
        'WEBCAM',
        'WEARABLE',
        'BEDSIDE_DEVICE',
        'FUTURE_SENSOR',
      ] as const;

      const results = sources.map((source) => {
        const reading: SensorReading = {
          id: `sr-${source}-01`,
          patientId: 'PAT-AGNOSTIC',
          bedId: 'BED-01',
          source: source as any,
          timestamp: baseTimestamp,
          confidence: 0.95,
          signalQuality: {
            sqiPercentage: 92,
            snrDb: 6.8,
            illuminationLux: 350,
            motionArtifactIndex: 0.03,
            state: 'TRUSTED',
            isUsable: true,
            faceDetected: true,
          },
          measurementStatus: 'VALID',
          heartRate: 76,
          respiratoryRate: 16,
        };

        const state: PatientStateInput = {
          patientId: 'PAT-AGNOSTIC',
          bedNumber: '101',
          currentTimestamp: baseTimestamp,
          observations: [],
          sensorReadings: [reading],
          baseline: { heartRate: 72, respiratoryRate: 16 },
        };

        return engine.evaluate(state);
      });

      // The clinical platform must not care which sensor it came from: scores and categories must match!
      const firstScore = results[0].score;
      const firstCategory = results[0].category;

      for (let i = 1; i < results.length; i++) {
        expect(results[i].score).toBe(firstScore);
        expect(results[i].category).toBe(firstCategory);
      }
    });
  });

  describe('2. Understanding Uncertainty (LOW_CONFIDENCE)', () => {
    it('does NOT fabricate physiological measurements when confidence is insufficient', () => {
      const lowConfidenceReading: SensorReading = {
        id: 'sr-uncertain-01',
        patientId: 'PAT-UNCERTAIN',
        source: 'OPTICAL_RPPG',
        timestamp: baseTimestamp,
        confidence: 0.30,
        signalQuality: {
          sqiPercentage: 28,
          snrDb: -1.2,
          illuminationLux: 200,
          motionArtifactIndex: 0.65,
          state: 'UNRELIABLE',
          isUsable: false,
          faceDetected: true,
          reason: 'Severe motion artifact',
        },
        measurementStatus: 'LOW_CONFIDENCE',
        measurement_status: 'LOW_CONFIDENCE',
        // Invariant: vitals are NOT fabricated
        heartRate: undefined,
        respiratoryRate: undefined,
      };

      const state: PatientStateInput = {
        patientId: 'PAT-UNCERTAIN',
        bedNumber: '102',
        currentTimestamp: baseTimestamp,
        observations: [],
        sensorReadings: [lowConfidenceReading],
      };

      const result = engine.evaluate(state);

      // Signal confidence component must reflect degradation
      expect(result.rankInputs.signalConfidence.normalizedContribution).toBeGreaterThanOrEqual(45);
      expect(
        result.rankInputs.signalConfidence.reasons.some(
          (r) => r.code === 'SENSOR_CONFIDENCE_DEGRADED'
        )
      ).toBe(true);

      // Must recommend manual vitals verification rather than blind medical treatment
      expect(
        result.recommendedActions.some(
          (a) => a.actionType === 'MANUAL_VITALS_RECHECK' || a.actionType === 'ATTACH_CUFF'
        )
      ).toBe(true);
    });

    it('dampens velocity score to prevent false code alarms when sensor confidence is low', () => {
      // Historical readings showing rising heart rate
      const historicalReadings: SensorReading[] = [
        {
          id: 'sr-h1',
          patientId: 'PAT-VEL-01',
          source: 'OPTICAL_RPPG',
          timestamp: baseTimestamp - 30 * 60 * 1000,
          confidence: 0.95,
          signalQuality: {
            sqiPercentage: 90,
            snrDb: 6.0,
            illuminationLux: 350,
            motionArtifactIndex: 0.05,
            state: 'TRUSTED',
            isUsable: true,
            faceDetected: true,
          },
          measurementStatus: 'VALID',
          heartRate: 70,
        },
        {
          id: 'sr-h2',
          patientId: 'PAT-VEL-01',
          source: 'OPTICAL_RPPG',
          timestamp: baseTimestamp - 10 * 60 * 1000,
          confidence: 0.95,
          signalQuality: {
            sqiPercentage: 90,
            snrDb: 6.0,
            illuminationLux: 350,
            motionArtifactIndex: 0.05,
            state: 'TRUSTED',
            isUsable: true,
            faceDetected: true,
          },
          measurementStatus: 'VALID',
          heartRate: 90,
        },
      ];

      // Evaluation with high confidence
      const trustedState: PatientStateInput = {
        patientId: 'PAT-VEL-01',
        bedNumber: '103',
        currentTimestamp: baseTimestamp,
        observations: [],
        sensorReadings: historicalReadings,
        latestSignalQuality: {
          sqiPercentage: 95,
          snrDb: 7.0,
          illuminationLux: 350,
          motionArtifactIndex: 0.02,
          state: 'TRUSTED',
          isUsable: true,
          faceDetected: true,
        },
      };

      const trustedResult = engine.evaluate(trustedState);

      // Evaluation with degraded confidence (e.g. motion/lighting drop)
      const degradedState: PatientStateInput = {
        ...trustedState,
        latestSignalQuality: {
          sqiPercentage: 30,
          snrDb: 0.5,
          illuminationLux: 80,
          motionArtifactIndex: 0.55,
          state: 'UNRELIABLE',
          isUsable: false,
          faceDetected: true,
        },
      };

      const degradedResult = engine.evaluate(degradedState);

      // The degraded velocity contribution must be strictly less than or equal to trusted velocity
      // (discounted to prevent false emergency codes during fidgeting)
      expect(degradedResult.rankInputs.velocity.weightedContribution).toBeLessThan(
        trustedResult.rankInputs.velocity.weightedContribution
      );
    });

    it('accumulates information decay when recent readings are all LOW_CONFIDENCE', () => {
      const now = baseTimestamp + 45 * 60 * 1000; // 45 minutes later

      // Patient has 1 trusted reading at shift start, and all subsequent optical frames are LOW_CONFIDENCE
      const state: PatientStateInput = {
        patientId: 'PAT-DECAY-01',
        bedNumber: '104',
        currentTimestamp: now,
        observations: [],
        sensorReadings: [
          {
            id: 'sr-old',
            patientId: 'PAT-DECAY-01',
            source: 'OPTICAL_RPPG',
            timestamp: baseTimestamp,
            confidence: 0.95,
            signalQuality: {
              sqiPercentage: 90,
              snrDb: 6.0,
              illuminationLux: 350,
              motionArtifactIndex: 0.05,
              state: 'TRUSTED',
              isUsable: true,
              faceDetected: true,
            },
            measurementStatus: 'VALID',
            heartRate: 72,
          },
          {
            id: 'sr-recent-low',
            patientId: 'PAT-DECAY-01',
            source: 'OPTICAL_RPPG',
            timestamp: now - 5000,
            confidence: 0.20,
            signalQuality: {
              sqiPercentage: 15,
              snrDb: -2.0,
              illuminationLux: 50,
              motionArtifactIndex: 0.80,
              state: 'UNRELIABLE',
              isUsable: false,
              faceDetected: false,
            },
            measurementStatus: 'LOW_CONFIDENCE',
            measurement_status: 'LOW_CONFIDENCE',
            // NO vitals fabricated!
          },
        ],
      };

      const result = engine.evaluate(state);

      // Information decay must be recognized because 45 minutes elapsed without trusted data
      expect(result.rankInputs.informationDecay.normalizedContribution).toBeGreaterThan(0);
      expect(result.informationAgeMinutes).toBeGreaterThanOrEqual(40);
    });
  });
});
