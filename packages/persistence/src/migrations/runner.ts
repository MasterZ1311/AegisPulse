import { DatabaseSync } from 'node:sqlite';

export interface Migration {
  version: number;
  name: string;
  sql: string;
  downSql?: string;
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
    downSql: `
      DROP TABLE IF EXISTS audit_events;
      DROP TABLE IF EXISTS users;
      DROP TABLE IF EXISTS clinical_actions;
      DROP TABLE IF EXISTS acknowledgements;
      DROP TABLE IF EXISTS attention_states;
      DROP TABLE IF EXISTS timeline_events;
      DROP TABLE IF EXISTS labs;
      DROP TABLE IF EXISTS observations;
      DROP TABLE IF EXISTS clinical_contexts;
      DROP TABLE IF EXISTS patients;
      DROP TABLE IF EXISTS beds;
      DROP TABLE IF EXISTS wards;
    `,
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
    downSql: `
      DROP INDEX IF EXISTS idx_attention_patient_active_ts;
      DROP INDEX IF EXISTS idx_attention_active_score;
      DROP INDEX IF EXISTS idx_patients_ward;
      DROP INDEX IF EXISTS idx_beds_ward;
      DROP INDEX IF EXISTS idx_attention_ts;
      DROP INDEX IF EXISTS idx_audit_events_ts;
      DROP INDEX IF EXISTS idx_timeline_ts;
      DROP INDEX IF EXISTS idx_observations_ts;
      DROP INDEX IF EXISTS idx_clinical_actions_patient;
      DROP INDEX IF EXISTS idx_clinical_contexts_patient;
      DROP INDEX IF EXISTS idx_acknowledgements_patient;
      DROP INDEX IF EXISTS idx_attention_patient_active;
      DROP INDEX IF EXISTS idx_timeline_patient_ts;
      DROP INDEX IF EXISTS idx_labs_patient_ts;
      DROP INDEX IF EXISTS idx_observations_patient_ts;
    `,
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
  {
    version: 3,
    name: '003_constraints_and_hardening',
    downSql: `
      DROP TRIGGER IF EXISTS trg_labs_check_insert;
      DROP TRIGGER IF EXISTS trg_patients_check_insert;
      DROP TRIGGER IF EXISTS trg_attention_check_insert;
      DROP TRIGGER IF EXISTS trg_observations_check_update;
      DROP TRIGGER IF EXISTS trg_observations_check_insert;
      DROP INDEX IF EXISTS idx_observations_patient_ts_source_unique;
      DROP INDEX IF EXISTS idx_idempotency_created_at;
      DROP TABLE IF EXISTS idempotency_keys;
    `,
    sql: `
      -- 1. Persistent Idempotency Ledger
      CREATE TABLE IF NOT EXISTS idempotency_keys (
        key TEXT PRIMARY KEY,
        item_type TEXT NOT NULL,
        patient_id TEXT,
        status TEXT NOT NULL,
        response_hash TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_idempotency_created_at
        ON idempotency_keys (created_at);

      -- 2. Deduplication Index: Ensure no duplicate observation at same timestamp & source
      CREATE UNIQUE INDEX IF NOT EXISTS idx_observations_patient_ts_source_unique
        ON observations (patient_id, timestamp, source);

      -- 3. Physiological Range Constraints for Observations (INSERT Trigger)
      CREATE TRIGGER IF NOT EXISTS trg_observations_check_insert
      BEFORE INSERT ON observations
      FOR EACH ROW
      BEGIN
        SELECT CASE
          WHEN NEW.heart_rate IS NOT NULL AND (NEW.heart_rate < 10 OR NEW.heart_rate > 350) THEN
            RAISE(ABORT, 'CHECK constraint failed: heart_rate must be between 10 and 350')
          WHEN NEW.respiratory_rate IS NOT NULL AND (NEW.respiratory_rate < 1 OR NEW.respiratory_rate > 100) THEN
            RAISE(ABORT, 'CHECK constraint failed: respiratory_rate must be between 1 and 100')
          WHEN NEW.systolic_bp IS NOT NULL AND (NEW.systolic_bp < 20 OR NEW.systolic_bp > 350) THEN
            RAISE(ABORT, 'CHECK constraint failed: systolic_bp must be between 20 and 350')
          WHEN NEW.diastolic_bp IS NOT NULL AND (NEW.diastolic_bp < 10 OR NEW.diastolic_bp > 250) THEN
            RAISE(ABORT, 'CHECK constraint failed: diastolic_bp must be between 10 and 250')
          WHEN NEW.spo2 IS NOT NULL AND (NEW.spo2 < 20 OR NEW.spo2 > 100) THEN
            RAISE(ABORT, 'CHECK constraint failed: spo2 must be between 20 and 100')
          WHEN NEW.temperature IS NOT NULL AND (NEW.temperature < 20.0 OR NEW.temperature > 48.0) THEN
            RAISE(ABORT, 'CHECK constraint failed: temperature must be between 20.0 and 48.0')
          WHEN NEW.confidence < 0.0 OR NEW.confidence > 1.0 THEN
            RAISE(ABORT, 'CHECK constraint failed: confidence must be between 0.0 and 1.0')
        END;
      END;

      -- 4. Physiological Range Constraints for Observations (UPDATE Trigger)
      CREATE TRIGGER IF NOT EXISTS trg_observations_check_update
      BEFORE UPDATE ON observations
      FOR EACH ROW
      BEGIN
        SELECT CASE
          WHEN NEW.heart_rate IS NOT NULL AND (NEW.heart_rate < 10 OR NEW.heart_rate > 350) THEN
            RAISE(ABORT, 'CHECK constraint failed: heart_rate must be between 10 and 350')
          WHEN NEW.respiratory_rate IS NOT NULL AND (NEW.respiratory_rate < 1 OR NEW.respiratory_rate > 100) THEN
            RAISE(ABORT, 'CHECK constraint failed: respiratory_rate must be between 1 and 100')
          WHEN NEW.systolic_bp IS NOT NULL AND (NEW.systolic_bp < 20 OR NEW.systolic_bp > 350) THEN
            RAISE(ABORT, 'CHECK constraint failed: systolic_bp must be between 20 and 350')
          WHEN NEW.diastolic_bp IS NOT NULL AND (NEW.diastolic_bp < 10 OR NEW.diastolic_bp > 250) THEN
            RAISE(ABORT, 'CHECK constraint failed: diastolic_bp must be between 10 and 250')
          WHEN NEW.spo2 IS NOT NULL AND (NEW.spo2 < 20 OR NEW.spo2 > 100) THEN
            RAISE(ABORT, 'CHECK constraint failed: spo2 must be between 20 and 100')
          WHEN NEW.temperature IS NOT NULL AND (NEW.temperature < 20.0 OR NEW.temperature > 48.0) THEN
            RAISE(ABORT, 'CHECK constraint failed: temperature must be between 20.0 and 48.0')
          WHEN NEW.confidence < 0.0 OR NEW.confidence > 1.0 THEN
            RAISE(ABORT, 'CHECK constraint failed: confidence must be between 0.0 and 1.0')
        END;
      END;

      -- 5. Range Constraints for Attention Priority States (INSERT Trigger)
      CREATE TRIGGER IF NOT EXISTS trg_attention_check_insert
      BEFORE INSERT ON attention_states
      FOR EACH ROW
      BEGIN
        SELECT CASE
          WHEN NEW.score < 0.0 OR NEW.score > 100.0 THEN
            RAISE(ABORT, 'CHECK constraint failed: score must be between 0.0 and 100.0')
          WHEN NEW.confidence < 0.0 OR NEW.confidence > 100.0 THEN
            RAISE(ABORT, 'CHECK constraint failed: confidence must be between 0.0 and 100.0')
        END;
      END;

      -- 6. Integrity Constraint for Patients (INSERT Trigger)
      CREATE TRIGGER IF NOT EXISTS trg_patients_check_insert
      BEFORE INSERT ON patients
      FOR EACH ROW
      BEGIN
        SELECT CASE
          WHEN NEW.age < 0 OR NEW.age > 130 THEN
            RAISE(ABORT, 'CHECK constraint failed: age must be between 0 and 130')
        END;
      END;

      -- 7. Range Constraint for Labs (INSERT Trigger)
      CREATE TRIGGER IF NOT EXISTS trg_labs_check_insert
      BEFORE INSERT ON labs
      FOR EACH ROW
      BEGIN
        SELECT CASE
          WHEN NEW.value < 0.0 THEN
            RAISE(ABORT, 'CHECK constraint failed: lab value cannot be negative')
        END;
      END;
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

/**
 * Reverts migrations down to a specific target version (exclusive).
 * Reversions execute in strict reverse chronological order within immediate transactions.
 */
export function rollbackMigration(db: DatabaseSync, targetVersion: number = 0): AppliedMigration[] {
  const applied = getAppliedMigrations(db);
  const toRollback = applied
    .filter((m) => m.version > targetVersion)
    .sort((a, b) => b.version - a.version);

  const rolledBack: AppliedMigration[] = [];

  for (const m of toRollback) {
    const migrationDef = MIGRATIONS.find((def) => def.version === m.version);
    if (!migrationDef || !migrationDef.downSql) {
      throw new Error(`Cannot rollback migration ${m.version} (${m.name}): No downSql defined.`);
    }

    db.exec('BEGIN IMMEDIATE;');
    try {
      db.exec(migrationDef.downSql);
      const del = db.prepare('DELETE FROM _schema_migrations WHERE version = ?');
      del.run(m.version);
      db.exec('COMMIT;');
      rolledBack.push(m);
    } catch (err) {
      db.exec('ROLLBACK;');
      throw new Error(`Failed to rollback migration ${m.version} (${m.name}): ${err}`);
    }
  }

  return rolledBack;
}
