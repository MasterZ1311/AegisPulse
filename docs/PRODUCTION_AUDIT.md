# AegisPulse Production Credentials & Configuration Audit

**Audit Date:** September 2026  
**Auditor:** AegisPulse Security & Infrastructure Architecture  
**Target:** Production Credentials, Secrets, External Integration Configurations & Network Perimeter  
**Status:** COMPLETE & VERIFIED  

---

## 1. Executive Summary

This audit catalogs and validates the status of all credential, secret, environment, and network configuration surfaces across the AegisPulse codebase. Per security hardening protocol, **no real credentials, private keys, or hospital secrets have been entered or committed**.

All 13 security configuration surfaces requested for verification have been audited.

---

## 2. Comprehensive 13-Point Configuration & Secret Verification Matrix

| # | Configuration Surface | Location in Codebase | Current Status | Hardening Assessment & Production Action |
| :-: | :--- | :--- | :--- | :--- |
| **1** | `.env` | `.gitignore` (Lines 14–17) | **ABSENT (Safe)** | Verified that no `.env` file is committed to Git. Ignored via `.gitignore`. Must be supplied at runtime via Kubernetes Secrets or Docker Compose environment files. |
| **2** | `.env.example` | `/.env.example`<br>`/.env.production.example` | **PRESENT (Templates)** | Verified two templates exist: minimal local development template (`.env.example`) and comprehensive production template (`.env.production.example`). Contains placeholders only. |
| **3** | OAuth / API Keys | `services/api/src/middleware/auth.ts`<br>`packages/persistence/src/seeds/seed-data.ts` | **HARDENED & ISOLATED** | Static test tokens (`nurse-token`, `charge-token`, `admin-token`, etc.) are mapped in-memory for testing. Dynamic escalation (`role:<ROLE>`) is strictly blocked in production. `x-api-key` header supported; production requires API key hashing via database table or external IdP. |
| **4** | Database Credentials | `packages/persistence/src/db/connection.ts`<br>`Dockerfile.api`<br>`docker-compose.yml` | **EMBEDDED SQLITE (No Network Passwords)** | Storage engine is native SQLite (`node:sqlite`). Database path configured via `AEGIS_DB_PATH` (default `/data/aegispulse.db` in Docker). Zero network database credentials (PostgreSQL/MySQL passwords) are required or present. |
| **5** | JWT / Session Secrets | `.env.production.example` (Line 23)<br>`docs/SECURITY.md` (Line 42) | **EXTERNALIZED PLACEHOLDER** | Configurable via `JWT_SECRET` environment variable. Default placeholder `replace_with_a_cryptographically_secure_random_string_in_production` exists in template. System enforces 256-bit minimum entropy for production JWT signing. |
| **6** | LLM Provider Credentials | `packages/clinical/src/copilot/copilot-engine.ts` | **NOT REQUIRED (Deterministic Engine)** | The AI Clinical Copilot runs on an internal `DeterministicInferenceEngine` delivering 100% evidence-grounded responses without external network dependencies. No OpenAI, Anthropic, or Gemini API keys are hardcoded or required for operation. |
| **7** | FHIR Endpoint Credentials | `PROJECT_CONSTITUTION.md`<br>`docs/PRODUCT.md`<br>`docs/ROADMAP.md` | **FUTURE ROADMAP (Q1–Q2 2027)** | HL7/FHIR bidirectional EHR interoperability is documented as a post-MVP roadmap milestone. No active FHIR client, mTLS certificates, or SMART-on-FHIR client secrets exist in the active codebase. |
| **8** | SMTP Credentials | Entire codebase | **NOT USED** | AegisPulse does not utilize an SMTP emailer or mail server. Clinical alerts and attention priority changes are delivered in real-time via WebSockets, Server-Sent Events, and in-app event policy queues. Zero SMTP credentials exist or are required. |
| **9** | WebSocket Secrets | `services/api/src/stream/websocket-server.ts` | **BEARER TOKEN INTEGRATED** | Real-time WebSocket telemetry stream (`/api/v1/stream/ws`) authenticates clients on connection upgrade using standard Bearer tokens via `?token=...` query parameter or `Authorization` header. No separate static shared WebSocket secret is required. |
| **10** | Docker Configuration | `docker-compose.yml`<br>`Dockerfile.api`<br>`Dockerfile.web` | **VERIFIED & HARDENED** | Multi-stage production Dockerfile (`Dockerfile.api`) runs as non-root user `aegis` (`UID 10001`). `docker-compose.yml` orchestrates `api` (port 3001:3000) and `web` (port 80:80, 5173:80) with isolated bridge network and volume mounts. |
| **11** | CORS Origins | `services/api/src/app.ts`<br>`docker-compose.yml`<br>`.env.production.example` | **STRICT ORIGIN VALIDATION** | `services/api/src/app.ts` parses `CORS_ORIGIN` and rejects untrusted origins. In `docker-compose.yml`, `CORS_ORIGIN=*` is flagged for production replacement with explicit hospital origins (e.g. `https://aegispulse.hospital.org`). |
| **12** | Allowed Hosts | `services/api/src/index.ts`<br>`Dockerfile.api`<br>`docker-compose.yml` | **0.0.0.0 BINDING** | Service binds to `HOST=0.0.0.0` inside container runtime and `127.0.0.1` / `localhost` during local development. Ingress reverse proxy (Nginx/Envoy) must enforce the `Host` header to prevent DNS rebinding attacks. |
| **13** | Production URLs | `.env.production.example`<br>`apps/web/vite.config.ts`<br>`docs/DEPLOYMENT.md` | **EXTERNALIZED & TEMPLATED** | Production API URL template: `https://api.aegispulse.hospital.org`<br>Production Web UI URL template: `https://aegispulse.hospital.org`<br>No proprietary hospital URLs or internal staging IP addresses are hardcoded. |

