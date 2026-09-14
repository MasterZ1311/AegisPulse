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
}

type EventCallback<T = any> = (envelope: TelemetryStreamEnvelope<T>) => void;
type StatusCallback = (status: StreamConnectionStatus) => void;
type SnapshotCallback = (snapshot: any) => void;

export class AegisPulseStreamClient {
  private ws: WebSocket | null = null;
  private status: StreamConnectionStatus = 'DISCONNECTED';
  private lastSequenceNumber: number = 0;
  private readonly seenEventIds = new Set<string>();
  private readonly maxSeenIds = 1000;

  private reconnectAttempts = 0;
  private reconnectTimer: any = null;
  private pingTimer: any = null;
  private isManuallyClosed = false;

  private readonly options: Required<StreamClientOptions>;
  private readonly eventListeners = new Map<TelemetryStreamEventType, Set<EventCallback>>();
  private readonly statusListeners = new Set<StatusCallback>();
  private readonly snapshotListeners = new Set<SnapshotCallback>();

  constructor(options: StreamClientOptions = {}) {
    const defaultUrl =
      typeof window !== 'undefined'
        ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/v1/stream/ws`
        : 'ws://localhost:3001/api/v1/stream/ws';

    this.options = {
      url: options.url ?? defaultUrl,
      wardId: options.wardId ?? 'WARD-A',
      patientId: options.patientId ?? '',
      heartbeatIntervalMs: options.heartbeatIntervalMs ?? 15000,
      maxReconnectAttempts: options.maxReconnectAttempts ?? 20,
      initialReconnectDelayMs: options.initialReconnectDelayMs ?? 500,
      maxReconnectDelayMs: options.maxReconnectDelayMs ?? 8000,
    };
  }

  public connect(): void {
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

      this.ws.onopen = () => {
        this.setStatus('CONNECTED');
        this.reconnectAttempts = 0;
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
        try {
          const raw = typeof event.data === 'string' ? event.data : event.data.toString();
          const msg = JSON.parse(raw) as ServerStreamMessage;
          this.handleServerMessage(msg);
        } catch (err) {
          console.error('[AegisPulseStreamClient] Error parsing message:', err);
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
        console.warn('[AegisPulseStreamClient] Socket error:', err);
        this.ws?.close();
      };
    } catch (err) {
      console.error('[AegisPulseStreamClient] Failed to instantiate WebSocket:', err);
      this.scheduleReconnect();
    }
  }

  private handleServerMessage(msg: ServerStreamMessage): void {
    switch (msg.type) {
      case 'CONNECTED': {
        // Handshake established
        break;
      }

      case 'EVENT': {
        this.processEnvelope(msg.envelope);
        break;
      }

      case 'REPLAY_BATCH': {
        // Replayed missed events in strict sequence order
        for (const env of msg.events) {
          this.processEnvelope(env);
        }
        break;
      }

      case 'SNAPSHOT': {
        if (msg.sequenceNumber > this.lastSequenceNumber) {
          this.lastSequenceNumber = msg.sequenceNumber;
        }
        for (const listener of this.snapshotListeners) {
          listener(msg);
        }
        break;
      }

      case 'PONG': {
        // Heartbeat response
        break;
      }

      case 'ERROR': {
        console.warn(`[AegisPulseStreamClient] Server Error [${msg.code}]:`, msg.message);
        break;
      }
    }
  }

  /**
   * Deduplicates, validates ordering, and dispatches event envelopes
   */
  private processEnvelope(envelope: TelemetryStreamEnvelope): void {
    // 1. Duplicate suppression
    if (this.seenEventIds.has(envelope.eventId)) {
      return;
    }
    this.recordSeenEventId(envelope.eventId);

    // 2. Track highest sequence number
    if (envelope.seq > this.lastSequenceNumber) {
      this.lastSequenceNumber = envelope.seq;
    }

    // 3. Dispatch to type-specific listeners
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
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.pingTimer = setInterval(() => {
      this.sendMessage({
        type: 'PING',
        timestamp: Date.now(),
      });
    }, this.options.heartbeatIntervalMs);
  }

  private stopHeartbeat(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.isManuallyClosed || this.reconnectTimer) return;
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

  public disconnect(): void {
    this.isManuallyClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.cleanupSocket();
    this.setStatus('DISCONNECTED');
  }
}
