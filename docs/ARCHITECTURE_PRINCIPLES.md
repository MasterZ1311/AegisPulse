# AegisPulse: Architecture Principles & Engineering Mandates

**Document Version:** 1.0  
**Role:** Principal Systems Architect & Lead Software Engineer  
**Status:** BINDING ARCHITECTURAL SPECIFICATION  

---

## 1. Foundational System Principles

Every module, class, and component committed to the AegisPulse repository must adhere to six foundational system principles:

1. **Safety Before Novelty**: A feature that looks impressive on stage but introduces clinical ambiguity or silent algorithmic failure is a liability. Mathematical correctness and safety invariants always supersede visual flair.
2. **Deterministic Scoring Over Black-Box AI**: The calculation of clinical priority and early warning indices must be pure, deterministic, and auditable mathematical functions. Deep learning models or probabilistic LLMs may assist with visual feature extraction (e.g., face detection) or handoff text formatting, but **never in the critical vital scoring path**.
3. **Contract-First Component Design**: Systems must be architected from strict, immutable TypeScript interfaces before implementation begins. Core domains (Sensory Ingestion, Information Decay, Trend Engine, Clinical Scoring, UI) must communicate exclusively across frozen data contracts.
4. **Offline-First Resilience**: Public health facilities in developing regions suffer from frequent power brownouts and network dead zones. The core deterioration radar, rPPG signal processor, and MEWS calculator must function 100% locally on the edge device without active internet.
5. **No Hallucinated Signals (Anti-Placebo Mandate)**: It is an absolute violation of system integrity to interpolate, synthesize, or display an artificial "normal" vital sign (e.g., generating a 72 BPM sine wave) when sensor quality degrades. The system must fail openly and visibly.
6. **Continuous Demoability at Every Milestone**: Every development milestone must result in an executable, demonstrable product increment. A broken build or non-functional staging branch is unacceptable.

---

## 2. Privacy & Data Protection Architecture

Hospital wards are intimate physical environments. The placement of optical sensors in clinical spaces demands uncompromising privacy guarantees enforced at the silicon and memory layer:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   THE MEMORY ENCLAVE LIFECYCLE                                   │
│                                                                                                  │
│   Webcam Sensor ──► navigator.mediaDevices.getUserMedia()                                        │
│                            │                                                                     │
│                            ▼                                                                     │
│   HTML5 Canvas Buffer [Volatile Browser RAM Only]                                                │
│   ├── Dynamic Forehead ROI Crop (30% W × 18% H)                                                  │
│   ├── Spatial Chrominance Extraction: μ_R, μ_G, μ_B                                              │
│   └── Frame Cleared / Overwritten Every 33.3ms (30 FPS)                                          │
│                            │                                                                     │
│                            ▼ (RAW IMAGE DESTROYED IN MEMORY)                                     │
│   Pure Numerical Telemetry Vector Extracted:                                                     │
│   { heartRate: 74, signalConfidence: 0.92, timestamp: 1726278000 }                               │
│                            │                                                                     │
│                            ▼                                                                     │
│   Local SQLite Database / Ward Gateway (NO VIDEO STREAM, NO CLOUD UPLOAD)                       │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.1 The Ephemeral Memory Invariant (Volatile RAM Only)
- Raw video frames obtained via optical sensors live exclusively in volatile canvas buffers (`HTMLCanvasElement`, `ImageData`, or WebGL texture memory).
- **Prohibition**: Video frames, screenshots, or uncompressed bitmap buffers shall **never be written to persistent disk storage** (`fs`, `localStorage`, `IndexedDB`) and shall **never be transmitted over network sockets** (HTTP, WebSockets, WebRTC).
- Every video frame buffer must be completely overwritten or garbage-collected within the frame cycle ($< 33.3\text{ ms}$).

### 2.2 Telemetry-Only Data Egress
- The only data permitted to cross the boundary from the optical sensor device to the ward server or nursing station dashboard is a structured, de-identified numerical telemetry payload:
  $$\text{Payload} = \{\text{patientId}, \text{timestamp}, \text{heartRate}, \text{respiratoryRate}, \text{confidence}, \text{sqi}\}$$
- The maximum network payload per reading is bounded to approximately **120 bytes of JSON**.

### 2.3 Visual Hardware Sensor Status Indication
- Whenever the camera sensor is actively polling pixels, the user interface must render an explicit, high-contrast visual recording status indicator (e.g., glowing green scanner reticle and active countdown ring).
- The user must always have an immediate, single-click mechanism to kill the optical stream and release hardware tracks:
  ```typescript
  stream.getTracks().forEach(track => track.stop());
  ```

### 2.4 Zero Facial Biometric Harvesting
- AegisPulse extracts temporal color oscillations caused by micro-vascular blood flow. It does not perform facial recognition, facial landmark template storage, or identity verification. No biometric templates are ever generated or retained.

---

## 3. Reliability & Graceful Degradation

