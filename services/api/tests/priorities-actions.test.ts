import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';

describe('Attention Priorities, Ward Radar, Acknowledgements & Actions API', () => {
  const app = createApp();
  let patientId: string;

  beforeAll(async () => {
    const patients = await request(app).get('/api/v1/patients');
    patientId = patients.body.data[0].id;
  });

  describe('Attention Priority & Radar', () => {
    it('GET /api/v1/patients/:patientId/attention-priority computes bounded APS and explainability reasons', async () => {
      const res = await request(app).get(`/api/v1/patients/${patientId}/attention-priority`);
      expect(res.status).toBe(200);
      expect(res.body.data.patientId).toBe(patientId);
      expect(res.body.data.apsScore).toBeGreaterThanOrEqual(0);
      expect(res.body.data.apsScore).toBeLessThanOrEqual(100);
      expect(res.body.data).toHaveProperty('category');
      expect(res.body.data).toHaveProperty('topReason');
      expect(Array.isArray(res.body.data.reasons)).toBe(true);
      expect(res.body.data.reasons.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.reasons.length).toBeLessThanOrEqual(5);
    });

    it('GET /api/v1/wards/WARD-A/radar returns ward patients ranked by APS descending', async () => {
      const res = await request(app).get('/api/v1/wards/WARD-A/radar');
      expect(res.status).toBe(200);
      expect(res.body.data.wardId).toBe('WARD-A');
      expect(res.body.data.radar.length).toBe(6);

      // Check sorting descending
      const scores = res.body.data.radar.map((r: any) => r.apsScore);
      for (let i = 0; i < scores.length - 1; i++) {
        expect(scores[i]).toBeGreaterThanOrEqual(scores[i + 1]);
      }
    });
  });

  describe('Acknowledgements', () => {
    it('records and lists clinician alert acknowledgements', async () => {
      const postRes = await request(app)
        .post(`/api/v1/patients/${patientId}/acknowledgements`)
        .set('Authorization', 'Bearer charge-token')
        .send({
          alertId: 'alert-hr-tachy-01',
          reason: 'Charge nurse David notified, attending reviewed telemetry.',
        });

      expect(postRes.status).toBe(201);
      expect(postRes.body.data.acknowledgedByUserId).toBe('usr-charge-202');

      const getRes = await request(app)
        .get(`/api/v1/patients/${patientId}/acknowledgements`)
        .set('Authorization', 'Bearer charge-token');

      expect(getRes.status).toBe(200);
      expect(getRes.body.data.length).toBeGreaterThan(0);
      expect(getRes.body.data.some((a: any) => a.alertId === 'alert-hr-tachy-01')).toBe(true);
    });
  });

  describe('Clinical Actions Lifecycle', () => {
    let createdActionId: string;

    it('GET /api/v1/patients/:patientId/actions lists active actions', async () => {
      const res = await request(app).get(`/api/v1/patients/${patientId}/actions`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('POST /api/v1/patients/:patientId/actions proposes clinical action', async () => {
      const res = await request(app)
        .post(`/api/v1/patients/${patientId}/actions`)
        .set('Authorization', 'Bearer nurse-token')
        .send({
          actionType: 'ATTACH_CUFF',
          title: 'Attach automated NIBP cuff',
          rationale: 'Confirm intermittent optical BP with oscillometric measurement',
          urgency: 'WATCH',
          targetCompletionMinutes: 30,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('RECOMMENDED');
      createdActionId = res.body.data.id;
    });

    it('PATCH /api/v1/patients/:patientId/actions/:actionId transitions status to COMPLETED', async () => {
      const res = await request(app)
        .patch(`/api/v1/patients/${patientId}/actions/${createdActionId}`)
        .set('Authorization', 'Bearer nurse-token')
        .send({
          status: 'COMPLETED',
          outcomeNotes: 'Cuff attached to left arm, first cycle completed (124/82 mmHg).',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('COMPLETED');
      expect(res.body.data.completedByUserId).toBe('usr-nurse-101');
      expect(res.body.data.outcomeNotes).toContain('124/82');
    });
  });
});
