import { DatabaseSync } from 'node:sqlite';

export interface IdempotencyRecord {
  key: string;
  itemType: string;
  patientId?: string;
  status: string;
  responseHash?: string;
  createdAt: number;
}

export class IdempotencyRepository {
  constructor(private db: DatabaseSync) {}

  public hasKey(key: string): boolean {
    const row = this.db.prepare('SELECT 1 FROM idempotency_keys WHERE key = ? LIMIT 1;').get(key);
    return Boolean(row);
  }

  public getKey(key: string): IdempotencyRecord | undefined {
    const row = this.db.prepare('SELECT * FROM idempotency_keys WHERE key = ? LIMIT 1;').get(key) as any;
    if (!row) return undefined;
    return {
      key: String(row.key),
      itemType: String(row.item_type),
      patientId: row.patient_id ? String(row.patient_id) : undefined,
      status: String(row.status),
      responseHash: row.response_hash ? String(row.response_hash) : undefined,
      createdAt: Number(row.created_at),
    };
  }

  public recordKey(record: {
    key: string;
    itemType: string;
    patientId?: string;
    status?: string;
    responseHash?: string;
  }): void {
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO idempotency_keys (key, item_type, patient_id, status, response_hash, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        status = excluded.status,
        response_hash = excluded.response_hash;
    `);

    stmt.run(
      record.key,
      record.itemType,
      record.patientId ?? null,
      record.status ?? 'PROCESSED',
      record.responseHash ?? null,
      now
    );
  }

  public purgeExpired(maxAgeMs: number = 86400000 * 7): number {
    const cutoff = Date.now() - maxAgeMs;
    const info = this.db.prepare('DELETE FROM idempotency_keys WHERE created_at <= ?;').run(cutoff);
    return Number(info.changes);
  }

}
