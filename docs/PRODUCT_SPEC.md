# AegisPulse: Product Specification

**Document Version:** 3.0 (Ground-Up Rebuild)  
**Status:** FROZEN & BINDING FOR HACKATHON BUILD  
**Role:** Principal Engineer & Technical Product Architect  

---

## 1. Finalized Problem Statement

In general hospital wards, **the scarce resource is not patient data, but clinician attention.**

In typical public and high-volume private hospital wards (particularly across resource-constrained healthcare environments), a single nurse is responsible for **25 to 40 patients simultaneously**. Under standard ward protocols, vital signs are collected manually once every 4 to 6 hours.

Between rounds, patients silently deteriorate. However:
- Continuous multi-parameter ICU monitors cannot scale to general wards due to prohibitive capital costs ($3,000–$8,000/bed), alarm fatigue (>85% false alarms), and physical cable constraints.
- Existing software dashboards merely flood clinicians with raw vital values ($HR = 102$) without contextual priority.
- Crucially, human physiology masks acute collapse through compensatory mechanisms; by the time a single static threshold is breached, the patient is often already in irreversible shock or respiratory arrest.

**AegisPulse solves this by reframing the problem entirely:**  
Instead of attempting to turn every bed into an unblinking, noisy ICU telemetry monitor, AegisPulse continuously evaluates available physiological observations, their velocity of change, signal confidence, laboratory context, and the time elapsed since the last trusted manual check to answer the single most urgent operational question in the ward:

> **"Which patient should the nurse pay attention to next, and why?"**

---

## 2. Target Users & Operating Environment

### 2.1 Primary User: General Ward Staff Nurse
- **Context**: Working 8- to 12-hour shifts; responsible for 25–40 patients; constantly mobile between beds, medication carts, and the nurse station.
- **Pain Points**: Sensory exhaustion from beeping monitors; anxiety over missing silent decompensations; spending 30% of shift time typing manual vital charts into EHRs; guessing which bed to visit next.
- **Job to Be Done**: Look at a screen for 3 seconds and know with total confidence which bed requires immediate bedside assessment.

### 2.2 Secondary User: Ward Charge Nurse / Senior Sister
- **Context**: Oversees ward resource allocation, bed throughput, and emergency team dispatches across the entire 40-bed floor.
- **Job to Be Done**: Audit the ward-wide deterioration trajectory, ensure no bed is suffering from severe "information decay" (unobserved for $>4\text{ hours}$), and authorize Rapid Response Team (RRT) escalations.

### 2.3 Tertiary User: On-Call Medical Officer / ICU Registrar
- **Context**: Off-floor, in another emergency, or sleeping in the on-call room at 03:00 AM.
- **Job to Be Done**: Receive a structured, objective, and synthesized situational briefing (SBAR) when a ward patient is deteriorating, enabling an instant, informed clinical decision.

---

## 3. User Workflow: The AegisPulse Loop

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                     THE AEGISPULSE TRIAGE LOOP                                   │
│                                                                                                  │
│   1. AMBIENT RADAR MONITORING (Nursing Station Dashboard / Mobile Tablet)                         │
│      The ward display maintains a continuously sorted priority queue (Beds 1 to N).              │
│      Every bed displays an Attention Priority Score (APS: 0–100) and an explainable reason.      │
│                                              │                                                   │
│                                              ▼                                                   │
│   2. ATTENTION ANOMALY DETECTED                                                                  │
│      Bed 03's APS accelerates to 91 (CRITICAL REVIEW).                                           │
│      Nurse taps Bed 03 $\implies$ inspects the "WHY NOW" explanatory card.                       │
│                                              │                                                   │
│                                              ▼                                                   │
│   3. TARGETED HUMAN ACTION AT BEDSIDE                                                            │
│      Nurse walks directly to Bed 03.                                                             │
│      Options to update/verify vitals:                                                            │
│      a) 15-Second Contactless Optical Spot-Check (holds tablet camera to face for 15s)           │
│      b) Standard manual bedside check (cycles blood pressure cuff, measures temp)                │
│                                              │                                                   │
│                                              ▼                                                   │
│   4. DETERMINISTIC RE-SCORING & INFORMATION REFRESH                                              │
│      Observation uncertainty resets to zero ($D_{\text{time}} = 0$).                             │
│      APS score updates instantaneously.                                                          │
│                                              │                                                   │
│                                              ▼                                                   │
│   5. ESCALATION (If Trajectory Confirmed)                                                        │
│      If MEWS $\ge 5$ or critical trajectory persists:                                            │
│      Nurse clicks: "Generate SBAR Handoff" $\implies$ Sends structured briefing to Registrar.     │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Primary Use Case: The 40-Bed Acute Surgical-Medical Ward

