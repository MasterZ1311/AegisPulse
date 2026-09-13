# AegisPulse: Problem Statement & Solution Architecture

**Positioning:** Patient Deterioration Radar & Nurse Attention Allocation Engine  
**Document Version:** 3.0  
**Status:** BINDING ARCHITECTURAL SPECIFICATION  
**Target Audience:** Chief Medical Officers, Hospital Administrators, Clinical Engineers, Hackathon Judges  

---

## 1. Executive Summary: The Crisis of Clinician Attention

In modern healthcare systems, the most dangerous clinical blindspot is not inside intensive care units, but in general medical-surgical hospital wards. However, the root problem has been fundamentally misunderstood by prior medical technology developers:

> **The scarce resource in general hospital wards is not patient data. It is clinician attention.**

In typical public and high-volume private hospitals across India and developing nations, a single staff nurse is responsible for **30 to 40 patients simultaneously during an 8- to 12-hour shift**.

Under standard ward protocols, nurses measure vital signs manually once every 4 to 6 hours. During the intervening multi-hour intervals—amounting to over **80% of a patient's hospital stay**—patients silently deteriorate.

Attempts to solve this by installing continuous wired telemetry monitors on every bed have failed universally:
1. **The Capital Barrier**: At ₹2.5 to ₹6 Lakhs ($3,000–$8,000) per bed, monitoring a 500-bed hospital costs crores that public facilities do not possess.
2. **The Alarm Fatigue Crisis**: Traditional monitors generate up to 350 alarms per bed per day, of which **85% to 99% are clinically non-actionable false alarms**. Nurses desensitize to the noise and mute the alarms.
3. **The "Isolated Normal" Trap**: Single-point threshold alarms miss compensatory physiology. A patient with internal bleeding or progressing septic shock can maintain a "normal" heart rate of 95 BPM until they suddenly crash. Traditional monitors sound no alarm until after the physiological cliff has been breached.

**AegisPulse fundamentally reframes the paradigm:**  
Instead of attempting to turn every general ward bed into an expensive, beeping intensive care monitor, AegisPulse acts as an **intelligent deterioration radar**. It continuously evaluates physiological velocity, information decay, clinical baseline, and laboratory evidence to answer one urgent question:

> **"Which patient should the nurse pay attention to next, and why?"**

---

## 2. Granular Anatomy of the Clinical Problem

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
│  AegisPulse        APS: 18 (LOW)        APS: 64 (EVALUATE)   APS: 91 (CRITICAL)   [PREVENTED]    │
│  Attention Radar:                       ▲ Velocity Warning   ▲ Urgent SBAR Sent   Patient Saved  │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.1 The "Isolated Normal" Fallacy
A patient with occult sepsis or internal hemorrhage initiates powerful autonomic compensatory mechanisms:
- Endogenous epinephrine and norepinephrine release causes peripheral vasoconstriction and sinus tachycardia.
- Because stroke volume drops, the heart beats faster to maintain Cardiac Output ($\text{CO} = \text{HR} \times \text{SV}$).
- **The Failure**: On an isolated spot-check, a Heart Rate of 96 BPM and Blood Pressure of 110/70 mmHg are technically within "normal limits." However, when viewed as a time-series derivative ($\Delta \text{HR}/\Delta t = +24\text{ BPM in 45 mins}$), the patient is in acute compensatory distress.

### 2.2 Information Decay & The "Forgotten Bed"
In a 40-bed ward, sequential nurse rounding takes 2 hours. If Bed 12 was checked at 08:00 AM and found stable, our certainty regarding Bed 12's clinical status decays exponentially over time:
- By 11:30 AM (3.5 hours later), Bed 12 has entered a high-entropy state.
- If Bed 12's rPPG optical signal is occluded by blankets or movement, that sensor uncertainty must **increase** the priority of visiting that bed, not silently ignore it.

### 2.3 Nurse Rationing of Time
A single nurse with 40 patients has exactly **90 seconds of attention per patient per hour**. When every patient looks stable on paper, nurses are forced to ration attention based on whoever rings the call bell or whoever appears restless. AegisPulse converts this subjective guessing into an objective, dynamic clinical priority queue.

