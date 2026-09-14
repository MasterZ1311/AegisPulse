import type {
  UnifiedTimelineEvent,
  TimelineQueryFilter,
} from '@aegispulse/types';
import type { TimelineStoreOptions } from './types';

/**
 * Chronological In-Memory Patient Timeline Store
 * Maintains strictly sorted events by timestamp with O(log N) binary search range slicing.
 */
export class TimelineStore {
  private events: UnifiedTimelineEvent[] = [];
  private readonly maxEvents: number;

  constructor(options?: TimelineStoreOptions) {
    this.maxEvents = options?.maxEvents ?? 10000;
  }

  /**
   * Adds a single event into the timeline, preserving strictly chronological order.
   */
  public add(event: UnifiedTimelineEvent): void {
    const idx = this.findInsertionIndex(event.timestamp, event.id);
    this.events.splice(idx, 0, event);

    if (this.events.length > this.maxEvents) {
      this.events.shift(); // Evict oldest event if capacity reached
    }
  }

  /**
   * Adds multiple events in batch and maintains chronological sorting.
   */
  public addBatch(newEvents: UnifiedTimelineEvent[]): void {
    for (const ev of newEvents) {
      this.add(ev);
    }
  }

  /**
   * Total number of events currently stored.
   */
  public count(): number {
    return this.events.length;
  }

  /**
   * Returns the latest event if any exists.
   */
  public getLatest(): UnifiedTimelineEvent | undefined {
    return this.events.length > 0 ? this.events[this.events.length - 1] : undefined;
  }

  /**
   * Returns all events within a closed timestamp interval [startTime, endTime].
   * Utilizes O(log N) binary search for rapid range extraction.
   */
  public getRange(startTime: number, endTime: number): UnifiedTimelineEvent[] {
    if (this.events.length === 0 || startTime > endTime) {
      return [];
    }

    const startIdx = this.bisectLeft(startTime);
    const endIdx = this.bisectRight(endTime);

    return this.events.slice(startIdx, endIdx);
  }

  /**
   * Queries timeline events applying time range, type filters, trust filters, limit, and sort order.
   */
  public query(filter?: Partial<TimelineQueryFilter>): UnifiedTimelineEvent[] {
    let results: UnifiedTimelineEvent[];

    const since = filter?.since;
    const until = filter?.until;

    if (since !== undefined || until !== undefined) {
      const start = since ?? 0;
      const end = until ?? Number.MAX_SAFE_INTEGER;
      results = this.getRange(start, end);
    } else {
      results = [...this.events];
    }

    // Filter by event types if requested
    if (filter?.eventTypes && filter.eventTypes.length > 0) {
      const allowed = new Set(filter.eventTypes);
      results = results.filter((ev) => allowed.has(ev.eventType));
    }

    // Filter by trustedOnly if requested
    if (filter?.trustedOnly) {
      results = results.filter((ev) => ev.isTrusted === true);
    }

    // Order
    if (filter?.order === 'desc') {
      results.reverse();
    }

    // Limit
    const limit = filter?.limit ?? 100;
    if (results.length > limit) {
      results = results.slice(0, limit);
    }

    return results;
  }

  /**
   * Clears all stored events.
   */
  public clear(): void {
    this.events = [];
  }

  /**
   * Binary search insertion index finder.
   */
  private findInsertionIndex(timestamp: number, id: string): number {
    let low = 0;
    let high = this.events.length;

    while (low < high) {
      const mid = (low + high) >>> 1;
      const current = this.events[mid];

      if (current.timestamp < timestamp) {
        low = mid + 1;
      } else if (current.timestamp > timestamp) {
        high = mid;
      } else {
        // Deterministic tie-break by ID
        if (current.id.localeCompare(id) < 0) {
          low = mid + 1;
        } else {
          high = mid;
        }
      }
    }

    return low;
  }

  /**
   * Binary search for first index with timestamp >= target.
   */
  private bisectLeft(timestamp: number): number {
    let low = 0;
    let high = this.events.length;

    while (low < high) {
      const mid = (low + high) >>> 1;
      if (this.events[mid].timestamp < timestamp) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    return low;
  }

  /**
   * Binary search for first index with timestamp > target.
   */
  private bisectRight(timestamp: number): number {
    let low = 0;
    let high = this.events.length;

    while (low < high) {
      const mid = (low + high) >>> 1;
      if (this.events[mid].timestamp <= timestamp) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    return low;
  }
}
