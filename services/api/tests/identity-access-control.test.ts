import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { tokenService, tokenRevocationStore } from '../src/services/token.service';
import { validatePasswordPolicy } from '../src/routes/v1/auth';

describe('Identity, Authentication & Access-Control Security Suite', () => {
  const app = createApp();

  beforeEach(() => {
    tokenRevocationStore.reset();
  });

  // ==========================================================================
  // 1. Unauthenticated Access Protection
  // ==========================================================================
  describe('1. Unauthenticated Access Protection', () => {
    it('strictly blocks requests missing authorization header with 401 Unauthorized', async () => {
      const res = await request(app).get('/api/v1/patients/P001');

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
      expect(res.body.detail).toContain('Authorization header (Bearer <token>) or x-api-key is required');
    });

    it('strictly blocks clinical observation ingestion without credentials with 401 Unauthorized', async () => {
      const res = await request(app)
        .post('/api/v1/patients/P001/observations')
        .send({ heartRate: 75 });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });
  });

  // ==========================================================================
  // 2. Expired Sessions & Token Expiration
  // ==========================================================================
  describe('2. Expired Sessions & Token Expiration', () => {
    it('strictly rejects access tokens that have exceeded their expiration TTL', async () => {
      // Generate a token that expired 10 seconds ago
      const expiredToken = tokenService.generateToken(
        {
          userId: 'usr-nurse-101',
          username: 'nurse',
          fullName: 'Sarah Jenkins, RN',
          role: 'WARD_NURSE',
          assignedWardIds: ['WARD-A'],
        },
        'access',
        -10 // Expired 10s ago
      );

      const res = await request(app)
        .get('/api/v1/patients/P001')
        .set('Authorization', `Bearer ${expiredToken.token}`);

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
      expect(res.body.detail).toContain('Token expired');
    });
  });

  // ==========================================================================
  // 3. Invalid Credentials & Forged Token Signatures
  // ==========================================================================
  describe('3. Invalid Credentials & Tamper Defense', () => {
    it('rejects login attempts with incorrect password with 401 Unauthorized', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: 'nurse',
          password: 'WrongPassword999!',
        });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
      expect(res.body.detail).toBe('Invalid username or password.');
    });

    it('rejects login attempts for non-existent users with 401 Unauthorized', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: 'non_existent_doctor',
          password: 'Password123!',
        });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });

    it('rejects cryptographically forged or tampered token signatures', async () => {
      // Generate legitimate token
      const legit = tokenService.generateToken({
        userId: 'usr-nurse-101',
        username: 'nurse',
        fullName: 'Sarah Jenkins, RN',
        role: 'WARD_NURSE',
        assignedWardIds: ['WARD-A'],
      });

      // Tamper with payload segment to escalate to ADMIN
      const segments = legit.token.split('.');
      const tamperedPayload = Buffer.from(
        JSON.stringify({
          sub: 'usr-nurse-101',
          username: 'nurse',
          role: 'ADMIN',
          assignedWardIds: ['*'],
          type: 'access',
          exp: Math.floor(Date.now() / 1000) + 3600,
        })
      ).toString('base64url');

      const forgedToken = `${segments[0]}.${tamperedPayload}.${segments[2]}`;

      const res = await request(app)
        .get('/api/v1/patients/P001')
        .set('Authorization', `Bearer ${forgedToken}`);

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
      expect(res.body.detail).toContain('Invalid token signature');
    });
  });

  // ==========================================================================
  // 4. Privilege Escalation (Vertical RBAC Defense)
  // ==========================================================================
  describe('4. Privilege Escalation & Administrative Protection', () => {
    it('blocks WARD_NURSE from accessing ADMIN simulation execution endpoints', async () => {
      // Login as nurse
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: 'nurse',
          password: 'NursePass123!',
        });

      const token = loginRes.body.data.accessToken;

      // Attempt to run simulation scenario (Admin / System only)
      const res = await request(app)
        .post('/api/v1/simulation/scenarios/run')
        .set('Authorization', `Bearer ${token}`)
        .send({ scenarioId: 'NORMAL_SHIFT' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
      expect(res.body.detail).toContain('User role \'WARD_NURSE\' is not authorized');
    });

    it('blocks WARD_NURSE from triggering database chaos disruption', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: 'nurse',
          password: 'NursePass123!',
        });

      const token = loginRes.body.data.accessToken;

      const res = await request(app)
        .post('/api/v1/simulation/chaos/database')
        .set('Authorization', `Bearer ${token}`)
        .send({ disrupted: true });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });
  });

  // ==========================================================================
  // 5. Horizontal Access & Cross-Ward Jurisdiction (WBAC Defense)
  // ==========================================================================
  describe('5. Horizontal Access & Multi-Tenant Ward Scoping', () => {
    it('strictly forbids clinician assigned only to WARD-B from accessing patient in WARD-A', async () => {
      // Patient P001 belongs to WARD-A.
      // Use token for clinician assigned strictly to WARD-B
      const res = await request(app)
        .get('/api/v1/patients/P001')
        .set('Authorization', 'Bearer ward-b-nurse-token');

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
      expect(res.body.detail).toContain('outside the clinician\'s assigned jurisdiction [WARD-B]');
    });

    it('strictly forbids clinician from accessing ward overview outside their jurisdiction', async () => {
      const res = await request(app)
        .get('/api/v1/wards/WARD-4B/overview')
        .set('Authorization', 'Bearer resident-token'); // Assigned only to WARD-A

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
      expect(res.body.detail).toContain('Clinical jurisdiction denied');
    });
  });

  // ==========================================================================
  // 6. Admin Privileges & Legitimate High-Privilege Access
  // ==========================================================================
  describe('6. Admin Privileges & System Oversight', () => {
    it('permits ADMIN user to trigger simulation scenario execution (testing administrator username)', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: 'administrator',
          password: 'AdminPass123!',
        });

      expect(loginRes.status).toBe(200);
      const token = loginRes.body.data.accessToken;

      const res = await request(app)
        .post('/api/v1/simulation/scenarios/run')
        .set('Authorization', `Bearer ${token}`)
        .send({ scenarioId: 'NORMAL_SHIFT' });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('activated successfully');
    });

    it('permits ADMIN full hospital-wide jurisdiction across all wards (*)', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: 'admin',
          password: 'AdminPass123!',
        });

      const token = loginRes.body.data.accessToken;

      const resA = await request(app)
        .get('/api/v1/patients/P001')
        .set('Authorization', `Bearer ${token}`);

      expect(resA.status).toBe(200);
      expect(resA.body.data.id).toBe('P001');
    });
  });

  // ==========================================================================
  // 7. Revoked Sessions & Logout Flow
  // ==========================================================================
  describe('7. Session Revocation & Logout Flow', () => {
    it('revokes access token upon logout, preventing any subsequent use', async () => {
      // 1. Log in to obtain active token
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: 'doctor',
          password: 'DoctorPass123!',
        });

      const token = loginRes.body.data.accessToken;

      // 2. Verify token works before logout
      const preRes = await request(app)
        .get('/api/v1/patients/P001')
        .set('Authorization', `Bearer ${token}`);
      expect(preRes.status).toBe(200);

      // 3. Perform logout
      const logoutRes = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.message).toContain('logged out and session revoked');

      // 4. Verify identical token is now rejected
      const postRes = await request(app)
        .get('/api/v1/patients/P001')
        .set('Authorization', `Bearer ${token}`);

      expect(postRes.status).toBe(401);
      expect(postRes.body.code).toBe('UNAUTHORIZED');
      expect(postRes.body.detail).toContain('Token has been revoked / logged out');
    });
  });

  // ==========================================================================
  // 8. Refresh Token Lifecycle & Stale Token Handling
  // ==========================================================================
  describe('8. Refresh Token Lifecycle & Stale Token Handling', () => {
    it('exchanges a valid refresh token for a fresh access token', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: 'nurse',
          password: 'NursePass123!',
        });

      const refreshToken = loginRes.body.data.refreshToken;

      const refreshRes = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken });

      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body.data).toHaveProperty('accessToken');
      expect(refreshRes.body.data.tokenType).toBe('Bearer');

      // Verify the new access token is usable
      const testRes = await request(app)
        .get('/api/v1/patients/P001')
        .set('Authorization', `Bearer ${refreshRes.body.data.accessToken}`);

      expect(testRes.status).toBe(200);
    });

    it('rejects an invalid or forged refresh token with 401 Unauthorized', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'totally.invalid.token' });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });

    it('rejects using an access token as a refresh token', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: 'nurse',
          password: 'NursePass123!',
        });

      const accessToken = loginRes.body.data.accessToken;

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: accessToken });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
      expect(res.body.detail).toContain('Expected \'refresh\', got \'access\'');
    });
  });

  // ==========================================================================
  // 9. Unauthorized User (Zero Ward Jurisdiction)
  // ==========================================================================
  describe('9. Unauthorized User Account (Zero Jurisdiction)', () => {
    it('forbids users with empty assigned wards from accessing any clinical ward', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: 'unauthorized user',
          password: 'GuestPass123!',
        });

      expect(loginRes.status).toBe(200);
      const token = loginRes.body.data.accessToken;

      // Attempt patient access
      const resPatient = await request(app)
        .get('/api/v1/patients/P001')
        .set('Authorization', `Bearer ${token}`);

      expect(resPatient.status).toBe(403);
      expect(resPatient.body.code).toBe('FORBIDDEN');

      // Attempt ward access
      const resWard = await request(app)
        .get('/api/v1/wards/WARD-A/overview')
        .set('Authorization', `Bearer ${token}`);

      expect(resWard.status).toBe(403);
      expect(resWard.body.code).toBe('FORBIDDEN');
    });
  });

  // ==========================================================================
  // 10. Password Policy Verification
  // ==========================================================================
  describe('10. Password Policy Validation', () => {
    it('enforces minimum 8 characters and alphanumeric complexity', () => {
      expect(validatePasswordPolicy('short1').valid).toBe(false);
      expect(validatePasswordPolicy('alllettersnohere').valid).toBe(false);
      expect(validatePasswordPolicy('1234567890').valid).toBe(false);
      expect(validatePasswordPolicy('ValidPass123!').valid).toBe(true);
    });
  });
});
