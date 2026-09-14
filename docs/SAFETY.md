# AegisPulse: Clinical Safety Framework & Non-Claims Policy

**Document Status:** AUTHORITATIVE CLINICAL SAFETY SPECIFICATION  
**Governing Standard:** `docs/SOURCE_OF_TRUTH.md`  
**Regulatory Context:** IEC 62304 Medical Device Software Life Cycle, ISO 14971 Application of Risk Management to Medical Devices

---

## 1. Regulatory Status & Safety Disclaimer

> [!WARNING]
> **INVESTIGATIONAL RESEARCH PROTOTYPE — NOT CLEARED FOR CLINICAL DIAGNOSTIC USE**  
> AegisPulse is an engineering and academic research prototype. It has **NOT** been evaluated, certified, or cleared by the Central Drugs Standard Control Organisation (CDSCO), the US Food and Drug Administration (FDA), or European Notified Bodies as Software as a Medical Device (SaMD). It is not for use in primary diagnostic decision-making, emergency life support, or autonomous patient treatment.

---

## 2. Intended Use vs. Non-Intended Use

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   INTENDED USE BOUNDARIES                                        │
├───────────────────────────────────┬──────────────────────────────────────────────────────────────┤
│ ✅ INTENDED USE (IN-SCOPE)         │ ❌ STRICTLY PROHIBITED (OUT-OF-SCOPE)                        │
├───────────────────────────────────┼──────────────────────────────────────────────────────────────┤
│ • Secondary decision support for  │ • Primary diagnosis of disease (sepsis, heart attack, shock) │
│   registered nurses on wards.     │ • Autonomous administration of medications or IV fluids      │
│ • Prioritizing nurse attention    │ • Intensive care continuous telemetry replacement            │
│   and rounding queues.            │ • Triage in pediatric (< 18 yrs) or obstetric populations    │
│ • Tracking rate-of-change         │ • Deriving Blood Pressure or SpO2 from webcam video          │
│   (velocity) between rounds.      │ • Making independent clinical escalation decisions           │
└───────────────────────────────────┴──────────────────────────────────────────────────────────────┘
```

---

## 3. Epistemic Uncertainty & Fail-Safe Architecture

Medical software must adhere to an absolute safety invariant: **An explicit failure to measure is clinically safe; a fabricated normal measurement is lethal.**

### 3.1 The Anti-Placebo Invariant (Fail-Obvious)

- If a patient covers their face, room lighting drops below 30 lux, or the camera is detached, the optical pipeline must **immediately output `POOR_SIGNAL` or `SIGNAL_LOST`**.
- It is strictly forbidden to interpolate or generate synthetic "normal" vital signs (e.g. 72 BPM) to make the UI look stable.
- A missing observation generates an explicit **Confidence Penalty**, which increases epistemic uncertainty and causes the bed to rise in nurse attention priority.

### 3.2 Explicit Missing Data Accounting

- In standard MEWS calculators, unmeasured vitals are often silently assumed to be 0 points ("normal"). AegisPulse rejects this.
- If a vital is unmeasured, it is logged in `missingValues`, and both `totalScore` and `maxPossibleScore` are displayed alongside an explicit **Uncertainty Factor**.

---

## 4. Mitigation of Clinical Failure Modes

### 4.1 False Positives (Alarm Fatigue Mitigation)

- **Problem**: Traditional monitors sound alarms on single transient spikes (e.g. patient coughs $\implies \text{HR jumps to }110\text{ BPM}$).
- **Mitigation**: AegisPulse incorporates a **Temporal Persistence Filter**. Velocity vectors must persist across consecutive observation windows before triggering a high-priority escalation. Transient spikes are dampened via Exponential Moving Averages.

### 4.2 False Negatives (Compensatory Shock Detection)

- **Problem**: Compensating patients maintain "normal" vital signs while stroke volume drops and shock progresses.
- **Mitigation**: AegisPulse evaluates multi-parameter velocity ($\Delta \text{HR}/\Delta t$, $\Delta \text{RR}/\Delta t$) and Shock Index ($\text{SI} = \text{HR}/\text{SBP}$). A rising heart rate coupled with narrowing pulse pressure triggers an attention warning before blood pressure crashes.

### 4.3 Stale Data ("The Forgotten Bed")

- **Problem**: A patient checked 4 hours ago appears "stable" on old paperwork while actively deteriorating.
- **Mitigation**: The **Information Decay Engine ($D_{\text{time}}$)** automatically penalizes beds with aging data. The bed's priority score rises steadily, compelling the nurse to reassess the patient.

---

## 5. Non-Autonomous Human Oversight

AegisPulse strictly enforces **Human-in-the-Loop Clinical Governance**:

1. **Advisory Recommendations Only**: AegisPulse suggests clinical actions (e.g. _"Perform Bedside Check"_, _"Review SBP"_, _"Generate SBAR"_). It cannot execute them.
2. **Mandatory Clinician Verification**: A registered nurse or physician must physically visit the bedside, evaluate the patient's clinical state, and explicitly log or acknowledge actions.
3. **Non-Latching Alarms**: High-priority alarms cannot be cleared by automated timers. They require explicit authenticated clinician acknowledgement.

---

## 6. Prohibited Clinical Claims Summary

When presenting, deploying, or discussing AegisPulse:

- **NEVER SAY**: _"AegisPulse diagnoses sepsis."_
  - _Say instead_: _"AegisPulse evaluates standard qSOFA screening heuristics to identify patients at elevated risk of deterioration."_
- **NEVER SAY**: _"AegisPulse measures Blood Pressure from a webcam."_
  - _Say instead_: _"AegisPulse measures optical Heart Rate; Blood Pressure is entered manually or pulled from validated bedside cuffs."_
- **NEVER SAY**: _"AegisPulse replaces hospital nurses or ICU monitors."_
  - _Say instead_: _"AegisPulse provides an attention allocation radar to support ward nurses in managing large patient loads."_
