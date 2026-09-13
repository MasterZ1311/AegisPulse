# AegisPulse: AI Agent Master Knowledge Base, System Architecture & Innovation Blueprint

> **AGENT DIRECTIVE & EXECUTIVE OVERRIDE CLEARANCE:**  
> This document is specifically structured for an external, third-party, or successor AI agent (Autonomous Coding Agent, Systems Architect, or Clinical AI Subagent). It establishes total contextual grounding, code invariants, cognitive problem models, completed implementation milestones, outstanding gaps, and a prioritized innovation backlog (P0 to P4). An incoming AI agent ingesting this document possesses full architectural authority to interpret, debug, refactor, and expand the AegisPulse codebase.

---

## 1. System Metadata & Agent Operational Manifest

```yaml
system_name: "AegisPulse"
core_identity: "Patient Deterioration Radar & Nurse Attention Allocation Engine"
primary_question: "Which patient should the nurse pay attention to next, and why?"
primary_repository_path: "e:/My Development/AegisPulse"
target_environment: "Edge Browser Runtime (Chrome/Edge/Safari) + Node.js/SQLite Local Ward Server"
clinical_standards:
  - "Modified Early Warning Score (MEWS, Subbe et al., 2001)"
  - "Sepsis-3 quick Sequential Organ Failure Assessment (qSOFA, Seymour et al., 2016)"
  - "SBAR (Situation, Background, Assessment, Recommendation) Clinical Handoff Protocol"
regulatory_classification: "CDSCO Class B Software as a Medical Device (SaMD) / Clinical Decision Support System (CDSS)"
privacy_invariants:
  - "Zero persistent video storage (volatile RAM processing only, < 33.3ms frame lifetime)"
  - "Zero cloud video streaming (only ~120-byte numerical JSON telemetry transmitted)"
  - "Strict HIPAA Security Rule (45 CFR § 164) & India DPDP Act 2023 conformance"
primary_stack:
  frontend: "React 19, TypeScript 5.x, Tailwind CSS v4, Lucide React, HTML5 2D Canvas (60 FPS)"
  backend: "Node.js v20+, Express.js, TypeScript, SQLite relational database"
  signal_processing: "Plane-Orthogonal-to-Skin (POS) rPPG, 4th-Order Butterworth Filter, Dynamic Peak Zero-Crossing"
```

---

## 2. The Grand Problem & Cognitive Grounding

### 2.1 The Crisis of Clinician Attention
In general hospital wards across the globe, the fundamental bottleneck has been misunderstood:
- **It is not a lack of patient data. It is the acute scarcity of clinician attention.**
- In Indian government medical colleges and high-volume public hospitals, night-shift nurse-to-patient ratios routinely reach **1:30 to 1:50** (vs. WHO mandate 1:3).
- A nurse caring for 40 patients has exactly **90 seconds of attention per patient per hour**.
- Manual vitals rounds occur every 4 to 6 hours. During the intervening multi-hour "dead zones," patients silently deteriorate.

### 2.2 Why Traditional Solutions Failed
1. **Wired ICU Telemetry**: Cost-prohibitive ($3,000–$8,000/bed); creates massive alarm fatigue (>85% false alarms); physical cables cause skin tears and pressure ulcers.
2. **Continuous 24/7 Webcam Surveillance**: Fails completely in dark wards at night ($< 30\text{ lux}$); blanket occlusions trigger constant false alarms; provokes severe patient dignity and privacy resistance.
3. **The "Isolated Normal" Fallacy**: A patient compensating for acute internal bleeding or early septic shock can maintain a "normal" heart rate (e.g., 95 BPM) until cardiovascular collapse. Static threshold monitors remain silent while the patient crashes.

### 2.3 How AegisPulse Solves This
AegisPulse continuously evaluates four multi-modal vectors into an explainable **Attention Priority Score ($APS \in [0, 100]$)**:
1. **Physiological Velocity**: Measures rate-of-change ($\Delta \text{HR}/\Delta t$, $\Delta \text{RR}/\Delta t$, Shock Index trend), catching compensatory spikes before the cliff.
2. **Information Decay**: Mathematically formalizes clinical uncertainty: $(t_{\text{elapsed}} / 4\text{h})^2 \times (1 - \text{SQI})$. The longer a bed sits unvisited, the higher its priority climbs.
3. **Clinical MEWS Baseline**: Normalized Modified Early Warning Score matrix.
4. **Biomarker Evidence**: Flags acute cellular hypoxia from lab panels (Serum Lactate $> 2.0\text{ mmol/L}$, WBC).
5. **15-Second Optical Spot-Check**: Packages optical rPPG into a bounded, guided 15-second bedside check with an active Signal Quality Index (SQI) to quickly verify vitals without cables.

---

