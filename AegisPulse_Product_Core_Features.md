# AegisPulse — Product Core Features & Full Working Functions

## 1. Product Definition

**AegisPulse** is a **Patient Deterioration Radar & Nurse Attention Allocation Engine**.

The core question is:

> **Which patient needs the nurse's attention next, and why?**

AegisPulse continuously evaluates available physiological observations, trends, signal confidence, information freshness, clinical context, and deterministic clinical rules to create an explainable **Attention Priority Score (APS)** for each active patient.

AegisPulse is a decision-support and monitoring prototype. It is **not** an autonomous diagnostic or treatment system.

---

# 2. Core Product Loop

```text
Sensor / Clinical Data
        ↓
Signal Quality & Confidence
        ↓
Trusted Observations
        ↓
Clinical Rules
        ↓
Trend / Velocity / Persistence
        ↓
Information Freshness
        ↓
Attention Priority Score
        ↓
Ward Attention Queue
        ↓
"WHY NOW?" Explanation
        ↓
Human Verification / Action
        ↓
New Observation
        ↓
APS Recalculation
```

This feedback loop is the core product.

---

# 3. Core Features

## 3.1 Ward Attention Radar

The primary product screen.

Shows all active patients ordered by current attention priority.

Each patient card should display:

- Patient name / identifier
- Bed number
- Attention Priority Score
- Priority category
- Current physiological state
- Trend direction
- Signal confidence
- Last trusted observation
- Top reason for current priority
- Current workflow state

Example:

```text
#1  BED 03   APS 91   CRITICAL REVIEW
    HR accelerating • RR rising • stale observation

#2  BED 14   APS 74   EVALUATE
    Observation decay • tachypnea drift

#3  BED 07   APS 48   WATCH
    Mild trend change

#4  BED 01   APS 12   STABLE
    Stable trend • fresh observation
```

The queue must dynamically reorder when patient priority changes.

---

# 4. Attention Priority Score (APS)

## Purpose

APS answers:

> **Who should receive attention next?**

APS is a **0–100 prioritization score**, not a diagnosis and not a probability of mortality.

## Inputs

### Physiological state

- Heart rate
- Respiratory rate
- Blood pressure when actually available
- Other validated measurements implemented by the system

### Physiological trend

- HR trend
- RR trend
- Rate of change
- Acceleration when useful
- Persistence
- Deviation from baseline

### Clinical foundation

- MEWS
- qSOFA where applicable
- Patient baseline
- Clinical context

### Information freshness

- Time since last trusted observation
- Time since last manual observation
- Measurement confidence
- Missing information

### Laboratory/contextual evidence

- Lactate where available
- WBC where available
- Other relevant laboratory values actually supported by the implementation

## APS requirements

APS must be:

- deterministic
- bounded to 0–100
- explainable
- auditable
- confidence-aware
- robust to missing data
- robust to transient noise

APS must never silently invent missing measurements.

---

# 5. Priority Categories

The exact thresholds must remain configurable.

Recommended conceptual categories:

```text
0–24     STABLE
25–49    WATCH
50–74    EVALUATE
75–89    HIGH PRIORITY
90–100   CRITICAL REVIEW
```

Each category should have:

- human-readable label
- visual representation
- escalation policy
- acknowledgement workflow

---

# 6. WHY NOW? Explainability

Every elevated priority must explain itself.

Example:

```text
WHY NOW?

↑ Heart rate increased 18% over 35 minutes
↑ Respiratory rate increased from 16 → 24/min
↑ MEWS increased from 2 → 4
⏱ Last trusted observation: 3h 42m ago
✓ Signal confidence: 94%
```

Every reason must be derived from actual source data.

The system must maintain provenance:

```text
Patient
→ Observation
→ Calculation
→ Reason
→ APS
```

The explanation engine should select the most relevant 3–5 reasons rather than displaying a large list of technical features.

---

# 7. Contactless Physiological Sensing

Camera/rPPG is one sensing modality.

## 7.1 Heart Rate

Pipeline:

```text
Camera
→ Face Detection
→ ROI Selection
→ RGB Signal
→ Signal Processing
→ Pulse Signal
→ HR Estimate
→ Confidence
```

Potential algorithms:

- GREEN
- CHROM
- POS

Only algorithms actually implemented and evaluated should be presented as supported features.

---

# 8. Respiratory Rate

Where technically supported by the implemented sensing pipeline:

- Estimate respiratory rate
- Track confidence
- Track signal quality
- Add to trend analysis
- Use only when measurement status is valid

Do not fabricate RR when the signal is unreliable.

---

# 9. Signal Quality Index (SQI)

