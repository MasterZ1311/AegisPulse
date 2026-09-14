import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { wardStateService } from '../src/services/ward-state.service';

describe('AegisPulse API Persistence Integration Tests', () => {
  const app = createApp();
  const db = wardStateService.getDatabase();

  it('verifies seeded wards, beds, and patients are persisted in SQLite and queried via REST', async () => {
    // Check via REST
    const wardsRes = await request(app).get('/api/v1/wards');
    expect(wardsRes.status).toBe(200);
    expect(wardsRes.body.data.length).toBeGreaterThanOrEqual(2);
    expect(wardsRes.body.data[0].id).toBe('WARD-A');

    const patientsRes = await request(app).get('/api/v1/patients');
    expect(patientsRes.status).toBe(200);
    expect(patientsRes.body.data.length).toBe(6);

    // Check direct SQLite persistence
    const wardRows = db.prepare('SELECT COUNT(*) as count FROM wards;').get() as { count: number };
    expect(wardRows.count).toBeGreaterThanOrEqual(2);

    const bedRows = db.prepare('SELECT COUNT(*) as count FROM beds;').get() as { count: number };
    expect(bedRows.count).toBe(6);

    const patientRows = db.prepare('SELECT COUNT(*) as count FROM patients;').get() as { count: number };
    expect(patientRows.count).toBe(6);

    const contextRows = db.prepare('SELECT COUNT(*) as count FROM clinical_contexts;').get() as { count: number };
    expect(contextRows.count).toBe(6);
  });

  it('persists observations ingested via HTTP directly into SQLite without raw camera frames', async () => {
    const newObs = {
      heartRate: 88,
      respiratoryRate: 19,
      systolicBP: 125,
      diastolicBP: 80,
      spo2: 97,
      temperature: 37.1,
      confidence: 0.96,
      source: 'OPTICAL_RPPG',
      notes: 'Optical rPPG telemetry scan without video frame storage',
    };

    const res = await request(app)
      .post('/api/v1/patients/P001/observations')
      .send(newObs);

    expect(res.status).toBe(201);
    const obsId = res.body.data.id;

    // Verify persisted in SQLite
    const row = db.prepare('SELECT * FROM observations WHERE id = ?;').get(obsId) as any;
    expect(row).toBeDefined();
    expect(row.patient_id).toBe('P001');
    expect(row.heart_rate).toBe(88);
    expect(row.respiratory_rate).toBe(19);
    expect(row.spo2).toBe(97);
    expect(row.source).toBe('OPTICAL_RPPG');

    // Strict invariant: zero raw camera frames in schema or table
    const columns = db.prepare("PRAGMA table_info('observations');").all() as any[];
    const colNames = columns.map((c) => c.name.toLowerCase());
    expect(colNames).not.toContain('frame');
    expect(colNames).not.toContain('video');
    expect(colNames).not.toContain('camera');
    expect(colNames).not.toContain('raw_image');
    expect(colNames).not.toContain('raw_frame');
  });

  it('persists laboratory results posted via REST into SQLite and timeline', async () => {
    const newLab = {
      testCode: 'LACTATE',
      testName: 'Venous Blood Lactate',
      value: 2.8,
      unit: 'MMOL_PER_L',
      referenceRange: { low: 0.5, high: 2.0 },
      isCritical: true,
    };

    const res = await request(app)
      .post('/api/v1/patients/P002/labs')
      .send(newLab);

    expect(res.status).toBe(201);
    const labId = res.body.data.id;

    const row = db.prepare('SELECT * FROM labs WHERE id = ?;').get(labId) as any;
    expect(row).toBeDefined();
    expect(row.patient_id).toBe('P002');
    expect(row.test_type).toBe('LACTATE');
    expect(row.value).toBe(2.8);
    expect(row.status).toBe('CRITICAL');

    // Verify corresponding timeline event in SQLite
    const tlRows = db.prepare("SELECT * FROM timeline_events WHERE patient_id = 'P002' AND event_type = 'LAB_RESULT';").all();
    expect(tlRows.length).toBeGreaterThan(0);
  });

  it('persists alert acknowledgements into SQLite', async () => {
    const ackPayload = {
      alertId: 'alt-resp-fail-003',
      reason: 'Clinician on-site evaluating patient with oxygen therapy',
    };

    const res = await request(app)
      .post('/api/v1/patients/P003/acknowledgements')
      .set('Authorization', 'Bearer charge-token')
      .send(ackPayload);

    expect(res.status).toBe(201);
    const ackId = res.body.data.id;

    const row = db.prepare('SELECT * FROM acknowledgements WHERE id = ?;').get(ackId) as any;
    expect(row).toBeDefined();
    expect(row.patient_id).toBe('P003');
    expect(row.acknowledged_by_user_id).toBe('usr-charge-202');
    expect(row.reason).toBe(ackPayload.reason);
  });

  it('persists clinical actions and status transitions into SQLite', async () => {
    const actionPayload = {
      actionType: 'ATTACH_CUFF',
      title: 'Attach automated NIBP cuff',
      rationale: 'Confirm intermittent optical BP with oscillometric measurement',
      urgency: 'WATCH',
      targetCompletionMinutes: 30,
    };

    const createRes = await request(app)
      .post('/api/v1/patients/P004/actions')
      .set('Authorization', 'Bearer nurse-token')
      .send(actionPayload);

    expect(createRes.status).toBe(201);
    const actionId = createRes.body.data.id;

    // Verify in SQLite
    const row = db.prepare('SELECT * FROM clinical_actions WHERE id = ?;').get(actionId) as any;
    expect(row).toBeDefined();
    expect(row.status).toBe('RECOMMENDED');

    // Complete action
    const patchRes = await request(app)
      .patch(`/api/v1/patients/P004/actions/${actionId}`)
      .set('Authorization', 'Bearer nurse-token')
      .send({
        status: 'COMPLETED',
        outcomeNotes: 'Cuff attached to left arm, first cycle completed (118/76 mmHg).',
      });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.status).toBe('COMPLETED');

    const updatedRow = db.prepare('SELECT * FROM clinical_actions WHERE id = ?;').get(actionId) as any;
    expect(updatedRow.status).toBe('COMPLETED');
    expect(updatedRow.completed_by_user_id).toBe('usr-nurse-101');
    expect(updatedRow.outcome_notes).toContain('118/76');
  });

  it('executes database integrity check with zero corruption', async () => {
    expect(wardStateService.isDatabaseHealthy()).toBe(true);

    const check = db.prepare('PRAGMA integrity_check;').get() as any;
    expect(check.integrity_check).toBe('ok');
  });
});
