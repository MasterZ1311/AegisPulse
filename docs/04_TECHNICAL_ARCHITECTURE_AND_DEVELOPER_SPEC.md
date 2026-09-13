# AegisPulse: Technical Architecture & Developer Specification

**Positioning:** Patient Deterioration Radar & Nurse Attention Allocation Engine  
**Document Version:** 3.0  
**Status:** BINDING DEVELOPER & ARCHITECTURAL SPECIFICATION  
**Target Audience:** Senior Software Engineers, Systems Architects, Biomedical Engineers, Technical Judges  

---

## 1. Decoupled 5-Layer Domain Architecture

AegisPulse is engineered from decoupled domains with strict, unidirectional dependency boundaries:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   THE 5-LAYER DOMAIN TOPOLOGY                                    │
│                                                                                                  │
│  [LAYER 1: SENSORY INGESTION]                                                                    │
│  ├── navigator.mediaDevices.getUserMedia() (Hardware Webcams / Tablets)                         │
│  ├── HTML5 Off-Screen Canvas Buffering (Volatile RAM Enclave)                                   │
│  └── Dynamic Forehead ROI Crop (30% W × 18% H)                                                   │
│                                    │                                                             │
│                                    ▼                                                             │
│  [LAYER 2: DIGITAL SIGNAL PROCESSING (DSP)]                                                      │
│  ├── Plane-Orthogonal-to-Skin (POS) Chrominance Extraction (Wang et al., 2017)                   │
│  ├── 4th-Order Zero-Phase Butterworth Bandpass Filter (0.75 Hz – 3.33 Hz / 45–200 BPM)           │
│  ├── Dynamic First-Derivative Zero-Crossing Peak Detection (IBI Extraction)                      │
│  ├── Parasympathetic Autonomic Tone via RMSSD (HRV)                                             │
│  └── Real-Time Spectral Signal Quality Index (SQI Calculation)                                   │
│                                    │                                                             │
│                                    ▼                                                             │
│  [LAYER 3: CLINICAL INFERENCE ENGINE]                                                            │
│  ├── Deterministic Modified Early Warning Score (MEWS 0–14)                                      │
│  ├── Sepsis-3 quick Sequential Organ Failure Assessment (qSOFA 0–3)                             │
│  ├── Shock Index Calculation (SI = Heart Rate / Systolic BP)                                     │
│  └── Multi-Modal Laboratory Synthesis (Serum Lactate, WBC, Creatinine)                           │
│                                    │                                                             │
│                                    ▼                                                             │
│  [LAYER 4: ATTENTION RADAR & DECAY ENGINE]                                                       │
│  ├── Physiological Velocity Vector Processor (dHR/dt, dRR/dt, dSI/dt)                            │
│  ├── Information Decay Clock (Time Elapsed Since Verified Bedside Check)                         │
│  ├── Attention Priority Score (APS: 0–100) Formulation                                           │
│  └── Deterministic "WHY NOW" Clinical Reasoning Generator                                       │
│                                    │                                                             │
│                                    ▼                                                             │
│  [LAYER 5: PRESENTATION & ACTION LAYER]                                                          │
│  ├── React 19 / Tailwind CSS v4 Real-Time Ward Radar Queue                                       │
│  ├── Explainable "WHY NOW" Drawer with Human Action Checklists                                   │
│  ├── 60 FPS HTML5 Canvas Arterial Pulse Oscilloscope                                            │
│  ├── 15-Second Guided Spot-Check Reticle with Circular Countdown & SQI Gating                   │
│  └── Automated SBAR Clinical Handoff Dossier Generator                                           │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Data Contracts (`src/lib/types.ts`)

