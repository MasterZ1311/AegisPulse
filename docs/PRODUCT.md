# AegisPulse: Product Specification & Strategy

**Document Status:** AUTHORITATIVE PRODUCT SPECIFICATION  
**Governing Standard:** `docs/SOURCE_OF_TRUTH.md`

---

## 1. Problem Statement

### 1.1 The Clinical Reality of General Hospital Wards

In modern acute hospitals, the most lethal blindspot is not inside intensive care units, but in general medical and surgical wards. In public hospitals across India and developing economies, nurse-to-patient staffing ratios commonly reach **1:30 to 1:50** during night shifts.

A single staff nurse managing 40 patients has at most **90 seconds of attention per patient per hour**. Under standard hospital operating procedures, complete sets of vital signs are collected manually only once every **4 to 6 hours**. During the intervening 4-hour windows—which represent over **80% of a patient's hospital stay**—patients deteriorate with zero continuous surveillance.

### 1.2 The Failure of Prior Paradigms

1. **The Capital Barrier**: Commercial continuous ICU telemetry monitors (e.g., Philips IntelliVue, GE Carescape) cost between ₹2.5 Lakhs and ₹6 Lakhs ($3,000 to $8,000) per bed. Outfitting a 500-bed public hospital demands crores in capital expenditure that health systems simply do not have.
2. **The Alarm Fatigue Crisis**: Traditional telemetry monitors generate up to 350 alarms per bed per day, of which **85% to 99% are clinically non-actionable false alarms**. In crowded wards, adding 40 beeping monitors creates deafening acoustic chaos, causing nurses to suffer alarm fatigue and mute speakers.
3. **The "Isolated Normal" Fallacy**: Human physiology is compensatory. A patient developing occult internal hemorrhage or early septic shock maintains "normal" vital signs (e.g., Heart Rate 92 BPM, Systolic BP 110 mmHg) until compensatory mechanisms exhaust, triggering a sudden, catastrophic cardiovascular collapse. Static threshold alarms sound nothing until after the physiological cliff has been breached.

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                               THE COMPENSATORY DETERIORATION CLIFF                                │
│                                                                                                  │
│  Patient Status    08:00 AM             10:00 AM             11:30 AM             01:00 PM       │
│  ─────────────────────────────────────────────────────────────────────────────────────────────   │
│  Heart Rate        74 BPM               88 BPM               98 BPM               140 BPM        │
│                    (Normal)             (+18% Velocity)      (+32% Velocity)      (Cardiovascular│
│                                                                                    Collapse!)    │
│  Traditional       [NO ALARM]           [NO ALARM]           [NO ALARM]           [CODE BLUE!]   │
│  Threshold         (Threshold: >100)    (Threshold: >100)    (Threshold: >100)    (TOO LATE)     │
│  Monitor:          "Patient Green"      "Patient Green"      "Patient Green"      Mortality >80% │
│                                                                                                  │
│  AegisPulse        APS: 18 (LOW)        APS: 64 (HIGH)       APS: 88 (CRITICAL)   [PREVENTED]    │
│  Attention Radar:                       ▲ Velocity Warning   ▲ Urgent SBAR Sent   Patient Saved  │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Product Thesis & Core Value Proposition

### 2.1 The Core Thesis

> **The scarce operational resource in general hospital wards is not patient data. It is clinician attention.**

AegisPulse does not attempt to turn every general ward bed into an expensive, noisy ICU monitor. Instead, it acts as an **intelligent deterioration radar** that continuously evaluates available observations, physiological velocity, information freshness, and clinical rules to answer:

> **"Which patient needs the nurse's attention next, and why?"**

### 2.2 Core Value Proposition

- **Prioritized Attention Queue**: Replaces dozens of disconnected acoustic alarms with a single, dynamically ranked attention queue.
- **Velocity-Aware Detection**: Catches occult decompensation hours before static thresholds are breached by tracking rate-of-change ($\Delta \text{HR}/\Delta t$, $\Delta \text{RR}/\Delta t$, Shock Index velocity).
- **Active Uncertainty Quantification**: Explicitly tracks **Information Decay ($D_{\text{time}}$)**, ensuring that unvisited beds naturally rise in priority rather than being forgotten.
- **Explainable "Why Now?" Summaries**: Eliminates black-box distrust by providing clear mathematical and clinical rationales for every score.
- **Closed-Loop Action Workflows**: Generates standardized SBAR (Situation, Background, Assessment, Recommendation) briefs and logs nurse bedside interventions.

