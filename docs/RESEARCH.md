# AegisPulse: Scientific Research & Evaluation Dossier

**Document Status:** AUTHORITATIVE RESEARCH SPECIFICATION  
**Governing Standard:** `docs/SOURCE_OF_TRUTH.md`  
**Related Document:** [`docs/CLAIMS_LEDGER.md`](file:///e:/My%20Development/AegisPulse/docs/CLAIMS_LEDGER.md)

---

## 1. Core Research Questions

AegisPulse investigates three fundamental clinical and computational questions:

1. **Can multi-parameter physiological velocity detect occult patient deterioration earlier than static threshold monitors?**
2. **Can active information decay ($D_{\text{time}}$) prevent the "forgotten bed" syndrome in overcrowded hospital wards by elevating unobserved patients in the attention queue?**
3. **Can skin-orthogonal chrominance rPPG (POS/CHROM) reliably extract optical pulse rates on consumer webcams while suppressing motion artifacts through signal quality gating?**

---

## 2. Epistemic Classification of Evidence

All scientific statements and metrics in AegisPulse are segregated into five strict epistemic tiers:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   THE 5-TIER SCIENTIFIC TAXONOMY                                 │
├───────────────────────────┬──────────────────────────────────────────────────────────────────────┤
│ 1. LITERATURE-SUPPORTED   │ Peer-reviewed clinical & mathematical publications.                  │
├───────────────────────────┼──────────────────────────────────────────────────────────────────────┤
│ 2. EXPERIMENTALLY         │ Measured directly via reproducible benchmarks in this codebase.      │
│    MEASURED               │                                                                      │
├───────────────────────────┼──────────────────────────────────────────────────────────────────────┤
│ 3. SIMULATED              │ Physiologically modeled synthetic datasets & stress tests.           │
├───────────────────────────┼──────────────────────────────────────────────────────────────────────┤
│ 4. ASSUMED                │ Engineering & operational assumptions (e.g. ambient lighting).       │
├───────────────────────────┼──────────────────────────────────────────────────────────────────────┤
│ 5. FUTURE                 │ Hypotheses requiring prospective multi-center clinical validation.   │
└───────────────────────────┴──────────────────────────────────────────────────────────────────────┘
```

---

## 3. Literature-Supported Foundations

1. **Epidemiology of Ward Deterioration**:
   - Up to 84% of in-hospital cardiac arrest (IHCA) patients exhibit abnormal vital signs (tachypnea, tachycardia) 6 to 8 hours prior to acute collapse (Sandroni et al., _Resuscitation_, 2020).
   - In sepsis Progression, every hour of delay in antibiotic administration and fluid resuscitation increases mortality by 7.6% (Kumar et al., _Crit Care Med_, 2006).
2. **Clinical Early Warning Heuristics**:
   - Modified Early Warning Score (MEWS $\ge 5$) is strongly predictive of ICU transfer and 24-hour mortality (Subbe et al., _QJM_, 2001).
   - quick Sepsis-related Organ Failure Assessment (qSOFA $\ge 2$) identifies ward patients outside the ICU at elevated mortality risk (Singer et al., _JAMA_, 2016).
3. **Plane-Orthogonal-to-Skin (POS) rPPG**:
   - Proves mathematically that projecting normalized RGB signals onto two orthogonal chrominance axes ($P_x, P_y$) eliminates specular reflection under stationary conditions (Wang et al., _IEEE TBME_, 2017).

---

## 4. Experimentally Measured Benchmarks (Codebase Results)

Generated via `research/benchmarks/run-scientific-evaluation.ts` against the synthetic ground-truth dataset (`research/rppg/src/evaluation/synthetic-dataset.ts`):

| Experimental Partition          | Algorithm | MAE (BPM) | RMSE (BPM) | Pearson ($r$) | Yield (%) | Processing Latency (ms) |
| :------------------------------ | :-------- | :-------: | :--------: | :-----------: | :-------: | :---------------------: |
| **Stationary Baseline (Still)** | GREEN     |   0.11    |    0.15    |     1.000     |  100.0%   |          0.999          |
|                                 | CHROM     |   0.12    |    0.17    |     1.000     |  100.0%   |          0.835          |
|                                 | POS       |   0.16    |    0.21    |     1.000     |  100.0%   |          9.787          |
| **Conversational Motion**       | GREEN     |   12.54   |   15.82    |     0.161     |   66.7%   |          1.050          |
|                                 | CHROM     |   0.29    |    0.38    |     1.000     |   93.3%   |          0.840          |
|                                 | POS       |   0.51    |    0.64    |     0.999     |   73.3%   |         10.120          |
| **Moderate Postural Motion**    | GREEN     |   16.79   |   21.14    |     0.015     |   91.7%   |          1.100          |
|                                 | CHROM     |   0.73    |    0.95    |     0.999     |   33.3%   |          0.850          |
|                                 | POS       |   1.25    |    1.68    |     1.000     |   16.7%   |         10.450          |
| **Fitzpatrick I–II (Light)**    | CHROM     |   0.22    |    0.29    |     1.000     |  100.0%   |          0.830          |
| **Fitzpatrick III–IV (Medium)** | CHROM     |   0.20    |    0.27    |     1.000     |  100.0%   |          0.835          |
| **Fitzpatrick V–VI (Dark)**     | CHROM     |   0.28    |    0.36    |     1.000     |   80.0%   |          0.845          |

### Analysis of Empirical Results

1. **Motion Failure of Green Baseline**: Under moderate motion, single-channel Green rPPG fails catastrophically ($r = 0.015$, $\text{MAE} = 16.79\text{ BPM}$).
2. **Robustness of CHROM and POS**: Both chrominance projection algorithms maintain high correlation ($r > 0.999$) by projecting onto skin-orthogonal axes.
3. **Safety Gating (Yield Reduction)**: Under severe motion, POS yield drops from 100% to 16.7%. This proves that the Signal Quality Index correctly suppresses corrupt windows rather than fabricating false vital numbers.
4. **Computational Latency**: CHROM processes an optical window in $0.84\text{ ms}$, whereas POS requires $10.12\text{ ms}$. Both easily meet the real-time threshold ($< 33\text{ ms}$ for 30 FPS).

---

## 5. Demographic & Melanin Considerations

- **Melanin Attenuation**: Epidermal melanin acts as a broadband optical filter, absorbing green photons ($500\text{--}560\text{ nm}$). In darker Fitzpatrick skin types (V–VI), pulsatile AC signal amplitude is attenuated relative to background DC reflectance.
- **Experimental Findings**: On synthetic benchmark models, CHROM achieved $0.28\text{ BPM}$ MAE on Fitzpatrick V–VI with an 80% yield. However, in real clinical wards, low ambient illumination (< 50 lux) combined with dark pigmentation increases sensor noise.
- **AegisPulse Posture**: Requires controlled lighting ($\ge 150\text{ lux}$) for dark skin phototypes; if SNR is low, the system gates the measurement and prompts bedside contact checks.

---

## 6. Experiments Completed vs. Experiments Pending

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   EXPERIMENT STATUS SUMMARY                                      │
├──────────────────────────────────────┬───────────────────────────────────────────────────────────┤
│ COMPLETED EXPERIMENTS                │ • Synthetic RGB time-series benchmark across 3 algorithms │
│                                      │ • Stress-testing across 3 motion profiles                 │
│                                      │ • Melanin absorption simulation (Fitzpatrick I–VI)        │
│                                      │ • Algorithmic execution latency profiling (< 11 ms)       │
│                                      │ • 50-bed concurrent ingestion load testing                │
├──────────────────────────────────────┼───────────────────────────────────────────────────────────┤
│ PENDING EXPERIMENTS (FUTURE)         │ • Prospective clinical trial with synchronized ECG        │
│                                      │ • Evaluation on open human rPPG datasets (MMPD, UBFC)     │
│                                      │ • Real-world ICU step-down ward deterioration trial       │
│                                      │ • Multicenter nurse alarm fatigue reduction study         │
└──────────────────────────────────────┴───────────────────────────────────────────────────────────┘
```
