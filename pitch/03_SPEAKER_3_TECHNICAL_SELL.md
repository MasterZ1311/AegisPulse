# 🎤 SPEAKER 3 (YOU) — THE TECHNICAL ENGINE & THE CLOSE
### Role: Principal Engineer + Deal Closer
### Frameworks: Alex Hormozi Grand Slam Offer + Voss Negotiation + Technical Authority

---

> **DELIVERY NOTES:**
> You are the most dangerous person in this room right now — because you BUILT it.
> Slow down when you go technical. Let them feel the weight of each word.
> When you hit the close: lock eyes. No fidgeting. Silence is your friend.
> You are not asking permission. You are offering them the opportunity to be part of something.

---

## [OPENING — ESTABLISH AUTHORITY] *(~20 seconds)*

*(Walk forward. Brief pause. Speak at 70% of your normal speed.)*

"I am the engineer who built AegisPulse.

Not the prototype. Not the mockup. The system.

And I want to tell you three specific technical things — because I believe the technical decisions we made are what separate AegisPulse from every other well-intentioned health-tech idea that never made it out of a PowerPoint."

---

## [TECHNICAL PILLAR 1 — THE SCORING ENGINE] *(~60 seconds)*
### Hormozi: Dream Outcome — Show them EXACTLY what they get

"**Pillar One: Deterministic, Explainable Scoring.**

Every commercial AI health platform today is a black box. Neural network, confidence score, take it or leave it. Hospitals cannot adopt black boxes — because when a patient dies and the family's lawyer asks 'why did your system give a LOW score at 2 AM?' — you need an answer.

Our Attention Priority Score is fully deterministic. No hidden weights. No ML inference at runtime.

The formula:

```
APS = clamp(
  α · Vphysio(t) + β · Dtime(t) + γ · Smews(t) + δ · Lbiomarker(t),
  0, 100
)
```

Where:
  - Vphysio is multi-parameter physiological velocity — rate of change of HR, RR, and Shock Index
  - Dtime is Information Decay — a quadratic penalty for observational staleness
  - Smews is the Subbe MEWS normalized from its 0-14 scale to our 0-100 scale
  - Lbiomarker is laboratory chemistry stress markers including serum lactate and WBC

Every coefficient, every threshold, every weight — auditable. Reproducible. Defensible.

When a regulator or a clinician asks 'why did this patient score 88?' — we print the full breakdown in plain English, down to the exact millisecond of each contributing observation."

---

## [TECHNICAL PILLAR 2 — THE SENSING SAFETY SYSTEM] *(~45 seconds)*
### Hormozi: Perceived Likelihood — Show proof it actually works

"**Pillar Two: Zero-Fabrication Sensing.**

Here is what most camera-based health-tech startups get wrong. They point a camera at someone, run their algorithm, and report a number — regardless of signal quality.

That is medically dangerous. A fabricated heart rate of 72 BPM on a patient who has no face in frame is worse than no reading at all. It creates false confidence.

We solved this with a Face-First Sensing State Machine.

The camera pipeline has seven states: IDLE → DETECTING → VALIDATING → TRACKING → SENSING → OCCLUSION → FAILED.

The critical invariant: the system will only output physiological measurements in the TRACKING state — which requires a validated, continuously tracked face occupying a minimum bounding box area. The moment the face is lost, all buffers are purged, the patient's contactless readings are invalidated, and the system returns to IDLE.

We call this principle: 'When uncertain, prefer no measurement over a false measurement.'

We have 20 automated end-to-end regression tests that enforce this invariant on every code commit. If any test fails — no code ships.

The camera never lies. The algorithm never guesses."

---

## [TECHNICAL PILLAR 3 — THE ARCHITECTURE] *(~30 seconds)*
### The Infrastructure sell

"**Pillar Three: Production-Grade Architecture.**

AegisPulse is built as a multi-package TypeScript monorepo.

The signal processing package runs entirely in-browser — no patient video leaves the device. Privacy by architecture, not policy.

The API layer runs on Node.js with Zod-validated physiological schemas that reject invalid sensor telemetry at the data boundary. Garbage in, error out — never garbage in, fabricated vital out.

The frontend is a real-time React dashboard with WebSocket observation streaming, offline-first sync with monotonic UUID queuing, and a documented disaster recovery protocol.

Deployment is containerized via Docker Compose, scalable horizontally, and runs on a ₹15,000-per-month cloud VM that can handle a 500-bed hospital in real time.

We did not build a demo. We built infrastructure."

---

## [THE GRAND SLAM OFFER — HORMOZI FRAMEWORK] *(~45 seconds)*
### Dream Outcome + Perceived Likelihood + Time to Value + Effort Reduction

