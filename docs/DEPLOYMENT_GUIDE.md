# AegisPulse Free-Tier Production Deployment Guide (Render Unified Hosting)

This runbook guides you through deploying **AegisPulse** to production completely on **Render's $0 free tier** as a single unified full-stack service.

| Service | Plan | Features | Role |
| :--- | :--- | :--- | :--- |
| **[Render](https://render.com)** | **Free Web Service (Node.js)** | 750 free hours/month, automatic SSL, native WebSockets, SQLite persistence, `/health` monitoring. | Serves the React SPA frontend (`apps/web/dist`), REST API (`/api/v1`), WebSocket live telemetry (`/api/v1/stream/ws`), and SQLite database. |

---

## Pre-Flight Checklist
- [x] Repository on GitHub: `MasterZ1311/AegisPulse` (Branch: `MZ-Main`)
- [x] `render.yaml` Blueprint committed to repository root
- [x] Full-stack unified build configured: `npm install && npm run build`
- [x] Express static SPA serving with client-side HTML5 fallback routing enabled

---

## 1-Click Deployment via Render Blueprint

### Step 1: Connect Repository to Render
1. Navigate to [dashboard.render.com](https://dashboard.render.com) and log in with your GitHub account.
2. In the upper right corner, click **New +** and select **Blueprint**.
3. Select your repository: **`MasterZ1311/AegisPulse`**.
4. Choose Branch: **`MZ-Main`**.

### Step 2: Review Blueprint
Render will automatically read [`render.yaml`](file:///e:/AegisPulse/render.yaml) from the repository root:
- **Service Name**: `aegispulse-api` (or `aegispulse`)
- **Environment**: `Node`
- **Plan**: `Free`
- **Build Command**: `npm install && npm run build`
- **Start Command**: `node services/api/dist/index.js`
- **Health Check Path**: `/health`
- **Managed Variables**:
  - `NODE_ENV`: `production`
  - `PORT`: `10000`
  - `JWT_SECRET`: Auto-generated 256-bit cryptographic key (`generateValue: true`)
  - `AEGIS_DB_PATH`: `./data/aegispulse.db`
  - `CORS_ORIGIN`: `https://*.onrender.com,https://aegispulse-api.onrender.com`

### Step 3: Apply & Launch
1. Click **Apply**.
2. Render will trigger the build pipeline:
   - Compiles all internal packages (`@aegispulse/types`, `@aegispulse/clinical`, `@aegispulse/simulation`, `@aegispulse/rppg`, `@aegispulse/signal`, `@aegispulse/persistence`).
   - Compiles the Express API (`@aegispulse/api`).
   - Compiles and bundles the React SPA (`@aegispulse/web`).
3. Once complete, Render marks the service **Live** and generates a permanent HTTPS domain:
   ```text
   https://aegispulse-api.onrender.com
   ```

---

## Verifying Your Live Deployment

Open your Render URL in your browser:
```text
https://aegispulse-api.onrender.com
```

1. **Frontend UI**: The AegisPulse clinical dashboard loads directly with all components, charts, and patient triage cards.
2. **Realtime WebSocket**: The top right connectivity pill will display **`STREAMING`** (connecting to `wss://aegispulse-api.onrender.com/api/v1/stream/ws` on the same host).
3. **Health Probe**:
   Visit `https://aegispulse-api.onrender.com/health`:
   ```json
   {
     "status": "ok",
     "service": "aegispulse-api",
     "version": "0.1.0",
     "uptimeSeconds": 24,
     "environment": "production"
   }
   ```
4. **Diagnostics Modal**:
   Click the gear icon in the dashboard to verify `/ready` check and database connection status.

---

## Free-Tier Operational Notes

> [!NOTE]
> **Cold Start Behavior**:
> Render's free instances spin down into low-power sleep after 15 minutes of inactivity. When a clinician navigates to the application, Render takes ~30–50 seconds to spin the container back up. The web client includes automatic exponential reconnect backoff to resume live telemetry seamlessly.
