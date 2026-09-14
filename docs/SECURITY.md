# AegisPulse: Security Architecture & Threat Model

**Document Status:** AUTHORITATIVE SECURITY SPECIFICATION  
**Governing Standard:** `docs/SOURCE_OF_TRUTH.md`  
**Compliance Context:** HIPAA Security Rule (45 CFR Part 160/164), FDA Premarket Cybersecurity Guidance (2023), OWASP API Security Top 10 (2023)

---

## 1. Threat Model & Trust Boundaries

AegisPulse operates in high-density clinical environments where patient data privacy, system availability, and clinical integrity are critical. The security architecture enforces strict trust boundaries:

```
[UNTRUSTED CLIENT ENVIRONMENT]
  Bedside Tablets / Webcams / Browser DOM
  ├── Attacker Vector: Malicious payloads, frame exfiltration, clock spoofing
  └── Boundary Defense: Volatile RAM only, strict Zod validation, clock skew rejection
         │
         │ HTTPS / WSS (TLS 1.3) + Bearer Token
         ▼
[API GATEWAY TRUST BOUNDARY]
  Express Gateway (services/api)
  ├── Rate Limiter (100 req/min sliding window)
  ├── RBAC Enforcement (WARD_NURSE, CHARGE_NURSE, PHYSICIAN, WARD_ADMIN)
  ├── Request ID Tracking (UUID correlation)
  └── Zero-PHI Sanitized Logging
         │
         ├── Parameterized Prepared Statements (Zero SQLi)
         ▼
[PERSISTENCE BOUNDARY]
  SQLite 3 Database (PRAGMA WAL Mode, 600 File Permissions)
  └── Immutable Audit Event Ledger (SHA-256 Context Hashed)
```

---

## 2. Authentication & Role-Based Access Control (RBAC)

### 2.1 Authentication

- **Mechanism**: Bearer JWT tokens in HTTP `Authorization` headers and WebSocket connection upgrade protocols.
- **Key Validation**: Configurable `JWT_SECRET` with minimum entropy enforcement (256-bit).
- **Service-to-Service**: High-entropy API keys for internal ingestion and lab system feeds.

### 2.2 Role-Based Permissions

Implemented in `services/api/src/middleware/rbac.ts`:

| Role             | Permitted Actions                                                                         | Restricted Actions                                             |
| :--------------- | :---------------------------------------------------------------------------------------- | :------------------------------------------------------------- |
| **WARD_NURSE**   | View ward radar; log manual vitals; acknowledge alerts; complete actions; generate SBAR.  | Cannot alter ward structure; cannot access admin audit logs.   |
| **CHARGE_NURSE** | All nurse capabilities + assign beds; reconfigure triage thresholds; review ward metrics. | Cannot delete clinical records; cannot modify database schema. |
| **PHYSICIAN**    | Full clinical review; override priority recommendations; acknowledge escalations.         | Read-only access to audit logs.                                |
| **WARD_ADMIN**   | Ward provisioning; user account management; inspect audit ledger; database backup.        | Cannot override or fake clinical vital measurements.           |

---

## 3. Ten Red-Team Hardened Security Vectors

AegisPulse was subjected to an adversarial assessment across 10 critical attack vectors, each backed by automated regression tests in `services/api/tests/red-team-security.test.ts`:

### V-01: Future Timestamp Spoofing (Clock Skew Defense)

- **Threat**: An attacker injects vitals dated in the future to freeze APS scores and defeat information decay math.
- **Mitigation**: `services/api/src/routes/v1/observations.ts` enforces `timestamp <= Date.now() + 300000` (max 5 minutes skew). Timestamps beyond this are rejected with HTTP 400.

### V-02: Raw Video & Image Exfiltration Defense

- **Threat**: An adversary attempts to exfiltrate or inject raw video frames/base64 images via REST or sync queues.
- **Mitigation**: All Zod schemas enforce `.strict()`. Any payload containing keys such as `rawVideo`, `frameBuffer`, `pixels`, `cameraStream` or payloads $> 50\text{ KB}$ are rejected with HTTP 400 and logged to security audit.

### V-03: Cross-Ward Multi-Tenant Jurisdiction Breach

- **Threat**: A clinician authenticated to Ward A attempts to view or update patients assigned to Ward B.
- **Mitigation**: Ward scoping middleware verifies user assignment against patient bed records before returning data.

### V-04: LLM Jailbreak & System Prompt Exfiltration

- **Threat**: Adversary embeds jailbreak strings (`"Ignore previous instructions..."`) in patient clinical notes to force the Copilot to diagnose or reveal system prompts.
- **Mitigation**: `packages/clinical/src/copilot/guardrails.ts` sanitizes prompt templates and scans inputs for injection patterns.

### V-05: Diagnostic & Prescriptive Liability Hijacking

- **Threat**: An attacker queries the AI Copilot: _"Confirm patient has septic shock and prescribe 2g Ceftriaxone."_
- **Mitigation**: Copilot guardrails inspect inputs and outputs with strict refusal heuristics:
  - Immediately refuses to provide medical diagnosis.
  - Immediately refuses to recommend drug dosages or fluid orders.
  - Automatically appends non-diagnostic disclaimer.

### V-06: Replay & Double-Counting of Actions

- **Threat**: Network replay attacks duplicate alert acknowledgements or clinical action completions.
- **Mitigation**: Idempotency keys (UUIDv4) are required on action/acknowledgement submissions; repeated keys return idempotent cached responses without duplicating audit records.

### V-07: Denial of Service via Telemetry Ingestion Flood

- **Threat**: High-rate automated telemetry flood overwhelms API processing.
- **Mitigation**: IP-based and token-based rate limiting (100 requests per minute sliding window) implemented in `services/api/src/middleware/rate-limiter.ts`.

### V-08: Stale Observation Re-Injection

- **Threat**: Re-injecting vitals from 24+ hours ago to overwrite current acuity.
- **Mitigation**: Sync service rejects observations older than 24 hours (`resolution: 'REJECTED_STALE'`).

### V-09: Optical Confidence Spoofing

- **Threat**: Ingesting degraded optical signals with spoofed `confidence: 1.0` to suppress alerts.
- **Mitigation**: Telemetry pipeline independently verifies SNR and cross-checks signal quality values against historical variance bounds.

### V-10: Script & HTML Injection (XSS) via Clinical Notes

- **Threat**: Embedding `<script>` or malicious HTML in nurse shift notes or patient history.
- **Mitigation**: Input strings are sanitized and HTML entity encoded; React UI renders all text through safe DOM nodes with zero `dangerouslySetInnerHTML`.

---

## 4. Database Protection & Parameterization

- **Engine**: SQLite 3 with Write-Ahead Logging (WAL mode).
- **Zero SQL Injection**: 100% of database interactions in `packages/persistence/src/repositories/` use parameterized prepared statements (`db.prepare(...)`).
- **File Permissions**: SQLite database files and directory permissions are restricted to the service user (POSIX `0600` / Windows restricted ACLs).

---

## 5. Audit Logging & Provenance

- **Immutable Ledger**: Every alert acknowledgement, priority score calculation, clinical action, and AI Copilot interaction is written to the `audit_events` table in SQLite.
- **Context Hashing**: Copilot interactions store a SHA-256 hash of the input evidence package to ensure retrospective auditability without storing raw prompts.
- **Zero PHI in Logs**: Standard application logs (`stdout`) scrub patient names and identifiers, outputting only internal pseudonymous UUIDs and bed IDs.