---

## 3. Target Users & Operating Environment

### 3.1 Primary Personas

1. **Ward Staff Nurse**: Primary user managing 20–40 patients. Needs a glanceable dashboard at the nursing station or on a mobile tablet to determine who to visit next during rounds.
2. **Charge Nurse / Ward Sister**: Oversees ward-wide acuity, manages nurse assignments, and escalates deteriorating beds to physicians.
3. **Medical Emergency Team (MET) / Rapid Response Team (RRT)**: Receives standardized SBAR briefs when a patient breaches critical priority thresholds, enabling rapid bedside triage.
4. **Ward Medical Officer (Junior Doctor)**: Reviews longitudinal trends, lab biomarkers, and deterministic MEWS breakdowns before ordering interventions.

### 3.2 Operating Environment

- High-density general medical, surgical, and post-operative wards.
- Edge tablets mounted at the central nurse station or carried on medication carts.
- Variable Wi-Fi connectivity with offline fallback support.

---

## 4. User Workflow: Closed-Loop Attention Allocation

```
   ┌────────────────────────────────────────────────────────┐
   │ 1. GLANCE AT WARD RADAR                                │
   │    Nurse views central dashboard; sees 6–40 beds       │
   │    sorted by Attention Priority Score (Rank 1 to N).   │
   └───────────────────────────┬────────────────────────────┘
                               │
                               ▼
   ┌────────────────────────────────────────────────────────┐
   │ 2. INSPECT HIGHEST-PRIORITY BED                        │
   │    Nurse clicks top card (e.g. Bed 403, APS: 88).      │
   │    Reads "Why Now?" explanation: narrowing pulse       │
   │    pressure (+32% HR velocity, SI = 1.31).             │
   └───────────────────────────┬────────────────────────────┘
                               │
                               ▼
   ┌────────────────────────────────────────────────────────┐
   │ 3. BEDSIDE PHYSICAL VISIT                              │
   │    Nurse walks to Bed 403. Conducts physical assessment│
   │    (capillary refill, pallor, auscultation).           │
   └───────────────────────────┬────────────────────────────┘
                               │
                               ▼
   ┌────────────────────────────────────────────────────────┐
   │ 4. HUMAN-IN-THE-LOOP VERIFICATION & ACTION             │
   │    Nurse verifies condition, administers prescribed    │
   │    IV fluid bolus, and clicks "Complete Action".       │
   └───────────────────────────┬────────────────────────────┘
                               │
                               ▼
   ┌────────────────────────────────────────────────────────┐
   │ 5. SBAR ESCALATION (IF CRITICAL)                       │
   │    If patient remains unstable, nurse taps "Generate   │
   │    SBAR" to send structured handover to on-call MET.   │
   └───────────────────────────┬────────────────────────────┘
                               │
                               ▼
   ┌────────────────────────────────────────────────────────┐
   │ 6. RADAR RE-CALCULATION & QUEUE RE-SORT                │
   │    Updated vitals logged; Information freshness resets;│
   │    Bed 403 APS drops to 26; next patient moves up.     │
   └────────────────────────────────────────────────────────┘
```

---

## 5. Core Product Concepts

### 5.1 The Attention Priority Score (APS)

The APS is a composite, deterministic metric normalized from **0 to 100**. It synthesizes four clinical vectors:

1. **Physiological Velocity ($V_{\text{physio}}$)**: Multi-parameter rate of change over time windows (15–60 mins).
2. **Information Decay ($D_{\text{time}}$)**: Quadratic penalty for unobserved beds as observational entropy grows.
3. **Clinical Baseline ($S_{\text{mews}}$)**: Validated Subbe Modified Early Warning Score (0–14).
4. **Biochemical Stress Markers ($L_{\text{biomarker}}$)**: Critical laboratory chemistry (serum lactate, leukocytosis).

### 5.2 The Priority Queue & Triage Bands

Patients are categorized into four standardized urgency bands:

| Urgency Band        | Score Range | Clinical Interpretation                                  | Prescribed Nurse Action                                    |
| :------------------ | :---------- | :------------------------------------------------------- | :--------------------------------------------------------- |
| **LOW**             | 0 – 29      | Stable physiology; routine observation                   | Maintain standard 4-hour ward rounds.                      |
| **MODERATE**        | 30 – 59     | Early trend shift or decaying observation                | Reassess within 60 minutes during routine checks.          |
| **HIGH**            | 60 – 79     | Significant trajectory velocity or elevated MEWS         | Bedside assessment within 20 minutes; review vitals.       |
| **CRITICAL_REVIEW** | 80 – 100    | Acute decompensation or severe physiological instability | Immediate bedside response; notify charge nurse/physician. |

