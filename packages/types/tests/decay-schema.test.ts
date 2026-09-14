import { describe, it, expect } from 'vitest';
import {
  InformationFreshnessSchema,
  validateInformationFreshness,
  type InformationFreshness,
} from '../src/index';

describe('Information Freshness & Decay Schema Suite', () => {
  const now = Date.now();

  it('validates a fresh, high-confidence observation state', () => {
    const freshState: InformationFreshness = {
      lastTrustedTimestamp: now - 5 * 60 * 1000, // 5 minutes ago
      lastManualTimestamp: now - 60 * 60 * 1000,
      lastCameraTimestamp: now - 5 * 1000,
      observationAgeMinutes: 5,
      confidence: 0.95,
      expectedMonitoringIntervalMinutes: 240,
      isIntervalExceeded: false,
      freshnessScore: 98,
      uncertaintyIndex: 0.05,
      decayScore: 2,
      epistemicRiskCategory: 'FRESH',
      physiologicalRiskVsUncertainty: {
        physiologicalScore: 10,
        uncertaintyScore: 2,
        compoundedScore: 10,
        couplingMultiplier: 1.0,
        explanation: 'Fresh telemetry: observations are current and physiologically stable.',
      },
      stateDescription: 'Telemetry is fresh and trusted (age: 5m).',
    };

    const result = validateInformationFreshness(freshState);
    expect(result.success).toBe(true);
  });

  it('validates a stale observation state with high uncertainty', () => {
    const staleState: InformationFreshness = {
      lastTrustedTimestamp: now - 250 * 60 * 1000, // 250 minutes ago (> 4 hours)
      observationAgeMinutes: 250,
      confidence: 0.20,
      expectedMonitoringIntervalMinutes: 240,
      isIntervalExceeded: true,
      freshnessScore: 28,
      uncertaintyIndex: 0.72,
      decayScore: 72,
      epistemicRiskCategory: 'STALE',
      physiologicalRiskVsUncertainty: {
        physiologicalScore: 0,
        uncertaintyScore: 72,
        compoundedScore: 35,
        couplingMultiplier: 1.0,
        explanation: 'Uncertainty elevated due to 4h+ gap without trusted vitals. Baseline normal.',
      },
      stateDescription: 'Observation age (4h 10m) exceeds monitoring interval (4h). High epistemic uncertainty.',
    };

    const result = validateInformationFreshness(staleState);
    expect(result.success).toBe(true);
  });

  it('rejects negative observation age or invalid bounds', () => {
    const invalidAge = {
      observationAgeMinutes: -10, // Invalid!
      confidence: 0.9,
      expectedMonitoringIntervalMinutes: 240,
      isIntervalExceeded: false,
      freshnessScore: 90,
      uncertaintyIndex: 0.1,
      decayScore: 10,
      epistemicRiskCategory: 'FRESH',
      physiologicalRiskVsUncertainty: {
        physiologicalScore: 0,
        uncertaintyScore: 10,
        compoundedScore: 0,
        couplingMultiplier: 1.0,
        explanation: 'Test',
      },
      stateDescription: 'Test',
    };

    const result = InformationFreshnessSchema.safeParse(invalidAge);
    expect(result.success).toBe(false);
  });
});
