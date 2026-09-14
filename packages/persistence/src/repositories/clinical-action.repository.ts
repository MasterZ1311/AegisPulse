import { DatabaseSync } from 'node:sqlite';
import type { ClinicalAction } from '@aegispulse/types';

export class ClinicalActionRepository {
  constructor(private db: DatabaseSync) {}

  public insertAction(action: ClinicalAction): void {
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO clinical_actions (
        id, patient_id, bed_id, action_type, title, rationale,
        status, urgency, recommended_at, target_completion_timestamp,
        completed_at, completed_by_user_id, outcome_notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        completed_at = excluded.completed_at,
        completed_by_user_id = excluded.completed_by_user_id,
        outcome_notes = excluded.outcome_notes;
    `);

    stmt.run(
      action.id,
      action.patientId,
      action.bedId,
      action.actionType,
      action.title,
      action.rationale,
      action.status,
      action.urgency,
      action.recommendedAt,
      action.targetCompletionTimestamp || null,
      action.completedAt || null,
      action.completedByUserId || null,
      action.outcomeNotes || null,
      now
    );
  }

  public getActions(patientId: string, status?: string): ClinicalAction[] {
    let sql = 'SELECT * FROM clinical_actions WHERE patient_id = ?';
    const params: string[] = [patientId];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    sql += ' ORDER BY recommended_at DESC;';

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map((r) => this.mapAction(r));
  }

  public completeAction(
    actionId: string,
    completedByUserId: string,
    completedAt: number = Date.now(),
    outcomeNotes?: string
  ): void {
    const stmt = this.db.prepare(`
      UPDATE clinical_actions
      SET status = 'COMPLETED',
          completed_at = ?,
          completed_by_user_id = ?,
          outcome_notes = ?
      WHERE id = ?;
    `);

    stmt.run(completedAt, completedByUserId, outcomeNotes || null, actionId);
  }

  private mapAction(r: any): ClinicalAction {
    const targetComp = r.target_completion_timestamp
      ? Number(r.target_completion_timestamp)
      : Number(r.recommended_at) + 3600000;
    return {
      id: String(r.id),
      patientId: String(r.patient_id),
      bedId: String(r.bed_id),
      actionType: r.action_type,
      title: String(r.title),
      rationale: String(r.rationale),
      status: r.status,
      urgency: r.urgency,
      recommendedAt: Number(r.recommended_at),
      targetCompletionTimestamp: targetComp,
      completedAt: r.completed_at ? Number(r.completed_at) : undefined,
      completedByUserId: r.completed_by_user_id ? String(r.completed_by_user_id) : undefined,
      outcomeNotes: r.outcome_notes ? String(r.outcome_notes) : undefined,
    };
  }
}
