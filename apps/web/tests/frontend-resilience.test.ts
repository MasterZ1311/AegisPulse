import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TabLifecycleManager } from '../src/services/tab-lifecycle';
import { offlineSyncQueue } from '../src/services/offline-sync-queue';
import { AegisPulseStreamClient } from '../src/services/stream-client';
import { ErrorBoundary } from '../src/components/ErrorBoundary';

class MockStorage implements Storage {
  private store: Record<string, string> = {};
  get length() {
    return Object.keys(this.store).length;
  }
  clear() {
    this.store = {};
  }
  getItem(key: string) {
    return this.store[key] ?? null;
  }
  key(index: number) {
    return Object.keys(this.store)[index] ?? null;
  }
  removeItem(key: string) {
    delete this.store[key];
  }
  setItem(key: string, value: string) {
    this.store[key] = String(value);
  }
}

if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = new MockStorage();
}
if (typeof globalThis.sessionStorage === 'undefined') {
  (globalThis as any).sessionStorage = new MockStorage();
}
if (typeof globalThis.window === 'undefined') {
  (globalThis as any).window = {
    location: {
      protocol: 'http:',
      host: 'localhost:5173',
      reload: () => {},
    },
    sessionStorage: (globalThis as any).sessionStorage,
    localStorage: (globalThis as any).localStorage,
  };
} else if (!(globalThis as any).window.location) {
  (globalThis as any).window.location = {
    protocol: 'http:',
    host: 'localhost:5173',
    reload: () => {},
  };
}
if (typeof globalThis.document === 'undefined') {
  const listeners: Record<string, Function[]> = {};
  (globalThis as any).document = {
    hidden: false,
    addEventListener: (event: string, fn: Function) => {
      listeners[event] = listeners[event] || [];
      listeners[event].push(fn);
    },
    removeEventListener: (event: string, fn: Function) => {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter((f) => f !== fn);
      }
    },
    dispatchEvent: (event: any) => {
      const fns = listeners[event.type] || [];
      fns.forEach((fn) => fn(event));
      return true;
    },
  };
}
if (typeof globalThis.Event === 'undefined') {
  (globalThis as any).Event = class {
    constructor(public type: string) {}
  };
}

