import { DatabaseSync } from 'node:sqlite';
import type { LaboratoryResult } from '@aegispulse/types';

export class LabRepository {
  constructor(private db: DatabaseSync) {}

  public insertLab(lab: LaboratoryResult): void {
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO labs (
        id, patient_id, test_type, value, unit, reference_range_low,
        reference_range_high, status, timestamp, ordered_by, panel, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        value = excluded.value,
        status = excluded.status,
        timestamp = excluded.timestamp;
    `);

    stmt.run(
      lab.id,
      lab.patientId,
      lab.testCode,
      lab.value,
      lab.unit,
      lab.referenceRange.low,
      lab.referenceRange.high,
      lab.isCritical ? 'CRITICAL' : 'NORMAL',
      lab.timestamp,
      lab.sourceLab,
      lab.testName,
      now
    );
  }

  public insertLabsBatch(labs: LaboratoryResult[]): void {
    if (labs.length === 0) return;

    this.db.exec('BEGIN IMMEDIATE;');
    try {
      for (const lab of labs) {
        this.insertLab(lab);
      }
      this.db.exec('COMMIT;');
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }
  }

  public getLabs(patientId: string, options?: { since?: number; until?: number }): LaboratoryResult[] {
    let sql = 'SELECT * FROM labs WHERE patient_id = ?';
    const params: (string | number)[] = [patientId];

    if (options?.since !== undefined) {
      sql += ' AND timestamp >= ?';
      params.push(options.since);
    }
    if (options?.until !== undefined) {
      sql += ' AND timestamp <= ?';
      params.push(options.until);
    }

    sql += ' ORDER BY timestamp DESC';

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map((r) => this.mapLab(r));
  }

  private mapLab(r: any): LaboratoryResult {
    return {
      id: String(r.id),
      patientId: String(r.patient_id),
      testCode: r.test_type,
      testName: r.panel ? String(r.panel) : String(r.test_type),
      value: Number(r.value),
      unit: r.unit,
      referenceRange: {
        low: Number(r.reference_range_low),
        high: Number(r.reference_range_high),
      },
      isCritical: r.status === 'CRITICAL',
      sourceLab: r.ordered_by ? String(r.ordered_by) : 'Hospital Core Lab',
      timestamp: Number(r.timestamp),
    };
  }
}
