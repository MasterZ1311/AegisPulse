# 📚 TECHNICAL DEFINITIONS & FORMULAS CHEATSHEET
### For Speaker 2 & Speaker 3 — Exam-Ready Reference

> Memorize these. Be able to define any term from memory in 20 seconds or less.
> Sections marked [S2] are Speaker 2's domain. [S3] is Speaker 3's domain. [BOTH] = anyone may be asked.

---

## PART A — CLINICAL DEFINITIONS [S2 + BOTH]

### Modified Early Warning Score (MEWS) [BOTH]
**What it is:** A validated, point-based scoring system that combines five physiological parameters to identify patients at risk of clinical deterioration.
**Validated by:** Subbe et al., QJMed 2001 — the foundational validation paper.
**Parameters:** Systolic Blood Pressure, Heart Rate, Respiratory Rate, Temperature, AVPU neurological score.
**Score range:** 0 to 14.
**Clinical thresholds:**
- 0–2: Routine monitoring
- 3–4: Increased monitoring, nursing assessment
- 5+: Medical review required; consider ICU referral
**Key insight:** A MEWS score of 5 or above carries a 7.6-fold increase in risk of ICU admission or death within 24 hours.

---

### qSOFA (Singer 2016) [S2]
**What it is:** Quick Sequential Organ Failure Assessment — 3-parameter bedside sepsis screening tool.
**Parameters:**
- Respiratory Rate ≥ 22 breaths/min = 1 point
- Altered mentation (GCS < 15) = 1 point
- Systolic BP ≤ 100 mmHg = 1 point
**Score range:** 0 to 3.
**Clinical meaning:** Score ≥ 2 associated with in-hospital mortality > 10%. Triggers sepsis workup.
**Key distinction from MEWS:** qSOFA is specifically a sepsis screen. MEWS is a general deterioration tool. AegisPulse uses both.

---

### Shock Index (SI) [S3]
**Formula:** `SI = Heart Rate / Systolic Blood Pressure`
**Normal:** SI < 0.7
**Concerning:** 0.7 ≤ SI < 1.0 (tissue hypoperfusion risk)
**Critical:** SI ≥ 1.0 (hemodynamic compromise probable)
**Clinical use:** SI > 1.0 at ED presentation correlates with 10x increased in-hospital mortality (Cannon et al. 2009, JAMA).
**Why AegisPulse uses it:** Shock index can be elevated even when individual vital signs appear "normal" — the ratio catches compensated shock that single-parameter thresholds miss.

---

### SBAR [S2]
**What it stands for:** Situation, Background, Assessment, Recommendation
**Purpose:** Standardized clinical communication framework for handover and escalation.
**Origin:** Adapted from US Navy nuclear submarine communication protocol by Kaiser Permanente healthcare system.
**How AegisPulse uses it:** Automatically generates structured SBAR text when a patient reaches CRITICAL_REVIEW priority, allowing the nurse to send a complete clinical handover to the on-call physician in one tap.

---

### Attention Priority Score (APS) [BOTH]
**What it is:** AegisPulse's proprietary composite deterioration index, normalized 0–100.
**Formula:**
```
APS(t) = clamp(α·Vphysio + β·Dtime + γ·Smews + δ·Lbiomarker, 0, 100)
```
**Triage bands:**
| Score | Band | Action Required |
|-------|------|----------------|
| 0–29 | LOW | Routine 4-hour rounds |
| 30–59 | MODERATE | Reassess within 60 min |
| 60–79 | HIGH | Bedside within 20 min |
| 80–100 | CRITICAL_REVIEW | Immediate response |

---

## PART B — SENSING & SIGNAL PROCESSING DEFINITIONS [S3]

### rPPG — Remote Photoplethysmography [S3]
**What it is:** Optical measurement of blood volume pulse changes in superficial skin tissue using standard camera sensors, without physical contact.
**Physics basis:** Blood absorbs green light (~530nm) more than surrounding tissue. As the heart pumps, skin blood volume oscillates at the cardiac frequency, causing subtle (~0.1–2%) color intensity variations measurable in video.
**Algorithm we use:** POS (Plane Orthogonal to Skin — Wang et al., IEEE TBME 2017) and CHROM (Chrominance-based — De Haan et al., IEEE TBME 2013).
**Output:** Heart Rate (BPM) from dominant frequency in 0.67–3.0 Hz band.

---

### Signal Quality Index (SQI) [S3]
**What it is:** A real-time metric quantifying the reliability of the extracted rPPG waveform.
**Scale:** 0.0 (noise floor) to 1.0 (clean, high-confidence signal).
**Our threshold:** SQI < 0.6 → system withholds output. No fabrication.
**How it's computed:** Signal-to-noise ratio of the dominant spectral peak vs. surrounding frequency content in the FFT window.
**Clinical importance:** A reading with SQI = 0.4 and HR = 72 BPM is meaningless noise. A reading with SQI = 0.85 and HR = 72 BPM carries clinical trend value.

---

### Face Detection — BlazeFace [S3]
**What it is:** MediaPipe BlazeFace is a lightweight deep-learning face detection model optimized for mobile inference.
**Architecture:** Single-shot detector with anchor-based bounding box regression.
**Inference speed:** ~50ms on mid-range Android (Snapdragon 695); ~25ms on newer hardware.
**Output:** Bounding box coordinates (x, y, width, height), 6 facial landmark keypoints, detection confidence score.
**Our threshold:** Minimum bounding box area ≥ 3% of frame area to be considered a valid detection.

---

### Face Tracking — IoU [S3]
**IoU = Intersection over Union**
**Formula:** `IoU = (Area of Overlap) / (Area of Union) between two bounding boxes`
**Our threshold:** IoU ≥ 0.30 between consecutive frames to count as same tracked identity.
**Purpose:** Prevents identity switching — if face blinks out and comes back, IoU check confirms it's the same patient before resuming measurement.

