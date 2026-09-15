# 🔥 CROSSFIRE Q&A BIBLE
### For All Three Speakers — Every Question They Will Ask

---

> **HOW TO USE THIS:**
> Each of you must read every single question.
> Highlight the ones in your domain.
> Practice your answer OUT LOUD — not in your head.
> Time yourself: each answer should be 30–60 seconds. Never more.

---

## CATEGORY 1 — THE PROBLEM (Speaker 1 Primary)

**Q1.1: "This is just one personal story. Where's the systemic evidence?"**
> "The personal story illustrates a documented pattern. The Lancet and JAMA have published extensively on in-hospital preventable deterioration. Buist et al. 2002 in Resuscitation found 83% of in-hospital cardiac arrests were preceded by documented clinical deterioration 8 hours prior that went unacted upon. This is not anecdote — it's epidemiology."

**Q1.2: "Nurses in good hospitals already do hourly rounding. Why is your problem statement still valid?"**
> "Hourly rounding is an aspiration in under-resourced settings, not a reality. The WHO's 2022 healthcare workforce report shows India has 1.96 nurses per 1,000 population versus the WHO minimum of 4.45. In the wards that need this most — district hospitals, government wards — hourly rounding is physically impossible at current staffing levels. We are not solving for the top 10% of hospitals."

**Q1.3: "Isn't cardiac arrest in a hospital a failure of the whole system, not just a monitoring gap?"**
> "Yes — and we agree completely. AegisPulse is not a magic solution to a systemic failure. It is one intervention layer targeting one specific gap: the observation void between nursing rounds in under-resourced wards. We are not claiming to solve healthcare. We are claiming to make the existing nurse 2 to 3 times more effective at identifying deterioration during the current system's working conditions."

---

## CATEGORY 2 — THE PRODUCT (Speaker 2 Primary)

**Q2.1: "How is this different from existing early warning score systems?"**
> "Most EWS systems are calculators — you manually enter values, it gives a score. AegisPulse adds three layers on top: continuous time-decay to account for observation staleness, physiological velocity tracking to catch compensatory deterioration before it breaks thresholds, and a contactless sensing modality that eliminates the need for manual entry during spot checks. It is the difference between a calculator and a radar."

**Q2.2: "What evidence do you have that nurses will actually use this?"**
> "We acknowledge we are in pre-pilot phase. But there is strong published literature on nurse acceptance of early warning systems — Kyriacos et al. 2011 in the International Journal of Nursing Studies showed EWS adoption rates above 78% when systems produce actionable, explainable outputs rather than raw numbers. Our design philosophy — one ranked queue, plain-language explanations — is built specifically around that adoption research."

**Q2.3: "Your AARRR model assumes hospitals will pay. Why would cash-strapped government hospitals pay?"**
> "The initial target is private sector hospitals and hospital chains — Apollo, Fortis, Manipal — who compete on outcomes and have existing digital health budgets. Government hospital pilots can be done via NGO partnership or State NHM digital health funding, which exists under PM-JAY digital health infrastructure grants. The pricing model is built to be viable even at sub-₹500 per bed with volume commitments."

**Q2.4: "What happens when the system goes offline?"**
> "The system is offline-first by architecture. The web app continues to operate, accepts manual observations, and queues them with monotonic UUID ordering. When connectivity restores, observations sync in exact clinical timestamp order. The offline mode is documented and tested. We do not depend on continuous internet connectivity."

**Q2.5: "Why not use existing hospital information management systems?"**
> "Integration with existing HIMS is on our roadmap via HL7 FHIR. For Phase 1, we operate independently because the hospitals that need us most often have no HIMS at all. The ability to deploy with zero dependency on existing IT infrastructure is a deliberate Phase 1 constraint — because the alternative is a 12–18 month IT procurement cycle that delays patient benefit."

---

## CATEGORY 3 — THE TECHNOLOGY (Speaker 3 Primary)

**Q3.1: "Has rPPG been clinically validated?"**
> "Remote photoplethysmography has been validated in research settings. Verkruysse et al. 2008 in Optics Express was the foundational paper showing facial video could extract pulse signals. Subsequent work by Poh, McDuff, and Picard at MIT demonstrated ±5 BPM accuracy in controlled conditions. We apply rPPG as a *trend input* — velocity tracking — not as a diagnostic vital. This is consistent with the academic evidence for rPPG's current capability level."

**Q3.2: "What if the camera can't see the patient's face — they're lying down, it's dark, oxygen mask is on?"**
> "The system handles this gracefully and explicitly. If face tracking fails, the sensing state machine transitions to OCCLUSION state, purges all contactless readings, and automatically increases the patient's Information Decay score — making them *higher* priority for a manual visit. No measurement is fabricated. The failure mode of camera sensing is a reminder to visit in person — exactly the right clinical behavior."

**Q3.3: "What's your latency? Is this real-time enough for clinical use?"**
> "End-to-end observation pipeline: WebSocket push from API to client is sub-100ms. rPPG face processing runs at 20–30 fps in the browser using WebAssembly-accelerated signal processing. APS recalculation on new observation ingestion is synchronous and completes in under 50ms. For the clinical use case — prioritizing a visit within the next 5 to 20 minutes — this latency profile is more than adequate."