SQI tells the system whether a contactless measurement should be trusted.

Possible statuses:

```text
EXCELLENT
GOOD
FAIR
LOW
INVALID
```

Possible measurement states:

```text
VALID
LOW_CONFIDENCE
CALIBRATING
MOTION_CONTAMINATED
INSUFFICIENT_LIGHT
NO_FACE
PHYSIOLOGICALLY_IMPLAUSIBLE
```

Signal quality is a first-class product signal.

---

# 10. Confidence-Aware Monitoring

Every physiological measurement should carry:

```text
value
timestamp
source
confidence
signal quality
measurement status
```

Example:

```text
HR: 104 BPM
Confidence: 93%
SQI: GOOD
Status: VALID
```

or:

```text
HR: unavailable
Confidence: 22%
Status: LOW_CONFIDENCE
```

When the system is uncertain, it should communicate uncertainty instead of manufacturing a value.

---

# 11. Patient Baseline

The system should support patient-specific baseline analysis.

Example:

```text
Baseline HR = 72
Current HR = 98
Deviation = +36%
```

Baseline deviation can contribute to attention prioritization.

---

# 12. Trend Detection

The system does not only evaluate current values.

It tracks trajectories such as:

```text
72 → 77 → 84 → 91 → 98
```

This supports:

- rising trend
- falling trend
- stable trend
- accelerating deterioration
- recovery

---

# 13. Physiological Velocity

Track rate of change where meaningful:

```text
ΔHR / Δt
ΔRR / Δt
ΔShockIndex / Δt
```

Velocity must be calculated using timestamp-aware data.

The engine should handle:

- irregular sampling
- missing observations
- duplicate observations
- out-of-order observations

---

# 14. Persistence Detection

The system should distinguish:

```text
temporary spike
```

from:

```text
persistent deterioration
```

Example:

```text
HR spike
↓
returns to baseline
→ do not over-escalate
```

versus:

```text
HR rising
↓
RR rising
↓
remains abnormal
↓
APS increases
```

---

# 15. Recovery Detection

When patient physiology improves:

```text
APS 89
↓
72
↓
48
↓
22
```

The queue should automatically de-escalate.

---

# 16. Information Freshness / Decay

A key AegisPulse concept is:

> **The system tracks not only what it knows, but how recently it knew it with confidence.**

Track:

- last trusted observation
- last camera observation
- last manual observation
- observation age
- expected observation interval
- confidence

Important:

**Missing information is uncertainty, not automatically deterioration.**

Example:

```text
Normal physiology
+
fresh trusted measurement
→ low priority contribution
```

versus:

```text
Normal-looking physiology
+
4 hours without trusted observation
+
low-confidence sensing
→ increased attention due to uncertainty
```

---

# 17. MEWS

Implement MEWS as a separate deterministic clinical rule engine.

It should expose:

- contributing parameters
- individual points
- total score
- timestamp
- missing values
- explanation

MEWS must remain separate from APS implementation.

APS consumes the MEWS result.

---

# 18. qSOFA

Where appropriate, provide deterministic qSOFA scoring.

Expose:

- contributing criteria
- score
- missing information
- explanation

Do not use qSOFA as a disease diagnosis.

---

# 19. Shock Index

When valid heart rate and systolic blood pressure are available:

```text
Shock Index = HR / SBP
```

The system can track its trend.

Do not derive SBP from unsupported camera estimates.

---

# 20. Laboratory / Clinical Context

Where available, AegisPulse can ingest relevant clinical information.

Examples:

- Lactate
- WBC
- Other relevant labs
- Recent interventions
- Patient context

Clinical context should corroborate attention prioritization rather than create unsupported diagnoses.

---

# 21. Patient Timeline

Every meaningful event should appear chronologically.

Example:

```text
10:32  HR 82
10:35  RR 18
10:41  APS 42
10:47  APS 61
10:48  Attention event generated
10:52  Nurse acknowledged
10:55  Manual BP entered
10:56  APS recalculated to 48
```

Timeline events may include:

- vital measurements
- signal quality changes
- APS changes
- MEWS changes
- qSOFA changes
- labs
- nurse visits
- acknowledgements
- recommended actions
- completed actions
- system state changes

---

# 22. Nurse Workflow

## 22.1 Identify

Nurse opens Ward Radar.

Immediately sees:

> **WHO NEEDS ME NOW?**

## 22.2 Investigate

Select patient.

See:

- APS
- trend
- WHY NOW
- confidence
- freshness
- clinical rules
- relevant labs
- timeline

## 22.3 Verify

Suggested human action may be:

- perform bedside vital recheck
- repeat manual BP
- inspect patient
- confirm sensor reading

