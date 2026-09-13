# AegisPulse: Clinical Safety Boundaries & Claims Policy

**Document Version:** 1.0  
**Role:** Clinical Safety Officer & Regulatory Architect  
**Status:** MANDATORY CLINICAL INVARIANT POLICY  

---

## 1. Allowed vs. Forbidden Clinical Claims

AegisPulse operates strictly within bounded clinical and regulatory limits. To ensure medical safety and avoid regulatory violations (CDSCO SaMD / FDA Class II/III), all marketing, UI copy, and presentations must adhere to this claims boundary matrix:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 THE CLINICAL CLAIMS MATRIX                                       │
├──────────────────────────────────────────────────────────────────┬───────────────────────────────┤
│ ✅ STRICTLY ALLOWED CLAIMS                                        │ ❌ STRICTLY FORBIDDEN CLAIMS   │
├──────────────────────────────────────────────────────────────────┼───────────────────────────────┤
│ "AegisPulse estimates physiological deterioration risk           │ "AegisPulse diagnoses sepsis, │
│ trajectories to assist in clinical attention allocation."        │ shock, or disease states."    │
├──────────────────────────────────────────────────────────────────┼───────────────────────────────┤
│ "AegisPulse calculates validated clinical early warning scores   │ "AegisPulse replaces physician│
│ (MEWS / qSOFA) based on entered and measured parameters."        │ assessment or nurse rounds."  │
├──────────────────────────────────────────────────────────────────┼───────────────────────────────┤
│ "AegisPulse extracts non-contact optical heart rate and          │ "AegisPulse continuously      │
│ respiratory rhythm on stationary subjects in ambient light."     │ measures blood pressure and   │
│                                                                  │ SpO2 through a webcam."       │
├──────────────────────────────────────────────────────────────────┼───────────────────────────────┤
│ "AegisPulse highlights accelerating vital sign velocity trends   │ "AegisPulse predicts cardiac  │
│ that may precede acute clinical decompensation."                 │ arrest with 100% certainty."  │
├──────────────────────────────────────────────────────────────────┼───────────────────────────────┤
│ "AegisPulse tracks information decay (time elapsed since last    │ "AegisPulse is an autonomous  │
│ verified bedside observation) to prioritize ward visits."        │ ICU telemetry replacement."   │
├──────────────────────────────────────────────────────────────────┼───────────────────────────────┤
│ "AegisPulse formats real-time patient observations into standard │ "AegisPulse prescribes drug   │
│ SBAR clinical handoff briefs for medical review."                │ dosages or fluid boluses."    │
└──────────────────────────────────────────────────────────────────┴───────────────────────────────┘
```

---

## 2. Forbidden Clinical Claims in Detail

1. **The "Sepsis Diagnosis" Prohibition**:
   - Sepsis is defined clinically (Sepsis-3) as life-threatening organ dysfunction caused by a dysregulated host response to infection. It requires microbiological blood cultures, physical examination, clinical suspicion of infection, and laboratory organ failure scoring (SOFA).
   - **Prohibition**: AegisPulse must never claim to "diagnose sepsis." It may only claim: *"Screens for physiological deterioration risk consistent with sepsis screening guidelines (qSOFA)."*
2. **The "Cuffless Blood Pressure" Prohibition**:
   - Measuring arterial blood pressure non-invasively requires calibrated arterial applanation tonometry, volume-clamp methods, or calibrated pneumatic cuffs. Estimating blood pressure from an uncalibrated facial webcam under varying room lighting is clinical malpractice.
   - **Prohibition**: The software must never output a synthetic or estimated blood pressure reading derived purely from facial video. Blood pressure must be entered manually by clinical staff or pulled from a verified digital sphygmomanometer.
3. **The "Webcam $\text{SpO}_2$" Prohibition**:
   - Photoplethysmographic oxygen saturation calculation requires the ratio of red ($660\text{ nm}$) to infrared ($940\text{ nm}$) light absorption to resolve differential oxyhemoglobin vs. deoxyhemoglobin molar extinction. Broadband white light with standard RGB Bayer filters cannot resolve this ratio accurately.
   - **Prohibition**: The software must not display a webcam-derived $\text{SpO}_2$ percentage.
4. **The "Autonomous Treatment Order" Prohibition**:
   - The system must never independently authorize medications, initiate IV fluid boluses, or modify ventilator settings. It may only recommend human clinical verification.

---

## 3. Uncertainty Behavior & Fail-Safe Protocols

Medical software must be designed with an unyielding principle: **An explicit failure to measure is safe; a fabricated measurement is lethal.**

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   UNCERTAINTY DECISION PROTOCOL                                  │
│                                                                                                  │
│   Is Face Visible & Stable? ─────── NO ──────► Display "SIGNAL_LOST" (No Fake Data)             │
│                 │                                     │                                          │
│                YES                                    ▼                                          │
│                 │                             Increase Information Decay Counter                 │
│                 ▼                                     │                                          │
│   Is Signal Quality (SQI) ≥ 75%? ── NO ──────► Display "SIGNAL_DEGRADED"                         │
│                 │                             Apply Uncertainty Penalty to Priority Score        │
│                YES                                    │                                          │
│                 │                                     ▼                                          │
│                 ▼                             Prompt: "Recheck Bedside Manually"                 │
│   Update Live Vitals & Reset Decay Counter                                                       │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.1 Strict Failure Modes
1. **Low Light Condition ($< 150\text{ lux}$)**:
   - When ambient photon density drops below the noise floor of the webcam sensor, thermal shot noise overwhelms the pulsatile signal.
   - **System Behavior**: The engine halts rPPG calculation, renders an amber indicator (*"Low Ambient Light — Optical Signal Paused"*), and increases the Information Decay metric for that bed.
2. **Patient Motion Artifact (Rigors, Coughing, Turning)**:
   - Dynamic motion shifts the forehead ROI and creates macroscopic luminance spikes orders of magnitude larger than capillary blood pulses.
   - **System Behavior**: The Signal Quality Index drops below $50\%$. The waveform display renders a gray interference band, and numerical vitals are frozen with a status tag: *"Subject Moving — Stabilizing..."*.
3. **Face Occlusion (Blanket Over Face, Patient Left Bed)**:
   - **System Behavior**: Face detection fails for $> 5$ consecutive seconds. The system immediately marks the bed as `UNOBSERVED`. **It is strictly forbidden to interpolate or hold the previous heart rate.** The bed's priority score begins climbing due to Information Decay.

---

## 4. Human-in-the-Loop (HITL) Requirements

AegisPulse is classified as a **Clinical Decision Support System (CDSS)** under international medical device regulatory standards (IMDRF SaMD Framework & CDSCO Medical Device Rules 2017).

1. **All High-Priority Alarms Require Human Acknowledgment**:
   - An Attention Priority Score in the `CRITICAL_REVIEW` tier ($APS \ge 80$) triggers a visual banner on the ward dashboard.
   - This state cannot auto-dismiss. It remains active until a nurse physically clicks or taps **"Acknowledge & Triage"** with a logged staff identifier.
2. **Clinical Handoff Authorization**:
   - While AegisPulse automatically compiles the text of the SBAR briefing, the dispatch of this dossier to an on-call physician or EHR requires explicit nurse confirmation.
3. **Mandatory Investigational Header**:
   - Every view of the user interface must display the non-dismissible legal disclaimer:  
     *`INVESTIGATIONAL CLINICAL SENTINEL — FOR DECISION-SUPPORT ONLY — NOT FOR DIAGNOSTIC USE`*.
