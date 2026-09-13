# AegisPulse: Slide-by-Slide Master Presentation Deck

**Positioning:** Patient Deterioration Radar & Nurse Attention Allocation Engine  
**Event:** VMedithon 3.0 — School of Computer Science & Engineering (SCOPE), VIT Chennai  
**Track:** Software Innovation, Clinical AI & Academic Paper Publication Track  
**Time Limit:** 3 – 5 Minutes + Jury Q&A  
**Presenter:** Thenappan T & The AegisPulse Team  

---

## 📊 Slide Deck Overview

| Slide # | Slide Title | Core Focus | Target Duration |
| :--- | :--- | :--- | :--- |
| **01** | **Title Slide & The Core Thesis** | The Attention Engine Identity | 20s |
| **02** | **The Crisis: Nurse Attention Scarcity** | 1:40 Nurse Ratio & The 4-Hour Blindspot | 30s |
| **03** | **The Solution: AegisPulse Radar** | "Who needs the nurse next, and why?" | 25s |
| **04** | **The Attention Priority Score (APS)** | Velocity + Information Decay + MEWS + Labs | 35s |
| **05** | **The 15-Second Optical Spot-Check** | Bounded rPPG via POS with Live SQI | 30s |
| **06** | **The "WHY NOW" Explainability Engine**| Transparent Clinical Reasoning vs. Black Box | 25s |
| **07** | **Closed-Loop Action: Automated SBAR** | Translating Risk into Instant Medical Briefs | 25s |
| **08** | **Live System Demo & Triage Injection**| Proof of Work: Bed 03 Deterioration | 40s |
| **09** | **Safety, Truth & Privacy Invariants** | Volatile RAM Only, No Fake SpO2/BP | 25s |
| **10** | **Health Economics & Phased Scaling** | Attention ROI: Chennai $\to$ TN $\to$ India | 20s |
| **11** | **Academic Roadmap & Staged Milestones**| SCOPE Mentorship & Engineering Timeline | 15s |
| **12** | **Conclusion & Final Punchline** | "Not more alarms. Just better attention." | 15s |

---

## 🖥️ Detailed Slide-by-Slide Content & Speaker Script

---

### SLIDE 1: Title & The Core Thesis
- **Slide Headline:** **AEGISPULSE**
- **Subtitle:** Patient Deterioration Radar & Nurse Attention Allocation Engine
- **Badge / Category:** VMedithon 3.0 | Biology × Engineering | Software Innovation Track
- **Presenter Info:** Thenappan T (Systems Architect & Lead) | Sathyabama Institute of Science and Technology (SIST)
- **Visual Suggestion:** Dark medical UI background (`#060a12`), glowing cyan Attention Priority radar reticle, dynamic priority queue cards (Bed 03 highlighted in Red).
- **Key Tagline:** *"In general hospital wards, the scarce resource is not data, but clinician attention. We tell the nurse who to visit next, and why."*

#### 🎙️ Spoken Script (20 seconds):
> *"Good morning respected judges. I am Thenappan, and today we present **AegisPulse**—a Patient Deterioration Radar and Nurse Attention Allocation Engine that solves the acute nurse staffing crisis in general hospital wards by dynamically answering: Which patient needs the nurse's attention next, and why?"*

---

### SLIDE 2: The Healthcare Crisis — The Scarcity of Clinician Attention
- **Slide Headline:** The Real Ward Bottleneck: Nurse Attention Rationing
- **Key Statistics (Big Callout Numbers):**
  - **1:40**: The acute night-shift nurse-to-patient ratio in public hospital wards across India (vs. WHO mandate 1:3).
  - **90 Seconds**: The maximum attention a nurse can physically dedicate to each patient per hour.
  - **85% – 99%**: Of acoustic alarms on traditional monitors are clinically non-actionable false alarms.
  - **4 – 6 Hours**: The average time interval between manual nurse rounds, creating multi-hour dead zones.
- **The Core Problem Breakdown:**
  - **The "Isolated Normal" Fallacy**: Compensatory physiology masks decline. Patients maintain "normal" vitals until an acute cliff.
  - **Information Decay**: The longer a bed sits unvisited, the higher the clinical uncertainty.
  - **Alarm Fatigue**: Adding 40 beeping monitors causes nurses to desensitize and mute alarms.

#### 🎙️ Spoken Script (30 seconds):
> *"In general hospital wards across the world, one nurse cares for 30 to 40 patients. She has 60 minutes in an hour. She cannot continuously reassess everyone. Every health tech startup promises 40 continuous monitors, but head nurses will tell you that creates deafening alarm fatigue. The scarce resource isn't patient data—it's nurse attention. When vitals are checked once every four hours, patients silently deteriorate between rounds."*