## 3. Completed Journey: What Has Been Built & Is Fully Operational

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                CURRENT IMPLEMENTATION MAP                                        │
├─────────────────────────────────────┬───────────────────────────────────┬────────────────────────┤
│ MODULE / COMPONENT                  │ SOURCE FILE                       │ OPERATIONAL STATUS     │
├─────────────────────────────────────┼───────────────────────────────────┼────────────────────────┤
│ 1. Core POS rPPG Engine             │ src/lib/rppgEngine.ts             │ ✅ Complete & Calibrated│
│ 2. MEWS & qSOFA Inference Engine    │ src/lib/mewsCalculator.ts         │ ✅ Complete & Verified │
│ 3. Type Definitions & Interfaces    │ src/lib/types.ts                  │ ✅ Complete (Strict)   │
│ 4. REST API Client Layer            │ src/lib/api.ts                    │ ✅ Complete & Resilient│
│ 5. 60 FPS Canvas Oscilloscope       │ src/components/WaveformOscilloscope.tsx │ ✅ Hardware-Accel│
│ 6. Optical Scanner & Forehead ROI   │ src/components/WebcamBiometricScanner.tsx │ ✅ Complete   │
│ 7. Triage Warning Banner Matrix     │ src/components/TriageStatusBanner.tsx │ ✅ High-Contrast UI│
│ 8. Full Ward Overview Management    │ src/components/WardOverviewTab.tsx │ ✅ Bed Switching   │
│ 9. Hematology Lab Ingestion Tab     │ src/components/LabDiagnosticsTab.tsx │ ✅ Multi-Modal     │
│ 10. AI Clinical Copilot & SBAR      │ src/components/CopilotTab.tsx     │ ✅ SBAR Automated  │
│ 11. Modal SBAR Clinical Briefing    │ src/components/AIClinicalCopilot.tsx │ ✅ One-Click Copy │
│ 12. Patient Admission Engine        │ src/components/AdmitPatientModal.tsx │ ✅ Bed Allocation │
│ 13. Hospital Ward Settings & Limits │ src/components/SettingsTab.tsx    │ ✅ Configurable    │
│ 14. Express & SQLite Edge Backend   │ server/src/index.ts & db.ts       │ ✅ REST Endpoints  │
│ 15. Architectural Specifications    │ docs/ & PROJECT_CONSTITUTION.md   │ ✅ All Specs Frozen│
└─────────────────────────────────────┴───────────────────────────────────┴────────────────────────┘
```

---

## 4. What is Yet to Be Completed (Technical Gaps & Backlog)

An incoming AI agent must prioritize the following implementation steps for the ground-up rebuild:

1. **`src/lib/attentionCalculator.ts` Implementation**:
   - Write the pure deterministic Attention Priority Score ($APS$) calculator.
   - Implement the Information Decay formula: $D_{\text{time}} = \min(100, (t_{\text{elapsed}}/4\text{h})^2 \times 60 \times (1 - \text{SQI}))$.
   - Implement the Physiological Velocity calculator: $\Delta \text{HR}/\Delta t$, $\Delta \text{RR}/\Delta t$, Shock Index trend.
   - Implement the deterministic `generateWhyReasons()` clinical explanation builder.
2. **`AttentionRadarQueue.tsx` Component**:
   - Replace static patient cards with a real-time dynamically sorted priority list (Rank #1 at top).
   - Display real-time Information Decay clocks (e.g., *"Last Check: 3h 42m ago"*).
   - Display velocity indicators (e.g., *"HR ▲ +22%"*).
3. **`ExplainableWhyDrawer.tsx` Component**:
   - Slide-over drawer displaying the 4–5 plain-English bullet points explaining why a bed is elevated.
   - Actionable checklist with one-click SBAR handoff generator.
4. **Hardened 15-Second Optical Spot-Check Modal**:
   - Add circular 15-second SVG countdown ring.
   - Add real-time Signal Quality Index (SQI) confidence meter.
   - Pause countdown if subject moves or SQI $< 50\%$.

---

## 5. Staged Sprint Roadmap: Ranked Priorities P0 to P2

All speculative, non-essential distractions (such as continuous thermal FLIR, acoustic stethoscopes, or optical cuffless blood pressure) have been permanently deleted from the scope. The roadmap is strictly focused on executing the core Attention Radar deliverables:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                               CORE SPRINT BACKLOG: P0 TO P2                                      │
├────┬─────────────────────────────────────────────────┬─────────────────┬─────────────────────────┤
│ TIER│ FEATURE TITLE                                   │ COMPLEXITY      │ CLINICAL / PRODUCT VALUE│
├────┼─────────────────────────────────────────────────┼─────────────────┼─────────────────────────┤
│ P0 │ Deterministic APS Formula & Dynamic Queue UI    │ Low (1 Day)     │ Core product foundation │
│    │ (Sorts beds #1 to #N by Attention Priority)     │                 │ (Milestones M1 & M2).   │
│ P0 │ Dynamic Signal Quality Index (SQI) Gating       │ Low (1 Day)     │ Rejects motion rigors;  │
│    │ (Transitions TRUSTED -> DEGRADED -> UNRELIABLE) │                 │ prevents false alarms.  │
│ P0 │ 15-Second Guided Spot-Check with Countdown Ring │ Low (1 Day)     │ Solves 24/7 dark room   │
│    │ (Bounded optical check in volatile RAM)         │                 │ and privacy dilemmas.   │
├────┼─────────────────────────────────────────────────┼─────────────────┼─────────────────────────┤
│ P1 │ Derivative-First Shock Index Velocity Tracker   │ Medium (1 Day)  │ Detects compensatory    │
│    │ (HR / Systolic BP acceleration)                 │                 │ shock before cliff.     │
│ P1 │ Explainable "WHY NOW" Clinical Reasoning Drawer │ Low (1 Day)     │ Replaces black boxes    │
│    │ (Auditable bullet points for nurse action)      │                 │ with actionable reasons.│
│ P1 │ Automated SBAR Clinical Handoff Exporter        │ Low (1 Day)     │ 1-click standardized    │
│    │ (Instant report generation for MD escalations)  │                 │ physician communication.│
├────┼─────────────────────────────────────────────────┼─────────────────┼─────────────────────────┤
│ P2 │ Fast-Forward Time-Compression Demo Simulator    │ Low (1 Day)     │ Compresses 4 hours of   │
│    │ (Simulates Bed 3 sepsis & Bed 8 decay)          │                 │ decay into 30s on stage!│
│ P2 │ Synthesized Ward Alert Audio (IEC 60601 Tone)   │ Low (0.5 Day)   │ Auditory priority cue   │
│    │ (Subtle chime for CRITICAL_REVIEW state)        │                 │ without alarm fatigue.  │
└────┴─────────────────────────────────────────────────┴─────────────────┴─────────────────────────┘
```

