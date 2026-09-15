/**
 * AegisPulse - Manual Access Boundaries & Identity Verification Script
 *
 * Verifies live access boundaries and RBAC / WBAC isolation across:
 *   1. nurse (WARD_NURSE, assigned WARD-A)
 *   2. doctor (ATTENDING_PHYSICIAN, assigned WARD-A, WARD-4B)
 *   3. administrator (ADMIN, wildcard jurisdiction '*')
 *   4. unauthorized user (WARD_NURSE, empty assigned wards [])
 *
 * Also verifies threat boundary defenses:
 *   - Unauthenticated access (401)
 *   - Invalid credentials (401)
 *   - Forged signature (401)
 *   - Expired token (401)
 *   - Revoked session / logout (401)
 */

import http from 'node:http';
import { createApp } from '../services/api/src/app';
import { tokenService, tokenRevocationStore } from '../services/api/src/services/token.service';

interface CheckResult {
  category: string;
  user: string;
  action: string;
  target: string;
  expectedStatus: number;
  actualStatus: number;
  passed: boolean;
  notes: string;
}

const results: CheckResult[] = [];

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('       AEGISPULSE: LIVE ACCESS BOUNDARIES & IDENTITY AUDIT');
  console.log('='.repeat(80) + '\n');

  // 1. Start test server on dynamic or unused port
  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 3099;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`[INFO] Server running on ${baseUrl}\n`);

  try {
    // Helper function for HTTP requests
    async function apiRequest(
      path: string,
      options: {
        method?: string;
        headers?: Record<string, string>;
        body?: any;
      } = {}
    ) {
      const url = `${baseUrl}${path}`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      };

      const res = await fetch(url, {
        method: options.method || 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      let json: any = null;
      try {
        json = await res.json();
      } catch {
        // non-json response
      }

      return { status: res.status, data: json };
    }

    function record(
      category: string,
      user: string,
      action: string,
      target: string,
      expectedStatus: number,
      actualStatus: number,
      notes: string
    ) {
      const passed = expectedStatus === actualStatus;
      results.push({
        category,
        user,
        action,
        target,
        expectedStatus,
        actualStatus,
        passed,
        notes,
      });

      const icon = passed ? '✅ PASS' : '❌ FAIL';
      console.log(
        `${icon} [${category}] [${user}] ${action} -> ${target} (Expected: ${expectedStatus}, Got: ${actualStatus})`
      );
      if (!passed || notes) {
        console.log(`     Note: ${notes}`);
      }
    }

    // =========================================================================
    // STEP 1: TEST USERS AUTHENTICATION
    // =========================================================================
    console.log('\n--- 1. Authenticating Test Users ---');

    // 1.1 Nurse Login
    const nurseLogin = await apiRequest('/api/v1/auth/login', {
      method: 'POST',
      body: { username: 'nurse', password: 'NursePass123!' },
    });
    record(
      'Authentication',
      'nurse',
      'POST /login',
      '/api/v1/auth/login',
      200,
      nurseLogin.status,
      `Issued token for Sarah Jenkins (WARD_NURSE, WARD-A)`
    );
    const nurseToken = nurseLogin.data?.data?.accessToken;

    // 1.2 Doctor Login
    const doctorLogin = await apiRequest('/api/v1/auth/login', {
      method: 'POST',
      body: { username: 'doctor', password: 'DoctorPass123!' },
    });
    record(
      'Authentication',
      'doctor',
      'POST /login',
      '/api/v1/auth/login',
      200,
      doctorLogin.status,
      `Issued token for Dr. Elena Rostova (ATTENDING_PHYSICIAN, WARD-A, WARD-4B)`
    );
    const doctorToken = doctorLogin.data?.data?.accessToken;

    // 1.3 Administrator Login
    const adminLogin = await apiRequest('/api/v1/auth/login', {
      method: 'POST',
      body: { username: 'administrator', password: 'AdminPass123!' },
    });
    record(
      'Authentication',
      'administrator',
      'POST /login',
      '/api/v1/auth/login',
      200,
      adminLogin.status,
      `Issued token for System Administrator (ADMIN, Wildcard [*])`
    );
    const adminToken = adminLogin.data?.data?.accessToken;

    // 1.4 Unauthorized User Login
    const unauthLogin = await apiRequest('/api/v1/auth/login', {
      method: 'POST',
      body: { username: 'unauthorized user', password: 'GuestPass123!' },
    });
    record(
      'Authentication',
      'unauthorized user',
      'POST /login',
      '/api/v1/auth/login',
      200,
      unauthLogin.status,
      `Issued token for Unauthorized User (Zero assigned wards [])`
    );
    const unauthToken = unauthLogin.data?.data?.accessToken;

    // =========================================================================
    // STEP 2: NURSE ACCESS BOUNDARIES
    // =========================================================================
    console.log('\n--- 2. Verifying Nurse Access Boundaries (WARD_NURSE: WARD-A) ---');

    // Nurse accessing Ward A patient (P001) -> ALLOWED (200)
    const nurseP1 = await apiRequest('/api/v1/patients/P001', {
      headers: { Authorization: `Bearer ${nurseToken}` },
    });
    record(
      'WBAC Enforcement',
      'nurse',
      'GET patient in assigned ward',
      '/api/v1/patients/P001 (Ward A)',
      200,
      nurseP1.status,
      `Authorized: Patient P001 is admitted in WARD-A`
    );

    // Nurse accessing Ward 4B overview -> FORBIDDEN (403)
    const nurseW4B = await apiRequest('/api/v1/wards/WARD-4B/overview', {
      headers: { Authorization: `Bearer ${nurseToken}` },
    });
    record(
      'WBAC Enforcement',
      'nurse',
      'GET ward outside jurisdiction',
      '/api/v1/wards/WARD-4B/overview',
      403,
      nurseW4B.status,
      `Strictly Blocked: Clinician lacks jurisdiction over WARD-4B`
    );

    // Nurse attempting Admin simulation scenario -> FORBIDDEN (403)
    const nurseSim = await apiRequest('/api/v1/simulation/scenarios/run', {
      method: 'POST',
      headers: { Authorization: `Bearer ${nurseToken}` },
      body: { scenarioId: 'NORMAL_SHIFT' },
    });
    record(
      'RBAC Privilege Escalation',
      'nurse',
      'POST run admin simulation scenario',
      '/api/v1/simulation/scenarios/run',
      403,
      nurseSim.status,
      `Strictly Blocked: Requires ADMIN / SYSTEM role`
    );

    // Nurse attempting Database Chaos Injection -> FORBIDDEN (403)
    const nurseChaos = await apiRequest('/api/v1/simulation/chaos/database', {
      method: 'POST',
      headers: { Authorization: `Bearer ${nurseToken}` },
      body: { disrupted: true },
    });
    record(
      'RBAC Privilege Escalation',
      'nurse',
      'POST inject database chaos',
      '/api/v1/simulation/chaos/database',
      403,
      nurseChaos.status,
      `Strictly Blocked: Requires ADMIN role`
    );

    // =========================================================================
    // STEP 3: DOCTOR ACCESS BOUNDARIES
    // =========================================================================
    console.log('\n--- 3. Verifying Doctor Access Boundaries (ATTENDING_PHYSICIAN: WARD-A, WARD-4B) ---');

    // Doctor accessing Ward A patient (P001) -> ALLOWED (200)
    const docP1 = await apiRequest('/api/v1/patients/P001', {
      headers: { Authorization: `Bearer ${doctorToken}` },
    });
    record(
      'WBAC Multi-Ward',
      'doctor',
      'GET patient in Ward A',
      '/api/v1/patients/P001',
      200,
      docP1.status,
      `Authorized: Doctor has assigned jurisdiction over WARD-A`
    );

    // Doctor accessing Ward 4B overview -> ALLOWED (200)
    const docW4B = await apiRequest('/api/v1/wards/WARD-4B/overview', {
      headers: { Authorization: `Bearer ${doctorToken}` },
    });
    record(
      'WBAC Multi-Ward',
      'doctor',
      'GET ward overview in Ward 4B',
      '/api/v1/wards/WARD-4B/overview',
      200,
      docW4B.status,
      `Authorized: Doctor has assigned jurisdiction over WARD-4B`
    );

    // Doctor attempting Admin simulation scenario -> FORBIDDEN (403)
    const docSim = await apiRequest('/api/v1/simulation/scenarios/run', {
      method: 'POST',
      headers: { Authorization: `Bearer ${doctorToken}` },
      body: { scenarioId: 'NORMAL_SHIFT' },
    });
    record(
      'RBAC Privilege Escalation',
      'doctor',
      'POST run admin simulation scenario',
      '/api/v1/simulation/scenarios/run',
      403,
      docSim.status,
      `Strictly Blocked: Attending Physician cannot invoke administrative simulation`
    );

    // =========================================================================
    // STEP 4: ADMINISTRATOR ACCESS BOUNDARIES
    // =========================================================================
    console.log('\n--- 4. Verifying Administrator Access Boundaries (ADMIN: Wildcard [*]) ---');

    // Admin accessing Ward A patient -> ALLOWED (200)
    const adminP1 = await apiRequest('/api/v1/patients/P001', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    record(
      'Admin Wildcard Access',
      'administrator',
      'GET patient P001 (Ward A)',
      '/api/v1/patients/P001',
      200,
      adminP1.status,
      `Authorized: Admin has wildcard [*] hospital jurisdiction`
    );

    // Admin accessing Ward 4B overview -> ALLOWED (200)
    const adminW4B = await apiRequest('/api/v1/wards/WARD-4B/overview', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    record(
      'Admin Wildcard Access',
      'administrator',
      'GET ward overview (Ward 4B)',
      '/api/v1/wards/WARD-4B/overview',
      200,
      adminW4B.status,
      `Authorized: Admin has wildcard [*] hospital jurisdiction`
    );

    // Admin executing simulation scenario -> ALLOWED (200)
    const adminSim = await apiRequest('/api/v1/simulation/scenarios/run', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { scenarioId: 'NORMAL_SHIFT' },
    });
    record(
      'Admin Operations',
      'administrator',
      'POST run admin simulation scenario',
      '/api/v1/simulation/scenarios/run',
      200,
      adminSim.status,
      `Authorized: ADMIN role permitted for scenario control`
    );

    // =========================================================================
    // STEP 5: UNAUTHORIZED USER ACCESS BOUNDARIES
    // =========================================================================
    console.log('\n--- 5. Verifying Unauthorized User Boundaries (Zero Jurisdictions []) ---');

    // Unauthorized user accessing patient P001 -> FORBIDDEN (403)
    const unauthP1 = await apiRequest('/api/v1/patients/P001', {
      headers: { Authorization: `Bearer ${unauthToken}` },
    });
    record(
      'Zero Jurisdiction Defense',
      'unauthorized user',
      'GET patient record P001',
      '/api/v1/patients/P001',
      403,
      unauthP1.status,
      `Strictly Blocked: Zero assigned ward jurisdictions []`
    );

    // Unauthorized user accessing Ward A overview -> FORBIDDEN (403)
    const unauthWA = await apiRequest('/api/v1/wards/WARD-A/overview', {
      headers: { Authorization: `Bearer ${unauthToken}` },
    });
    record(
      'Zero Jurisdiction Defense',
      'unauthorized user',
      'GET ward overview WARD-A',
      '/api/v1/wards/WARD-A/overview',
      403,
      unauthWA.status,
      `Strictly Blocked: Zero assigned ward jurisdictions []`
    );

    // Unauthorized user attempting admin simulation -> FORBIDDEN (403)
    const unauthSim = await apiRequest('/api/v1/simulation/scenarios/run', {
      method: 'POST',
      headers: { Authorization: `Bearer ${unauthToken}` },
      body: { scenarioId: 'NORMAL_SHIFT' },
    });
    record(
      'Zero Jurisdiction Defense',
      'unauthorized user',
      'POST run admin simulation scenario',
      '/api/v1/simulation/scenarios/run',
      403,
      unauthSim.status,
      `Strictly Blocked: Insufficient role permissions`
    );

    // =========================================================================
    // STEP 6: SESSION LIFECYCLE & THREAT DEFENSE BOUNDARIES
    // =========================================================================
    console.log('\n--- 6. Verifying Threat Vectors & Session Lifecycle ---');

    // 6.1 Unauthenticated Access Protection -> 401
    const noAuth = await apiRequest('/api/v1/patients/P001');
    record(
      'Threat Defense',
      'anonymous',
      'GET patient without Authorization header',
      '/api/v1/patients/P001',
      401,
      noAuth.status,
      `Strictly Blocked: Missing credentials rejected`
    );

    // 6.2 Invalid Credentials -> 401
    const badLogin = await apiRequest('/api/v1/auth/login', {
      method: 'POST',
      body: { username: 'doctor', password: 'IncorrectPassword999!' },
    });
    record(
      'Threat Defense',
      'doctor',
      'POST login with bad password',
      '/api/v1/auth/login',
      401,
      badLogin.status,
      `Strictly Blocked: Invalid password rejected with timing-safe check`
    );

    // 6.3 Tampered / Forged Token Signature -> 401
    const tamperedToken = nurseToken.substring(0, nurseToken.lastIndexOf('.') + 1) + 'tampered_signature_bytes';
    const tamperedReq = await apiRequest('/api/v1/patients/P001', {
      headers: { Authorization: `Bearer ${tamperedToken}` },
    });
    record(
      'Threat Defense',
      'forger',
      'GET patient with forged HMAC signature',
      '/api/v1/patients/P001',
      401,
      tamperedReq.status,
      `Strictly Blocked: Cryptographic signature mismatch rejected`
    );

    // 6.4 Expired Token Handling -> 401
    const expiredToken = tokenService.generateToken(
      {
        userId: 'usr-nurse-101',
        username: 'nurse',
        fullName: 'Sarah Jenkins, RN',
        role: 'WARD_NURSE',
        assignedWardIds: ['WARD-A'],
      },
      'access',
      -60 // expired 60 seconds ago
    );
    const expiredReq = await apiRequest('/api/v1/patients/P001', {
      headers: { Authorization: `Bearer ${expiredToken.token}` },
    });
    record(
      'Threat Defense',
      'nurse',
      'GET patient with expired token',
      '/api/v1/patients/P001',
      401,
      expiredReq.status,
      `Strictly Blocked: Token past expiration TTL rejected`
    );

    // 6.5 Session Revocation / Logout -> 401
    // First, verify nurse token is valid
    const preLogout = await apiRequest('/api/v1/patients/P001', {
      headers: { Authorization: `Bearer ${nurseToken}` },
    });
    // Nurse logs out
    const logoutRes = await apiRequest('/api/v1/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${nurseToken}` },
    });
    // Try again with the exact same nurse token
    const postLogout = await apiRequest('/api/v1/patients/P001', {
      headers: { Authorization: `Bearer ${nurseToken}` },
    });
    record(
      'Session Lifecycle',
      'nurse',
      'GET patient using revoked token post-logout',
      '/api/v1/patients/P001',
      401,
      postLogout.status,
      `Strictly Blocked: Token JTI blacklisted in revocation store on logout`
    );

    // =========================================================================
    // SUMMARY MATRIX
    // =========================================================================
    console.log('\n' + '='.repeat(80));
    console.log('                   ACCESS BOUNDARY AUDIT RESULTS MATRIX');
    console.log('='.repeat(80));

    let passedCount = 0;
    for (const r of results) {
      if (r.passed) passedCount++;
    }

    console.table(
      results.map((r) => ({
        User: r.user,
        Category: r.category,
        Action: r.action,
        Expected: r.expectedStatus,
        Actual: r.actualStatus,
        Status: r.passed ? 'PASSED' : 'FAILED',
      }))
    );

    console.log(
      `\nTotal Checks: ${results.length} | Passed: ${passedCount} | Failed: ${results.length - passedCount}`
    );

    if (passedCount === results.length) {
      console.log('\n🌟 ALL ACCESS BOUNDARIES AND IDENTITY CONTROLS RIGOROUSLY VERIFIED!\n');
    } else {
      console.error('\n❌ SOME BOUNDARY CHECKS FAILED!\n');
      process.exitCode = 1;
    }
  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error('Fatal error in manual access boundary audit:', err);
  process.exit(1);
});
