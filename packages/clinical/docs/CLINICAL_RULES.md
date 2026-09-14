# AegisPulse Clinical Rule Layer Specification

This document defines the clinical scope, physiological definitions, mathematical formulations, and explicit limitations of the standalone **Modified Early Warning Score (MEWS)** and **quick Sepsis-related Organ Failure Assessment (qSOFA)** rule engines in AegisPulse.

---

## 1. Modified Early Warning Score (MEWS)

### 1.1 Citation & Foundation
- **Primary Citation**: Subbe CP, Kruger M, Rutherford P, Gemmel L. *Validation of a modified early warning score in medical admissions.* QJM: An International Journal of Medicine, 2001; 94(10): 521–526. DOI: [10.1093/qjmed/94.10.521](https://doi.org/10.1093/qjmed/94.10.521).
- **Target Population**: Adult patients ($\ge 18$ years) admitted to general inpatient medical and surgical wards.

### 1.2 Physiological Parameters & Scoring Matrix

The Subbe et al. MEWS evaluates five bedside physiological parameters:

| Parameter | 3 Points | 2 Points | 1 Point | 0 Points | 1 Point | 2 Points | 3 Points |
|---|---|---|---|---|---|---|---|
| **Systolic BP (mmHg)** | $\le 70$ | $71 - 80$ | $81 - 100$ | $101 - 199$ | — | $\ge 200$ | — |
| **Heart Rate (BPM)** | — | $\le 40$ | $41 - 50$ | $51 - 100$ | $101 - 110$ | $111 - 129$ | $\ge 130$ |
| **Respiratory Rate (breaths/min)** | — | $\le 8$ | — | $9 - 14$ | $15 - 20$ | $21 - 29$ | $\ge 30$ |
| **Body Temperature (°C)** | — | $\le 35.0$ | — | $35.1 - 38.4$ | — | $\ge 38.5$ | — |
| **AVPU Response** | — | — | — | Alert (`A`) | Reacting to Voice (`V`) | Reacting to Pain (`P`) | Unresponsive (`U`) |

- **Total Score Range**: $0$ to $14$.
- **Clinical Triage Bands**:
  - **Green (Low Risk)**: $0 - 2$ points. Standard routine nursing observations.
  - **Yellow (Moderate Risk)**: $3 - 4$ points. Increase observation frequency; bedside review by registered nurse.
  - **Red (Critical Risk)**: $\ge 5$ points. Statistically correlated with increased risk of intensive care unit (ICU) admission and in-hospital mortality. Triggers immediate escalation to on-duty physician or Medical Emergency Team (MET).

### 1.3 Handling of Missing Data & Uncertainty
In bedside general ward practice, vitals are often measured asynchronously. **AegisPulse strictly forbids silently substituting missing values with normal (0-point) numbers.**
- If a parameter is unmeasured, it is reported in `missingValues`.
- An explicit **Uncertainty Factor** ($\in [0.0, 1.0]$) is computed:
  $$\text{Uncertainty} = \frac{\sum_{\text{missing}} \text{MaxPossiblePoints}_i}{14}$$
- The engine computes both the verified `totalScore` and the `maxPossibleScore` envelope:
  $$\text{maxPossibleScore} = \text{totalScore} + \sum_{\text{missing}} \text{MaxPossiblePoints}_i$$

---

## 2. quick Sepsis-related Organ Failure Assessment (qSOFA)

### 2.1 Citation & Foundation
- **Primary Citation**: Singer M, Deutschman CS, Seymour CW, et al. *The Third International Consensus Definitions for Sepsis and Septic Shock (Sepsis-3).* JAMA, 2016; 315(8): 801–810. DOI: [10.1001/jama.2016.0287](https://doi.org/10.1001/jama.2016.0287).
- **Secondary Citation**: Seymour CW, Liu VX, Iwashyna TJ, et al. *Assessment of Clinical Criteria for Sepsis: For the Third International Consensus Definitions for Sepsis and Septic Shock (Sepsis-3).* JAMA, 2016; 315(8): 762–774.

### 2.2 Clinical Criteria & Scoring Matrix

qSOFA serves as an easy-to-calculate bedside tool identifying patients with suspected infection outside the ICU who are at elevated risk of in-hospital mortality or ICU stay $> 3$ days.

| Criteria | Cutoff | Points |
|---|---|---|
| **Respiratory Rate** | $\ge 22\text{ breaths/min}$ (tachypnea) | $+1$ |
| **Systolic Blood Pressure** | $\le 100\text{ mmHg}$ (hypotension) | $+1$ |
| **Altered Mentation** | $\text{AVPU} \ne \text{'A'}$ (i.e. 'V', 'P', 'U') or $\text{Glasgow Coma Scale} < 15$ | $+1$ |

- **Total Score Range**: $0$ to $3$.
- **Clinical Action Threshold**:
  - Score $0$: Negative screen.
  - Score $1$: Borderline. Close monitoring for progression.
  - Score $\ge 2$: **Positive qSOFA Screen**. Associated with a 3- to 14-fold increase in in-hospital mortality. Prompts rapid clinical evaluation for organ dysfunction, serum lactate measurement, and sepsis resuscitation protocol activation.

### 2.3 Handling of Missing Data
- Any unmeasured criterion is flagged in `missingValues`.
- `uncertainty = missingCriteriaCount / 3`.
- `maxPossibleScore = totalScore + missingCriteriaCount`.
- If 2 criteria are positive and 1 is missing, `isPositive` is already definitively `true` ($\ge 2$).
- If 1 criterion is positive and 1 or 2 are missing, the patient is flagged with high uncertainty.

---

## 3. Explicit Clinical Claims & Non-Claims

### 3.1 What the Engine DOES Claim
1. **Mathematical Exactness**: The calculation of MEWS and qSOFA is 100% deterministic, bug-free, and adheres strictly to the peer-reviewed Subbe et al. (2001) and Singer et al. (2016) specifications.
2. **Total Auditability**: Every result outputs contributing variables, exact points, timestamps, missing values, and calculation provenance.
3. **No Phantom Baseline Assumption**: Missing parameters are explicitly surfaced to clinicians rather than assumed normal.
4. **Decoupled Architecture**: MEWS and qSOFA operate independently from the AegisPulse Attention Priority Score (APS), serving as modular inputs into the broader hospital triage radar.

### 3.2 What the Engine DOES NOT Claim
1. **Not a Diagnostic Medical Device**: MEWS and qSOFA are clinical risk assessment heuristics, **not** definitive diagnostic tools. A high MEWS or positive qSOFA does not prove the presence of infection or sepsis, nor does a low score rule out critical illness.
2. **Not an Autonomous Treatment Prescriber**: The rule engines do not prescribe antibiotics, fluid resuscitation, vasopressors, or specific medical interventions. All treatment decisions require human clinical evaluation.
3. **Not Validated for Pediatric or Obstetric Populations**: Standard MEWS and qSOFA thresholds are calibrated exclusively for non-pregnant adult general ward patients. Pediatric early warning (PEWS) and modified obstetric early warning (MEOWS) systems must be used for those cohorts.
4. **Not a Substitute for Laboratory SOFA**: qSOFA is a rapid bedside screening tool and does not replace the complete 6-organ Sequential Organ Failure Assessment (SOFA) score used in intensive care units.
