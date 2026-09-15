import { DatabaseSync } from 'node:sqlite';
import type { Ward, Bed } from '@aegispulse/types';

export class WardRepository {
  constructor(private db: DatabaseSync) {}

  public upsertWard(ward: Ward): void {
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO wards (
        id, name, code, department, total_beds, nurse_ratio,
        active_nurses_count, hospital_name, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        code = excluded.code,
        department = excluded.department,
        total_beds = excluded.total_beds,
        nurse_ratio = excluded.nurse_ratio,
        active_nurses_count = excluded.active_nurses_count,
        hospital_name = excluded.hospital_name,
        is_active = excluded.is_active,
        updated_at = excluded.updated_at;
    `);

    stmt.run(
      ward.id,
      ward.name,
      ward.code,
      ward.department,
      ward.totalBeds,
      ward.nurseRatio,
      ward.activeNursesCount,
      ward.hospitalName,
      ward.isActive ? 1 : 0,
      now,
      now
    );
  }

  public getWards(): Ward[] {
    const rows = this.db.prepare('SELECT * FROM wards ORDER BY rowid ASC').all() as any[];
    return rows.map((r) => this.mapWard(r));
  }

  public getWard(id: string): Ward | undefined {
    const row = this.db.prepare('SELECT * FROM wards WHERE id = ?').get(id) as any | undefined;
    return row ? this.mapWard(row) : undefined;
  }

  public upsertBed(bed: Bed): void {
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO beds (
        id, bed_number, ward_id, room_number, status,
        current_patient_id, camera_device_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        bed_number = excluded.bed_number,
        ward_id = excluded.ward_id,
        room_number = excluded.room_number,
        status = excluded.status,
        current_patient_id = excluded.current_patient_id,
        camera_device_id = excluded.camera_device_id,
        updated_at = excluded.updated_at;
    `);

    stmt.run(
      bed.id,
      bed.bedNumber,
      bed.wardId,
      bed.roomNumber,
      bed.status,
      bed.currentPatientId || null,
      bed.cameraDeviceId || null,
      now,
      now
    );
  }

  public getBeds(wardId?: string, status?: string): Bed[] {
    let sql = 'SELECT * FROM beds WHERE 1=1';
    const params: (string | number)[] = [];

    if (wardId) {
      sql += ' AND ward_id = ?';
      params.push(wardId);
    }
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    sql += ' ORDER BY bed_number ASC';

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map((r) => this.mapBed(r));
  }

  public getBed(id: string): Bed | undefined {
    const row = this.db.prepare('SELECT * FROM beds WHERE id = ?').get(id) as any | undefined;
    return row ? this.mapBed(row) : undefined;
  }

  private mapWard(r: any): Ward {
    return {
      id: String(r.id),
      name: String(r.name),
      code: String(r.code),
      department: r.department,
      totalBeds: Number(r.total_beds),
      nurseRatio: String(r.nurse_ratio),
      activeNursesCount: Number(r.active_nurses_count),
      hospitalName: String(r.hospital_name),
      isActive: Boolean(r.is_active),
    };
  }

  private mapBed(r: any): Bed {
    return {
      id: String(r.id),
      bedNumber: String(r.bed_number),
      wardId: String(r.ward_id),
      roomNumber: String(r.room_number),
      status: r.status,
      currentPatientId: r.current_patient_id ? String(r.current_patient_id) : undefined,
      cameraDeviceId: r.camera_device_id ? String(r.camera_device_id) : undefined,
    };
  }

  public setBedOccupant(bedId: string, patientId: string | null, status: Bed['status'] = patientId ? 'OCCUPIED' : 'AVAILABLE'): void {
    const now = Date.now();
    this.db.prepare(`
      UPDATE beds 
      SET current_patient_id = ?, status = ?, updated_at = ?
      WHERE id = ?
    `).run(patientId, status, now, bedId);
  }

  public clearBedByPatientId(patientId: string): void {
    const now = Date.now();
    this.db.prepare(`
      UPDATE beds 
      SET current_patient_id = NULL, status = 'AVAILABLE', updated_at = ?
      WHERE current_patient_id = ?
    `).run(now, patientId);
  }
}