"Now let me tell you what you are actually getting.

**The Dream Outcome:** A ward nurse managing 40 patients gets a ranked priority queue, updated every 60 seconds, with plain-English clinical reasoning. She never misses a deteriorating patient because of a 4-hour observation gap. Code blue rates go down. Patient families go home with their grandfathers.

**Perceived Likelihood of Success:** We have a functioning system. Not a prototype. Not a Figma mockup. Working software, running now, with real-time monitoring, contactless sensing, and full clinical audit trails.

**Time to Value:** First-shift value. Not months of onboarding. A nurse opens the dashboard on shift start and within 30 minutes, her first high-priority card surfaces a patient she would not have visited for another 90 minutes. That is the moment of belief.

**Effort and Cost:** ₹500 to ₹1,500 per bed per month. No hardware. No installation team. No IT project. A tablet and a Wi-Fi password. That is the entire deployment."

---

## [THE CLOSE — VOSS NEGOTIATION TACTICS] *(~45 seconds)*
### Tactical Empathy + Labeling + Calibrated Questions + The Silence Close

*(Slow way down here. Measured. Confident.)*

"I want to acknowledge something.

Some of you in this room are probably thinking: 'This sounds good — but health tech is hard. Regulatory barriers. Hospital politics. Adoption problems.'

*(Pause. Let them feel heard.)*

That's a fair concern. And you're right that health tech is hard.

But here is the thing — the cost of *not solving this* is not abstraction. It's not a missed market opportunity. The cost is [Name]. It's the next grandfather. And the one after.

We are not asking you to take a leap of faith on unproven technology.

We are asking you to back a team that already built the product, already validated the science, and is already running it.

*(Calibrated question close — let silence do the work.)*

So the only question left — is whether you want to be the people who said yes when it mattered.

*(Stand completely still. Hold eye contact. Do not speak. Let them answer.)*"

---

## [FINAL HANDOFF TO Q&A] *(~10 seconds)*

"We are ready for your questions. All three of us."

*(Step back. Stand beside your team. Arms at sides. Calm.)*

---

## 📌 SPEAKER 3 — FULL TECHNICAL BACKUP

### The APS Formula — Know Every Term

```
APS(t) = clamp(α·Vphysio + β·Dtime + γ·Smews + δ·Lbiomarker, 0, 100)
```

| Term | Full Name | What It Measures |
|------|-----------|-----------------|
| `Vphysio` | Physiological Velocity | Rate of change of HR, RR, Shock Index per unit time |
| `Dtime` | Information Decay | Quadratic staleness penalty: grows as (t - t_last_obs)² |
| `Smews` | Subbe MEWS | Validated Modified Early Warning Score (0–14) |
| `Lbiomarker` | Biomarker Load | Serum lactate ≥ 2.0, WBC > 12,000 or < 4,000 |
| `α, β, γ, δ` | Weighting coefficients | Tunable per clinical protocol |
| `clamp(x, 0, 100)` | Normalization | Ensures APS always 0–100 — no overflow |

### Shock Index Formula
```
SI = HR / Systolic_BP
Normal: SI < 0.7
Concerning: 0.7 ≤ SI < 1.0
Critical: SI ≥ 1.0
```

### rPPG Signal Processing Pipeline
```
Camera Frame (33ms) 
  → Face Detection (MediaPipe BlazeFace, 50ms latency)
  → ROI Extraction (Forehead 35% of face height, Cheeks bilateral)
  → Skin Pixel Masking (HSV: H 0–25, S 40–70, V > 50)
  → POS/CHROM Algorithm (Plane Orthogonal to Skin / Chrominance)
  → 5-second sliding window FFT (0.67–3.0 Hz = 40–180 BPM)
  → Signal Quality Index (SQI) gating (< 0.6 → reject, no output)
  → Respiratory Rate from chest-frequency component (0.1–0.5 Hz)
```

### Face FSM States
```
IDLE → DETECTING → VALIDATING → TRACKING → SENSING
                                    ↓
                               OCCLUSION → IDLE (buffer purged)
                                    ↓
                                 FAILED → IDLE (patient invalidated)
```

### Information Decay Model
```
Dtime(t) = min(1.0, ((t - t_last) / T_decay)²) × W_decay

Where:
  t_last = timestamp of last confirmed observation
  T_decay = decay constant (default: 4 hours for ward protocol)
  W_decay = maximum weight of decay component in APS (default: 25 points)
```