```typescript
// --- 1. Patient Master Record ---
export interface Patient {
  id: string;
  name: string;
  age: number;
  gender: 'M' | 'F' | 'Other';
  bedNumber: string;
  admissionDiagnosis: string;
  admissionTimestamp: number;
  baselineMEWS: number;
  history: string[];
}

// --- 2. Physiological Observation Record ---
export interface PhysiologicalObservation {
  id: string;
  patientId: string;
  timestamp: number;
  source: 'OPTICAL_RPPG' | 'NURSE_MANUAL' | 'BEDSIDE_DEVICE' | 'SIMULATION';
  confidence: number; // 0.0 to 1.0 (SQI)
  heartRate?: number;
  respiratoryRate?: number;
  hrv?: number;       // RMSSD in ms
  systolicBP?: number;
  diastolicBP?: number;
  temperature?: number;
  avpu?: 'A' | 'V' | 'P' | 'U';
}

// --- 3. Laboratory Biomarker Record ---
export interface LabBiomarkerRecord {
  patientId: string;
  timestamp: number;
  lactate?: number;       // mmol/L (Critical > 2.0)
  wbc?: number;           // x10^9/L (Critical < 4.0 or > 12.0)
  creatinine?: number;    // mg/dL
  platelets?: number;     // x10^9/L
}

// --- 4. Trajectory & Velocity Vector ---
export interface TrendVector {
  patientId: string;
  hrVelocity: number;        // % change per hour (dHR/dt)
  rrVelocity: number;        // % change per hour (dRR/dt)
  shockIndexCurrent: number;   // HR / Systolic BP
  shockIndexTrend: 'STABLE' | 'RISING' | 'FALLING';
  mewsDelta: number;         // Change in MEWS over last 2 hours
  trajectoryDirection: 'IMPROVING' | 'STABLE' | 'DECOMPENSATING' | 'RAPID_CRASH';
}

// --- 5. The Master Attention Assessment ---
export interface AttentionAssessment {
  patientId: string;
  bedNumber: string;
  apsScore: number;           // 0 to 100
  priorityCategory: 'LOW' | 'WATCH' | 'EVALUATE' | 'CRITICAL_REVIEW';
  wardRank: number;           // 1 to N
  whyReasons: string[];       // 3-5 explicit physiological bullet points
  signalConfidence: number;   // 0% to 100%
  timeSinceLastObservationMs: number; // Information decay duration
  recommendedAction: string;  // Explicit human verification step
  sbarAvailable: boolean;
  lastUpdated: number;
}
```

---

## 3. Digital Signal Processing & The 15-Second Optical Spot-Check

Located in `src/lib/rppgEngine.ts`:

### 3.1 Frame Capture & ROI Spatial Averaging
Frames are captured at 30 FPS via `navigator.mediaDevices.getUserMedia()`. An off-screen canvas crops the dynamic forehead Region of Interest (ROI):
$$\text{ROI} = [0.35W \to 0.65W, 0.15H \to 0.33H]$$
Mean chromatic channels ($\mu_R, \mu_G, \mu_B$) are accumulated per frame.

### 3.2 The Plane-Orthogonal-to-Skin (POS) Algorithm
To cancel specular reflections and skin tone biases, temporal color signals over a sliding window ($L = 45\text{ frames}$) are projected onto two orthogonal axes perpendicular to the physiological skin reflection vector:
$$P_x(t) = 3 \cdot R_n(t) - 2 \cdot G_n(t)$$
$$P_y(t) = 1.5 \cdot R_n(t) + G_n(t) - 1.5 \cdot B_n(t)$$
$$S_{\text{POS}}(t) = P_x(t) - P_y(t)$$

### 3.3 Zero-Phase 4th-Order Butterworth Filter
The raw POS signal is filtered between $0.75\text{ Hz}$ ($45\text{ BPM}$) and $3.33\text{ Hz}$ ($200\text{ BPM}$):
$$H(z) = \frac{b_0 + b_1 z^{-1} + b_2 z^{-2} + b_3 z^{-3} + b_4 z^{-4}}{1 + a_1 z^{-1} + a_2 z^{-2} + a_3 z^{-3} + a_4 z^{-4}}$$

### 3.4 Real-Time Signal Quality Index (SQI)
SQI is calculated from the power spectral density (PSD) of the filtered signal:
$$\text{SQI} = \frac{P_{\text{cardiac peak}} \pm 0.2\text{ Hz}}{P_{\text{total bandpass } (0.75\text{–}3.33\text{ Hz})}} \times 100\%$$
- $\text{SQI} \ge 75\%$: `TRUSTED` signal.
- $50\% \le \text{SQI} < 75\%$: `DEGRADED` signal (amber warning).
- $\text{SQI} < 50\%$: `UNRELIABLE` signal (spot-check countdown pauses; displays *"Stabilizing..."*).

---

## 4. The Attention Priority Score (APS) Engine

Located in `src/lib/attentionCalculator.ts`:

### 4.1 The Attention Formula
$$APS = \min\left(100, \, w_v \cdot V_{\text{physio}} + w_d \cdot D_{\text{time}} + w_m \cdot S_{\text{mews}} + w_l \cdot L_{\text{biomarker}}\right)$$

Default Weights: $w_v = 0.35, w_d = 0.25, w_m = 0.25, w_l = 0.15$.

1. **Physiological Velocity ($V_{\text{physio}} \in [0, 100]$)**:
   - Evaluates $\Delta \text{HR}/\Delta t$ (% acceleration per hour).
   - Evaluates $\Delta \text{RR}/\Delta t$ (% tachypnea drift per hour).
   - Evaluates $\Delta \text{Shock Index}$ ($\Delta (\text{HR}/\text{SBP})$).
2. **Information Decay ($D_{\text{time}} \in [0, 100]$)**:
   $$D_{\text{time}} = \min\left(100, \, \left(\frac{t_{\text{elapsed}}}{4\text{ hours}}\right)^2 \times 60 \times (1 - \text{Confidence})\right)$$
   *(At 4 hours without observation, $D_{\text{time}} \ge 60$, forcing the bed to escalate).*
