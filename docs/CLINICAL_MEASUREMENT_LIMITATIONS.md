# AegisPulse: Clinical Measurement Limitations & Investigational Boundaries

**Document Status:** CLINICAL SAFETY NOTICE & BOUNDARY DEFINITION  
**Governing Standard:** `docs/SOURCE_OF_TRUTH.md`  
**Target Audience:** Clinical Operators, Hospital Administrators, System Integrators

---

## 1. Investigational Regulatory Status

AegisPulse's contactless optical photoplethysmography (rPPG) feature is an **investigational decision-support technology**. 

- **Primary Clinical Purpose:** AegisPulse is an **Attention Allocation Engine & Patient Deterioration Radar**. It helps nurses answer: *"Which patient needs attention next, and why?"*
- **Regulatory Clarification:** The camera rPPG feature is **not** a certified Class II/IIa diagnostic medical device. It is intended for trend monitoring and screening prioritization in general hospital wards under human-in-the-loop nursing supervision.
- **Diagnostic Boundary:** Contactless optical measurements must **never** be used as the sole basis for prescribing medication, altering oxygen therapy, or withholding resuscitation without bedside contact validation (e.g. standard multi-parameter monitor, manual blood pressure cuff, or contact pulse oximeter).

---

## 2. Physiological & Optical Limitations

### 2.1 Subject Movement & Rigorous Rest Requirement
- Capillary pulsation creates surface skin color changes of only **0.1% to 1.0%** total reflected intensity.
- Head movements, talking, coughing, or chewing introduce motion artifacts whose magnitude dwarfs the microvascular cardiac pulse.
- When motion is detected, AegisPulse immediately withholds measurements (`MOTION_CONTAMINATED`) rather than outputting false numbers.

### 2.2 Ambient Illumination Limits
- Optical sensing relies on ambient visible light penetrating the epidermal layer.
- **Minimum Viable Illumination:** $\ge 35\text{ Lux}$ (dim room with reading lamp).
- In pitch darkness ($< 20\text{ Lux}$), standard RGB cameras cannot resolve skin chrominance. AegisPulse gates the output with `INSUFFICIENT_LIGHT`.

### 2.3 Severe Facial Occlusion & Dressings
- The primary rPPG extraction region is the forehead.
- If the patient has extensive forehead bandages, surgical dressings, thick bangs, or oxygen masks occluding the upper face, skin fraction drops below 35% and the system gates with `ROI_INVALID`.

### 2.4 SpO2 (Blood Oxygen Saturation) Boundary
- **Hard Clinical Invariant:** Blood oxygen saturation ($\text{SpO}_2$) **cannot** be measured accurately using standard ambient RGB cameras.
- Pulse oximetry requires dual-wavelength calibrated red ($660\text{ nm}$) and infrared ($940\text{ nm}$) narrow-band light sources to differentiate oxyhemoglobin from deoxyhemoglobin.
- AegisPulse strictly forbids emitting or displaying camera-derived $\text{SpO}_2$. Any displayed $\text{SpO}_2$ must originate from bedside contact monitors or nurse manual entry.

### 2.5 Cardiac Arrhythmias & Non-Sinus Rhythms
- The rPPG pipeline identifies the dominant cardiac pulse frequency via spectral Fourier analysis (FFT Power Spectral Density) over a sliding 8-second window.
- In patients with atrial fibrillation, frequent premature ventricular contractions (PVCs), or severe dysrhythmias, spectral peaks may become broad or multimodal. The system computes a lower Signal Quality Index (SQI) and flags `LOW_CONFIDENCE`.

---

## 3. The Bedside Verification Protocol

Whenever AegisPulse indicates a rising Attention Priority Score (APS) driven by optical vital signs, the bedside nurse must follow the **Verification Protocol**:

1. **Observe Bedside State**: Check patient mentation, respiratory effort, and skin perfusion visually.
2. **Verify Signal Freshness**: Confirm whether the vital sign in the panel is marked `CURRENT` or `LAST TRUSTED • Xm ago`.
3. **Contact Validation**: If optical confidence is degraded or the patient appears symptomatic, take a manual pulse and apply a contact oximeter probe.
4. **Log Assessment**: Use the AegisPulse "Log Assessment" action button to document bedside observations and confirm or dismiss the radar alert.
