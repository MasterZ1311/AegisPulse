import { DatabaseSync } from 'node:sqlite';

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

export interface AppliedMigration {
  version: number;
  name: string;
  appliedAt: number;
}

export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    name: '001_initial_schema',
    sql: `
      CREATE TABLE IF NOT EXISTS _schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS wards (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        code TEXT NOT NULL,
        department TEXT NOT NULL,
        total_beds INTEGER NOT NULL,
        nurse_ratio TEXT NOT NULL,
        active_nurses_count INTEGER NOT NULL DEFAULT 0,
        hospital_name TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS beds (
        id TEXT PRIMARY KEY,
        bed_number TEXT NOT NULL,
        ward_id TEXT NOT NULL REFERENCES wards(id) ON DELETE CASCADE,
        room_number TEXT NOT NULL,
        status TEXT NOT NULL,
        current_patient_id TEXT,
        camera_device_id TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS patients (
        id TEXT PRIMARY KEY,
        mrn TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        age INTEGER NOT NULL,
        gender TEXT NOT NULL,
        ward_id TEXT NOT NULL REFERENCES wards(id) ON DELETE CASCADE,
        bed_id TEXT NOT NULL REFERENCES beds(id) ON DELETE CASCADE,
        bed_number TEXT NOT NULL,
        admission_diagnosis TEXT NOT NULL,
        admission_timestamp INTEGER NOT NULL,
        attending_physician TEXT NOT NULL,
        primary_nurse TEXT NOT NULL,
        code_status TEXT NOT NULL,
        baseline_mews INTEGER NOT NULL DEFAULT 0,
        allergies TEXT NOT NULL DEFAULT '[]',
        isolation_status TEXT NOT NULL DEFAULT 'NONE',
        is_active INTEGER NOT NULL DEFAULT 1,
        history TEXT NOT NULL DEFAULT '[]',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS clinical_contexts (
        id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL UNIQUE REFERENCES patients(id) ON DELETE CASCADE,
        admission_reason TEXT NOT NULL,
        post_op_day INTEGER,
        comorbidities TEXT NOT NULL DEFAULT '[]',
        code_status TEXT NOT NULL DEFAULT 'FULL_CODE',
        oxygen_delivery TEXT NOT NULL DEFAULT 'ROOM_AIR',
        o2_flow_rate_lpm REAL,
        isolation_status TEXT NOT NULL DEFAULT 'NONE',
        baseline_mews INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS observations (
        id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        timestamp INTEGER NOT NULL,
        source TEXT NOT NULL,
        confidence REAL NOT NULL,
        quality_state TEXT NOT NULL,
        heart_rate REAL,
        respiratory_rate REAL,
        systolic_bp REAL,
        diastolic_bp REAL,
        spo2 REAL,
        temperature REAL,
        signal_snr REAL,
        provenance TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS labs (
        id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        test_type TEXT NOT NULL,
        value REAL NOT NULL,
        unit TEXT NOT NULL,
        reference_range_low REAL,
        reference_range_high REAL,
        status TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        ordered_by TEXT,
        panel TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS timeline_events (
        id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        timestamp INTEGER NOT NULL,
        event_type TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        severity TEXT NOT NULL,
        source TEXT NOT NULL,
        is_trusted INTEGER NOT NULL DEFAULT 1,
        data TEXT,
        provenance TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS attention_states (
        id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        timestamp INTEGER NOT NULL,
        score REAL NOT NULL,
        category TEXT NOT NULL,
        top_reason TEXT NOT NULL,
        reasons TEXT NOT NULL,
        rank_inputs TEXT NOT NULL,
        recommended_actions TEXT NOT NULL,
        confidence REAL NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS acknowledgements (
        id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        alert_id TEXT,
        acknowledged_by_user_id TEXT NOT NULL,
        acknowledged_at INTEGER NOT NULL,
        reason TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS clinical_actions (
        id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        bed_id TEXT NOT NULL REFERENCES beds(id) ON DELETE CASCADE,
        action_type TEXT NOT NULL,
        title TEXT NOT NULL,
        rationale TEXT NOT NULL,
        status TEXT NOT NULL,
        urgency TEXT NOT NULL,
        recommended_at INTEGER NOT NULL,
        target_completion_timestamp INTEGER,
        completed_at INTEGER,
        completed_by_user_id TEXT,
        outcome_notes TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL,
        department TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS audit_events (
        id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        action TEXT NOT NULL,
        resource_type TEXT NOT NULL,
        resource_id TEXT,
        details TEXT,
        ip_address TEXT,
        request_id TEXT,
        created_at INTEGER NOT NULL
      );
    `,
  },
  {
    version: 2,
    name: '002_indexes',
    sql: `
      -- Patient indexes
      CREATE INDEX IF NOT EXISTS idx_observations_patient_ts
        ON observations (patient_id, timestamp DESC);

      CREATE INDEX IF NOT EXISTS idx_labs_patient_ts
        ON labs (patient_id, timestamp DESC);

      CREATE INDEX IF NOT EXISTS idx_timeline_patient_ts
        ON timeline_events (patient_id, timestamp DESC);

      CREATE INDEX IF NOT EXISTS idx_attention_patient_active
        ON attention_states (patient_id, is_active);

      CREATE INDEX IF NOT EXISTS idx_acknowledgements_patient
        ON acknowledgements (patient_id, acknowledged_at DESC);

      CREATE INDEX IF NOT EXISTS idx_clinical_contexts_patient
        ON clinical_contexts (patient_id);

      CREATE INDEX IF NOT EXISTS idx_clinical_actions_patient
        ON clinical_actions (patient_id, status);

      -- Timestamp indexes
      CREATE INDEX IF NOT EXISTS idx_observations_ts
        ON observations (timestamp);

      CREATE INDEX IF NOT EXISTS idx_timeline_ts
        ON timeline_events (timestamp DESC);

      CREATE INDEX IF NOT EXISTS idx_audit_events_ts
        ON audit_events (timestamp DESC);

      CREATE INDEX IF NOT EXISTS idx_attention_ts
        ON attention_states (timestamp DESC);

      -- Ward indexes
      CREATE INDEX IF NOT EXISTS idx_beds_ward
        ON beds (ward_id);

      CREATE INDEX IF NOT EXISTS idx_patients_ward
        ON patients (ward_id);

      -- Active Attention State indexes
      CREATE INDEX IF NOT EXISTS idx_attention_active_score
        ON attention_states (is_active, score DESC);

      CREATE INDEX IF NOT EXISTS idx_attention_patient_active_ts
        ON attention_states (patient_id, is_active, timestamp DESC);
    `,
  },
];