---

## 6. Architecture Invariants (DO NOT VIOLATE)

1. **Never Stream or Persist Video**:
   - `video` and `canvas` elements must process frames purely in memory. Do not add `fs.writeFileSync()` of image buffers or WebSocket video transmission. Only 120-byte numerical telemetry payloads may be saved or transmitted.
2. **Never Fabricate Physiological Measurements**:
   - If sensor signal degrades or face is lost, output `SIGNAL_LOST`. It is strictly forbidden to interpolate a synthetic 72 BPM sine wave to make the UI look good.
3. **No Unverifiable Modalities**:
   - Do not add fake webcam SpO2 or uncalibrated cuffless blood pressure.
4. **Deterministic Scoring Over Black-Box AI**:
   - The APS formula, MEWS calculator, and Information Decay functions must remain deterministic mathematical functions.

---

## 7. Key File Navigation Map

- **Product Specification**: [docs/PRODUCT_SPEC.md](file:///e:/My%20Development/AegisPulse/docs/PRODUCT_SPEC.md)
- **Architecture Principles**: [docs/ARCHITECTURE_PRINCIPLES.md](file:///e:/My%20Development/AegisPulse/docs/ARCHITECTURE_PRINCIPLES.md)
- **Clinical Safety Boundaries**: [docs/SAFETY_BOUNDARIES.md](file:///e:/My%20Development/AegisPulse/docs/SAFETY_BOUNDARIES.md)
- **Architecture Decision Records (ADRs)**: [docs/DECISIONS.md](file:///e:/My%20Development/AegisPulse/docs/DECISIONS.md)
- **Staged Roadmap**: [docs/MILESTONES.md](file:///e:/My%20Development/AegisPulse/docs/MILESTONES.md)
- **Project Constitution**: [PROJECT_CONSTITUTION.md](file:///e:/My%20Development/AegisPulse/PROJECT_CONSTITUTION.md)
- **Frontend Entry**: [src/App.tsx](file:///e:/My%20Development/AegisPulse/src/App.tsx)
- **rPPG Engine**: [src/lib/rppgEngine.ts](file:///e:/My%20Development/AegisPulse/src/lib/rppgEngine.ts)
- **Clinical Math**: [src/lib/mewsCalculator.ts](file:///e:/My%20Development/AegisPulse/src/lib/mewsCalculator.ts)
- **Data Types**: [src/lib/types.ts](file:///e:/My%20Development/AegisPulse/src/lib/types.ts)
- **Backend Entry**: [server/src/index.ts](file:///e:/My%20Development/AegisPulse/server/src/index.ts)
- **Database Schema**: [server/src/db.ts](file:///e:/My%20Development/AegisPulse/server/src/db.ts)

---

## 8. Summary for the Incoming AI Agent

AegisPulse is **not** a webcam replacement for ICU monitors. It is an **intelligent deterioration radar and nurse attention allocation engine**. 

Your mission is to maintain its zero-trust privacy guarantees, execute the staged milestones (M0 through M5), build the deterministic Attention Priority Score ($APS$) formula, and deliver an unshakeable, explainable clinical demonstration on stage.