- **Ward Configuration**: 40 beds (mix of 6-bed open bays and stepdown cubicles).
- **Staffing**: 1 Staff Nurse + 1 Nursing Assistant on night duty.
- **Baseline Challenge**: Scheduled nurse vitals rounds take 3 minutes per bed. Completing all 40 beds sequentially takes 120 minutes. The nurse is always working with stale data on 80% of the ward.
- **AegisPulse Intervention**: Continuously aggregates intermittent manual rounds, laboratory results (Lactate, WBC), time decay counters, and optional contactless optical scans into a single prioritized queue, directing the nurse's physical steps to the patient on the steepest downward trajectory.

---

## 5. Explicit Non-Goals (What We Will NOT Build)

To protect technical credibility and clinical safety, the following are strictly out of scope:
1. **No Autonomous Disease Diagnosis**: AegisPulse does not diagnose sepsis, pulmonary embolism, myocardial infarction, or COVID-19. It estimates *physiological deterioration risk*.
2. **No Autonomous Clinical Treatment Orders**: The system will never independently prescribe fluids, antibiotics, or oxygen. It prompts human verification actions.
3. **No Continuous 24/7 Invasive Video Surveillance**: We do not stream or record continuous video of patients in bed. Video sensing is restricted to active, bounded optical spot-checks (e.g., 15 seconds) or ambient privacy-preserving feature extraction.
4. **No Fake Optical Blood Pressure**: We will not attempt uncalibrated cuffless blood pressure from a standard webcam. BP is ingested via rapid nurse input dials or connected digital monitors.
5. **No Fake Ambient $\text{SpO}_2$**: We will not claim pulse oximetry from broadband ambient white light RGB sensors.
6. **No Multi-Bed 6-Patient Ceiling Camera Tracking**: We will not attempt wide-angle multi-patient computer vision tracking in this sprint.

---

## 6. Core Entities & Data Model Contracts

```typescript
// 1. Patient Master Record
export interface Patient {
  id: string;
  name: string;
  age: number;
  gender: 'M' | 'F' | 'Other';
  bedNumber: string;
  admissionDiagnosis: string;
  admissionTimestamp: number;
  baselineMEWS: number;
}

// 2. Verified Physiological Observation
export interface PhysiologicalObservation {
  id: string;
  patientId: string;
  timestamp: number;
  source: 'OPTICAL_RPPG' | 'NURSE_MANUAL' | 'BEDSIDE_DEVICE' | 'SIMULATION';
  confidence: number; // 0.0 to 1.0 (Signal Quality Index)
  heartRate?: number;
  respiratoryRate?: number;
  systolicBP?: number;
  diastolicBP?: number;
  temperature?: number;
  avpu?: 'A' | 'V' | 'P' | 'U';
}

// 3. Laboratory Biomarkers Panel
export interface LabBiomarkerRecord {
  patientId: string;
  timestamp: number;
  lactate?: number;       // mmol/L (Critical > 2.0)
  wbc?: number;           // x10^9/L (Critical < 4.0 or > 12.0)
  creatinine?: number;    // mg/dL
  platelets?: number;     // x10^9/L
}

// 4. Trend & Velocity Vectors
export interface TrendVector {
  patientId: string;
  hrVelocity: number;      // % change per hour (dHR/dt)
  rrVelocity: number;      // % change per hour (dRR/dt)
  shockIndexCurrent: number; // HR / Systolic BP
  shockIndexTrend: 'STABLE' | 'RISING' | 'FALLING';
  mewsDelta: number;       // Change in MEWS over last 2 hours
  trajectoryDirection: 'IMPROVING' | 'STABLE' | 'DECOMPENSATING' | 'RAPID_CRASH';
}

// 5. The Master Attention Assessment (System Core Output)
export interface AttentionAssessment {
  patientId: string;
  bedNumber: string;
  apsScore: number;         // 0 to 100 (Attention Priority Score)
  priorityCategory: 'LOW' | 'WATCH' | 'EVALUATE' | 'CRITICAL_REVIEW';
  wardRank: number;         // 1 to Total Active Patients
  whyReasons: string[];     // Bullet points of exact physiological / operational drivers
  signalConfidence: number; // 0% to 100%
  timeSinceLastObservationMs: number; // Information decay duration
  recommendedAction: string; // Actionable human verification instruction
  sbarAvailable: boolean;
  lastUpdated: number;
}
```

