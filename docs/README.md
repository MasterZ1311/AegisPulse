# AegisPulse Documentation Hub

**Patient Deterioration Radar & Nurse Attention Allocation Engine**

---

## 1. Overview

**AegisPulse** is an edge-native clinical decision support platform designed for high-density, resource-constrained general hospital wards.

### One-Line Description

A continuous deterioration radar that translates multi-modal bedside observations, physiological velocity, information freshness, and clinical rules into an explainable, dynamically ranked nurse attention queue.

### The Problem

In general hospital wards across public health systems and developing economies, nurse-to-patient ratios commonly reach **1:30 to 1:50**. Nurses perform manual vital rounds only once every 4 to 6 hours, leaving vast multi-hour "dead zones" where acute deterioration occurs silently. Traditional continuous monitors fail because:

1. **Capital Cost**: Bedside telemetry monitors cost ₹2.5L–₹6L ($3,000–$8,000) per bed, which public wards cannot afford.
2. **Alarm Fatigue**: Traditional threshold monitors generate up to 350 alarms per bed per day, of which **85% to 99% are clinically non-actionable false alarms**, driving nurses to mute them.
3. **The "Isolated Normal" Fallacy**: Compensatory physiology masks decline. Patients maintain normal heart rate and blood pressure until sudden cardiovascular or septic collapse.

### The Solution

AegisPulse reframes the clinical paradigm from _"measure everyone continuously with beeping alarms"_ to _"continuously evaluate who needs the nurse's attention next, and why."_

### Why It Matters

Instead of generating dozens of isolated acoustic alarms that compete for attention, AegisPulse computes a single, transparent **Attention Priority Score (APS: 0–100)** for each patient, organizing beds into an explainable priority queue. Clinicians can immediately understand which bed requires intervention and the exact physiological drivers behind the score.

---

## 2. Core Clinical Workflow

```
[ Bedside Sensor / Camera / Manual Entry ]
                     │
                     ▼
       [ Signal Quality / Trust Gate ]
                     │ (Corrupted signals penalized, not hallucinated)
                     ▼
             [ Validated Observations ]
                     │
                     ▼
          [ Clinical Rules Engine ]
          (Subbe MEWS, Singer qSOFA)
                     │
                     ▼
          [ Trajectory & Velocity ]
          (dHR/dt, dRR/dt, dShockIndex/dt)
                     │
                     ▼
       [ Attention Priority Score (APS) ]
       (Dynamic 0–100 Bed Prioritization)
                     │
                     ▼
        [ Transparent Explainability ]
           ("Why Now?" Clinical Drivers)
                     │
                     ▼
      [ Bedside Human Nurse Verification ]
                     │
                     ▼
         [ Updated Observations Logged ]
```

---

## 3. Major Technical Components

AegisPulse is structured as an edge-native TypeScript monorepo with strict dependency boundaries:

- [`@aegispulse/types`](file:///e:/My%20Development/AegisPulse/packages/types): Exhaustive domain models, Zod runtime schemas, provenance envelopes, and physiological sanity boundary checks.
- [`@aegispulse/clinical`](file:///e:/My%20Development/AegisPulse/packages/clinical): Deterministic clinical calculators for Subbe MEWS (0–14), Singer qSOFA (0–3), Physiological Velocity, Information Decay, Attention Priority Engine (APS: 0–100), Explainability Engine, and AI Copilot guardrails.
- [`@aegispulse/signal`](file:///e:/My%20Development/AegisPulse/packages/signal): Sensor Hub, sensor adapters, rPPG and simulation providers, and Signal Quality Index (SQI) confidence gating.
- [`@aegispulse/simulation`](file:///e:/My%20Development/AegisPulse/packages/simulation): Ground-truth isolated 6-patient virtual ward simulator, PRNG seeded random generators, virtual clock, and clinical stress-test scenario catalog.
- [`@aegispulse/persistence`](file:///e:/My%20Development/AegisPulse/packages/persistence): SQLite database engine in WAL mode, migration runner, parameterized repositories for patients, beds, observations, labs, priorities, timeline, and immutable audit trails.
- [`@aegispulse/rppg`](file:///e:/My%20Development/AegisPulse/research/rppg): Mathematical implementations of Plane-Orthogonal-to-Skin (POS), Chrominance (CHROM), and Green baseline rPPG algorithms, 4th-order Butterworth bandpass filters, FFT spectral analyzers, and synthetic benchmarking harness.
- [`@aegispulse/api`](file:///e:/My%20Development/AegisPulse/services/api): Express REST API, WebSocket server, Server-Sent Events (SSE) broadcaster, RBAC authorization, rate limiting, and 10 red-team hardened defense vectors.
- [`@aegispulse/web`](file:///e:/My%20Development/AegisPulse/apps/web): React 19 + Tailwind CSS v4 Ward Radar dashboard, real-time Attention Queue, Bedside Inspection Panel, SBAR dossier generator, offline sync queue, and demo scrubber.

---

## 4. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            AEGISPULSE TOPOLOGY                              │
├──────────────────────────────────────┬──────────────────────────────────────┤
│ CLIENT EDGE (Browser / Tablet)       │ Volatile RAM only, HTML5 Canvas,     │
│                                      │ POS/CHROM extraction, Offline Queue  │
├──────────────────────────────────────┼──────────────────────────────────────┤
│ API GATEWAY & STREAM SERVER          │ Express, WebSocket, SSE, RBAC,       │
│                                      │ Rate Limiter, Red-Team Hardened      │
├──────────────────────────────────────┼──────────────────────────────────────┤
│ DETERMINISTIC CLINICAL CORE          │ MEWS, qSOFA, Velocity, Decay,        │
│                                      │ Attention Priority Score (APS 0–100) │
├──────────────────────────────────────┼──────────────────────────────────────┤
│ PERSISTENCE TIER                     │ SQLite (WAL mode), Audit Ledger,     │
│                                      │ Provenance-tracked observations      │
└──────────────────────────────────────┴──────────────────────────────────────┘
```

---

## 5. Current Implementation Status

AegisPulse is currently at **Level 1 (Hackathon Prototype / Research Proof-of-Concept)**.

- **Implemented & Verified**: Deterministic APS engine, Subbe MEWS, Singer qSOFA, 15-second guided rPPG spot-check via POS/CHROM, 6-bed ward simulation, offline-first sync engine, 515 automated test cases passing.
- **Excised / Prohibited**: Contactless SpO2, cuffless Blood Pressure, autonomous diagnosis, continuous 24/7 video recording.
- **Pending Future Validation**: Multi-center prospective clinical trials and CDSCO/FDA SaMD regulatory submissions.

---

## 6. Quick-Start Guide

### Prerequisites

- Node.js $\ge 20.18.0$
- npm $\ge 10.0.0$

### Setup & Run

```bash
# 1. Clone and enter repository
git clone https://github.com/MasterZ1311/AegisPulse.git
cd AegisPulse

# 2. Install dependencies
npm install

# 3. Build all workspace packages
npm run build

# 4. Start API server and Web frontend concurrently
npm run dev
```

- Web Dashboard: `http://localhost:5173/`
- API Health Check: `http://localhost:3000/health`
- API Documentation: `http://localhost:3000/docs`

### Run Automated Tests

```bash
# Run all 515 tests across 69 test suites
npx vitest run

# Run scientific rPPG benchmarks
npm run benchmark:science

# Run scale & performance benchmarks
npm run benchmark:perf
```

---

## 7. Canonical Demo Instructions

1. Open `http://localhost:5173/` in your browser.
2. Confirm the top header indicates `ONLINE` (green) with 6 beds active.
3. Use the bottom **Demo Controller** scrubber to execute the flagship sequence:
   - **Step 0 (Baseline)**: All 6 beds stable; APS < 30 (LOW priority).
   - **Step 1 (Transient Spike)**: Bed 405 coughs; persistence filter dampens velocity; no spurious alarm.
   - **Step 2 (Information Decay)**: Bed 402 unvisited for 3.5 hours; APS rises to prompt routine nurse check.
   - **Step 3 (Occult Shock)**: Bed 403 (Eleanor Vance) deteriorates with narrowing pulse pressure and Shock Index 1.31; bed jumps to Rank 1 with APS 88 (CRITICAL_REVIEW).
   - **Step 4 (Signal Loss)**: Bed 404 moves; camera signal degrades; system gates confidence without hallucinating numbers.
   - **Step 5 (Clinical Action)**: Click Bed 403, open Detail Panel, view deterministic reasoning, and generate structured SBAR briefing.
   - **Step 6 (Recovery)**: Bed 403 receives fluid bolus; vitals normalize; APS returns to LOW.

For the full presentation script and jury Q&A guide, see [`docs/DEMO.md`](file:///e:/My%20Development/AegisPulse/docs/DEMO.md).

---

## 8. Safety Disclaimer

> [!WARNING]
> **INVESTIGATIONAL RESEARCH PROTOTYPE — NOT FOR CLINICAL DIAGNOSTIC DECISION-MAKING**  
> AegisPulse is an academic and engineering research prototype. It has not received clearance or approval from the Central Drugs Standard Control Organisation (CDSCO), the US Food and Drug Administration (FDA), or European CE Mark authorities as Software as a Medical Device (SaMD). It must never be used as a primary diagnostic instrument, an intensive care telemetry replacement, or an autonomous medical intervention controller.

---

## 9. Authoritative Documentation Index

| Document                                                                                            | Purpose                                                                    |
| :-------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------- |
| [`docs/SOURCE_OF_TRUTH.md`](file:///e:/My%20Development/AegisPulse/docs/SOURCE_OF_TRUTH.md)         | Binding architectural and clinical ground truth.                           |
| [`docs/PRODUCT.md`](file:///e:/My%20Development/AegisPulse/docs/PRODUCT.md)                         | Problem statement, target users, workflow, APS, and boundaries.            |
| [`docs/ARCHITECTURE.md`](file:///e:/My%20Development/AegisPulse/docs/ARCHITECTURE.md)               | 5-layer system design, data flow, trust boundaries, and modules.           |
| [`docs/CLINICAL_LOGIC.md`](file:///e:/My%20Development/AegisPulse/docs/CLINICAL_LOGIC.md)           | MEWS, qSOFA, velocity, information decay, and APS mathematics.             |
| [`docs/SIGNAL_PROCESSING.md`](file:///e:/My%20Development/AegisPulse/docs/SIGNAL_PROCESSING.md)     | Contactless optical sensing (POS/CHROM), filtering, and SQI gating.        |
| [`docs/SECURITY.md`](file:///e:/My%20Development/AegisPulse/docs/SECURITY.md)                       | Threat model, RBAC, API security, and 10 red-team attack defenses.         |
| [`docs/PRIVACY.md`](file:///e:/My%20Development/AegisPulse/docs/PRIVACY.md)                         | Zero-raw-video invariant, RAM lifecycle, and DPDP/HIPAA compliance.        |
| [`docs/SAFETY.md`](file:///e:/My%20Development/AegisPulse/docs/SAFETY.md)                           | Intended use, non-claims, anti-placebo invariant, and risk disclosure.     |
| [`docs/API.md`](file:///e:/My%20Development/AegisPulse/docs/API.md)                                 | Verified REST endpoints, WebSockets, SSE events, and schemas.              |
| [`docs/DATA_MODEL.md`](file:///e:/My%20Development/AegisPulse/docs/DATA_MODEL.md)                   | Domain entity specifications, relationships, and Zod schemas.              |
| [`docs/TESTING.md`](file:///e:/My%20Development/AegisPulse/docs/TESTING.md)                         | Test taxonomy, 515 passing test suites, and benchmark execution.           |
| [`docs/RESEARCH.md`](file:///e:/My%20Development/AegisPulse/docs/RESEARCH.md)                       | Scientific foundations, peer-reviewed citations, and synthetic benchmarks. |
| [`docs/LIMITATIONS.md`](file:///e:/My%20Development/AegisPulse/docs/LIMITATIONS.md)                 | Brutally honest engineering, physiological, and clinical limitations.      |
| [`docs/DEPLOYMENT.md`](file:///e:/My%20Development/AegisPulse/docs/DEPLOYMENT.md)                   | Production setup, Docker configurations, operations, and backups.          |
| [`docs/DEMO.md`](file:///e:/My%20Development/AegisPulse/docs/DEMO.md)                               | Canonical hackathon demonstration script, timeline, and speaker guide.     |
| [`docs/ROADMAP.md`](file:///e:/My%20Development/AegisPulse/docs/ROADMAP.md)                         | Structured evolution path: NOW, NEXT, LATER, RESEARCH.                     |
| [`docs/CHANGELOG.md`](file:///e:/My%20Development/AegisPulse/docs/CHANGELOG.md)                     | Authoritative release history from clean baseline forward.                 |
| [`docs/CLAIMS_LEDGER.md`](file:///e:/My%20Development/AegisPulse/docs/CLAIMS_LEDGER.md)             | Epistemic defensibility matrix for all project claims.                     |
| [`docs/DOCUMENTATION_AUDIT.md`](file:///e:/My%20Development/AegisPulse/docs/DOCUMENTATION_AUDIT.md) | Pre-reset documentation audit inventory and classification.                |
| [`docs/openapi.yaml`](file:///e:/My%20Development/AegisPulse/docs/openapi.yaml)                     | Machine-readable OpenAPI 3.0 specification.                                |
