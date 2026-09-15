# AegisPulse: Face Detection, Tracking & Anatomical ROI Architecture

**Document Status:** AUTHORITATIVE COMPUTER VISION SPECIFICATION  
**Governing Standard:** `docs/SOURCE_OF_TRUTH.md`  
**Core Invariant:** Face-First Sensing — No face, no ROI, no signal buffer, zero fabricated vitals.

---

## 1. Architectural Overview

Contactless optical photoplethysmography (rPPG) extracts pulsatile blood volume variations by monitoring subtle skin chrominance fluctuations on the human face. In a hospital ward setting, camera sensing faces non-ideal conditions: varying illumination, subject movement, multiple individuals (nurses, visitors) in the camera field, and periods where the patient is absent or turned away.

AegisPulse enforces a **Face-First Invariant**:
$$\text{NO VALID FACE} \implies \text{NO VALID ROI} \implies \text{NO TEMPORAL ACCUMULATION} \implies \text{VITALS: NULL}$$

```
   [CAMERA VIDEO STREAM (30 FPS)]
                │
                ▼
   [TIER 1 / TIER 2 FACE DETECTOR]
                │
         ┌──────┴──────┐
         ▼             ▼
   [NO FACE]     [MULTIPLE FACES] ──> GATE OUTPUT (MULTIPLE_FACES_DETECTED)
         │
         ▼
   [ONE VALID FACE]
         │
         ▼
   [TEMPORAL FACE TRACKER (IoU & Centroid Proximity)]
         │
         ▼
   [PATIENT SESSION BINDING (SessionID + TrackingID)]
         │
         ▼
   [ANATOMICAL ROI EXTRACTION (Forehead 60%, Cheeks 20%/20%)]
         │
         ▼
   [SPATIAL RGB EXTRACTION (Volatile RAM Canvas)]
         │
         ▼
   [POS / CHROM rPPG PIPELINE & SPECTRAL FFT PSD]
```

---

## 2. Dual-Tier Face Detection Engine

To ensure universal compatibility across desktop workstations, ward laptops, and mobile phones (Android Chrome, iOS Safari) without requiring heavy 20MB neural networks or external CDNs, AegisPulse employs a **dual-tier face detector**:

### 2.1 Tier 1: Hardware-Accelerated Native FaceDetector
- Leverages the browser's native `window.FaceDetector` (Shape Detection API) when supported.
- Provides hardware-accelerated face bounding boxes at minimal CPU and battery cost.

### 2.2 Tier 2: Deterministic Edge Skin-Locus & Morphology Analyzer
- Operates on a lightweight 160×120 analysis grid in volatile client memory.
- Performs chromatic classification in the normalized YCbCr skin locus:
  $$Y = 0.299R + 0.587G + 0.114B$$
  $$Cb = -0.1687R - 0.3313G + 0.500B + 128$$
  $$Cr = 0.500R - 0.4187G - 0.0813B + 128$$
  $$\text{Skin Locus Criterion: } Cr \in [130, 175] \land Cb \in [75, 130] \land Y \ge 35$$
- Morphological aspect ratio check: Bounding box aspect ratio ($H/W$) must fall between $0.95$ and $1.95$.
- Skin density check: Minimum $35\%$ of bounding box pixels must satisfy the biological skin locus.
- Rejection of non-human objects: Purely orange or flat colored objects are rejected by facial contrast verification across eye/forehead luminance gradients.

---

## 3. Temporal Tracking & Face Freshness

Face bounding boxes from individual frames are never treated as persistent without temporal tracking.

### 3.1 Tracking Identity & IoU
- Active tracks are tracked using Intersection-over-Union (IoU) and centroid velocity:
  $$\text{IoU}(A, B) = \frac{\text{Area}(A \cap B)}{\text{Area}(A \cup B)} \ge 0.30$$
- Tracked identities are assigned persistent labels (`FACE-1`, `FACE-2`).

### 3.2 Stability & Motion Gating
- Frame-to-frame centroid displacement is tracked over a sliding 15-frame history.
- If normalized displacement exceeds $\Delta d > 0.06$, the frame is flagged as `MOTION_CONTAMINATED` and signal accumulation is suspended.

### 3.3 Face-Loss Timeout (500 ms)
- If a tracked face is not detected for $\ge 500\text{ ms}$:
  1. The tracking state transitions immediately to `FACE_LOST`.
  2. The temporal signal buffer is completely purged.
  3. Active vital estimates (`heartRate`, `respiratoryRate`) are invalidated (`null`).
  4. The 15-second spot-check countdown timer pauses.
  5. The UI displays `FACE LOST — POSITION PATIENT FACE IN RETICLE`.

---

## 4. Multi-Face Policy: Never Guess

In general ward environments, nurses, doctors, or family members frequently walk into camera view.

**Strict Policy:**
1. If $\ge 2$ distinct faces are detected in the sensing area, the system transitions to `MULTIPLE_FACES_DETECTED`.
2. Active measurements are halted immediately.
3. The UI highlights all detected faces in red reticles and displays:
   > *"Multiple faces detected. Ensure only the assigned patient is visible."*
4. The system never arbitrarily guesses the "largest" face or "closest" face.
5. Measurement resumes only when exactly one valid face is present and stable.

---

## 5. Anatomical ROI Extraction

The forehead provides the highest capillary density and thinnest epidermal barrier, making it the primary signal source for rPPG.

- **Forehead ROI**:
  - $X = \text{box.x} + \text{box.width} \times 0.25$
  - $Y = \text{box.y} + \text{box.height} \times 0.12$
  - $\text{Width} = \text{box.width} \times 0.50$
  - $\text{Height} = \text{box.height} \times 0.22$
- **Cheek ROIs**: Lateral mid-face quadrants avoiding nasal and oral areas.
- **Composite RGB**: Weighted spatial mean:
  $$\text{Composite} = 0.60 \times \text{Forehead} + 0.20 \times \text{LeftCheek} + 0.20 \times \text{RightCheek}$$

---

## 6. Privacy Guarantees

- **Zero Video Exfiltration**: Video frames are processed in volatile HTMLCanvasElement memory and destroyed within 33 ms (`ctx.clearRect`).
- **No Disk / Cloud Storage**: Raw frames, JPEG/PNG images, or video clips are never written to IndexedDB, LocalStorage, or transmitted over WebSockets/REST APIs.
- **Telemetry Boundary**: Only spatial mean scalars ($[R, G, B]$) and derived vitals ($HR, RR, SQI$) are transmitted.
