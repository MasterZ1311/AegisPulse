import { describe, it, expect, beforeEach } from 'vitest';
import type {
  AttentionPriorityCategory,
  AttentionReasonCode,
  AttentionPolicyEvent,
} from '@aegispulse/types';
import type { AttentionPriorityResult } from '../src/attentionPriority/types';
import {
  AttentionEventPolicyEngine,
  PolicyMetricsCollector,
  DEFAULT_EVENT_POLICY_CONFIG,
} from '../src/eventPolicy';

function createMockApsResult(params: {
  patientId?: string;
  bedNumber?: string;
  score: number;
  timestamp: number;
  category?: AttentionPriorityCategory;
  reasons?: AttentionReasonCode[];
  mews?: number;
  qsofa?: number;
  signalConfidence?: number;
}): AttentionPriorityResult {
  const score = params.score;
  let category: AttentionPriorityCategory = 'LOW';
  if (score >= 75) category = 'CRITICAL_REVIEW';
  else if (score >= 55) category = 'EVALUATE';
  else if (score >= 30) category = 'WATCH';

  return {
    id: `aps-${params.patientId ?? 'p1'}-${params.timestamp}`,
    patientId: params.patientId ?? 'p1',
    bedNumber: params.bedNumber ?? 'BED-01',
    score,
    apsScore: score,
    category: params.category ?? category,
    rankInputs: {} as any,
    reasons: (params.reasons ?? ['PERSISTENT_DETERIORATION']).map((code) => ({
      code,
      title: code,
      description: code,
      severity: 'WARNING',
      category: 'PHYSIOLOGICAL_ACUITY',
    })),
    recommendedActions: [],
    recommendedAction: 'Bedside nurse evaluation recommended.',
    confidence: params.signalConfidence ?? 100,
    signalConfidence: params.signalConfidence ?? 100,
    timestamp: params.timestamp,
    calculatedAt: params.timestamp,
    wardRank: 1,
    velocityScore: 0,
    decayScore: 0,
    mewsComponent: params.mews ?? 0,
    biomarkerComponent: 0,
    informationAgeMinutes: 0,
    freshnessScore: 100,
    uncertaintyIndex: 0,
    expectedMonitoringIntervalMinutes: 240,
    provenance: {
      derivedAt: params.timestamp,
      algorithm: 'TEST',
      algorithmVersion: '1.0.0',
      sourceObservationIds: [],
      confidence: 1.0,
      parameters: {},
    },
  };
}

