# 🛡️ AegisPulse: Contactless Facial rPPG & Multi-Modal Clinical Triage System

[![VMedithon 3.0](https://img.shields.io/badge/Event-VMedithon%203.0%20(VIT%20Chennai)-00f0ff?style=for-the-badge)](https://vit.ac.in)
[![React 19](https://img.shields.io/badge/React-19.0-61dafb?style=for-the-badge&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-6.x-646cff?style=for-the-badge&logo=vite)](https://vitejs.dev)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind-v4.0-38bdf8?style=for-the-badge&logo=tailwindcss)](https://tailwindcss.com)
[![License](https://img.shields.io/badge/License-MIT-emerald?style=for-the-badge)](LICENSE)
[![Compliance](https://img.shields.io/badge/Compliance-HIPAA%20%7C%20DPDP%20Act%202023-purple?style=for-the-badge)](#privacy-and-zero-trust-architecture)

> **"Turning every camera into a life-saving clinical sentinel with zero added hardware."**

---

## 📑 Master Documentation Index

All in-depth research, financial models, presentation scripts, and technical specifications are documented across 7 comprehensive guides in the `docs/` directory:

| Document | Focus & Highlights | Target Audience |
| :--- | :--- | :--- |
| 📄 [**01. Academic Research Paper & Statistics**](file:///e:/My%20Development/AegisPulse/docs/01_RESEARCH_PAPER_EXTENDED_AND_STATISTICAL_BENCHMARKS.md) | Full journal-grade paper: Optical physics of POS rPPG, epidemiological mortality stats (IHCA, sepsis golden hour), exact benchmarking metrics against CMS50D ($r=0.962$, MAE 2.14 BPM, limits of agreement). | Researchers, IEEE/ACM Mentors, Biomedical Engineers |
| 🎯 [**02. Problem Statement & Solution Architecture**](file:///e:/My%20Development/AegisPulse/docs/02_PROBLEM_STATEMENT_AND_SOLUTION_ARCHITECTURE.md) | The 4-to-6-hour general ward blindspot, India's 1:40 nurse deficit, failure modes of prior art (wearables, wired telemetry), and how AegisPulse correctly solves it. | Healthcare Administrators, CMOs, Clinical Leads |
| 💰 [**03. Financial Feasibility, Scaling & Policy**](file:///e:/My%20Development/AegisPulse/docs/03_FINANCIAL_FEASIBILITY_SCALING_AND_GOVERNMENT_POLICY.md) | Exact unit economics (₹3,600 vs ₹3.5 Lakhs), phased rollout: Chennai (2,200 beds) $\to$ Tamil Nadu (45,000 beds, TNHSRP) $\to$ India (1M+ beds, ABDM), BIRAC/MeitY grant integration, and 24-month roadmap. | Health Economists, Government Officials, Investors |
| ⚙️ [**04. Technical Architecture & Developer Spec**](file:///e:/My%20Development/AegisPulse/docs/04_TECHNICAL_ARCHITECTURE_AND_DEVELOPER_SPEC.md) | Complete software architecture: React 19, POS projection algorithm, Butterworth bandpass filter, MEWS/qSOFA scoring, Express/SQLite backend, HL7/FHIR schemas, and threat modeling. | Senior Software Architects, CTOs, Full-Stack Developers |
| 📖 [**05. Master Technical Keywords Glossary**](file:///e:/My%20Development/AegisPulse/docs/05_TECHNICAL_KEYWORDS_GLOSSARY.md) | 26+ foundational keywords defined with simple analogies, formal scientific definitions, and system roles (rPPG, POS, MEWS, qSOFA, RMSSD, Lactate, SBAR, DPDP Act). | Non-Technical Founders, Students, Presenters |
| 🎭 [**06. Dual-Track Presentation Guide**](file:///e:/My%20Development/AegisPulse/docs/06_DUAL_PRESENTATION_GUIDE_ELIF5_AND_PROFESSIONAL.md) | Word-for-word scripts: **Track A (Explain to a 5-Year-Old)** using the magic camera story, vs. **Track B (Explain to a Healthcare Professional)** using high-density clinical hemodynamics. | Keynote Speakers, Pitch Presenters, Educators |
| 🎙️ [**07. Master Pitch Script & Judges FAQ**](file:///e:/My%20Development/AegisPulse/docs/07_MASTER_PITCH_SCRIPT_NATIONAL_CRISIS_AND_JUDGES_FAQ.md) | Framing as India's #1 National Healthcare Crisis, 2-minute clocked elevator pitch with shocking hook, 5 recurring CTAs, and 12 bulletproof technical/non-technical defense answers. | Hackathon Teams, Demo Presenters, Founders |
| 📊 [**08. Slide Deck Master Information**](file:///e:/My%20Development/AegisPulse/docs/03_SLIDE_DECK_MASTER_INFORMATION.md) | Slide-by-slide 12-slide master deck structure with spoken timings, speaker scripts, visual layouts, and jury tips for VMedithon 3.0. | Slide Deck Designers, Pitch Competitors |
| 🤖 [**09. AI Agent Master Knowledge Base & Roadmap (P0–P4)**](file:///e:/My%20Development/AegisPulse/docs/08_AI_AGENT_SYSTEM_CONTEXT_AND_INNOVATION_ROADMAP.md) | Dedicated master document for third-party AI agents: Cognitive grounding, architecture invariants, completed codebase state, open gaps, and a prioritized P0 to P4 innovation backlog. | AI Coding Assistants, Subagents, Autonomous Architect Agents |

---

## 🚨 The Healthcare Crisis We Solve

In modern hospitals worldwide, patients in intensive care units (ICUs) are monitored every second by wired monitors. But in **general medical-surgical wards—representing over 80% of all hospital beds—vitals are checked manually by nurses only once every 4 to 6 hours.**

- **The Dead Zone**: In India's public hospitals, night-shift nurse-to-patient ratios routinely reach **1:40 or 1:50** (vs. WHO mandate 1:3). Patients in general wards silently crash into septic shock or cardiac arrest between scheduled rounds.
- **1.2 Million Deaths**: Over **1.2 million inpatients die each year in India** from delayed identification of clinical deterioration. Up to **84% of these events show identifiable physiological warning signs 6 to 8 hours prior to collapse**.
- **The Hardware Barrier**: Equipping every bed with traditional wired telemetry costs **₹2,50,000 to ₹6,00,000 ($3,000–$8,000) per bed**, plus ongoing costs for single-use leads, cuffs, and probes.

---

## 💡 The AegisPulse Solution

AegisPulse eliminates this blindspot with **pure edge software and zero dedicated hardware**:
1. **Contactless rPPG Bio-Sensing**: Converts standard laptop, tablet, or smartphone webcams into calibrated hemodynamic sensors using the **Plane-Orthogonal-to-Skin (POS)** algorithm. Extracts sub-perceptual green-channel ($540\text{ nm}$) capillary absorption to calculate Heart Rate, Heart Rate Variability (HRV / RMSSD), and Respiratory Rate in under 5 seconds.
2. **Deterministic Clinical Intelligence**: Automatically calculates the **Modified Early Warning Score (MEWS 0–14)** and **Sepsis-3 qSOFA** score every 250 milliseconds to trigger Code Green, Yellow, or Red hospital alerts.
3. **Multi-Modal Laboratory Fusion**: Ingests patient hematology panels (Serum Lactate, White Blood Cells, Creatinine, Platelets) to differentiate benign tachycardia from systemic septic shock.
4. **Automated SBAR Emergency Copilot**: Instantly formats clinical handoffs into standardized **Situation, Background, Assessment, and Recommendation (SBAR)** dossiers with interactive resuscitation orders.
5. **Zero-Trust Ephemeral Privacy**: Video frames reside purely in volatile browser RAM and are overwritten every frame. **Zero video is ever saved to disk or transmitted across the internet**, ensuring strict compliance with India's **DPDP Act 2023** and **HIPAA**.

---

## 🏗️ High-Level System Architecture

```
[Patient in Bed] ──► [Webcam Video (30 FPS)] ──► [React 19 Client Runtime (Browser RAM)]
                                                              │
                     ┌────────────────────────────────────────┴────────────────────────────────────────┐
                     ▼                                        ▼                                        ▼
             [Forehead ROI]                           [POS Projection]                     [Butterworth Filter]
             (30% W × 18% H)                       (Cancels Specular Glare)                 (0.75 Hz – 3.33 Hz)
                     │                                        │                                        │
                     └────────────────────────────────────────┬────────────────────────────────────────┘
                                                              │
                                                              ▼
                                              [Peak Detection Zero-Crossing]
                                           (IBI Gating: 320ms – 1300ms / RMSSD)
                                                              │
                     ┌────────────────────────────────────────┴────────────────────────────────────────┐
                     ▼                                                                                 ▼
         [60 FPS Oscilloscope Canvas]                                                       [Clinical Risk Engine]
         (Live Arterial Pulse Line)                                                         (MEWS + qSOFA + Labs)
                                                                                                       │
                                                                                                       ▼
                                                                                           [Emergency SBAR Copilot]
                                                                                           (One-Click EHR Sync)
```

---

## ⚡ Quick Start & Developer Setup

### Prerequisites
- [Node.js](https://nodejs.org/) (v18.0 or higher recommended)
- [npm](https://www.npmjs.com/) (v9.0 or higher)
- A device with a working webcam (laptop, desktop USB camera, or tablet)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/CodeSorcerer-007/AegisPulse.git
cd AegisPulse

# 2. Install frontend dependencies
npm install

# 3. Install server dependencies
cd server
npm install
cd ..
```

### Running Locally

```bash
# Terminal 1: Start the Frontend Client (Vite Dev Server)
npm run dev

# Terminal 2: Start the Backend REST API & SQLite DB
cd server
npm run dev
```

Open your browser and navigate to:
```
http://localhost:5173
```
Grant camera permissions when prompted. The optical rPPG scanner will calibrate within 4.8 seconds.

---

## 🎮 Interactive Demo & Scenario Simulation

AegisPulse includes a built-in clinical simulation suite to demonstrate acute emergency workflows during presentations:

1. **Normal Sinus Rhythm (Code Green)**: Simulates a stable post-operative patient (HR: 72 BPM, RR: 16, MEWS: 0).
2. **Acute Tachycardia (Code Yellow)**: Simulates compensatory cardiovascular instability (HR: 126 BPM, RR: 24, MEWS: 3).
3. **Septic Shock Decompensation (Code Red)**: Simulates catastrophic septic shock (HR: 142 BPM, RR: 30, SBP: 78, Lactate: 3.4 mmol/L, MEWS: 6, qSOFA: 2). The UI flashes an emergency alert and automatically prepares the SBAR handoff dossier.

---

## 🔬 Empirical Benchmarking Summary

Evaluated against a certified Class IIa medical pulse oximeter (**Contec CMS50D**) across Fitzpatrick skin phototypes I–VI and illumination levels from 150 to 800 lux:

| Metric | Result | Benchmark Significance |
| :--- | :---: | :--- |
| **Mean Absolute Error (MAE)** | **2.14 BPM** | Within standard medical grade clinical tolerance ($\pm 3\text{ BPM}$) |
| **Pearson Correlation ($r$)** | **0.962** | Extreme linear concordance ($p < 0.0001$) |
| **Bland-Altman 95% Limits of Agreement** | **$-3.8\text{ to }+4.1\text{ BPM}$** | Minimal systematic bias ($+0.15\text{ BPM}$) |
| **Time to Initial Lock** | **$4.8\text{ seconds}$** | Sub-5-second rapid triage capability |
| **Client-Side CPU Overhead** | **$< 8\%$** | Lightweight execution on low-cost ward tablets |
| **Network Bandwidth Consumption** | **$0\text{ kbps}$ (Video)** | 100% on-device processing; only 120-byte JSON telemetry transmitted |

---

## 👥 The Team
- **Thenappan T** — *Systems Architect, Computer Vision & Full-Stack Engineering*  
  School of Computing, Department of Computer Science & Engineering, Sathyabama Institute of Science and Technology (SIST), Chennai, India.  
  GitHub: [@CodeSorcerer-007](https://github.com/CodeSorcerer-007) | Email: `thenappanmasterz1311@gmail.com`

---

## 📄 License
This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
