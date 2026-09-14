# AegisPulse: Canonical Hackathon Demonstration Protocol

**Document Status:** AUTHORITATIVE DEMONSTRATION RUNBOOK  
**Governing Standard:** `docs/SOURCE_OF_TRUTH.md`  
**Target Duration:** 3-Minute Lightning Pitch or 5-Minute Technical Deep-Dive

---

## 1. Demonstration Setup & Pre-Flight Checklist

1. **Start System**:
   ```bash
   npm run dev
   ```
2. **Open Browser**:
   Navigate to `http://localhost:5173/` in Google Chrome or Edge.
3. **Verify Header Status**:
   Confirm the top navigation bar shows `ONLINE` (green badge) and `6 BEDS ACTIVE`.
4. **Reset State**:
   Click **"Reset Demo"** on the bottom Demo Controller bar. All 6 beds will initialize to Step 0 (Stable Baseline).

---

## 2. The 6 Simulated Ward Patients

AegisPulse models a representative 6-bed surgical recovery ward (`Ward 4B`):

| Bed         | Patient Name      | Age    | Admission Reason              | Baseline MEWS | Role in Demo Sequence                                    |
| :---------- | :---------------- | :----- | :---------------------------- | :-----------: | :------------------------------------------------------- |
| **Bed 401** | Arthur Pendelton  | 72     | Post-op Hernia Repair         |       0       | Stable control patient.                                  |
| **Bed 402** | Marcus Brody      | 58     | Post-op Lap Cholecystectomy   |       1       | Demonstrates **Information Decay** ($D_{\text{time}}$).  |
| **Bed 403** | **Eleanor Vance** | **64** | **Post-op Partial Colectomy** |     **1**     | **Primary Deterioration (Occult Hemorrhagic Shock)**.    |
| **Bed 404** | David Zhang       | 45     | Diabetic Foot Ulcer           |       1       | Demonstrates **Signal Quality Loss** (motion/occlusion). |
| **Bed 405** | Beatrice Miller   | 69     | Community-Acquired Pneumonia  |       2       | Demonstrates **Transient Spike** (persistence filter).   |
| **Bed 406** | Clara Higgins     | 81     | Post-op Hip Arthroplasty      |       0       | Stable control patient.                                  |

---

## 3. The 3-Minute Presentation Pitch Script

### Minute 1: The Core Crisis & The Radar (0:00 – 1:00)

- **Presenter Narrative**:
  > _"Respected judges, in general hospital wards across India, one nurse is responsible for 30 to 40 patients. Traditional telemetry promises continuous monitoring, but head nurses will tell you that creates deafening alarm fatigue—up to 99% of acoustic threshold alarms are false positives. More dangerously, static thresholds miss compensatory shock. A patient with internal bleeding can maintain a 'normal' heart rate until they suddenly crash._
  >
  > _The scarce resource in hospital wards is not patient data—it is clinician attention. AegisPulse does not produce more alarms. It builds a real-time, explainable attention radar answering one critical question: **Which patient needs the nurse's attention next, and why?**"_
- **Live Action**: Show the ward radar at **Step 0: Baseline**. All 6 beds are calm green, scored under 30 (LOW priority).

### Minute 2: Occult Deterioration vs. Transient Spikes (1:00 – 2:00)

- **Presenter Narrative**:
  > _"Now watch what happens during a normal ward shift. Click **Step 1**—Bed 405 has a sudden heart rate spike from a severe coughing fit. Traditional monitors scream. AegisPulse's temporal persistence filter recognizes it as transient; no spurious code red is sounded._
  >
  > _Now look at Bed 402—click **Step 2**. Bed 402 hasn't had vitals logged in 3.5 hours. AegisPulse's Information Decay engine increases its score. An unobserved patient is an uncertain patient._
  >
  > _Now advance to **Step 3: Occult Deterioration**. This is the nightmare scenario. Eleanor Vance in Bed 403 is bleeding internally after surgery."_
- **Live Action**: Click **Step 3**. Bed 403 immediately jumps to **Rank 1** with an Attention Priority Score of **88 (CRITICAL_REVIEW)**.
- **Presenter Narrative**:
  > _"Notice: Her systolic BP is 102—it hasn't tripped an emergency cutoff yet. But her heart rate velocity is +32% over 35 minutes, her pulse pressure is narrowing, and her Shock Index hit 1.31. AegisPulse caught the trajectory before clinical collapse."_

### Minute 3: Bedside Inspection, Action & Recovery (2:00 – 3:00)