---

## 3. The AegisPulse Solution Architecture

AegisPulse is an edge-native clinical intelligence engine built on four multi-modal pillars:

```
                                  AEGISPULSE ATTENTION RADAR
                                  
  ┌───────────────────────┐    ┌───────────────────────┐    ┌───────────────────────┐
  │ 1. PHYSIOLOGICAL      │    │ 2. INFORMATION DECAY  │    │ 3. CLINICAL BASELINE  │
  │    VELOCITY (V_physio)│    │    ENGINE (D_time)    │    │    & LAB BIOMARKERS   │
  │ • dHR/dt (%/hr)       │    │ • Time since nurse    │    │ • Modified Early      │
  │ • dRR/dt (%/hr)       │    │   bedside visit       │    │   Warning Score (MEWS)│
  │ • Shock Index trend   │    │ • Optical Sensor      │    │ • Serum Lactate       │
  │   (HR / Systolic BP)  │    │   Quality Index (SQI) │    │ • WBC / Infection     │
  └───────────┬───────────┘    └───────────┬───────────┘    └───────────┬───────────┘
              │                            │                            │
              └────────────────────────────┼────────────────────────────┘
                                           │
                                           ▼
                       ┌───────────────────────────────────────┐
                       │   DETERMINISTIC ATTENTION FORMULA     │
                       │   APS = min(100, w1*V + w2*D + w3*M)  │
                       └───────────────────┬───────────────────┘
                                           │
                                           ▼
                       ┌───────────────────────────────────────┐
                       │   DYNAMIC WARD ATTENTION QUEUE        │
                       │   Beds 1..N Ranked in Real Time       │
                       │   #1  BED 03  [APS: 91]  CRITICAL     │
                       │   #2  BED 14  [APS: 74]  EVALUATE     │
                       │   #3  BED 09  [APS: 48]  WATCH        │
                       │   #4  BED 01  [APS: 15]  LOW          │
                       └───────────────────┬───────────────────┘
                                           │ Tap Bed 03
                                           ▼
                       ┌───────────────────────────────────────┐
                       │       EXPLAINABLE "WHY NOW" CARD      │
                       │  ▲ HR accelerated +18% over 35 min    │
                       │  ▲ RR tachypnea spike: 16 → 24 /min   │
                       │  ⏱ 3h 42m since last manual visit     │
                       │  🧪 Serum Lactate: 2.4 mmol/L         │
                       │                                       │
                       │  RECOMMENDED CLINICAL ACTION:         │
                       │  Perform 15s Optical Bedside Check    │
                       │  [ONE-CLICK: AUTO-GENERATE SBAR]      │
                       └───────────────────────────────────────┘
```

---

## 4. The Attention Priority Score (APS) Mathematical Model

The Attention Priority Score ($APS \in [0, 100]$) is computed deterministically for every active bed:

$$APS = \min\left(100, \, w_v \cdot V_{\text{physio}} + w_d \cdot D_{\text{time}} + w_m \cdot S_{\text{mews}} + w_l \cdot L_{\text{biomarker}}\right)$$

### 4.1 Component 1: Physiological Velocity ($V_{\text{physio}}$)
Evaluates the rate of change and directional acceleration of hemodynamics:
$$V_{\text{physio}} = \alpha \left(\frac{\Delta \text{HR}}{\Delta t}\right) + \beta \left(\frac{\Delta \text{RR}}{\Delta t}\right) + \gamma \left(\Delta \text{Shock Index}\right)$$
Where Shock Index is defined as $\text{SI} = \frac{\text{Heart Rate}}{\text{Systolic BP}}$ (Critical if $\text{SI} > 0.9$).

