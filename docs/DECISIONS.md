# AegisPulse: Architecture Decision Records (ADRs)

**Document Version:** 1.0  
**Status:** FROZEN ARCHITECTURAL RECORDS  
**Role:** Principal Systems Architect  

---

## ADR-001: Pivot from Continuous Video Telemetry to Attention Allocation Radar

### Context
Previous AegisPulse positioning claimed to replace traditional wired ICU telemetry monitors by streaming continuous 24/7 webcam video of general ward patients. This positioning suffered from severe operational and scientific failure modes:
1. Optical rPPG fails in pitch-dark wards at night when 70% of cardiac arrests occur.
2. Blanket occlusions and normal sleeping postures trigger dozens of false alarms per hour.
3. Placing 24/7 video cameras facing hospital beds provoked insurmountable patient dignity and DPDP privacy resistance.
4. Nurses in understaffed wards (1:40 ratio) do not have time to watch 40 beeping telemetry streams.

### Decision
AegisPulse is officially reframed as:  
**"Patient Deterioration Radar & Nurse Attention Allocation Engine."**  
The core output is an explainable **Attention Priority Score (APS: 0–100)** answering: *"Which patient should the nurse pay attention to next, and why?"* Optical rPPG is demoted from the entire product to **one optional sensing modality**.

### Consequences
- **Positive**: Eliminates the dark ward and continuous surveillance dilemmas; directly addresses nurse cognitive overload; transforms sensor uncertainty from an algorithmic failure into an active clinical risk indicator (Information Decay).
- **Negative**: Requires a more sophisticated multi-vector deterministic ranking engine rather than a simple video-to-BPM pipeline.

---

## ADR-002: Deterministic Mathematical Scoring over Black-Box Neural Networks

### Context
Deep learning models (e.g., 3D-CNNs, transformer vitals predictors) require heavy server GPUs ($2,000+), introduce latency, and output probabilistic confidence percentages with zero explainability. Clinicians and regulatory bodies (CDSCO / FDA) reject unexplainable black-box triage scores.

### Decision
The Attention Priority Score (APS), MEWS calculator, and Information Decay functions shall be implemented as **100% deterministic mathematical formulas**. LLMs may only be utilized for formatting human-readable SBAR text summaries from verified structured data.

### Consequences
- **Positive**: Auditable, mathematically transparent, executes in $< 1\text{ ms}$ on low-cost edge hardware, zero GPU requirement, seamless regulatory approval pathway.
- **Negative**: Requires careful heuristic tuning of physiological velocity weights ($\alpha, \beta, \gamma$).

---

## ADR-003: Permanent Exclusion of Unverifiable Optical Modalities (SpO2 & Cuffless BP)

### Context
Previous drafts claimed webcam-derived Oxygen Saturation ($\text{SpO}_2$) and continuous cuffless Blood Pressure (BP). Both claims are scientifically indefensible on standard consumer RGB sensors under uncontrolled broadband ambient illumination, and were rejected by medical judges and clinical advisors.

### Decision
Permanently excise SpO2 and cuffless BP from the core optical rPPG pipeline. Optical rPPG is strictly restricted to **Heart Rate (BPM)**, **Heart Rate Variability (RMSSD)**, and **Respiratory Rate (RR)** with an explicit Signal Quality Index (SQI). Blood pressure and temperature are ingested via rapid clinical UI dials or external digital monitors.

### Consequences
- **Positive**: Instantly establishes technical credibility with medical judges; eliminates clinical malpractice liability.
- **Negative**: Requires manual or external entry of blood pressure to complete the full MEWS matrix.

---

## ADR-004: Volatile RAM-Only Optical Sensing Invariant

### Context
Capturing video of patients in hospital wards creates immense legal exposure under India's **Digital Personal Data Protection (DPDP) Act 2023** and **HIPAA Security Rules**.

### Decision
Enforce a silicon- and memory-level invariant: **Video frames exist exclusively in volatile canvas buffer memory for $< 33.3\text{ ms}$**. Under no circumstances shall an image or video buffer be written to disk, cached in browser storage, or transmitted across a network socket. Only 120-byte numerical telemetry vectors may egress the device.

### Consequences
- **Positive**: Complete statutory compliance; zero data breach surface area for patient imagery; easily passes hospital IT security reviews.
- **Negative**: Prevents post-hoc computer vision debugging using saved video files (debugging must use synthetic test frames).

---

## ADR-005: The 15-Second Optical Spot-Check as Primary rPPG Operational Paradigm

### Context
Continuous 24/7 video processing exhausts tablet batteries, overheats mobile processors, and fails whenever the patient turns away from the lens.

### Decision
Standardize optical rPPG primarily around an active **15-Second Guided Spot-Check** interaction:
- The nurse holds up the tablet during rounds or the seated patient faces the screen.
- A 15-second circular timer runs with real-time SQI gating.
- Once calibrated, the reading is locked into the patient's record and the camera stream is immediately torn down.

### Consequences
- **Positive**: Guarantees controlled lighting and still posture; eliminates thermal throttling; respects patient privacy; delivers a flawless 15-second live demo for hackathon judges.
- **Negative**: Does not provide continuous second-by-second overnight heart rate telemetry (which is compensated for by the Information Decay clock).

---

## ADR-006: Integration of Information Decay as a First-Class Clinical Risk Factor

### Context
In hospital wards, deterioration occurs between observation rounds. If a patient was stable 4 hours ago, our certainty of their current stability decays over time.

### Decision
Formalize **Information Decay ($D_{\text{time}}$)** as an equal partner to physiological velocity in the APS formula:
$$D_{\text{time}} \propto \left(\frac{t_{\text{current}} - t_{\text{last\_check}}}{\tau_{\text{ward\_protocol}}}\right)^2$$
As time since the last verified check elapses, the bed’s priority score automatically climbs, prompting the nurse to reassess the patient before a blindspot leads to cardiac arrest.

### Consequences
- **Positive**: Directly mirrors nursing intuition; solves the "forgotten patient" tragedy; guarantees that stable patients who have been ignored still get scheduled bedside visits.
- **Negative**: Requires precise timestamping and clock synchronization across ward devices.
