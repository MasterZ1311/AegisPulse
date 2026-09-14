# AegisPulse: System Architecture & Technical Specification

**Document Status:** AUTHORITATIVE TECHNICAL ARCHITECTURE  
**Governing Standard:** `docs/SOURCE_OF_TRUTH.md`

---

## 1. System Overview

AegisPulse is engineered as a decoupled, edge-native TypeScript monorepo governed by strict, unidirectional dependency flows. It is divided into isolated domain workspaces:

```
aegispulse-monorepo/
├── apps/
│   └── web/                # React 19 + Vite Frontend Application
├── services/
│   └── api/                # Express REST, SSE & WebSocket Server
├── packages/
│   ├── types/              # Domain Models, Zod Schemas & Provenance
│   ├── clinical/           # Clinical Rules, MEWS/qSOFA, APS Engine, Copilot
│   ├── signal/             # Sensor Hub, Providers & Quality Gate
│   ├── simulation/         # Ward Simulator, PRNG, Clinical Scenarios
│   ├── persistence/        # SQLite Persistence, Repositories, Migrations
│   └── config/             # Shared Linting, Prettier & TSConfigs
└── research/
    ├── rppg/               # POS, CHROM, Green Algorithms & Benchmarks
    └── benchmarks/         # Scientific Evaluation & Perf Benchmarks
```

---

## 2. End-to-End System Topology

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   AEGISPULSE SYSTEM TOPOLOGY                                     │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                  │
│  [BEDSIDE / CLIENT EDGE (apps/web)]                                                              │
│  ├── Hardware Camera (getUserMedia) ──> Volatile Canvas (30 FPS) ──> Mean RGB Extraction         │
│  ├── Research DSP Engine (POS / CHROM / Butterworth Filter / Peak Detection)                     │
│  ├── Offline Sync Queue (services/offline-sync-queue.ts) ──> LocalStorage / IndexedDB           │
│  └── UI Presentation: Ward Radar, Attention Queue, Detail Modal, SBAR Exporter                   │
│                                           │                                                      │
│                                           │ HTTPS / WSS (TLS 1.3)                                │
│                                           │ Telemetry-Only Vectors (Zero Video Leaves Client)    │
│                                           ▼                                                      │
│  [API GATEWAY & STREAMING ENGINE (services/api)]                                                 │
│  ├── Security Shield: Rate Limiter, Request ID, Bearer Auth, RBAC Middleware                     │
│  ├── REST Routing (/api/v1/wards, /patients, /observations, /labs, /priorities, /actions, /sync) │
│  ├── Telemetry Pipeline Service: Ingestion Sanitization, Skew Sanity Check (Max 5m Skew)        │
│  ├── Real-Time Broadcaster: WebSocket Server (/ws/telemetry) & SSE (/api/v1/stream/events)     │
│  └── Sync Service: Idempotent Batch Synchronization with Conflict Resolution                     │
│                                           │                                                      │
│                                           ▼                                                      │
│  [DETERMINISTIC CLINICAL CORE (packages/clinical)]                                               │
│  ├── Acuity Engines: Subbe MEWS (0–14) & Singer qSOFA (0–3) Calculators                         │
│  ├── Trajectory Engine: Physiological Velocity (dHR/dt, dRR/dt, dShockIndex/dt)                 │
│  ├── Information Freshness: Exponential Quadratic Decay Clock (D_time)                          │
│  ├── Attention Allocation: Attention Priority Score (APS: 0–100) Multi-Vector Synthesis         │
│  ├── Explainability Engine: Contributing Factor Decomposition & "Why Now?" Summaries             │
│  └── AI Copilot Layer: Structured Evidence Package (Hashed), Advisory Guardrails & Audit Log    │
│                                           │                                                      │
│                                           ▼                                                      │
│  [PERSISTENCE BOUNDARY (packages/persistence)]                                                   │
│  ├── SQLite 3 Embedded Database (Pragma WAL Mode, Foreign Key Enforcement)                      │
│  ├── Schema Migrations (Runner & Version Tracking)                                               │
│  ├── Repositories: Patient, Ward, Bed, Observation, Lab, Priority, Action, Timeline, Audit       │
│  └── Automated Backup & Restore Utilities                                                        │
│                                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Layer Specifications & Module Responsibilities

