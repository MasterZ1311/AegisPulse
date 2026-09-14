import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';

describe('Observations & Labs Ingestion and Query API', () => {
  const app = createApp();

  let patientId: string;

  beforeAll(async () => {
    const patients = await request(app).get('/api/v1/patients');
    patientId = patients.body.data[0].id;
  });

  describe('Observations', () => {
    it('GET /api/v1/patients/:patientId/observations returns historical observations', async () => {
      const res = await request(app).get(`/api/v1/patients/${patientId}/observations`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('POST /api/v1/patients/:patientId/observations accepts valid in-bounds observation', async () => {
      const res = await request(app)
        .post(`/api/v1/patients/${patientId}/observations`)
        .send({
          heartRate: 84,
          respiratoryRate: 18,
          systolicBP: 122,
          diastolicBP: 78,
          temperature: 36.9,
          spo2: 98,
          confidence: 0.94,
          source: 'BEDSIDE_DEVICE',
          notes: 'Routine automated telemetry check',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.heartRate).toBe(84);
      expect(res.body.data.shockIndex).toBeCloseTo(84 / 122, 2);
    });

    it('rejects out-of-bounds physiological vitals with 400 Bad Request', async () => {
      // HR 15 bpm < minimum 20 bpm
      const lowHR = await request(app)
        .post(`/api/v1/patients/${patientId}/observations`)
        .send({ heartRate: 15 });
      expect(lowHR.status).toBe(400);
      expect(lowHR.body.code).toBe('BAD_REQUEST');

      // SBP 400 mmHg > maximum 300 mmHg
      const highBP = await request(app)
        .post(`/api/v1/patients/${patientId}/observations`)
        .send({ systolicBP: 400 });
      expect(highBP.status).toBe(400);

      // RR 90 /min > maximum 80 /min
      const highRR = await request(app)
        .post(`/api/v1/patients/${patientId}/observations`)
        .send({ respiratoryRate: 90 });
      expect(highRR.status).toBe(400);
    });

    it('strictly forbids arbitrary client writes by rejecting unknown fields with 400 Bad Request', async () => {
      const maliciousWrite = await request(app)
        .post(`/api/v1/patients/${patientId}/observations`)
        .send({
          heartRate: 75,
          isAdminOverride: true,
          arbitraryDatabasePayload: 'DROP TABLE patients;',
        });

      expect(maliciousWrite.status).toBe(400);
      expect(maliciousWrite.body.code).toBe('BAD_REQUEST');
      expect(maliciousWrite.body.detail).toContain('validation failed');
    });
  });

  describe('Labs', () => {
    it('GET /api/v1/patients/:patientId/labs returns lab results', async () => {
      const res = await request(app).get(`/api/v1/patients/${patientId}/labs`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('POST /api/v1/patients/:patientId/labs ingests validated lab result', async () => {
      const res = await request(app)
        .post(`/api/v1/patients/${patientId}/labs`)
        .send({
          testCode: 'LACTATE',
          testName: 'Venous Blood Lactate',
          value: 3.4,
          unit: 'MMOL_PER_L',
          referenceRange: { low: 0.5, high: 2.0 },
          isCritical: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.testCode).toBe('LACTATE');
      expect(res.body.data.value).toBe(3.4);
      expect(res.body.data.isCritical).toBe(true);
    });

    it('rejects invalid lab units with 400 Bad Request', async () => {
      const res = await request(app)
        .post(`/api/v1/patients/${patientId}/labs`)
        .send({
          testCode: 'LACTATE',
          testName: 'Lactate',
          value: 3.4,
          unit: 'INVALID_UNIT_XYZ',
          referenceRange: { low: 0.5, high: 2.0 },
        });

      expect(res.status).toBe(400);
    });
  });
});
