import type {
  TelemetryStreamEnvelope,
  TelemetryStreamEventType,
  ServerStreamMessage,
  ClientStreamMessage,
} from '@aegispulse/types';

export type StreamConnectionStatus =
  | 'CONNECTING'
  | 'CONNECTED'
  | 'RECONNECTING'
  | 'DISCONNECTED';

export interface StreamClientOptions {
  url?: string;
  wardId?: string;
  patientId?: string;
  heartbeatIntervalMs?: number;
  maxReconnectAttempts?: number;
  initialReconnectDelayMs?: number;
  maxReconnectDelayMs?: number;
  enableResequencing?: boolean;
}

type EventCallback<T = any> = (envelope: TelemetryStreamEnvelope<T>) => void;
type StatusCallback = (status: StreamConnectionStatus) => void;
type SnapshotCallback = (snapshot: any) => void;

export class AegisPulseStreamClient {
  private ws: WebSocket | null = null;
  private status: StreamConnectionStatus = 'DISCONNECTED';
  private lastSequenceNumber: number = 0;
  private readonly seenEventIds = new Set<string>();
  private readonly maxSeenIds = 2000;

  // Anti-Rollback & Resequencing State
  private readonly patientLastAppliedSeq = new Map<string, number>();
  private readonly patientLastAppliedTimestamp = new Map<string, number>();
  private readonly outOfOrderBuffer: TelemetryStreamEnvelope[] = [];
  private gapRecoveryTimer: any = null;

  // Server Instance / Reboot Detection
  private lastServerInstanceId: string | null = null;
  private lastServerBootTimestamp: number | null = null;

  // Heartbeat & Dead-Man Watchdog
  private lastMessageReceivedAt: number = Date.now();
  private reconnectAttempts = 0;
  private reconnectTimer: any = null;
  private pingTimer: any = null;
  private isManuallyClosed = false;

  // Simulation Fault Injection (DevTools / Test Harness)
  private simulatedLatencyMs: number = 0;
  private simulatedPacketDropRate: number = 0;
  private isSimulatedOffline: boolean = false;
  private suppressedStaleCount: number = 0;

  private readonly options: Required<StreamClientOptions>;
  private readonly eventListeners = new Map<TelemetryStreamEventType, Set<EventCallback>>();
  private readonly statusListeners = new Set<StatusCallback>();
  private readonly snapshotListeners = new Set<SnapshotCallback>();

