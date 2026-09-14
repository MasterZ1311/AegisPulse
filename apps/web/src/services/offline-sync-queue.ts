export type WardConnectivityState = 'ONLINE' | 'DEGRADED' | 'OFFLINE' | 'SYNCING';

export interface QueuedSyncItem {
  idempotencyKey: string;
  itemType: 'OBSERVATION' | 'ACKNOWLEDGEMENT' | 'CLINICAL_ACTION';
  timestamp: number;
  patientId: string;
  payload: Record<string, any>;
  retryAttempts: number;
}

export interface OfflineSyncOptions {
  storageKey?: string;
  syncEndpoint?: string;
  clientId?: string;
  wardId?: string;
  maxRetries?: number;
  initialBackoffMs?: number;
}

export class OfflineSyncQueue {
  private state: WardConnectivityState = 'ONLINE';
  private queue: QueuedSyncItem[] = [];
  private readonly storageKey: string;
  private readonly syncEndpoint: string;
  private readonly clientId: string;
  private readonly wardId: string;
  private readonly maxRetries: number;
  private isSyncing = false;
  private readonly stateListeners = new Set<(state: WardConnectivityState, pendingCount: number) => void>();

  constructor(options: OfflineSyncOptions = {}) {
    this.storageKey = options.storageKey ?? 'aegispulse_offline_queue_v1';
    this.syncEndpoint = options.syncEndpoint ?? '/api/v1/sync';
    this.clientId = options.clientId ?? `tablet-bedside-${Math.random().toString(36).substring(2, 8)}`;
    this.wardId = options.wardId ?? 'WARD-4B';
    this.maxRetries = options.maxRetries ?? 5;

    this.loadFromStorage();

    // Listen to browser network online/offline events
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.setState(this.queue.length > 0 ? 'SYNCING' : 'ONLINE');
        this.flush();
      });

      window.addEventListener('offline', () => {
        this.setState('OFFLINE');
      });

      if (!navigator.onLine) {
        this.setState('OFFLINE');
      }
    }
  }

  public getState(): WardConnectivityState {
    return this.state;
  }

  public getPendingCount(): number {
    return this.queue.length;
  }

  public getPendingItems(): QueuedSyncItem[] {
    return [...this.queue];
  }

  public onStateChange(listener: (state: WardConnectivityState, pendingCount: number) => void): () => void {
    this.stateListeners.add(listener);
    listener(this.state, this.queue.length);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  public setState(newState: WardConnectivityState): void {
    if (this.state !== newState) {
      this.state = newState;
      this.notifyListeners();
    }
  }

  /**
   * Enqueue a manual bedside observation entered while offline
   */
  public enqueueObservation(
    patientId: string,
    vitals: {
      heartRate?: number;
      respiratoryRate?: number;
      systolicBP?: number;
      diastolicBP?: number;
      spo2?: number;
      temperature?: number;
      notes?: string;
    }
  ): string {
    const timestamp = Date.now();
    const idempotencyKey = `idemp-obs-${patientId}-${timestamp}-${Math.random().toString(36).substring(2, 7)}`;

    const item: QueuedSyncItem = {
      idempotencyKey,
      itemType: 'OBSERVATION',
      timestamp,
      patientId,
      payload: {
        source: 'MANUAL_VERIFIED',
        confidence: 1.0,
        qualityState: 'TRUSTED',
        ...vitals,
      },
      retryAttempts: 0,
    };

    this.queue.push(item);
    this.saveToStorage();
    this.notifyListeners();

    // If online, trigger auto-flush
    if (this.state === 'ONLINE') {
      this.flush();
    }

    return idempotencyKey;
  }

  /**
   * Enqueue bedside acknowledgement entered while offline
   */
  public enqueueAcknowledgement(
    patientId: string,
    alertId: string,
    nurseUserId: string,
    reason?: string
  ): string {
    const timestamp = Date.now();
    const idempotencyKey = `idemp-ack-${patientId}-${timestamp}-${Math.random().toString(36).substring(2, 7)}`;

    const item: QueuedSyncItem = {
      idempotencyKey,
      itemType: 'ACKNOWLEDGEMENT',
      timestamp,
      patientId,
      payload: {
        alertId,
        acknowledgedByUserId: nurseUserId,
        reason: reason || 'Bedside nurse acknowledgement.',
      },
      retryAttempts: 0,
    };

    this.queue.push(item);
    this.saveToStorage();
    this.notifyListeners();

    if (this.state === 'ONLINE') {
      this.flush();
    }

    return idempotencyKey;
  }

  /**
   * Enqueue bedside clinical action entered while offline
   */
  public enqueueClinicalAction(
    patientId: string,
    actionType: string,
    title: string,
    description: string,
    severity: 'INFO' | 'WARNING' | 'CRITICAL' = 'INFO'
  ): string {
    const timestamp = Date.now();
    const idempotencyKey = `idemp-act-${patientId}-${timestamp}-${Math.random().toString(36).substring(2, 7)}`;

    const item: QueuedSyncItem = {
      idempotencyKey,
      itemType: 'CLINICAL_ACTION',
      timestamp,
      patientId,
      payload: {
        eventType: actionType,
        title,
        description,
        severity,
      },
      retryAttempts: 0,
    };

    this.queue.push(item);
    this.saveToStorage();
    this.notifyListeners();

    if (this.state === 'ONLINE') {
      this.flush();
    }

    return idempotencyKey;
  }

  /**
   * Flush pending queue to server with idempotency & retry
   */
  public async flush(lastServerSeq?: number): Promise<boolean> {
    if (this.isSyncing || this.queue.length === 0) {
      return true;
    }

    this.isSyncing = true;
    this.setState('SYNCING');

    const clientSyncId = `sync-batch-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const itemsToSync = [...this.queue];

    try {
      const response = await fetch(this.syncEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientSyncId,
          clientId: this.clientId,
          wardId: this.wardId,
          lastServerSeq,
          items: itemsToSync.map((it) => ({
            idempotencyKey: it.idempotencyKey,
            itemType: it.itemType,
            timestamp: it.timestamp,
            patientId: it.patientId,
            payload: it.payload,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error(`Sync failed with HTTP ${response.status}`);
      }

      // Sync confirmed: Remove synced items from queue
      const syncedKeys = new Set(itemsToSync.map((i) => i.idempotencyKey));
      this.queue = this.queue.filter((i) => !syncedKeys.has(i.idempotencyKey));
      this.saveToStorage();

      this.setState(this.queue.length > 0 ? 'DEGRADED' : 'ONLINE');
      return true;
    } catch (err) {
      console.warn('[OfflineSyncQueue] Network sync attempt failed, retaining items:', err);

      // Increment retry attempts and discard items exceeding maxRetries
      for (const item of itemsToSync) {
        item.retryAttempts += 1;
      }
      this.queue = this.queue.filter((i) => i.retryAttempts <= this.maxRetries);
      this.saveToStorage();

      this.setState('OFFLINE');
      return false;
    } finally {
      this.isSyncing = false;
      this.notifyListeners();
    }
  }

  public clear(): void {
    this.queue = [];
    this.saveToStorage();
    this.notifyListeners();
  }

  private saveToStorage(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(this.storageKey, JSON.stringify(this.queue));
      } catch {
        // Handle storage quota or privacy mode
      }
    }
  }

  private loadFromStorage(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(this.storageKey);
        if (raw) {
          this.queue = JSON.parse(raw);
        }
      } catch {
        this.queue = [];
      }
    }
  }

  private notifyListeners(): void {
    for (const listener of this.stateListeners) {
      try {
        listener(this.state, this.queue.length);
      } catch (err) {
        console.error('[OfflineSyncQueue] Error in state listener:', err);
      }
    }
  }
}

export const offlineSyncQueue = new OfflineSyncQueue();
