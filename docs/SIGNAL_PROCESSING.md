# AegisPulse: Contactless Optical Signal Processing (rPPG)

**Document Status:** AUTHORITATIVE SIGNAL PROCESSING SPECIFICATION  
**Governing Standard:** `docs/SOURCE_OF_TRUTH.md`

---

## 1. Physical & Physiological Principles of rPPG

Remote Photoplethysmography (rPPG) is an optical sensing modality that measures microvascular blood volume pulsations beneath superficial skin tissue without direct physical contact.

### 1.1 The Optical Mechanism

1. **Light-Tissue Interaction**: Ambient room light penetrates the epidermal skin layer.
2. **Hemoglobin Absorption**: Oxyhemoglobin ($\text{HbO}_2$) and deoxyhemoglobin ($\text{Hb}$) exhibit distinct absorption spectra. In the visible spectrum, green light ($\sim 520\text{--}560\text{ nm}$) exhibits strong absorption by capillary blood while penetrating sufficiently into the dermal microvascular bed.
3. **Pulsatile Modulation (AC Component)**: With each systolic cardiac contraction, blood volume surges into facial capillaries, increasing light absorption and subtly dimming reflected green intensity. During diastole, capillary blood volume decreases, slightly increasing reflected light.
4. **Quasi-Static Reflection (DC Component)**: Static skin pigmentation (melanin), subcutaneous fat, and baseline tissue reflection form a large, slow-moving DC baseline.
5. **Modulation Depth**: The cardiac pulsatile AC component represents merely **$0.1\%\text{ to }1.0\%$** of the total reflected optical intensity. Extracting this micro-signal requires spatial averaging, color space projection, and bandpass filtering.

---

## 2. The 6-Stage Optical Pipeline

```
[STAGE 1: Frame Acquisition (30 FPS)]
  HTML5 <video> ──> getTracks() ──> Volatile RAM Buffer (HTMLCanvasElement)
       │
       ▼
[STAGE 2: Forehead ROI Selection]
  Upper facial quadrant crop (30% W × 18% H) ──> Spatial Mean RGB [R, G, B]
       │
       ▼
[STAGE 3: Temporal Buffering & Normalization]
  Sliding temporal window (N = 128 to 256 frames, 4.2 to 8.5 seconds)
  L2 temporal normalization: R_n = R / μ_R,  G_n = G / μ_G,  B_n = B / μ_B
       │
       ▼
[STAGE 4: Chrominance Projection (POS / CHROM)]
  Plane-Orthogonal-to-Skin (POS) projection: S = P_x - (σ_x / σ_y) * P_y
       │
       ▼
[STAGE 5: Digital Filtering & Peak Detection]
  4th-Order Zero-Phase Butterworth Bandpass (0.75 Hz – 3.33 Hz / 45–200 BPM)
  Dynamic threshold peak detection + Spectral FFT peak identification
       │
       ▼
[STAGE 6: Signal Quality Index (SQI) & Confidence Gating]
  SNR calculation: Cardiac band power vs out-of-band noise
  SQI < 0.30 ──> GATE OUTPUT (Flag POOR_SIGNAL, do not update vitals)
```

---

## 3. Algorithmic Implementations

All mathematical implementations are located in `research/rppg/src/algorithms/`.

### 3.1 Plane-Orthogonal-to-Skin (POS) Algorithm

- **Citation**: Wang W, den Brinker AC, Stuijk S, de Haan G. _Algorithmic Principles of Remote PPG._ IEEE Transactions on Biomedical Engineering, 2017; 64(7): 1479–1491.
- **Mathematical Formulation**:
  1. Temporal normalization of RGB channels over window length $L$:
     $$C_n(t) = \frac{C(t)}{\mu_C}$$
     Where $C \in \{R, G, B\}$.
  2. Projection onto skin-orthogonal chrominance axes:
     $$P_x = 3 R_n - 2 G_n$$
     $$P_y = 1.5 R_n + G_n - 1.5 B_n$$
  3. Signal synthesis combining projection planes:
     $$S(t) = P_x - \left(\frac{\sigma(P_x)}{\sigma(P_y)}\right) P_y$$
- **Advantage**: Mathematically eliminates diffuse specular illumination variations caused by minor subject motion under stable ambient lighting.

### 3.2 Chrominance-Based (CHROM) Algorithm

- **Citation**: de Haan G, Jeanne V. _Robust pulse rate from chrominance-based rPPG._ IEEE Transactions on Biomedical Engineering, 2013; 60(10): 2878–2886.
- **Formulation**:
  $$X_{\text{chrom}} = 3 R_n - 2 G_n$$
  $$Y_{\text{chrom}} = 1.5 R_n + G_n - 1.5 B_n$$
  $$S_{\text{chrom}} = X_{\text{chrom}} - \left(\frac{\text{std}(X_{\text{chrom}})}{\text{std}(Y_{\text{chrom}})}\right) Y_{\text{chrom}}$$

