# AegisPulse: Authoritative Source of Truth

**Document Status:** BINDING ARCHITECTURAL SPECIFICATION  
**Classification:** Primary Source of Truth  
**Supersedes:** All previous draft specifications, collateral, and marketing documents  
**Governing Standard:** AegisPulse Project Constitution

---

## 1. Authoritative Product Definition

**AegisPulse** is an edge-native **Patient Deterioration Radar & Nurse Attention Allocation Engine**.

### 1.1 The Core Problem

In general hospital wards, the scarce operational resource is **clinician attention**, not telemetry data. A single nurse often oversees 30 to 50 patients during an 8-to-12 hour shift. Vital signs are manually collected once every 4 to 6 hours, creating dangerous multi-hour monitoring blindspots. Traditional continuous monitors fail because they generate overwhelming alarm fatigue (>85% false alarms) and evaluate only static thresholds, missing subtle compensatory physiological velocity.

### 1.2 The Core Solution

AegisPulse continuously evaluates available bedside observations, physiological velocity, information freshness, signal confidence, clinical baseline, and validated clinical rules to answer one central question:

> **"Which patient needs the nurse's attention next, and why?"**

### 1.3 Core Output: Attention Priority Score (APS)

- **Scale**: Normalized integer/float from **0 to 100**.
- **Meaning**: Relative clinical urgency for bedside nurse reassessment.
- **Urgency Bands**:
  - **LOW (0–29)**: Stable baseline; routine rounding.
  - **MODERATE (30–59)**: Intermediate concern; scheduled observation check.
  - **HIGH (60–79)**: Significant trajectory velocity or information decay; prompt bedside review.
  - **CRITICAL_REVIEW (80–100)**: Acute decompensation trajectory or severe vital abnormality; immediate human clinical assessment.
- **Product Differentiator**: Instead of sounding uncoordinated acoustic threshold alarms that nurses desensitize to, AegisPulse maintains a dynamically ranked, explainable attention queue.

### 1.4 What AegisPulse IS NOT

- AegisPulse is **NOT a diagnostic system** (it does not diagnose sepsis, cardiac arrest, or disease states).
- AegisPulse is **NOT an autonomous treatment prescriber** (it does not order medications, titrate vasopressors, or adjust fluids).
- AegisPulse is **NOT an ICU monitor replacement** (it is a deterioration safety net for unmonitored general wards).
- AegisPulse is **NOT primarily a webcam vital-sign replacement** (contactless sensing is one optional input modality among manual entry, connected sensors, and synthetic simulation).

---

## 2. Core Architecture: The 5-Layer Pipeline

```
[1. Sensory Ingestion]
  (Contactless rPPG Camera / Connected Sensors / Manual Nurse Entry / Simulation Hub)
         │
         ▼
[2. Digital Signal Processing & Quality Engine]
  (Plane-Orthogonal-to-Skin [POS], CHROM, Bandpass Filtering, Signal Quality Index [SQI])
         │
         ▼
[3. Clinical Rules & Acuity Core]
  (Subbe MEWS [0–14], Singer qSOFA [0–3], Shock Index, Biochemical Stress Markers)
         │
         ▼
[4. Trajectory & Attention Allocation Engine]
  (Physiological Velocity, Information Decay [D_time], Persistence Filter, APS Math)
         │
         ▼
[5. Explainability & Action Workflow]
  (Transparent Contributing Reasons, Human SBAR Briefings, Nurse Action Ledger)
```

---

## 3. Non-Negotiable Privacy Invariants

Any code deployed in AegisPulse must strictly obey the four privacy invariants:

1. **INVARIANT P1: Ephemeral Frame Lifecycle (Zero Disk Storage)**  
   Video frames obtained via `getUserMedia()` exist exclusively in volatile client memory (`HTMLCanvasElement` or typed arrays). Under no circumstances shall raw images or video frames be written to disk, `localStorage`, `IndexedDB`, or transmitted across network boundaries.
2. **INVARIANT P2: Telemetry-Only Data Transmission**  
   Only extracted numerical vectors (`{ heartRate: 74, signalQuality: 92, timestamp: 1726278000 }`) may cross process, HTTP, or WebSocket boundaries.
3. **INVARIANT P3: Explicit Optical Ingestion Indicator & Hardware Kill Switch**  
   The UI must prominently display an active optical indicator when the camera is polling pixels, and provide an instant one-click software toggle to terminate all media tracks immediately.
4. **INVARIANT P4: Zero Biometric Identification**  
   AegisPulse extracts physiological color modulation from capillary beds, not facial recognition geometries. No facial recognition embeddings, biometric templates, or identity vectors are generated or stored.

---

## 4. Non-Negotiable Clinical Safety Invariants

1. **INVARIANT S1: Fail-Obvious, Never Hallucinate (The Anti-Placebo Rule)**  
   If face tracking is lost, ambient lighting drops below threshold (< 30 lux), or the patient moves violently, the engine must immediately output `SIGNAL_LOST` or `POOR_SIGNAL`. The engine is strictly forbidden from interpolating synthetic normal numbers (e.g., 72 BPM) to keep the UI looking calm.
2. **INVARIANT S2: Prominent Investigational Disclaimer**  
   Every screen of the UI and exported report must include the non-dismissible banner:  
   _`INVESTIGATIONAL PROTOTYPE — NOT FOR CLINICAL DIAGNOSTIC DECISION-MAKING`_.