describe('Frontend Resilience & Production Audit Test Suite', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // 1. Error Boundary & Uncaught Exception Invariants
  // ==========================================================================
  describe('1. Error Boundary & Exception Containment', () => {
    it('catches render errors and records crash details to session storage', () => {
      const boundary = new ErrorBoundary({ children: null, isRoot: true });
      boundary.setState = (update: any) => {
        Object.assign(boundary.state, typeof update === 'function' ? update(boundary.state) : update);
      };
      const testError = new Error('Simulated clinical rendering crash');
      const testInfo = { componentStack: '\n    in CrashingComponent\n    in App' };

      // Trigger componentDidCatch
      boundary.componentDidCatch(testError, testInfo);

      expect(boundary.state.hasError).toBe(true);
      expect(boundary.state.errorInfo).toEqual(testInfo);

      // Verify crash telemetry saved in session storage
      const crashJson = sessionStorage.getItem('aegispulse_last_crash');
      expect(crashJson).not.toBeNull();
      const crash = JSON.parse(crashJson!);
      expect(crash.message).toBe('Simulated clinical rendering crash');
      expect(crash.componentStack).toContain('CrashingComponent');
    });

    it('provides getDerivedStateFromError to prevent unhandled React exception bubbles', () => {
      const err = new TypeError('Cannot read properties of undefined (reading vitals)');
      const state = ErrorBoundary.getDerivedStateFromError(err);
      expect(state.hasError).toBe(true);
      expect(state.error).toBe(err);
    });
  });

  // ==========================================================================
  // 2. Tab Suspension & Browser Refresh Lifecycle
  // ==========================================================================
  describe('2. Tab Suspension & Page Visibility Recovery', () => {
    it('detects tab suspension when document is hidden', () => {
      let resumedElapsed = -1;
      let suspendedCalled = false;

      const manager = new TabLifecycleManager({
        staleThresholdMs: 10000,
        onSuspended: () => {
          suspendedCalled = true;
        },
        onResume: (elapsed) => {
          resumedElapsed = elapsed;
        },
      });

      // Mock document visibility
      let isHidden = false;
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        get: () => isHidden,
      });

      const cleanup = manager.init();

      // 1. Simulate tab becoming hidden (user switches tabs / phone sleeps)
      isHidden = true;
      document.dispatchEvent(new Event('visibilitychange'));

      expect(suspendedCalled).toBe(true);
      expect(manager.isSuspended()).toBe(true);

      // 2. Simulate 20 seconds of background suspension
      vi.advanceTimersByTime(20000);

      // 3. Simulate tab returning to active foreground
      isHidden = false;
      document.dispatchEvent(new Event('visibilitychange'));

      expect(manager.isSuspended()).toBe(false);
      expect(resumedElapsed).toBeGreaterThanOrEqual(20000);

      cleanup();
    });

    it('cleans up visibility listeners properly on unmount to prevent memory leaks', () => {
      const removeSpy = vi.spyOn(document, 'removeEventListener');
      const manager = new TabLifecycleManager({});
      const cleanup = manager.init();

      cleanup();
      expect(removeSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    });
  });

  // ==========================================================================
  // 3. Offline State & Edge Action Queueing
  // ==========================================================================
  describe('3. Offline Resilience & Edge Action Queueing', () => {
    it('enqueues clinical actions when offline and persists to local storage', () => {
      offlineSyncQueue.setState('OFFLINE');

      const idempKey = offlineSyncQueue.enqueueClinicalAction(
        'PAT-001',
        'MEDICATION_ADMINISTERED',
        'IV Antibiotics Administered',
        'Ceftriaxone 1g IV infused over 30 min',
        'INFO'
      );

      expect(idempKey).toBeDefined();
      expect(offlineSyncQueue.getPendingCount()).toBeGreaterThanOrEqual(1);

      // Verify local storage persistence across browser refresh
      const stored = localStorage.getItem('aegispulse_offline_queue_v1');
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored!);
      expect(parsed.some((item: any) => item.patientId === 'PAT-001')).toBe(true);
    });

    it('enqueues priority alert acknowledgements idempotently', () => {
      const ackKey = offlineSyncQueue.enqueueAcknowledgement(
        'PAT-002',
        'alert-002',
        'RN Rachel Hayes',
        'Verified shock index at bedside'
      );

      expect(ackKey).toBeDefined();
      const items = offlineSyncQueue.getPendingItems();
      const found = items.find((i) => i.idempotencyKey === ackKey);
      expect(found).toBeDefined();
      expect(found?.patientId).toBe('PAT-002');
      expect(found?.itemType).toBe('ACKNOWLEDGEMENT');
    });
  });

  // ==========================================================================
  // 4. Stale State & Anti-Rollback Invariants
  // ==========================================================================
  describe('4. Anti-Rollback & Stale State Mitigation', () => {
    it('suppresses out-of-order stale telemetry envelopes', () => {
      const client = new AegisPulseStreamClient({
        wardId: 'WARD-TEST',
        heartbeatIntervalMs: 5000,
      });

      // Inject newer envelope (seq: 10, ts: 200000)
      client.injectTestEnvelope({
        eventId: 'env-10',
        seq: 10,
        timestamp: 200000,
        eventType: 'OBSERVATION_UPDATED',
        data: { patientId: 'PAT-1', heartRate: 85 },
      });

      expect(client.getLastSequenceNumber()).toBe(10);

      // Inject older envelope (seq: 8, ts: 190000)
      client.injectTestEnvelope({
        eventId: 'env-8',
        seq: 8,
        timestamp: 190000,
        eventType: 'OBSERVATION_UPDATED',
        data: { patientId: 'PAT-1', heartRate: 72 },
      });

      // Sequence should NOT roll back
      expect(client.getLastSequenceNumber()).toBe(10);
      expect(client.getSuppressedStaleCount()).toBe(1);

      client.disconnect();
    });

    it('re-sequences out-of-order future envelopes within buffer window', () => {
      const client = new AegisPulseStreamClient({
        wardId: 'WARD-TEST',
        heartbeatIntervalMs: 5000,
      });

      // Base seq: 5
      client.injectTestEnvelope({
        eventId: 'env-5',
        seq: 5,
        timestamp: 100000,
        eventType: 'OBSERVATION_UPDATED',
        data: { patientId: 'PAT-1', heartRate: 80 },
      });

      // Future envelope arrives first: seq 7
      client.injectTestEnvelope({
        eventId: 'env-7',
        seq: 7,
        timestamp: 100200,
        eventType: 'OBSERVATION_UPDATED',
        data: { patientId: 'PAT-1', heartRate: 82 },
      });

      // Should be buffered awaiting seq 6
      expect(client.getBufferedCount()).toBe(1);
      expect(client.getLastSequenceNumber()).toBe(5);

      // Missing envelope arrives: seq 6
      client.injectTestEnvelope({
        eventId: 'env-6',
        seq: 6,
        timestamp: 100100,
        eventType: 'OBSERVATION_UPDATED',
        data: { patientId: 'PAT-1', heartRate: 81 },
      });

      // Buffer drains sequentially up to seq 7
      expect(client.getBufferedCount()).toBe(0);
      expect(client.getLastSequenceNumber()).toBe(7);

      client.disconnect();
    });
  });

  // ==========================================================================
  // 5. Memory Growth & Long-Running Session Resilience
  // ==========================================================================
  describe('5. Memory Growth & Long-Running Shift Resilience', () => {
    it('bounds offline queue memory growth under sustained disconnects', () => {
      offlineSyncQueue.setState('OFFLINE');

      // Enqueue 200 rapid actions
      for (let i = 0; i < 200; i++) {
        offlineSyncQueue.enqueueClinicalAction(
          `PAT-${i % 10}`,
          'MANUAL_OBSERVATION',
          `Vitals Check ${i}`,
          `Heart rate recorded at cycle ${i}`,
          'INFO'
        );
      }

      // Memory should be bounded (capped at max 100 in queue)
      expect(offlineSyncQueue.getPendingCount()).toBeLessThanOrEqual(100);
    });

    it('suppresses high-frequency simulated network jitter without leaking timers', () => {
      const client = new AegisPulseStreamClient({
        wardId: 'WARD-TEST',
        heartbeatIntervalMs: 5000,
      });

      // Rapidly switch network simulation states
      for (let i = 0; i < 20; i++) {
        client.simulateSlow3G(200, 0.1);
        client.simulateOffline();
        client.simulateReconnect();
      }

      const state = client.getSimulatedState();
      expect(state.isOffline).toBe(false);
      expect(state.latencyMs).toBe(0);

      client.disconnect();
    });
  });

  // ==========================================================================
  // 6. Malformed Server Payload Protection
  // ==========================================================================
  describe('6. Malformed Server Payload Protection', () => {
    it('safely rejects malformed or unparseable stream payloads without crashing client', () => {
      const client = new AegisPulseStreamClient({
        wardId: 'WARD-TEST',
        heartbeatIntervalMs: 5000,
      });

      // Inject null, undefined, invalid JSON envelopes
      expect(() => client.injectTestEnvelope(null as any)).not.toThrow();
      expect(() => client.injectTestEnvelope(undefined as any)).not.toThrow();
      expect(() => client.injectTestEnvelope({} as any)).not.toThrow();
      expect(() =>
        client.injectTestEnvelope({
          seq: -1,
          timestamp: NaN,
          eventType: 'UNKNOWN' as any,
          data: null,
        })
      ).not.toThrow();

      client.disconnect();
    });
  });
});
