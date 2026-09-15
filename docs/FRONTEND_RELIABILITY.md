# AegisPulse Frontend Resilience & Production UI State Specification

## 1. Executive Summary

This document specifies the frontend resilience architecture, component failure containment, and state management lifecycle of the **AegisPulse Clinical Radar & Patient Workstation Web Application**. 

In acute clinical wards and intensive care settings, client interface failures can lead to delayed clinician intervention, missed patient deterioration alerts, or disorientation during shift changes. AegisPulse enforces strict production resilience invariants: **no uncaught exception crashes the application**, **no stale data masquerades as current telemetry**, **edge actions entered during network disruptions are queued idempotently**, and **every major user workflow exhibits mathematical determinism across 6 primary states**.

### Non-Negotiable Frontend Invariants

1. **Complete 6-State Workflow Coverage:** Every view, panel, and clinical workflow strictly implements:
   - `LOADING`: Fluid layout skeletons with zero layout cumulative shift (CLS = 0).
   - `SUCCESS`: Live, sub-second WebSocket telemetry with active patient radar.
   - `EMPTY`: Meaningful contextual state (e.g., zero patients admitted, no unacknowledged alerts, filter yielding no results) with guided clinical actions.
   - `ERROR`: Isolated component-level Error Boundaries preventing global crash screens, with session crash capture and user-guided recovery.
   - `DEGRADED`: Explicit visual indicators (amber warning badges, SQI alerts) when telemetry drops in confidence, experiences jitter, or camera signal quality is compromised.
   - `OFFLINE`: Persistent offline banner, local storage action queueing (`aegispulse_offline_queue_v1`), and automatic background sync reconciliation.
2. **Global & Granular Error Containment:** The application is wrapped in hierarchical React Error Boundaries. If an unexpected runtime exception occurs within an isolated sub-view (e.g., radar graph rendering, optical camera spot-check, or diagnostic chart), only that sub-view falls back to an error card; the remaining ward monitoring system continues operating uninterrupted.
3. **Tab Suspension & Wake-Up Reconciliation:** When a tablet or workstation tab is suspended in the background (detected via the Page Visibility API), elapsed background time is tracked. Upon returning to the foreground, the client automatically triggers snapshot resynchronization to purge stale state.
4. **Anti-Rollback & Stale State Mitigation:** If delayed out-of-order packets arrive with `seq < lastAppliedSeq` and `ts <= lastAppliedTimestamp`, they are suppressed by the client stream controller. The UI never rolls backwards to obsolete vital signs.
5. **Bounded Memory Invariant:** In long-running 12-hour or 24-hour nursing shifts, memory cannot grow unbounded. Telemetry deduplication caches are bounded to 2,000 entries (FIFO eviction), and the offline action queue is hard-capped at 100 entries.

---

## 2. Universal State Architecture

All primary views in `@aegispulse/web` utilize standardized state components defined in `apps/web/src/components/ui/StateViews.tsx`:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           VIEW CONTROLLER                               │
│  (WardRadarPage, PatientWorkstationPage, Analytics, Spot-Check Modal)   │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
           ┌─────────────────────────┼─────────────────────────┐
           ▼                         ▼                         ▼
   [State: LOADING]          [State: SUCCESS]          [State: EMPTY]
   Skeleton Radar            Interactive Table         Zero Admissions CTA
   Skeleton Vitals Grid      Realtime Charts           Filter Reset Action
           │                         │                         │
           └─────────────────────────┼─────────────────────────┘
                                     │
           ┌─────────────────────────┴─────────────────────────┐
           ▼                         ▼                         ▼
   [State: ERROR]            [State: DEGRADED]         [State: OFFLINE]
   Boundary Fallback         Amber SQI Badge           Offline Banner
   Session Crash Log         Resequencing Gap Alert    Local Sync Queue
   Retry & Reload CTAs       Signal Occlusion Modal    Idempotent Flush