## 22.4 Acknowledge

Nurse can:

- acknowledge
- start assessment
- complete assessment
- escalate
- dismiss
- mark false positive

## 22.5 Recalculate

New observation enters the system.

APS updates.

Priority changes.

---

# 23. Alert / Attention Management

AegisPulse should avoid alarm spam.

Support:

- persistence
- hysteresis
- cooldown
- duplicate suppression
- acknowledgement
- escalation
- de-escalation
- resolution

Possible states:

```text
STABLE
WATCH
RISING
HIGH_PRIORITY
CRITICAL_REVIEW
ACKNOWLEDGED
UNDER_ASSESSMENT
RESOLVED
```

---

# 24. Realtime Ward Updates

Priority changes should propagate to the Ward Radar without refresh.

Realtime events can include:

```text
OBSERVATION_UPDATED
SIGNAL_STATUS_CHANGED
APS_UPDATED
PRIORITY_CHANGED
TIMELINE_EVENT_CREATED
ACTION_ACKNOWLEDGED
```

The system should support:

- reconnect
- heartbeat
- sequence numbers
- duplicate suppression
- stale-event handling
- client recovery

---

# 25. Offline / Edge Operation

When supported by the deployment architecture, the system should degrade gracefully during connectivity loss.

Possible flow:

```text
Local sensing
↓
Local processing
↓
Local observation
↓
Local APS
↓
Local queue
↓
Network returns
↓
Synchronization
```

UI status should clearly show:

```text
ONLINE
DEGRADED
OFFLINE
SYNCING
```

---

# 26. Privacy Architecture

Core privacy invariant:

> **Raw patient video must not leave the edge processing environment.**

Raw video should not be:

- uploaded
- stored in the backend
- written to persistent disk
- included in logs
- sent to an LLM
- exposed through telemetry

Only the minimum numerical telemetry required by the system should leave the sensing layer.

---

# 27. AI Clinical Copilot

Optional secondary layer.

Allowed:

- summarize patient timeline
- explain deterministic APS changes
- generate SBAR draft
- identify missing information
- summarize clinical context

Not allowed:

- modifying APS
- modifying source data
- inventing vitals
- inventing events
- autonomous diagnosis
- autonomous treatment decisions
- overriding deterministic safety rules

All generated information must be traceable to source data.

---

# 28. SBAR

Generate:

## Situation
What is happening now?

## Background
Relevant context.

## Assessment
What has changed?

## Recommendation
What the clinician should verify or consider.

The SBAR must never invent missing data.

---

# 29. Deterministic Ward Simulation

AegisPulse should include a deterministic simulation mode.

Minimum scenarios:

### Stable

All patients remain stable.

### Gradual deterioration

One patient progressively deteriorates.

### Temporary spike

One patient's vitals spike temporarily and recover.

### Signal failure

Sensor becomes unreliable.

### Missing observation

Patient has stale information.

### Multiple deterioration

More than one patient changes.

### Recovery

Previously elevated patient improves.

---

# 30. Simulation Ground Truth

The simulation engine knows the hidden ground truth.

The normal clinical dashboard must NOT show that ground truth.

Ground truth is used only for:

- testing
- evaluation
- benchmark
- demo verification

---

# 31. Attention Prioritization Evaluation

AegisPulse should be evaluated not only on sensor accuracy but also on whether it prioritizes patients correctly.

Useful internal metrics:

## Attention Capture Rate

Percentage of patients requiring reassessment that enter the top N of the attention queue.

## Ranking Accuracy

Whether the highest-priority simulated patient reaches the appropriate queue position.

## False Attention Rate

How often noise or temporary spikes cause unnecessary prioritization.

## Time-to-Priority

How quickly a deteriorating patient moves into high priority after deterioration begins.

These should be clearly labeled as simulation/research metrics unless clinically validated.

---

# 32. rPPG Research Functions

Where implemented:

- dataset ingestion
- preprocessing
- algorithm comparison
- ground-truth comparison
- benchmark generation
- robustness testing
- confidence calibration
- failure analysis

Possible metrics:

- MAE
- RMSE
- correlation
- failure rate
- coverage
- confidence calibration
- latency

---

# 33. Robustness Testing

Test sensing against:

- motion
- talking
- head rotation
- occlusion
- low light
- brightness variation
- camera changes
- frame drops
- compression
- ROI instability
- camera disconnect

The system should fail safely and explicitly.

---

# 34. Hardware Support

## Minimum Demo Hardware

- laptop
- webcam
- stable lighting
- network when required

## Recommended

- external USB webcam
- stable monitor/display
- controlled lighting

