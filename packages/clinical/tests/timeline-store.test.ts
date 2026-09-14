import { describe, it, expect } from 'vitest';
import { TimelineStore } from '../src/timeline/store';
import type { UnifiedTimelineEvent } from '@aegispulse/types';

describe('TimelineStore (Chronological Storage & Binary Search Range)', () => {
  function makeEvent(id: string, timestamp: number, eventType: any = 'VITAL_MEASUREMENT', isTrusted = true): UnifiedTimelineEvent {
    return {
      id,
      patientId: 'P001',
      timestamp,
      eventType,
      title: `Event ${id}`,
      description: `Description for ${id}`,
      source: 'OPTICAL_RPPG',
      isTrusted,
      severity: 'INFO',
    };
  }

  it('stores events in strict chronological order regardless of insertion order', () => {
    const store = new TimelineStore();
    store.add(makeEvent('ev-3', 3000));
    store.add(makeEvent('ev-1', 1000));
    store.add(makeEvent('ev-4', 4000));
    store.add(makeEvent('ev-2', 2000));

    expect(store.count()).toBe(4);
    const all = store.query();
    expect(all.map((e) => e.id)).toEqual(['ev-1', 'ev-2', 'ev-3', 'ev-4']);
  });

  it('performs deterministic tie-breaking for events with identical timestamps', () => {
    const store = new TimelineStore();
    store.add(makeEvent('ev-b', 1000));
    store.add(makeEvent('ev-a', 1000));
    store.add(makeEvent('ev-c', 1000));

    const all = store.query();
    expect(all.map((e) => e.id)).toEqual(['ev-a', 'ev-b', 'ev-c']);
  });

  it('extracts range intervals using binary search correctly', () => {
    const store = new TimelineStore();
    for (let t = 100; t <= 1000; t += 100) {
      store.add(makeEvent(`ev-${t}`, t));
    }

    const range = store.getRange(300, 700);
    expect(range.map((e) => e.timestamp)).toEqual([300, 400, 500, 600, 700]);

    const emptyRange = store.getRange(5000, 6000);
    expect(emptyRange).toHaveLength(0);
  });

  it('filters by eventTypes, trustedOnly, limit, and order', () => {
    const store = new TimelineStore();
    store.add(makeEvent('ev-1', 1000, 'VITAL_MEASUREMENT', true));
    store.add(makeEvent('ev-2', 2000, 'SIGNAL_QUALITY_CHANGE', false));
    store.add(makeEvent('ev-3', 3000, 'VITAL_MEASUREMENT', false));
    store.add(makeEvent('ev-4', 4000, 'VITAL_MEASUREMENT', true));
    store.add(makeEvent('ev-5', 5000, 'LAB_RESULT', true));

    // Trusted vitals only
    const trustedVitals = store.query({ eventTypes: ['VITAL_MEASUREMENT'], trustedOnly: true });
    expect(trustedVitals.map((e) => e.id)).toEqual(['ev-1', 'ev-4']);

    // Descending with limit
    const descLimited = store.query({ limit: 2, order: 'desc' });
    expect(descLimited.map((e) => e.id)).toEqual(['ev-5', 'ev-4']);
  });

  it('respects maxEvents capacity bound by evicting oldest events', () => {
    const store = new TimelineStore({ maxEvents: 3 });
    store.add(makeEvent('ev-1', 1000));
    store.add(makeEvent('ev-2', 2000));
    store.add(makeEvent('ev-3', 3000));
    store.add(makeEvent('ev-4', 4000));

    expect(store.count()).toBe(3);
    expect(store.query().map((e) => e.id)).toEqual(['ev-2', 'ev-3', 'ev-4']);
  });
});
