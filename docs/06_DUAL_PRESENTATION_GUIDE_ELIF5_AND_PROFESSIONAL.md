# AegisPulse: Dual-Track Master Presentation Guide

**Positioning:** Patient Deterioration Radar & Nurse Attention Allocation Engine  
**Document Version:** 3.0  
**Presenter:** Thenappan T & The AegisPulse Team  

---

## 🧭 How to Use This Dual Guide
- Use **Track A** when pitching to young students, journalists, non-technical executives, or when a judge says: *"Explain this to me like I'm five years old."*
- Use **Track B** when presenting to Chief Medical Officers, Intensivists, Hospital Directors, or Biomedical Engineering Professors.

---

# 🧸 TRACK A: Explain to a 5-Year-Old (ELIF5)
**Title:** *The Super-Smart Helper Who Tells the Nurse Who Needs Help Next!*  
**Tone:** Playful, visual, story-driven, and exciting.  
**Total Duration:** 3 Minutes.  

---

### Act 1: The Busy Nurse & The Big Hospital Room (45 seconds)
*(Hold up your hands with all ten fingers spread wide)*

> *"Imagine you are a nurse in a giant hospital room. You have thirty sick grandmas and grandpas lying in beds.  
> But you only have two hands, two eyes, and one watch!  
> You want to give everyone medicine, check on their little heartbeats, and make sure they are smiling.  
> But while you are talking to Grandma in Bed 1, what is happening to Grandpa way over in Bed 15?  
> Nobody knows! He might be feeling a little tummy ache or a fever, but he doesn't want to bother you.  
> The nurse has to guess who to visit next. And guessing can be scary."*

---

### Act 2: The Magic Radar: Who Needs a Hug Next? (45 seconds)
*(Point to the computer screen showing the dynamic list of beds)*

> *"So, we built a super-smart robot helper called **AegisPulse**.  
> AegisPulse sits quietly on the nurse's desk like a magical radar.  
> It doesn't make loud, scary beeping noises all day.  
> Instead, it keeps a friendly list that constantly asks:  
> **'Who needs the nurse next, and why?'**  
> Look at the screen right now! Bed Number 3 just moved to the very top of the list!  
> Why? The robot helper says:  
> *'Hey nurse! Bed Number 3's heart started beating a little faster, and nobody has visited her bed for three whole hours! Go give her a check right now!'*"*

---

### Act 3: The 15-Second Magic Camera (45 seconds)
*(Point the laptop webcam towards a teammate)*

> *"When the nurse walks over to Bed 3, does she wrap a bunch of tangled, painful wires around her arms?  
> No way! Sticky wires are ouchy!  
> Instead, she holds up her tablet for **fifteen seconds**.  
> The magic camera looks at Grandma's forehead.  
> Did you know your blood drinks up green light every time your heart beats?  
> Without touching her at all, the camera watches the tiny green sparkles on her forehead and counts:  
> *Thump... thump... thump... 76 heartbeats every minute!*  
> At second 15, the tablet dings a happy chime, the doctor gets a message, and Grandma gets her medicine before she gets really sick!"*

---

### Act 4: The Happy Ending (15 seconds)
> *"Because of AegisPulse, the nurse never has to guess who needs her, the patients get to sleep peacefully without tangled wires, and everyone gets to go home happy and healthy.  
> That is AegisPulse: helping nurses give their love and attention to the right patient at the right time. Thank you!"*

---

# 🩺 TRACK B: Explain to a Healthcare Professional & CMO
**Title:** *Deterministic Attention Allocation: Solving the 4-Hour Ward Blindspot via Physiological Velocity, Information Decay, and Bounded rPPG*  
**Target Audience:** Chief Medical Officers, Intensivists, Clinical Directors, Biomedical Professors.  
**Tone:** Clinically rigorous, data-driven, objective, and authoritative.  
**Total Duration:** 5 Minutes.  

---

### Section 1: The Real Bottleneck: Nurse Attention Rationing (60 seconds)
> *"Doctor, you know the reality of general medical-surgical hospital wards. While our intensive care units feature continuous 1:1 telemetry, 85% of your hospital beds are general ward beds where one night-shift nurse is responsible for 35 to 40 patients.  
> 
> Under standard ward protocols, nurses measure vitals once every 4 to 6 hours.  
> 
> Historically, startups have proposed installing continuous telemetry monitors on every bed. But head nurses reject this immediately because of **alarm fatigue**: over 85% of single-threshold alarms are clinically non-actionable false alarms. When 40 beds are beeping, nurses mute the monitors.  
> 
> Furthermore, static threshold alarms fail because human compensatory physiology masks decline. A patient compensating for septic hypoperfusion or an occult anastomotic bleed can maintain a 'normal' heart rate of 95 BPM until cardiovascular collapse.  
> 
> The scarce resource in general wards is not patient data. **It is clinician attention.**  
> 
> Today, we present **AegisPulse: The Patient Deterioration Radar & Nurse Attention Allocation Engine.**  
> We do not flood nurses with raw numbers. We continuously estimate which patient deserves bedside presence next—and explain the exact physiological reasons why."*