### 3.1 Sensory Ingestion & Signal Layer (`packages/signal`, `research/rppg`)

- **Camera Ingestion**: Bounded 15-second guided optical check using HTML5 `<video>` and off-screen `<canvas>` at 30 FPS.
- **Forehead ROI Selection**: Focuses on the vascularized forehead skin region ($30\% W \times 18\% H$), minimizing eye saccade and speech motion artifacts.
- **Algorithms**:
  - `research/rppg/src/algorithms/pos.ts`: Plane-Orthogonal-to-Skin projection (Wang et al., 2017) eliminating specular reflection.
  - `research/rppg/src/algorithms/chrom.ts`: Chrominance-based method (de Haan & Jeanne, 2013).
  - `research/rppg/src/algorithms/green.ts`: Single-channel Green intensity baseline.
- **Filtering & DSP**: 4th-order zero-phase Butterworth bandpass filter ($0.75\text{ Hz} \to 3.33\text{ Hz}$ / $45\text{--}200\text{ BPM}$) in `research/rppg/src/signal-processing/filter.ts`.
- **Signal Quality Index (SQI)**: Real-time spectral signal-to-noise ratio comparing cardiac frequency energy against out-of-band noise.
- **Sensor Hub & Providers**: `packages/signal/src/hub/sensor-hub.ts` connects `RppgSensorProvider` and `SimulationSensorProvider` to unify optical and synthetic telemetry.

### 3.2 Clinical Inference & Attention Engine (`packages/clinical`)

- **Deterministic MEWS**: `packages/clinical/src/mews/calculator.ts` computes Subbe MEWS (0–14). Missing vitals trigger explicit uncertainty quantification rather than phantom baseline assumption.
- **Deterministic qSOFA**: `packages/clinical/src/qsofa/calculator.ts` evaluates tachypnea, hypotension, and altered mentation (0–3).
- **Physiological Velocity**: `packages/clinical/src/attentionPriority/components/velocity.ts` calculates rate of change across sliding windows.
- **Information Decay**: `packages/clinical/src/attentionPriority/components/decay.ts` computes $D_{\text{time}} = 100 \cdot (1 - e^{-\lambda (\Delta t)^2})$, steadily penalizing beds that remain unvisited.
- **Attention Priority Engine**: `packages/clinical/src/attentionPriority/attention-engine.ts` synthesizes velocity, decay, MEWS, biomarkers, and signal confidence into the **Attention Priority Score (APS: 0–100)**.
- **Explainability Engine**: `packages/clinical/src/explainability/generator.ts` generates deterministic "Why Now?" clinical narratives.
- **SBAR Engine**: `packages/clinical/src/sbar/` formats clinical observations into standardized handoff summaries.

### 3.3 Ward Simulation Engine (`packages/simulation`)

- **Ground Truth Isolation**: Strict architectural barrier separating simulated physiology from sensor observation layers (`packages/simulation/src/models/ground-truth.ts`).
- **Seeded PRNG**: Reproducible pseudorandom number generator for deterministic replay of clinical scenarios (`packages/simulation/src/prng/seeded-random.ts`).
- **Phenomena Engine**: Injects realistic clinical phenomena (transient coughing spikes, occult hemorrhagic shock, curtain occlusion, sensor detachment) without video simulation (`packages/simulation/src/phenomena/`).
- **Ward Simulator**: Manages a 6-bed ward state with virtual clock progression (`packages/simulation/src/engine/ward-simulator.ts`).

### 3.4 AI Copilot Layer (`packages/clinical/src/copilot`)

- **Strictly Advisory**: The AI Copilot is decoupled from scoring math.
- **Structured Evidence Package**: Input context is cryptographically hashed with SHA-256 before inference (`packages/clinical/src/copilot/context-builder.ts`).
- **Multi-Tier Guardrails**: `packages/clinical/src/copilot/guardrails.ts` enforces:
  - Immediate refusal to provide medical diagnosis.
  - Immediate refusal to order medications or fluid dosages.
  - Prompt injection and system jailbreak defense.
  - Mandatory clinical advisory disclaimer injection.
- **Audit Logging**: Every prompt and response is persisted to the immutable audit ledger (`packages/clinical/src/copilot/audit-logger.ts`).