export function getAppliedMigrations(db: DatabaseSync): AppliedMigration[] {
  try {
    const checkTable = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='_schema_migrations';"
    ).get() as { name: string } | undefined;

    if (!checkTable) return [];

    const rows = db.prepare('SELECT version, name, applied_at FROM _schema_migrations ORDER BY version ASC').all() as any[];
    return rows.map((r) => ({
      version: Number(r.version),
      name: String(r.name),
      appliedAt: Number(r.applied_at),
    }));
  } catch {
    return [];
  }
}

export function runMigrations(db: DatabaseSync): AppliedMigration[] {
  // Ensure schema migrations table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS _schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    );
  `);

  const applied = getAppliedMigrations(db);
  const appliedVersions = new Set(applied.map((m) => m.version));
  const newlyApplied: AppliedMigration[] = [];

  for (const migration of MIGRATIONS) {
    if (appliedVersions.has(migration.version)) {
      continue;
    }

    // Execute migration inside an immediate transaction
    db.exec('BEGIN IMMEDIATE;');
    try {
      db.exec(migration.sql);
      const now = Date.now();
      const insert = db.prepare('INSERT INTO _schema_migrations (version, name, applied_at) VALUES (?, ?, ?)');
      insert.run(migration.version, migration.name, now);
      db.exec('COMMIT;');

      newlyApplied.push({
        version: migration.version,
        name: migration.name,
        appliedAt: now,
      });
    } catch (err) {
      db.exec('ROLLBACK;');
      throw new Error(`Failed to apply migration ${migration.version} (${migration.name}): ${err}`);
    }
  }

  return newlyApplied;
}
