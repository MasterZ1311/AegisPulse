import { DatabaseSync } from 'node:sqlite';

export interface AttentionStateRecord {
  id: string;
  patientId: string;
  timestamp: number;
  score: number;
  category: string;
  topReason: string;
  reasons: any[];
  rankInputs: any;
  recommendedActions: any[];
  confidence: number;
  isActive: boolean;
  createdAt: number;
}

export class AttentionRepository {
  constructor(private db: DatabaseSync) {}

  public setActiveAttentionState(state: {
    id: string;
    patientId: string;
    timestamp: number;
    score: number;
    category: string;
    topReason: string;
    reasons: any[];
    rankInputs: any;
    recommendedActions: any[];
    confidence: number;
  }): void {
    const now = Date.now();

    this.db.exec('BEGIN IMMEDIATE;');
    try {
      // 1. Mark previous states for this patient as inactive
      const deact = this.db.prepare('UPDATE attention_states SET is_active = 0 WHERE patient_id = ? AND is_active = 1;');
      deact.run(state.patientId);

      // 2. Insert new active attention state
      const ins = this.db.prepare(`
        INSERT INTO attention_states (
          id, patient_id, timestamp, score, category, top_reason,
          reasons, rank_inputs, recommended_actions, confidence, is_active, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?);
      `);

      ins.run(
        state.id,
        state.patientId,
        state.timestamp,
        state.score,
        state.category,
        state.topReason,
        JSON.stringify(state.reasons || []),
        JSON.stringify(state.rankInputs || {}),
        JSON.stringify(state.recommendedActions || []),
        state.confidence,
        now
      );

      this.db.exec('COMMIT;');
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }
  }

  public getActiveAttentionState(patientId: string): AttentionStateRecord | undefined {
    const row = this.db.prepare(
      'SELECT * FROM attention_states WHERE patient_id = ? AND is_active = 1 ORDER BY timestamp DESC LIMIT 1;'
    ).get(patientId) as any | undefined;

    return row ? this.mapRecord(row) : undefined;
  }

  public getActiveAttentionStatesForWard(wardId: string): (AttentionStateRecord & { patientName: string; bedNumber: string; mrn: string })[] {
    const rows = this.db.prepare(`
      SELECT
        a.*,
        p.name AS patient_name,
        p.bed_number AS patient_bed_number,
        p.mrn AS patient_mrn
      FROM attention_states a
      JOIN patients p ON a.patient_id = p.id
      WHERE a.is_active = 1 AND p.ward_id = ?
      ORDER BY a.score DESC;
    `).all(wardId) as any[];

    return rows.map((r) => ({
      ...this.mapRecord(r),
      patientName: String(r.patient_name),
      bedNumber: String(r.patient_bed_number),
      mrn: String(r.patient_mrn),
    }));
  }

  public getAttentionHistory(patientId: string, limit: number = 50): AttentionStateRecord[] {
    const rows = this.db.prepare(
      'SELECT * FROM attention_states WHERE patient_id = ? ORDER BY timestamp DESC LIMIT ?;'
    ).all(patientId, limit) as any[];

    return rows.map((r) => this.mapRecord(r));
  }

  private mapRecord(r: any): AttentionStateRecord {
    return {
      id: String(r.id),
      patientId: String(r.patient_id),
      timestamp: Number(r.timestamp),
      score: Number(r.score),
      category: String(r.category),
      topReason: String(r.top_reason),
      reasons: JSON.parse(r.reasons || '[]'),
      rankInputs: JSON.parse(r.rank_inputs || '{}'),
      recommendedActions: JSON.parse(r.recommended_actions || '[]'),
      confidence: Number(r.confidence),
      isActive: Boolean(r.is_active),
      createdAt: Number(r.created_at),
    };
  }
}
