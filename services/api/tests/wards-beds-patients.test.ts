import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';

describe('Wards, Beds, and Patients API', () => {
  const app = createApp();

  describe('Wards', () => {
    it('GET /api/v1/wards returns list of configured wards', async () => {
      const res = await request(app).get('/api/v1/wards');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].id).toBe('WARD-A');
    });

    it('GET /api/v1/wards/WARD-A returns ward details with beds', async () => {
      const res = await request(app).get('/api/v1/wards/WARD-A');
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('WARD-A');
      expect(res.body.data.beds.length).toBe(6);
    });

    it('GET /api/v1/wards/WARD-A/overview returns complete ward census', async () => {
      const res = await request(app).get('/api/v1/wards/WARD-A/overview');
      expect(res.status).toBe(200);
      expect(res.body.data.totalBeds).toBe(6);
      expect(res.body.data.patientCount).toBe(6);
    });

    it('returns 404 for nonexistent ward', async () => {
      const res = await request(app).get('/api/v1/wards/NONEXISTENT-WARD');
      expect(res.status).toBe(404);
    });
  });

  describe('Beds', () => {
    it('GET /api/v1/beds returns all beds', async () => {
      const res = await request(app).get('/api/v1/beds');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(6);
    });

    it('GET /api/v1/beds/:bedId returns bed details and occupant', async () => {
      const beds = await request(app).get('/api/v1/beds');
      const firstBedId = beds.body.data[0].id;

      const res = await request(app).get(`/api/v1/beds/${firstBedId}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(firstBedId);
      expect(res.body.data.patient).toBeDefined();
    });

    it('returns 404 for nonexistent bed', async () => {
      const res = await request(app).get('/api/v1/beds/nonexistent-bed-99');
      expect(res.status).toBe(404);
    });
  });

  describe('Patients', () => {
    it('GET /api/v1/patients returns patient registry', async () => {
      const res = await request(app).get('/api/v1/patients');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(6);
    });

    it('GET /api/v1/patients/:patientId returns patient summary with latest observations', async () => {
      const patients = await request(app).get('/api/v1/patients');
      const firstPatientId = patients.body.data[0].id;

      const res = await request(app).get(`/api/v1/patients/${firstPatientId}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(firstPatientId);
      expect(res.body.data).toHaveProperty('name');
      expect(res.body.data).toHaveProperty('bedNumber');
    });

    it('returns 404 for nonexistent patient', async () => {
      const res = await request(app).get('/api/v1/patients/nonexistent-patient-99');
      expect(res.status).toBe(404);
    });
  });
});