## Backup

- simulation-only mode
- pre-recorded sensor input where appropriate

The product should not fail completely because the camera is unavailable.

---

# 35. System Health

Provide operational health indicators such as:

```text
Backend       HEALTHY
Database      HEALTHY
Realtime      CONNECTED
Camera        ACTIVE
Signal        GOOD
AI            AVAILABLE
Sync          ONLINE
```

Possible degraded state:

```text
Camera        LOW CONFIDENCE
Realtime      RECONNECTING
AI            UNAVAILABLE
```

Core monitoring should continue without the AI copilot.

---

# 36. Security Functions

A production-oriented implementation should include:

- authentication
- authorization
- ward-level access control
- secure sessions/tokens
- input validation
- API protection
- rate limiting
- secure headers
- secret management
- audit logging
- realtime authentication
- duplicate/replay protection
- safe error handling

---

# 37. Auditability

Important actions should be traceable:

```text
Observation
→ Calculation
→ APS change
→ Reason
→ Alert/attention state
→ Nurse action
```

This supports debugging, safety review, and system analysis.

---

# 38. Core User Experience

The nurse should be able to answer these within seconds:

1. **Who needs me?**
2. **Why?**
3. **How confident are we?**
4. **What changed?**
5. **What should I verify next?**

The UI should prioritize action rather than presenting a generic analytics dashboard.

---

# 39. Full End-to-End Working Flow

The intended complete flow is:

```text
Patient in ward
      ↓
Camera / sensor / clinical data
      ↓
Observation created
      ↓
Signal quality assessed
      ↓
Confidence assigned
      ↓
Baseline compared
      ↓
Trend calculated
      ↓
Velocity / persistence calculated
      ↓
MEWS / qSOFA calculated where applicable
      ↓
Information freshness evaluated
      ↓
APS calculated
      ↓
Patient enters/reorders attention queue
      ↓
WHY NOW explanation generated
      ↓
Nurse reviews patient
      ↓
Recommended human verification
      ↓
Nurse performs bedside assessment
      ↓
New trusted observation
      ↓
APS recalculated
      ↓
Priority increases/decreases/resolves
      ↓
Timeline updated
```

---

# 40. Hackathon “Golden Demo”

The complete demonstration should show:

```text
ONE NURSE
+
MANY PATIENTS
+
LIMITED ATTENTION
```

Then:

```text
All patients stable
        ↓
Temporary spike occurs
        ↓
AegisPulse does not overreact
        ↓
Sensor becomes unreliable for another patient
        ↓
AegisPulse shows uncertainty
        ↓
Target patient gradually deteriorates
        ↓
HR/RR trends rise
        ↓
APS rises
        ↓
Patient climbs the queue
        ↓
WHY NOW explains the change
        ↓
Nurse verifies patient
        ↓
New observation enters
        ↓
APS recalculates
        ↓
Patient improves
        ↓
Priority falls
```

---

# 41. What AegisPulse Is NOT

Do not position the product as:

- a replacement for certified bedside monitors
- a sepsis diagnosis system
- an autonomous medical decision maker
- an autonomous treatment system
- a replacement for nurses
- a raw-video surveillance system
- a guaranteed deterioration predictor
- a speculative cuffless blood-pressure device
- a fake webcam SpO2 monitor

---

# 42. Product Differentiator

The central distinction is:

```text
Traditional monitoring:

"What are the patient's numbers?"

AegisPulse:

"Which patient needs human attention next,
how confident are we,
and why?"
```

---

# 43. Feature Priority

## P0 — Core

- Ward Attention Radar
- APS
- WHY NOW
- Trend detection
- Velocity
- Persistence
- Signal quality
- Confidence
- Information freshness
- Nurse verification workflow
- Patient timeline
- Deterministic simulation
- Privacy-preserving sensing

## P1 — Important

- MEWS
- qSOFA
- Shock Index
- Laboratory context
- Realtime updates
- Alert fatigue controls
- SBAR
- Offline operation
- Robustness testing

## P2 — Secondary

- AI clinical copilot
- FHIR integration
- Advanced research dashboards
- Extensive interoperability

## Future / Research

- Advanced multimodal sensing
- Additional validated sensor sources
- Larger-scale clinical validation
- Advanced predictive modeling
- Production hospital integration

---

# 44. Final Product Definition

> **AegisPulse continuously gathers trusted physiological and clinical observations, detects meaningful deterioration trajectories, accounts for uncertainty and observation gaps, ranks patients by Attention Priority Score, explains why a patient's priority is changing, and guides the nurse toward the next human assessment.**

**Core philosophy:**

> **Not more alarms. Better attention.**
