# AegisPulse: Clinical Logic & Mathematical Specification

**Document Status:** AUTHORITATIVE CLINICAL SPECIFICATION  
**Governing Standard:** `docs/SOURCE_OF_TRUTH.md`

---

## 1. Epistemic Taxonomy of System Logic

To ensure absolute scientific integrity, all algorithms and rules in AegisPulse are strictly categorized into four epistemic tiers:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   THE 4-TIER LOGIC TAXONOMY                                      │
├───────────────────────────┬──────────────────────────────────────────────────────────────────────┤
│ 1. VALIDATED CLINICAL     │ Peer-reviewed clinical consensus protocols with extensive            │
│    RULES                  │ multicenter validation (Subbe MEWS 2001, Singer qSOFA 2016).         │
├───────────────────────────┼──────────────────────────────────────────────────────────────────────┤
│ 2. RESEARCH HEURISTICS    │ Literature-grounded physiological derivatives (Physiological         │
│                           │ Velocity, Information Decay, Shock Index trajectory).                │
├───────────────────────────┼──────────────────────────────────────────────────────────────────────┤
│ 3. ENGINEERING            │ Deterministic filters designed to eliminate digital artifact         │
│    HEURISTICS             │ (temporal persistence dampening, SQI confidence gating, EMA).        │
├───────────────────────────┼──────────────────────────────────────────────────────────────────────┤
│ 4. SIMULATION             │ Synthetic scenarios and mathematical patient profiles used           │
│    BEHAVIOR               │ for reproducible benchmarking and demo stress-testing.               │
└───────────────────────────┴──────────────────────────────────────────────────────────────────────┘
```

---

## 2. Physiological Observations & Sanity Boundaries

All incoming physiological observations must pass strict biological sanity limits defined in `packages/types/src/schemas/vitals.ts`. Any reading outside these limits represents severe sensor artifact or hardware failure and is immediately rejected:

| Vital Parameter                        | Sanity Range | Unit        | Clinical Rationale                                                               |
| :------------------------------------- | :----------- | :---------- | :------------------------------------------------------------------------------- |
| **Heart Rate (HR)**                    | 20 – 300     | BPM         | Extreme limits of human survivability.                                           |
| **Respiratory Rate (RR)**              | 4 – 80       | breaths/min | Below 4 is apnea; above 80 is severe tachypnea/hyperventilation.                 |
| **Systolic Blood Pressure (SBP)**      | 30 – 300     | mmHg        | Below 30 is profound circulatory collapse; above 300 is hypertensive crisis.     |
| **Diastolic Blood Pressure (DBP)**     | 20 – 200     | mmHg        | Extreme physiological perfusion boundaries.                                      |
| **Body Temperature**                   | 25.0 – 45.0  | °C          | Below 25°C is profound hypothermia; above 45°C is fatal hyperpyrexia.            |
| **Oxygen Saturation ($\text{SpO}_2$)** | 50 – 100     | %           | Below 50% is incompatible with consciousness outside ECMO.                       |
| **Shock Index (SI)**                   | 0.1 – 5.0    | ratio       | $\text{SI} = \frac{\text{HR}}{\text{SBP}}$. Normal: 0.5–0.7; occult shock > 0.9. |

---

## 3. Validated Clinical Rules Layer

### 3.1 Modified Early Warning Score (MEWS)

- **Primary Citation**: Subbe CP, Kruger M, Rutherford P, Gemmel L. _Validation of a modified early warning score in medical admissions._ QJM, 2001; 94(10): 521–526.
- **Target Population**: Adult medical/surgical inpatients ($\ge 18$ years).
- **Parameters Evaluated**: SBP, HR, RR, Temperature, AVPU mentation.
- **Scoring Matrix (0–14 Points)**:

| Parameter                   | 3 Points |  2 Points  |  1 Point   |   0 Points    |   1 Point   |  2 Points   |      3 Points      |
| :-------------------------- | :------: | :--------: | :--------: | :-----------: | :---------: | :---------: | :----------------: |
| **Systolic BP (mmHg)**      | $\le 70$ | $71 - 80$  | $81 - 100$ |  $101 - 199$  |      —      |  $\ge 200$  |         —          |
| **Heart Rate (BPM)**        |    —     |  $\le 40$  | $41 - 50$  |  $51 - 100$   | $101 - 110$ | $111 - 129$ |     $\ge 130$      |
| **Respiratory Rate (/min)** |    —     |  $\le 8$   |     —      |   $9 - 14$    |  $15 - 20$  |  $21 - 29$  |      $\ge 30$      |
| **Body Temperature (°C)**   |    —     | $\le 35.0$ |     —      | $35.1 - 38.4$ |      —      | $\ge 38.5$  |         —          |
| **AVPU Response**           |    —     |     —      |     —      |  Alert (`A`)  | Voice (`V`) | Pain (`P`)  | Unresponsive (`U`) |

- **Handling of Missing Values**:  
  AegisPulse strictly forbids assuming unmeasured vitals are "normal" (0 points). If a parameter is missing:
  1. It is logged in `missingValues`.
  2. The system computes both `totalScore` (confirmed) and `maxPossibleScore` (worst-case envelope).
  3. An explicit **Uncertainty Factor** is generated:
     $$\text{Uncertainty} = \frac{\sum_{\text{missing}} \text{MaxPoints}_i}{14}$$

### 3.2 quick Sepsis-related Organ Failure Assessment (qSOFA)

- **Primary Citation**: Singer M, Deutschman CS, Seymour CW, et al. _The Third International Consensus Definitions for Sepsis and Septic Shock (Sepsis-3)._ JAMA, 2016; 315(8): 801–810.
- **Criteria (0–3 Points)**:
  - Respiratory Rate $\ge 22\text{ breaths/min}$ ($+1$)
  - Systolic Blood Pressure $\le 100\text{ mmHg}$ ($+1$)
  - Altered Mentation ($\text{AVPU} \ne \text{'A'}$ or $\text{GCS} < 15$) ($+1$)
- **Clinical Threshold**: A score $\ge 2$ indicates a positive qSOFA screen, carrying a 3- to 14-fold elevated risk of in-hospital mortality. It prompts immediate bedside workup and serum lactate measurement.

---

## 4. Research Heuristics: Physiological Trajectory & Information Decay

### 4.1 Physiological Velocity ($V_{\text{physio}}$)

Static vitals fail to detect compensatory physiological distress. AegisPulse computes continuous rate-of-change vectors over sliding observation windows ($\Delta t = 15\text{ to }60\text{ minutes}$):

$$V_{\text{physio}} = \alpha \left(\frac{\Delta \text{HR}}{\Delta t}\right) + \beta \left(\frac{\Delta \text{RR}}{\Delta t}\right) + \gamma \left(\frac{\Delta \text{SI}}{\Delta t}\right)$$

Where default calibrated weights are $\alpha = 0.35$, $\beta = 0.40$, $\gamma = 0.25$.

- _Clinical Example_: A patient whose Heart Rate increases from 76 to 98 BPM ($+28\%$) and Respiratory Rate from 14 to 20 breaths/min over 40 minutes generates a high velocity score even though both values remain technically inside traditional normal ranges.

### 4.2 Baseline Deviation

Quantifies the distance between a patient's current vital sign vector and their individualized pre-admission baseline ($\mu_{\text{baseline}}$):
$$\delta_{\text{baseline}} = \frac{|\text{Vital}_{\text{current}} - \mu_{\text{baseline}}|}{\sigma_{\text{baseline}}}$$

### 4.3 Information Decay ($D_{\text{time}}$)

In hospital wards, an unobserved patient is an uncertain patient. As time since the last verified bedside observation ($\Delta t = t - t_{\text{last}}$) increases, clinical certainty decays quadratically:

$$D_{\text{time}}(\Delta t) = 100 \times \left(1 - e^{-\lambda (\Delta t)^2}\right)$$

Where $\lambda$ is calibrated such that:

- $\Delta t = 1\text{ hour} \implies D_{\text{time}} \approx 8$ (negligible penalty)
- $\Delta t = 2\text{ hours} \implies D_{\text{time}} \approx 28$ (moderate reminder)
- $\Delta t = 3.5\text{ hours} \implies D_{\text{time}} \approx 68$ (high priority prompt)
- $\Delta t \ge 4.5\text{ hours} \implies D_{\text{time}} \ge 90$ (critical observation overdue)

---

## 5. Engineering Heuristics: Artifact Suppression & Quality Gating

### 5.1 Temporal Persistence Filter

Transient spikes (e.g. coughing fit, laughing, brief exertion) can cause temporary heart rate jumps. To prevent false alarms:

- A vital abnormality must persist across consecutive observation windows before triggering a high-velocity escalation.
- Velocity values are smoothed using an Exponential Moving Average (EMA, $\alpha = 0.3$).

### 5.2 Signal Quality Index (SQI) & Confidence Penalty

When optical rPPG or wearable sensors experience motion artifacts or poor lighting, the raw Signal Quality Index drops:

- If $\text{SQI} < 0.30$ (SNR < -3 dB): Observation is marked `POOR_SIGNAL`; vitals are **not updated**.
- An explicit **Confidence Penalty** is applied to the patient's record, increasing epistemic uncertainty and raising the bed's priority for manual nurse verification.

---

## 6. The Master Formulation: Attention Priority Score (APS)

The Attention Priority Score ($APS \in [0, 100]$) is computed as:

$$APS = \text{clamp}\left(w_v \cdot V_{\text{physio}} + w_d \cdot D_{\text{time}} + w_m \cdot \left(\frac{S_{\text{mews}}}{14} \times 100\right) + w_l \cdot L_{\text{biomarker}}, \, 0, \, 100\right)$$

Where default component weights are:

- $w_v = 0.35$ (Physiological Velocity)
- $w_d = 0.25$ (Information Decay)
- $w_m = 0.25$ (Baseline MEWS Acuity)
- $w_l = 0.15$ (Biochemical Stress / Labs)

### 6.1 Critical Floor Overrides

To ensure that severe single-parameter failures cannot be masked by low decay or normal baseline vitals:

- If Subbe MEWS $\ge 5 \implies APS \ge 80$ (Floor Override to `CRITICAL_REVIEW`).
- If Shock Index $\ge 1.30 \implies APS \ge 80$.
- If Singer qSOFA $\ge 2 \implies APS \ge 75$.

---

## 7. What APS DOES and DOES NOT Mean

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                     EPISTEMIC BOUNDARIES OF APS                                   │
├──────────────────────────────────────────────────┬───────────────────────────────────────────────┤
│ WHAT APS DOES MEAN                               │ WHAT APS DOES NOT MEAN                        │
├──────────────────────────────────────────────────┼───────────────────────────────────────────────┤
│ • Relative operational urgency for nurse review  │ • It is NOT a probability of mortality (death)│
│ • Rank order of beds in an attention queue       │ • It is NOT a probability of sepsis           │
│ • Synthesis of rate-of-change and information age│ • It is NOT a medical diagnosis               │
│ • A prompt for human bedside physical assessment │ • It is NOT a prescription for medical action │
└──────────────────────────────────────────────────┴───────────────────────────────────────────────┘
```

> [!CAUTION]
> **Never report APS as a diagnostic percentage.** Calling an APS of 85 "an 85% probability of septic shock" is medically false and clinically dangerous. It represents an 85/100 urgency score indicating that the patient's physiological trajectory warrants immediate bedside clinical evaluation.
