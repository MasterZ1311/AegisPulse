# 🛡️ AegisPulse: Patient Deterioration Radar & Nurse Attention Allocation Engine

[![VMedithon 3.0](https://img.shields.io/badge/Event-VMedithon%203.0%20(VIT%20Chennai)-00f0ff?style=for-the-badge)](https://vit.ac.in)
[![React 19](https://img.shields.io/badge/React-19.0-61dafb?style=for-the-badge&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-6.x-646cff?style=for-the-badge&logo=vite)](https://vitejs.dev)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind-v4.0-38bdf8?style=for-the-badge&logo=tailwindcss)](https://tailwindcss.com)
[![License](https://img.shields.io/badge/License-MIT-emerald?style=for-the-badge)](LICENSE)
[![Compliance](https://img.shields.io/badge/Compliance-HIPAA%20%7C%20DPDP%20Act%202023-purple?style=for-the-badge)](#privacy-and-zero-trust-architecture)

> **"In general hospital wards, the scarce resource is not patient data, but clinician attention. AegisPulse continuously estimates which patient deserves the nurse's attention next — and explains why."**

---

## 📑 Master Documentation Index

All architectural specifications, clinical boundaries, financial models, and research are documented across our specifications and master guides in `docs/` and root:

### 🏛️ Rebuild Specifications & Binding Policies (New)
| Specification | Core Focus | Target Audience |
| :--- | :--- | :--- |
| 📜 [**Project Constitution**](file:///e:/My%20Development/AegisPulse/PROJECT_CONSTITUTION.md) | Ground-truth reset: Skepticism, real vs. unvalidated claims, forbidden clinical claims, privacy invariants. | Everyone / All Contributors |
| 📋 [**Product Specification**](file:///e:/My%20Development/AegisPulse/docs/PRODUCT_SPEC.md) | Finalized problem, user personas, 5-stage triage loop, data models (`Patient`, `TrendVector`, `AttentionAssessment`), non-goals, demo script. | Product Managers, Clinical Leads, Judges |
| 🏗️ [**Architecture Principles**](file:///e:/My%20Development/AegisPulse/docs/ARCHITECTURE_PRINCIPLES.md) | Safety before novelty, memory enclave (volatile RAM only), 4-state sensor degradation (`TRUSTED` $\to$ `LOST`), 5-layer domain design. | Systems Architects, Senior Engineers |
| 🛡️ [**Safety Boundaries**](file:///e:/My%20Development/AegisPulse/docs/SAFETY_BOUNDARIES.md) | Allowed vs. forbidden claims (no autonomous sepsis dx, no fake BP/SpO2), uncertainty behavior, Human-in-the-Loop (HITL) mandates. | Clinical Safety Officers, Regulatory Auditors |
| ⚖️ [**Architecture Decisions (ADRs)**](file:///e:/My%20Development/AegisPulse/docs/DECISIONS.md) | Frozen ADRs: ADR-001 (Attention Radar Pivot) to ADR-006 (Information Decay as Equal Partner). | Technical Leads, Evaluators |
| 🎯 [**Sprint Milestones**](file:///e:/My%20Development/AegisPulse/docs/MILESTONES.md) | Staged engineering roadmap from M0 (Contracts) to M5 (Stage Polish). | Engineering Team, Project Managers |

### 📚 Domain Deep Dives & Pitch Materials
| Document | Focus & Highlights | Target Audience |
| :--- | :--- | :--- |
| 🎯 [**02. Problem Statement & Solution Blueprint**](file:///e:/My%20Development/AegisPulse/docs/02_PROBLEM_STATEMENT_AND_SOLUTION_ARCHITECTURE.md) | Nurse attention scarcity, 1:40 staffing ratios, information decay, and the Attention Priority Score (APS) formula. | Healthcare Administrators, CMOs |
| ⚡ [**02. Live Hackathon Pitch & Demo Flow**](file:///e:/My%20Development/AegisPulse/docs/02_HACKATHON_PITCH_SCRIPT_AND_DEMO_FLOW.md) | 3-minute stage pitch script, interactive Bed 3 / Bed 8 live demo flow, and immediate Q&A defense. | Stage Presenters, Hackathon Jury |
| 🎙️ [**07. Master Pitch Script & Judges FAQ**](file:///e:/My%20Development/AegisPulse/docs/07_MASTER_PITCH_SCRIPT_NATIONAL_CRISIS_AND_JUDGES_FAQ.md) | 2-minute elevator pitch with shocking hook (*"In a 40-bed ward, monitoring everyone is noise..."*), recurring CTAs, and 12 bulletproof defense answers. | Presenters, Founders, Hackathon Jury |
| 📊 [**03. Slide Deck Master Information**](file:///e:/My%20Development/AegisPulse/docs/03_SLIDE_DECK_MASTER_INFORMATION.md) | Slide-by-slide 12-slide master deck structure aligned with the Attention Radar positioning. | Pitch Deck Designers, Judges |
| ⚙️ [**04. Technical Architecture & Developer Spec**](file:///e:/My%20Development/AegisPulse/docs/04_TECHNICAL_ARCHITECTURE_AND_DEVELOPER_SPEC.md) | 5-layer architecture, POS rPPG algorithm, 15-second spot-check reticle, APS engine, SQLite schemas, FHIR mappings. | Senior Engineers, CTOs |
| 📖 [**05. Master Technical Keywords Glossary**](file:///e:/My%20Development/AegisPulse/docs/05_TECHNICAL_KEYWORDS_GLOSSARY.md) | 30+ keywords: APS, Information Decay, Physiological Velocity, Shock Index, POS, MEWS, SBAR, DPDP Act. | Students, Non-Technical Judges |
| 🎭 [**06. Dual-Track Presentation Guide**](file:///e:/My%20Development/AegisPulse/docs/06_DUAL_PRESENTATION_GUIDE_ELIF5_AND_PROFESSIONAL.md) | Track A (Explain to a 5-Year-Old) vs. Track B (Explain to a Chief Medical Officer). | Keynote Speakers, Clinical Leads |
| 💰 [**03. Financial Feasibility, Scaling & Policy**](file:///e:/My%20Development/AegisPulse/docs/03_FINANCIAL_FEASIBILITY_SCALING_AND_GOVERNMENT_POLICY.md) | Unit economics, phased rollout: Chennai (2,200 beds) $\to$ Tamil Nadu (45,000 beds, TNHSRP) $\to$ India (1M+ beds, ABDM), BIRAC/MeitY grants. | Health Economists, Government Officials |
| 📝 [**01. Conference Paper Abstract & Methodology**](file:///e:/My%20Development/AegisPulse/docs/01_RESEARCH_PAPER_ABSTRACT_AND_METHODOLOGY.md) | Concise 4-page academic conference paper covering POS rPPG, APS formulation, and benchmark metrics. | Conference Reviewers, Academics |
| 📄 [**01. Academic Research Paper & Statistics**](file:///e:/My%20Development/AegisPulse/docs/01_RESEARCH_PAPER_EXTENDED_AND_STATISTICAL_BENCHMARKS.md) | Full 15-page academic paper, clinical epidemiology, literature review, Bland-Altman statistical analysis, and limits. | Academic Mentors, IEEE/ACM Reviewers |
| 🤖 [**08. AI Agent Master Knowledge Base**](file:///e:/My%20Development/AegisPulse/docs/08_AI_AGENT_SYSTEM_CONTEXT_AND_INNOVATION_ROADMAP.md) | Complete operational context and P0–P4 innovation backlog for third-party autonomous AI agents. | Autonomous Coding Agents, Subagents |

---

## 🚨 The Core Healthcare Problem

In general hospital wards across the globe, **one nurse cares for 30 to 40 patients simultaneously.**

Traditional hospital telemetry solutions fail because they attempt to turn every general ward bed into an expensive, beeping intensive care monitor:
- **Alarm Fatigue**: Conventional monitors produce hundreds of alarms per day, of which **>85% are false or non-actionable**. Nurses become desensitized and mute them.
- **The "Isolated Normal" Fallacy**: A patient compensating for internal bleeding or septic shock can maintain a "normal" heart rate (e.g., 95 BPM) right until they collapse. Single-point static thresholds miss the **velocity of change**.
- **Information Decay**: When rounds occur every 4 to 6 hours, clinicians have zero visibility into which patient's data is fresh and whose is dangerously stale.

---

## 💡 The AegisPulse Solution: The Attention Allocation Radar

AegisPulse does not pretend to replace all medical hardware with a webcam. Instead, it acts as a **Patient Deterioration Radar** that continuously evaluates four multi-modal vectors:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 THE ATTENTION PRIORITY SCORE (APS)                               │
│                                                                                                  │
│  [1. Physiological Velocity]   (dHR/dt, dRR/dt, Shock Index trend — rate of change)              │
│               +                                                                                  │
│  [2. Information Decay]        (Time elapsed since last verified check × sensor uncertainty)     │
│               +                                                                                  │
│  [3. Clinical Foundation]      (Standard Modified Early Warning Score - MEWS 0–14)               │
│               +                                                                                  │
│  [4. Biomarker Evidence]       (Serum Lactate, WBC, Creatinine elevation)                        │
│               │                                                                                  │
│               ▼                                                                                  │
│  ATTENTION PRIORITY SCORE (0 – 100) ──► DYNAMICALLY SORTS WARD BEDS: #1 TO #40                  │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### The System Delivers:
1. **Dynamic Priority Queue**: Re-sorts all ward beds in real-time, placing the most urgent patient at Rank #1.
2. **Explainable "WHY NOW" Cards**: 4–5 bullet points detailing the exact mathematical drivers (e.g., *"HR +22% over 30 min"*, *"3h 45m since last bedside check"*, *"Serum lactate 2.6 mmol/L"*).
3. **15-Second Optical Spot-Check**: Guided, non-contact optical rPPG scanner using the Plane-Orthogonal-to-Skin (POS) algorithm with an active Signal Quality Index (SQI) to quickly refresh vitals.
4. **Closed-Loop SBAR Escalation**: One-click generation of standardized Situation, Background, Assessment, and Recommendation dossiers for on-call physicians.

---

## 🔒 Privacy & Safety Invariants

- **Volatile RAM Only**: Video frames exist purely in temporary browser canvas buffers for $< 33.3\text{ ms}$ and are destroyed immediately. **No video is ever saved to disk or streamed to a server.**
- **No Hallucinated Vitals**: When optical signal degrades or face is lost, the system outputs `SIGNAL_LOST`. It is strictly forbidden to fabricate synthetic sine waves.
- **No Unverifiable Modalities**: Permanently excised fake webcam SpO2 and uncalibrated cuffless blood pressure.
- **Decision-Support Only**: The system recommends bedside verification; it never autonomously diagnoses disease or prescribes treatment.

---

## ⚡ Quick Start & Monorepo Development

The entire monorepo runs locally with a single documented command:

```bash
# 1. Install all workspace dependencies
npm install

# 2. Launch backend API (:3001) & web app (:5173) concurrently
npm run dev

# 3. Run monorepo test suite (Vitest)
npm run test

# 4. Lint and verify codebase
npm run lint

# 5. Build all packages, services, and web apps
npm run build
```

### 📁 Monorepo Workspace Structure
```
/apps
  /web           → React 19 + TypeScript + Vite + Tailwind CSS shell (:5173)
/services
  /api           → Node.js + Express + TypeScript backend (:3001)
/packages
  /types         → Shared domain contracts (Patient, TrendVector, AttentionAssessment)
  /clinical      → Clinical early warning & Attention Priority scoring
  /signal        → POS rPPG optical processing & SQI gating
  /simulation    → Ward patient deterioration simulation engine
  /config        → Shared TypeScript, ESLint, and Prettier configurations
/research        → Academic papers, statistical validation, and literature review
/tests           → Monorepo integration and health check test suites
/docs            → Complete specification suite & clinical safety boundaries
```

---

## 👥 The Team
- **Thenappan T** — *Systems Architect, Research Lead & Founder*  
  Sathyabama Institute of Science and Technology (SIST), Chennai, India.  
  GitHub: [@CodeSorcerer-007](https://github.com/MasterZ1311/AegisPulse) | Email: `thenappanmasterz1311@gmail.com`