---

## 7. Core Outputs Generated by the System

For every active bed in the ward, AegisPulse computes:
1. **Attention Priority Score ($APS \in [0, 100]$)**: A deterministic composite index reflecting need for nurse presence.
2. **Priority Category**:
   - `LOW (0–29)`: Stable homeostasis; routine ward protocol.
   - `WATCH (30–59)`: Mild upward drift; keep on visual radar.
   - `EVALUATE (60–79)`: Notable velocity or information decay; schedule bedside visit within 30 minutes.
   - `CRITICAL_REVIEW (80–100)`: Acute decompensation signature or severe unobserved state; bedside presence required within 10 minutes.
3. **Ward Rank**: Relative rank among all active ward patients ($1$ being the most urgently needed).
4. **The "WHY NOW" Explainable Breakdown**: 3 to 5 clear, bulleted statements explaining the exact mathematical and physiological drivers (e.g., *"HR +24% over 40m"*, *"No manual check for 3h 45m"*, *"Lactate elevated at 2.6 mmol/L"*).
5. **Signal Confidence Indicator**: Numerical confidence ($0\text{–}100\%$) indicating sensor quality and fidelity.
6. **Information Decay Clock**: Real-time ticker counting elapsed time since last verified observation.
7. **Recommended Human Action**: Concrete clinical next step (e.g., *"Recheck bedside blood pressure and respiratory rate immediately"*).
8. **Optional SBAR Generation**: Dynamic clinical handoff dossier compiled in standardized hospital briefing format with one-click copy.

---

## 8. Success Criteria (Definition of Done for Rebuild)

1. **Deterministic Explainability**: 100% of APS scores must be accompanied by human-readable breakdown sentences. Zero unexplained scores.
2. **Zero Hallucinated Vitals**: Under no condition shall the system fabricate or interpolate normal vital signs during sensor loss or optical occlusion.
3. **Sub-Second Dynamic Sorting**: The 40-bed ward queue must re-sort within $< 200\text{ ms}$ upon receiving new observation or decay updates.
4. **Optical Spot-Check Execution**: A 15-second guided rPPG scan reliably extracts heart rate and respiratory rate on a live seated subject with an active Signal Quality Index.
5. **Noisy Signal Rejection**: When subject movement or lighting drops below threshold, the system displays `SIGNAL_DEGRADED`, freezes unverified outputs, and factors sensor uncertainty into the information decay metric.

---

## 9. Live Demo Scenario (The Hackathon Winning Showcase)

```
[0:00] INTRODUCE THE REALITY
Present the Ward 4B Dashboard: 4 simulated active beds.
Bed 01, Bed 02, Bed 04 are green (APS < 35).
Bed 03 (Post-Op Laparoscopic Cholecystectomy) starts at APS 42 (WATCH).

[0:30] INJECT PHYSIOLOGICAL VELOCITY (The Stealth Deterioration)
Trigger micro-decompensation trajectory for Bed 03:
- Heart rate increases from 74 to 98 BPM (Still "normal" on a threshold monitor!).
- Respiratory rate drifts from 16 to 22 breaths/min.
- Information decay clock crosses 3 hours 30 minutes without a nurse visit.
- Serum lactate reported from lab at 2.4 mmol/L.

[1:00] THE RADAR SURFACES THE THREAT
Watch the Ward Queue dynamically re-sort in real time:
Bed 03 accelerates to Rank #1 with an APS of 91 (CRITICAL REVIEW).
Click Bed 03 to reveal the "WHY NOW" card:
Judges read the 4 bullet points explaining the velocity spike and observation decay.

[1:30] THE 15-SECOND BEDSIDE SPOT-CHECK DEMO
"Now, the nurse arrives at Bed 03. How does she close the loop?"
Open the 15-Second Optical Spot-Check scanner.
Direct webcam at the presenter or judge.
Watch the 15-second circular progress ring, live green arterial pulse trace, and real-time SQI (94%).
At 15 seconds: Heart Rate (76 BPM) and Respiratory Rate (16 /min) lock in.

[2:00] DISPATCH THE SBAR HANDOFF
Click "Generate SBAR Handoff Brief":
Display the complete, professional clinical dossier ready for instant EHR dispatch.
Close with: "Not more beeping monitors. Just better clinician attention."
```
