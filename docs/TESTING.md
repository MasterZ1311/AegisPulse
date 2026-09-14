# AegisPulse: Automated Testing & Verification Program

**Document Status:** AUTHORITATIVE TESTING SPECIFICATION  
**Governing Standard:** `docs/SOURCE_OF_TRUTH.md`  
**Test Framework:** Vitest v3.0.7, tsx TypeScript Execution Engine

---

## 1. Test Suite Summary & Measured Results

The AegisPulse test suite contains **69 test suites** comprising **515 individual automated tests**.

```
Test Files  69 passed (69)
     Tests  515 passed (515)
  Duration  25.73s
Coverage    100% of critical clinical calculation paths & red-team vectors
```

---

## 2. Test Taxonomy

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                     AEGISPULSE TEST TAXONOMY                                     │
├───────────────────────────┬──────────────────────────────────────────────────────────────────────┤
│ 1. CLINICAL RULE TESTS    │ Deterministic Subbe MEWS (0–14) and Singer qSOFA (0–3) accuracy,     │
│    (packages/clinical)    │ uncertainty factor handling, missing vitals envelopes, boundary math.│
├───────────────────────────┼──────────────────────────────────────────────────────────────────────┤
│ 2. ATTENTION ENGINE TESTS │ Boundedness of APS score in [0, 100] across 500 random inputs,       │
│    (packages/clinical)    │ velocity weighting, information decay curves, critical floors.       │
├───────────────────────────┼──────────────────────────────────────────────────────────────────────┤
│ 3. SIGNAL & DSP TESTS     │ POS, CHROM, and Green chrominance projections, Butterworth filter    │
│    (research/rppg, signal)│ stability, peak detection, and SQI spectral SNR calculation.         │
├───────────────────────────┼──────────────────────────────────────────────────────────────────────┤
│ 4. RED-TEAM SECURITY TESTS│ 10 adversarial vectors: future timestamp spoofing, video rejection,  │
│    (services/api)         │ prompt injection, diagnostic refusal, replay defense, rate limiting. │
├───────────────────────────┼──────────────────────────────────────────────────────────────────────┤
│ 5. PERSISTENCE TESTS      │ SQLite WAL transactions, migrations, foreign key cascading, CRUD    │
│    (packages/persistence) │ integrity, backup/restore fidelity, prepared statement security.     │
├───────────────────────────┼──────────────────────────────────────────────────────────────────────┤
│ 6. SIMULATION TESTS       │ PRNG determinism, ground truth isolation, 6-patient deterioration   │
│    (packages/simulation)  │ trajectories, clock acceleration, phenomenon injection.              │
├───────────────────────────┼──────────────────────────────────────────────────────────────────────┤
│ 7. OFFLINE SYNC TESTS     │ Monotonic client queuing, UUID idempotency, conflict resolution,    │
│    (services/api, web)    │ reconnection backoff, stale item rejection.                          │
├───────────────────────────┼──────────────────────────────────────────────────────────────────────┤
│ 8. END-TO-END SCENARIOS   │ Flagship 10-scenario suite verifying multi-bed ward triage under     │
│    (tests/e2e)            │ clinical stress (septic shock, hemorrhagic shock, recovery).         │
└───────────────────────────┴──────────────────────────────────────────────────────────────────────┘
```

---

## 3. How to Run Test Suites

### 3.1 Run Complete Vitest Suite

```bash
# Execute all 515 tests synchronously
npx vitest run

# Run with file watcher for development
npm run test:watch
```

### 3.2 Run Specific Package Tests

```bash
# Clinical calculation & rule tests
npx vitest run packages/clinical/tests

# Security and API integration tests
npx vitest run services/api/tests

# Contactless rPPG DSP tests
npx vitest run research/rppg/tests

# Flagship End-to-End Scenarios 1–10
npx vitest run tests/e2e/flagship-scenarios.test.ts
```

### 3.3 Run Scientific Benchmark Suite

Evaluates rPPG algorithm performance across motion and skin tone partitions:

```bash
npm run benchmark:science
```

### 3.4 Run Performance & Ingestion Load Tests

Benchmarks SQLite write throughput and telemetry pipeline under 50 simultaneous beds:

```bash
npm run benchmark:perf
```

---

## 4. Key Verified Invariants

### 4.1 Bounded Score Invariant (500 Random Samples)

- **Test**: `packages/clinical/tests/attentionPriority.test.ts`
- **Verification**: Generates 500 random permutations of HR (20–250), SBP (40–250), RR (6–60), Temp (30–42), and Decay time (0–480 mins).
- **Result**: In 100% of cases, $0 \le APS \le 100$. Clamping and critical floor overrides execute deterministically without numerical overflow or `NaN`.

### 4.2 Anti-Placebo Invariant (Zero Hallucination on Signal Loss)

- **Test**: `packages/signal/tests/sensor-provider.test.ts`
- **Verification**: When optical signal drops below -3 dB SNR or face tracking is lost, output is gated.
- **Result**: System outputs `POOR_SIGNAL`; zero vitals are fabricated.

### 4.3 Red Team Vector 2 (Zero Raw Video Ingestion)

- **Test**: `services/api/tests/red-team-security.test.ts`
- **Verification**: Injects payloads containing `rawVideo`, `frameBuffer`, base64 image strings, and payloads $> 50\text{ KB}$.
- **Result**: 100% rejected with HTTP 400 Bad Request; logged to security audit ledger.
