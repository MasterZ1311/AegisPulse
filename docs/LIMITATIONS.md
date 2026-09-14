# AegisPulse: Exhaustive System Limitations & Boundary Disclosure

**Document Status:** AUTHORITATIVE TECHNICAL DISCLOSURE  
**Governing Standard:** `docs/SOURCE_OF_TRUTH.md`

---

## 1. Epistemic Transparency Philosophy

In clinical software engineering, credibility is built through brutal honesty about limitations, not exaggerated marketing. This document details every known technical, physiological, operational, and regulatory boundary of **AegisPulse**.

---

## 2. Optical & Sensing Limitations

### 2.1 Ambient Illuminance Threshold (< 30 Lux)

- **Limitation**: Remote Photoplethysmography requires photons reflecting from subcutaneous capillary beds. In pitch-black hospital wards at night, standard RGB webcams receive insufficient light, causing camera gain noise to overwhelm the tiny AC pulsatile signal ($< 1\%$).
- **System Behavior**: Gated below 30 lux. The system flags `INSUFFICIENT_LIGHT` and halts optical vitals extraction.
- **Mitigation**: A bedside nurse reading lamp or active infrared (NIR) illumination is required for optical night monitoring.

### 2.2 Patient Motion & Postural Shifts

- **Limitation**: While POS and CHROM algorithms withstand conversational head motion, vigorous movement (coughing fits, turning in bed, ambulating) creates massive non-pulsatile optical shifts that distort peak detection.
- **System Behavior**: Signal Quality Index (SQI) drops below 0.30; the reading is gated (`POOR_SIGNAL`).
- **Mitigation**: Bounded 15-second guided spot-checks require the patient to remain still facing the camera.

### 2.3 Facial Occlusion

- **Limitation**: Blankets pulled over the face, surgical masks, oxygen masks (Venturi / non-rebreather), or visitors standing in front of the bed block the forehead ROI.
- **System Behavior**: Face detector outputs `NO_FACE_DETECTED`. After 2.0 seconds of occlusion, the system flags `SIGNAL_LOST`.

### 2.4 Severe Peripheral Vasoconstriction & Shock

- **Limitation**: In hypovolemic shock, cardiogenic shock, or severe hypothermia, the human autonomic nervous system shunts blood away from peripheral capillary beds to protect core organs. Facial pulsatility attenuates dramatically.
- **System Behavior**: Low signal amplitude triggers an uncertainty flag, which elevates the bed's priority for physical nurse assessment.

---

## 3. Demographic & Skin Phototype Limitations

### 3.1 Melanin Attenuation in Fitzpatrick Skin Phototypes V–VI

- **Limitation**: Epidermal melanin strongly absorbs green light ($500\text{--}560\text{ nm}$). In dark skin phototypes (Fitzpatrick V–VI), the reflected pulsatile signal amplitude is significantly attenuated.
- **System Behavior**: Under sub-optimal lighting (< 100 lux), SNR drops faster for darker skin tones, resulting in lower measurement yield (80% vs 100% on synthetic benchmarks).
- **Mitigation**: Ensure adequate frontal illumination ($\ge 150\text{ lux}$) or fall back to contact oximetry.

---

## 4. Clinical & Algorithmic Limitations

### 4.1 Non-Diagnostic Triage Boundary

- **Limitation**: The Attention Priority Score (APS) is an **operational attention allocation index**, not a diagnostic probability. An APS of 88 does not mean the patient has an 88% chance of dying or an 88% likelihood of sepsis.
- **System Behavior**: The system highlights that the patient's trajectory warrants immediate clinical evaluation; it does not diagnose etiology.

### 4.2 Adult Ward Calibration Only

- **Limitation**: The Subbe MEWS (2001) and Singer qSOFA (2016) scoring thresholds are calibrated exclusively for non-pregnant adult inpatients ($\ge 18$ years).
- **Contraindication**: Must **NOT** be used for pediatric cohorts (requires PEWS) or obstetric patients (requires MEOWS).

### 4.3 Unvalidated Modalities (Webcam SpO2 & BP)

- **Webcam SpO2**: RGB sensors under ambient light cannot resolve the differential $660\text{ nm} / 940\text{ nm}$ absorption ratio. Contactless SpO2 is **prohibited and unvalidated**.
- **Webcam Cuffless Blood Pressure**: Deriving arterial pressure from facial video without individual calibration curves is clinically invalid and **prohibited**.

---

## 5. Dataset & Benchmark Limitations

- **Synthetic Benchmark Boundary**: Current empirical benchmarks in `research/benchmarks/run-scientific-evaluation.ts` are measured on synthetic physiological time-series models parameterized with real physics. While reproducible, they are not a substitute for a prospectively registered clinical trial on human inpatients.
- **Pending Clinical Trials**: A formal institutional review board (IRB) approved human trial against synchronized 5-lead ECG and invasive arterial lines has not yet been conducted.

---

## 6. Infrastructure & Deployment Limitations

### 6.1 SQLite Single-Writer Concurrency

- **Limitation**: Embedded SQLite operates in Write-Ahead Logging (WAL) mode, providing high-concurrency non-blocking reads, but transactions that write to the database are serialized.
- **Scale Horizon**: Single-server SQLite comfortably handles up to 50–100 simultaneous beds at 1 Hz ingestion. Beyond 200 beds, write lock contention requires migration to PostgreSQL or TimescaleDB.

### 6.2 Browser Offline Storage Quota

- **Limitation**: Edge tablets running in offline mode store queued vitals and actions in browser `localStorage`.
- **Storage Boundary**: Typical browser quotas range from 5 MB to 10 MB. This accommodates $\sim 25,000$ telemetry records (sufficient for $> 72$ hours of offline rounding). Stale items are evicted using LRU if limits are approached.

### 6.3 Network Latency & Flaps

- **Limitation**: In wards with thick concrete walls or RF shielding, Wi-Fi connectivity may drop intermittently.
- **Mitigation**: The UI transitions to `DEGRADED` or `OFFLINE` mode, buffering actions locally until reconnection.

---

## 7. Regulatory Status Limitations

- **No Premarket Clearance**: AegisPulse does **not** have FDA 510(k), CDSCO Class B SaMD clearance, or CE mark.
- **Deployment Constraint**: Can only be deployed as an investigational research prototype or clinical decision support research study with appropriate institutional ethical approval.
