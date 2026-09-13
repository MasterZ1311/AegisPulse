# AegisPulse: Master Glossary of Technical, Biomedical & Clinical Keywords

**Positioning:** Patient Deterioration Radar & Nurse Attention Allocation Engine  
**Document Version:** 3.0  
**Target Audience:** Non-Technical Founders, Medical Students, Software Developers, Hackathon Judges  

---

## 📖 How to Use This Glossary
Every keyword in this reference manual is broken down into three intuitive dimensions:
1. **💡 The Simple Analogy**: A crystal-clear, real-world metaphor explaining the concept in seconds.
2. **🔬 The Formal Definition**: The exact biomedical, mathematical, or engineering definition used by clinicians and computer scientists.
3. **🛡️ Role in AegisPulse**: Exactly how this concept functions inside the AegisPulse codebase and architecture.

---

## Table of Contents
- [Category A: Attention Allocation & Deterioration Radar](#category-a-attention-allocation--deterioration-radar)
- [Category B: Optical Physics & Bio-Sensing](#category-b-optical-physics--bio-sensing)
- [Category C: Signal Processing & Mathematics](#category-c-signal-processing--mathematics)
- [Category D: Clinical Hemodynamics & Diagnostics](#category-d-clinical-hemodynamics--diagnostics)
- [Category E: Software Architecture & Privacy](#category-e-software-architecture--privacy)

---

## Category A: Attention Allocation & Deterioration Radar

### 1. Attention Priority Score (APS)
- **💡 The Simple Analogy**: Think of an airport flight radar that spots planes running low on fuel and moves them to the front of the landing runway. APS is a hospital radar that scores every patient from 0 to 100 so the nurse knows which bed to visit first.
- **🔬 The Formal Definition**: A deterministic multi-vector clinical index ($0\text{ to }100$) that ranks hospital ward patients based on physiological velocity, information decay, early warning baselines, and biochemical stress markers.
- **🛡️ Role in AegisPulse**: This is the core output of AegisPulse. It dynamically sorts all beds on the ward dashboard from Rank #1 (most urgent) down to Rank #40.

### 2. Information Decay ($D_{\text{time}}$)
- **💡 The Simple Analogy**: If someone checked on your sleeping baby 10 minutes ago, you are calm. If no one has checked on the baby in 5 hours, your worry naturally climbs, even if the baby was fine before. Information decay is the mathematical score of that growing worry over time.
- **🔬 The Formal Definition**: A non-linear uncertainty metric that increases as a quadratic function of time elapsed since the last trusted clinical observation, weighted inversely by sensor quality ($1 - \text{SQI}$).
- **🛡️ Role in AegisPulse**: Prevents "forgotten beds." As time passes without a verified nurse visit, the bed's priority score automatically rises to guarantee scheduled human attention.

### 3. Physiological Velocity ($V_{\text{physio}}$)
- **💡 The Simple Analogy**: A car going 50 mph on the highway is fine. A car whose speedometer is accelerating from 20 to 50 mph while approaching a red light is in danger. Velocity measures how fast the body is changing, not just where it is right now.
- **🔬 The Formal Definition**: The first time-derivative of vital signs ($\Delta \text{HR}/\Delta t$, $\Delta \text{RR}/\Delta t$) over a rolling temporal window (e.g., 30–60 minutes), reflecting acute compensatory hemodynamic acceleration.
- **🛡️ Role in AegisPulse**: Catches patients whose numbers look technically "normal" (e.g., HR 96 BPM) but whose rate of change indicates acute occult hemorrhage or septic compensation.

### 4. Shock Index (SI) & Shock Index Velocity
- **💡 The Simple Analogy**: The ratio of how hard your heart is pumping compared to the pressure in your pipes. When the heart races while the pressure drops, your plumbing is failing.
- **🔬 The Formal Definition**: The ratio of Heart Rate to Systolic Blood Pressure ($\text{SI} = \text{HR} / \text{SBP}$). Normal is $0.5\text{–}0.7$. A score $> 0.9$ indicates significant left ventricular compromise and impending shock.
- **🛡️ Role in AegisPulse**: Evaluated in `TrendVector`. A rising Shock Index velocity is one of the heaviest weightings pushing a patient into the `CRITICAL_REVIEW` tier.

### 5. Signal Quality Index (SQI)
- **💡 The Simple Analogy**: A trust meter (0% to 100%) that tells you whether a phone call is crystal clear or full of crackling static before you believe what the other person is saying.
- **🔬 The Formal Definition**: A quantitative metric derived from the power spectral density (PSD) of a physiological signal, comparing the spectral energy at the fundamental cardiac peak against out-of-band noise.
- **🛡️ Role in AegisPulse**: Gates the 15-second optical spot-check. If $\text{SQI} < 50\%$, the countdown pauses, preventing noisy artifacts from generating false vitals.

### 6. The "WHY NOW" Explainable Reasoning Engine
- **💡 The Simple Analogy**: A co-pilot who doesn't just yell "DANGER!", but says: "Warning: Engine 2 oil pressure dropped 30% in 5 minutes, and altitude is slipping."
- **🔬 The Formal Definition**: A deterministic translation module that converts numerical mathematical triggers into structured, plain-language clinical bullet points.
- **🛡️ Role in AegisPulse**: Renders 4–5 concise sentences explaining why a patient was elevated to Rank #1, giving clinicians immediate, auditable rationale to act.

---

## Category B: Optical Physics & Bio-Sensing

### 7. Remote Photoplethysmography (rPPG)
- **💡 The Simple Analogy**: Watching your skin subtly blush and fade with every heartbeat through a camera lens across the room, without attaching sticky pads or wires.
- **🔬 The Formal Definition**: An optical, contactless bio-sensing technique that detects micro-vascular blood volume changes in the cutaneous capillary bed by capturing reflected ambient light variations with an RGB optical sensor.
- **🛡️ Role in AegisPulse**: Powers our 15-second guided bedside spot-check, extracting heart rate and respiration without wires.

### 8. Green-Spectrum Capillary Absorption (500 – 560 nm)
- **💡 The Simple Analogy**: Hemoglobin in your blood wears green sunglasses—it absorbs green light much more aggressively than red or blue light.
- **🔬 The Formal Definition**: The electromagnetic spectral band where oxygenated and deoxygenated hemoglobin exhibit peak optical extinction ($\epsilon \approx 3.2 \times 10^4\text{ M}^{-1}\text{cm}^{-1}$ at $540\text{ nm}$).
- **🛡️ Role in AegisPulse**: AegisPulse isolates the camera’s green color channel because it yields the highest signal-to-noise ratio for pulsatile arterial hemodynamics.

### 9. Region of Interest (ROI)
- **💡 The Simple Analogy**: A camera sniper scope that locks onto the clearest patch of forehead skin while ignoring hair, eyes, and moving backgrounds.
- **🔬 The Formal Definition**: A localized bounding box within an optical video frame selected for spatial pixel averaging and signal processing.
- **🛡️ Role in AegisPulse**: Automatically targets the central forehead ($30\%W \times 18\%H$), where dermal perfusion is high and muscle movement from speech is minimal.

---

## Category C: Signal Processing & Mathematics

### 10. Plane-Orthogonal-to-Skin (POS) Algorithm
- **💡 The Simple Analogy**: Mathematical polarized sunglasses that cancel out blinding surface glare on water so you can see the fish swimming underneath.
- **🔬 The Formal Definition**: A state-of-the-art rPPG projection algorithm (Wang et al., *IEEE TBME*, 2017) that projects normalized RGB temporal signals onto two orthogonal axes perpendicular to the physiological skin tone vector, eliminating specular glare and motion artifacts.
- **🛡️ Role in AegisPulse**: Implemented in `src/lib/rppgEngine.ts` to ensure optical pulse extraction remains robust across diverse skin tones and subtle head movements.

### 11. 4th-Order Butterworth Bandpass Filter
- **💡 The Simple Analogy**: A digital bouncer that only allows cardiac frequencies between 45 and 200 beats per minute through the door, kicking out slow breathing sways and high-frequency camera noise.
- **🔬 The Formal Definition**: An infinite impulse response (IIR) digital filter with a maximally flat passband response and zero ripple, configured between $0.75\text{ Hz}$ and $3.33\text{ Hz}$.
- **🛡️ Role in AegisPulse**: Converts raw noisy green channel fluctuations into a clean, smooth sinusoidal arterial pulse wave.

### 12. Root Mean Square of Successive Differences (RMSSD)
- **💡 The Simple Analogy**: A healthy heart speeds up and slows down subtly with every breath. RMSSD measures how flexible that rhythm is. A flat, robotic heart rate means the nervous system is in shock.
- **🔬 The Formal Definition**: The primary mathematical metric of Heart Rate Variability (HRV) that assesses parasympathetic vagal autonomic regulation by measuring beat-to-beat inter-beat interval variance.
- **🛡️ Role in AegisPulse**: Extracted during the spot-check to provide an instantaneous autonomic stress index.

---

## Category D: Clinical Hemodynamics & Diagnostics

### 13. Modified Early Warning Score (MEWS)
- **💡 The Simple Analogy**: A standardized clinical report card graded from 0 to 14 across 5 vital signs. A score of 0 is healthy; 5 or higher sounds the hospital emergency alarm.
- **🔬 The Formal Definition**: A validated bedside risk-stratification scoring system aggregating Heart Rate, Systolic BP, Respiratory Rate, Temperature, and Consciousness (AVPU).
- **🛡️ Role in AegisPulse**: Forms the deterministic clinical baseline ($S_{\text{mews}}$) of our Attention Priority Score.

### 14. Quick Sequential Organ Failure Assessment (qSOFA)
- **💡 The Simple Analogy**: A rapid 3-point bedside checklist: Is breathing fast ($\ge 22$)? Is blood pressure low ($\le 100$)? Is the patient confused?
- **🔬 The Formal Definition**: A bedside screening tool endorsed by the Sepsis-3 consensus to identify patients with suspected infection at high risk of in-hospital mortality.
- **🛡️ Role in AegisPulse**: Continuously evaluated alongside MEWS to identify patients requiring immediate sepsis workups.

### 15. Serum Lactate
- **💡 The Simple Analogy**: When organs suffocate from lack of oxygenated blood flow, cells produce lactic acid. High lactate means tissues are starving.
- **🔬 The Formal Definition**: A biochemical byproduct of anaerobic glycolysis in hypoperfused cellular tissue. Normal is $< 2.0\text{ mmol/L}$; levels $> 2.0$ indicate tissue hypoperfusion.
- **🛡️ Role in AegisPulse**: Ingested in the Lab Diagnostics module. When optical tachycardia co-occurs with elevated lactate, AegisPulse confirms severe decompensation with high specificity.

### 16. SBAR Clinical Protocol
- **💡 The Simple Analogy**: A military-grade briefing template: **S**ituation (What is happening right now?), **B**ackground (What is the story?), **A**ssessment (What do I think is wrong?), **R**ecommendation (What do we need to do immediately?).
- **🔬 The Formal Definition**: A structured situational communication framework mandated by hospital accreditation bodies (NABH / JCI) to prevent communication failures during urgent medical handoffs.
- **🛡️ Role in AegisPulse**: Auto-compiled with one click from active telemetry and lab trends, allowing junior nurses to brief senior registrars in under 30 seconds.

---

## Category E: Software Architecture & Privacy

### 17. Volatile RAM Processing (Memory Enclave)
- **💡 The Simple Analogy**: Drawing in the sand right at the ocean's edge—every incoming wave wipes the sand completely clean so no footprint remains.
- **🔬 The Formal Definition**: Dynamic random-access memory (DRAM) buffers where video frames are processed and immediately overwritten within $< 33.3\text{ ms}$, with zero persistent disk writes.
- **🛡️ Role in AegisPulse**: Guarantees compliance with India's **DPDP Act 2023** and **HIPAA** by ensuring no patient facial imagery is ever stored or transmitted across networks.

### 18. Telemetry-Only Egress
- **💡 The Simple Analogy**: Sending a text message that says "74 BPM" instead of sending a heavy video file of someone's face.
- **🔬 The Formal Definition**: Restricting network payloads exclusively to de-identified numerical vectors and metadata ($< 150\text{ bytes}$ of JSON) without transmitting raw visual sensory media.
- **🛡️ Role in AegisPulse**: Enables the system to operate on ultra-low bandwidth (even 2G/3G connections) with complete privacy security.