describe('Attention & Notification Event Policy Engine', () => {
  let engine: AttentionEventPolicyEngine;
  let collector: PolicyMetricsCollector;

  beforeEach(() => {
    engine = new AttentionEventPolicyEngine();
    collector = new PolicyMetricsCollector();
  });

  describe('1. Six-State Priority Change Classification', () => {
    it('distinguishes NEW_PRIORITY on confirmed initial entry into elevated category', () => {
      const baseTime = 1700000000000;
      const patientId = 'p-new';

      // t=0: Baseline LOW
      const r0 = createMockApsResult({ patientId, score: 10, timestamp: baseTime });
      const ev0 = engine.evaluate(r0);
      expect(ev0.classification).toBe('PERSISTENT_PRIORITY');
      expect(ev0.action).toBe('SUPPRESS');

      // t=0s: Jumps to WATCH (score 35). Needs 45s persistence
      const r1 = createMockApsResult({ patientId, score: 35, timestamp: baseTime + 1000 });
      const ev1 = engine.evaluate(r1);
      expect(ev1.classification).toBe('UNCONFIRMED');
      expect(ev1.action).toBe('HOLD_UNCONFIRMED');
      expect(ev1.suppressionReason).toBe('PERSISTENCE_PENDING');

      // t=46s: Persistence window satisfied (45s) -> Confirmed NEW_PRIORITY
      const r2 = createMockApsResult({ patientId, score: 38, timestamp: baseTime + 47000 });
      const ev2 = engine.evaluate(r2);
      expect(ev2.classification).toBe('NEW_PRIORITY');
      expect(ev2.action).toBe('EMIT_ALERT');
      expect(ev2.alert).toBeDefined();
      expect(ev2.alert?.status).toBe('ACTIVE');
      expect(ev2.alert?.severity).toBe('WARNING');
    });

    it('distinguishes RISING_PRIORITY when escalating from WATCH to CRITICAL_REVIEW', () => {
      const baseTime = 1700000000000;
      const patientId = 'p-rising';

      // Confirmed in WATCH
      engine.evaluate(createMockApsResult({ patientId, score: 35, timestamp: baseTime }));
      engine.evaluate(createMockApsResult({ patientId, score: 35, timestamp: baseTime + 50000 }));

      // Jumps to CRITICAL_REVIEW (score 78). First observation is UNCONFIRMED
      const ev1 = engine.evaluate(
        createMockApsResult({ patientId, score: 78, timestamp: baseTime + 55000 })
      );
      expect(ev1.classification).toBe('UNCONFIRMED');
      expect(ev1.action).toBe('HOLD_UNCONFIRMED');

      // After 45s persistence -> RISING_PRIORITY with tier ESCALATE
      const ev2 = engine.evaluate(
        createMockApsResult({ patientId, score: 80, timestamp: baseTime + 105000 })
      );
      expect(ev2.classification).toBe('RISING_PRIORITY');
      expect(ev2.action).toBe('ESCALATE');
      expect(ev2.alert?.severity).toBe('CRITICAL');
    });

    it('distinguishes PERSISTENT_PRIORITY and suppresses duplicate alarms during cooldown', () => {
      const baseTime = 1700000000000;
      const patientId = 'p-persistent';

      // Establish confirmed EVALUATE
      engine.evaluate(createMockApsResult({ patientId, score: 60, timestamp: baseTime }));
      engine.evaluate(createMockApsResult({ patientId, score: 62, timestamp: baseTime + 50000 }));

      // Immediate follow-up cycle 10s later (still in 3m cooldown)
      const evFollowup = engine.evaluate(
        createMockApsResult({ patientId, score: 61, timestamp: baseTime + 60000 })
      );
      expect(evFollowup.classification).toBe('PERSISTENT_PRIORITY');
      expect(evFollowup.action).toBe('SUPPRESS');
      expect(evFollowup.suppressionReason).toBe('COOLDOWN_ACTIVE');
    });

    it('distinguishes UNCONFIRMED and suppresses transient spikes', () => {
      const baseTime = 1700000000000;
      const patientId = 'p-unconfirmed';

      // Score spikes to 80 for only 15 seconds then drops back to 20
      const ev1 = engine.evaluate(
        createMockApsResult({ patientId, score: 80, timestamp: baseTime })
      );
      expect(ev1.classification).toBe('UNCONFIRMED');
      expect(ev1.action).toBe('HOLD_UNCONFIRMED');

      const ev2 = engine.evaluate(
        createMockApsResult({ patientId, score: 80, timestamp: baseTime + 15000 })
      );
      expect(ev2.classification).toBe('UNCONFIRMED');
      expect(ev2.action).toBe('HOLD_UNCONFIRMED');

      // Drops back to 20 before persistence (45s) met
      const ev3 = engine.evaluate(
        createMockApsResult({ patientId, score: 20, timestamp: baseTime + 25000 })
      );
      expect(ev3.classification).toBe('PERSISTENT_PRIORITY');
      expect(ev3.currentCategory).toBe('LOW');
      expect(ev3.action).toBe('SUPPRESS');
    });

    it('distinguishes RESOLVED after stabilization period below lower hysteresis threshold', () => {
      const baseTime = 1700000000000;
      const patientId = 'p-resolve';

      // Confirmed in WATCH (entry is 30, lower hysteresis threshold is 30 - 6 = 24)
      engine.evaluate(createMockApsResult({ patientId, score: 35, timestamp: baseTime }));
      engine.evaluate(createMockApsResult({ patientId, score: 35, timestamp: baseTime + 50000 }));

      // Patient recovers to score 18 (< 24). First drop initiates de-escalation hold (120s)
      const evDrop = engine.evaluate(
        createMockApsResult({ patientId, score: 18, timestamp: baseTime + 60000 })
      );
      expect(evDrop.classification).toBe('UNCONFIRMED');
      expect(evDrop.action).toBe('SUPPRESS');
      expect(evDrop.suppressionReason).toBe('HYSTERESIS_HOLD');

      // 60s later: still stabilizing
      const evMid = engine.evaluate(
        createMockApsResult({ patientId, score: 16, timestamp: baseTime + 120000 })
      );
      expect(evMid.action).toBe('SUPPRESS');
      expect(evMid.suppressionReason).toBe('HYSTERESIS_HOLD');

      // 125s later: de-escalation hold (120s) satisfied -> RESOLVED!
      const evResolved = engine.evaluate(
        createMockApsResult({ patientId, score: 15, timestamp: baseTime + 185000 })
      );
      expect(evResolved.classification).toBe('RESOLVED');
      expect(evResolved.action).toBe('RESOLVE');
      expect(evResolved.currentCategory).toBe('LOW');
    });

    it('distinguishes SIGNAL_FAILURE and emits technical alert without false medical escalation', () => {
      const baseTime = 1700000000000;
      const patientId = 'p-signal';

      // Optical confidence drops to 0.20 (below 0.35 threshold)
      const evSignal = engine.evaluate(
        createMockApsResult({ patientId, score: 10, timestamp: baseTime, signalConfidence: 20 }),
        { signalStatus: 'LOW_CONFIDENCE' }
      );

      expect(evSignal.classification).toBe('SIGNAL_FAILURE');
      expect(evSignal.action).toBe('EMIT_ALERT');
      expect(evSignal.alert?.code).toBe('SENSOR_CONFIDENCE_DEGRADED');
      expect(evSignal.alert?.severity).toBe('WARNING');
      expect(evSignal.alert?.title).toContain('Telemetry Signal Quality Degraded');
    });
  });

  describe('2. Dual-Threshold Hysteresis & Rapid Boundary Oscillation (Anti-Spam)', () => {
    it('prevents alarm flapping when score rapidly oscillates around category boundary (53 <-> 57)', () => {
      const baseTime = 1700000000000;
      const patientId = 'p-jitter';

      // Use engine with 1-hour re-alert interval to isolate boundary oscillation from periodic reminders
      const jitterEngine = new AttentionEventPolicyEngine({
        reAlertIntervalMs: 3_600_000,
      });

      // First establish confirmed EVALUATE at score 58 (entry 55)
      jitterEngine.evaluate(createMockApsResult({ patientId, score: 58, timestamp: baseTime }));
      const confirmedEv = jitterEngine.evaluate(
        createMockApsResult({ patientId, score: 58, timestamp: baseTime + 50000 })
      );
      collector.record(confirmedEv);
      expect(confirmedEv.action).toBe('EMIT_ALERT');

      // Now oscillate: 53 (raw WATCH) <-> 57 (raw EVALUATE) every 5 seconds for 30 minutes (360 samples)
      // Lower hysteresis threshold for EVALUATE is 55 - 6 = 49.
      // Since 53 >= 49, patient is in hysteresis hold and remains in EVALUATE with zero flapping!
      for (let i = 1; i <= 360; i++) {
        const currentTime = baseTime + 50000 + i * 5000;
        const oscillatingScore = i % 2 === 0 ? 53 : 57;
        const ev = jitterEngine.evaluate(
          createMockApsResult({ patientId, score: oscillatingScore, timestamp: currentTime })
        );
        collector.record(ev);

        // Every oscillating evaluation must be suppressed, NEVER emitting new alerts
        expect(ev.action).toBe('SUPPRESS');
      }

      const metrics = collector.getMetrics();
      // Only the initial confirmed alert should have been emitted!
      expect(metrics.alertCount).toBe(1);
      expect(metrics.repeatedAlerts).toBe(0);
      expect(metrics.falseEscalations).toBe(0);
      // At least 180 oscillations were specifically caught by HYSTERESIS_HOLD
      expect(metrics.flappingEventsAvoided).toBeGreaterThanOrEqual(180);
      // Suppression ratio across the 361 evaluations must exceed 99%
      expect(metrics.suppressionRatio).toBeGreaterThanOrEqual(0.99);
    });
  });

  describe('3. Clinical Fast-Path Bypass for Acute Life Threats', () => {
    it('bypasses persistence delay on acute life-threat floor (APS >= 85)', () => {
      const baseTime = 1700000000000;
      const patientId = 'p-crash';

      // Hyper-acute deterioration: score 92
      const ev = engine.evaluate(
        createMockApsResult({ patientId, score: 92, timestamp: baseTime })
      );

      // Fast-path triggers immediately: 0s delay, EMIT_ALERT
      expect(ev.classification).toBe('NEW_PRIORITY');
      expect(ev.action).toBe('EMIT_ALERT');
      expect(ev.alert?.severity).toBe('CRITICAL');
      expect(ev.metadata?.isFastPath).toBe(true);
    });

    it('bypasses persistence delay on qSOFA escalation', () => {
      const baseTime = 1700000000000;
      const patientId = 'p-sepsis';

      // qSOFA positive with score 76
      const ev = engine.evaluate(
        createMockApsResult({
          patientId,
          score: 76,
          timestamp: baseTime,
          reasons: ['QSOFA_ESCALATION'],
        })
      );

      expect(ev.action).toBe('EMIT_ALERT');
      expect(ev.metadata?.isFastPath).toBe(true);
    });
  });

  describe('4. Staff Acknowledgement & Cooldown Protection', () => {
    it('silences repeated alerts after staff acknowledgement for the grace period', () => {
      const baseTime = 1700000000000;
      const patientId = 'p-ack';

      // Trigger confirmed alert
      engine.evaluate(createMockApsResult({ patientId, score: 65, timestamp: baseTime }));
      const alertEv = engine.evaluate(
        createMockApsResult({ patientId, score: 65, timestamp: baseTime + 50000 })
      );
      const alertId = alertEv.alert!.id;

      // Staff nurse acknowledges alert at t=60s
      const ackEv = engine.acknowledgeAlert(
        patientId,
        alertId,
        'nurse-sarah',
        baseTime + 60000,
        900000 // 15m grace period
      );
      expect(ackEv).not.toBeNull();
      expect(ackEv?.action).toBe('ACKNOWLEDGE');

      // Subsequent evaluation at t=120s is silenced under ACKNOWLEDGED_SILENT
      const evSilenced = engine.evaluate(
        createMockApsResult({ patientId, score: 66, timestamp: baseTime + 120000 })
      );
      expect(evSilenced.classification).toBe('PERSISTENT_PRIORITY');
      expect(evSilenced.action).toBe('SUPPRESS');
      expect(evSilenced.suppressionReason).toBe('ACKNOWLEDGED_SILENT');
    });

    it('overrides acknowledgement silence if patient experiences an acute higher tier escalation', () => {
      const baseTime = 1700000000000;
      const patientId = 'p-ack-override';

      // Confirmed in WATCH (score 35) and acknowledged
      engine.evaluate(createMockApsResult({ patientId, score: 35, timestamp: baseTime }));
      const alertEv = engine.evaluate(
        createMockApsResult({ patientId, score: 35, timestamp: baseTime + 50000 })
      );
      engine.acknowledgeAlert(patientId, alertEv.alert!.id, 'nurse-sarah', baseTime + 60000);

      // Acute surge into CRITICAL_REVIEW (score 88, fast-path)
      const evCrash = engine.evaluate(
        createMockApsResult({ patientId, score: 88, timestamp: baseTime + 70000 })
      );

      // Must break through the acknowledgement and fire emergency alert
      expect(evCrash.classification).toBe('RISING_PRIORITY');
      expect(evCrash.action).toBe('ESCALATE');
      expect(evCrash.alert?.severity).toBe('CRITICAL');
    });
  });

  describe('5. Quantitative Policy Metrics Test Harness', () => {
    it('measures alert count, repeated alerts, escalation delay, false escalations, and suppression ratio', () => {
      const baseTime = 1700000000000;
      const patientId = 'p-benchmark';

      // Scenario Step 1: Baseline 10 evaluations (score 15, LOW)
      for (let i = 0; i < 10; i++) {
        const ev = engine.evaluate(
          createMockApsResult({ patientId, score: 15, timestamp: baseTime + i * 5000 })
        );
        collector.record(ev);
      }

      // Scenario Step 2: Transient cough spike for 15 seconds (score 75)
      for (let i = 10; i < 13; i++) {
        const ev = engine.evaluate(
          createMockApsResult({ patientId, score: 75, timestamp: baseTime + i * 5000 })
        );
        collector.record(ev, true); // Marked as known transient spike
      }

      // Scenario Step 3: Returns to baseline for 5 evaluations
      for (let i = 13; i < 18; i++) {
        const ev = engine.evaluate(
          createMockApsResult({ patientId, score: 15, timestamp: baseTime + i * 5000 })
        );
        collector.record(ev);
      }

      // Scenario Step 4: True sustained deterioration starting at t=18*5s = 90s
      // Score jumps to 65 (EVALUATE) and stays for 60 seconds (12 samples)
      for (let i = 18; i < 30; i++) {
        const ev = engine.evaluate(
          createMockApsResult({ patientId, score: 65, timestamp: baseTime + i * 5000 })
        );
        collector.record(ev);
      }

      const metrics = collector.getMetrics();
      const classifications = collector.getClassificationBreakdown();
      const suppressions = collector.getSuppressionBreakdown();

      // Assertions on the 5 user-requested dimensions:
      // 1. Alert Count: exactly 1 confirmed alert for the sustained deterioration
      expect(metrics.alertCount).toBe(1);

      // 2. Repeated Alerts: 0 duplicate alerts fired while patient remained in EVALUATE
      expect(metrics.repeatedAlerts).toBe(0);

      // 3. Escalation Delay: persistence required 45s. Measured delay must be ~45s (45,000ms)
      expect(metrics.meanEscalationDelayMs).toBeGreaterThanOrEqual(45000);
      expect(metrics.meanEscalationDelayMs).toBeLessThanOrEqual(50000);

      // 4. False Escalation: strictly 0 (transient cough spike did not trigger an alert)
      expect(metrics.falseEscalations).toBe(0);

      // 5. Suppression Behaviour: > 90% of raw evaluation cycles were safely suppressed
      expect(metrics.suppressionRatio).toBeGreaterThanOrEqual(0.90);

      // Breakdown verifications
      expect(classifications.NEW_PRIORITY).toBe(1);
      expect(classifications.UNCONFIRMED).toBeGreaterThan(0);
      expect(suppressions.PERSISTENCE_PENDING).toBeGreaterThan(0);
      expect(suppressions.COOLDOWN_ACTIVE).toBeGreaterThan(0);
    });
  });
});