3. **INVARIANT S3: Explicit Origin Tagging for All Vitals Vectors**  
   Every physiological measurement displayed or processed must carry an explicit origin tag:
   - `SOURCE: OPTICAL_RPPG`
   - `SOURCE: CLINICIAN_MANUAL_ENTRY`
   - `SOURCE: WEARABLE_SENSOR`
   - `SOURCE: SIMULATED_DATASET`  
     The system must never present a manual entry or simulation vector as an autonomous camera measurement.
4. **INVARIANT S4: Non-Latching, Verified Alarm States**  
   Critical alerts and escalations require explicit human nurse acknowledgement with timestamped audit logging. Alarms must never silently auto-dismiss after a timer expires.

---

## 5. Current Implementation Status

| Capability                               | Current Status               | Implementation Location                                          |
| :--------------------------------------- | :--------------------------- | :--------------------------------------------------------------- |
| **Attention Priority Score (APS)**       | IMPLEMENTED & VERIFIED       | `packages/clinical/src/attentionPriority/`                       |
| **Deterministic MEWS (0–14)**            | IMPLEMENTED & VERIFIED       | `packages/clinical/src/mews/`                                    |
| **Deterministic qSOFA (0–3)**            | IMPLEMENTED & VERIFIED       | `packages/clinical/src/qsofa/`                                   |
| **Information Decay Math**               | IMPLEMENTED & VERIFIED       | `packages/clinical/src/attentionPriority/components/decay.ts`    |
| **Physiological Velocity**               | IMPLEMENTED & VERIFIED       | `packages/clinical/src/attentionPriority/components/velocity.ts` |
| **SBAR Handoff Generation**              | IMPLEMENTED & VERIFIED       | `packages/clinical/src/sbar/`                                    |
| **Copilot Guardrails**                   | IMPLEMENTED & VERIFIED       | `packages/clinical/src/copilot/guardrails.ts`                    |
| **POS & CHROM rPPG Pipelines**           | IMPLEMENTED & VERIFIED       | `research/rppg/src/algorithms/`                                  |
| **Signal Quality Index (SQI)**           | IMPLEMENTED & VERIFIED       | `packages/signal/src/`, `research/rppg/`                         |
| **6-Bed Ward Simulator**                 | IMPLEMENTED & VERIFIED       | `packages/simulation/src/engine/ward-simulator.ts`               |
| **Offline-First Sync Engine**            | IMPLEMENTED & VERIFIED       | `apps/web/src/services/offline-sync-queue.ts`                    |
| **REST & Streaming API**                 | IMPLEMENTED & VERIFIED       | `services/api/src/`                                              |
| **Red Team Hardening (10 Vectors)**      | IMPLEMENTED & VERIFIED       | `services/api/tests/red-team-security.test.ts`                   |
| **Synthetic Dataset Benchmarks**         | MEASURED & VERIFIED          | `research/benchmarks/run-scientific-evaluation.ts`               |
| **Physical Multi-Center Clinical Trial** | NOT YET VALIDATED / FUTURE   | Planned for Level 4 SaMD clinical pathway                        |
| **Webcam SpO2 Estimation**               | NOT IMPLEMENTED / PROHIBITED | Physically invalid on ambient RGB sensors                        |
| **Webcam Cuffless Blood Pressure**       | NOT IMPLEMENTED / PROHIBITED | Clinically unvalidated on facial video                           |
| **Autonomous Diagnostic Orders**         | NOT IMPLEMENTED / PROHIBITED | Violates clinical safety invariants                              |

---

## 6. Standardized Terminology

All documentation, code comments, and presentation materials must strictly adhere to these canonical terms:

- **AegisPulse**: The official project name (capitalized as AegisPulse; never Aegis-Pulse or Aegis Pulse).
- **Attention Priority Score (APS)**: The normalized composite index (0–100) indicating patient urgency.
- **Attention Priority**: The triage classification category (`LOW`, `MODERATE`, `HIGH`, `CRITICAL_REVIEW`).
- **Signal Quality / Signal Quality Index (SQI)**: Real-time metric of optical or sensor reliability.
- **Information Freshness / Information Decay**: Quantitative decay of observational certainty over time ($D_{\text{time}}$).
- **Patient Deterioration Radar**: The core macro-concept of proactive, trajectory-aware ward surveillance.
- **Nurse Attention Allocation Engine**: The functional micro-concept describing the algorithmic scoring and queue management.

---

## 7. Documentation Hierarchy

In the event of any ambiguity or discrepancy between documents, the following strict hierarchy of authority governs:

```
1. docs/SOURCE_OF_TRUTH.md            (Supreme Architectural Authority)
      │
      ▼
2. docs/PRODUCT.md & ARCHITECTURE.md  (Product & System Specifications)
      │
      ▼
3. docs/CLINICAL_LOGIC.md             (Mathematical & Clinical Formulations)
   docs/SECURITY.md & PRIVACY.md      (Security & Privacy Invariants)
   docs/SAFETY.md                     (Safety Limits & Non-Claims)
      │
      ▼
4. docs/API.md & DATA_MODEL.md        (Interface & Entity Contracts)
      │
      ▼
5. All other documentation files      (Testing, Research, Deployment, Demo, Roadmap)
```