---

### Section 2: The Attention Priority Score (APS) Formulation (75 seconds)
*(Switch screen to the Attention Priority Formula and Ward Queue)*

> *"AegisPulse calculates an **Attention Priority Score ($APS \in [0, 100]$)** deterministically across four clinical vectors:
> 
> 1. **Physiological Velocity ($V_{\text{physio}}$)**: We evaluate the first time-derivative of vitals ($\Delta \text{HR}/\Delta t$, $\Delta \text{RR}/\Delta t$, and Shock Index trend). A patient whose heart rate accelerated from 72 to 96 BPM over 45 minutes gets an immediate velocity penalty, exposing the compensatory phase hours before blood pressure collapses.
> 2. **Information Decay ($D_{\text{time}}$)**: Clinical risk is a function of unobserved time. As hours elapse without a verified bedside check, uncertainty increases quadratically, weighted inversely by sensor quality ($1 - \text{SQI}$). A stable patient who hasn't been checked in 4 hours will systematically rise on the attention queue.
> 3. **Clinical MEWS Baseline ($S_{\text{mews}}$)**: Integrating the validated Modified Early Warning Score matrix.
> 4. **Biochemical Stress Markers ($L_{\text{biomarker}}$)**: Cross-referencing laboratory panels (Serum Lactate $> 2.0\text{ mmol/L}$, leukocytosis).
> 
> This generates a single, continuously sorted priority queue that guides the nurse's physical rounding path."*

---

### Section 3: The 15-Second Optical Spot-Check Paradigm (60 seconds)
*(Point to the live scanner on screen)*

> *"We rejected the idea of pointing cameras at sleeping patients 24/7. In the real world, hospital wards are dark at night ($< 30\text{ lux}$), patients sleep under blankets, and continuous cameras provoke severe privacy resistance.  
> 
> Instead, optical Remote Photoplethysmography (rPPG) is packaged into an active **15-Second Bedside Spot-Check**.  
> 
> When the nurse approaches Bed 3, she holds up her tablet for 15 seconds.  
> Our algorithm utilizes the **Plane-Orthogonal-to-Skin (POS)** framework to track green-spectrum capillary absorption ($540\text{ nm}$) on the forehead.  
> Notice our real-time **Signal Quality Index (SQI)**: if the patient turns their head, the countdown pauses until the signal stabilizes.  
> At second 15, it locks in Heart Rate, Respiratory Rate, and RMSSD Heart Rate Variability, instantly resetting the bed's Information Decay metric with zero cables."*

---

### Section 4: Explainable Reasoning & Closed-Loop SBAR Action (60 seconds)
*(Open the 'WHY NOW' slide-over drawer)*

> *"Clinicians reject black-box AI scores. AegisPulse is 100% explainable.  
> Tapping Bed 3 presents the attending nurse with clear physiological drivers:  
> - *Tachycardia Acceleration: HR spiked +22% over 35 min.*  
> - *Respiratory Drift: Tachypnea accelerating: 16 $\to$ 22 /min.*  
> - *Information Decay: No verified check for 3 hours 42 minutes.*  
> - *Biochemical Stress: Serum Lactate elevated at 2.4 mmol/L.*  
> 
> If the trajectory is confirmed, one click auto-generates a standardized **SBAR handoff dossier** (Situation, Background, Assessment, Recommendation) ready to dispatch to the on-call ICU registrar, cutting handoff communication latency from twenty minutes to thirty seconds."*

---

### Section 5: Safety Invariants & Health Economics (45 seconds)
> *"We built this under strict medical device safety invariants:  
> - **We refuse to claim fake webcam SpO2 or cuffless blood pressure.** Blood pressure is entered via rapid dials or digital cuffs to complete the MEWS score.  
> - **Zero Video Persistence**: Video frames live solely in volatile canvas RAM for 33 milliseconds and are overwritten immediately. Only 120-byte numerical JSON telemetry vectors leave the device, ensuring 100% compliance with HIPAA and India's DPDP Act 2023.  
> - **Cost Impact**: AegisPulse deploys on existing ward tablets and workstations at less than ₹3,600 per bed over three years—a 99% cost reduction compared to wired monitors.  
> 
> In summary: AegisPulse eliminates the 4-hour general ward blindspot not by adding more beeping alarms, but by allocating clinician attention to the right patient at the right time. Thank you."*
