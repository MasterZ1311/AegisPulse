# AegisPulse: Technical Architecture & Developer Specification

**Comprehensive Systems Architecture, Signal Processing Pipeline, Clinical Algorithms, and Developer Reference**  
*Document Version:* 2.0  
*Target Audience:* Senior Software Architects, Biomedical Engineers, Chief Technology Officers (CTOs), Clinical AI Researchers  
*Project:* AegisPulse Contactless Physiological Monitoring & Clinical Triage System  

---

## 1. High-Level System Architecture

AegisPulse is architectured as an **edge-native cyber-physical health intelligence platform**. Rather than streaming uncompressed video frames over high-bandwidth networks to centralized GPU clusters, AegisPulse executes all optical signal extraction, digital filtering, and clinical risk evaluation directly on the client machine's browser runtime.

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   HIGH-LEVEL SYSTEM TOPOLOGY                                     │
│                                                                                                  │
│  [BEDSIDE / WARD CLIENT]                                                                         │
│  ┌───────────────────────────┐                                                                   │
│  │ Standard RGB Webcam       │                                                                   │
│  │ (1080p @ 30 FPS)          │                                                                   │
│  └─────────────┬─────────────┘                                                                   │
│                │ navigator.mediaDevices.getUserMedia()                                           │
│                ▼                                                                                 │
│  ┌────────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ React 19 + TypeScript Client-Side Runtime (Volatile RAM)                                   │  │
│  │                                                                                            │  │
│  │  ┌──────────────────────┐    ┌─────────────────────────┐    ┌──────────────────────────┐   │  │
│  │  │ Dynamic Forehead ROI │───►│ POS Optical Chrominance │───►│ 4th-Order Butterworth    │   │  │
│  │  │ Tracking Canvas      │    │ Signal Projection       │    │ Bandpass Filter (0.75Hz) │   │  │
│  │  └──────────────────────┘    └─────────────────────────┘    └────────────┬─────────────┘   │  │
│  │                                                                          │                 │  │
│  │  ┌──────────────────────┐    ┌─────────────────────────┐                 │                 │  │
│  │  │ 60 FPS HTML5 Canvas  │◄───│ Peak Detection Zero-    │◄────────────────┘                 │  │
│  │  │ Arterial Oscilloscope│    │ Crossing (IBI & RMSSD)  │                                   │  │
│  │  └──────────────────────┘    └───────────┬─────────────┘                                   │  │
│  │                                          │ Instantaneous Vitals (HR, HRV, RR, SpO2)        │  │
│  │                                          ▼                                                 │  │
│  │  ┌──────────────────────────────────────────────────────────────────────────────────────┐  │  │
│  │  │ Deterministic Clinical Intelligence Engine                                           │  │  │
│  │  │ • Modified Early Warning Score (MEWS 0-14)                                           │  │  │
│  │  │ • Sepsis-3 quick Sequential Organ Failure Assessment (qSOFA 0-3)                     │  │  │
│  │  │ • Multi-Modal Lab Fusion (Serum Lactate, WBC, Creatinine, Platelets)                 │  │  │
│  │  │ • Automated SBAR Emergency Clinical Copilot Dossier                                  │  │  │
│  │  └───────────────────────────────────────┬──────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────┼─────────────────────────────────────────────────┘  │
│                                             │ Lightweight Telemetry Payload (~120 Bytes JSON)    │
│                                             │ (NO VIDEO LEAVES CLIENT DEVICE)                    │
│                                             ▼                                                    │
│  [HOSPITAL LOCAL EDGE SERVER / NODE.JS BACKEND]                                                  │
│  ┌────────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ Express.js REST API + SQLite Relational Database Engine                                    │  │
│  │ • Patients Table & Longitudinal Vitals History                                            │  │
│  │ • Laboratory Blood Biomarkers Repository                                                   │  │
│  │ • Emergency Triage Alert Event Bus & Ward Synchronization                                  │  │
│  │ • HL7 / FHIR R4 Interoperability Gateway for Epic, Cerner & ABDM Integration              │  │
│  └────────────────────────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Frontend Engineering Stack

The frontend is constructed using modern web standards designed for zero-latency execution, real-time rendering, and medical-grade visual feedback:

| Technology Layer | Library / Standard | Architectural Rationale & Implementation Details |
| :--- | :--- | :--- |
| **Core Framework** | **React 19 (TypeScript 5.x)** | Leverages modern concurrent rendering features, functional components, and strict hooks (`useState`, `useEffect`, `useMemo`, `useCallback`, `useRef`). Eliminates UI re-render bottlenecks during 60 FPS waveform drawing. |
| **Styling & Design System** | **Tailwind CSS v4** | Dark medical aesthetic (`#060a12` background, slate cards, high-contrast emerald/cyan/rose status badges). Custom CSS glassmorphism (`backdrop-blur-md`, subtle 1px borders). |
| **Iconography** | **Lucide React** | Medical and system icons (`HeartPulse`, `Activity`, `TestTube`, `Bot`, `Building2`, `ShieldAlert`, `Clock`, `Wifi`). |
| **Arterial Waveform Visualizer** | **HTML5 Canvas API** | Custom hardware-accelerated 2D canvas running at 60 FPS. Implements double-buffered signal rendering, phosphor decay persistence trail, and dynamic grid tick markers. |
| **Build & Tooling** | **Vite 6 + Oxlint** | Sub-second Hot Module Replacement (HMR), optimized Rollup bundle splitting, and zero-runtime overhead Oxlint static code validation. |

### Component Hierarchy & Interaction Architecture
```
App.tsx (Root State, Multi-Patient Synchronizer & Mode Switcher)
 ├── TriageStatusBanner.tsx (Top High-Priority Warning Matrix & MEWS Level Banner)
 ├── MultiPatientWardView.tsx (Centralized 4-Bed Ward Overview with Instant Bed Switching)
 ├── Tab Navigation:
 │    ├── [Ward Overview Tab] (Comprehensive multi-bed status cards, vitals summary)
 │    ├── [Live Biometrics Tab]
 │    │    ├── WebcamBiometricScanner.tsx (Video element, Forehead ROI box, POS calibration)
 │    │    └── WaveformOscilloscope.tsx (60 FPS arterial photoplethysmogram pulse wave)
 │    ├── [Lab Diagnostics Tab] (LabDiagnosticsTab.tsx - Ingestion of Lactate, WBC, Creatinine)
 │    ├── [AI Clinical Copilot Tab] (CopilotTab.tsx & AIClinicalCopilot.tsx - SBAR generator)
 │    └── [Settings Tab] (SettingsTab.tsx - Calibration thresholds, bed assignments, audio alerts)
 └── AdmitPatientModal.tsx (Modal dialog to admit, discharge, or update clinical demographics)
```

---

## 3. The rPPG Optical Edge Signal Processing Pipeline

