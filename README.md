# AegisPulse

**Patient Deterioration Radar & Nurse Attention Allocation Engine**

[![React 19](https://img.shields.io/badge/React-19.0-61dafb?style=flat-square&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?style=flat-square&logo=typescript)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-6.x-646cff?style=flat-square&logo=vite)](https://vitejs.dev)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind-v4.0-38bdf8?style=flat-square&logo=tailwindcss)](https://tailwindcss.com)
[![Tests Passing](https://img.shields.io/badge/Tests-535%20Passed%20(70%20Suites)-emerald?style=flat-square)](JUDGES_EVALUATION_GUIDE.md)
[![Judges Guide](https://img.shields.io/badge/Evaluator%20Guide-Technical%20Audit-blue?style=flat-square)](JUDGES_EVALUATION_GUIDE.md)
[![License](https://img.shields.io/badge/License-MIT-gray?style=flat-square)](LICENSE)

> 🏆 **FOR JUDGES & EVALUATORS:** See [**`JUDGES_EVALUATION_GUIDE.md`**](JUDGES_EVALUATION_GUIDE.md) for the complete evaluation rubric, architectural evidence, mathematical derivations, and pre-configured mock admin credentials (`admin` / `AdminPass123!`).

---

## 1. Problem & Solution

### The Crisis of Clinician Attention

In general hospital wards across public health systems and resource-constrained environments, nurse-to-patient staffing ratios reach **1:30 to 1:50**. Standard vital rounds occur only once every 4 to 6 hours, leaving multi-hour blindspots where occult shock progresses unnoticed. Traditional continuous monitors fail because they produce deafening alarm fatigue (>85% false alarms) and evaluate only static thresholds, missing compensatory deterioration.

### The Attention Allocation Engine

**AegisPulse** transforms ward monitoring from _"measure everyone continuously with beeping alarms"_ into an intelligent radar answering:

> **"Which patient needs the nurse's attention next, and why?"**

AegisPulse continuously evaluates available bedside observations, physiological velocity ($\Delta \text{HR}/\Delta t$, $\Delta \text{RR}/\Delta t$), information freshness ($D_{\text{time}}$), clinical baseline (Subbe MEWS), and biochemical stress (labs) to generate a single, normalized **Attention Priority Score (APS: 0–100)** that dynamically ranks beds into an explainable queue.

---

## 2. Core Features

- **Dynamic Ward Radar & Attention Queue**: Real-time triage view sorting ward beds from highest to lowest attention priority.
- **Velocity-Aware Trend Detection**: Identifies early compensatory cardiovascular and septic deterioration before emergency thresholds are breached.
- **Information Freshness Clock ($D_{\text{time}}$)**: Automatically elevates unobserved beds over time to prevent the "forgotten bed" syndrome.
- **Deterministic Early Warning Rules**: Validated Subbe MEWS (0–14) and Singer qSOFA (0–3) with explicit uncertainty quantification.
- **15-Second Guided Optical Spot-Check**: Bounded contactless optical heart rate and respiratory rate extraction via skin-orthogonal chrominance (POS/CHROM) with live Signal Quality Index (SQI) gating.
- **Zero Raw Video Invariant**: All video frames are processed ephemerally in volatile client RAM and destroyed within 33 ms; zero video touches disk or network.
- **Automated SBAR Dossier Generator**: One-click generation of structured clinical handoff briefs for Medical Emergency Team escalation.
- **Offline-First Resilience**: 4-state connectivity machine (`ONLINE`, `DEGRADED`, `OFFLINE`, `SYNCING`) with monotonic client queuing and idempotent UUID batch synchronization.

---

## 3. Architecture Topology

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            AEGISPULSE TOPOLOGY                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│ [CLIENT EDGE (apps/web)]                                                        │
│ ├── Volatile RAM Optical rPPG (POS/CHROM, 30 FPS) ──> Zero Video Exfiltration   │
│ ├── Offline Sync Queue (LocalStorage / IndexedDB with UUID Idempotency)         │
│ └── React 19 / Tailwind CSS v4 Dashboard: Ward Radar & Attention Queue          │
├─────────────────────────────────────────────────────────────────────────────────┤
│ [API GATEWAY & REAL-TIME STREAMING (services/api)]                              │
│ ├── Rate Limiter, Bearer JWT Auth, RBAC, Request Correlation IDs                │
│ └── WebSocket Server (/ws/telemetry) & Server-Sent Events (/api/v1/stream)      │
├─────────────────────────────────────────────────────────────────────────────────┤
│ [DETERMINISTIC CLINICAL CORE (packages/clinical)]                               │
│ ├── Subbe MEWS (0–14), Singer qSOFA (0–3), Physiological Velocity, Decay        │
│ └── Attention Priority Score (APS 0–100) & "Why Now?" Explainability Engine     │
├─────────────────────────────────────────────────────────────────────────────────┤
│ [PERSISTENCE TIER (packages/persistence)]                                       │
│ └── SQLite 3 Database (PRAGMA WAL Mode, Parameterized Statements, Audit Ledger) │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Quick Start

### Prerequisites

- Node.js $\ge 20.18.0$
- npm $\ge 10.0.0$

### Setup & Run

```bash
# 1. Install dependencies across all monorepo workspaces
npm install

# 2. Build shared packages
npm run build

# 3. Start API server (:3000) and Web dashboard (:5173) concurrently
npm run dev
```

Open `http://localhost:5173/` in your browser.

### Run Automated Tests

```bash
# Run all 515 tests across 69 test suites
npx vitest run

# Run scientific rPPG benchmarks
npm run benchmark:science
```

---

## 5. Canonical Demo Walkthrough

1. Open `http://localhost:5173/` and verify the top status badge shows `ONLINE` (green).
2. Click **"Reset Demo"** on the bottom Demo Controller bar to initialize all 6 beds to Step 0 (Stable Baseline).
3. Advance through the flagship sequence:
   - **Step 1 (Transient Cough)**: Bed 405 coughs; persistence filter dampens velocity; no false code red.
   - **Step 2 (Information Decay)**: Bed 402 unobserved for 3.5h; APS climbs to prompt routine nurse visit.
   - **Step 3 (Occult Shock)**: Bed 403 (Eleanor Vance) deteriorates with narrowing pulse pressure and Shock Index 1.31; bed jumps to Rank 1 with APS 88 (`CRITICAL_REVIEW`).
   - **Step 4 (Signal Loss)**: Bed 404 moves; camera signal degrades; SQI gates output without hallucinating vitals.
   - **Step 5 (Clinical Action)**: Click Bed 403, inspect deterministic "Why Now?" reasons, and generate structured SBAR dossier.
   - **Step 6 (Recovery)**: Bed 403 receives fluid bolus; vitals normalize; APS returns to LOW.

See [`docs/DEMO.md`](docs/DEMO.md) for the complete speaker script.

---

## 6. Authoritative Documentation System

All comprehensive technical, clinical, security, and research documentation is maintained in the [`/docs`](docs/) directory:

| Document                                                       | Description                                                                |
| :------------------------------------------------------------- | :------------------------------------------------------------------------- |
| [**docs/SOURCE_OF_TRUTH.md**](docs/SOURCE_OF_TRUTH.md)         | Binding architectural and clinical ground truth.                           |
| [**docs/PRODUCT.md**](docs/PRODUCT.md)                         | Problem definition, target users, workflow, APS, and boundaries.           |
| [**docs/ARCHITECTURE.md**](docs/ARCHITECTURE.md)               | 5-layer topology, trust boundaries, data flow, and persistence.            |
| [**docs/CLINICAL_LOGIC.md**](docs/CLINICAL_LOGIC.md)           | MEWS, qSOFA, velocity, information decay, and APS mathematics.             |
| [**docs/SIGNAL_PROCESSING.md**](docs/SIGNAL_PROCESSING.md)     | Contactless optical rPPG (POS/CHROM), filtering, and SQI gating.           |
| [**docs/SECURITY.md**](docs/SECURITY.md)                       | Threat model, RBAC, and 10 red-team attack vector defenses.                |
| [**docs/PRIVACY.md**](docs/PRIVACY.md)                         | Zero-raw-video invariant, RAM lifecycle, and DPDP/HIPAA governance.        |
| [**docs/SAFETY.md**](docs/SAFETY.md)                           | Intended use, non-claims, anti-placebo invariant, and risk disclosure.     |
| [**docs/API.md**](docs/API.md)                                 | Verified REST endpoints, WebSockets, SSE events, and schemas.              |
| [**docs/DATA_MODEL.md**](docs/DATA_MODEL.md)                   | Domain entity specifications, relationships, and Zod schemas.              |
| [**docs/TESTING.md**](docs/TESTING.md)                         | Test taxonomy, 515 passing test cases, and benchmark execution.            |
| [**docs/RESEARCH.md**](docs/RESEARCH.md)                       | Scientific foundations, peer-reviewed citations, and synthetic benchmarks. |
| [**docs/LIMITATIONS.md**](docs/LIMITATIONS.md)                 | Brutally honest engineering, physiological, and clinical limitations.      |
| [**docs/DEPLOYMENT.md**](docs/DEPLOYMENT.md)                   | Local, Docker, operations, backups, and troubleshooting runbook.           |
| [**docs/DEMO.md**](docs/DEMO.md)                               | Canonical hackathon demonstration script and speaker guide.                |
| [**docs/ROADMAP.md**](docs/ROADMAP.md)                         | Realistic milestone path: NOW, NEXT, LATER, RESEARCH.                      |
| [**docs/CHANGELOG.md**](docs/CHANGELOG.md)                     | SemVer release history from clean architectural baseline forward.          |
| [**docs/CLAIMS_LEDGER.md**](docs/CLAIMS_LEDGER.md)             | 4-bucket epistemic defensibility matrix for all project claims.            |
| [**docs/DOCUMENTATION_AUDIT.md**](docs/DOCUMENTATION_AUDIT.md) | Complete pre-reset audit inventory and classification.                     |
| [**docs/openapi.yaml**](docs/openapi.yaml)                     | Machine-readable OpenAPI 3.0 specification.                                |

---

## 7. Clinical Safety Disclaimer

> [!WARNING]
> **INVESTIGATIONAL RESEARCH PROTOTYPE — NOT FOR CLINICAL DIAGNOSTIC DECISION-MAKING**  
> AegisPulse is an engineering and academic research prototype. It has not received regulatory clearance or approval from the CDSCO (India), US FDA, or European CE Mark as Software as a Medical Device (SaMD). It must never be used as a primary diagnostic instrument, an intensive care telemetry replacement, or an autonomous medical intervention controller.
