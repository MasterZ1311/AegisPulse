import { DatabaseSync } from 'node:sqlite';

export interface AcknowledgementEntity {
  id: string;
  patientId: string;
  alertId?: string;
  acknowledgedByUserId: string;
  acknowledgedAt: number;
  reason?: string;
  createdAt: number;
}

export class AcknowledgementRepository {
  constructor(private db: DatabaseSync) {}

  public insertAcknowledgement(record: {
    id: string;
    patientId: string;
    alertId?: string;
    acknowledgedByUserId: string;
    acknowledgedAt: number;
    reason?: string;
  }): void {
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO acknowledgements (
        id, patient_id, alert_id, acknowledged_by_user_id,
        acknowledged_at, reason, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?);
    `);

    stmt.run(
      record.id,
      record.patientId,
      record.alertId || null,
      record.acknowledgedByUserId,
      record.acknowledgedAt,
      record.reason || null,
      now
    );
  }

  public getAcknowledgements(patientId: string): AcknowledgementEntity[] {
    const rows = this.db.prepare(
      'SELECT * FROM acknowledgements WHERE patient_id = ? ORDER BY acknowledged_at DESC;'
    ).all(patientId) as any[];

    return rows.map((r) => ({
      id: String(r.id),
      patientId: String(r.patient_id),
      alertId: r.alert_id ? String(r.alert_id) : undefined,
      acknowledgedByUserId: String(r.acknowledged_by_user_id),
      acknowledgedAt: Number(r.acknowledged_at),
      reason: r.reason ? String(r.reason) : undefined,
      createdAt: Number(r.created_at),
    }));
  }
}
