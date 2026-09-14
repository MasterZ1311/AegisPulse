import { DatabaseSync } from 'node:sqlite';
import type { AuditEvent } from '@aegispulse/types';

export class AuditRepository {
  constructor(private db: DatabaseSync) {}

  public insertAuditEvent(event: AuditEvent): void {
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO audit_events (
        id, timestamp, user_id, action, resource_type,
        resource_id, details, ip_address, request_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `);

    stmt.run(
      event.id,
      event.timestamp,
      event.actorId,
      event.action,
      event.targetEntity,
      event.targetEntityId,
      JSON.stringify({
        actorRole: event.actorRole,
        patientId: event.patientId,
        description: event.description,
        userAgent: event.userAgent,
        previousState: event.previousState,
        newState: event.newState,
      }),
      event.ipAddress || null,
      null,
      now
    );
  }

  public getAuditEvents(options?: {
    since?: number;
    actorId?: string;
    targetEntityId?: string;
    limit?: number;
  }): AuditEvent[] {
    let sql = 'SELECT * FROM audit_events WHERE 1=1';
    const params: (string | number)[] = [];

    if (options?.since !== undefined) {
      sql += ' AND timestamp >= ?';
      params.push(options.since);
    }
    if (options?.actorId) {
      sql += ' AND user_id = ?';
      params.push(options.actorId);
    }
    if (options?.targetEntityId) {
      sql += ' AND resource_id = ?';
      params.push(options.targetEntityId);
    }

    sql += ' ORDER BY timestamp DESC';

    if (options?.limit !== undefined) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map((r) => this.mapAuditEvent(r));
  }

  private mapAuditEvent(r: any): AuditEvent {
    const details = r.details ? JSON.parse(r.details) : {};
    return {
      id: String(r.id),
      timestamp: Number(r.timestamp),
      actorId: String(r.user_id),
      actorRole: details.actorRole || 'SYSTEM',
      action: r.action,
      targetEntity: String(r.resource_type),
      targetEntityId: String(r.resource_id),
      patientId: details.patientId,
      description: details.description || `${r.action} on ${r.resource_type}`,
      ipAddress: r.ip_address ? String(r.ip_address) : undefined,
      userAgent: details.userAgent,
      previousState: details.previousState,
      newState: details.newState,
    };
  }
}
