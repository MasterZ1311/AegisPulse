# AegisPulse: Staged Engineering Roadmap & Milestones

**Document Version:** 1.0  
**Role:** Technical Project Manager & Principal Architect  
**Status:** BINDING SPRINT MILESTONES  

---

## 🎯 Milestone Overview: From Zero to Hardened Demo

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   STAGED ENGINEERING TIMELINE                                    │
│                                                                                                  │
│  [M0: Contracts & Foundations] ──► Types, Interfaces, Mathematical APS Formulation             │
│                 │                                                                                │
│                 ▼                                                                                │
│  [M1: Core Scoring Engine]     ──► Pure Deterministic APS & Information Decay Engine (Unit Tested)│
│                 │                                                                                │
│                 ▼                                                                                │
│  [M2: Ward Attention Radar UI] ──► React 19 Priority Queue & Real-Time Dynamic Sorting UI        │
│                 │                                                                                │
│                 ▼                                                                                │
│  [M3: 15s Optical Spot-Check]  ──► Hardened POS rPPG Scanner with SQI Gating & Countdown Ring   │
│                 │                                                                                │
│                 ▼                                                                                │
│  [M4: Explainability & SBAR]   ──► "WHY NOW" Slide-Over Card & Closed-Loop Clinical Handoff      │
│                 │                                                                                │
│                 ▼                                                                                │
│  [M5: Demo Hardening & Polish] ──► 4-Bed Deterioration Scenario Simulator & Stage Polish        │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 📋 Detailed Milestone Specifications

### Milestone 0: Architectural Contracts, Types & Mathematical Foundations
- **Objective**: Establish the immutable data model and mathematical definitions before writing UI or algorithm code.
- **Deliverables**:
  1. `src/lib/types.ts`: Define strict TypeScript interfaces:
     - `Patient` (demographics, bed number, admission context).
     - `PhysiologicalObservation` (source, SQI confidence, vital numbers).
     - `TrendVector` (velocity $\Delta \text{HR}/\Delta t$, $\Delta \text{RR}/\Delta t$, Shock Index trend).
     - `LabBiomarkerRecord` (Lactate, WBC, Creatinine).
     - `AttentionAssessment` (APS score, rank, whyReasons, category).
  2. Mathematical specification for the Attention Priority Score ($APS$).
- **Success Gate**: Zero TypeScript compilation errors (`tsc --noEmit`).

---

### Milestone 1: Deterministic APS Engine & Information Decay Engine
- **Objective**: Build pure, testable mathematical engines isolated from React or browser UI dependencies.
- **Deliverables**:
  1. `src/lib/attentionCalculator.ts`:
     - Calculate Physiological Velocity:
       $$V_{\text{physio}} = \alpha (\Delta \text{HR}) + \beta (\Delta \text{RR}) + \gamma (\Delta \text{Shock Index})$$
     - Calculate Information Decay:
       $$D_{\text{time}} = \min\left(40, \, \left(\frac{t_{\text{elapsed}}}{4\text{ hours}}\right)^2 \times 25 \times (1 - \text{Confidence})\right)$$
     - Combine with MEWS and Lab Biomarkers into final $APS \in [0, 100]$.
     - Generate deterministic, human-readable `whyReasons` array.
  2. Comprehensive Unit Test Suite verifying edge cases (e.g., normal numbers with high velocity; stable patient with 5h decay; missing data).
- **Success Gate**: 100% pass on automated unit tests with deterministic mathematical outputs.

---

### Milestone 2: Modernized Ward Attention Radar Dashboard (UI)
- **Objective**: Build the visual centerpiece of the product: a live, dynamically sorted priority queue.
- **Deliverables**:
  1. `src/components/AttentionRadarQueue.tsx`:
     - Renders active ward beds sorted dynamically by APS (Rank #1 at top).
     - Color-coded badges: `CRITICAL_REVIEW` (Red), `EVALUATE` (Amber), `WATCH` (Yellow), `LOW` (Green).
     - Real-time ticker showing Information Decay time (e.g., *"Last Check: 3h 42m ago"*).
     - Velocity badges (e.g., *"HR ▲ +18%"*).
  2. Ward Overview Header displaying total patients, active attention distribution, and nurse on duty.
- **Success Gate**: When patient vitals change, the queue re-sorts smoothly in real time ($< 100\text{ ms}$).

---

### Milestone 3: Hardened 15-Second Optical Spot-Check Subsystem
- **Objective**: Rebuild the rPPG pipeline into a bounded, highly reliable 15-second diagnostic tool.
- **Deliverables**:
  1. `src/components/OpticalSpotCheckModal.tsx`:
     - Fullscreen / modal guided scanning overlay with circular 15-second SVG countdown ring.
     - Forehead targeting reticle with real-time face validation.
     - Hardware-accelerated 60 FPS Canvas rendering the clean filtered arterial pulse wave.
  2. `src/lib/rppgEngine.ts` Hardening:
     - Real-time Signal Quality Index (SQI) based on spectral SNR.
     - If subject moves or SQI $< 50\%$, pause countdown and display *"Stabilizing..."*.
     - Lock in final Heart Rate and Respiratory Rate at second 15.
- **Success Gate**: Flawless 15-second scan on live presenter under indoor room lighting with live pulse verification.

---

### Milestone 4: Explainable "WHY NOW" Inspector & Closed-Loop SBAR
- **Objective**: Close the loop between algorithmic risk and clinical action.
- **Deliverables**:
  1. `src/components/ExplainableWhyDrawer.tsx`:
     - Slide-over drawer when a bed card is clicked.
     - Displays the 4–5 bullet points explaining why the patient holds their current priority rank.
     - Interactive clinical action checklist for the nurse.
  2. `src/components/SbarHandoffModal.tsx`:
     - Auto-generates structured Situation, Background, Assessment, and Recommendation briefing text.
     - One-click copy to clipboard and simulated EHR sync button.
- **Success Gate**: Tapping any bed card clearly explains its score and generates an SBAR note in $< 1\text{ second}$.

---

### Milestone 5: End-to-End Simulation Hardening & Stage Demo Polish
- **Objective**: Prepare an unshakeable, dramatic live demonstration for hackathon judges.
- **Deliverables**:
  1. Built-in Scenario Injector:
     - Scenario A: *Normal Ward Equilibrium* (All beds stable, low priority).
     - Scenario B: *The Stealth Deterioration* (Bed 03's HR climbs 74 $\to$ 98 BPM, decay crosses 3.5h, lactate elevated $\implies$ Bed 03 shoots to Rank #1 with APS 91).
     - Scenario C: *The Post-Triage Recovery* (Nurse completes 15s scan, logs vitals $\implies$ Bed 03 drops back down to stable green).
  2. Keyboard shortcuts for presenter switching (`1`, `2`, `3`).
  3. Visual polish: Dark medical glassmorphic theme, responsive typography, and zero UI stutter.
- **Success Gate**: Complete, end-to-end 2-minute pitch delivered without bugs, camera freezes, or unexplained scores.
