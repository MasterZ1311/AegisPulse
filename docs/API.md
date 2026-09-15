# AegisPulse REST & Real-Time Streaming API Specification

**Document Status:** AUTHORITATIVE SPECIFICATION (AUDITED)  
**Governing Source:** `services/api/src/routes/v1`  
**OpenAPI 3.0 Specification:** [`docs/openapi.yaml`](file:///e:/AegisPulse/docs/openapi.yaml)  
**Security Standard:** RFC 7807 Problem Details for HTTP APIs, JWT Bearer Token, Zero-Fabrication Invariants  

---

## 1. Authentication, Authorization & Standard Error Contracts

### 1.1 Authentication & Jurisdiction
- **Bearer Token**: `Authorization: Bearer <JWT_ACCESS_TOKEN>`
- **Assigned Jurisdictions**: Users possess specific ward jurisdictions (`assignedWardIds: ['WARD-A']` or wildcard `['*']`).
- **Role Hierarchy**:
  - `WARD_NURSE`: Bedside vitals, manual observations, alert acknowledgements, action proposals.
  - `CHARGE_NURSE`: Cross-ward surveillance, action status updates.
  - `RESIDENT_PHYSICIAN` / `ATTENDING_PHYSICIAN`: Clinical assessments, SBAR consults, action approvals.
  - `ADMIN` / `SYSTEM`: Simulation scenario controls, chaos injection, global audit queries.

### 1.2 RFC 7807 Standard Error Format (`ProblemDetails`)
All API error responses adhere strictly to RFC 7807:

```json
{
  "type": "https://aegispulse.internal/errors/BAD_REQUEST",
  "title": "BadRequest",
  "status": 400,
  "detail": "Request validation failed",
  "instance": "/api/v1/patients/P001/observations",
  "code": "BAD_REQUEST",
  "requestId": "req-9f2b8a7c-4821",
  "details": [
    {
      "field": "heartRate",
      "message": "ZERO-FABRICATION VIOLATION: heartRate cannot be accepted when optical quality is LOST or UNRELIABLE.",
      "code": "custom"
    }
  ],
  "timestamp": "2026-09-15T23:45:00.000Z"
}
```

Standard Error Codes:
- `400 BAD_REQUEST`: Validation failure, clock skew violation (>5 min in future), or Zero-Fabrication violation.
- `401 UNAUTHORIZED`: Missing, expired, or blacklisted JWT access token.
- `403 FORBIDDEN`: Insufficient role privileges or resource belongs to an unassigned ward.
- `404 NOT_FOUND`: Patient, bed, ward, or clinical action does not exist.
- `409 CONFLICT` / `DUPLICATE_ENTITY`: Replayed event with an existing `Idempotency-Key`.
- `429 TOO_MANY_REQUESTS`: Rate limit exceeded (includes `Retry-After` header).
- `500 INTERNAL_ERROR`: Unexpected internal server exception.

---

## 2. Identity, Authentication & Session Lifecycle

### `POST /api/v1/auth/login`
Authenticates clinician credentials and issues signed access and refresh tokens.

- **Request Body**:
```json
{
  "username": "nurse",
  "password": "NursePass123!"
}
```
- **Response `200 OK`**:
```json
{
  "message": "Authentication successful.",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
    "tokenType": "Bearer",
    "expiresInSeconds": 900,
    "user": {
      "userId": "usr-nurse-101",
      "username": "nurse",
      "fullName": "Sarah Jenkins, RN",
      "role": "WARD_NURSE",
      "assignedWardIds": ["WARD-A"]
    }
  }
}
```

### `POST /api/v1/auth/refresh`
Exchanges a valid, unrevoked refresh token for a newly signed access token.

- **Request Body**: `{ "refreshToken": "<JWT_REFRESH_TOKEN>" }`
- **Response `200 OK`**: `{ "data": { "accessToken": "...", "tokenType": "Bearer", "expiresInSeconds": 900 } }`

### `POST /api/v1/auth/logout`
Revokes the current session and blacklists the token identifier (`jti`). Requires Bearer token.

- **Response `200 OK`**: `{ "message": "Successfully logged out and session revoked." }`

### `GET /api/v1/auth/me`
Returns current session profile, active role, and assigned hospital wards. Requires Bearer token.

- **Response `200 OK`**: `{ "data": { "userId": "usr-nurse-101", "role": "WARD_NURSE", "assignedWardIds": ["WARD-A"] } }`

---

## 3. System Telemetry & Operational Metrics

### `GET /health` & `GET /api/v1/health`
Root and versioned liveness probe.

- **Response `200 OK`**:
```json
{
  "status": "ok",
  "service": "aegispulse-api",
  "version": "1.0.0",
  "timestamp": "2026-09-15T23:45:00.000Z",
  "uptimeSeconds": 1845.2
}
```

### `GET /ready` & `GET /api/v1/ready`
Readiness probe verifying database health and stream broadcaster.

- **Response `200 OK`**: `{ "status": "ok", "service": "aegispulse-api", "database": "connected" }`
- **Response `503 Service Unavailable`**: Database disconnected or simulator in degraded state.

### `GET /api/v1/metrics`
Operational metrics in JSON format or Prometheus text format (`?format=prometheus` or `Accept: text/plain`).

- **Response `200 OK`**:
```json
{
  "status": "ok",
  "data": {
    "service": "aegispulse-api",
    "uptimeSeconds": 1845,
    "memory": {
      "heapUsedMb": 54.2,
      "heapTotalMb": 92.1,
      "rssMb": 118.5
    },
    "observationsTotal": { "BEDSIDE_DEVICE": 120, "OPTICAL_RPPG": 350 },
    "realtimeActiveConnections": 4
  }
}
```

---

## 4. Wards, Beds & Deterioration Radar

### `GET /api/v1/wards`
List all wards within clinician jurisdiction.

- **Response `200 OK`**: Array of `Ward` objects (`id`, `name`, `code`, `totalBeds`, `activeNursesCount`).

### `GET /api/v1/wards/:wardId`
Get single ward details with bed inventory.

- **Response `200 OK`**: Ward metadata plus `beds: Bed[]`.

### `GET /api/v1/wards/:wardId/overview`
Aggregated bed occupancy and patient census summary.

- **Response `200 OK`**:
```json
{
  "data": {
    "ward": { "id": "WARD-A", "name": "Step-Down 4A" },
    "totalBeds": 6,
    "occupiedBeds": 5,
    "availableBeds": 1,
    "patientCount": 5,
    "beds": [...],
    "patients": [...]
  }
}
```

### `GET /api/v1/wards/:wardId/radar`
Master ward priority radar view: all patients in the ward ranked descending by **Attention Priority Score (APS)**.

- **Response `200 OK`**:
```json
{
  "data": {
    "wardId": "WARD-A",
    "wardName": "Step-Down 4A",
    "patientCount": 5,
    "radar": [
      {
        "patientId": "P006",
        "patientName": "Arthur Pendelton",
        "bedNumber": "04B",
        "apsScore": 82.4,
        "category": "CRITICAL_REVIEW",
        "topReason": "Tachypnea RR 32 with elevated Shock Index 1.25",
        "recommendedAction": "RAPID_RESPONSE_TRIGGER",
        "timestamp": 1726300000000
      }
    ]
  }
}
```

### `GET /api/v1/beds`
Query beds, optionally filterable by `?wardId=WARD-A` and `?status=OCCUPIED`.

### `GET /api/v1/beds/:bedId`
Get single bed details and current assigned inpatient.

---

## 5. Patients Registry

### `GET /api/v1/patients`
List inpatients, filterable by `?wardId=WARD-A` and `?category=CRITICAL_REVIEW`.

### `GET /api/v1/patients/:patientId`
Get patient master record, demographics, code status, comorbidities, latest observation, and observation count.

---

## 6. Physiological Observations & Telemetry Ingestion

### `GET /api/v1/patients/:patientId/observations`
Query historical observations for a patient. Query parameters: `?since=<timestamp>&until=<timestamp>`.

### `POST /api/v1/patients/:patientId/observations`
Ingests a validated bedside physiological observation. Supports idempotent retries with `Idempotency-Key` header.

- **Headers**:
  - `Authorization: Bearer <TOKEN>`
  - `Idempotency-Key: <UUID>` (Optional; prevents duplicate ingestion on network retry)
- **Request Body**:
```json
{
  "source": "BEDSIDE_DEVICE",
  "confidence": 0.95,
  "qualityState": "TRUSTED",
  "heartRate": 82,
  "respiratoryRate": 18,
  "systolicBP": 120,
  "diastolicBP": 80,
  "spo2": 98,
  "timestamp": 1726300000000
}
```
- **Authoritative Server Guards**:
  - **Zero-Fabrication Invariant**: If `source === 'OPTICAL_RPPG'` and `qualityState` is `LOST` or `UNRELIABLE`, heartRate or respiratoryRate are rejected with `HTTP 400`.
  - **Clock Skew Invariant**: Rejects timestamps > 5 minutes in the future or older than 7 days.
  - **Authoritative Shock Index**: Computed strictly by server as $\text{HR} / \text{SBP}$.
- **Response `201 Created`**:
```json
{
  "message": "Physiological observation successfully ingested and indexed into timeline.",
  "data": {
    "id": "obs-P001-1726300000000-x9f2",
    "patientId": "P001",
    "timestamp": 1726300000000,
    "source": "BEDSIDE_DEVICE",
    "confidence": 0.95,
    "qualityState": "TRUSTED",
    "heartRate": 82,
    "respiratoryRate": 18,
    "systolicBP": 120,
    "diastolicBP": 80,
    "spo2": 98,
    "shockIndex": 0.68
  }
}
```

---

## 7. Laboratory Biomarkers

### `GET /api/v1/patients/:patientId/labs`
Query laboratory results for a patient.

### `POST /api/v1/patients/:patientId/labs`
Record laboratory biomarker result. Server derives `isCritical` based on reference range.

- **Request Body**:
```json
{
  "testCode": "LACTATE",
  "testName": "Lactate, Blood",
  "value": 3.8,
  "unit": "MMOL_PER_L",
  "referenceRange": { "low": 0.5, "high": 2.0 }
}
```
- **Response `201 Created`**: Returns recorded lab result with `isCritical: true`.

---

## 8. Chronological Timeline & Clinical Query Engine

### `GET /api/v1/patients/:patientId/timeline`
Fetch chronological unified timeline events. Query parameters: `?since=<ts>&until=<ts>&limit=100&order=asc|desc&types=VITAL_MEASUREMENT,LAB_RESULT`.

### `POST /api/v1/patients/:patientId/timeline/events`
Append an authenticated clinician timeline event (e.g. manual observation, nurse visit, bedside note).

- **Request Body**:
```json
{
  "eventType": "MANUAL_OBSERVATION",
  "title": "Bedside Nursing Assessment",
  "description": "Patient alert, oriented x3, breathing comfortably.",
  "severity": "INFO"
}
```
- **Response `201 Created`**: Appended timeline event with clinician provenance (`actorUserId`, `actorRole`).

### `GET /api/v1/patients/:patientId/timeline/changes`
Answers: *"What changed during the last N hours?"* (`?hours=4`).

### `GET /api/v1/patients/:patientId/timeline/priority-rise`
Answers: *"What caused the patient's priority score to rise?"* (`?hours=4`).

### `GET /api/v1/patients/:patientId/timeline/last-manual-assessment`
Answers: *"When was the patient last manually assessed?"*

### `GET /api/v1/patients/:patientId/timeline/trusted-measurements`
Answers: *"Which measurements were trusted?"* Segregates trusted observations and suppressed readings.

---

## 9. Attention Priority Score (APS) & Explainability

### `GET /api/v1/patients/:patientId/attention-priority`
Returns continuous real-time APS evaluation, clinical floors, mathematical components, and top reasons.

- **Response `200 OK`**:
```json
{
  "data": {
    "patientId": "P001",
    "bedNumber": "01A",
    "apsScore": 64.2,
    "category": "URGENT_EVALUATION",
    "confidence": 0.94,
    "components": {
      "velocityScore": 18.5,
      "decayScore": 12.0,
      "mewsComponent": 4,
      "biomarkerComponent": 10.5
    },
    "reasons": [
      "Tachypnea RR 28 breaths/min",
      "Tachycardia HR 105 bpm"
    ],
    "topReason": "Tachypnea RR 28 breaths/min with elevated MEWS",
    "recommendedActions": ["MANUAL_VITALS_RECHECK"],
    "timestamp": 1726300000000
  }
}
```

---

## 10. Acknowledgements & Closed-Loop Clinical Actions

### `GET /api/v1/patients/:patientId/acknowledgements`
List alert acknowledgements.

### `POST /api/v1/patients/:patientId/acknowledgements`
Acknowledge active alert or priority escalation. Requires `WARD_NURSE`, `CHARGE_NURSE`, or `PHYSICIAN`.

- **Request Body**: `{ "alertId": "alert-101", "reason": "Bedside nurse verified vitals." }`
- **Response `201 Created`**: Acknowledged record with timestamp and clinician ID.

### `GET /api/v1/patients/:patientId/actions`
List proposed, in-progress, and completed clinical actions.

### `POST /api/v1/patients/:patientId/actions`
Propose clinical action (`MANUAL_VITALS_RECHECK`, `BEDSIDE_VISIT`, `ATTACH_CUFF`, `SBAR_PHYSICIAN_CONSULT`, `RAPID_RESPONSE_TRIGGER`).

- **Request Body**:
```json
{
  "actionType": "MANUAL_VITALS_RECHECK",
  "title": "Manual Blood Pressure Verification",
  "rationale": "Elevated Shock Index detected on optical telemetry.",
  "urgency": "WATCH",
  "targetCompletionMinutes": 30
}
```
- **Response `201 Created`**: Action record with status `RECOMMENDED`.

### `PATCH /api/v1/patients/:patientId/actions/:actionId`
Update action status (`ACKNOWLEDGED`, `IN_PROGRESS`, `COMPLETED`, `DISMISSED`).

- **Request Body**: `{ "status": "COMPLETED", "outcomeNotes": "Manual BP recorded at 118/75." }`
- **Response `200 OK`**: Updated action with `completedByUserId` and `completedAt`.

---

## 11. Advisory AI Copilot (Strictly Non-Autonomous Decision Support)

### `POST /api/v1/patients/:patientId/copilot`
Submits decision-support query bounded strictly by verified patient evidence.

- **Request Body**:
```json
{
  "query": "Explain why the patient APS score is elevated",
  "queryType": "EXPLAIN_APS_CHANGE",
  "includeExplanations": true
}
```
- **Safety Invariants**:
  - Direct & indirect prompt injections are blocked (`status: 'REFUSED'`).
  - Cannot diagnose or prescribe medication.
  - Automatically falls back to deterministic rule-based engine if LLM provider fails, times out, or rate-limits.
- **Response `200 OK`**:
```json
{
  "data": {
    "id": "copilot-resp-...",
    "patientId": "P001",
    "bedNumber": "01A",
    "queryType": "EXPLAIN_APS_CHANGE",
    "status": "SUCCESS",
    "answer": "Attention Priority Score (APS) Explanation: Current Score = 64.2...",
    "sourceReferences": [...],
    "missingDataIdentified": ["BODY_TEMPERATURE"],
    "evidenceHash": "5a2f8c...sha256",
    "disclaimer": "ADVISORY ONLY: AegisPulse AI Clinical Copilot provides decision support based strictly on verified patient data. It does not diagnose, prescribe, change scores, or replace licensed clinical judgment.",
    "auditLogId": "copilot-audit-..."
  },
  "status": "SUCCESS"
}
```

---

## 12. Offline Edge Synchronization

### `POST /api/v1/sync`
Batch ingestion endpoint for offline mobile tablets and bedside workstations reconnecting to the ward network.

- **Request Body**:
```json
{
  "clientSyncId": "sync-1726300000000",
  "clientId": "bedside-tablet-402",
  "wardId": "WARD-A",
  "items": [
    {
      "idempotencyKey": "idemp-obs-P001-1726300000000-x8a",
      "itemType": "OBSERVATION",
      "timestamp": 1726300000000,
      "patientId": "P001",
      "payload": {
        "heartRate": 85,
        "source": "MANUAL_VERIFIED"
      }
    }
  ]
}
```
- **Conflict Resolution**: Manual bedside nurse readings strictly supersede contactless optical estimates.
- **Response `200 OK`**: Returns `processedCount`, `duplicateCount`, `rejectedCount`, and `conflicts: []`.

---

## 13. Real-Time Telemetry Streaming Contracts

### `GET /api/v1/stream/sse` (Server-Sent Events)
Subscribes to ward telemetry stream via HTTP chunked transfer. Query parameters: `?wardId=WARD-A`.

- **MIME Type**: `text/event-stream`
- **Events Emitted**: `OBSERVATION_UPDATED`, `APS_UPDATED`, `PRIORITY_CHANGED`, `ALERT_RAISED`, `ACTION_RECOMMENDED`.

### `GET /api/v1/stream/ws` (WebSocket Protocol)
Full-duplex bidirectional stream for ward dashboards and bedside tablets.

- **Protocol Flow**:
  1. **Handshake**: Server transmits `CONNECTED` with `serverInstanceId`, `serverBootTimestamp`, and heartbeat interval ($15\text{ s}$).
  2. **Heartbeat**: PING/PONG watchdog every 15s. If silence $> 37.5\text{ s}$, dead socket is terminated.
  3. **Anti-Rollback**: Every message contains monotonic `seq`. If client detects gap (`seq > lastSeq + 1`), it buffers and requests catch-up.
  4. **Snapshot Sync**: Client dispatches `GET_SNAPSHOT` on reconnect; server replies with authoritative ward state.

---

## 14. Ward Simulation & Chaos Injection Controls

### `GET /api/v1/simulation/scenarios`
Catalog of pre-configured simulation scenarios (`NORMAL_SHIFT`, `SINGLE_PATIENT_DETERIORATION`, `FALSE_ALARM_SCENARIO`, etc.).

### `POST /api/v1/simulation/scenarios/run`
Activates scenario. Requires `ADMIN` or `SYSTEM` role.

### `POST /api/v1/simulation/tick`
Advances simulation virtual clock by $N$ seconds (`{ "seconds": 60 }`). Requires `ADMIN`.

### `POST /api/v1/simulation/chaos/database`
Toggles simulated database disruption for chaos resilience audits (`{ "disrupted": true }`). Requires `ADMIN`.