### 4.2 Component 2: Information Decay ($D_{\text{time}}$)
Quantifies clinical uncertainty as time elapses without verified bedside observation:
$$D_{\text{time}} = \min\left(40, \, \left(\frac{t_{\text{current}} - t_{\text{last\_verified}}}{\tau_{\text{ward\_protocol}}}\right)^2 \times 25 \times (1 - \text{SQI})\right)$$
Where:
- $\tau_{\text{ward\_protocol}} = 4\text{ hours}$ (Standard general ward rounding window).
- $\text{SQI} \in [0.0, 1.0]$: Real-time Signal Quality Index from the optical sensor. If the sensor is occluded or degraded, uncertainty penalty climbs faster.

### 4.3 Component 3: Clinical Baseline ($S_{\text{mews}}$)
Normalized Modified Early Warning Score ($0\text{ to }14$):
$$S_{\text{mews}} = \frac{\text{MEWS Score}}{14} \times 35$$

### 4.4 Component 4: Biochemical Stress ($L_{\text{biomarker}}$)
Evaluates cellular hypoxia and systemic inflammation from ingested laboratory panels:
- Serum Lactate $> 2.0\text{ mmol/L} \implies +15\text{ points}$.
- White Blood Cell count $< 4.0\text{ or } > 12.0 \times 10^9/\text{L} \implies +10\text{ points}$.

---

## 5. The 15-Second Optical Spot-Check Paradigm

AegisPulse rejects the flawed assumption that cameras must stare at patients 24/7. Instead, optical rPPG is packaged into an active **15-Second Guided Spot-Check**:

```
[Nurse Approaches Bed] ──► [Points Tablet at Patient] ──► [15s Optical Scan]
                                                                  │
                                                                  ▼
[Forehead ROI Target] ──► [POS Chrominance Extraction] ──► [Live 60 FPS Oscilloscope]
                                                                  │
                                                                  ▼
[Signal Quality Check: SQI ≥ 75%?] ── YES ──► [Instant Lock: HR 76 BPM, RR 16 /min]
                                              [Information Decay Resets: D_time = 0]
```

- **Guaranteed Lighting & Posture**: Occurs while the nurse is present, lights are on, and the patient is seated or resting still.
- **Zero Surveillance Friction**: Camera is active for exactly 15 seconds, then shuts down.
- **Volatile RAM Invariant**: Video frames exist purely in memory buffers for $< 33.3\text{ ms}$ and are destroyed immediately. Zero video frames leave the device.

---

## 6. Closing the Loop: Automated SBAR Escalation

When a bed crosses into the `CRITICAL_REVIEW` tier ($APS \ge 80$), AegisPulse auto-compiles a standardized **SBAR handoff dossier**:
- **Situation (S)**: Patient name, bed number, current APS score (e.g., 91/100), and immediate warning triggers.
- **Background (B)**: Admission diagnosis, post-operative day, and co-morbidities.
- **Assessment (A)**: Synthesis of physiological velocity (HR $+18\%$, RR $+22\%$), information decay (3h 42m unobserved), and elevated serum lactate.
- **Recommendation (R)**: Bedside blood pressure cycling, stat arterial blood gas, and Rapid Response Team (RRT) consult.

---

## 7. Comparison: Traditional Telemetry vs. AegisPulse Radar

| Operational Dimension | Traditional ICU Telemetry | Generic Health Dashboard | AegisPulse Deterioration Radar |
| :--- | :--- | :--- | :--- |
| **Core Paradigm** | Continuous wired threshold beeps | "Here is your heart rate on a chart" | **"Which patient needs you next, and why?"** |
| **Nurse Cognitive Load** | Extreme alarm fatigue (>85% false) | High (requires reading dozens of numbers)| **Zero fatigue (single prioritized queue)** |
| **Handling of Stale Data** | Completely ignores observation age | Blind to unmeasured time | **Actively penalizes Information Decay** |
| **Optical Bio-Sensing Role**| None (Uses physical leads/wires) | Attempts 24/7 invasive surveillance | **15-Second guided bedside spot-check** |
| **Explainability** | Single number alarm (e.g., "HR > 100") | Black-box AI percentage score | **4–5 explicit physiological bullet points** |
| **Hardware Capital Cost** | ₹2.5L – ₹6L per bed | Unrealistic $0 (assumes tablets exist)| **Utilizes existing ward screens / nurse tablets** |
