# AegisPulse: 3-Minute Hackathon Winning Pitch Script & Demo Protocol

**Positioning:** Patient Deterioration Radar & Nurse Attention Allocation Engine  
*VMedithon 3.0 (VIT Chennai — September 2026)*  

---

## ⏱️ Pitch Timeline (3 Minutes Total)

```text
[0:00 - 0:45]  The Core Reality: Nurse Scarcity & The Danger of Alarm Fatigue
[0:45 - 1:20]  The Attention Engine: Physiological Velocity & Information Decay
[1:20 - 2:15]  LIVE JURY DEMO: Bed 03 Deterioration Injection & 15s Optical Spot-Check
[2:15 - 2:45]  Explainable Clinical Reasoning ("WHY NOW") & Instant SBAR Handoff
[2:45 - 3:00]  Unit Economics, Academic Paper & The Vision
```

---

## 🎙️ Spoken Script (Word-for-Word Guide)

### Part 1: The Core Reality: Nurse Scarcity (0:00 – 0:45)
> *"Judges, in general hospital wards across India and the world, one night-shift nurse cares for 30 to 40 patients simultaneously.  
> Every digital health startup says: 'We built a continuous camera monitor for every bed!'  
> But ask any head nurse what happens when you give her 40 beeping monitors. **She goes crazy with alarm fatigue and unplugs them.**  
> The scarce resource in hospital wards is not patient data.  
> **The scarce resource is clinician attention.**  
> She has 60 minutes in an hour. She cannot continuously reassess everyone. When vitals are checked once every four hours, patients silently deteriorate between rounds.  
> Today, we introduce **AegisPulse: The Patient Deterioration Radar & Nurse Attention Allocation Engine.**  
> We don't just display numbers. **We tell the nurse exactly which bed to visit next—and explain why in plain English.**"*

*(Note: For the ultra-fast 2-Minute High-Voltage Pitch with recurring CTAs, see [07_MASTER_PITCH_SCRIPT_NATIONAL_CRISIS_AND_JUDGES_FAQ.md](file:///e:/My%20Development/AegisPulse/docs/07_MASTER_PITCH_SCRIPT_NATIONAL_CRISIS_AND_JUDGES_FAQ.md))*

---

### Part 2: The Core Science: Velocity & Information Decay (0:45 – 1:20)
*(Open the AegisPulse interface on the laptop screen)*
> *"AegisPulse continuously calculates an **Attention Priority Score ($APS \in [0, 100]$)** across four deterministic clinical vectors:  
> 1. **Physiological Velocity**: We evaluate how fast heart rate and respiration are accelerating. In compensatory shock, a patient's heart rate climbs from 72 to 96 BPM—still technically 'normal' on a threshold monitor, but a massive +33% velocity spike!  
> 2. **Information Decay**: The longer a bed sits without a verified check, the higher its uncertainty penalty.  
> 3. **Clinical Baseline**: Validated MEWS risk scoring.  
> 4. **Biochemical Evidence**: Elevated serum lactate and white blood cell counts.  
> This converts 40 chaotic beds into a single, dynamically sorted queue where the most urgent patient rises to the top."*

---

### Part 3: The Live Jury Demo (1:20 – 2:15)
*(Direct attention to the dashboard and webcam)*
> *"Watch this in real-time. Here is Ward 4B.  
> Currently, all beds are stable. Now, watch what happens when acute deterioration begins in Bed 3.  
> *(Click the 'Deterioration Scenario' toggle in the dashboard)*  
> Look at the screen: Bed 03's heart rate accelerates to 98 BPM, her decay clock crosses 3.5 hours, and her Attention Score spikes to **91 — CRITICAL REVIEW!**  
> 
> How does the nurse close the loop?  
> She walks to Bed 3 and holds up her tablet for our **15-Second Optical Spot-Check**.  
> *(Point camera at presenter or judge)*  
> Using optical rPPG with the Plane-Orthogonal-to-Skin algorithm, the camera tracks green-spectrum capillary absorption. Look at the live arterial pulse wave and our **Signal Quality Index at 94%**.  
> In 15 seconds, with zero wires, it verifies Heart Rate and Respiratory Rate, instantly resetting information decay."*

---

### Part 4: Explainability & Closed-Loop SBAR Action (2:15 – 2:45)
> *"Clinicians reject black boxes. Tapping Bed 03 opens our **'WHY NOW'** card, showing the nurse the exact physiological drivers in plain medical English.  
> And with one click, AegisPulse auto-generates a standardized **SBAR clinical handoff dossier** (Situation, Background, Assessment, Recommendation) ready to dispatch to the on-call ICU registrar, cutting handoff communication from twenty minutes to thirty seconds."*

---

### Part 5: Impact, Paper Track & Wrap-Up (2:45 – 3:00)
> *"Because AegisPulse runs on existing ward tablets with volatile RAM-only privacy, it slashes the 3-year cost of continuous monitoring by 99%—from ₹3.5 Lakhs down to ₹3,600.  
> We have codified our mathematical formulations into an academic research paper prepared for mentorship under the SCOPE track.  
> AegisPulse: Not more alarms. Just better clinician attention. Thank you."*

---

## 🎯 Jury Q&A Preparation (Bulletproof Answers)

#### Q1: "Why not continuous 24/7 video monitoring?"
> **Answer:** *"Because 24/7 video cameras in general wards fail: wards are dark at night ($< 30\text{ lux}$), patients sleep under blankets, and continuous cameras provoke severe patient privacy resistance. Instead, we package optical rPPG into an active 15-second spot-check during nurse rounds, while our Information Decay engine tracks unobserved time."*

#### Q2: "Can you measure Blood Pressure or SpO2 through the webcam?"
> **Answer:** *"No, and we refuse to claim fake numbers. Ambient broadband RGB cameras cannot reliably measure SpO2 without dual-wavelength LEDs, and optical blood pressure without calibration is clinical malpractice. We measure what rPPG is genuinely good at: Heart Rate and Respiratory Rate. Blood pressure is entered via rapid dials to complete the MEWS score."*

#### Q3: "How is patient privacy guaranteed?"
> **Answer:** *"Zero video frames ever touch a persistent disk or stream to a cloud server. Processing lives in volatile browser RAM for under 33 milliseconds and is destroyed immediately. Only 120-byte numerical telemetry vectors leave the device, ensuring complete HIPAA and DPDP Act 2023 compliance."*