### 3.3 Green Baseline Method

- **Citation**: Verkruysse W, Svaasand LO, Nelson JS. _Remote plethysmographic imaging using ambient light._ Optics Express, 2008; 16(26): 21434–21445.
- Uses raw normalized green intensity: $S_{\text{green}}(t) = G_n(t) - 1.0$.
- Vulnerable to motion; serves as a baseline comparison.

---

## 4. Digital Signal Filtering & Parameter Extraction

### 4.1 Digital Bandpass Filter

- **Filter Topology**: 4th-order zero-phase Butterworth bandpass filter.
- **Cutoff Frequencies**:
  - Lower cutoff: $f_{\text{low}} = 0.75\text{ Hz}$ ($45\text{ BPM}$)
  - Upper cutoff: $f_{\text{high}} = 3.33\text{ Hz}$ ($200\text{ BPM}$)
- **Implementation**: `research/rppg/src/signal-processing/filter.ts`.

### 4.2 Heart Rate (HR) Extraction

- **FFT Spectral Peak**: Identifies the fundamental frequency $f_{\text{cardiac}}$ carrying maximum power within the cardiac band:
  $$\text{HR}_{\text{spectral}} = f_{\text{cardiac}} \times 60$$
- **Time-Domain Inter-Beat Interval (IBI)**: Zero-crossing peak detection with adaptive minimum refractory period ($300\text{ ms}$).

### 4.3 Respiratory Rate (RR) Estimation

- Derived from Respiratory Sinus Arrhythmia (RSA)—the subtle cyclic modulation of pulse rhythmicity during inhalation and exhalation—and low-frequency thoracic/nasal intensity modulation ($0.1\text{ to }0.5\text{ Hz}$ / $6\text{--}30\text{ breaths/min}$).

---

## 5. Signal Quality Index (SQI) & Failure States

### 5.1 Spectral Signal-to-Noise Ratio (SNR)

The Signal Quality Index evaluates whether a peak represents true pulsatile cardiac rhythm or non-cardiac noise:

$$\text{SNR}_{\text{spectral}} = 10 \log_{10} \left(\frac{\int_{f_{\text{peak}} - \delta}^{f_{\text{peak}} + \delta} P(f) \, df}{\int_{f_{\text{low}}}^{f_{\text{high}}} P(f) \, df - \int_{f_{\text{peak}} - \delta}^{f_{\text{peak}} + \delta} P(f) \, df}\right)$$

Where $\delta = 0.15\text{ Hz}$ (cardiac harmonic tolerance).

- **$\text{SQI} \ge 0.70$ (High Quality)**: Clear cardiac rhythm; confidence $1.0$.
- **$0.30 \le \text{SQI} < 0.70$ (Moderate Quality)**: Noisy rhythm; confidence scaled linearly.
- **$\text{SQI} < 0.30$ (Unreliable / Poor Signal)**: Cardiac peak indistinct; output gated.

### 5.2 Failure States & System Response

- **Head Movement / Talking**: Triggers high-amplitude non-pulsatile motion artifacts. SQI drops below threshold; system outputs `POOR_SIGNAL` and pauses vital updates.
- **Low Ambient Illuminance (< 30 Lux)**: Optical signal drops below camera sensor noise floor. System flags `INSUFFICIENT_LIGHT` and alerts clinician.
- **Subject Face Lost / Occluded**: If face tracking fails for $> 2.0$ seconds, system outputs `SIGNAL_LOST`.
- **Anti-Placebo Invariant**: In all failure states, **no vital is ever interpolated or fabricated**.

---

## 6. Clinical Equivalence & Boundaries

> [!IMPORTANT]
> **NOT CERTIFIED AS EQUIVALENT TO REGULATED MEDICAL MONITORS**  
> AegisPulse contactless optical rPPG is an investigational estimation modality. It is **NOT** a certified replacement for FDA/CDSCO cleared 3-lead or 5-lead ECG monitors, pulse oximeters, or invasive arterial lines.

### Prohibited Modalities

- **Webcam SpO2 is NOT supported**: Broadband RGB sensors under ambient lighting cannot resolve the dual-wavelength ($660\text{ nm} / 940\text{ nm}$) differential extinction ratio of oxygenated vs deoxygenated hemoglobin.
- **Webcam Blood Pressure is NOT supported**: Estimating blood pressure from facial video without individual calibration curves is clinically unproven and unsafe.
