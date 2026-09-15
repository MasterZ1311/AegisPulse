import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';

describe('Unified Patient Timeline API & Clinical Query Endpoints', () => {
  const app = createApp();
  const authHeader = { Authorization: 'Bearer nurse-token' };
  let patientId: string;

  beforeAll(async () => {
    const patients = await request(app).get('/api/v1/patients').set(authHeader);
    patientId = patients.body.data[0].id;
  });

  it('GET /api/v1/patients/:patientId/timeline returns chronological events stream', async () => {
    const res = await request(app).get(`/api/v1/patients/${patientId}/timeline`).set(authHeader);
    expect(res.status).toBe(200);
    expect(res.body.patientId).toBe(patientId);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('POST /api/v1/patients/:patientId/timeline/events ingests bedside nurse assessment', async () => {
    const res = await request(app)
      .post(`/api/v1/patients/${patientId}/timeline/events`)
      .set(authHeader)
      .send({
        eventType: 'NURSE_VISIT',
        title: 'Emergency Bedside Re-evaluation',
        description: 'Assessed airway patency, skin perfusion, and patient verbal responsiveness.',
        severity: 'INFO',
        source: 'MANUAL_ENTRY',
        isTrusted: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.eventType).toBe('NURSE_VISIT');
    expect(res.body.data.title).toBe('Emergency Bedside Re-evaluation');
  });

  it('GET /api/v1/patients/:patientId/timeline/changes answers "What changed during the last 4 hours?"', async () => {
    const res = await request(app).get(`/api/v1/patients/${patientId}/timeline/changes?hours=4`).set(authHeader);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('windowHours', 4);
    expect(res.body.data).toHaveProperty('narrativeSummary');
    expect(res.body.data).toHaveProperty('vitalDeltas');
    expect(res.body.data).toHaveProperty('scoreTransitions');
    expect(res.body.data).toHaveProperty('nurseVisitsCount');
  });

  it('GET /api/v1/patients/:patientId/timeline/priority-rise answers "What caused the patient\'s priority to rise?"', async () => {
    const res = await request(app).get(`/api/v1/patients/${patientId}/timeline/priority-rise?hours=4`).set(authHeader);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('scoreDelta');
    expect(res.body.data).toHaveProperty('primaryDriver');
    expect(res.body.data).toHaveProperty('contributingFactors');
    expect(res.body.data).toHaveProperty('triggerEvents');
  });

  it('GET /api/v1/patients/:patientId/timeline/last-manual-assessment answers "When was the patient last manually assessed?"', async () => {
    const res = await request(app).get(`/api/v1/patients/${patientId}/timeline/last-manual-assessment`).set(authHeader);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('elapsedHuman');
    expect(res.body.data).toHaveProperty('assessmentType');
    expect(res.body.data).toHaveProperty('findings');
    expect(res.body.data).toHaveProperty('isOverdue');
  });

  it('GET /api/v1/patients/:patientId/timeline/trusted-measurements answers "Which measurements were trusted?"', async () => {
    const res = await request(app).get(`/api/v1/patients/${patientId}/timeline/trusted-measurements`).set(authHeader);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('totalMeasurements');
    expect(res.body.data).toHaveProperty('trustPercentage');
    expect(res.body.data).toHaveProperty('trustedMeasurements');
    expect(res.body.data).toHaveProperty('untrustedMeasurements');
    expect(res.body.data).toHaveProperty('commonSuppressionReasons');
  });

  it('returns 404 for nonexistent patient on timeline query', async () => {
    const res = await request(app).get('/api/v1/patients/nonexistent-p99/timeline').set(authHeader);
    expect(res.status).toBe(404);
  });
});
