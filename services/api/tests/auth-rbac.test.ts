import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';

describe('Authentication & RBAC Authorization Boundaries', () => {
  const app = createApp();

  it('rejects protected routes with 401 Unauthorized when token is omitted', async () => {
    const res = await request(app)
      .post('/api/v1/patients/P001/acknowledgements')
      .send({ reason: 'Checking vitals' });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('rejects protected routes with 401 Unauthorized on invalid token', async () => {
    const res = await request(app)
      .post('/api/v1/patients/P001/acknowledgements')
      .set('Authorization', 'Bearer invalid-token-xyz')
      .send({ reason: 'Checking vitals' });

    expect(res.status).toBe(401);
  });

  it('allows authenticated ward nurse to acknowledge an alert', async () => {
    const res = await request(app)
      .post('/api/v1/patients/P001/acknowledgements')
      .set('Authorization', 'Bearer nurse-token')
      .send({ reason: 'Nurse Sarah at bedside, vitals rechecked.' });

    expect(res.status).toBe(201);
    expect(res.body.data.acknowledgedByUserId).toBe('usr-nurse-101');
  });

  it('rejects WARD_NURSE from running simulation scenarios with 403 Forbidden', async () => {
    const res = await request(app)
      .post('/api/v1/simulation/scenarios/run')
      .set('Authorization', 'Bearer nurse-token')
      .send({ scenarioId: 'SINGLE_PATIENT_DETERIORATION' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
    expect(res.body.detail).toContain('is not authorized');
  });

  it('allows ADMIN to run simulation scenarios', async () => {
    const res = await request(app)
      .post('/api/v1/simulation/scenarios/run')
      .set('Authorization', 'Bearer admin-token')
      .send({ scenarioId: 'SINGLE_PATIENT_DETERIORATION' });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('SINGLE_PATIENT_DETERIORATION');
  });
});
