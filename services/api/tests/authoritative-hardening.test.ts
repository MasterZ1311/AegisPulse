import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';

describe('Authoritative Derived Values & Backend Hardening Verification', () => {
  const app = createApp();

  describe('Authoritative Clinical Values Enforcement', () => {
    it('server ignores client-supplied shockIndex and recomputes authoritative HR / SBP ratio', async () => {
      // Patient P001 in WARD-A
      // Client provides heartRate: 100, systolicBP: 100 -> True shockIndex is 1.0
      // Malicious client tries to inject falsified shockIndex: 0.20
      const res = await request(app)
        .post('/api/v1/patients/P001/observations')
        .set('Authorization', 'Bearer nurse-token')
        .send({
          heartRate: 100,
          systolicBP: 100,
          respiratoryRate: 18,
          confidence: 0.95,
          source: 'BEDSIDE_DEVICE',
          shockIndex: 0.20, // Fraudulent client attempt to suppress shock indicator
        });

      expect(res.status).toBe(201);
      // Authoritative recomputation must prevail: 100 / 100 = 1.0
      expect(res.body.data.shockIndex).toBe(1.0);
      expect(res.body.data.shockIndex).not.toBe(0.20);
    });

    it('server authoritatively evaluates isCritical for labs from value and reference range', async () => {
      // Malicious client posts lactate 4.5 mmol/L (ref 0.5 - 2.0) with isCritical: false to hide emergency
      const res = await request(app)
        .post('/api/v1/patients/P001/labs')
        .set('Authorization', 'Bearer nurse-token')
        .send({
          testCode: 'LACTATE',
          testName: 'Venous Blood Lactate',
          value: 4.5,
          unit: 'MMOL_PER_L',
          referenceRange: { low: 0.5, high: 2.0 },
          isCritical: false, // Falsified flag
        });

      expect(res.status).toBe(201);
      // Authoritative evaluation: 4.5 > 2.0 -> isCritical must be true!
      expect(res.body.data.isCritical).toBe(true);
    });
  });

  describe('Timestamp Integrity, Clock Skew & Stale Telemetry Protection', () => {
    it('rejects observation with future timestamp exceeding 5-minute clock skew threshold', async () => {
      const farFutureTimestamp = Date.now() + 10 * 60 * 1000; // 10 minutes in the future

      const res = await request(app)
        .post('/api/v1/patients/P001/observations')
        .set('Authorization', 'Bearer nurse-token')
        .send({
          timestamp: farFutureTimestamp,
          heartRate: 85,
          confidence: 0.95,
          source: 'BEDSIDE_DEVICE',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('clock skew');
    });

    it('rejects observation with ancient timestamp (> 7 days past)', async () => {
      const ancientTimestamp = Date.now() - 10 * 86400 * 1000; // 10 days ago

      const res = await request(app)
        .post('/api/v1/patients/P001/observations')
        .set('Authorization', 'Bearer nurse-token')
        .send({
          timestamp: ancientTimestamp,
          heartRate: 85,
          confidence: 0.95,
          source: 'BEDSIDE_DEVICE',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('7 days');
    });

    it('marks observation as DEGRADED when data is stale (> 24 hours old)', async () => {
      const staleTimestamp = Date.now() - 36 * 3600 * 1000; // 36 hours ago (within 7 days)

      const res = await request(app)
        .post('/api/v1/patients/P001/observations')
        .set('Authorization', 'Bearer nurse-token')
        .send({
          timestamp: staleTimestamp,
          heartRate: 85,
          confidence: 0.95,
          source: 'BEDSIDE_DEVICE',
          qualityState: 'TRUSTED', // Client attempts to claim stale data is TRUSTED
        });

      expect(res.status).toBe(201);
      // Authoritative stale detection forces DEGRADED
      expect(res.body.data.qualityState).toBe('DEGRADED');
    });
  });

  describe('Patient & Ward Access Boundary Enforcement', () => {
    it('blocks nurse assigned only to WARD-B from posting observations for WARD-A patient', async () => {
      // 'ward-b-nurse-token' has assignedWardIds: ['WARD-B']
      // Patient P001 is in WARD-A
      const res = await request(app)
        .post('/api/v1/patients/P001/observations')
        .set('Authorization', 'Bearer ward-b-nurse-token')
        .send({
          heartRate: 80,
          confidence: 0.95,
          source: 'BEDSIDE_DEVICE',
        });

      expect(res.status).toBe(403);
      expect(res.body.detail).toContain("outside the clinician's assigned jurisdiction");
    });

    it('blocks unauthenticated client from accessing patient attention priority', async () => {
      const res = await request(app)
        .get('/api/v1/patients/P001/attention-priority');

      expect(res.status).toBe(401);
    });

    it('blocks unauthenticated client from accessing ward radar', async () => {
      const res = await request(app)
        .get('/api/v1/wards/WARD-A/radar');

      expect(res.status).toBe(401);
    });
  });

  describe('Security Headers & Injection Hardening', () => {
    it('includes strict Content-Security-Policy, HSTS, and X-Content-Type-Options', async () => {
      const res = await request(app).get('/health');

      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('DENY');
      expect(res.headers['content-security-policy']).toBeDefined();
      expect(res.headers['permissions-policy']).toBeDefined();
    });

    it('sanitizes and preserves safe correlation IDs, rejecting unsafe injection characters', async () => {
      const validId = 'corr-uuid-1234-5678';
      const resValid = await request(app)
        .get('/health')
        .set('x-correlation-id', validId);

      expect(resValid.headers['x-correlation-id']).toBe(validId);

      // Unsafe injection characters attempt
      const maliciousId = 'corr-123<script>alert(1)</script>';
      const resMalicious = await request(app)
        .get('/health')
        .set('x-correlation-id', maliciousId);

      // Must discard unsanitized input and generate a safe UUID
      expect(resMalicious.headers['x-correlation-id']).not.toContain('<script>');
      expect(resMalicious.headers['x-correlation-id']).toMatch(/^[0-9a-f-]{36}$/);
    });
  });
});