### 5.3 The "Why Now?" Explainability Drawer

Clinicians reject black-box scores. When a bed escalates, the UI provides an auditable breakdown showing:

- Primary driver (e.g., _"Heart Rate accelerated by +28 BPM over 45 minutes"_).
- Contributing weight percentage of each vector.
- Raw trigger value vs. baseline threshold.
- Time since last verified measurement.

### 5.4 15-Second Guided Optical Spot-Check

When acquiring contactless vitals, AegisPulse deploys a bounded, 15-second guided rPPG spot-check:

- Forehead reticle with real-time face tracking.
- Dynamic Signal Quality Index (SQI) bar.
- If quality is poor (motion, lighting < 30 lux), the check pauses and alerts the user rather than fabricating vitals.
- Output: Instantaneous Heart Rate (BPM) and Respiratory Rate (breaths/min).
- **Privacy Assurance**: Frame buffer is discarded in volatile RAM after each 33 ms frame.

---

## 6. Intended Use & Boundaries

### 6.1 Intended Use

- Intended for adult inpatient populations ($\ge 18$ years) in general hospital medical and surgical wards.
- Intended as secondary clinical decision support to assist registered nurses and physicians in allocating bedside attention.
- Intended for tracking physiological trends between formal nursing rounds.

### 6.2 Non-Intended Use (Strict Prohibitions)

- **NOT a primary diagnostic medical device**. Does not diagnose sepsis, cardiac arrest, myocardial infarction, or pulmonary embolism.
- **NOT an intensive care continuous telemetry replacement**. Does not replace multi-lead diagnostic ECG monitors.
- **NOT validated for pediatric or obstetric populations** (requires PEWS / MEOWS protocols).
- **NOT an autonomous prescribing or treatment delivery system**. Does not order drugs or alter therapy.

---

## 7. Feature Status Matrix

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   FEATURE STATUS BREAKDOWN                                       │
├──────────────────────────────────────┬───────────────────────────────────────────────────────────┤
│ CURRENT FEATURES (IMPLEMENTED)       │ • Deterministic APS Engine (0–100)                        │
│                                      │ • Validated Subbe MEWS (0–14) & Singer qSOFA (0–3)        │
│                                      │ • Information Decay Modeling (D_time)                     │
│                                      │ • Contactless Optical rPPG (POS/CHROM) with SQI Gating    │
│                                      │ • 6-Bed Deterioration & Recovery Ward Simulation          │
│                                      │ • Real-Time Attention Queue & Glanceable Ward Radar       │
│                                      │ • Explainable "Why Now?" Clinical Reasoning Drawer        │
│                                      │ • Automated SBAR Clinical Handoff Dossier                 │
│                                      │ • Offline-First Sync with Monotonic UUID Queuing          │
│                                      │ • 10 Red-Team Hardened Security Vectors                   │
├──────────────────────────────────────┼───────────────────────────────────────────────────────────┤
│ DEFERRED FEATURES                    │ • Multi-bed simultaneous camera tracking (single camera   │
│                                      │   tracking 6 beds abandoned due to optical distortion)    │
│                                      │ • Deep learning 3D-CNN rPPG (deferred due to edge latency)│
├──────────────────────────────────────┼───────────────────────────────────────────────────────────┤
│ PROHIBITED / EXCISED CLAIMS          │ • Webcam Contactless SpO2 (physically invalid under       │
│                                      │   ambient RGB light)                                      │
│                                      │ • Webcam Cuffless Blood Pressure (clinically unproven     │
│                                      │   from facial video alone)                                │
│                                      │ • Autonomous Sepsis Diagnosis (violates clinical safety)  │
│                                      │ • Unverified N=48 Clinical Trial Claims ($r=0.962$)       │
├──────────────────────────────────────┼───────────────────────────────────────────────────────────┤
│ FUTURE POSSIBILITIES (RESEARCH)      │ • Multi-center prospective clinical validation            │
│                                      │ • HL7 FHIR EHR bidirectional interoperability             │
│                                      │ • WebGPU / WebAssembly SIMD optical acceleration          │
│                                      │ • CDSCO Class B / FDA 510(k) SaMD regulatory clearance   │
└──────────────────────────────────────┴───────────────────────────────────────────────────────────┘
```