### MEWS Scoring Table (Subbe 2001)
| Parameter | Score 3 | Score 2 | Score 1 | Score 0 | Score 1 | Score 2 | Score 3 |
|-----------|---------|---------|---------|---------|---------|---------|---------|
| Systolic BP | ≤70 | 71–80 | 81–100 | 101–199 | — | ≥200 | — |
| Heart Rate | — | ≤40 | 41–50 | 51–100 | 101–110 | 111–129 | ≥130 |
| Resp Rate | — | <9 | — | 9–14 | 15–20 | 21–29 | ≥30 |
| Temp (°C) | — | <35.0 | — | 35.0–38.4 | — | ≥38.5 | — |
| AVPU | — | — | — | Alert | Voice | Pain | Unresponsive |

**MEWS ≥ 5 = Consider ICU review**

---

## 🔥 CROSSFIRE PREP — Hardest Technical Questions

**Q: "rPPG has poor accuracy — studies show ±5 BPM error. How is that clinically useful?"**
> "Absolutely correct — single-point rPPG accuracy is ±4–6 BPM under controlled conditions, per Tarassenko et al. 2014. We do not use it as a diagnostic vital. We use it as a *velocity input* — the rate of change matters more than the absolute value. If rPPG shows HR trending from 72 to 91 over 20 minutes, the velocity signal is valid even if the absolute accuracy is ±5. The system flags the trend, not a diagnosis. And if quality is poor, we report nothing."

**Q: "Isn't MediaPipe BlazeFace too slow for real-time on mobile?"**
> "BlazeFace achieves 50ms inference latency on a mid-range 2022 Android phone — that is 20 frames per second of face tracking. For a 15-second spot-check, that is 300 frames. More than sufficient for rPPG signal extraction. We tested on a Snapdragon 695, which is below the average Indian mid-range device today."

**Q: "How do you validate your APS against clinical outcomes?"**
> "We are in the investigational phase. The APS engine uses clinically validated sub-components — MEWS has been validated in 40+ published studies. Our prospective clinical validation is the next phase, targeting a 300-patient pilot in a partner hospital. We do not claim diagnostic validation for the composite score today — we claim that it is better than no systematic prioritization, which is the current standard in under-resourced wards."

**Q: "Why not just use existing EWS software like SEND or eObs?"**
> "SEND and eObs require existing EHR integration, IT procurement cycles of 12–18 months, and significant per-installation fees. They are designed for NHS-level infrastructure. AegisPulse is designed to run with zero EHR dependency — on a tablet with a data SIM — in a district hospital in Tier 2 India that has never had any digital health system. Different problem space."

**Q: "What stops a hospital from copying your idea once they see it?"**
> "Three things: the physics of rPPG signal processing we have tuned specifically for Indian skin tone diversity and ward lighting conditions; the clinical logic embedded in our velocity and decay models that takes months to validate; and the trust relationship with nursing staff that we build during the pilot. Software is easy to copy. Trust is not."

**Q: "What is your regulatory pathway?"**
> "AegisPulse is currently classified as a Clinical Decision Support tool — not a medical device — under the CDSCO SaMD framework, consistent with FDA guidance on non-device CDS software. Our intended use is defined as: secondary prioritization support for registered nurses. We do not diagnose, prescribe, or treat. The regulatory pathway to CDSCO Class B SaMD certification is documented and is our 18-month post-pilot milestone."

**Q: "How do you handle data privacy — patient camera data?"**
> "Frame buffer is processed in volatile RAM at 33ms per frame and never stored to disk or transmitted. We use no biometric data storage, no cloud video streaming, no patient identification linked to facial geometry. The rPPG algorithm extracts a waveform — not an image. Privacy is architectural, not a policy claim."

---

## ⚡ NEGOTIATION PLAYBOOK (Voss Techniques)

### If judges push hard on a weakness:
> **Mirror:** Repeat their last 3 words as a question.
> "...accuracy concerns about rPPG?"
> *(Let them elaborate. More information is always better.)*

### If judges try to lowball or dismiss:
> **Label:** Name their concern before they finish.
> "It sounds like you're concerned about clinical adoption resistance..."
> *(They feel heard. Now you can address it.)*

### If judges challenge your market size:
> **Accusation Audit:** Disarm it preemptively.
> "You might be thinking our TAM numbers are optimistic — and that's fair. Here's the conservative case..."

### If judges make an offer or condition:
> **Calibrated Question:**
> "What would it take for you to feel confident about the clinical validation pathway?"
> *(Never accept the first frame. Make them define their own success criteria.)*

### The Final Silence Close:
> State your ask. Then stop talking.
> The first person who speaks after the ask, loses.
> You made your case. Let them decide.

---

*End of Speaker 3 Script*
