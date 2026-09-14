# AegisPulse: REST & Streaming API Specification

**Document Status:** AUTHORITATIVE API SPECIFICATION  
**Governing Standard:** `docs/SOURCE_OF_TRUTH.md`  
**OpenAPI Specification:** [`docs/openapi.yaml`](file:///e:/My%20Development/AegisPulse/docs/openapi.yaml)

---

## 1. Authentication, Headers & Error Formats

### 1.1 Authentication

- **Bearer Token**: `Authorization: Bearer <JWT_TOKEN>`
- **API Key**: `X-API-Key: <API_KEY>` (for internal ingestion and lab systems)
- **Role Requirements**: Certain routes require specific roles (`WARD_NURSE`, `CHARGE_NURSE`, `PHYSICIAN`, `WARD_ADMIN`).

### 1.2 Common Headers

- `Content-Type: application/json`
- `X-Request-ID: <UUID>` (Optional; auto-generated if omitted for distributed tracing)

### 1.3 Standard Error Format

All errors return a sanitized JSON error payload:

```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Timestamp skew exceeds 5 minute boundary",
    "details": {},
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": 1726300000000
  }
}
```

---

## 2. Health & System Telemetry Endpoints

### `GET /health`

Liveness probe.

- **Response `200 OK`**:

```json
{
  "status": "healthy",
  "uptimeSeconds": 1420.5,
  "timestamp": 1726300000000,
  "version": "0.1.0"
}
```

### `GET /ready`

Readiness probe checking database connectivity and stream hub.

- **Response `200 OK`**: Service is fully initialized.
- **Response `503 Service Unavailable`**: Database or stream adapter initializing.

### `GET /api/v1/metrics`

Prometheus format operational metrics (memory, active connections, queue depth).

---

## 3. Ward & Bed Management Endpoints

### `GET /api/v1/wards`

List all active hospital wards.

- **Response `200 OK`**: Array of `Ward` records.

### `GET /api/v1/wards/:id`

Fetch single ward details and current bed capacity.

### `GET /api/v1/wards/:id/radar`

Master ward radar view: returns all beds in the ward sorted by current **Attention Priority Score (APS)**.

- **Response `200 OK`**:

```json
{
  "wardId": "ward-general-01",
  "wardName": "Medical-Surgical Ward 4B",
  "calculatedAt": 1726300000000,
  "radar": [
    {
      "rank": 1,
      "bedId": "bed-403",
      "bedNumber": "403",
      "patientId": "patient-103",
      "patientName": "Eleanor Vance",
      "apsScore": 88,
      "category": "CRITICAL_REVIEW",
      "primaryReason": "Heart Rate velocity +32% with Shock Index 1.31",
      "mews": 5,
      "qsofa": 2,
      "signalConfidence": 94,
      "informationAgeMinutes": 22
    }
  ]
}
```

### `GET /api/v1/wards/:id/beds`

List all beds assigned to a ward.

### `GET /api/v1/beds/:id`

Fetch single bed record.

### `GET /api/v1/beds/:id/vitals`

Fetch latest physiological measurements recorded for a specific bed.

---

## 4. Patient Endpoints

### `GET /api/v1/patients`

List active inpatients. Filterable by ward ID (`?wardId=ward-general-01`).

### `GET /api/v1/patients/:id`

Fetch complete patient master record including admission context, comorbidities, and code status.

### `GET /api/v1/patients/:id/summary`

Returns a multi-vector longitudinal clinical summary (historical vitals, lab results, recent actions).

---

## 5. Observation & Telemetry Ingestion Endpoints

### `POST /api/v1/observations`

Ingest a validated bedside physiological observation.

- **Safety Enforcement**:
  - Rejects unrecognized keys (`rawVideo`, `frameBuffer` are strictly rejected with HTTP 400).
  - Enforces clock skew: `timestamp <= Date.now() + 300000`.
- **Request Body**:

```json
{
  "id": "obs-9821a",
  "patientId": "patient-103",
  "timestamp": 1726300000000,
  "source": "OPTICAL_RPPG",
  "confidence": 0.92,
  "qualityStatus": "EXCELLENT",
  "heartRate": 104,
  "respiratoryRate": 24,
  "provenance": {
    "deviceId": "tablet-bed-403",
    "algorithm": "POS_CHROM_HYBRID_V2",
    "calibrationSessionId": "cal-session-12"
  }
}
```

- **Response `201 Created`**:

```json
{
  "success": true,
  "observationId": "obs-9821a",
  "calculatedAPS": 88,
  "previousAPS": 64
}
```

### `GET /api/v1/observations/patient/:patientId`

Query historical observations with optional time boundaries (`?from=1726200000&to=1726300000&limit=50`).

---

## 6. Laboratory Results Endpoints

### `POST /api/v1/labs`

Ingest quantitative laboratory biomarker results (serum lactate, WBC, creatinine).

- **Request Body**:

```json
{
  "id": "lab-5510",
  "patientId": "patient-103",
  "timestamp": 1726300000000,
  "testCode": "LACTATE",
  "testName": "Serum Lactate",
  "value": 3.4,
  "unit": "MMOL_PER_L",
  "referenceRange": { "low": 0.5, "high": 2.0 },
  "isCritical": true,
  "sourceLab": "Central Hospital Biochemistry"
}
```

- **Response `201 Created`**

### `GET /api/v1/labs/patient/:patientId`

Query all lab results for a patient.

---

## 7. Attention Priorities & Clinical Actions Endpoints

### `GET /api/v1/priorities/ward/:wardId`

Fetch latest Attention Priority rankings across all patients in a ward.

### `GET /api/v1/priorities/patient/:patientId`

Fetch full deterministic breakdown of a patient's current APS score including contributing reasons:

- **Response `200 OK`**:

```json
{
  "id": "aps-103-99",
  "patientId": "patient-103",
  "apsScore": 88,
  "category": "CRITICAL_REVIEW",
  "reasons": [
    {
      "code": "HEART_RATE_VELOCITY_HIGH",
      "description": "Heart Rate accelerated by +28 BPM over 45 minutes",
      "contributionWeight": 0.35,
      "triggerValue": 104,
      "thresholdValue": 80,
      "unit": "BPM",
      "urgency": "HIGH"
    },
    {
      "code": "SHOCK_INDEX_ELEVATED",
      "description": "Shock Index 1.31 exceeds occult shock threshold (0.90)",
      "contributionWeight": 0.25,
      "triggerValue": 1.31,
      "thresholdValue": 0.9,
      "unit": "RATIO",
      "urgency": "CRITICAL_REVIEW"
    }
  ],
  "recommendedAction": "Perform immediate bedside assessment and fluid resuscitation review",
  "calculatedAt": 1726300000000
}
```

### `GET /api/v1/actions/patient/:patientId`

List recommended and completed clinical actions for a patient.

### `POST /api/v1/actions`

Create a new clinical action recommendation.

### `PATCH /api/v1/actions/:id/status`

Update action status (`PENDING` $\to$ `COMPLETED` or `DISMISSED`) with nurse user ID and outcome notes.

---

## 8. Acknowledgements & Audit Endpoints

### `POST /api/v1/acknowledgements`

Clinician acknowledgement of a critical alert or priority escalation.

- **Request Body**:

```json
{
  "id": "ack-001-uuid",
  "alertId": "alert-99",
  "patientId": "patient-103",
  "userId": "nurse-sarah-42",
  "acknowledgedAt": 1726300050000,
  "notes": "At bedside; initiating IV fluid protocol."
}
```

### `GET /api/v1/acknowledgements/ward/:wardId`

List acknowledgements in a ward for shift handoff audit.

---

## 9. Timeline & AI Copilot Endpoints

### `GET /api/v1/timeline/patient/:patientId`

Fetch chronological unified timeline containing vitals, labs, priority changes, actions, and alerts.

### `POST /api/v1/copilot/explain`

Advisory explanation of clinical reasoning for a patient's score.

- **Input**: `{ "patientId": "patient-103" }`
- **Output**: Returns structured advisory summary with non-diagnostic disclaimer.

### `POST /api/v1/copilot/sbar`

Generate standardized SBAR handoff dossier for medical emergency team transfer.

- **Input**: `{ "patientId": "patient-103", "recipientRole": "MET_PHYSICIAN" }`
- **Output**:

```json
{
  "sbar": {
    "situation": "Patient in Bed 403 exhibits acute tachycardia and narrowing pulse pressure.",
    "background": "Post-op Day 2 following partial colectomy. Baseline MEWS was 1.",
    "assessment": "Current MEWS is 5; Shock Index is 1.31; serum lactate is 3.4 mmol/L.",
    "recommendation": "Immediate physician bedside review for occult hemorrhagic shock."
  },
  "evidenceHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "disclaimer": "INVESTIGATIONAL ADVISORY BRIEFING — MUST BE CLINICALLY VERIFIED"
}
```

---

## 10. Edge Synchronization Endpoints

### `POST /api/v1/sync/batch`

Batch ingest queued offline items (observations, actions, acknowledgements) from edge tablets.

- **Request Body**:

```json
{
  "deviceId": "tablet-bed-403",
  "syncTimestamp": 1726300100000,
  "items": [
    {
      "id": "item-uuid-1",
      "entityType": "OBSERVATION",
      "payload": { ... },
      "clientTimestamp": 1726300050000
    }
  ]
}
```

- **Response `200 OK`**: Returns resolution per item (`APPLIED`, `IDEMPOTENT_IGNORED`, or `REJECTED_STALE`).

### `GET /api/v1/sync/status`

Check edge synchronization health and pending queue depth.

---

## 11. Real-Time Streaming Endpoints

### `GET /api/v1/stream/events` (Server-Sent Events)

Lightweight unidirectional SSE stream for ward-wide radar updates. Emits:

- `event: radar_update`: Ward priority list re-sort.
- `event: alert_escalation`: High-priority attention trigger.
- `event: ping`: 15-second heartbeat.

### `WS /ws/telemetry` (WebSocket)

Bi-directional real-time telemetry stream for high-frequency oscilloscope traces and live spot-checks.

- **Client $\to$ Server**: Ingestion packets `{ type: "TELEMETRY_FRAME", data: { hr: 76, sqi: 0.94 } }`.
- **Server $\to$ Client**: Live calculated APS broadcasts.