---

### SLIDE 3: The Solution — AegisPulse Deterioration Radar
- **Slide Headline:** A Dynamic Priority Queue for Clinical Attention
- **Core Value Proposition:**
  1. **Dynamic Attention Queue**: Ranks all ward beds in real-time ($1\text{ to }N$) based on acute need for bedside presence.
  2. **Multi-Vector Synthesis**: Combines physiological velocity, information decay, clinical baseline (MEWS), and lab biomarkers.
  3. **Explainable "WHY NOW" Cards**: Replaces black-box scores with clear, auditable physiological bullet points.
  4. **Closed-Loop Action**: Connects attention allocation directly to a 15-second bedside spot-check and automated SBAR referrals.
- **Visual Suggestion:** Split screen: Left side shows traditional chaotic beeping ward with 40 equal beds; Right side shows AegisPulse cleanly sorted priority list with Bed 03 at Rank #1 (APS 91).

#### 🎙️ Spoken Script (25 seconds):
> *"AegisPulse reframes the entire problem. We don't flood nurses with raw numbers. Instead, our Attention Allocation Engine continuously estimates which patient is on the steepest downward trajectory, places them at the top of the nurse's priority queue, and gives them an explainable reason to act immediately."*

---

### SLIDE 4: The Attention Priority Score (APS) Engine
- **Slide Headline:** The Mathematical Formula: Velocity + Information Decay
- **The 4 Conceptual Pillars of the Score ($APS \in [0, 100]$):**
  - **1. Physiological Velocity ($V_{\text{physio}}$)**: Evaluates rate-of-change ($\Delta \text{HR}/\Delta t$, $\Delta \text{RR}/\Delta t$, and Shock Index trend). Catches the compensatory spike before the cliff!
  - **2. Information Decay ($D_{\text{time}}$)**: Mathematically formalizes clinical uncertainty: $(t_{\text{elapsed}} / 4\text{h})^2 \times (1 - \text{SQI})$. The longer a bed sits unobserved, the higher its priority climbs!
  - **3. Clinical Baseline ($S_{\text{mews}}$)**: Validated Modified Early Warning Score matrix (0 to 14).
  - **4. Biochemical Evidence ($L_{\text{biomarker}}$)**: Flags cellular stress from lab panels (Serum Lactate $> 2.0\text{ mmol/L}$, elevated WBC).
- **Visual Suggestion:** Clean mathematical formula diagram showing the 4 weighted vectors converging into the final $0\text{–}100$ score.

#### 🎙️ Spoken Script (35 seconds):
> *"How does the Attention Priority Score work? It is 100% deterministic math based on four vectors: First, Physiological Velocity—measuring how fast heart rate and respiration are accelerating. Second, Information Decay—the longer a bed sits unobserved, the higher its uncertainty penalty. Third, validated clinical MEWS baseline. And fourth, biochemical stress like serum lactate. A patient whose heart rate jumped 20% in 30 minutes gets flagged immediately, even if their number is still technically 'normal'."*

---

### SLIDE 5: The 15-Second Optical Bedside Spot-Check
- **Slide Headline:** Optical rPPG as a Bounded, Calibrated Sensing Modality
- **Why We Rejected 24/7 Continuous Video Cameras:**
  - Hospitals are dark at night ($< 30\text{ lux}$); patients sleep under blankets; continuous cameras provoke severe privacy resistance.
- **The 15-Second Guided Spot-Check Paradigm:**
  - Occurs during active nurse bedside rounds. Lights are on, and the patient is stationary.
  - Plane-Orthogonal-to-Skin (POS) rPPG tracks green capillary absorbance ($540\text{ nm}$) on the forehead.
  - **Signal Quality Index (SQI)**: Real-time confidence meter gates the reading. If the patient moves, the system pauses.
  - Locks in Heart Rate and Respiratory Rate in 15 seconds, resetting Information Decay to zero ($D_{\text{time}} = 0$).
- **Visual Suggestion:** Tablet mockup showing the circular 15-second countdown reticle, green arterial pulse trace, and 94% SQI badge.

#### 🎙️ Spoken Script (30 seconds):
> *"We do not point cameras at sleeping patients 24/7. That fails in dark wards and violates privacy. Instead, we package optical rPPG into a bounded 15-Second Bedside Spot-Check. When the nurse visits Bed 3, she holds up her tablet for 15 seconds. Using the Plane-Orthogonal-to-Skin algorithm, it extracts live pulse and respiration with an active Signal Quality Index, resetting the bed's information decay with zero wires."*

---

