# AegisPulse Free-Tier Production Deployment Guide (Vercel & Render)

This runbook guides you through deploying **AegisPulse** to production completely on **$0 free-tier infrastructure**:

| Layer | Service | Free Tier Capabilities | Role |
| :--- | :--- | :--- | :--- |
| **Frontend** | **[Vercel](https://vercel.com)** | Unlimited deployments, global edge CDN, automatic genuine Let's Encrypt HTTPS, zero-config Vite SPA. | Serves the React 19 UI and executes client-side rPPG signal analysis. |
| **Backend** | **[Render](https://render.com)** | Free Web Service (Node.js), automatic SSL, native WebSockets, background SQLite persistence, `/health` monitoring. | Runs the Express API, WebSocket broadcast pipeline, and ward state engine. |

---

## Pre-Flight Checklist
- [x] Repository on GitHub: `MasterZ1311/AegisPulse`
- [x] `render.yaml` Blueprint committed to repository root
- [x] `vercel.json` configuration committed to repository root
- [x] Monorepo build verified: `npm run build:packages && npm run build --workspace=@aegispulse/web`

---

## Step 1: Deploy Backend to Render (Free Tier)

Render hosts the Node.js Express server, WebSocket stream broadcaster, and SQLite database.

1. **Sign in to Render**:
   - Go to [dashboard.render.com](https://dashboard.render.com) and sign in with your GitHub account.

2. **Deploy with Render Blueprint (Recommended)**:
   - In the top right, click **New +** and select **Blueprint**.
   - Connect your repository: `MasterZ1311/AegisPulse`.
   - Render will automatically detect `render.yaml` from the repository root:
     - **Service Name**: `aegispulse-api`
     - **Environment**: `Node`
     - **Plan**: `Free`
     - **Build Command**: `npm install && npm run build:packages && npm run build --workspace=@aegispulse/api`
     - **Start Command**: `node services/api/dist/index.js`
     - **Health Check Path**: `/health`
   - Render will automatically generate a cryptographically random 256-bit `JWT_SECRET`.
   - Click **Apply**.

3. **Copy your Backend URL**:
   - Once deployed, Render will provide a public HTTPS URL, for example:
     ```text
     https://aegispulse-api.onrender.com
     ```
   - Verify it is live by visiting `https://<your-render-app>.onrender.com/health` in your browser. You should receive:
     ```json
     { "status": "UP", "timestamp": "...", "version": "0.1.0" }
     ```

---

## Step 2: Deploy Frontend to Vercel (Free Tier)

Vercel hosts the responsive executive React application on their global edge network.

1. **Sign in to Vercel**:
   - Go to [vercel.com](https://vercel.com) and sign in with your GitHub account.

2. **Import Project**:
   - Click **Add New...** -> **Project**.
   - Select and import **`MasterZ1311/AegisPulse`**.

3. **Configure Project Settings**:
   - **Framework Preset**: `Vite` (automatically detected).
   - **Root Directory**: `./` (leave as root; `vercel.json` handles monorepo build).
   - **Build Command**: `npm run build:packages && npm run build --workspace=@aegispulse/web` (pre-configured in `vercel.json`).
   - **Output Directory**: `apps/web/dist` (pre-configured in `vercel.json`).

4. **Add Environment Variables**:
   In the **Environment Variables** section, add:
   - `VITE_API_URL`: Your Render backend HTTPS URL, e.g.:
     ```text
     https://aegispulse-api.onrender.com
     ```
   - `VITE_WS_URL`: Your Render backend WebSocket URL, e.g.:
     ```text
     wss://aegispulse-api.onrender.com/api/v1/stream/ws
     ```

5. **Click Deploy**:
   - Vercel will build the packages, bundle the frontend, and deploy to an edge URL, e.g.:
     ```text
     https://aegispulse.vercel.app
     ```

---

## Step 3: Authorize CORS on Render

Once your Vercel URL is created, authorize it on Render to ensure cross-origin requests succeed:

1. In the [Render Dashboard](https://dashboard.render.com), click on your **`aegispulse-api`** service.
2. Go to **Environment** settings.
3. Update the `CORS_ORIGIN` variable to include your Vercel production domain and preview wildcard:
   ```text
   https://aegispulse.vercel.app,https://*.vercel.app
   ```
4. Click **Save Changes** (Render will trigger a zero-downtime redeployment).

---

## Production Characteristics & Free-Tier Behaviors

### 1. Render Free-Tier Cold Starts
- Render free-tier instances enter sleep mode after **15 minutes** of zero traffic.
- When a user visits the Vercel site after idle time, the initial connection to Render takes ~30–45 seconds to spin up.
- **Resilience Built-In**: The AegisPulse frontend stream client (`AegisPulseStreamClient`) automatically displays the amber `CONNECTING` pill with exponential backoff (starting at 400ms up to 6000ms, 25 attempts), automatically latching onto the live stream once Render awakens.

### 2. Camera & Contactless rPPG Permissions
- Modern browsers (Chrome, Edge, Safari, iOS WebKit) strictly require HTTPS for `navigator.mediaDevices.getUserMedia`.
- Because Vercel terminates genuine Let's Encrypt SSL at the edge, the 15-second contactless optical spot-check camera will prompt for camera access immediately without browser security warnings.

---

## Health & Verification Endpoints

| Endpoint | Method | Expected Status | Purpose |
| :--- | :--- | :--- | :--- |
| `/health` | `GET` | `200 OK` | Liveness & uptime probe. |
| `/ready` | `GET` | `200 OK` | Readiness probe verifying SQLite database connectivity. |
| `/api/v1/patients` | `GET` | `200 OK` | Monitored patient roster. |
| `/api/v1/stream/ws` | `GET (Upgrade)` | `101 Switching Protocols` | High-frequency telemetry WebSocket feed. |
| `/api/v1/metrics` | `GET` | `200 OK` | Diagnostics engine & system performance telemetry. |