Clinical reliability requires that the system behaves predictably across all failure modes:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                               SENSOR QUALITY STATE MACHINE                                       │
│                                                                                                  │
│   ┌───────────────┐        SQI < 75%        ┌───────────────────┐        SQI < 50%       ┌──────┐│
│   │    TRUSTED    │ ──────────────────────► │     DEGRADED      │ ─────────────────────► │ LOST ││
│   │ (SQI 75-100%) │ ◄────────────────────── │   (SQI 50-74%)    │ ◄───────────────────── │      ││
│   └───────┬───────┘        SQI ≥ 75%        └─────────┬─────────┘        SQI ≥ 50%       └──────┘│
│           │                                           │                                          │
│           ▼                                           ▼                                          │
│   Full Telemetry Active;                    Display Optical Warning;                    Halt Calcs;
│   Information Decay = 0.                    Factor Uncertainty into Decay.              Decay Ticks.
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.1 Four-State Sensor Quality Classification
1. **`TRUSTED (SQI 75% – 100%)`**: High-fidelity optical pulsatile signal. Vitals vectors update live; information decay resets to 0.
2. **`DEGRADED (SQI 50% – 74%)`**: Moderate noise detected (subtle patient motion, sub-optimal lighting). Vitals displayed with visual amber warning badge; uncertainty weighting applied to information decay.
3. **`UNRELIABLE (SQI 25% – 49%)`**: Excessive motion or deep shadow. Numerical outputs are frozen with a strikethrough; system displays *"Patient Moving — Calibrating..."*.
4. **`LOST (SQI < 25%)`**: Face occluded, camera turned off, or subject absent from bed. The engine immediately transitions to `SIGNAL_LOST`. No numerical vitals are output. The Information Decay clock accelerates.

### 3.2 Offline-First Data Synchronization
- The bedside edge device stores local observation logs in an embedded relational SQLite store.
- If the hospital local area network disconnects, the edge device continues local triage scoring, queue maintenance, and audio alert generation seamlessly.
- Upon network restoration, historical telemetry records are synchronized to the central ward server via idempotent HTTP batch endpoints.

---

## 4. Observability & Explainability Architecture

In healthcare, an unexplained score is an unusable score. Black-box algorithms are dismissed by clinicians and rejected by hospital risk committees.

### 4.1 The Explainable Decision Path
Every computed Attention Priority Score ($APS$) must carry a deterministic breakdown tuple:
$$\text{Output} = \{APS, \text{Category}, \text{Weights}, \text{Reasons}, \text{Confidence}, \text{Timestamp}\}$$

The `whyReasons` array must be generated directly from deterministic threshold comparisons:
- If $\Delta \text{HR}/\Delta t > 15\% \implies$ Generate: *"Heart Rate accelerating +X% over Y minutes."*
- If $t_{\text{current}} - t_{\text{last\_check}} > 3\text{ hours} \implies$ Generate: *"Information Decay: No manual check for Xh Ym."*
- If $\text{Lactate} > 2.0\text{ mmol/L} \implies$ Generate: *"Biochemical Stress: Serum Lactate elevated at Z mmol/L."*

### 4.2 Comprehensive Audit Logging
- Every change in patient priority tier (e.g., transitioning from `WATCH` to `CRITICAL_REVIEW`) produces an immutable audit event in the database:
  - Timestamp
  - Triggering vector (e.g., velocity spike, manual observation input)
  - Prior score vs. new score
  - Attending nurse acknowledgment signature

---

## 5. Modularity & Decoupled Domain Architecture

The codebase is organized into five isolated architectural domains. Dependencies flow strictly in one direction:

```
[Layer 1: Sensory Ingestion] ──► [Layer 2: Digital Signal Processing] ──► [Layer 3: Clinical Inference]
                                                                                   │
                                                                                   ▼
[Layer 5: Presentation / UI] ◄────────────── [Layer 4: Attention Radar Engine] ◄───┘
```

1. **`Sensory Ingestion` (`src/core/sensors/`)**:
   - Manages video device access, frame rendering to off-screen canvases, and ROI cropping.
   - Zero clinical math. Output: Raw RGB arrays and timestamps.
2. **`Digital Signal Processing` (`src/core/dsp/`)**:
   - Pure mathematical functions: POS projection, Butterworth bandpass filtering, temporal detrending, dynamic peak zero-crossing, and SNR calculation.
   - Zero React or browser UI dependencies. Unit-testable in Node.js.
3. **`Clinical Inference` (`src/core/clinical/`)**:
   - Pure deterministic calculators: MEWS scoring matrix, qSOFA sepsis criteria, Shock Index calculation.
   - Input: Clean physiological numbers. Output: Validated clinical risk categories.
4. **`Attention Radar Engine` (`src/core/radar/`)**:
   - Implements the Attention Priority Score (APS) formula.
   - Synthesizes physiological velocity vectors, information decay timers, lab biomarkers, and bed context into a sorted ward queue.
5. **`Presentation Layer` (`src/components/`)**:
   - React 19 UI components: Dynamic Priority Queue, "WHY NOW" slide-over cards, 60 FPS oscilloscope, and SBAR generator.
   - Consumes state streams reactively.