### SLIDE 6: The "WHY NOW" Explainability Engine
- **Slide Headline:** Zero Black Boxes: Explainable Clinical Reasoning
- **Why Clinicians Reject AI Black Boxes:** Doctors and nurses will never act on an arbitrary score like "Risk: 88%" without knowing the physiological drivers.
- **The AegisPulse Explainable Card (Example: Bed 03):**
  - *▲ Tachycardia Acceleration: Heart rate spiked +22% over 35 min (74 $\to$ 96 BPM).*
  - *▲ Respiratory Drift: Breathing rate increased from 16 to 22 /min.*
  - *⏱ Information Decay: 3 hours 42 minutes since last verified bedside check.*
  - *🧪 Laboratory Corroboration: Serum Lactate elevated at 2.4 mmol/L.*
- **Visual Suggestion:** High-resolution screenshot of the slide-over drawer highlighting the 4 bullet points and recommended human action.

#### 🎙️ Spoken Script (25 seconds):
> *"Doctors reject black-box AI. AegisPulse is completely transparent. When the nurse taps Bed 3, our Explainable Why card tells her exactly why that bed is at the top of her list in plain medical English: Heart rate accelerated 22% in 35 minutes, breathing rate is climbing, lactate is elevated, and no one has touched this bed in over three hours."*

---

### SLIDE 7: Closed-Loop Action: Automated SBAR Escalation
- **Slide Headline:** From Priority Score to Immediate Clinical Action
- **The Problem**: In emergencies, junior night-shift nurses lose 20 minutes gathering fragmented charts before calling on-call doctors.
- **The SBAR Solution**:
  - **S (Situation)**: Bed 03, 42F, APS 91 (Critical Review), MEWS 4, Shock Index 0.94.
  - **B (Background)**: Post-Op Laparoscopic Cholecystectomy, Type 2 Diabetes.
  - **A (Assessment)**: Accelerating physiological velocity consistent with early septic shock.
  - **R (Recommendation)**: Bedside blood pressure cycling, stat blood cultures, IV fluid bolus evaluation.
- **One-Click Dispatch**: Auto-compiled text ready for phone briefing or direct EHR sync.

#### 🎙️ Spoken Script (25 seconds):
> *"A score without an action is useless. AegisPulse closes the loop. With one click, the system auto-compiles a standardized SBAR handoff dossier. A junior nurse calling the on-call registrar at 3:00 AM has the complete clinical situation, trajectory, and recommended orders synthesized on her screen, cutting emergency communication time from twenty minutes to thirty seconds."*

---

### SLIDE 8: Live System Demonstration & Proof of Work
- **Slide Headline:** Live Software Demonstration (Ward 4B Simulation)
- **Live Demo Protocol for Jury:**
  1. *Ward Baseline*: Show 4 active ward beds in stable equilibrium (APS $< 35$).
  2. *Deterioration Injection*: Trigger acute trajectory for Bed 03 (HR accelerates 74 $\to$ 96 BPM, decay crosses 3.5h, lactate 2.4).
  3. *Dynamic Re-Sorting*: Watch Bed 03 shoot to Rank #1 with an APS of 91 (CRITICAL REVIEW).
  4. *Inspect "WHY NOW"*: Open the slide-over drawer and review the 4 physiological reasons.
  5. *Execute 15s Spot-Check*: Turn on the camera, scan presenter's pulse at 60 FPS, lock in vitals.
- **Visual Suggestion:** High-contrast screenshot of the running React 19 interface at `http://localhost:5173`.

#### 🎙️ Spoken Script (40 seconds):
> *"Let's see AegisPulse in action. (Point to screen). Here is Ward 4B. Notice all beds are currently stable. Now, watch what happens when occult deterioration begins in Bed 3. (Trigger scenario). Her heart rate accelerates—still technically normal at 96—but her velocity spikes. Watch the queue dynamically re-sort in real time: Bed 3 shoots to Rank Number One with an Attention Score of 91! Tapping her card reveals the exact physiological drivers. And when the nurse arrives at bedside, our 15-second spot-check verifies her vitals live on camera."*

---

### SLIDE 9: Rigorous Safety Boundaries & Privacy Invariants
- **Slide Headline:** Medical Device Ethics: Safety Before Novelty
- **What We Strictly Forbid in Our Architecture:**
  - ❌ *No Fake Webcam SpO2* (physically invalid under ambient broadband light).
  - ❌ *No Fake Cuffless BP* (uncalibrated facial video BP is clinical malpractice).
  - ❌ *No Autonomous Sepsis Diagnosis* (we screen deterioration risk, not diagnose disease).
  - ❌ *No Continuous 24/7 Video Surveillance* (only 15-second bounded spot-checks).