3. **Clinical MEWS Baseline ($S_{\text{mews}} \in [0, 100]$)**:
   $$S_{\text{mews}} = \frac{\text{MEWS Score}}{14} \times 100$$
4. **Biomarker Evidence ($L_{\text{biomarker}} \in [0, 100]$)**:
   - Serum Lactate $> 2.0\text{ mmol/L} \implies +60\text{ points}$.
   - WBC $< 4.0\text{ or } > 12.0 \times 10^9/\text{L} \implies +40\text{ points}$.

### 4.2 Deterministic "WHY NOW" Generator
Generates plain-English clinical bullet points directly from active triggers:
```typescript
export function generateWhyReasons(
  trends: TrendVector,
  observationAgeMs: number,
  labs?: LabBiomarkerRecord,
  mewsScore?: number
): string[] {
  const reasons: string[] = [];
  
  if (trends.hrVelocity > 15) {
    reasons.push(`Tachycardia Acceleration: Heart Rate spiked +${Math.round(trends.hrVelocity)}% over past hour.`);
  }
  if (trends.rrVelocity > 20) {
    reasons.push(`Respiratory Drift: Tachypnea accelerating +${Math.round(trends.rrVelocity)}% over baseline.`);
  }
  if (trends.shockIndexCurrent > 0.9) {
    reasons.push(`Shock Index Alert: HR/SBP ratio is ${trends.shockIndexCurrent.toFixed(2)} (High Risk > 0.90).`);
  }
  
  const hoursSinceCheck = observationAgeMs / (1000 * 60 * 60);
  if (hoursSinceCheck >= 3.0) {
    const hours = Math.floor(hoursSinceCheck);
    const mins = Math.floor((hoursSinceCheck - hours) * 60);
    reasons.push(`Information Decay: No verified bedside check for ${hours}h ${mins}m.`);
  }
  
  if (labs?.lactate && labs.lactate > 2.0) {
    reasons.push(`Biochemical Stress: Serum Lactate elevated at ${labs.lactate} mmol/L (Tissue Hypoperfusion).`);
  }
  if (mewsScore && mewsScore >= 4) {
    reasons.push(`Elevated MEWS Baseline: Current score is ${mewsScore}/14.`);
  }
  
  return reasons;
}
```

---

## 5. Backend Database Schema (SQLite)

Located in `server/src/db.ts`:

```sql
-- Patients Master Record
CREATE TABLE IF NOT EXISTS patients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    age INTEGER NOT NULL,
    gender TEXT NOT NULL,
    bed_number TEXT NOT NULL UNIQUE,
    admission_diagnosis TEXT NOT NULL,
    admission_timestamp INTEGER NOT NULL,
    baseline_mews INTEGER DEFAULT 0,
    history TEXT, -- JSON Array
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Physiological Observations with Quality & Provenance
CREATE TABLE IF NOT EXISTS observations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    source TEXT NOT NULL, -- 'OPTICAL_RPPG' | 'NURSE_MANUAL' | 'BEDSIDE_DEVICE' | 'SIMULATION'
    confidence REAL NOT NULL, -- SQI (0.0 to 1.0)
    heart_rate INTEGER,
    respiratory_rate INTEGER,
    hrv INTEGER,
    systolic_bp INTEGER,
    diastolic_bp INTEGER,
    temperature REAL,
    avpu TEXT,
    FOREIGN KEY(patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

-- Laboratory Biomarkers
CREATE TABLE IF NOT EXISTS lab_biomarkers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    lactate REAL,
    wbc REAL,
    creatinine REAL,
    platelets INTEGER,
    FOREIGN KEY(patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

-- Attention Priority Score Audit History
CREATE TABLE IF NOT EXISTS attention_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    aps_score INTEGER NOT NULL,
    priority_category TEXT NOT NULL,
    ward_rank INTEGER NOT NULL,
    why_reasons TEXT NOT NULL, -- JSON Array
    acknowledged_by TEXT,
    FOREIGN KEY(patient_id) REFERENCES patients(id) ON DELETE CASCADE
);
```

---

## 6. Zero-Trust Privacy Implementation

1. **Volatile RAM Only**:
   - Canvas buffers allocated via `document.createElement('canvas')` exist strictly in memory.
   - Zero calls to `fs.writeFileSync()` or image data export APIs (`toDataURL`, `toBlob`).
   - Frame buffers are overwritten every $33.3\text{ ms}$.
2. **Telemetry Only Egress**:
   - The network payload transmitted from the bedside client to the server is de-identified JSON:
   ```json
   {
     "patientId": "P003",
     "timestamp": 1726278000000,
     "source": "OPTICAL_RPPG",
     "confidence": 0.94,
     "heartRate": 96,
     "respiratoryRate": 22,
     "hrv": 38
   }
   ```
   Total payload size: **$< 150\text{ bytes}$**.
