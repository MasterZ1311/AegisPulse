# AEGISPULSE: PROJECT CONSTITUTION & ARCHITECTURAL GROUND TRUTH

**Document Classification:** Internal Technical & Clinical Foundation  
**Role:** Founding CTO, Clinical Product Strategist, Systems Architect & Research Lead  
**Date:** September 2026  
**Status:** BINDING ARCHITECTURAL SPECIFICATION — SUPERSEDES ALL PREVIOUS DRAFT COLLATERAL  

---

## Preamble: The Reset

We are rebuilding AegisPulse from the ground up. 

Previous project collateral accumulated an untenable volume of aspirational marketing copy, unverified benchmark claims, and dangerous clinical conflations. Marketing documents claimed a student hackathon web app achieved a clinical Pearson correlation of $r = 0.962$ and an MAE of $2.14\text{ BPM}$ across 48 patients of Fitzpatrick skin types I–VI. In reality, inspecting `src/lib/rppgEngine.ts` reveals a basic canvas pixel loop that reverts to a hardcoded sinusoidal oscillator (`systolic + dicrotic + noise`) whenever face detection wobbles or simulation mode is toggled.

Previous documentation claimed "autonomous MEWS calculation" and "early sepsis diagnosis," while the underlying engine hardcoded Systolic BP ($118\text{ mmHg}$), Temperature ($36.8^\circ\text{C}$), and AVPU ($A$), leaving the webcam to measure only Heart Rate. 

**This intellectual dishonesty stops now.** 

If we pitch fiction to clinical judges, medical researchers, or hospital administrators, we will be disassembled in seconds. Worse, if software pretending to be a medical sentinel is deployed in a clinical environment, patients will die.

This Constitution defines our foundational truth: what we solve, what the science actually supports, what is feasible in a hackathon, what is lethal to claim, and the non-negotiable invariants governing the rebuilt codebase.

---

## 1. What AegisPulse Currently Claims to Solve

The prior collateral claims AegisPulse solves the **"4-to-6-hour general hospital ward monitoring blindspot"** by:
1. Transforming any commodity RGB webcam on a laptop, tablet, or phone into a continuous, clinical-grade vital signs monitor with **zero dedicated hardware**.
2. Measuring instantaneous **Heart Rate (HR)**, **Heart Rate Variability (HRV / RMSSD)**, and **Respiratory Rate (RR)** through contactless optical Remote Photoplethysmography (rPPG).
3. Measuring or estimating **Oxygen Saturation ($\text{SpO}_2$)** and **Blood Pressure (BP)** non-invasively.
4. Synthesizing contactless vitals with blood panels (Lactate, WBC, Creatinine) to **diagnose sepsis early** via automated qSOFA and MEWS scoring.
5. Slashing the capital cost of continuous telemetry by **99%** (from ₹3.5 Lakhs to ₹3,600 over 3 years), enabling instant scaling across 1 million hospital beds in India.
6. Eliminating in-hospital cardiac arrests and saving up to 1.2 million lives annually.

---

## 2. What Evidence Actually Supports Those Claims

We must distinguish between **general scientific literature** and **our own codebase's verified capabilities**.

### Supported by Established Scientific Literature:
- **Optical rPPG Physics**: Ambient green light ($500\text{–}560\text{ nm}$) is modulated by volumetric pulsatile arterial blood changes in superficial facial capillaries (Verkruysse et al., 2008).
- **The POS Algorithm**: The Plane-Orthogonal-to-Skin (POS) projection framework mathematically eliminates specular reflection under controlled illumination and stationary subjects (Wang et al., *IEEE TBME*, 2017).
- **Epidemiology of In-Hospital Deterioration**: In-hospital cardiac arrests and septic shock crashes frequently exhibit abnormal vital sign markers (tachypnea, tachycardia) 6 to 8 hours prior to overt collapse (Sandroni et al., 2020; Seymour et al., *JAMA*, 2016).
- **Clinical Risk Scores**: The Modified Early Warning Score (MEWS, Subbe et al., 2001) is a validated clinical tool for risk stratification when all 5 vital parameters are accurately measured.

