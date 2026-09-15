# AegisPulse Realtime Reliability & Streaming Architecture Specification

## 1. Executive Summary

This document specifies the architecture, resilience invariants, and verification methodologies of the **AegisPulse Realtime Telemetry and Streaming Subsystem**. AegisPulse is an acute clinical early-warning and deterioration radar platform. Clinical telemetry data (vital signs, continuous Attention Priority Scores [APS], signal quality indexes [SQI], and rapid response team activations) must be transported from bedside sensors to centralized nurse command stations with mathematical determinism, zero clinical rollbacks, and instant fault visibility.

### Non-Negotiable Realtime Invariants

1. **Zero Clinical Rollback Guarantee:** Delayed, retransmitted, or out-of-order packets must never overwrite newer clinical state. If an observation packet arrives with sequence `seq < lastAppliedSeq` and timestamp `ts <= lastAppliedTimestamp`, it is rejected by the client-side Anti-Rollback Guard.
2. **Zero Silent Freezes (Dead-Man Watchdog):** A half-open or silently dropped TCP connection must be detected within $2.5\times$ the heartbeat interval ($37.5\text{ s}$). When silence exceeds this threshold, the client immediately terminates the dead socket, transitions UI status to `RECONNECTING`, displays an amber banner, and initiates exponential backoff reconnects.
3. **Idempotent Timeline & Alert Deduplication:** Network retries, repeated acknowledgements, or event replay batches must never create duplicate alert banners or duplicate clinical timeline entries.
4. **Server Reboot Detection & Instant State Resynchronization:** Every handshake transmits a unique `serverInstanceId` and `serverBootTimestamp`. If a client reconnects and observes a modified server instance ID, it resets its sequence counters and requests an authoritative `SNAPSHOT` to prevent stale sequence synchronization.
5. **Slow Client Backpressure Protection:** High-frequency lossy vital sign updates (`OBSERVATION_UPDATED`) are dropped if a slow client's WebSocket buffer exceeds 64 KB, protecting memory and guaranteeing delivery of critical priority alerts.

---

## 2. Stream Protocol Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      BEDSIDE PATIENT SENSORS                            │
│           (rPPG Optical Camera, Wearable Biosensors, Labs)              │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     AEGISPULSE CORE INGESTION API                       │
│    - Authoritative Ingestion Validation & Cryptographic Guard           │
│    - Deterministic APS Calculation Engine (Zero Black Box ML)           │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       EVENT BROADCASTER (API)                           │
│    - Monotonic Sequence Generator (seq = 1, 2, 3, ...)                  │
│    - In-Memory Circular Replay Buffer (Capacity: 500 Envelopes)         │
│    - Deduplication Ledger by unique eventId                             │
└──────────────────┬──────────────────────────────────┬───────────────────┘
                   │                                  │
                   ▼ (Ward Isolation)                 ▼ (Ward Isolation)
┌──────────────────────────────────────┐   ┌──────────────────────────────┐
│       WEBSOCKET BROKER (WARD A)      │   │   WEBSOCKET BROKER (WARD B)  │
│  - Handshake: srvId + bootTimestamp  │   │  - Max Buffer: 64 KB         │
│  - Heartbeat: PING / PONG (15s)      │   │  - Slow Client Drop Guard    │
└──────────────────┬───────────────────┘   └──────────────┬───────────────┘
                   │                                      │
                   ▼                                      ▼
