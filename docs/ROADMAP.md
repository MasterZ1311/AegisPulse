# AegisPulse: Authoritative Innovation Roadmap

**Document Status:** AUTHORITATIVE PRODUCT ROADMAP  
**Governing Standard:** `docs/SOURCE_OF_TRUTH.md`

---

## 1. Roadmap Principles

All future initiatives must connect directly to the current product definition: **Patient Deterioration Radar & Nurse Attention Allocation Engine**.

Abandoned concepts (such as 6-patient ceiling cameras, webcam SpO2, cuffless BP, or autonomous diagnostic prescribing) are permanently excluded.

---

## 2. Phased Roadmap: NOW, NEXT, LATER, RESEARCH

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                     THE 4-PHASE ROADMAP                                          │
├───────────────────────────┬──────────────────────────────────────────────────────────────────────┤
│ PHASE 1: NOW              │ Hackathon & Functional Engineering Proof-of-Concept                  │
│ (Current Milestone)       │ • Deterministic APS Engine (0–100) with velocity & decay.            │
│                           │ • Validated Subbe MEWS (0–14) & Singer qSOFA (0–3).                  │
│                           │ • Bounded 15-second guided rPPG spot-check via POS/CHROM.            │
│                           │ • Real-time glanceable Ward Radar & explainable Attention Queue.     │
│                           │ • Offline-first sync with UUID idempotency and client queuing.       │
│                           │ • 10 Red-Team hardened attack vector defenses.                       │
├───────────────────────────┼──────────────────────────────────────────────────────────────────────┤
│ PHASE 2: NEXT             │ Clinical Usability & Ground-Truth Benchmarking                       │
│ (Post-Hackathon Q4 2026)  │ • Benchmarking against open clinical datasets (MMPD, UBFC-Phys).     │
│                           │ • Simultaneous hardware trial against contact pulse oximeters.       │
│                           │ • Nurse workflow interviews in hospital ward pilot settings.         │
│                           │ • Automated offline database maintenance & auto-vacuuming.           │
├───────────────────────────┼──────────────────────────────────────────────────────────────────────┤
│ PHASE 3: LATER            │ Hospital Enterprise Architecture & Integration                      │
│ (Q1–Q2 2027)              │ • HL7 FHIR bidirectional EHR observation and lab adapter.            │
│                           │ • WebGPU & WebAssembly SIMD optical acceleration pipeline.           │
│                           │ • Enterprise PostgreSQL / TimescaleDB persistence tier (>500 beds).  │
│                           │ • Hardware privacy shutter integration for bedside tablets.          │
├───────────────────────────┼──────────────────────────────────────────────────────────────────────┤
│ PHASE 4: RESEARCH         │ Formal Medical Device Clearance & Prospective Trials                 │
│ (Q3 2027+)                │ • Prospective multi-center clinical validation trial.                │
│                           │ • ISO 13485 QMS and IEC 62304 Medical Device Software Life Cycle.   │
│                           │ • CDSCO Class B / FDA 510(k) SaMD regulatory filing.                 │
│                           │ • Randomized controlled trial measuring reduction in ward IHCA.      │
└───────────────────────────┴──────────────────────────────────────────────────────────────────────┘
```

---

## 3. Explicitly Abandoned Concepts (Do Not Resurrect)

1. **Abandoned: Multi-Bed 6-Patient Ceiling Camera**:
   - _Reason_: Extreme barrel distortion, poor pixel resolution (< 30x30 pixels on face at 3m distance), blanket occlusions, and severe patient dignity objections.
2. **Abandoned: Webcam Contactless SpO2**:
   - _Reason_: Ambient broadband light and consumer RGB Bayer filters cannot resolve the dual-wavelength ratio required for pulse oximetry.
3. **Abandoned: Facial Video Cuffless Blood Pressure**:
   - _Reason_: Clinically invalid and scientifically unverified without individual arterial calibration.
4. **Abandoned: Autonomous Clinical Prescribing**:
   - _Reason_: Creates lethal medical liability; software must remain strictly advisory decision support with human nurse oversight.
