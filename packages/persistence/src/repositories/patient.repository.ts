import { DatabaseSync } from 'node:sqlite';
import type { Patient, ClinicalContext } from '@aegispulse/types';

export class PatientRepository {
  constructor(private db: DatabaseSync) {}

  public upsertPatient(patient: Patient): void {
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO patients (
        id, mrn, name, age, gender, ward_id, bed_id, bed_number,
        admission_diagnosis, admission_timestamp, attending_physician,
        primary_nurse, code_status, baseline_mews, allergies,
        isolation_status, is_active, history, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        mrn = excluded.mrn,
        name = excluded.name,
        age = excluded.age,
        gender = excluded.gender,
        ward_id = excluded.ward_id,
        bed_id = excluded.bed_id,
        bed_number = excluded.bed_number,
        admission_diagnosis = excluded.admission_diagnosis,
        admission_timestamp = excluded.admission_timestamp,
        attending_physician = excluded.attending_physician,
        primary_nurse = excluded.primary_nurse,
        code_status = excluded.code_status,
        baseline_mews = excluded.baseline_mews,
        allergies = excluded.allergies,
        isolation_status = excluded.isolation_status,
        is_active = excluded.is_active,
        history = excluded.history,
        updated_at = excluded.updated_at;
    `);

    stmt.run(
      patient.id,
      patient.mrn,
      patient.name,
      patient.age,
      patient.gender,
      patient.wardId,
      patient.bedId,
      patient.bedNumber,
      patient.admissionDiagnosis,
      patient.admissionTimestamp,
      patient.attendingPhysician || 'Staff Attending',
      patient.primaryNurse || null,
      patient.codeStatus,
      patient.baselineMEWS ?? 0,
      JSON.stringify(patient.allergies || []),
      patient.isolationStatus || 'NONE',
      patient.isActive ? 1 : 0,
      JSON.stringify(patient.history || []),
      now,
      now
    );
  }

  public getPatients(wardId?: string): Patient[] {
    let sql = 'SELECT * FROM patients WHERE 1=1';
    const params: string[] = [];

    if (wardId) {
      sql += ' AND ward_id = ?';
      params.push(wardId);
    }
    sql += ' ORDER BY name ASC';

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map((r) => this.mapPatient(r));
  }

  public getPatient(id: string): Patient | undefined {
    const row = this.db.prepare('SELECT * FROM patients WHERE id = ?').get(id) as any | undefined;
    return row ? this.mapPatient(row) : undefined;
  }

  public createPatient(patient: Patient): Patient {
    this.upsertPatient(patient);
    return patient;
  }

  public updatePatient(id: string, updates: Partial<Patient>): Patient {
    const existing = this.getPatient(id);
    if (!existing) {
      throw new Error(`Patient with ID '${id}' not found.`);
    }
    const updated: Patient = {
      ...existing,
      ...updates,
      id: existing.id,
      mrn: updates.mrn ?? existing.mrn,
    };
    this.upsertPatient(updated);
    return updated;
  }

  public deletePatient(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM patients WHERE id = ?');
    const result = stmt.run(id);
    return (result as any).changes > 0;
  }

  public upsertClinicalContext(context: ClinicalContext): void {
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO clinical_contexts (
        id, patient_id, admission_reason, post_op_day, comorbidities,
        code_status, oxygen_delivery, o2_flow_rate_lpm, isolation_status,
        baseline_mews, updated_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        admission_reason = excluded.admission_reason,
        post_op_day = excluded.post_op_day,
        comorbidities = excluded.comorbidities,
        code_status = excluded.code_status,
        oxygen_delivery = excluded.oxygen_delivery,
        o2_flow_rate_lpm = excluded.o2_flow_rate_lpm,
        isolation_status = excluded.isolation_status,
        baseline_mews = excluded.baseline_mews,
        updated_at = excluded.updated_at;
    `);

    stmt.run(
      context.id,
      context.patientId,
      context.admissionReason,
      context.postOpDay ?? null,
      JSON.stringify(context.comorbidities || []),
      context.codeStatus,
      context.oxygenDelivery,
      context.o2FlowRateLpm ?? null,
      context.isolationStatus,
      context.baselineMEWS,
      context.updatedAt || now,
      now
    );
  }

  public getClinicalContext(patientId: string): ClinicalContext | undefined {
    const row = this.db.prepare('SELECT * FROM clinical_contexts WHERE patient_id = ?').get(patientId) as any | undefined;
    if (!row) return undefined;

    return {
      id: String(row.id),
      patientId: String(row.patient_id),
      admissionReason: String(row.admission_reason),
      postOpDay: row.post_op_day !== null ? Number(row.post_op_day) : undefined,
      comorbidities: JSON.parse(row.comorbidities || '[]'),
      codeStatus: row.code_status,
      oxygenDelivery: row.oxygen_delivery,
      o2FlowRateLpm: row.o2_flow_rate_lpm !== null ? Number(row.o2_flow_rate_lpm) : undefined,
      isolationStatus: row.isolation_status,
      baselineMEWS: Number(row.baseline_mews),
      updatedAt: Number(row.updated_at),
    };
  }

  private mapPatient(r: any): Patient {
    return {
      id: String(r.id),
      mrn: String(r.mrn),
      name: String(r.name),
      age: Number(r.age),
      gender: r.gender,
      wardId: String(r.ward_id),
      bedId: String(r.bed_id),
      bedNumber: String(r.bed_number),
      admissionDiagnosis: String(r.admission_diagnosis),
      admissionTimestamp: Number(r.admission_timestamp),
      attendingPhysician: String(r.attending_physician),
      primaryNurse: String(r.primary_nurse),
      codeStatus: r.code_status,
      baselineMEWS: Number(r.baseline_mews),
      allergies: JSON.parse(r.allergies || '[]'),
      isolationStatus: r.isolation_status,
      isActive: Boolean(r.is_active),
      history: JSON.parse(r.history || '[]'),
    };
  }
}
