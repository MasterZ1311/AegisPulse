import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { runMigrations, getAppliedMigrations, MIGRATIONS } from '../src/migrations/runner';

describe('Database Migration Engine', () => {
  it('starts with zero applied migrations on fresh database', () => {
    const db = new DatabaseSync(':memory:');
    const applied = getAppliedMigrations(db);
    expect(applied).toEqual([]);
    db.close();
  });

  it('applies all versioned migrations in transaction', () => {
    const db = new DatabaseSync(':memory:');
    const newlyApplied = runMigrations(db);

    expect(newlyApplied.length).toBe(MIGRATIONS.length);
    expect(newlyApplied[0].name).toBe('001_initial_schema');
    expect(newlyApplied[1].name).toBe('002_indexes');
    expect(newlyApplied[2].name).toBe('003_constraints_and_hardening');

    const applied = getAppliedMigrations(db);
    expect(applied.length).toBe(MIGRATIONS.length);
    expect(applied.map((m) => m.version)).toEqual([1, 2, 3]);

    // Verify tables exist
    const expectedTables = [
      '_schema_migrations',
      'wards',
      'beds',
      'patients',
      'clinical_contexts',
      'observations',
      'labs',
      'timeline_events',
      'attention_states',
      'acknowledgements',
      'clinical_actions',
      'users',
      'audit_events',
      'idempotency_keys',
    ];

    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table';").all() as any[];
    const tableNames = new Set(tables.map((t) => t.name));

    for (const expected of expectedTables) {
      expect(tableNames.has(expected), `Table ${expected} must exist`).toBe(true);
    }

    // Verify required indexes exist
    const expectedIndexes = [
      'idx_observations_patient_ts',
      'idx_labs_patient_ts',
      'idx_timeline_patient_ts',
      'idx_attention_patient_active',
      'idx_acknowledgements_patient',
      'idx_clinical_contexts_patient',
      'idx_clinical_actions_patient',
      'idx_observations_ts',
      'idx_timeline_ts',
      'idx_audit_events_ts',
      'idx_attention_ts',
      'idx_beds_ward',
      'idx_patients_ward',
      'idx_attention_active_score',
      'idx_attention_patient_active_ts',
    ];

    const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index';").all() as any[];
    const indexNames = new Set(indexes.map((i) => i.name));

    for (const expected of expectedIndexes) {
      expect(indexNames.has(expected), `Index ${expected} must exist`).toBe(true);
    }

    db.close();
  });

  it('is strictly idempotent on subsequent runs without re-executing migrations', () => {
    const db = new DatabaseSync(':memory:');
    const firstRun = runMigrations(db);
    expect(firstRun.length).toBe(MIGRATIONS.length);

    const secondRun = runMigrations(db);
    expect(secondRun.length).toBe(0);

    const applied = getAppliedMigrations(db);
    expect(applied.length).toBe(MIGRATIONS.length);
    db.close();
  });
});