```

### 2.1 State Matrix & UI Behavior

| State | Visual Indicator | Interactive Capability | Clinical Action Permitted |
| :--- | :--- | :--- | :--- |
| **LOADING** | Animated skeleton pulse; grayed placeholders | Disabled controls | None (prevents race conditions) |
| **SUCCESS** | Green pulsing status dot; live APS scores | Full interactive access | Triage, acknowledgement, RRT activation, spot-check |
| **EMPTY** | Slate container with `FolderOpen` icon | "Admit Patient" / "Reset Filter" | Clear search filter or trigger simulated patient ingestion |
| **ERROR** | Crimson border, `AlertOctagon` icon, callout | "Retry Component" / "Reload System" | Review crash timestamp; copy error telemetry |
| **DEGRADED** | Amber badge, `AlertTriangle` icon | Full interactive access with warnings | Bedside physical verification required; optical recalibration |
| **OFFLINE** | Dark amber banner, `WifiOff` badge, queue badge | Read-only telemetry; write actions queued | Enqueue bedside notes, manual vitals, acknowledgements |

---

## 3. Error Boundary Architecture & Crash Containment

### 3.1 Hierarchical Boundary Layout

```tsx
<ErrorBoundary isRoot={true} fallbackTitle="AegisPulse System Emergency Recovery">
  <WardHeader />
  <main>
    <Routes>
      <Route path="/" element={
        <ErrorBoundary fallbackTitle="Ward Radar Overview Interrupted">
          <WardRadarPage />
        </ErrorBoundary>
      } />
      <Route path="/patient/:patientId" element={
        <ErrorBoundary fallbackTitle="Patient Workstation Interrupted">
          <PatientWorkstationPage />
        </ErrorBoundary>
      } />
      <Route path="/analytics" element={
        <ErrorBoundary fallbackTitle="Analytics Dashboard Interrupted">
          <WardAnalyticsPage />
        </ErrorBoundary>
      } />
    </Routes>
  </main>
</ErrorBoundary>
```

### 3.2 Crash Telemetry Logging

When an uncaught exception triggers `componentDidCatch`:
1. The error stack and React component hierarchy stack are serialized into `sessionStorage` under `aegispulse_last_crash`.
2. The user is presented with a non-destructive recovery card with two options:
   - **Retry Component:** Clears error state and attempts re-rendering the inner sub-tree without losing global application state.
   - **Hard Reload:** Triggers a full browser reload (`window.location.reload()`) to recover corrupted DOM or unrecoverable memory states.

---

## 4. Tab Suspension & Browser Wake-Up Handling

When hospital tablets or nurse workstations switch tabs or sleep:
1. `document.visibilitychange` fires. `TabLifecycleManager` records `suspendedAt = Date.now()`.
2. All streaming interval timers are placed in low-power idle mode.
3. When the tab becomes visible again:
   - The elapsed suspension duration is calculated: `elapsed = Date.now() - suspendedAt`.
   - If `elapsed > 10,000ms`, current telemetry is flagged as potentially stale.
   - The client immediately dispatches a WebSocket `GET_SNAPSHOT` message to fetch the authoritative server state.
   - Active streams resynchronize without displaying obsolete physiological data.

---

## 5. Offline Resilience & Bedside Sync Queue

When network connectivity is lost (`navigator.onLine === false` or WebSocket disconnected):
1. **Connectivity Badge:** The top navigation badge transitions from `CONNECTED` to `OFFLINE` (amber/red).
2. **Local Queueing:** Bedside nurses can continue recording manual observations, entering notes, or acknowledging alerts.
3. **Idempotency Keys:** Every queued action receives a unique UUID-v4 idempotency key (e.g., `idemp-ack-PAT-002-178948123-x9f2`).
4. **Queue Bounding:** To prevent local storage memory overflow on prolonged disconnects, the queue is hard-capped at 100 items (FIFO eviction of non-critical items).
5. **Automatic Flush:** Upon reconnect (`window.addEventListener('online')`), the queue flushes in FIFO order to `/api/v1/sync`. Deduplication on the API ensures no duplicate timeline events or alerts are recorded.

---

## 6. Verification & Automated Test Suite

All frontend resilience mechanisms are verified via Vitest in `apps/web/tests/frontend-resilience.test.ts`:

```
 ✓ apps/web/tests/frontend-resilience.test.ts (11 tests) 81ms
   ✓ 1. Error Boundary & Exception Containment > catches render errors and records crash details to session storage
   ✓ 1. Error Boundary & Exception Containment > provides getDerivedStateFromError to prevent unhandled React exception bubbles
   ✓ 2. Tab Suspension & Page Visibility Recovery > detects tab suspension when document is hidden
   ✓ 2. Tab Suspension & Page Visibility Recovery > cleans up visibility listeners properly on unmount to prevent memory leaks
   ✓ 3. Offline Resilience & Edge Action Queueing > enqueues clinical actions when offline and persists to local storage
   ✓ 3. Offline Resilience & Edge Action Queueing > enqueues priority alert acknowledgements idempotently
   ✓ 4. Anti-Rollback & Stale State Mitigation > suppresses out-of-order stale telemetry envelopes
   ✓ 4. Anti-Rollback & Stale State Mitigation > re-sequences out-of-order future envelopes within buffer window
   ✓ 5. Memory Growth & Long-Running Shift Resilience > bounds offline queue memory growth under sustained disconnects
   ✓ 5. Memory Growth & Long-Running Shift Resilience > suppresses high-frequency simulated network jitter without leaking timers
   ✓ 6. Malformed Server Payload Protection > safely rejects malformed or unparseable stream payloads without crashing client
```

All 11 tests pass with zero uncaught exceptions and strict adherence to clinical safety invariants.
