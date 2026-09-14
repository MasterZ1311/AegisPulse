import { EventEmitter } from 'node:events';
import type {
  TelemetryStreamEnvelope,
  TelemetryStreamEventType,
} from '@aegispulse/types';

export interface BroadcasterOptions {
  bufferCapacity?: number;
  duplicateTtlMs?: number;
}

export interface StreamFilter {
  wardId?: string;
  patientId?: string;
}

export class EventBroadcaster extends EventEmitter {
  private currentSeq: number = 0;
  private readonly bufferCapacity: number;
  private readonly duplicateTtlMs: number;
  private readonly replayBuffer: TelemetryStreamEnvelope[] = [];
  private readonly processedEventIds: Map<string, number> = new Map();

  constructor(options: BroadcasterOptions = {}) {
    super();
    this.bufferCapacity = options.bufferCapacity ?? 1000;
    this.duplicateTtlMs = options.duplicateTtlMs ?? 60000; // 1 minute duplicate deduplication window
  }

  /**
   * Broadcast an event to all streaming subscribers.
   * Assigns a strictly monotonic sequence number and adds to the sliding replay buffer.
   * If the eventId was already broadcast recently, suppresses duplicate.
   */
  public broadcast<T = Record<string, any>>(event: {
    eventId: string;
    eventType: TelemetryStreamEventType;
    timestamp?: number;
    wardId?: string;
    patientId?: string;
    data: T;
  }): TelemetryStreamEnvelope<T> | null {
    const now = Date.now();

    // 1. Duplicate suppression
    this.purgeStaleDuplicateCache(now);
    if (this.processedEventIds.has(event.eventId)) {
      return null;
    }
    this.processedEventIds.set(event.eventId, now);

    // 2. Strict monotonic sequence generation
    this.currentSeq += 1;

    const envelope: TelemetryStreamEnvelope<T> = {
      seq: this.currentSeq,
      eventId: event.eventId,
      eventType: event.eventType,
      timestamp: event.timestamp ?? now,
      wardId: event.wardId,
      patientId: event.patientId,
      data: event.data,
    };

    // 3. Store in sliding replay buffer
    this.replayBuffer.push(envelope as TelemetryStreamEnvelope<any>);
    if (this.replayBuffer.length > this.bufferCapacity) {
      this.replayBuffer.shift();
    }

    // 4. Emit to internal listeners (WebSocket connections & SSE streams)
    this.emit('event', envelope);
    return envelope;
  }

  /**
   * Check if a given sequence number is available in the replay buffer.
   */
  public isSequenceAvailable(seq: number): boolean {
    if (this.replayBuffer.length === 0) {
      return seq === this.currentSeq;
    }
    const oldestSeq = this.replayBuffer[0].seq;
    return seq >= oldestSeq - 1 && seq <= this.currentSeq;
  }

  /**
   * Retrieve missed events since `lastSeq` matching optional ward/patient filter.
   */
  public getEventsSince(
    lastSeq: number,
    filter?: StreamFilter
  ): TelemetryStreamEnvelope[] {
    const missed = this.replayBuffer.filter((e) => e.seq > lastSeq);
    if (!filter || (!filter.wardId && !filter.patientId)) {
      return missed;
    }

    return missed.filter((e) => {
      if (filter.wardId && e.wardId && e.wardId !== filter.wardId) {
        return false;
      }
      if (filter.patientId && e.patientId && e.patientId !== filter.patientId) {
        return false;
      }
      return true;
    });
  }

  public getCurrentSequence(): number {
    return this.currentSeq;
  }

  public getReplayBufferRange(): {
    oldestSeq: number;
    newestSeq: number;
    totalBuffered: number;
  } {
    if (this.replayBuffer.length === 0) {
      return { oldestSeq: this.currentSeq, newestSeq: this.currentSeq, totalBuffered: 0 };
    }
    return {
      oldestSeq: this.replayBuffer[0].seq,
      newestSeq: this.replayBuffer[this.replayBuffer.length - 1].seq,
      totalBuffered: this.replayBuffer.length,
    };
  }

  /**
   * Clean up old duplicate entries
   */
  private purgeStaleDuplicateCache(now: number): void {
    if (this.processedEventIds.size > 2000) {
      for (const [id, time] of this.processedEventIds.entries()) {
        if (now - time > this.duplicateTtlMs) {
          this.processedEventIds.delete(id);
        }
      }
    }
  }

  /**
   * Reset broadcaster state (primarily for test isolation)
   */
  public reset(): void {
    this.currentSeq = 0;
    this.replayBuffer.length = 0;
    this.processedEventIds.clear();
  }
}

export const eventBroadcaster = new EventBroadcaster();
