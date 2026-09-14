# AegisPulse: Deployment, Operations & Edge Runbook

**Document Status:** AUTHORITATIVE DEPLOYMENT GUIDE  
**Governing Standard:** `docs/SOURCE_OF_TRUTH.md`

---

## 1. System Requirements

### 1.1 Minimum Hardware Specifications

- **Processor**: 4 cores ($\ge 2.0\text{ GHz}$, x86_64 or ARM64 e.g. Raspberry Pi 5 / Intel N100)
- **Memory**: 4 GB RAM (8 GB recommended for multi-ward API server)
- **Disk Space**: 10 GB SSD storage
- **Client Display**: Any modern browser (Chrome 120+, Firefox 120+, Safari 17+, Edge 120+) supporting WebRTC `getUserMedia` and HTML5 Canvas.

### 1.2 Software Prerequisites

- **Node.js**: `v20.18.0` or higher (LTS recommended)
- **npm**: `v10.0.0` or higher
- **Docker & Docker Compose** (Optional, for containerized deployment)

---

## 2. Environment Configuration

Copy the sample environment file and configure variables:

```bash
cp .env.example .env
```

### Key Environment Variables (`.env`)

```bash
# Server Configuration
PORT=3000
NODE_ENV=development
LOG_LEVEL=info

# Security & Authentication
JWT_SECRET=your-super-secret-256bit-key-change-in-production
API_KEY_SECRET=internal-high-entropy-ingestion-key
CORS_ORIGIN=http://localhost:5173

# Persistence Configuration
DATABASE_PATH=./packages/persistence/aegispulse.db
SQLITE_WAL_MODE=true

# Stream & Telemetry Configuration
WS_HEARTBEAT_INTERVAL_MS=15000
MAX_CLOCK_SKEW_MS=300000

# Web Frontend URL
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000/ws/telemetry
```

---

## 3. Local Development Deployment

### 3.1 Install & Build

```bash
# 1. Install dependencies across all monorepo workspaces
npm install

# 2. Build all shared packages (@aegispulse/types, clinical, signal, persistence, etc.)
npm run build
```

### 3.2 Start Services Concurrently

```bash
# Starts both API server (:3000) and Web client (:5173) with colored logs
npm run dev
```

### 3.3 Start Services Individually

```bash
# Terminal 1: API Server
npm run dev:api

# Terminal 2: Web Dashboard
npm run dev:web
```

---

## 4. Production Build & Execution

### 4.1 Compile Production Assets

```bash
# Clean production build of all packages, API server, and Vite client
npm run build
```

### 4.2 Run Production Server

```bash
# Start the production Node API server
node services/api/dist/index.js
```

The web frontend assets are compiled into `apps/web/dist/` and can be served via Nginx, Caddy, or the API static file server.

---

## 5. Docker Containerized Deployment

AegisPulse includes production multi-stage Dockerfiles for both services:

### 5.1 Using Docker Compose

```bash
# Build and start all containers in background
docker-compose up --build -d

# Check running container status
docker-compose ps

# View unified container logs
docker-compose logs -f
```

### 5.2 Container Topology

- `aegispulse-api`: Exposes port `3000` (REST, SSE, WebSocket).
- `aegispulse-web`: Nginx serving production web app on port `80` (or `5173` if mapped).

---

## 6. Health Checks & Verification

### 6.1 Liveness Probe

```bash
curl -f http://localhost:3000/health
```

Expected output:

```json
{
  "status": "healthy",
  "uptimeSeconds": 45.2,
  "timestamp": 1726300000000,
  "version": "0.1.0"
}
```

### 6.2 Readiness Probe

```bash
curl -f http://localhost:3000/ready
```

Returns HTTP 200 when SQLite database is connected and WebSocket hub is operational.

---

## 7. Database Backup, Restore & Maintenance

All persistence data resides in the SQLite database file (`aegispulse.db`). Because SQLite operates in WAL mode, backups must be performed safely without corrupting active write transactions.

### 7.1 Online Database Backup

```bash
# Trigger safe SQLite online backup utility
node -e "import('./packages/persistence/dist/backup/backup.js').then(m => m.performBackup())"
```

Or use the SQLite CLI online backup API:

```bash
sqlite3 ./packages/persistence/aegispulse.db ".backup './backups/aegispulse-backup.db'"
```

### 7.2 Database Restoration

```bash
# Stop the API server before restoring
npm run stop # or kill PID

# Restore from verified backup file
cp ./backups/aegispulse-backup.db ./packages/persistence/aegispulse.db

# Restart API server
npm run dev:api
```

---

## 8. Offline Edge Operation

In the event of a total ward network disconnect:

1. **Bedside Tablets Continue Operating**: The React PWA caches application assets via Service Worker.
2. **Offline Actions Queued**: Nurse vitals entries, acknowledgements, and completed actions are buffered in browser `localStorage`.
3. **Automatic Reconciliation**: Once network connectivity is restored, the client issues a single `POST /api/v1/sync/batch` request, idempotently merging records.

---

## 9. Troubleshooting Guide

| Symptom                              | Probable Cause                | Corrective Action                                                                       |
| :----------------------------------- | :---------------------------- | :-------------------------------------------------------------------------------------- |
| `ECONNREFUSED :3000`                 | API server is not running     | Run `npm run dev:api` and verify port 3000 is free.                                     |
| Camera shows black frame             | Camera permissions denied     | Click the browser lock icon and enable camera permissions for localhost.                |
| `SQLITE_BUSY` error                  | Multi-process lock contention | Confirm `SQLITE_WAL_MODE=true` in `.env`; avoid multiple servers pointing to same file. |
| Score not changing on demo           | Demo scrubber paused          | Advance steps on the bottom Demo Controller bar to inject clinical scenarios.           |
| Future timestamp rejected (HTTP 400) | Host machine clock skew       | Ensure system time is synchronized with NTP (within 5 minutes of server time).          |