### Supported by Our Active Codebase:
- **Canvas Chrominance Averaging**: We can crop an off-screen HTML5 canvas to a forehead region and extract mean Red, Green, and Blue pixel values at 30 FPS.
- **Normalized Chrominance Projection**: We have implemented the arithmetic POS projection equations ($P_x = 3R_n - 2G_n$, $P_y = 1.5R_n + G_n - 1.5B_n$, $S = P_x - P_y$).
- **Deterministic MEWS Calculation**: If provided valid numerical inputs, our pure mathematical calculator (`src/lib/mewsCalculator.ts`) correctly maps inputs to clinical tier scores (0–2 Green, 3–4 Yellow, $\ge 5$ Red).
- **Reactive UI**: We can render a 60 FPS oscilloscope trace and display color-coded status badges on a dark medical UI.

### What is COMPLETELY UNSUPPORTED by Our Evidence:
- **The "N=48 Clinical Trial" ($r=0.962$, MAE $2.14\text{ BPM}$)**: There is zero dataset, zero raw sensor log, zero IRB ethics approval, and zero time-synchronized ground-truth ECG data in this repository. This was an unvalidated benchmark figure imported from external literature.
- **Contactless $\text{SpO}_2$**: We have no calibrated dual-wavelength optical model. Ambient RGB sensors cannot reliably measure oxygen saturation.
- **Cuffless Blood Pressure**: We have zero pulse wave velocity hardware, zero calibration curves, and zero hydrostatic estimators.
- **Sepsis Diagnosis**: Our system does not diagnose sepsis; it evaluates a rule-based checklist (qSOFA) based largely on simulated or manual entries.

---

## 3. Which Claims are Assumptions and Must Be Validated

| Claim / Assumption | Why It is an Unvalidated Assumption | How to Validate (or Invalidate) It |
| :--- | :--- | :--- |
| **"POS rPPG works reliably across Fitzpatrick V–VI skin tones on cheap webcams"** | Epidermal melanin absorbs green photons aggressively, dramatically attenuating pulsatile AC signal amplitude and degrading SNR. | Benchmark against open datasets (e.g., MMPD, UBFC-Phys) with diverse skin phototypes under varying lux. |
| **"Webcam rPPG can measure clinically actionable HRV (RMSSD)"** | RMSSD relies on sub-millisecond precision between R-peaks. A 30 FPS video feed has a frame duration of $33.3\text{ ms}$, introducing massive quantization jitter into IBI calculations. | Must prove that parabolic interpolation or zero-crossing sub-frame timing can resolve peak intervals $< 5\text{ ms}$. |
| **"Respiratory Rate can be derived from facial RSA in critical ward patients"** | Respiratory Sinus Arrhythmia (RSA) vanishes in elderly, diabetic, tachycardic, and critically septic patients whose autonomic tone is saturated. | Validate breathing rate against chest wall motion or nasal cannula pressure transducers, not just facial RSA. |
| **"Hospitals will allow active cameras pointed at patient beds 24/7"** | Patients, families, and nursing unions have legitimate, intense surveillance and dignity objections. | Validate acceptability via clinician and patient interviews; test physical shutter / privacy-preserving hardware switches. |
| **"Zero added hardware cost"** | Indian government wards do not have laptops or tablets mounted at every general ward bed. Hardware must still be purchased, mounted, powered, and secured. | Re-model unit economics with honest tablet/bracket procurement costs (₹8,000–₹12,000/bed). |

---

## 4. Features Feasible Within a 24–48 Hour Hackathon

In a 24–48 hour sprint, we must build a system that is **small, bulletproof, and totally honest** rather than broad, fragile, and fake.

### Feasible Features:
1. **Calibrated Contactless Optical Heart Rate (HR)**:
   - Live face detection and forehead ROI tracking using a proven client-side detector.
   - Spatial chromatic averaging and POS projection.
   - Real-time digital Butterworth bandpass filtering ($0.75\text{ Hz} \to 3.0\text{ Hz}$).
   - Peak detection with dynamic adaptive thresholding.
   - **Tested live on stage against a real pulse oximeter on the presenter's finger.**
2. **Transparent Signal Quality Index (SQI)**:
   - Real-time spectral SNR calculation (power in cardiac peak vs. out-of-band noise).
   - If subject moves or light drops: UI explicitly states *"Signal Quality Low (28%) — Do Not Rely on Reading."*
3. **Semi-Automated MEWS Deterioration Calculator**:
   - Optical camera populates Heart Rate.
   - Nurse enters/adjusts Systolic BP, Respiratory Rate, Temp, and AVPU via clean, rapid sliders.
   - Deterministic MEWS output with explicit calculation breakdown.
