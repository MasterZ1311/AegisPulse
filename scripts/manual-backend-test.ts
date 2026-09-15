import { spawn, ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';
import { unlinkSync, existsSync } from 'node:fs';

const TEST_PORT = 3005;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
const TEST_DB_PATH = resolve(process.cwd(), 'data', 'manual_test_aegispulse.db');

interface TestResult {
  scenario: string;
  expectedStatus: number;
  actualStatus: number;
  passed: boolean;
  notes: string;
  responseSnippet: string;
}

const results: TestResult[] = [];

function logSection(title: string) {
  console.log('\n' + '='.repeat(80));
  console.log(`  ${title}`);
  console.log('='.repeat(80));
}

function logScenario(num: number, title: string) {
  console.log(`\n[SCENARIO ${num}/12] ${title}`);
  console.log('-'.repeat(60));
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForServerReady(maxWaitMs = 15000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const res = await fetch(`${BASE_URL}/ready`);
      if (res.status === 200) {
        return true;
      }
    } catch {
      // Server not accepting connections yet
    }
    await sleep(250);
  }
  return false;
}

function spawnServer(): ChildProcess {
  const env = {
    ...process.env,
    PORT: String(TEST_PORT),
    HOST: '127.0.0.1',
    AEGIS_DB_PATH: TEST_DB_PATH,
    NODE_ENV: 'test',
    ALLOW_DEV_TEST_TOKENS: 'false',
    ALLOW_HEADER_AUTH: 'false',
    JWT_SECRET: 'test_csprng_jwt_secret_key_minimum_32_chars_ok!',
    SKIP_DOTENV: 'true',
  };

  const child = spawn(
    'npx',
    ['tsx', 'services/api/src/index.ts'],
    {
      cwd: process.cwd(),
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
    }
  );

  child.stdout?.on('data', (data) => {
    const str = data.toString().trim();
    if (str.includes('[AegisPulse API]') || str.includes('FATAL')) {
      console.log(`  [Server Out] ${str}`);
    }
  });

  child.stderr?.on('data', (data) => {
    const str = data.toString().trim();
    if (str && !str.includes('Debugger attached')) {
      console.error(`  [Server Err] ${str}`);
    }
  });

  return child;
}

async function stopServer(child: ChildProcess): Promise<void> {
  if (child.pid) {
    return new Promise((resolve) => {
      child.on('exit', () => resolve());
      // Windows taskkill to ensure child process tree is stopped
      const killer = spawn('taskkill', ['/pid', String(child.pid), '/f', '/t'], { shell: true });
      killer.on('close', () => resolve());
      setTimeout(resolve, 3000);
    });
  }
}

