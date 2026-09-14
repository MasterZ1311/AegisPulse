import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';

describe('Simulation Scenarios & Virtual Clock API', () => {
  const app = createApp();

  it('GET /api/v1/simulation/scenarios lists all catalog scenarios', async () => {
    const res = await request(app).get('/api/v1/simulation/scenarios');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(5);
    expect(res.body.data.some((s: any) => s.id === 'NORMAL_SHIFT')).toBe(true);
    expect(res.body.data.some((s: any) => s.id === 'SINGLE_PATIENT_DETERIORATION')).toBe(true);
    expect(res.body.data.some((s: any) => s.id === 'SIGNAL_FAILURE_SCENARIO')).toBe(true);
  });

  it('GET /api/v1/simulation/status returns current virtual clock time and active scenario', async () => {
    const res = await request(app).get('/api/v1/simulation/status');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('clock');
    expect(res.body.data).toHaveProperty('patientCount', 6);
    expect(res.body.data).toHaveProperty('currentScenario');
  });

  it('POST /api/v1/simulation/scenarios/run activates scenario when called by ADMIN', async () => {
    const res = await request(app)
      .post('/api/v1/simulation/scenarios/run')
      .set('Authorization', 'Bearer admin-token')
      .send({ scenarioId: 'SIGNAL_FAILURE_SCENARIO' });

    expect(res.status).toBe(200);
    expect(res.body.status.currentScenario).toBe('SIGNAL_FAILURE_SCENARIO');
  });

  it('POST /api/v1/simulation/tick advances clock virtual time deterministically', async () => {
    const initialStatus = await request(app).get('/api/v1/simulation/status');
    const startClock = initialStatus.body.data.clock;

    const res = await request(app)
      .post('/api/v1/simulation/tick')
      .set('Authorization', 'Bearer admin-token')
      .send({ seconds: 120 });

    expect(res.status).toBe(200);
    expect(res.body.newTimestamp).toBe(startClock + 120 * 1000);
  });
});
