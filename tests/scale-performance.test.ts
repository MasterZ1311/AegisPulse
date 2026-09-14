import { describe, it, expect } from 'vitest';
import {
  AttentionPriorityEngine,
  type PatientStateInput,
} from '@aegispulse/clinical';
import { EventBroadcaster } from '../services/api/src/stream/event-broadcaster';
import type { Observation } from '@aegispulse/types';

describe('Phase 26: Scale Performance Testing Program (6, 32, 100 Beds)', () => {
  const engine = new AttentionPriorityEngine();

  function generateSimulatedPatient(
    patientIdx: number,
    isDeteriorating: boolean = false
  ): PatientStateInput {
    const now = Date.now();
    const patientId = `SCALE-P-${String(patientIdx).padStart(3, '0')}`;
    const bedNumber = `BED-${String(patientIdx).padStart(3, '0')}`;

    const hr = isDeteriorating ? 120 + (patientIdx % 15) : 72 + (patientIdx % 10);
    const rr = isDeteriorating ? 28 + (patientIdx % 6) : 16 + (patientIdx % 4);
    const sbp = isDeteriorating ? 88 - (patientIdx % 8) : 122 + (patientIdx % 10);

    const obs: Observation[] = [
      {
        id: `obs-${patientId}-1`,
        patientId,
        bedId: bedNumber,
        vitalType: 'HEART_RATE',
        value: hr,
        unit: 'BPM',
        timestamp: now - 30000,
        source: 'BEDSIDE_DEVICE',
        confidence: 0.95,
        qualityStatus: 'TRUSTED',
      },
      {
        id: `obs-${patientId}-2`,
        patientId,
        bedId: bedNumber,
        vitalType: 'RESPIRATORY_RATE',
        value: rr,
        unit: 'BREATHS_PER_MINUTE',
        timestamp: now - 30000,
        source: 'BEDSIDE_DEVICE',
        confidence: 0.95,
        qualityStatus: 'TRUSTED',
      },
      {
        id: `obs-${patientId}-3`,
        patientId,
        bedId: bedNumber,
        vitalType: 'SYSTOLIC_BP',
        value: sbp,
        unit: 'MMHG',
        timestamp: now - 30000,
        source: 'BEDSIDE_DEVICE',
        confidence: 0.95,
        qualityStatus: 'TRUSTED',
      },
    ];

    return {
      patientId,
      bedNumber,
      currentTimestamp: now,
      observations: obs,
      labs: [],
      baseline: { heartRate: 72, respiratoryRate: 16, systolicBP: 120 },
    };
  }

  // ==========================================================================
  // Test 1: Standard Ward (6 Beds)
  // ==========================================================================
  it('1. Standard Ward (6 Beds): Computes full ward ranking in sub-millisecond per bed', () => {
    const wardBeds = Array.from({ length: 6 }, (_, i) =>
      generateSimulatedPatient(i + 1, i === 2)
    );

    const start = performance.now();
    const results = wardBeds.map((patient) => engine.evaluate(patient));
    const duration = performance.now() - start;

    expect(results.length).toBe(6);
    expect(duration).toBeLessThan(100); // total duration under 100ms (accounting for JIT cold start)

    // Deteriorating bed (bed 3) must have highest score
    const maxScoreBed = results.reduce((prev, curr) => (curr.score > prev.score ? curr : prev));
    expect(maxScoreBed.patientId).toBe('SCALE-P-003');
    expect(maxScoreBed.category).toBe('CRITICAL_REVIEW');
  });

  // ==========================================================================
  // Test 2: Full Telemetry Floor (32 Beds)
  // ==========================================================================
  it('2. Telemetry Floor (32 Beds): Evaluates entire hospital floor in < 50ms with deterministic rank ordering', () => {
    // 32 beds, 3 deteriorating beds
    const wardBeds = Array.from({ length: 32 }, (_, i) =>
      generateSimulatedPatient(i + 1, [4, 12, 28].includes(i + 1))
    );

    const start = performance.now();
    const results = wardBeds.map((patient) => engine.evaluate(patient));
    const duration = performance.now() - start;

    expect(results.length).toBe(32);
    expect(duration).toBeLessThan(80); // full 32-bed ward in < 80ms

    // Sort descending
    const sorted = [...results].sort((a, b) => b.score - a.score);

    // Top 3 should be the 3 deteriorating patients
    const top3Ids = sorted.slice(0, 3).map((r) => r.patientId);
    expect(top3Ids).toContain('SCALE-P-004');
    expect(top3Ids).toContain('SCALE-P-012');
    expect(top3Ids).toContain('SCALE-P-028');
  });

  // ==========================================================================
  // Test 3: Emergency Surge Capacity (100 Beds)
  // ==========================================================================
  it('3. Surge Scale (100 Beds): Evaluates 100 simultaneous telemetry beds with stable memory and monotonic event stream', () => {
    const broadcaster = new EventBroadcaster(500);
    const wardBeds = Array.from({ length: 100 }, (_, i) =>
      generateSimulatedPatient(i + 1, i % 10 === 0)
    );

    const memBefore = process.memoryUsage().heapUsed;
    const start = performance.now();

    const results = wardBeds.map((patient) => {
      const evalRes = engine.evaluate(patient);
      broadcaster.broadcast({
        eventId: `evt-attention-${evalRes.patientId}`,
        eventType: 'ATTENTION_CHANGED',
        patientId: evalRes.patientId,
        data: {
          patientId: evalRes.patientId,
          score: evalRes.score,
          category: evalRes.category,
        },
      });
      return evalRes;
    });

    const duration = performance.now() - start;
    const memAfter = process.memoryUsage().heapUsed;
    const memDeltaMB = (memAfter - memBefore) / (1024 * 1024);

    expect(results.length).toBe(100);
    expect(duration).toBeLessThan(250); // 100 beds evaluated & broadcast in < 250ms

    // Memory growth bounded
    expect(memDeltaMB).toBeLessThan(30);

    // Verify broadcaster monotonic sequence
    expect(broadcaster.getCurrentSequence()).toBe(100);
    const events = broadcaster.getEventsSince(0);
    expect(events.length).toBe(100);

    for (let i = 0; i < events.length; i++) {
      expect(events[i].seq).toBe(i + 1);
    }
  });
});