async function runManualTestSuite() {
  logSection('AEGISPULSE BACKEND MANUAL VERIFICATION SUITE');
  console.log(`Target Port: ${TEST_PORT}`);
  console.log(`Target Database: ${TEST_DB_PATH}`);

  // Clean test DB if exists
  if (existsSync(TEST_DB_PATH)) {
    try {
      unlinkSync(TEST_DB_PATH);
    } catch {
      // ignore
    }
  }

  // --------------------------------------------------------------------------
  // STEP 1: Start Backend Server
  // --------------------------------------------------------------------------
  logSection('STARTING AEGISPULSE BACKEND INSTANCE');
  let serverProcess = spawnServer();
  const ready = await waitForServerReady();
  if (!ready) {
    console.error('FATAL: Backend server failed to become ready within timeout.');
    await stopServer(serverProcess);
    process.exit(1);
  }
  console.log(`Backend online and healthy at ${BASE_URL}\n`);

  // --------------------------------------------------------------------------
  // 1. Valid Request
  // --------------------------------------------------------------------------
  logScenario(1, 'valid request');
  try {
    const res = await fetch(`${BASE_URL}/api/v1/patients/P001/observations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer nurse-token',
      },
      body: JSON.stringify({
        heartRate: 76,
        systolicBP: 120,
        diastolicBP: 80,
        respiratoryRate: 16,
        spo2: 98,
        temperature: 37.0,
        source: 'BEDSIDE_DEVICE',
      }),
    });

    const body = await res.json();
    const passed = res.status === 201 && body.data?.shockIndex === 0.63 && body.data?.qualityState === 'TRUSTED';
    const snippet = JSON.stringify(body, null, 2).slice(0, 250);

    console.log(`HTTP Status: ${res.status} (Expected: 201)`);
    console.log(`Response Snippet:\n${snippet}`);
    results.push({
      scenario: '1. valid request',
      expectedStatus: 201,
      actualStatus: res.status,
      passed,
      notes: 'Observation ingested, server authoritatively computed shockIndex = 0.63',
      responseSnippet: snippet,
    });
  } catch (err: any) {
    results.push({
      scenario: '1. valid request',
      expectedStatus: 201,
      actualStatus: 0,
      passed: false,
      notes: `Exception: ${err.message}`,
      responseSnippet: '',
    });
  }

  // --------------------------------------------------------------------------
  // 2. Invalid Request
  // --------------------------------------------------------------------------
  logScenario(2, 'invalid request');
  try {
    const res = await fetch(`${BASE_URL}/api/v1/patients/P001/observations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer nurse-token',
      },
      body: JSON.stringify({
        heartRate: 999, // Exceeds max 300
        respiratoryRate: -5, // Below min 2
      }),
    });

    const body = await res.json();
    const passed = res.status === 400 && (body.code === 'BAD_REQUEST' || body.status === 400);
    const snippet = JSON.stringify(body, null, 2).slice(0, 250);

    console.log(`HTTP Status: ${res.status} (Expected: 400)`);
    console.log(`Response Snippet:\n${snippet}`);
    results.push({
      scenario: '2. invalid request',
      expectedStatus: 400,
      actualStatus: res.status,
      passed,
      notes: 'Zod validation intercepted out-of-range vitals with RFC 7807 Bad Request details',
      responseSnippet: snippet,
    });
  } catch (err: any) {
    results.push({
      scenario: '2. invalid request',
      expectedStatus: 400,
      actualStatus: 0,
      passed: false,
      notes: `Exception: ${err.message}`,
      responseSnippet: '',
    });
  }

  // --------------------------------------------------------------------------
  // 3. Missing Auth
  // --------------------------------------------------------------------------
  logScenario(3, 'missing auth');
  try {
    const res = await fetch(`${BASE_URL}/api/v1/patients/P001/observations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        heartRate: 75,
      }),
    });

    const body = await res.json();
    const passed = res.status === 401 && body.code === 'UNAUTHORIZED';
    const snippet = JSON.stringify(body, null, 2).slice(0, 250);

    console.log(`HTTP Status: ${res.status} (Expected: 401)`);
    console.log(`Response Snippet:\n${snippet}`);
    results.push({
      scenario: '3. missing auth',
      expectedStatus: 401,
      actualStatus: res.status,
      passed,
      notes: 'Authentication middleware rejected request without credentials',
      responseSnippet: snippet,
    });
  } catch (err: any) {
    results.push({
      scenario: '3. missing auth',
      expectedStatus: 401,
      actualStatus: 0,
      passed: false,
      notes: `Exception: ${err.message}`,
      responseSnippet: '',
    });
  }

  // --------------------------------------------------------------------------
  // 4. Wrong User
  // --------------------------------------------------------------------------
  logScenario(4, 'wrong user');
  try {
    const res = await fetch(`${BASE_URL}/api/v1/patients/P001/observations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer forged-or-expired-clinician-token-xyz',
      },
      body: JSON.stringify({
        heartRate: 75,
      }),
    });

    const body = await res.json();
    const passed = res.status === 401 && body.code === 'UNAUTHORIZED';
    const snippet = JSON.stringify(body, null, 2).slice(0, 250);

    console.log(`HTTP Status: ${res.status} (Expected: 401)`);
    console.log(`Response Snippet:\n${snippet}`);
    results.push({
      scenario: '4. wrong user',
      expectedStatus: 401,
      actualStatus: res.status,
      passed,
      notes: 'Unrecognized / forged bearer token blocked with 401 Unauthorized',
      responseSnippet: snippet,
    });
  } catch (err: any) {
    results.push({
      scenario: '4. wrong user',
      expectedStatus: 401,
      actualStatus: 0,
      passed: false,
      notes: `Exception: ${err.message}`,
      responseSnippet: '',
    });
  }

  // --------------------------------------------------------------------------
  // 5. Wrong Ward
  // --------------------------------------------------------------------------
  logScenario(5, 'wrong ward');
  try {
    // ward-b-nurse-token is assigned only to ['WARD-B']; P001 is assigned to WARD-A
    const res = await fetch(`${BASE_URL}/api/v1/patients/P001`, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer ward-b-nurse-token',
      },
    });

    const body = await res.json();
    const passed = res.status === 403 && body.code === 'FORBIDDEN';
    const snippet = JSON.stringify(body, null, 2).slice(0, 250);

    console.log(`HTTP Status: ${res.status} (Expected: 403)`);
    console.log(`Response Snippet:\n${snippet}`);
    results.push({
      scenario: '5. wrong ward',
      expectedStatus: 403,
      actualStatus: res.status,
      passed,
      notes: "Ward-scoped RBAC prevented Ward-B nurse from accessing Ward-A patient's record",
      responseSnippet: snippet,
    });
  } catch (err: any) {
    results.push({
      scenario: '5. wrong ward',
      expectedStatus: 403,
      actualStatus: 0,
      passed: false,
      notes: `Exception: ${err.message}`,
      responseSnippet: '',
    });
  }

  // --------------------------------------------------------------------------
  // 6. Wrong Patient
  // --------------------------------------------------------------------------
  logScenario(6, 'wrong patient');
  try {
    // A: Non-existent patient ID
    const resA = await fetch(`${BASE_URL}/api/v1/patients/P999`, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer nurse-token',
      },
    });
    const bodyA = await resA.json();

    // B: Injecting foreign patientId in body of P001 observation
    const resB = await fetch(`${BASE_URL}/api/v1/patients/P001/observations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer nurse-token',
      },
      body: JSON.stringify({
        patientId: 'P002', // Foreign patient ID injected into P001 endpoint
        heartRate: 75,
      }),
    });
    const bodyB = await resB.json();

    const passed = resA.status === 404 && resB.status === 400;
    const snippet = `GET /patients/P999 -> ${resA.status} (${bodyA.detail || bodyA.code})\nPOST /patients/P001 with patientId:P002 -> ${resB.status} (${bodyB.detail || bodyB.code})`;

    console.log(`HTTP Status (Non-existent): ${resA.status} (Expected: 404)`);
    console.log(`HTTP Status (Body Mismatch): ${resB.status} (Expected: 400)`);
    console.log(`Summary:\n${snippet}`);
    results.push({
      scenario: '6. wrong patient',
      expectedStatus: 404,
      actualStatus: resA.status,
      passed,
      notes: 'Non-existent patient returns 404 Not Found; body patientId injection returns 400 Bad Request',
      responseSnippet: snippet,
    });
  } catch (err: any) {
    results.push({
      scenario: '6. wrong patient',
      expectedStatus: 404,
      actualStatus: 0,
      passed: false,
      notes: `Exception: ${err.message}`,
      responseSnippet: '',
    });
  }

  // --------------------------------------------------------------------------
  // 7. Duplicate Event
  // --------------------------------------------------------------------------
  logScenario(7, 'duplicate event');
  try {
    const idempotencyKey = `idemp-manual-test-${Date.now()}`;
    const payload = {
      heartRate: 84,
      systolicBP: 122,
      diastolicBP: 80,
    };

    // First attempt: 201 Created
    const res1 = await fetch(`${BASE_URL}/api/v1/patients/P001/observations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer nurse-token',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(payload),
    });
    const body1 = await res1.json();

    // Second attempt with identical idempotency key: 409 Conflict
    const res2 = await fetch(`${BASE_URL}/api/v1/patients/P001/observations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer nurse-token',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(payload),
    });
    const body2 = await res2.json();

    const passed = res1.status === 201 && res2.status === 409 && body2.code === 'DUPLICATE_ENTITY';
    const snippet = `Attempt 1: ${res1.status} Created\nAttempt 2 (duplicate): ${res2.status} Conflict (${body2.code}: ${body2.detail})`;

    console.log(`HTTP Status Attempt 1: ${res1.status} (Expected: 201)`);
    console.log(`HTTP Status Attempt 2: ${res2.status} (Expected: 409)`);
    console.log(`Response Snippet:\n${snippet}`);
    results.push({
      scenario: '7. duplicate event',
      expectedStatus: 409,
      actualStatus: res2.status,
      passed,
      notes: 'Persistent idempotency ledger detected replay and rejected duplicate event with 409 Conflict',
      responseSnippet: snippet,
    });
  } catch (err: any) {
    results.push({
      scenario: '7. duplicate event',
      expectedStatus: 409,
      actualStatus: 0,
      passed: false,
      notes: `Exception: ${err.message}`,
      responseSnippet: '',
    });
  }

  // --------------------------------------------------------------------------
  // 8. Stale Event
  // --------------------------------------------------------------------------
  logScenario(8, 'stale event');
  try {
    // 10 days in the past (exceeds allowable 7 day boundary)
    const staleTimestamp = Date.now() - 10 * 86400000;
    const res = await fetch(`${BASE_URL}/api/v1/patients/P001/observations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer nurse-token',
      },
      body: JSON.stringify({
        timestamp: staleTimestamp,
        heartRate: 75,
      }),
    });

    const body = await res.json();
    const passed = res.status === 400 && String(body.message || body.detail).includes('too far in the past');
    const snippet = JSON.stringify(body, null, 2).slice(0, 250);

    console.log(`HTTP Status: ${res.status} (Expected: 400)`);
    console.log(`Response Snippet:\n${snippet}`);
    results.push({
      scenario: '8. stale event',
      expectedStatus: 400,
      actualStatus: res.status,
      passed,
      notes: 'Rejected telemetry event older than 7 days threshold with 400 Bad Request',
      responseSnippet: snippet,
    });
  } catch (err: any) {
    results.push({
      scenario: '8. stale event',
      expectedStatus: 400,
      actualStatus: 0,
      passed: false,
      notes: `Exception: ${err.message}`,
      responseSnippet: '',
    });
  }

  // --------------------------------------------------------------------------
  // 9. Huge Payload
  // --------------------------------------------------------------------------
  logScenario(9, 'huge payload');
  try {
    // Generate > 1.2 MB JSON string
    const hugeString = 'X'.repeat(1200000);
    const res = await fetch(`${BASE_URL}/api/v1/patients/P001/observations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer nurse-token',
      },
      body: JSON.stringify({
        heartRate: 75,
        hugeBlob: hugeString,
      }),
    });

    const body = await res.json();
    const passed = res.status === 413 && body.code === 'PAYLOAD_TOO_LARGE';
    const snippet = JSON.stringify(body, null, 2).slice(0, 250);

    console.log(`HTTP Status: ${res.status} (Expected: 413)`);
    console.log(`Response Snippet:\n${snippet}`);
    results.push({
      scenario: '9. huge payload',
      expectedStatus: 413,
      actualStatus: res.status,
      passed,
      notes: 'Request size limiter intercepted 1.2MB body and returned 413 Payload Too Large',
      responseSnippet: snippet,
    });
  } catch (err: any) {
    results.push({
      scenario: '9. huge payload',
      expectedStatus: 413,
      actualStatus: 0,
      passed: false,
      notes: `Exception: ${err.message}`,
      responseSnippet: '',
    });
  }

  // --------------------------------------------------------------------------
  // 10. Malformed JSON
  // --------------------------------------------------------------------------
  logScenario(10, 'malformed JSON');
  try {
    const res = await fetch(`${BASE_URL}/api/v1/patients/P001/observations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer nurse-token',
      },
      body: '{"heartRate": 75, "unterminated_string: ',
    });

    const body = await res.json();
    const passed = res.status === 400 && body.code === 'MALFORMED_JSON';
    const snippet = JSON.stringify(body, null, 2).slice(0, 250);

    console.log(`HTTP Status: ${res.status} (Expected: 400)`);
    console.log(`Response Snippet:\n${snippet}`);
    results.push({
      scenario: '10. malformed JSON',
      expectedStatus: 400,
      actualStatus: res.status,
      passed,
      notes: 'JSON parser syntax error trapped and returned RFC 7807 400 Malformed JSON',
      responseSnippet: snippet,
    });
  } catch (err: any) {
    results.push({
      scenario: '10. malformed JSON',
      expectedStatus: 400,
      actualStatus: 0,
      passed: false,
      notes: `Exception: ${err.message}`,
      responseSnippet: '',
    });
  }

  // --------------------------------------------------------------------------
  // 11. Server Restart
  // --------------------------------------------------------------------------
  logScenario(11, 'server restart');
  try {
    const uniqueNote = `RESTART_CHECK_${Date.now()}`;

    // Step A: Ingest observation before restart
    const preRes = await fetch(`${BASE_URL}/api/v1/patients/P001/observations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer nurse-token',
      },
      body: JSON.stringify({
        heartRate: 91,
        notes: uniqueNote,
      }),
    });
    console.log(`Pre-restart write status: ${preRes.status}`);

    // Step B: Terminate server instance
    console.log('Sending shutdown signal to server process...');
    await stopServer(serverProcess);
    await sleep(1000);

    // Step C: Spawn new server instance pointing to identical persistent SQLite DB
    console.log('Restarting server process with persistent database...');
    serverProcess = spawnServer();
    const rebootReady = await waitForServerReady();
    console.log(`Reboot ready status: ${rebootReady}`);

    // Step D: Verify observation persisted across cold restart
    const getRes = await fetch(`${BASE_URL}/api/v1/patients/P001/observations`, {
      headers: {
        Authorization: 'Bearer nurse-token',
      },
    });
    const getBody = await getRes.json();
    const observations = getBody.data || [];
    const persisted = observations.some((o: any) => o.heartRate === 91);

    const passed = rebootReady && getRes.status === 200 && persisted;
    const snippet = `Server stopped, restarted with ${TEST_DB_PATH}.\nQueried observations: found ${observations.length} items (verified pre-restart observation with HR=91 persisted).`;

    console.log(`HTTP Status: ${getRes.status} (Expected: 200)`);
    console.log(`Snippet:\n${snippet}`);
    results.push({
      scenario: '11. server restart',
      expectedStatus: 200,
      actualStatus: getRes.status,
      passed,
      notes: 'Server gracefully shut down, restarted cleanly, and persistent SQLite database preserved clinical state',
      responseSnippet: snippet,
    });
  } catch (err: any) {
    results.push({
      scenario: '11. server restart',
      expectedStatus: 200,
      actualStatus: 0,
      passed: false,
      notes: `Exception: ${err.message}`,
      responseSnippet: '',
    });
  }

  // --------------------------------------------------------------------------
  // 12. Database Unavailable
  // --------------------------------------------------------------------------
  logScenario(12, 'database unavailable');
  try {
    // Step A: Trigger database disruption via chaos endpoint
    const chaosRes = await fetch(`${BASE_URL}/api/v1/simulation/chaos/database`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer admin-token',
      },
      body: JSON.stringify({ disrupted: true }),
    });
    console.log(`Chaos disruption activated: status ${chaosRes.status}`);

    // Step B: Probe readiness endpoint (must return 503 degraded)
    const readyRes = await fetch(`${BASE_URL}/ready`);
    const readyBody = await readyRes.json();

    // Step C: Probe data endpoint (must return 503 database unavailable)
    const dataRes = await fetch(`${BASE_URL}/api/v1/patients/P001`, {
      headers: {
        Authorization: 'Bearer nurse-token',
      },
    });
    const dataBody = await dataRes.json();

    // Step D: Restore database to healthy
    const restoreRes = await fetch(`${BASE_URL}/api/v1/simulation/chaos/database`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer admin-token',
      },
      body: JSON.stringify({ disrupted: false }),
    });
    console.log(`Chaos disruption restored: status ${restoreRes.status}`);

    // Step E: Verify readiness restored to 200
    const finalReadyRes = await fetch(`${BASE_URL}/ready`);

    const passed =
      readyRes.status === 503 &&
      dataRes.status === 503 &&
      dataBody.code === 'DATABASE_UNAVAILABLE' &&
      finalReadyRes.status === 200;

    const snippet = `Readiness while disrupted: HTTP ${readyRes.status} (${readyBody.status || readyBody.message})\nData endpoint while disrupted: HTTP ${dataRes.status} (${dataBody.code}: ${dataBody.detail})\nReadiness after recovery: HTTP ${finalReadyRes.status}`;

    console.log(`Readiness Status (Disrupted): ${readyRes.status} (Expected: 503)`);
    console.log(`Data Status (Disrupted): ${dataRes.status} (Expected: 503)`);
    console.log(`Readiness Status (Recovered): ${finalReadyRes.status} (Expected: 200)`);
    console.log(`Snippet:\n${snippet}`);
    results.push({
      scenario: '12. database unavailable',
      expectedStatus: 503,
      actualStatus: readyRes.status,
      passed,
      notes: 'Readiness probe and data endpoints correctly returned 503 Service Unavailable when DB degraded, then self-healed',
      responseSnippet: snippet,
    });
  } catch (err: any) {
    results.push({
      scenario: '12. database unavailable',
      expectedStatus: 503,
      actualStatus: 0,
      passed: false,
      notes: `Exception: ${err.message}`,
      responseSnippet: '',
    });
  }

  // --------------------------------------------------------------------------
  // Teardown Server
  // --------------------------------------------------------------------------
  logSection('SHUTTING DOWN TEST BACKEND INSTANCE');
  await stopServer(serverProcess);
  console.log('Test backend instance terminated.');

  // Clean up test database file
  if (existsSync(TEST_DB_PATH)) {
    try {
      unlinkSync(TEST_DB_PATH);
    } catch {
      // ignore
    }
  }

  // --------------------------------------------------------------------------
  // SUMMARY REPORT
  // --------------------------------------------------------------------------
  logSection('MANUAL VERIFICATION SUITE RESULTS SUMMARY');
  console.log(
    '| Scenario | Expected Status | Actual Status | Result | Operational Note |'
  );
  console.log(
    '| :--- | :---: | :---: | :---: | :--- |'
  );
  for (const r of results) {
    const mark = r.passed ? 'PASS [OK]' : 'FAIL [X]';
    console.log(
      `| ${r.scenario.padEnd(26)} | ${String(r.expectedStatus).padEnd(15)} | ${String(r.actualStatus).padEnd(13)} | ${mark.padEnd(9)} | ${r.notes} |`
    );
  }

  const allPassed = results.every((r) => r.passed);
  console.log('\n' + '='.repeat(80));
  if (allPassed) {
    console.log('  ALL 12/12 MANUAL TEST SCENARIOS PASSED WITH PERFECT FIDELITY');
  } else {
    console.log('  SOME SCENARIOS FAILED. CHECK LOGS ABOVE.');
  }
  console.log('='.repeat(80) + '\n');

  if (!allPassed) {
    process.exit(1);
  }
}

runManualTestSuite().catch((err) => {
  console.error('Test Suite Uncaught Error:', err);
  process.exit(1);
});
