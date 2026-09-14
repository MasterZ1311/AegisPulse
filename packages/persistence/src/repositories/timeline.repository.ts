import { DatabaseSync } from 'node:sqlite';
import type { UnifiedTimelineEvent } from '@aegispulse/types';

export interface TimelineQueryOptions {
  since?: number;
  until?: number;
  eventTypes?: string[];
  limit?: number;
}

export class TimelineRepository {
  constructor(private db: DatabaseSync) {}

  public insertTimelineEvent(event: UnifiedTimelineEvent): void {
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO timeline_events (
        id, patient_id, timestamp, event_type, title,
        description, severity, source, is_trusted, data, provenance, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO NOTHING;
    `);

    stmt.run(
      event.id,
      event.patientId,
      event.timestamp,
      event.eventType,
      event.title,
      event.description,
      event.severity,
      event.source,
      event.isTrusted ? 1 : 0,
      event.data ? JSON.stringify(event.data) : null,
      event.metadata ? JSON.stringify(event.metadata) : null,
      now
    );
  }

  public insertTimelineEventsBatch(events: UnifiedTimelineEvent[]): void {
    if (events.length === 0) return;

    this.db.exec('BEGIN IMMEDIATE;');
    try {
      for (const ev of events) {
        this.insertTimelineEvent(ev);
      }
      this.db.exec('COMMIT;');
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }
  }

  public getTimelineEvents(patientId: string, options?: TimelineQueryOptions): UnifiedTimelineEvent[] {
    let sql = 'SELECT * FROM timeline_events WHERE patient_id = ?';
    const params: (string | number)[] = [patientId];

    if (options?.since !== undefined) {
      sql += ' AND timestamp >= ?';
      params.push(options.since);
    }
    if (options?.until !== undefined) {
      sql += ' AND timestamp <= ?';
      params.push(options.until);
    }
    if (options?.eventTypes && options.eventTypes.length > 0) {
      const placeholders = options.eventTypes.map(() => '?').join(',');
      sql += ` AND event_type IN (${placeholders})`;
      params.push(...options.eventTypes);
    }

    sql += ' ORDER BY timestamp ASC';

    if (options?.limit !== undefined) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map((r) => this.mapTimelineEvent(r));
  }

  private mapTimelineEvent(r: any): UnifiedTimelineEvent {
    return {
      id: String(r.id),
      patientId: String(r.patient_id),
      timestamp: Number(r.timestamp),
      eventType: r.event_type,
      title: String(r.title),
      description: String(r.description),
      severity: r.severity,
      source: r.source,
      isTrusted: Boolean(r.is_trusted),
      data: r.data ? JSON.parse(r.data) : undefined,
      metadata: r.provenance ? JSON.parse(r.provenance) : undefined,
    };
  }
}
