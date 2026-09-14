# AegisPulse: Authoritative Changelog

All notable changes to the AegisPulse platform from the clean architectural baseline forward are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-09-14

### Clean Baseline Architecture Reset

This release marks the complete, authoritative documentation and architectural reset of AegisPulse, aligning the platform around its true identity as a **Patient Deterioration Radar & Nurse Attention Allocation Engine**.

#### Added

- **Attention Priority Score (APS: 0–100)**: Multi-vector deterministic ranking engine integrating physiological velocity, information decay ($D_{\text{time}}$), baseline MEWS, and biochemical stress markers (`packages/clinical/src/attentionPriority/`).
- **Validated Clinical Rule Engines**: Independent, deterministic calculators for Subbe MEWS (0–14) and Singer qSOFA (0–3) with explicit missing value uncertainty quantification (`packages/clinical/src/mews/`, `qsofa/`).
- **Bounded 15-Second Contactless rPPG**: Pure mathematical implementations of Plane-Orthogonal-to-Skin (POS) and Chrominance (CHROM) algorithms with 4th-order Butterworth bandpass filtering and dynamic SQI confidence gating (`research/rppg/`, `packages/signal/`).
- **Offline-First Resilience**: 4-state ward connectivity model (`ONLINE`, `DEGRADED`, `OFFLINE`, `SYNCING`) with monotonic client queuing and idempotent UUID batch synchronization (`apps/web/src/services/offline-sync-queue.ts`, `services/api/src/services/sync.service.ts`).
- **Red Team Defensive Hardening**: Regression verifications defending 10 adversarial attack vectors including future timestamp clock spoofing, raw video exfiltration, prompt injection, and replay attacks (`services/api/tests/red-team-security.test.ts`).
- **Standardized SBAR Dossier Generator**: Structured clinical handoff brief generator for Medical Emergency Team transfers (`packages/clinical/src/sbar/`).
- **Comprehensive Test Suite**: 69 test files comprising 515 passed tests across all packages (`npx vitest run`).
- **Authoritative Documentation System**: Unified 19-document public documentation architecture in `/docs`, governed by `docs/SOURCE_OF_TRUTH.md` and supported by `docs/CLAIMS_LEDGER.md`.

#### Changed

- **Product Re-Positioning**: Replaced obsolete "continuous 24/7 video telemetry monitor" positioning with "Patient Deterioration Radar & Nurse Attention Allocation Engine".
- **Optical Invariant Enforcement**: Mandated that all video frame buffers reside exclusively in volatile client RAM and are destroyed within 33 milliseconds.

#### Removed

- **Excised SpO2 Claims**: Permanently removed claims of contactless optical oxygen saturation calculation from ambient RGB webcams.
- **Excised Cuffless BP Claims**: Permanently removed claims of facial pulse transit time blood pressure estimation.
- **Excised Unverified Clinical Trial Claims**: Removed fabricated $N=48$ clinical trial claims ($r=0.962$, MAE $2.14\text{ BPM}$) in favor of reproducible synthetic benchmark datasets.
- **Excised Autonomous Diagnostic Claims**: Removed statements claiming autonomous diagnosis of sepsis or cardiac arrest.
- **Excised Multi-Bed Ceiling Camera Concepts**: Abandoned unviable 6-bed single wide-angle camera mesh.