---

### ROI — Region of Interest [S3]
**What it is:** The specific sub-region of the face frame from which rPPG signal is extracted.
**Why not full face:** Lips, eyes, and facial hair introduce non-blood-volume color variation noise.
**Our ROIs:**
- **Forehead:** Top 35% of face bounding box height, centered horizontally — highest signal quality, minimal motion from expression.
- **Bilateral cheeks:** Lower third of face, 20% width each side — secondary validation signal.

---

### Physiological Velocity (Vphysio) [S3]
**What it is:** The rate of change of a vital sign over a defined time window.
**Formula:**
```
V(param, t) = (param(t) - param(t - Δt)) / Δt
```
Where Δt is configurable: 15-minute, 30-minute, or 60-minute windows.
**Clinical significance:** A heart rate of 98 BPM is borderline-normal in isolation. A heart rate that rose from 74 to 98 BPM in 30 minutes (velocity: +0.8 BPM/min) is a red flag regardless of the absolute value.

---

### Information Decay (Dtime) [S3]
**What it is:** A quadratic penalty applied to a patient's APS score for every unit of time since their last verified observation.
**Formula:**
```
Dtime(t) = min(1.0, ((t - t_last) / T_decay)²) × W_decay
```
**Parameters:**
- `T_decay` = 4 hours (standard ward round interval)
- `W_decay` = maximum 25 APS points contributed by decay
**Behavior:** Starts near zero, rises slowly, accelerates toward the 4-hour mark — creating urgency proportional to observational staleness.
**Clinical rationale:** A patient unvisited for 3.5 hours in a ward with 4-hour rounds is nearly as dangerous as a patient with abnormal vitals — because you don't know.

---

### Sensing State Machine — FSM [S3]
**What it is:** A finite state machine that governs all transitions of the optical sensing pipeline.
**States:**
```
IDLE → DETECTING → VALIDATING → TRACKING → SENSING
                                     ↓
                                OCCLUSION (face lost temporarily)
                                     ↓
                                  FAILED (persistent loss → invalidate)
                                     ↓
                                   IDLE (buffer purged)
```
**Critical invariant:** Physiological output is ONLY permitted in TRACKING state.
**Buffer purge:** On entering OCCLUSION or FAILED, all accumulated rPPG signal buffers are cleared for that patient ID. Cross-patient contamination is architecturally prevented.

---

## PART C — ARCHITECTURE DEFINITIONS [S3]

### Monorepo [S3]
**What it is:** A single version-controlled repository containing multiple distinct packages/applications with shared tooling, dependencies, and testing infrastructure.
**Why we use it:** Allows signal processing code to be shared between the browser frontend and the API backend without duplication. One test suite covers the full signal pipeline.

### WebSocket [S3]
**What it is:** A persistent, bidirectional communication protocol between client and server. Unlike HTTP (request-response), WebSocket allows the server to push data to clients in real time.
**AegisPulse use:** The API server pushes new observation data to all connected dashboard clients within 100ms of a new reading being ingested. This enables the live ward radar.

### Zod Schema Validation [S3]
**What it is:** A TypeScript-first runtime schema validation library. Defines the exact shape and constraints of data objects, validated at runtime.
**AegisPulse use:** All physiological observations submitted to the API are validated against Zod schemas before storage. A heart rate of 999 BPM, a SpO2 of 110%, or a null respiratory rate from a failed camera — all are rejected at the API boundary with a structured error. No invalid data enters the clinical database.

### UUID — Monotonic Ordering [S3]
**What it is:** Universally Unique Identifiers generated with a monotonically increasing timestamp component to guarantee chronological ordering even without network connectivity.
**AegisPulse use:** Offline observations are queued with monotonic UUIDs. When connectivity restores, observations are synced in exact original clinical timestamp order, regardless of when they were uploaded. This preserves the clinical timeline.

### Docker / Containerization [S3]
**What it is:** A platform that packages applications and their dependencies into isolated, reproducible containers that run identically across any environment.
**AegisPulse deployment:** The API service, web frontend, and database each run in separate containers orchestrated by Docker Compose. Entire hospital deployment is a single `docker-compose up` command on a ₹15,000/month VM.

---

## PART D — WHAT WE EXPLICITLY DO NOT CLAIM [BOTH — CRITICAL]

> **Every member of the team must know these limits. A judge who catches you overclaiming will destroy your credibility.**

| Prohibited Claim | Why It's Prohibited | What to Say Instead |
|-----------------|--------------------|--------------------|
| "We can measure SpO2 contactlessly" | Physically impossible with ambient RGB cameras — requires near-infrared at 660nm/940nm | "Our optical sensing measures heart rate and respiratory rate. SpO2 requires dedicated IR hardware." |
| "We can measure blood pressure contactlessly" | Not validated from facial video alone in any peer-reviewed clinical study | "Blood pressure requires a cuff or validated tonometry sensor. We track shock index as a proxy." |
| "AegisPulse can diagnose sepsis / cardiac arrest / MI" | This is an autonomous diagnostic claim — violates SaMD regulations and our product constitution | "AegisPulse flags deterioration trends and generates an SBAR brief. Diagnosis is made by the clinician." |
| "Our system has 96% accuracy in clinical trials" | We have no completed prospective clinical trial — do not fabricate n values | "We are in pre-clinical pilot phase. Our sub-components are individually validated by published literature." |
| "AI-powered diagnosis" | We use no LLM or neural network in the clinical scoring loop | "Our scoring is deterministic and fully explainable. Every coefficient is auditable." |

---

*End of Technical Definitions Cheatsheet*
*Study this until you can answer any question cold, in 30 seconds, without notes.*