**Q3.4: "Why TypeScript? Why not Python with proper ML frameworks?"**
> "Clinical deployment context drove the choice. The frontend runs in a browser, which means JavaScript is mandatory. Sharing signal processing code between browser and backend via a TypeScript monorepo eliminates a class of data transformation bugs. Python ML would add a separate inference service, deployment complexity, and latency. For the current algorithm — deterministic DSP, not deep learning — TypeScript performs identically to Python, with lower deployment overhead."

**Q3.5: "How does your system perform under adversarial conditions — bad lighting, motion artifacts, low-quality camera?"**
> "The Signal Quality Index gate is the answer. SQI measures signal-to-noise ratio of the extracted rPPG waveform. If SQI falls below 0.6 — which happens with motion artifacts, poor lighting, or camera quality issues — the system reports no vital rather than a degraded one. We have regression tests that inject synthetic artifact frames and verify the system rejects output. The invariant is enforced in code."

---

## CATEGORY 4 — BUSINESS MODEL & COMPETITION

**Q4.1: "Who are your competitors and why will you win?"**
> "In the telemetry monitor space: Philips IntelliVue, GE Carescape — ₹3–6 Lakhs per bed, hardware-dependent, designed for ICU, not general wards. In the EWS software space: SEND (UK), PatientWatch — NHS-centric, require full EHR integration, 12–18 month onboarding. In the rPPG health-tech space: Binah.ai, Sievert Analytics — enterprise-priced, cloud-dependent, no ward triage logic. Our differentiation: we are the only system that combines velocity-aware clinical scoring, contactless sensing, offline operation, and ward-appropriate pricing in a single product designed from the ground up for under-resourced settings."

**Q4.2: "What is your IP moat? Can a larger player replicate this in 3 months?"**
> "The engineering artifact is replicable with sufficient resources. Our moat is: the clinical tuning of velocity and decay parameters for Indian ward conditions; the relationships with early adopter hospitals; and the trust we build with nursing staff who have been burned by overpromising health-tech before. Software is copied. Validated clinical trust takes years."

**Q4.3: "What's your exit strategy? Are you building to sell?"**
> "We are building to scale. The target is 1,000 hospital partnerships in 5 years, covering 500,000 beds across South and Southeast Asia. At that scale, the strategic value to a healthcare conglomerate or EHR player is significant. But the immediate focus is clinical outcomes, not exit multiples. A system that demonstrably reduces preventable deterioration events will be acquired by someone who wants those outcomes at scale — we do not need to engineer the exit."

**Q4.4: "How do you make money if hospitals can't pay?"**
> "Tiered access model: government hospitals at cost or subsidized via NGO/NHM grants; private sector at full SaaS rate; hospital chains at enterprise contract with implementation support. Additionally, aggregated, anonymized population health analytics is a secondary revenue stream — ward-level deterioration trend data has significant epidemiological research value."

---

## CATEGORY 5 — ETHICS & SAFETY

**Q5.1: "What happens if a patient deteriorates and the algorithm didn't flag it? Liability?"**
> "AegisPulse is a decision-support tool — not a diagnostic device. Clinical responsibility remains with the registered nurse and physician. This is identical to the liability framework for existing EWS calculators, pulse oximeters, and clinical decision aids. We are explicit in our product documentation: AegisPulse is investigational, does not replace clinical judgment, and does not carry diagnostic claims."

**Q5.2: "Aren't you using a patient's biometric data without consent?"**
> "No biometric data is stored. The rPPG algorithm extracts a waveform — a signal — from skin color variation. No facial geometry, no biometric identifier, no stored image. The frame buffer is discarded every 33ms. Patient identification in the system is by clinician-assigned bed number, not facial recognition. This is architecturally equivalent to a contact photoplethysmography sensor — a pulse oximeter on the finger — except contactless."

**Q5.3: "Could this be used to surveil patients without their knowledge?"**
> "The system is nurse-initiated — a nurse must actively open the spot-check modal, hold the camera to the patient's face, and run a 15-second acquisition. It is not a passive surveillance camera. It is a clinical instrument used with the patient's awareness, exactly as a pulse oximeter or stethoscope is used."

---

## ⚡ UNIVERSAL FALLBACK ANSWERS

**If you don't know the answer:**
> "That's a great question — and it touches on something we are actively investigating in our Phase 1 clinical protocol. I don't want to give you an imprecise answer. Can we follow up on that specifically?"

**If they're being aggressive or trying to rattle you:**
> *(Pause. Breathe. Nod once.)*
> "It sounds like you have real concerns about [restate their point]. Let me make sure I address that directly..."

**If they catch an error or something you got wrong:**
> "You're right — I appreciate the correction. Let me clarify..."
> *(Never get defensive. Credibility is maintained by owning mistakes, not deflecting them.)*

---

*End of Crossfire Q&A Bible*
