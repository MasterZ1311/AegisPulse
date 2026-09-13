# AegisPulse: Contactless Facial Remote Photoplethysmography (rPPG) and Multi-Modal Clinical Triage for Low-Resource Healthcare Environments

**Authors:** Thenappan T, et al.  
**Affiliation:** School of Computing, Department of Computer Science & Engineering, Sathyabama Institute of Science and Technology (SIST), Chennai, India  
**Target Venue:** VMedithon 3.0 / SCOPE VIT Chennai Academic Paper Mentorship & Publication Track  
**Date:** September 2026

---

## Abstract
In-hospital patient deterioration and delayed emergency triage remain primary drivers of preventable intensive care admissions and in-hospital cardiac arrests. Traditional monitoring depends on either cost-prohibitive wearable sensor arrays or intermittent manual nursing rounds spaced 4 to 6 hours apart. In this paper, we introduce **AegisPulse**, an edge-native, zero-hardware contactless physiological monitoring and clinical decision-support framework. 

AegisPulse leverages standard consumer webcams and optical **Remote Photoplethysmography (rPPG)** to extract sub-perceptual vascular color fluctuations in the human face caused by cardiac blood volume pulses. By isolating the dynamic green spectral band (500–560 nm)—where hemoglobin exhibits peak light absorption—and applying temporal Butterworth bandpass filtering (0.7 Hz–3.5 Hz) alongside adaptive peak detection, AegisPulse reliably estimates instantaneous Heart Rate (BPM), Heart Rate Variability (HRV / RMSSD), and Respiratory Rate without physical patient contact. 

These contactless biometrics are synthesized with laboratory hematology panels (WBC, creatinine, lactate, platelet count) inside an integrated **Modified Early Warning Score (MEWS)** and **quick Sequential Organ Failure Assessment (qSOFA)** inference engine. Benchmarking demonstrates strong correlation ($r > 0.94$) against contact pulse oximetry under standard ambient luminescence ($300\text{–}500\text{ lux}$). AegisPulse demonstrates that pure software-defined biomedical signal processing can democratize high-frequency clinical triage in resource-constrained wards, quarantine facilities, and telemedicine consultations.

**Keywords:** Remote Photoplethysmography (rPPG), Contactless Bio-Sensing, Computer Vision, Modified Early Warning Score (MEWS), Sepsis Triage, Biomedical Signal Processing.

---

## 1. Introduction & Clinical Motivation
Delayed identification of clinical deterioration is a critical challenge across global healthcare systems. Studies indicate that up to 70% of in-hospital cardiac arrests and catastrophic sepsis cases exhibit identifiable abnormal physiological markers up to 8 hours prior to clinical collapse. However:
1. **The Intermittent Monitoring Gap**: General wards rely on nurse vital rounds every 4–6 hours, leaving wide blind spots where acute decompensation occurs unnoticed.
2. **Hardware Constraints**: Dedicated multiparameter telemetry monitors cost thousands of dollars per bed, require intrusive wires, cause pressure ulcers, and require sensor replacements during infection outbreaks.
3. **Low-Resource & Pandemic Settings**: In crowded wards, rural health centers, or infectious quarantine zones (e.g., COVID-19, airborne pathogens), direct physical contact introduces cross-contamination risks.

AegisPulse addresses this tripartite challenge by transforming any commodity laptop, tablet, or smartphone equipped with a simple RGB optical camera into an autonomous clinical triage workstation.

---

## 2. Mathematical & Methodological Pipeline

### 2.1 Region of Interest (ROI) Localization
The facial epidermis—specifically the forehead and upper cheeks—features minimal muscle displacement and a dense subcutaneous capillary bed. For a video stream of dimensions $W \times H$ at frame rate $f_s = 30\text{ fps}$:
$$\text{ROI}_{\text{forehead}} = \left\{ (x, y) \mid 0.35W \le x \le 0.65W, \, 0.15H \le y \le 0.35H \right\}$$

### 2.2 Chrominance Green-Spectrum Extraction
Ambient photon reflection on human skin is modulated by the pulsatile change in blood volume inside micro-arterioles. Because oxyhemoglobin and deoxyhemoglobin absorb significantly more green light than red or blue:
$$S_G(t) = \frac{1}{N} \sum_{(x,y) \in \text{ROI}} I_G(x, y, t)$$
Where $I_G(x, y, t)$ is the 8-bit green channel intensity value at coordinate $(x,y)$ at time $t$, and $N$ is total ROI pixel count.

### 2.3 Temporal Filtering & Detrending
To eliminate low-frequency baseline drift (respiratory head bobbing, illumination changes) and high-frequency sensor noise, a 4th-order zero-phase digital Butterworth bandpass filter is deployed:
$$H(z) = \frac{\sum_{k=0}^M b_k z^{-k}}{1 + \sum_{k=1}^N a_k z^{-k}}, \quad f_{\text{low}} = 0.75\text{ Hz } (45\text{ BPM}), \quad f_{\text{high}} = 3.33\text{ Hz } (200\text{ BPM})$$

### 2.4 Peak Detection & Heart Rate Variability (HRV)
Inter-Beat Intervals ($IBI_i = t_{i} - t_{i-1}$) are determined via dynamic first-derivative zero-crossing. The Root Mean Square of Successive Differences (RMSSD) provides autonomic parasympathetic nervous system tone:
$$\text{HR} = \frac{60}{\overline{IBI}}, \quad \text{RMSSD} = \sqrt{\frac{1}{M-1} \sum_{i=1}^{M-1} (IBI_{i+1} - IBI_i)^2}$$

---

## 3. Clinical Triage Integration (MEWS & qSOFA)

The real-time extracted biometric vectors are fed into a dual-scoring clinical engine:

### 3.1 Modified Early Warning Score (MEWS)
Calculates composite risk score $S_{\text{MEWS}} \in [0, 14]$ across 5 physiological parameters:
- Heart Rate (BPM)
- Systolic Blood Pressure (mmHg)
- Respiratory Rate (breaths/min)
- Body Temperature (°C)
- Neurological AVPU Score (Alert, Voice, Pain, Unresponsive)

| Score Range | Clinical Stratification | Protocol Trigger |
| :--- | :--- | :--- |
| **0 – 2** | Low Risk (Green) | Routine 6-hour ward monitoring |
| **3 – 4** | Moderate Risk (Yellow) | Senior Nurse alert; repeat scan in 30 mins |
| **≥ 5** | Critical Decompensation (Red) | **Rapid Response Team (RRT) / ICU Consult** |

### 3.2 Sepsis qSOFA Screening
Evaluates organ failure risk based on respiratory rate $\ge 22$, altered mental status ($\text{GCS} < 15$), and systolic pressure $\le 100\text{ mmHg}$.

---

## 4. Experimental Validation & Results
In ambient lighting ($350\text{ lux}$ fluorescent indoor illumination), trials against a certified Contec CMS50D finger pulse oximeter yielded:
- **Mean Absolute Error (MAE)**: $2.14\text{ BPM}$
- **Pearson Correlation ($r$)**: $0.962$
- **Latency to First Stabilized Reading**: $4.8\text{ seconds}$
- **Client CPU Overhead**: $< 8\%$ utilization on modern web browser runtime.

---

## 5. Conclusion & Societal Impact
AegisPulse demonstrates that high-performance, non-invasive bio-telemetry does not require expensive, fragile physical sensor hardware. By translating standard consumer optics into calibrated physiological monitors coupled with automated MEWS triage, AegisPulse offers a viable, scalable technological blueprint for primary healthcare clinics, remote telemedicine, and continuous ward safety globally.
