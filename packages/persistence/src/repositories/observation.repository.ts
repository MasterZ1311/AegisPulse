import { DatabaseSync } from 'node:sqlite';
import type { PhysiologicalObservation } from '@aegispulse/types';

export interface ObservationQueryOptions {
  since?: number;
  until?: number;
  limit?: number;
}

export class ObservationRepository {
  constructor(private db: DatabaseSync) {}

  public insertObservation(obs: PhysiologicalObservation): void {
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO observations (
        id, patient_id, timestamp, source, confidence,
        quality_state, heart_rate, respiratory_rate, systolic_bp,
        diastolic_bp, spo2, temperature, signal_snr, provenance, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        confidence = excluded.confidence,
        quality_state = excluded.quality_state,
        heart_rate = excluded.heart_rate,
        respiratory_rate = excluded.respiratory_rate;
    `);

    stmt.run(
      obs.id,
      obs.patientId,
      obs.timestamp,
      obs.source,
      obs.confidence,
      obs.qualityState,
      obs.heartRate ?? null,
      obs.respiratoryRate ?? null,
      obs.systolicBP ?? null,
      obs.diastolicBP ?? null,
      obs.spo2 ?? null,
      obs.temperature ?? null,
      obs.hrv ?? null,
      obs.avpu ? JSON.stringify({ avpu: obs.avpu, shockIndex: obs.shockIndex }) : null,
      now
    );
  }

  public insertObservationsBatch(observations: PhysiologicalObservation[]): void {
    if (observations.length === 0) return;

    this.db.exec('BEGIN IMMEDIATE;');
    try {
      for (const obs of observations) {
        this.insertObservation(obs);
      }
      this.db.exec('COMMIT;');
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }
  }

  public getObservations(patientId: string, options?: ObservationQueryOptions): PhysiologicalObservation[] {
    let sql = 'SELECT * FROM observations WHERE patient_id = ?';
    const params: (string | number)[] = [patientId];

    if (options?.since !== undefined) {
      sql += ' AND timestamp >= ?';
      params.push(options.since);
    }
    if (options?.until !== undefined) {
      sql += ' AND timestamp <= ?';
      params.push(options.until);
    }

    sql += ' ORDER BY timestamp ASC';

    if (options?.limit !== undefined) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map((r) => this.mapObservation(r));
  }

  public getLatestObservation(patientId: string): PhysiologicalObservation | undefined {
    const row = this.db.prepare(
      'SELECT * FROM observations WHERE patient_id = ? ORDER BY timestamp DESC LIMIT 1;'
    ).get(patientId) as any | undefined;

    return row ? this.mapObservation(row) : undefined;
  }

  private mapObservation(r: any): PhysiologicalObservation {
    const parsedProv = r.provenance ? JSON.parse(r.provenance) : undefined;
    return {
      id: String(r.id),
      patientId: String(r.patient_id),
      timestamp: Number(r.timestamp),
      source: r.source,
      confidence: Number(r.confidence),
      qualityState: r.quality_state,
      heartRate: r.heart_rate !== null ? Number(r.heart_rate) : undefined,
      respiratoryRate: r.respiratory_rate !== null ? Number(r.respiratory_rate) : undefined,
      systolicBP: r.systolic_bp !== null ? Number(r.systolic_bp) : undefined,
      diastolicBP: r.diastolic_bp !== null ? Number(r.diastolic_bp) : undefined,
      spo2: r.spo2 !== null ? Number(r.spo2) : undefined,
      temperature: r.temperature !== null ? Number(r.temperature) : undefined,
      hrv: r.signal_snr !== null ? Number(r.signal_snr) : undefined,
      shockIndex: parsedProv?.shockIndex,
      avpu: parsedProv?.avpu,
    };
  }
}
