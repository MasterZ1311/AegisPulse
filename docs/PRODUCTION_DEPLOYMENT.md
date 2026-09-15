# AegisPulse: Production Deployment Architecture & Operations Guide

**Document Status:** AUTHORITATIVE PRODUCTION INFRASTRUCTURE SPECIFICATION  
**Governing Standard:** `docs/SOURCE_OF_TRUTH.md`  
**Security Standard:** Strict Zero-Video Edge Architecture

---

## 1. System Architecture

```
                  BEDSIDE PHONE / TABLET / WORKSTATION
               ┌─────────────────────────────────────────┐
               │  Camera Hardware                        │
               │      │ (Local 30 FPS Stream)            │
               │      ▼                                  │
               │  Volatile RAM Canvas (Face & ROI)       │
               │      │                                  │
               │      ▼                                  │
               │  rPPG Extraction (POS / CHROM)          │
               │      │                                  │
               │      ▼                                  │
               │  Numerical Telemetry ONLY               │
               │  [HR, RR, SQI, Confidence, SessionID]   │
               └────────────────────┬────────────────────┘
                                    │
                                    │ HTTPS (TLS 1.3) / WSS
                                    ▼
                         AEGISPULSE EDGE API SERVER
               ┌─────────────────────────────────────────┐
               │  Reverse Proxy (NGINX / Caddy)          │
               │      │                                  │
               │      ▼                                  │
               │  Express API Service (services/api)     │
               │      ├── Auth & RBAC Middleware         │
               │      ├── Strict Zero-Video Validator    │
               │      ├── Telemetry Ingestion Pipeline   │
               │      └── Attention Priority Engine      │
               └──────────────┬──────────────────┬───────┘
                              │                  │
                SQLite / PostgreSQL              ▼
               ┌──────────────────┐    CENTRAL WARD DASHBOARD
               │ Persistent State │    ┌─────────────────────┐
               │ & Audit History  │    │ Real-time SSE / WSS │
               └──────────────────┘    │ Attention Queue     │
                                       └─────────────────────┘
```

### Core Privacy & Security Invariant
The server **never** receives raw video frames, base64 images, or video stream URLs. Contactless camera sensing occurs entirely inside the client device's volatile browser RAM. Only validated scalar telemetry (heart rate, respiratory rate, SQI percentage, SNR dB, session ID) is serialized over HTTPS.

---

## 2. Environment Configuration

All environment variables must be declared in `.env` using `.env.example` as a template.

### Production Environment Variables:
```ini
# Node & Runtime
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Security & Secrets
JWT_SECRET=your_minimum_32_char_cryptographically_secure_jwt_secret
CORS_ORIGIN=https://aegispulse.hospital.internal

# Database Configuration
AEGIS_DB_PATH=/var/lib/aegispulse/ward_production.sqlite

# Telemetry Gating Thresholds
MIN_OPTICAL_CONFIDENCE_THRESHOLD=0.60
MIN_OPTICAL_SNR_THRESHOLD_DB=1.0

# Logging & Auditing
LOG_LEVEL=info
SANITIZED_LOGS=true
```

**Startup Invariant:** If `NODE_ENV=production` and `JWT_SECRET` is set to an insecure fallback or default value, the server will immediately terminate startup with an error.

---

## 3. Deployment Steps

### 3.1 Step 1: Clean Install & Build
```bash
# Clean install all monorepo workspaces
npm ci

# Compile all shared packages
npm run build:packages

# Compile API service and Web application
npm run build
```

### 3.2 Step 2: Database Migration & Seeding
```bash
# Migrations run automatically on server boot via packages/persistence
npm run dev:api
```

### 3.3 Step 3: Production Process Management (PM2 or Docker)
```bash
# Example PM2 start command
pm2 start services/api/dist/index.js --name "aegispulse-api" -i max
```

### 3.4 Step 4: Reverse Proxy Configuration (Caddy Example)
```caddy
aegispulse.hospital.internal {
    encode gzip zstd
    tls /etc/ssl/certs/hospital.crt /etc/ssl/certs/hospital.key

    # API and WebSocket routes
    reverse_proxy /api/* localhost:3000
    reverse_proxy /ws localhost:3000

    # Static Web Application
    root * /var/www/aegispulse/apps/web/dist
    file_server
    try_files {path} /index.html
}
```

---

## 4. Monitoring & Health Probes

AegisPulse exposes standardized health endpoints for Kubernetes and uptime monitors:

- **Liveness Probe**: `GET /health` $\to$ `200 OK` (checks process alive)
- **Readiness Probe**: `GET /api/v1/health/ready` $\to$ `200 OK` (verifies SQLite connection, schema tables, and broadcaster)
- **Prometheus Metrics**: `GET /api/v1/metrics` $\to$ Latency histograms, signal failure counters (`FACE_OCCLUSION`, `LOW_LIGHT`, `EXCESSIVE_MOTION`).
