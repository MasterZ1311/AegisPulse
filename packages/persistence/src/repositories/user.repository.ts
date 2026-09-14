import { DatabaseSync } from 'node:sqlite';
import type { User } from '@aegispulse/types';

export class UserRepository {
  constructor(private db: DatabaseSync) {}

  public upsertUser(user: User): void {
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO users (
        id, username, full_name, role, department, is_active, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        username = excluded.username,
        full_name = excluded.full_name,
        role = excluded.role,
        department = excluded.department,
        is_active = excluded.is_active;
    `);

    stmt.run(
      user.id,
      user.username,
      user.fullName,
      user.role,
      JSON.stringify({
        email: user.email,
        assignedWardIds: user.assignedWardIds,
        badgeNumber: user.badgeNumber,
      }),
      user.isActive ? 1 : 0,
      user.createdAt || now
    );
  }

  public getUser(id: string): User | undefined {
    const row = this.db.prepare('SELECT * FROM users WHERE id = ?;').get(id) as any | undefined;
    return row ? this.mapUser(row) : undefined;
  }

  public getUserByUsername(username: string): User | undefined {
    const row = this.db.prepare('SELECT * FROM users WHERE username = ?;').get(username) as any | undefined;
    return row ? this.mapUser(row) : undefined;
  }

  public getUsers(): User[] {
    const rows = this.db.prepare('SELECT * FROM users ORDER BY full_name ASC;').all() as any[];
    return rows.map((r) => this.mapUser(r));
  }

  private mapUser(r: any): User {
    const parsedDept = r.department ? JSON.parse(r.department) : {};
    return {
      id: String(r.id),
      username: String(r.username),
      fullName: String(r.full_name),
      email: parsedDept.email || `${r.username}@aegispulse.hospital.org`,
      role: r.role,
      assignedWardIds: parsedDept.assignedWardIds || ['WARD-A', 'WARD-4B'],
      badgeNumber: parsedDept.badgeNumber || `RN-${String(r.id).slice(-4)}`,
      isActive: Boolean(r.is_active),
      createdAt: Number(r.created_at),
    };
  }
}