### 3.5 Persistence Layer (`packages/persistence`)

- **Database Engine**: Embedded SQLite 3 with Write-Ahead Logging (`PRAGMA journal_mode = WAL;`) and synchronous normal mode for high-throughput reads.
- **Migrations**: Incremental schema migrations (`packages/persistence/src/migrations/runner.ts`).
- **Repositories**: Type-safe parameterized prepared statements preventing SQL injection:
  - `patient.repository.ts`, `ward.repository.ts`, `observation.repository.ts`, `lab.repository.ts`, `attention.repository.ts`, `clinical-action.repository.ts`, `timeline.repository.ts`, `audit.repository.ts`.
- **Foreign Key Enforcement**: `PRAGMA foreign_keys = ON;` strictly enforced on every connection.

### 3.6 API & Real-Time Gateway (`services/api`)

- **Express 4 Gateway**: REST routing mounted under `/api/v1/`.
- **Real-Time Streaming**:
  - WebSocket Server (`services/api/src/stream/websocket-server.ts` mounted at `/ws/telemetry`) for bi-directional live telemetry.
  - Server-Sent Events (`services/api/src/stream/sse-handler.ts` mounted at `/api/v1/stream/events`) for lightweight unidirectional ward radar broadcasts.
- **Security Middleware**:
  - `services/api/src/middleware/auth.ts`: Bearer JWT token validation.
  - `services/api/src/middleware/rbac.ts`: Role-Based Access Control (`WARD_NURSE`, `CHARGE_NURSE`, `PHYSICIAN`, `WARD_ADMIN`).
  - `services/api/src/middleware/rate-limiter.ts`: Sliding-window DoS protection.
  - `services/api/src/middleware/request-id.ts`: Distributed tracing correlation IDs.
  - `services/api/src/middleware/errors.ts`: Sanitized error responses preventing stack trace leakage.

### 3.7 Offline Architecture & Edge Resilience (`apps/web`, `services/api`)

- **4-State Connectivity Machine**: `ONLINE` $\leftrightarrow$ `DEGRADED` $\leftrightarrow$ `OFFLINE` $\leftrightarrow$ `SYNCING`.
- **Client Queuing**: Offline nurse actions and observations are stored in browser local storage with monotonic timestamps and UUID idempotency keys (`apps/web/src/services/offline-sync-queue.ts`).
- **Idempotent Sync Service**: `services/api/src/services/sync.service.ts` processes batched sync items, resolving conflicts and rejecting stale items without duplicating entries.
- **Privacy Invariant Guarantee**: Zero raw video frames are ever queued, persisted, or transmitted while offline.

---

## 4. Trust Boundaries & Data Flow

```
[OUTSIDE CLINICAL TRUST BOUNDARY]
  Bedside Webcam Hardware / Browser DOM Video Element
         │
         │ (Frame buffer in volatile RAM; zero disk write; destroyed in 33ms)
         ▼
[CLIENT EDGE TRUST BOUNDARY]
  HTML5 Canvas ──> POS/CHROM DSP ──> Numerical Vitals { hr: 84, sqi: 94 }
         │
         │ HTTPS / WSS with TLS 1.3 (Bearer Auth)
         │ Strict Zod Payload Validation (Schema rejects video/binary keys)
         ▼
[HOSPITAL LOCAL AREA NETWORK TRUST BOUNDARY]
  AegisPulse API Gateway (services/api)
  ├── Rate Limiter & DoS Shield
  ├── RBAC & Ward-Scoping Barrier
  └── Sanitized Logging (Zero PHI in stdout)
         │
         ├── Parameterized IPC / Direct Module Calls
         ▼
  Deterministic Acuity Engine & SQLite Persistence (WAL Mode)
```

---

## 5. Deployment Model

- **Edge Deployment**: Designed to run entirely on a low-cost bedside tablet or mini-PC (e.g. Raspberry Pi 5 / Intel N100) on the hospital local network.
- **Zero Cloud Requirement**: Full end-to-end functionality (optical rPPG, MEWS, APS calculation, ward radar, persistence) runs client-side and on-premise without external cloud dependencies.
- **Docker Containerization**: Production multi-stage `Dockerfile.api` and `Dockerfile.web` managed via `docker-compose.yml`.