4. **Physiologically Grounded Simulation Mode**:
   - A clearly labeled toggle: *"DEMO SIMULATION: Clinical Stress Test"*.
   - Plays mathematically verified clinical datasets (e.g., deteriorating septic patient vitals trace) to show how the UI and SBAR copilot respond to acute collapse.
5. **Standardized SBAR Emergency Dossier Generator**:
   - Auto-generates structured handoff text that can be copied to clipboard or dispatched.

---

## 5. Features Unrealistic or Dangerous to Attempt

The following features **must be immediately excised** from our hackathon build scope. Attempting them in 48 hours will produce pseudoscientific vaporware that will destroy our credibility:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                             EXCISED FEATURES (DO NOT ATTEMPT)                                    │
├─────────────────────────────────────┬────────────────────────────────────────────────────────────┤
│ FEATURE                             │ FATAL FLAW / REASON FOR REMOVAL                            │
├─────────────────────────────────────┼────────────────────────────────────────────────────────────┤
│ 1. Contactless SpO2 via Webcam      │ Physically invalid under uncontrolled ambient broadband   │
│                                     │ light. Commercial oximeters require narrow-band 660nm &    │
│                                     │ 940nm LEDs. An RGB sensor yields random noise.            │
├─────────────────────────────────────┼────────────────────────────────────────────────────────────┤
│ 2. Cuffless Blood Pressure (PTT)    │ Requires sub-millisecond multi-site pulse transit timing   │
│                                     │ and subject-specific vascular calibration. Generating BP   │
│                                     │ numbers from a facial camera alone is clinical malpractice.│
├─────────────────────────────────────┼────────────────────────────────────────────────────────────┤
│ 3. Automated Glasgow Coma Scale     │ Micro-saccadic eye tracking from a standard 720p webcam at │
│    via Saccadic Eye Tracking        │ 2 meters distance lacks the spatial resolution to assess   │
│                                     │ cranial nerve function. Completely unproven in 48 hours.   │
├─────────────────────────────────────┼────────────────────────────────────────────────────────────┤
│ 4. Multi-Bed 6-Patient Ceiling      │ Wide-angle lenses induce severe barrel distortion; faces   │
│    Camera Mesh                      │ are under-resolved (<30x30 pixels); patients roll over or  │
│                                     │ are occluded by blankets and visitors.                     │
├─────────────────────────────────────┼────────────────────────────────────────────────────────────┤
│ 5. Thermal FLIR + RGB Fusion        │ Requires specialized micro-bolometer hardware that we do   │
│                                     │ not have physically connected or calibrated.               │
└─────────────────────────────────────┴────────────────────────────────────────────────────────────┘
```

---

## 6. Clinical Claims That Must NEVER Be Made Without Hard Evidence

Judges at medical hackathons (e.g., VMedithon) frequently include intensivists, biomedical professors, and hospital administrators. If we utter any of the following statements, our project will be instantly discredited:

1. **NEVER SAY: "Our system diagnoses Sepsis."**  
   *What to say instead:* *"Our system implements the standard qSOFA and MEWS screening heuristics to alert nurses to physiological deterioration that warrants immediate clinical workup."*
2. **NEVER SAY: "We achieved an MAE of 2.14 BPM across all skin tones."** (Unless we have the raw time-series CSVs from a synchronized pulse oximeter trial run on stage).  
   *What to say instead:* *"In published literature, the POS algorithm achieves an MAE around 2–3 BPM under stable lighting. In our live prototype, we show real-time concordance against this finger pulse oximeter right here on stage."*
3. **NEVER SAY: "We replace ICU telemetry monitors."**  
   *What to say instead:* *"We do not replace ICU monitors. We provide an early warning surveillance safety net for general ward beds that currently have zero continuous monitoring."*
4. **NEVER SAY: "Our web app is HIPAA and DPDP compliant."**  
   *What to say instead:* *"We designed our architecture around zero-trust privacy invariants: frames are processed ephemerally in client RAM and never saved to disk or streamed to a cloud server."*
5. **NEVER SAY: "AegisPulse continuously measures Blood Pressure and Oxygen Saturation."**  
   *What to say instead:* *"Our optical pipeline directly measures Heart Rate and pulse rhythmicity. Blood Pressure and Temperature are entered manually or ingested via standard ward devices to complete the MEWS score."*

---

## 7. The Four Levels of System Maturity

We must be crystal clear about where AegisPulse stands today and where it must go:

```
  ┌──────────────────────┐
  │  Level 1: Hackathon  │ ◄── [AEGISPULSE IS CURRENTLY HERE]
  │      Prototype       │     Works on a seated person facing light; demonstrates mathematical
  └──────────┬───────────┘     feasibility; transparent simulated scenarios for edge cases.
             │
             ▼
  ┌──────────────────────┐
  │   Level 2: Research  │     Benchmarked on publicly available benchmark datasets (MMPD, UBFC);
  │      Prototype       │     synchronized ground-truth ECG/PPG hardware; IRB approved trials;
  └──────────┬───────────┘     statistical Bland-Altman agreement papers submitted to peer review.
             │
             ▼
  ┌──────────────────────┐
  │ Level 3: Production  │     Fault-tolerant edge agent, robust WebSockets, hardware-accelerated
  │      Software        │     Wasm/WebGPU pipeline, encrypted audit trails, role-based access,
  └──────────┬───────────┘     HL7/FHIR EHR interoperability, rigorous automated test suites.
             │
             ▼
  ┌──────────────────────┐
  │ Level 4: Clinically  │     ISO 13485 QMS, ISO 14971 Risk Management, IEC 62304 Life Cycle,
  │  Deployable SaMD     │     CDSCO Class B / FDA 510(k) clearance, multi-center prospective
  └──────────────────────┘     clinical trials proving non-inferiority and reduction in ward mortality.