┌──────────────────────────────────────┐   ┌──────────────────────────────┐
│       CENTRAL WARD DASHBOARD         │   │      MOBILE NURSE TABLET     │
│  - Resequencing Buffer (Gap Delay)   │   │  - Offline Action Queue      │
│  - Dead-Man Watchdog (37.5s Timeout) │   │  - Reconnecting UI Banners   │
│  - Anti-Rollback State Machine       │   │  - Zero Stale Freezes        │
└──────────────────────────────────────┘   └──────────────────────────────┘
```

### 2.1 Handshake Specification

Upon establishing a connection to `/api/v1/stream/ws`, the server transmits a `CONNECTED` envelope:

```json
{
  "type": "CONNECTED",
  "clientId": "client-1789481166-abc123",
  "serverInstanceId": "srv-1789481166235-iq1wix",
  "serverBootTimestamp": 1789481166235,
  "serverTimestamp": 1789481166250,
  "currentSequenceNumber": 42,
  "heartbeatIntervalMs": 15000
}
```

### 2.2 Replay Recovery vs. Snapshot Resync

When a client reconnects:
1. **Short Interruption (Sequence Gap $\le$ Buffer Capacity):** Client sends `SUBSCRIBE` with `lastSequenceNumber: 38`. Server returns `REPLAY_BATCH` containing envelopes $39, 40, 41, 42$.
2. **Long Interruption or Server Reboot:** If the requested sequence has fallen off the circular replay buffer, or if `serverInstanceId` has changed, the server issues an authoritative `SNAPSHOT` containing all active bed states and radar scores for the ward.

---

## 3. Resilience & Failure Mode Matrix

| Failure Mode | Threat / Clinical Impact | Mitigation Mechanism | Verification Status |
| :--- | :--- | :--- | :--- |
| **Half-Open TCP Drop** | Silent freeze; nurse believes monitor is live while patient deteriorates | Dead-Man Watchdog monitors silence; forces socket reset after $37.5\text{ s}$; triggers `RECONNECTING` banner | **Verified** |
| **Out-of-Order Delivery** | Outdated vital signs (e.g. HR=55) overwrite newer critical telemetry (e.g. HR=135) | Anti-Rollback Guard tracks `(lastAppliedSeq, lastAppliedTs)` per patient; suppresses delayed envelopes | **Verified** |
| **Sequence Gaps** | Missing events cause state desynchronization | Resequencer buffers out-of-order packets up to 250ms; reassembles in contiguous order before dispatch | **Verified** |
| **Duplicate Broadcasts** | Multiple alerts or duplicated timeline entries spam clinician UI | Broadcaster deduplicates `eventId`; UI filters timeline mutations by unique ID and 3s debounce | **Verified** |
| **Slow Client Flooding** | Stalled client accumulates megabytes of WebSocket backpressure | Backpressure guard drops lossy vitals if client buffer $> 64\text{ KB}$, preserving priority alerts | **Verified** |
| **Server Crash & Reboot** | Sequence numbers reset to 0; client state machines reject new packets | Server transmits unique `serverInstanceId` on handshake; client resets sequence and pulls fresh snapshot | **Verified** |
| **Database Disruption** | Database error during snapshot generation crashes streaming process | Defensive try/catch wraps snapshot generation; streaming remains open with graceful fallback | **Verified** |
| **High Frequency Burst** | Rapid bursts (200+ events/sec) cause frame dropping or sequence inversion | Monotonic integer sequence generator guarantees contiguous serial numbering without regressions | **Verified** |

---

## 4. Verification Suite & Simulation Procedures

The automated verification suite is implemented in [`services/api/tests/realtime-reliability.test.ts`](file:///e:/AegisPulse/services/api/tests/realtime-reliability.test.ts) (11/11 tests passing) and [`services/api/tests/stream-websocket.test.ts`](file:///e:/AegisPulse/services/api/tests/stream-websocket.test.ts) (6/6 tests passing).

### 4.1 DevTools Simulation Procedures

Developers and quality engineers can simulate network chaos directly through browser DevTools or using the built-in Diagnostics Modal (`d` key):

#### 1. Simulate Offline Mode
- **Via In-UI Diagnostics Modal:** Open Diagnostics modal (`d`), locate *Realtime Chaos & Network Fault Simulation*, click **Simulate Offline**.
- **Via DevTools Console:**
  ```javascript
  window.__aegisStreamClient.simulateOffline();
  ```
- **Observed Behavior:** WebSocket disconnects cleanly, header pill transitions to `OFFLINE`, and prominent top banner displays:
  > **TELEMETRY OFFLINE:** Realtime stream connection lost. Clinical actions will queue locally in edge storage.

#### 2. Simulate Slow 3G Network
- **Via In-UI Diagnostics Modal:** Click **Simulate Slow 3G**.
- **Via DevTools Console:**
  ```javascript
  window.__aegisStreamClient.simulateSlow3G(500, 0.15); // 500ms delay, 15% drop rate
  ```
- **Observed Behavior:** Realtime link pill displays `SLOW 3G (+500ms)`. Observations buffer and resequence without sequence corruption.

#### 3. Simulate Network Reconnect
- **Via In-UI Diagnostics Modal:** Click **Restore Link**.
- **Via DevTools Console:**
  ```javascript
  window.__aegisStreamClient.simulateReconnect();
  ```
- **Observed Behavior:** Client initiates exponential backoff reconnect, receives `CONNECTED` handshake, replays missing packets, and transitions to `LIVE ONLINE`.

#### 4. Anti-Rollback Stale Envelope Injection
- **Via In-UI Diagnostics Modal:** Click **Inject Stale Packet**.
- **Via DevTools Console:**
  ```javascript
  window.__aegisStreamClient.injectTestEnvelope({
    seq: 1,
    timestamp: Date.now() - 60000,
    eventType: 'OBSERVATION_UPDATED',
    data: { patientId: 'P003', heartRate: 35 }
  });
  ```
- **Observed Behavior:** Anti-Rollback Guard catches the stale packet; patient vitals remain stable; `Stale Suppressed` counter increments in the diagnostics modal.

#### 5. Backend Restart Simulation
1. Keep the browser dashboard open at `http://localhost:5173/`.
2. Stop the API server process (`Ctrl+C` in backend terminal).
3. The dashboard header immediately transitions to `DEGRADED LINK` and displays the amber banner:
   > **REALTIME TELEMETRY INTERRUPTED:** Reconnecting to Ward 4B telemetry broker... Bedside vitals frozen at sequence #N. Dead-man watchdog active.
4. Restart the API server (`npm run dev:api`).
5. Client automatically connects, detects the new `serverInstanceId`, issues a `REQUEST_SNAPSHOT`, rehydrates radar telemetry, and resumes streaming without reloading the page.
