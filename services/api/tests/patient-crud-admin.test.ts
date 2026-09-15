import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';

describe('Patient CRUD Operations & Admin Access Control', () => {
  const app = createApp();
  const adminHeader = { Authorization: 'Bearer admin-token' };
  const nurseHeader = { Authorization: 'Bearer nurse-token' };
  const doctorHeader = { Authorization: 'Bearer doctor-token' };

  describe('RBAC Authorization Boundaries for Patient Modifications', () => {
    it('rejects POST /api/v1/patients by non-admin with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/v1/patients')
        .set(nurseHeader)
        .send({
          name: 'Unauthorized Patient',
          age: 45,
          gender: 'MALE',
          wardId: 'WARD-A',
          bedNumber: '401-B',
          admissionDiagnosis: 'Test',
        });

      expect(res.status).toBe(403);
      expect(res.body.detail).toContain('is not authorized');
    });

    it('rejects PUT /api/v1/patients/:id by non-admin with 403 Forbidden', async () => {
      const res = await request(app)
        .put('/api/v1/patients/P001')
        .set(doctorHeader)
        .send({
          admissionDiagnosis: 'Altered without admin credentials',
        });

      expect(res.status).toBe(403);
      expect(res.body.detail).toContain('is not authorized');
    });

    it('rejects DELETE /api/v1/patients/:id by non-admin with 403 Forbidden', async () => {
      const res = await request(app)
        .delete('/api/v1/patients/P001')
        .set(nurseHeader);

      expect(res.status).toBe(403);
      expect(res.body.detail).toContain('is not authorized');
    });
  });

  describe('Input Validation on Patient Creation', () => {
    it('rejects patient creation with negative age (400 Bad Request)', async () => {
      const res = await request(app)
        .post('/api/v1/patients')
        .set(adminHeader)
        .send({
          name: 'Invalid Age Patient',
          age: -5,
          gender: 'MALE',
          wardId: 'WARD-A',
          bedNumber: '401-A',
          admissionDiagnosis: 'Validation failure test',
        });

      expect(res.status).toBe(400);
      expect(res.body.detail).toBe('Request validation failed');
      expect(res.body.details).toBeDefined();
    });

    it('rejects patient creation with missing admission diagnosis (400 Bad Request)', async () => {
      const res = await request(app)
        .post('/api/v1/patients')
        .set(adminHeader)
        .send({
          name: 'No Diagnosis Patient',
          age: 62,
          gender: 'FEMALE',
          wardId: 'WARD-A',
          bedNumber: '402-A',
        });

      expect(res.status).toBe(400);
      expect(res.body.detail).toBe('Request validation failed');
    });
  });

  describe('Full End-to-End CRUD Lifecycle (Admin Access)', () => {
    const testPatientId = 'P-CRUD-TEST-01';
    const testBedNumber = '405-A';

    it('1. CREATE: admits a new patient and assigns to bed', async () => {
      const newPatientPayload = {
        id: testPatientId,
        mrn: 'MRN-CRUD-9999',
        name: 'Arthur Pendelton',
        age: 68,
        gender: 'MALE',
        wardId: 'WARD-A',
        bedNumber: testBedNumber,
        admissionDiagnosis: 'Acute Exacerbation of COPD',
        attendingPhysician: 'Dr. Michael Chen, MD',
        primaryNurse: 'Nurse Sarah Jenkins, RN',
        codeStatus: 'FULL_CODE',
        baselineMEWS: 2,
        allergies: ['Penicillin', 'Sulfa drugs'],
        isolationStatus: 'CONTACT',
      };

      const res = await request(app)
        .post('/api/v1/patients')
        .set(adminHeader)
        .send(newPatientPayload);

      expect(res.status).toBe(201);
      expect(res.body.data.id).toBe(testPatientId);
      expect(res.body.data.name).toBe('Arthur Pendelton');
      expect(res.body.data.allergies).toContain('Penicillin');
      expect(res.body.message).toContain('admitted successfully');
    });

    it('2. READ: retrieves created patient via GET /api/v1/patients/:id', async () => {
      const res = await request(app)
        .get(`/api/v1/patients/${testPatientId}`)
        .set(adminHeader);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(testPatientId);
      expect(res.body.data.name).toBe('Arthur Pendelton');
      expect(res.body.data.bedNumber).toBe(testBedNumber);
      expect(res.body.data.baselineMEWS).toBe(2);
      expect(res.body.data.codeStatus).toBe('FULL_CODE');
    });

    it('3. UPDATE: updates patient clinical details via PATCH', async () => {
      const updates = {
        admissionDiagnosis: 'Post-Bronchoscopy Recovery & COPD Stabilization',
        attendingPhysician: 'Dr. Elena Rostova, MD',
        codeStatus: 'DNR',
        baselineMEWS: 1,
        allergies: ['Penicillin', 'Sulfa drugs', 'NSAIDs'],
      };

      const res = await request(app)
        .patch(`/api/v1/patients/${testPatientId}`)
        .set(adminHeader)
        .send(updates);

      expect(res.status).toBe(200);
      expect(res.body.data.admissionDiagnosis).toBe(updates.admissionDiagnosis);
      expect(res.body.data.attendingPhysician).toBe(updates.attendingPhysician);
      expect(res.body.data.codeStatus).toBe('DNR');
      expect(res.body.data.baselineMEWS).toBe(1);
      expect(res.body.data.allergies).toContain('NSAIDs');
    });

    it('4. VERIFY UPDATE: confirmed through GET /api/v1/patients/:id', async () => {
      const res = await request(app)
        .get(`/api/v1/patients/${testPatientId}`)
        .set(adminHeader);

      expect(res.status).toBe(200);
      expect(res.body.data.codeStatus).toBe('DNR');
      expect(res.body.data.admissionDiagnosis).toContain('Post-Bronchoscopy');
    });

    it('5. DELETE: discharges patient and frees the bed', async () => {
      const res = await request(app)
        .delete(`/api/v1/patients/${testPatientId}`)
        .set(adminHeader);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('discharged');

      // Patient should no longer exist
      const checkRes = await request(app)
        .get(`/api/v1/patients/${testPatientId}`)
        .set(adminHeader);
      expect(checkRes.status).toBe(404);
    });
  });
});