```

---

## 8. Non-Negotiable Privacy Invariants

Any code committed to this repository must honor these 4 privacy laws:

1. **INVARIANT P1: Ephemeral Frame Lifecycle (Zero Disk Storage)**  
   Video frames obtained via `getUserMedia()` must live exclusively in volatile RAM (`HTMLCanvasElement` or typed arrays). Under no circumstances shall an image or video frame be written to `localStorage`, `IndexedDB`, filesystem, or transmitted over an HTTP/WebSocket pipe.
2. **INVARIANT P2: Telemetry-Only Data Transmission**  
   Only extracted numerical vectors (`{ heartRate: 74, signalQuality: 92, timestamp: 1726278000 }`) may cross process or network boundaries.
3. **INVARIANT P3: Explicit Optical Ingestion State Indicator**  
   The UI must prominently show when the camera sensor is actively polling pixels, including an immediate, one-click software toggle to kill camera streams and close media tracks (`stream.getTracks().forEach(t => t.stop())`).
4. **INVARIANT P4: Zero Biometric Identification**  
   AegisPulse extracts physiological color modulation, not facial recognition geometries. No facial recognition embeddings, face meshes, or biometric templates shall be generated or stored.

---

## 9. Non-Negotiable Clinical Safety Invariants

Any code calculating or displaying patient vitals must honor these 4 clinical safety laws:

1. **INVARIANT S1: Fail-Obvious, Never Hallucinate (The Anti-Placebo Rule)**  
   If the face is lost, lighting drops below threshold, or the subject moves violently, the engine **must immediately output `SIGNAL_LOST` or `POOR_SIGNAL`**. It is strictly forbidden to interpolate a synthetic 72 BPM sine wave during live monitoring mode to "keep the UI looking good." A flatline or missing data indicator is safe; a fabricated normal reading on a dying patient is fatal.
2. **INVARIANT S2: Prominent Investigational Disclaimer**  
   Every screen of the UI must feature a non-dismissible banner:  
   *`INVESTIGATIONAL HACKATHON PROTOTYPE — NOT FOR CLINICAL DIAGNOSTIC DECISION-MAKING`*.
3. **INVARIANT S3: Explicit Origin Tagging for All Vitals Vectors**  
   Every vital displayed in the system must carry an explicit origin attribute:  
   - `SOURCE: OPTICAL_RPPG`
   - `SOURCE: CLINICIAN_MANUAL_ENTRY`
   - `SOURCE: SIMULATED_DATASET`  
   The system must never present a manual entry or simulation vector as an autonomous camera measurement.
4. **INVARIANT S4: Non-Latching, Verified Alarm States**  
   Critical alarms (MEWS $\ge 5$, Code Red) must require explicit user acknowledgment with timestamped audit logging. Alarms must not self-dismiss after a timer expires.

---

## 10. Engineering Principles for the Rebuilt Architecture

1. **Radical Transparency over Flashy Black Boxes**:  
   Show the raw optical signal alongside the filtered waveform. Let the user and judges see the raw green-channel oscillations before and after the Butterworth filter. Real physics wins hackathons; fake AI loses them.
2. **Decoupled Architecture**:  
   - `SignalAcquisition`: Isolated worker or class handling video frames and ROI cropping.
   - `DSP`: Pure mathematical functions (POS, Butterworth, Detrending, Peak Detection) with zero React dependencies.
   - `ClinicalInference`: Pure deterministic calculators (MEWS, qSOFA) with unit test coverage.
   - `Presentation`: React components that react purely to state streams.
3. **Deterministic Math over Probabilistic Guesses**:  
   Clinical risk scores must be pure functions of their inputs ($f(\text{vitals}) \to \text{score}$). No LLMs in the critical vital sign calculation path. LLMs may only be used as generative assistants for formatting clinical handoff text (SBAR) from verified structured data.
4. **Resilient Offline Execution**:  
   The core rPPG pipeline, canvas renderer, and MEWS calculator must function with zero network access.

---

## The Strategic Assessment

### A. Things We Know
1. Remote Photoplethysmography (rPPG) is mathematically and biologically real: oxyhemoglobin absorption modulates green light reflectance.
2. The POS algorithm is superior to raw green channel averaging because it cancels diffuse illumination artifacts.
3. In-hospital ward deterioration is a massive, lethal problem worldwide, and public hospital wards in LMICs face severe nurse-to-patient staffing deficits.
4. Early Warning Scores (MEWS) save lives *if* they are populated with accurate vital signs.
5. Our previous documentation made exaggerated claims about clinical trial validation ($r=0.962$), SpO2, and cuffless BP that our codebase does not possess.

### B. Things We Believe
1. A rock-solid, live demonstration of real-time optical heart rate extraction on stage—coupled with an honest, transparent Signal Quality Index—will score dramatically higher with judges than an over-promising, buggy app that claims to solve all of medicine.
2. By coupling optical heart rate with rapid manual input for blood pressure, temperature, and respiration, a nurse can calculate a complete, verified MEWS score in **15 seconds** instead of 5 minutes.
3. Eliminating physical cables on post-operative ward patients reduces infection transmission vectors and improves patient dignity.

### C. Things We Must Prove
1. Can our newly built rPPG engine reliably extract heart rate on a real person on the hackathon stage under auditorium lighting?
2. Can we achieve sub-frame peak detection accuracy without dropping frames on standard laptop hardware?
3. Does our Signal Quality Index (SQI) accurately detect and flag when a person shakes their head or covers their face?
4. Can we execute the entire signal processing pipeline client-side without locking up the React UI thread?

### D. Things We Should Probably Stop Building
1. **Stop trying to do Contactless SpO2**: We do not have calibrated dual-wavelength emitters; claiming SpO2 from an RGB webcam is scientifically bankrupt.
2. **Stop trying to do Cuffless Blood Pressure**: It cannot be done responsibly in a 48-hour software hackathon.
3. **Stop claiming 100% autonomous MEWS without manual inputs**: Be honest that MEWS requires Blood Pressure and Temperature, which must be entered or pulled from connected devices.
4. **Stop claiming multi-patient ceiling surveillance**: A single webcam focused on a single face is hard enough to do right; tracking 6 patients from the ceiling is science fiction for this weekend.
5. **Stop writing marketing collateral claiming we conducted an $N=48$ clinical trial**: Acknowledge our work as a functional engineering proof-of-concept.

### E. Questions That Could Change the Entire Product Direction
1. **Is continuous bedside webcam monitoring actually what nurses want, or is a rapid 15-second 'Optical Spot-Check Kiosk' at the bedside 10x more realistic?**  
   *(If patients object to cameras staring at them 24/7, AegisPulse could pivot into an ultra-fast, contactless 15-second spot-check tool that the nurse holds up during rounds, cutting vital check time by 80% without privacy friction).*
2. **Should we pivot from ward telemetry to Telemedicine Video Triage?**  
   *(In telemedicine video calls, a doctor is ALREADY looking at the patient through a camera. An rPPG plugin giving the doctor an instantaneous live pulse and respiratory rate during a video consultation has zero deployment friction and immediate product-market fit).*
3. **Can we reliably extract Respiratory Rate from chest/throat motion instead of facial color?**  
   *(Since facial RSA is unreliable in sick patients, optical flow tracking of chest excursions or suprasternal notch breathing movements might be 5x more accurate for respiratory rate).*

---

**Execution Mandate:**  
Every engineer and contributor to AegisPulse is bound by this Constitution. When building new components, writing presentations, or answering jury questions, adhere strictly to these principles. **Truthful engineering beats fictional claims every single time.**