- **Non-Negotiable Privacy Invariants:**
  - **Volatile RAM Only**: Video frames exist purely in temporary canvas memory for $< 33.3\text{ ms}$ and are destroyed immediately. Zero video files are ever saved or transmitted.
  - **Telemetry Egress Only**: Only 120-byte numerical JSON vectors cross the device boundary.

#### 🎙️ Spoken Script (25 seconds):
> *"We believe in radical engineering honesty. We do not claim fake webcam SpO2 or magic cuffless blood pressure—both are physically impossible on standard webcams. We do not stream invasive 24/7 video. Video frames exist solely in volatile RAM for 33 milliseconds and are destroyed immediately. We adhere to clinical safety invariants: our system recommends human verification; it never replaces doctors."*

---

### SLIDE 10: Health Economics & Phased Scaling Strategy
- **Slide Headline:** Maximizing Clinician Attention Across Public Health
- **Cost & Scaling Comparison (Per-Bed Over 3 Years):**
  | Metric | Traditional Ward Telemetry | Wearable Sensor Patches | AegisPulse Attention Engine |
  | :--- | :--- | :--- | :--- |
  | **Hardware Cost per Bed** | ₹2,50,000 – ₹6,00,000 | ₹15,000 (Hub) | **₹0 (Existing screens) / ₹7,500 (Tablet)** |
  | **Recurring Consumables / Yr** | ₹36,000 (leads, probes) | ₹48,000 (disposables) | **₹0 (100% Non-contact)** |
  | **Total 3-Year Cost Per Bed** | **₹3,58,000 – ₹7,20,000** | **₹1,95,000** | **₹3,600 – ₹11,100 (99% Savings)** |
- **Phased Rollout Plan:**
  - **Phase 1: Chennai Pilot (Year 1)**: 2,200 beds across Rajiv Gandhi Govt General Hospital, Stanley, Kilpauk, and 25 UPHCs.
  - **Phase 2: Tamil Nadu Scale (Years 2–3)**: 45,000 beds across 38 District Hospitals funded under the World Bank-backed **TNHSRP** program.
  - **Phase 3: Pan-India ABDM (Years 4–5)**: Integrated into Ayushman Bharat Digital Mission across 1,000,000+ public ward beds.

#### 🎙️ Spoken Script (20 seconds):
> *"By focusing on software attention allocation rather than multi-lakh-rupee hardware, AegisPulse reduces continuous ward surveillance costs by 99%. We have mapped a phased deployment starting with a 2,200-bed Chennai pilot, expanding across Tamil Nadu under the World Bank-funded TNHSRP program, and integrating with Ayushman Bharat nationwide."*

---

### SLIDE 11: Academic Research & Staged Milestones
- **Slide Headline:** Academic Rigor & Staged Engineering Milestones
- **Academic Paper Alignment (Prepared for SCOPE Mentorship):**
  - Methodology dossier detailing the mathematical derivation of the Attention Priority Score (APS) and empirical POS rPPG benchmarking.
- **Staged Implementation Milestones:**
  - **M0**: Immutable TypeScript contracts & mathematical specifications.
  - **M1**: Deterministic APS engine & Information Decay simulation.
  - **M2**: Dynamic Priority Queue UI with real-time re-sorting.
  - **M3**: Hardened 15-second POS rPPG spot-check with Signal Quality Index.
  - **M4**: Explainable "WHY NOW" drawer & closed-loop SBAR handoff.
  - **M5**: Live demo scenario hardening & stage polish.

#### 🎙️ Spoken Script (15 seconds):
> *"We have codified our mathematical formulations into an academic research paper prepared for mentorship under the SCOPE track. Our engineering roadmap follows strict contract-first milestones, separating signal processing from clinical inference to guarantee medical device software rigor."*

---

### SLIDE 12: Conclusion & Call to Action
- **Slide Headline:** Better Attention, Not More Alarms
- **Summary Points:**
  - **Solves the Real Crisis**: Directs scarce nurse attention to the patients on the steepest downward trajectory.
  - **Scientifically Grounded**: Physiological velocity + information decay + deterministic explainability.
  - **Zero Black Boxes**: Every priority score carries plain-English clinical reasons and automated SBAR actions.
- **Closing Call to Action:**
  - Repository: `github.com/MasterZ1311/AegisPulse`
  - Contact: Thenappan T (`thenappanmasterz1311@gmail.com`)
  - **Live Stage Trial**: Open for jury hands-on 15-second pulse scan right now!

#### 🎙️ Spoken Script (15 seconds):
> *"AegisPulse proves that the future of hospital safety isn't more beeping monitors. It is intelligent, explainable clinician attention allocation. We invite the jury to test their own pulse on our live 15-second spot-check right now. Thank you!"*