  constructor(options: StreamClientOptions = {}) {
    const defaultUrl =
      typeof window !== 'undefined' && window.location
        ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/v1/stream/ws`
        : 'ws://localhost:3001/api/v1/stream/ws';

    this.options = {
      url: options.url ?? defaultUrl,
      wardId: options.wardId ?? 'WARD-A',
      patientId: options.patientId ?? '',
      heartbeatIntervalMs: options.heartbeatIntervalMs ?? 15000,
      maxReconnectAttempts: options.maxReconnectAttempts ?? 25,
      initialReconnectDelayMs: options.initialReconnectDelayMs ?? 400,
      maxReconnectDelayMs: options.maxReconnectDelayMs ?? 6000,
      enableResequencing: options.enableResequencing ?? true,
    };
  }

  public connect(): void {
    if (this.isSimulatedOffline) {
      this.setStatus('DISCONNECTED');
      return;
    }

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.isManuallyClosed = false;
    this.setStatus(this.reconnectAttempts === 0 ? 'CONNECTING' : 'RECONNECTING');

    try {
      const urlWithParams = new URL(this.options.url, 'http://localhost');
      if (this.options.wardId) urlWithParams.searchParams.set('wardId', this.options.wardId);
      if (this.lastSequenceNumber > 0) {
        urlWithParams.searchParams.set('lastSeq', String(this.lastSequenceNumber));
      }

      this.ws = new WebSocket(urlWithParams.toString());
      this.lastMessageReceivedAt = Date.now();

      this.ws.onopen = () => {
        this.setStatus('CONNECTED');
        this.reconnectAttempts = 0;
        this.lastMessageReceivedAt = Date.now();
        this.startHeartbeat();

        // Subscribe with lastSequenceNumber for client recovery / replay
        this.sendMessage({
          type: 'SUBSCRIBE',
          wardId: this.options.wardId || undefined,
          patientId: this.options.patientId || undefined,
          lastSequenceNumber: this.lastSequenceNumber > 0 ? this.lastSequenceNumber : undefined,
        });
      };

      this.ws.onmessage = (event) => {
        if (this.isSimulatedOffline) return;

        // Simulate packet loss if enabled
        if (this.simulatedPacketDropRate > 0 && Math.random() < this.simulatedPacketDropRate) {
          console.warn('[AegisPulseStreamClient] Simulated packet loss: Frame dropped.');
          return;
        }

        const handleRaw = () => {
          try {
            const raw = typeof event.data === 'string' ? event.data : event.data.toString();
            const msg = JSON.parse(raw) as ServerStreamMessage;
            this.handleServerMessage(msg);
          } catch (err) {
            console.error('[AegisPulseStreamClient] Error parsing message:', err);
          }
        };

        // Simulate Slow 3G latency/jitter if enabled
        if (this.simulatedLatencyMs > 0) {
          const jitter = this.simulatedLatencyMs * (0.8 + Math.random() * 0.4);
          setTimeout(handleRaw, jitter);
        } else {
          handleRaw();
        }
      };

      this.ws.onclose = () => {
        this.cleanupSocket();
        if (!this.isManuallyClosed) {
          this.setStatus('RECONNECTING');
          this.scheduleReconnect();
        } else {
          this.setStatus('DISCONNECTED');
        }
      };

      this.ws.onerror = (err) => {
        console.warn('[AegisPulseStreamClient] Socket error encountered:', err);
        this.ws?.close();
      };
    } catch (err) {
      console.error('[AegisPulseStreamClient] Failed to instantiate WebSocket:', err);
      this.scheduleReconnect();
    }
  }

  private handleServerMessage(msg: ServerStreamMessage): void {
    this.lastMessageReceivedAt = Date.now();

    switch (msg.type) {
      case 'CONNECTED': {
        // Check for server restart / reboot detection
        const serverRebooted =
          (this.lastServerInstanceId && msg.serverInstanceId && this.lastServerInstanceId !== msg.serverInstanceId) ||
          (this.lastServerBootTimestamp && msg.serverBootTimestamp && this.lastServerBootTimestamp !== msg.serverBootTimestamp) ||
          (this.lastSequenceNumber > 0 && msg.currentSequenceNumber < this.lastSequenceNumber);

        this.lastServerInstanceId = msg.serverInstanceId ?? null;
        this.lastServerBootTimestamp = msg.serverBootTimestamp ?? null;

        if (serverRebooted) {
          console.info('[AegisPulseStreamClient] Server reboot detected! Resetting sequence counter and requesting fresh snapshot.');
          this.lastSequenceNumber = 0;
          this.patientLastAppliedSeq.clear();
          this.patientLastAppliedTimestamp.clear();
          this.outOfOrderBuffer.length = 0;
          this.requestSnapshot();
        }
        break;
      }

      case 'EVENT': {
        this.routeEnvelope(msg.envelope);
        break;
      }

      case 'REPLAY_BATCH': {
        // Sort replayed batch by monotonic sequence order
        const sorted = [...msg.events].sort((a, b) => a.seq - b.seq);
        for (const env of sorted) {
          this.processEnvelope(env);
        }
        break;
      }

      case 'SNAPSHOT': {
        if (msg.sequenceNumber > this.lastSequenceNumber) {
          this.lastSequenceNumber = msg.sequenceNumber;
        }
        // Clear out-of-order buffer on full snapshot synchronization
        this.outOfOrderBuffer.length = 0;
        if (this.gapRecoveryTimer) {
          clearTimeout(this.gapRecoveryTimer);
          this.gapRecoveryTimer = null;
        }

        for (const listener of this.snapshotListeners) {
          try {
            listener(msg);
          } catch (err) {
            console.error('[AegisPulseStreamClient] Snapshot listener threw:', err);
          }
        }
        break;
      }

      case 'PONG': {
        // Server responded to heartbeat; connection confirmed live
        break;
      }

      case 'ERROR': {
        console.warn(`[AegisPulseStreamClient] Server Error [${msg.code}]:`, msg.message);
        break;
      }
    }
  }

  /**
   * Routes an incoming envelope with sequence gap detection and out-of-order resequencing.
   */
  private routeEnvelope(envelope: TelemetryStreamEnvelope): void {
    if (!envelope || typeof envelope !== 'object' || typeof envelope.seq !== 'number' || isNaN(envelope.seq)) {
      return;
    }

    const eventId = envelope.eventId || `${envelope.seq}-${envelope.timestamp || Date.now()}`;
    // 1. Duplicate suppression
    if (this.seenEventIds.has(eventId)) {
      return;
    }

    if (!this.options.enableResequencing) {
      this.processEnvelope(envelope);
      return;
    }

    // 2. Exact next expected sequence
    if (this.lastSequenceNumber === 0 || envelope.seq === this.lastSequenceNumber + 1) {
      this.processEnvelope(envelope);
      this.drainResequencingBuffer();
      return;
    }

    // 3. Past or stale sequence: process through anti-rollback guard
    if (envelope.seq <= this.lastSequenceNumber) {
      this.processEnvelope(envelope);
      return;
    }

    // 4. Sequence gap detected (envelope.seq > lastSequenceNumber + 1)
    // Buffer out-of-order event and wait briefly for missing gap to arrive
    this.outOfOrderBuffer.push(envelope);
    this.outOfOrderBuffer.sort((a, b) => a.seq - b.seq);

    if (!this.gapRecoveryTimer) {
      // Allow up to 250ms for delayed in-between packets to arrive before forcing flush or snapshot
      this.gapRecoveryTimer = setTimeout(() => {
        this.gapRecoveryTimer = null;
        if (this.outOfOrderBuffer.length > 0) {
          console.warn(
            `[AegisPulseStreamClient] Gap timeout: Flashing ${this.outOfOrderBuffer.length} buffered out-of-order packets.`
          );
          this.drainResequencingBuffer(true);
        }
      }, 250);
    }
  }

  private drainResequencingBuffer(force = false): void {
    while (this.outOfOrderBuffer.length > 0) {
      const next = this.outOfOrderBuffer[0];
      if (force || next.seq <= this.lastSequenceNumber + 1) {
        this.outOfOrderBuffer.shift();
        this.processEnvelope(next);
      } else {
        break;
      }
    }

    if (this.outOfOrderBuffer.length === 0 && this.gapRecoveryTimer) {
      clearTimeout(this.gapRecoveryTimer);
      this.gapRecoveryTimer = null;
    }
  }

  /**
   * Processes a single envelope with Anti-Rollback validation and dispatch.
   */
  private processEnvelope(envelope: TelemetryStreamEnvelope): void {
    if (!envelope || typeof envelope !== 'object') {
      return;
    }
    const eventId = envelope.eventId || `${envelope.seq}-${envelope.timestamp || Date.now()}`;
    // 1. Deduplication check
    if (this.seenEventIds.has(eventId)) {
      return;
    }
    this.recordSeenEventId(eventId);

    // 2. Anti-Rollback Protection:
    // Verify that delayed out-of-order packets cannot roll a patient's vitals or APS backwards
    const patientId = envelope.patientId || (envelope.data && envelope.data.patientId);
    if (patientId) {
      const lastAppliedSeq = this.patientLastAppliedSeq.get(patientId) ?? 0;
      const lastAppliedTs = this.patientLastAppliedTimestamp.get(patientId) ?? 0;

      const isStatefulUpdate =
        envelope.eventType === 'OBSERVATION_UPDATED' ||
        envelope.eventType === 'APS_UPDATED' ||
        envelope.eventType === 'PRIORITY_CHANGED';

      if (isStatefulUpdate) {
        // If this envelope has an older sequence number than what was already applied for this patient
        // AND an older or equal timestamp, it represents a delayed/stale delivery.
        // Suppressing it guarantees the client NEVER rolls backwards to an obsolete physiological state!
        if (envelope.seq < lastAppliedSeq && envelope.timestamp <= lastAppliedTs) {
          this.suppressedStaleCount++;
          console.warn(
            `[AegisPulseStreamClient] Anti-Rollback Guard: Suppressed stale envelope (seq: ${envelope.seq} < applied: ${lastAppliedSeq}, ts: ${envelope.timestamp} <= applied: ${lastAppliedTs}) for patient ${patientId}.`
          );
          return;
        }

        this.patientLastAppliedSeq.set(patientId, Math.max(lastAppliedSeq, envelope.seq));
        this.patientLastAppliedTimestamp.set(patientId, Math.max(lastAppliedTs, envelope.timestamp));
      }
    }

    // 3. Update highest observed sequence number
    if (envelope.seq > this.lastSequenceNumber) {
      this.lastSequenceNumber = envelope.seq;
    }

    // 4. Dispatch to event listeners
    const callbacks = this.eventListeners.get(envelope.eventType);
    if (callbacks) {
      for (const cb of callbacks) {
        try {
          cb(envelope);
        } catch (err) {
          console.error(`[AegisPulseStreamClient] Handler threw for ${envelope.eventType}:`, err);
        }
      }
    }
  }

  private recordSeenEventId(id: string): void {
    this.seenEventIds.add(id);
    if (this.seenEventIds.size > this.maxSeenIds) {
      const first = this.seenEventIds.values().next().value;
      if (first) this.seenEventIds.delete(first);
    }
  }

  public on<T = any>(eventType: TelemetryStreamEventType, callback: EventCallback<T>): () => void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set());
    }
    this.eventListeners.get(eventType)!.add(callback);

    return () => {
      this.eventListeners.get(eventType)?.delete(callback);
    };
  }

  public onStatusChange(callback: StatusCallback): () => void {
    this.statusListeners.add(callback);
    callback(this.status);
    return () => {
      this.statusListeners.delete(callback);
    };
  }

  public onSnapshot(callback: SnapshotCallback): () => void {
    this.snapshotListeners.add(callback);
    return () => {
      this.snapshotListeners.delete(callback);
    };
  }

  public acknowledgeAlert(patientId: string, alertId: string, userId: string, reason?: string): void {
    this.sendMessage({
      type: 'ACKNOWLEDGE_ALERT',
      patientId,
      alertId,
      userId,
      reason,
    });
  }

  public requestSnapshot(): void {
    this.sendMessage({
      type: 'REQUEST_SNAPSHOT',
      wardId: this.options.wardId || undefined,
    });
  }

  private sendMessage(msg: ClientStreamMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && !this.isSimulatedOffline) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  // ==========================================================================
  // Heartbeat & Dead-Man Watchdog Engine
  // ==========================================================================
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.lastMessageReceivedAt = Date.now();

    this.pingTimer = setInterval(() => {
      // 1. Send application heartbeat ping
      this.sendMessage({
        type: 'PING',
        timestamp: Date.now(),
      });

      // 2. Dead-Man Watchdog Check:
      // If no messages or pongs have arrived for > 2.5x heartbeat interval,
      // the TCP connection is dead / half-open. Force-terminate socket to prevent silent UI freeze!
      const silenceDuration = Date.now() - this.lastMessageReceivedAt;
      if (silenceDuration > this.options.heartbeatIntervalMs * 2.5) {
        console.warn(
          `[AegisPulseStreamClient] Dead-Man Watchdog: No response received for ${silenceDuration}ms (limit: ${
            this.options.heartbeatIntervalMs * 2.5
          }ms). Terminating dead socket.`
        );
        this.ws?.close();
      }
    }, this.options.heartbeatIntervalMs);
  }

  private stopHeartbeat(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.isManuallyClosed || this.reconnectTimer || this.isSimulatedOffline) return;
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      this.setStatus('DISCONNECTED');
      return;
    }

    const backoff = Math.min(
      this.options.initialReconnectDelayMs * Math.pow(1.5, this.reconnectAttempts),
      this.options.maxReconnectDelayMs
    );
    // Add jitter (±20%)
    const jitter = backoff * (0.8 + Math.random() * 0.4);
    this.reconnectAttempts += 1;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, jitter);
  }

  private cleanupSocket(): void {
    this.stopHeartbeat();
    if (this.gapRecoveryTimer) {
      clearTimeout(this.gapRecoveryTimer);
      this.gapRecoveryTimer = null;
    }
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws = null;
    }
  }

  private setStatus(newStatus: StreamConnectionStatus): void {
    if (this.status !== newStatus) {
      this.status = newStatus;
      for (const listener of this.statusListeners) {
        listener(this.status);
      }
    }
  }

  public getStatus(): StreamConnectionStatus {
    return this.status;
  }

  public getLastSequenceNumber(): number {
    return this.lastSequenceNumber;
  }

  public getBufferedCount(): number {
    return this.outOfOrderBuffer.length;
  }

  public getSuppressedStaleCount(): number {
    return this.suppressedStaleCount;
  }

  public getSimulatedState(): { isOffline: boolean; latencyMs: number; dropRate: number } {
    return {
      isOffline: this.isSimulatedOffline,
      latencyMs: this.simulatedLatencyMs,
      dropRate: this.simulatedPacketDropRate,
    };
  }

  public disconnect(): void {
    this.isManuallyClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.cleanupSocket();
    this.setStatus('DISCONNECTED');
  }

  // ==========================================================================
  // Simulated Fault Injection Hooks (DevTools / Test Harness)
  // ==========================================================================
  public simulateOffline(): void {
    this.isSimulatedOffline = true;
    this.disconnect();
    this.setStatus('DISCONNECTED');
    console.warn('[AegisPulseStreamClient] Simulated network offline mode active.');
  }

  public simulateSlow3G(latencyMs = 450, dropRate = 0.05): void {
    this.simulatedLatencyMs = latencyMs;
    this.simulatedPacketDropRate = dropRate;
    console.warn(`[AegisPulseStreamClient] Simulated Slow 3G active: Latency=${latencyMs}ms, DropRate=${dropRate * 100}%.`);
  }

  public simulateReconnect(): void {
    this.isSimulatedOffline = false;
    this.simulatedLatencyMs = 0;
    this.simulatedPacketDropRate = 0;
    console.info('[AegisPulseStreamClient] Simulated network reconnect triggered.');
    this.connect();
  }

  public injectTestEnvelope(envelope: TelemetryStreamEnvelope): void {
    this.routeEnvelope(envelope);
  }
}