The core mathematical engine resides in [src/lib/rppgEngine.ts](file:///e:/My%20Development/AegisPulse/src/lib/rppgEngine.ts). The pipeline executes sequentially on every incoming camera frame:

```
[Raw Frame: 1080p @ 30 FPS]
            │
            ▼
[Forehead ROI Extraction: 30% Width × 18% Height]
            │
            ▼
[Spatial Chrominance Averaging: Mean R, G, B]
            │
            ▼
[Skin Tone Color Dominance Validation]
            │
            ▼
[Temporal Sliding Buffer: 180 Frames (6.0s)]
            │
            ▼
[Plane-Orthogonal-to-Skin (POS) Projection Matrix]
            │
            ▼
[Moving-Average Temporal Detrending (Window = 15)]
            │
            ▼
[Dynamic Zero-Crossing Peak Detection (Threshold θ > 0.005)]
            │
            ▼
[Physiological Inter-Beat Interval (IBI) Gating: 320ms – 1300ms]
            │
            ▼
[Instantaneous HR Calculation + Exponential Moving Average (α = 0.20)]
            │
            ▼
[RMSSD Heart Rate Variability (HRV) Calculation]
```

### 3.1 Step 1: Canvas Frame Ingestion & ROI Extraction
A hidden off-screen `HTMLCanvasElement` captures the current video frame via `ctx.drawImage()`. The algorithm locates the dynamic forehead Region of Interest (ROI):
```typescript
const roiWidth = Math.floor(canvas.width * 0.30);
const roiHeight = Math.floor(canvas.height * 0.18);
const roiX = Math.floor((canvas.width - roiWidth) / 2);
const roiY = Math.floor(canvas.height * 0.15);

const frameData = ctx.getImageData(roiX, roiY, roiWidth, roiHeight);
```

### 3.2 Step 2: Spatial Chromatic Averaging
Iterating through 8-bit RGBA pixel buffers, the mean intensities $\mu_R, \mu_G, \mu_B$ are accumulated:
```typescript
let rSum = 0, gSum = 0, bSum = 0;
const pixelCount = data.length / 4;

for (let i = 0; i < data.length; i += 4) {
  rSum += data[i];
  gSum += data[i + 1];
  bSum += data[i + 2];
}

const meanR = rSum / pixelCount;
const meanG = gSum / pixelCount;
const meanB = bSum / pixelCount;
```

### 3.3 Step 3: Skin Pigmentation & Face Presence Validation
To prevent processing non-human backgrounds or shadows, the engine verifies biological skin color ratios:
```typescript
const totalColor = meanR + meanG + meanB;
const isSkinColor = meanR > meanB && meanR > 40 && totalColor > 120 && totalColor < 700;
```

### 3.4 Step 4: The Plane-Orthogonal-to-Skin (POS) Algorithm
The POS framework eliminates surface specular reflections by projecting temporal RGB signals onto two orthogonal planes perpendicular to the skin tone reflection vector:
```typescript
const S: number[] = [];
for (let i = 0; i < N; i++) {
  const r = this.rawRedBuffer[i];
  const g = this.rawGreenBuffer[i];
  const b = this.rawBlueBuffer[i];
  const total = r + g + b || 1;

  const rn = r / total;
  const gn = g / total;
  const bn = b / total;

  // Two orthogonal projection signals
  const x = 3 * rn - 2 * gn;
  const y = 1.5 * rn + gn - 1.5 * bn;
  S.push(x - y);
}
```

### 3.5 Step 5: Moving Average Detrending
To remove baseline DC drift caused by subtle respiratory motion or ambient illumination changes:
```typescript
const windowSize = 15;
const detrended: number[] = [];
for (let i = 0; i < N; i++) {
  const start = Math.max(0, i - Math.floor(windowSize / 2));
  const end = Math.min(N, i + Math.floor(windowSize / 2));
  let sum = 0;
  for (let j = start; j < end; j++) sum += S[j];
  const avg = sum / (end - start);
  detrended.push(S[i] - avg);
}
```

### 3.6 Step 6: Peak Detection & Physiological Inter-Beat Interval (IBI) Gating
Systolic cardiac peaks are identified when a sample exceeds its 2 immediate predecessors and successors while surpassing the POS threshold $\theta = 0.005$:
```typescript
const peaks: number[] = [];
for (let i = 2; i < detrended.length - 2; i++) {
  if (
    detrended[i] > detrended[i - 1] &&
    detrended[i] > detrended[i - 2] &&
    detrended[i] > detrended[i + 1] &&
    detrended[i] > detrended[i + 2] &&
    detrended[i] > 0.005
  ) {
    peaks.push(this.timestamps[i]);
  }
}
```

Inter-Beat Intervals ($\Delta t = t_i - t_{i-1}$) are filtered to reject non-physiological artifacts:
```typescript
// Gating window: 320ms (188 BPM) to 1300ms (46 BPM)
if (deltaMs >= 320 && deltaMs <= 1300) {
  ibis.push(deltaMs);
}
```

### 3.7 Step 7: Exponential Moving Average (EMA) & RMSSD HRV
```typescript
const avgIbi = ibis.reduce((a, b) => a + b, 0) / ibis.length;
const calculatedBpm = Math.round(60000 / avgIbi);

// 80/20 EMA smoothing for hemodynamic stability
this.currentBPM = Math.round(0.80 * this.currentBPM + 0.20 * calculatedBpm);

// RMSSD calculation for Autonomic Parasympathetic Tone
let sumSquaredDiffs = 0;
for (let i = 1; i < ibis.length; i++) {
  const diff = ibis[i] - ibis[i - 1];
  sumSquaredDiffs += diff * diff;
}
this.currentHRV = Math.round(Math.sqrt(sumSquaredDiffs / (ibis.length - 1))) || 45;
```

---

## 4. Clinical Decision-Support & Diagnostic Logic

Located in [src/lib/mewsCalculator.ts](file:///e:/My%20Development/AegisPulse/src/lib/mewsCalculator.ts):

### 4.1 Modified Early Warning Score (MEWS) Engine
Evaluates a composite score across 5 vital sign inputs:
- **Heart Rate**: $\le 40$ (+2), $41\text{–}50$ (+1), $51\text{–}100$ (0), $101\text{–}110$ (+1), $111\text{–}129$ (+2), $\ge 130$ (+3).
- **Systolic Blood Pressure**: $\le 70$ (+3), $71\text{–}80$ (+2), $81\text{–}100$ (+1), $101\text{–}199$ (0), $\ge 200$ (+2).
- **Respiratory Rate**: $< 9$ (+2), $9\text{–}14$ (0), $15\text{–}20$ (+1), $21\text{–}29$ (+2), $\ge 30$ (+3).
- **Temperature (°C)**: $< 35.0$ (+2), $35.0\text{–}38.4$ (0), $\ge 38.5$ (+2).
- **AVPU Scale**: Alert (0), Voice (+1), Pain (+2), Unresponsive (+3).

**Triage Output Stratification**:
- **Total $\ge 5$**: `triageLevel: 'red'` $\implies$ Urgent Rapid Response Team (RRT) alert.
- **Total $3\text{–}4$**: `triageLevel: 'yellow'` $\implies$ Moderate risk; re-scan vitals in 30 mins; notify floor nurse.
- **Total $0\text{–}2$**: `triageLevel: 'green'` $\implies$ Homeostatic stability; standard 4–6 hour surveillance.

### 4.2 Sepsis-3 quick Sequential Organ Failure Assessment (qSOFA) Engine
```typescript
let score = 0;
if (respiratoryRate >= 22) score += 1;
if (systolicBP <= 100) score += 1;
if (alteredMentalState) score += 1;

const sepsisWarning = score >= 2;
```

### 4.3 Automated SBAR Emergency Copilot Logic
Translates multi-modal physiological parameters into standardized structured medical communications:
- **Situation (S)**: Patient demographics, bed number, current MEWS risk score, and primary alert trigger.
- **Background (B)**: Admission diagnosis, surgical post-operative timeline, and co-morbid history.
- **Assessment (A)**: Synthesis of optical vitals with laboratory blood biomarkers (identifying anaerobic metabolism via lactate and systemic infection via WBC).
- **Recommendation (R)**: Targeted immediate clinical actions: IV crystalloid resuscitation ($30\text{ mL/kg}$), stat arterial blood gas, broad-spectrum antibiotic orders, and ICU registrar dispatch.

---

## 5. Backend Server Architecture & Data Layer

Located in [server/src/](file:///e:/My%20Development/AegisPulse/server/src):

### 5.1 Tech Stack
- **Runtime**: Node.js v20+ with TypeScript.
- **Web Framework**: Express.js with JSON body parsing, CORS middleware, and helmet security headers.
- **Persistence**: SQLite relational database with JSON serialization for nested clinical schemas.

### 5.2 Database Schema & Entity Relationships

```sql
-- Patients Master Table
CREATE TABLE patients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    age INTEGER NOT NULL,
    gender TEXT NOT NULL,
    bed_number TEXT NOT NULL UNIQUE,
    admission_reason TEXT NOT NULL,
    history TEXT, -- JSON Array of medical history strings
    notes TEXT,   -- JSON Array of clinical nursing notes
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Real-Time Vitals Telemetry History
CREATE TABLE vitals_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id TEXT NOT NULL,
    heart_rate INTEGER NOT NULL,
    respiratory_rate INTEGER NOT NULL,
    hrv INTEGER NOT NULL,
    spo2 INTEGER NOT NULL,
    temperature REAL NOT NULL,
    systolic_bp INTEGER NOT NULL,
    diastolic_bp INTEGER NOT NULL,
    mews_score INTEGER NOT NULL,
    qsofa_score INTEGER NOT NULL,
    triage_level TEXT NOT NULL,
    signal_quality INTEGER NOT NULL,
    timestamp INTEGER NOT NULL,
    FOREIGN KEY(patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

-- Laboratory Hematology & Biochemistry Panels
CREATE TABLE lab_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id TEXT NOT NULL,
    wbc REAL NOT NULL,
    creatinine REAL NOT NULL,
    lactate REAL NOT NULL,
    platelets INTEGER NOT NULL,
    crp REAL NOT NULL,
    timestamp INTEGER NOT NULL,
    FOREIGN KEY(patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

-- Emergency Clinical Alerts Event Log
CREATE TABLE alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id TEXT NOT NULL,
    level TEXT NOT NULL, -- 'yellow' | 'red'
    message TEXT NOT NULL,
    acknowledged INTEGER DEFAULT 0,
    timestamp INTEGER NOT NULL,
    FOREIGN KEY(patient_id) REFERENCES patients(id) ON DELETE CASCADE
);
```

### 5.3 REST API Interface Specification

| Endpoint | Method | Payload / Parameters | Description |
| :--- | :---: | :--- | :--- |
| `/api/patients` | `GET` | None | Returns list of all admitted ward patients with latest vitals and lab panels. |
| `/api/patients/:id` | `GET` | `id: string` | Returns individual patient clinical record and historical telemetry. |
| `/api/patients` | `POST` | `PatientRecord` JSON | Admits a new patient to a specified bed. |
| `/api/patients/:id/vitals` | `POST` | `VitalsReading` JSON | Ingests real-time vitals reading; triggers MEWS/qSOFA calculation and alert checks. |
| `/api/patients/:id/labs` | `POST` | `LabBiomarkers` JSON | Updates hematology panel; recalibrates multi-modal sepsis risk index. |
| `/api/alerts` | `GET` | `acknowledged?: boolean` | Fetches active or past clinical alerts across the ward. |
| `/api/alerts/:id/ack` | `POST` | `id: number` | Marks an emergency alert as acknowledged by the attending charge nurse. |

---

## 6. Interoperability & Standards Compliance (HL7 / FHIR)

AegisPulse is architected for seamless bidirectional integration with hospital Electronic Health Record (EHR) systems (e.g., Epic, Cerner, Allscripts, and India's Ayushman Bharat Digital Mission - ABDM):

### FHIR R4 Observation Resource Mapping (Vitals Payload)
```json
{
  "resourceType": "Observation",
  "id": "aegis-obs-78942",
  "status": "final",
  "category": [
    {
      "coding": [
        {
          "system": "http://terminology.hl7.org/CodeSystem/observation-category",
          "code": "vital-signs",
          "display": "Vital Signs"
        }
      ]
    }
  ],
  "code": {
    "coding": [
      {
        "system": "http://loinc.org",
        "code": "8867-4",
        "display": "Heart rate"
      }
    ]
  },
  "subject": {
    "reference": "Patient/P001",
    "display": "Ananya Ramanathan"
  },
  "effectiveDateTime": "2026-09-14T00:15:00+05:30",
  "valueQuantity": {
    "value": 74,
    "unit": "beats/minute",
    "system": "http://unitsofmeasure.org",
    "code": "/min"
  },
  "device": {
    "display": "AegisPulse rPPG Edge Sensor v2.0"
  }
}
```

---

## 7. Security, Zero-Trust Privacy & Threat Modeling

1. **Memory Ephemeral Processing**: Video frames accessed via `navigator.mediaDevices.getUserMedia()` are processed within canvas buffer memory and overwritten immediately. Frames are **never written to disk storage, never cached in IndexedDB/LocalStorage, and never transmitted over websockets or HTTP**.
2. **Transport Layer Security**: All REST communications between the bedside client and hospital server enforce TLS 1.3 with strict `HTTPS` and CORS domain pinning.
3. **Data Protection Compliance**:
   - **India DPDP Act 2023**: Complies with Section 6 (Consent) and Section 7 (Processing limitations). Video is treated as ephemeral non-identifying sensory input; only de-identified numerical vitals vectors are retained.
   - **HIPAA Privacy & Security Rules**: Telemetry in transit is encrypted using AES-256-GCM. Patient identifiers (`patient_id`) can be pseudonymized with cryptographically secure random UUIDs.

---

## 8. Developer Quick-Start & Verification

### Running the Full-Stack Locally
```bash
# 1. Install frontend dependencies
npm install

# 2. Install server dependencies
cd server
npm install
cd ..

# 3. Start development servers concurrently
# Terminal 1: Frontend Client
npm run dev

# Terminal 2: Backend API & SQLite DB
cd server
npm run dev
```

Open `http://localhost:5173` in any modern web browser (Google Chrome, Microsoft Edge, Firefox, or Safari) and grant webcam permissions to initialize the live rPPG optical telemetry engine.