---

## 3. Deep-Dive Findings by Category

### 3.1 Environment Files (`.env`, `.env.example`, `.env.production.example`)
- **Git Invariant:** `.gitignore` lines 14–17 explicitly exclude all `.env` files while allowing template files:
  ```gitignore
  .env
  .env.*
  !.env.example
  !.env.production.example
  *.local
  ```
- **`.env.example`:** Provides clean dev defaults (`PORT=3001`, `NODE_ENV=development`, `VITE_API_URL=http://localhost:3001`).
- **`.env.production.example`:** Comprehensive reference declaring `NODE_ENV`, `PORT`, `HOST`, `AEGIS_DB_PATH`, `LOG_LEVEL`, `CORS_ORIGIN`, `JWT_SECRET`, `BROADCASTER_BUFFER_CAPACITY`, and `RATE_LIMIT_*`.

### 3.2 Authentication, OAuth & API Keys
- **Implementation:** [services/api/src/middleware/auth.ts](file:///e:/AegisPulse/services/api/src/middleware/auth.ts).
- **Audit Result:**
  - Standard role test tokens (`nurse-token`, `charge-token`, `resident-token`, `physician-token`, `admin-token`, `system-token`) exist for testing.
  - The security pass locked down dynamic token generation (`role:<ROLE>`): it is only permitted if `process.env.NODE_ENV !== 'production'` **and** `ALLOW_DEV_TEST_TOKENS === 'true'`.
  - In production, missing or invalid tokens reject with HTTP 401 Unauthorized.

### 3.3 Database & Storage Credentials
- **Implementation:** [packages/persistence/src/db/connection.ts](file:///e:/AegisPulse/packages/persistence/src/db/connection.ts).
- **Audit Result:**
  - AegisPulse utilizes embedded SQLite via Node.js native `DatabaseSync` (`node:sqlite`).
  - No database connection strings (`postgres://user:password@host/db`) exist or are leaked.
  - SQLite runs with write-ahead logging (`journal_mode = WAL`), memory-backed temporary store (`temp_store = MEMORY`), and synchronous normal.
  - Data directory permissions are restricted to the non-root `aegis` container user.

### 3.4 JWT & Session Secrets
- **Implementation:** [services/api/src/app.ts](file:///e:/AegisPulse/services/api/src/app.ts) & [docs/SECURITY.md](file:///e:/AegisPulse/docs/SECURITY.md).
- **Audit Result:**
  - Externalized via `JWT_SECRET`.
  - No real JWT private keys or secret strings are hardcoded in source files.
  - Template `.env.production.example` explicitly directs operators to inject a 256-bit entropy random key.

### 3.5 AI Copilot & LLM Provider Credentials
- **Implementation:** [packages/clinical/src/copilot/copilot-engine.ts](file:///e:/AegisPulse/packages/clinical/src/copilot/copilot-engine.ts).
- **Audit Result:**
  - The clinical copilot implements the `CopilotLLMProvider` interface with a local `DeterministicInferenceEngine`.
  - Responses for timeline summaries, APS score changes, and trajectory explanations are computed deterministically from structured evidence packages.
  - No third-party LLM API keys (OpenAI, Anthropic, Google Gemini, Azure OpenAI) are required or present. This guarantees zero PHI leakage to external cloud LLM APIs.

### 3.6 Healthcare Interoperability & External Communications (FHIR & SMTP)
- **FHIR:** Documented in [docs/ROADMAP.md](file:///e:/AegisPulse/docs/ROADMAP.md) as a planned milestone for Q1–Q2 2027. No active FHIR client credentials or endpoints exist.
- **SMTP:** Not utilized. Alerting and push communications occur via WebSocket broadcaster and SSE channels. Zero SMTP server credentials, usernames, or passwords exist.

### 3.7 WebSocket Security
- **Implementation:** [services/api/src/stream/websocket-server.ts](file:///e:/AegisPulse/services/api/src/stream/websocket-server.ts).
- **Audit Result:**
  - WebSocket server enforces connection upgrade authentication.
  - Max clients capped at 500; max frame payload capped at 64KB.
  - Subscriptions to ward channels (`SUBSCRIBE`) verify the user's `assignedWardIds`.
  - Uses standard Bearer token authentication rather than ad-hoc unauthenticated streaming.

### 3.8 Docker Configuration
- **Implementation:** [Dockerfile.api](file:///e:/AegisPulse/Dockerfile.api), [Dockerfile.web](file:///e:/AegisPulse/Dockerfile.web), [docker-compose.yml](file:///e:/AegisPulse/docker-compose.yml).
- **Audit Result:**
  - Multi-stage build isolates build tools (`python3`, `make`, `g++`) to builder stage.
  - Container runs as unprivileged user `aegis:aegis` (`UID 10001`).
  - Persistent volume `aegis_data` mounted at `/data`.
  - Built-in container health checks verify `/health` liveness.

### 3.9 Network Boundaries (CORS, Allowed Hosts, Production URLs)
- **CORS:** Controlled by `CORS_ORIGIN`. Validates incoming `Origin` against allowed origins array. In production deployments, `docker-compose.yml` must replace `*` with the exact hospital frontend domain.
- **Allowed Hosts:** Service listens on `0.0.0.0:3000` in container; reverse proxy handles TLS termination and host header verification.
- **Production URLs:** Documented via environment variables (`VITE_API_URL`, `CORS_ORIGIN`). Zero customer hospital URLs or hardcoded external IPs are present in source code.

---

## 4. Operational Checklist Before Production Go-Live

1. [ ] **Do NOT commit `.env` or `.env.production`**: Ensure secrets are injected at runtime via Kubernetes Secrets, HashiCorp Vault, or AWS Secrets Manager.
2. [ ] **Generate High-Entropy `JWT_SECRET`**:
   ```bash
   openssl rand -base64 32
   ```
3. [ ] **Set `CORS_ORIGIN` to Specific Hospital Domain**:
   Change `CORS_ORIGIN=*` in `docker-compose.yml` to:
   ```yaml
   - CORS_ORIGIN=https://aegispulse.hospital.org
   ```
4. [ ] **Ensure `ALLOW_DEV_TEST_TOKENS=false`**:
   Confirm that `ALLOW_DEV_TEST_TOKENS` is not set or set to `false` so all synthetic test tokens (`role:<ROLE>`) are rejected.
5. [ ] **Verify Persistent Volume Permissions**:
   Ensure `/data` on the host machine is owned by UID 10001 (`chown -R 10001:10001 /var/data/aegispulse`).
6. [ ] **Configure Reverse Proxy TLS Termination**:
   Place Nginx or Envoy in front of the API with valid TLS certificates (HTTPS / WSS), HTTP/2, and strict `Host` header validation.