- **Live Action**: Click on **Bed 403** card to open the Bedside Inspection Panel. Show the deterministic "Why Now?" breakdown and click **"Generate SBAR"**.
- **Presenter Narrative**:
  > _"The nurse clicks Bed 403. Every score is 100% explainable math, not a black-box neural net. The nurse taps 'Generate SBAR' to format an instant medical briefing for the on-duty physician. The nurse verifies bedside, administers a 500 mL IV fluid bolus, and logs the action. Advance to **Step 5 and Step 6**."_
- **Live Action**: Click **Step 6: Recovery**. Bed 403's vitals stabilize; her APS score drops to 26 (LOW priority), and the queue dynamically re-sorts.
- **Presenter Narrative**:
  > _"And throughout this entire workflow, **zero raw video was ever stored or transmitted**. All optical frames live ephemerally in RAM and are destroyed within 33 milliseconds. Not more alarms. Just better attention. Thank you."_

---

## 4. Step-by-Step Scenario Progression

```
┌──────┬────────────────────────┬─────────────────────────────────────────────────────────────┐
│ STEP │ SCENARIO NAME          │ CLINICAL & COMPUTATIONAL BEHAVIOR                           │
├──────┼────────────────────────┼─────────────────────────────────────────────────────────────┤
│ 0    │ Baseline Stability     │ All 6 beds normal. APS < 30 (LOW). Queue stable.            │
├──────┼────────────────────────┼─────────────────────────────────────────────────────────────┤
│ 1    │ Transient Cough Spike  │ Bed 405 HR jumps to 108 BPM. Persistence filter dampens     │
│      │                        │ velocity; score remains in MODERATE; no false code red.     │
├──────┼────────────────────────┼─────────────────────────────────────────────────────────────┤
│ 2    │ Information Decay      │ Bed 402 unobserved for 210 mins. D_time rises to 68; bed    │
│      │                        │ climbs queue to prompt routine nurse physical round.        │
├──────┼────────────────────────┼─────────────────────────────────────────────────────────────┤
│ 3    │ Occult Hemorrhage      │ Bed 403 HR rises 74 ──> 104 BPM; SBP narrows 122 ──> 102.   │
│      │                        │ Shock Index = 1.31. APS jumps to 88 (CRITICAL_REVIEW).      │
├──────┼────────────────────────┼─────────────────────────────────────────────────────────────┤
│ 4    │ Optical Signal Loss    │ Bed 404 moves vigorously / blanket covers face. SQI drops   │
│      │                        │ to 0.18. Output gated (POOR_SIGNAL); zero hallucination.    │
├──────┼────────────────────────┼─────────────────────────────────────────────────────────────┤
│ 5    │ Nurse Verification     │ Nurse visits Bed 403 bedside. Logs IV fluid bolus action.   │
│      │                        │ Generates structured SBAR handoff dossier for physician.   │
├──────┼────────────────────────┼─────────────────────────────────────────────────────────────┤
│ 6    │ Clinical Recovery      │ Fluid resuscitation restores perfusion. HR drops to 82 BPM, │
│      │                        │ SBP rises to 118 mmHg. Bed 403 APS drops to 26 (LOW).       │
└──────┴────────────────────────┴─────────────────────────────────────────────────────────────┘
```

---

## 5. Judge Defense Q&A Cheatsheet

### Q1: "How do you measure Blood Pressure from a webcam?"

> _"We don't. And anyone claiming they can do so reliably on standard webcams is making an unsubstantiated claim. Blood pressure requires arterial applanation tonometry or calibrated cuffs. In AegisPulse, optical rPPG measures only Heart Rate and pulse rhythm. Blood pressure is entered manually or ingested from standard ward cuffs."_

### Q2: "Patients don't want cameras pointing at their beds 24/7."

> _"We agree completely. That is why we do not do continuous 24/7 video streaming. AegisPulse is an attention allocation engine. Contactless optical sensing is a bounded, 15-second spot check used during rounds. More importantly, video frames are processed ephemerally in volatile RAM and destroyed within 33 milliseconds. Zero video is saved to disk or transmitted over the network."_

### Q3: "What if the room is dark or the patient moves?"

> _"Our Signal Quality Index (SQI) continuously evaluates the cardiac signal-to-noise ratio. If lighting drops below 30 lux or the patient moves, the system flags POOR_SIGNAL and gates the reading. Under our clinical safety invariants, we never hallucinate a normal 72 BPM reading to make the UI look good. Sensor uncertainty increases the bed's priority for a manual nurse visit."_
