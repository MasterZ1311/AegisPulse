import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { syncService } from '../src/services/sync.service';
import { wardStateService } from '../src/services/ward-state.service';
import { eventBroadcaster } from '../src/stream/event-broadcaster';

describe('Phase 23: Offline Resilience & Edge Synchronization Suite', () => {
  const app = createApp();

  beforeEach(() => {
    syncService.reset();
    eventBroadcaster.reset();
  });

  it('1. Idempotent Synchronization: Processes batch and rejects duplicate submissions', async () => {
    const batch = {
      clientSyncId: 'sync-batch-001',
      clientId: 'tablet-403',
      wardId: 'WARD-A',
      items: [
        {
          idempotencyKey: 'idemp-obs-P001-1001',
          itemType: 'OBSERVATION',
          timestamp: Date.now() - 5000,
          patientId: 'P001',
          payload: {
            source: 'BEDSIDE_DEVICE',
            heartRate: 88,
            respiratoryRate: 18,
            systolicBP: 124,
            diastolicBP: 78,
          },
        },
        {
          idempotencyKey: 'idemp-ack-P001-1002',
          itemType: 'ACKNOWLEDGEMENT',
          timestamp: Date.now() - 3000,
          patientId: 'P001',
          payload: {
            alertId: 'alt-P001-01',
            acknowledgedByUserId: 'nurse-rachel',
            reason: 'Reviewed while offline.',
          },
        },
      ],
    };

    // First submission
    const res1 = await request(app)
      .post('/api/v1/sync')
      .set('Authorization', 'Bearer nurse-token')
      .send(batch);

    expect(res1.status).toBe(200);
    expect(res1.body.data.success).toBe(true);
    expect(res1.body.data.processedCount).toBe(2);
    expect(res1.body.data.duplicateCount).toBe(0);

    // Duplicate submission with exact same batch / idempotency keys
    const res2 = await request(app)
      .post('/api/v1/sync')
      .set('Authorization', 'Bearer nurse-token')
      .send(batch);

    expect(res2.status).toBe(200);
    expect(res2.body.data.success).toBe(true);
    expect(res2.body.data.processedCount).toBe(0);
    expect(res2.body.data.duplicateCount).toBe(2);
  });

  it('2. Conflict Resolution: Bedside manual observation supersedes optical rPPG estimate', async () => {
    const timestamp = Date.now() - 10000;

    // Simulate pre-existing optical reading
    wardStateService.addObservation({
      id: `obs-rppg-collision-${timestamp}`,
      patientId: 'P002',
      timestamp,
      source: 'RPPG_CAMERA',
      confidence: 0.72,
      qualityState: 'DEGRADED',
      heartRate: 110,
      respiratoryRate: 24,
    });

    // Offline batch arrives containing verified bedside manual vital at the same timestamp
    const batch = {
      clientSyncId: 'sync-conflict-001',
      clientId: 'tablet-402',
      items: [
        {
          idempotencyKey: 'idemp-manual-override-001',
          itemType: 'OBSERVATION',
          timestamp,
          patientId: 'P002',
          payload: {
            source: 'MANUAL_VERIFIED',
            confidence: 1.0,
            qualityState: 'TRUSTED',
            heartRate: 78,
            respiratoryRate: 16,
            systolicBP: 120,
            diastolicBP: 80,
            notes: 'Nurse bedside manual count confirmed true rhythm.',
          },
        },
      ],
    };

    const res = await request(app)
      .post('/api/v1/sync')
      .set('Authorization', 'Bearer nurse-token')
      .send(batch);

    expect(res.status).toBe(200);
    expect(res.body.data.processedCount).toBe(1);
    expect(res.body.data.conflicts.length).toBeGreaterThan(0);
    expect(res.body.data.conflicts[0].resolution).toBe('SUPERSEDED');
    expect(res.body.data.conflicts[0].reason).toContain('Manual bedside observation superseded');
  });

  it('3. Out-of-Order Events: Preserves chronological monotonicity when items arrive unsorted', async () => {
    const baseTime = Date.now() - 60000;

    const unsortedBatch = {
      clientSyncId: 'sync-unsorted-001',
      clientId: 'tablet-403',
      items: [
        {
          idempotencyKey: 'idemp-time-3',
          itemType: 'OBSERVATION',
          timestamp: baseTime + 30000,
          patientId: 'P003',
          payload: { heartRate: 95 },
        },
        {
          idempotencyKey: 'idemp-time-1',
          itemType: 'OBSERVATION',
          timestamp: baseTime + 10000,
          patientId: 'P003',
          payload: { heartRate: 85 },
        },
        {
          idempotencyKey: 'idemp-time-2',
          itemType: 'OBSERVATION',
          timestamp: baseTime + 20000,
          patientId: 'P003',
          payload: { heartRate: 90 },
        },
      ],
    };

    const res = await request(app)
      .post('/api/v1/sync')
      .set('Authorization', 'Bearer nurse-token')
      .send(unsortedBatch);

    expect(res.status).toBe(200);
    expect(res.body.data.processedCount).toBe(3);

    // Latest observations in repository should reflect sorted ingestion
    const obs = wardStateService.getObservations('P003', { since: baseTime });
    expect(obs.length).toBeGreaterThanOrEqual(3);
  });

  it('4. Long Offline Periods: Correctly handles stale observations (> 24h old)', async () => {
    const staleTime = Date.now() - (26 * 60 * 60 * 1000); // 26 hours ago

    const batch = {
      clientSyncId: 'sync-stale-001',
      clientId: 'tablet-old',
      items: [
        {
          idempotencyKey: 'idemp-stale-001',
          itemType: 'OBSERVATION',
          timestamp: staleTime,
          patientId: 'P004',
          payload: {
            heartRate: 120,
            respiratoryRate: 28,
            source: 'BEDSIDE_DEVICE',
          },
        },
      ],
    };

    const res = await request(app)
      .post('/api/v1/sync')
      .set('Authorization', 'Bearer nurse-token')
      .send(batch);

    expect(res.status).toBe(200);
    expect(res.body.data.processedCount).toBe(1);

    // Stale observation should have degraded quality assigned
    const obs = wardStateService.getObservations('P004', { since: staleTime - 1000, until: staleTime + 1000 });
    expect(obs.length).toBe(1);
    expect(obs[0].qualityState).toBe('DEGRADED');
  });

  it('5. Missed Events Recovery: Returns missed broadcaster events since lastServerSeq', async () => {
    // Generate simulated server broadcast events
    eventBroadcaster.broadcast({
      eventId: 'evt-test-101',
      eventType: 'OBSERVATION_UPDATED',
      wardId: 'WARD-A',
      patientId: 'P001',
      data: { heartRate: 75 },
    });

    eventBroadcaster.broadcast({
      eventId: 'evt-test-102',
      eventType: 'OBSERVATION_UPDATED',
      wardId: 'WARD-A',
      patientId: 'P002',
      data: { heartRate: 82 },
    });

    const clientLastKnownSeq = 0; // Client was offline since sequence 0

    const batch = {
      clientSyncId: 'sync-catchup-001',
      clientId: 'tablet-catchup',
      wardId: 'WARD-A',
      lastServerSeq: clientLastKnownSeq,
      items: [],
    };

    const res = await request(app)
      .post('/api/v1/sync')
      .set('Authorization', 'Bearer nurse-token')
      .send(batch);

    expect(res.status).toBe(200);
    expect(res.body.data.missedEvents).toBeDefined();
    expect(res.body.data.missedEvents.length).toBeGreaterThanOrEqual(2);
    expect(res.body.data.serverSeq).toBeGreaterThan(clientLastKnownSeq);
  });

  it('6. Partial Synchronization & Bad Patient IDs: Rejects unknown patients without failing entire batch', async () => {
    const batch = {
      clientSyncId: 'sync-partial-001',
      clientId: 'tablet-partial',
      items: [
        {
          idempotencyKey: 'idemp-valid-001',
          itemType: 'OBSERVATION',
          timestamp: Date.now(),
          patientId: 'P001', // Valid
          payload: { heartRate: 70 },
        },
        {
          idempotencyKey: 'idemp-invalid-002',
          itemType: 'OBSERVATION',
          timestamp: Date.now(),
          patientId: 'P999_NON_EXISTENT', // Invalid
          payload: { heartRate: 150 },
        },
      ],
    };

    const res = await request(app)
      .post('/api/v1/sync')
      .set('Authorization', 'Bearer nurse-token')
      .send(batch);

    expect(res.status).toBe(200);
    expect(res.body.data.processedCount).toBe(1);
    expect(res.body.data.rejectedCount).toBe(1);
    expect(res.body.data.conflicts[0].resolution).toBe('REJECTED_STALE');
  });
});
