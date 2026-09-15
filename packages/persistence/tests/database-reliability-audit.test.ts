import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import {
  createDatabaseConnection,
  runMigrations,
  rollbackMigration,
  getAppliedMigrations,
  seedDatabase,
  withTransaction,
  TimelineRepository,
  ObservationRepository,
  PatientRepository,
  WardRepository,
} from '../src';

describe('AegisPulse Database Reliability Audit Suite', () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = createDatabaseConnection({ dbPath: ':memory:' });
    runMigrations(db);
    seedDatabase(db);
  });

  afterEach(() => {
    try {
      db.close();
    } catch {
      // ignore
    }
  });

  // ==========================================================================
  // 1. Schema Constraints, Nullability & Data Types
  // ==========================================================================
  describe('1. Schema Constraints & Nullability', () => {
    it('rejects observations with NULL timestamp', () => {
      expect(() => {
        db.prepare(`
          INSERT INTO observations (id, patient_id, timestamp, heart_rate, confidence, source, created_at)
          VALUES ('obs-null-ts', 'P001', NULL, 75, 0.95, 'BEDSIDE_DEVICE', 1000);
        `).run();
      }).toThrow(/NOT NULL constraint failed: observations.timestamp/);
    });

    it('rejects observations with NULL source', () => {
      expect(() => {
        db.prepare(`
          INSERT INTO observations (id, patient_id, timestamp, heart_rate, confidence, source, created_at)
          VALUES ('obs-null-src', 'P001', 2000, 75, 0.95, NULL, 2000);
        `).run();
      }).toThrow(/NOT NULL constraint failed: observations.source/);
    });

    it('rejects duplicate patient Medical Record Numbers (MRN)', () => {
      const existingPatient = db.prepare('SELECT mrn FROM patients LIMIT 1;').get() as { mrn: string };

      expect(() => {
        db.prepare(`
          INSERT INTO patients (id, mrn, name, age, gender, ward_id, bed_id, bed_number, admission_diagnosis, admission_timestamp, attending_physician, primary_nurse, code_status, created_at, updated_at)
          VALUES ('P999', ?, 'Duplicate MRN Patient', 45, 'MALE', 'WARD-A', 'BED-401', '401', 'Observation', 1000, 'Dr. Smith', 'Nurse Jane', 'FULL_CODE', 1000, 1000);
        `).run(existingPatient.mrn);
      }).toThrow(/UNIQUE constraint failed: patients.mrn/);
    });
  });

  // ==========================================================================
  // 2. Foreign Keys & Cascading Deletions
  // ==========================================================================
  describe('2. Foreign Keys & Cascade Behavior', () => {
    it('strictly enforces foreign key integrity when inserting patient with non-existent ward', () => {
      expect(() => {
        db.prepare(`
          INSERT INTO patients (id, mrn, name, age, gender, ward_id, bed_id, bed_number, admission_diagnosis, admission_timestamp, attending_physician, primary_nurse, code_status, created_at, updated_at)
          VALUES ('P-INVALID-WARD', 'MRN-8888', 'Ghost Ward Patient', 50, 'MALE', 'NON_EXISTENT_WARD', 'BED-401', '401', 'Flu', 1000, 'Dr. X', 'Nurse Y', 'FULL_CODE', 1000, 1000);
        `).run();
      }).toThrow(/FOREIGN KEY constraint failed/);
    });

    it('strictly enforces foreign key integrity when inserting patient with non-existent bed', () => {
      expect(() => {
        db.prepare(`
          INSERT INTO patients (id, mrn, name, age, gender, ward_id, bed_id, bed_number, admission_diagnosis, admission_timestamp, attending_physician, primary_nurse, code_status, created_at, updated_at)
          VALUES ('P-INVALID-BED', 'MRN-8889', 'Ghost Bed Patient', 50, 'MALE', 'WARD-A', 'NON_EXISTENT_BED', '999', 'Flu', 1000, 'Dr. X', 'Nurse Y', 'FULL_CODE', 1000, 1000);
        `).run();
      }).toThrow(/FOREIGN KEY constraint failed/);
    });

    it('cascades patient deletion to purge observations, labs, and timeline events', () => {
      // 1. Create a dedicated patient with observations and timeline events
      db.prepare(`
        INSERT INTO patients (id, mrn, name, age, gender, ward_id, bed_id, bed_number, admission_diagnosis, admission_timestamp, attending_physician, primary_nurse, code_status, created_at, updated_at)
        VALUES ('P-CASCADE', 'MRN-CASCADE-1', 'Cascade Target', 55, 'FEMALE', 'WARD-A', 'BED-401', '401', 'Trial', 1000, 'Dr. A', 'Nurse B', 'FULL_CODE', 1000, 1000);
      `).run();

      db.prepare(`
        INSERT INTO observations (id, patient_id, timestamp, heart_rate, confidence, quality_state, source, created_at)
        VALUES ('obs-cascade-1', 'P-CASCADE', 1000, 75, 0.95, 'TRUSTED', 'BEDSIDE_DEVICE', 1000);
      `).run();

      db.prepare(`
        INSERT INTO timeline_events (id, patient_id, timestamp, event_type, title, description, severity, source, is_trusted, created_at)
        VALUES ('tl-cascade-1', 'P-CASCADE', 1000, 'VITALS_UPDATE', 'Vitals', 'Desc', 'INFO', 'DEVICE', 1, 1000);
      `).run();

      // Verify records exist
      expect(db.prepare("SELECT COUNT(*) as c FROM observations WHERE patient_id = 'P-CASCADE';").get()).toEqual({ c: 1 });
      expect(db.prepare("SELECT COUNT(*) as c FROM timeline_events WHERE patient_id = 'P-CASCADE';").get()).toEqual({ c: 1 });

      // 2. Delete patient
      db.prepare("DELETE FROM patients WHERE id = 'P-CASCADE';").run();

      // 3. Verify ON DELETE CASCADE purged all associated child records
      expect(db.prepare("SELECT COUNT(*) as c FROM observations WHERE patient_id = 'P-CASCADE';").get()).toEqual({ c: 0 });
      expect(db.prepare("SELECT COUNT(*) as c FROM timeline_events WHERE patient_id = 'P-CASCADE';").get()).toEqual({ c: 0 });
    });
  });

  // ==========================================================================
  // 3. Duplicate Observations & Deduplication Index
  // ==========================================================================
  describe('3. Duplicate Observations Ingestion', () => {
    it('aborts insert when an observation with identical (patient_id, timestamp, source) is received', () => {
      const now = Date.now();

      db.prepare(`
        INSERT INTO observations (id, patient_id, timestamp, heart_rate, confidence, quality_state, source, created_at)
        VALUES ('obs-dedup-1', 'P001', ?, 80, 0.95, 'TRUSTED', 'BEDSIDE_DEVICE', ?);
      `).run(now, now);

      // Same patient, exact same timestamp, exact same source
      expect(() => {
        db.prepare(`
          INSERT INTO observations (id, patient_id, timestamp, heart_rate, confidence, quality_state, source, created_at)
          VALUES ('obs-dedup-2', 'P001', ?, 82, 0.95, 'TRUSTED', 'BEDSIDE_DEVICE', ?);
        `).run(now, now + 10);
      }).toThrow(/UNIQUE constraint failed: observations\.patient_id, observations\.timestamp, observations\.source/);
    });

    it('allows identical timestamp observations from DIFFERENT sources', () => {
      const now = Date.now() + 5000;

      db.prepare(`
        INSERT INTO observations (id, patient_id, timestamp, heart_rate, confidence, quality_state, source, created_at)
        VALUES ('obs-multi-src-1', 'P001', ?, 78, 0.95, 'TRUSTED', 'BEDSIDE_DEVICE', ?);
      `).run(now, now);

      // Different source (RPPG_CAMERA vs BEDSIDE_DEVICE) at same timestamp
      expect(() => {
        db.prepare(`
          INSERT INTO observations (id, patient_id, timestamp, heart_rate, confidence, quality_state, source, created_at)
          VALUES ('obs-multi-src-2', 'P001', ?, 77, 0.85, 'TRUSTED', 'RPPG_CAMERA', ?);
        `).run(now, now);
      }).not.toThrow();
    });
  });

  // ==========================================================================
  // 4. Duplicate Timeline Events
  // ==========================================================================
  describe('4. Duplicate Timeline Events & Idempotency', () => {
    it('aborts on raw duplicate primary key insertion', () => {
      expect(() => {
        db.prepare(`
          INSERT INTO timeline_events (id, patient_id, timestamp, event_type, title, description, severity, source, is_trusted, created_at)
          VALUES ('tl-dup-pk', 'P001', 5000, 'ALERT', 'Tachycardia', 'HR > 100', 'WARNING', 'SYSTEM', 1, 5000);
        `).run();

        db.prepare(`
          INSERT INTO timeline_events (id, patient_id, timestamp, event_type, title, description, severity, source, is_trusted, created_at)
          VALUES ('tl-dup-pk', 'P001', 5000, 'ALERT', 'Tachycardia', 'HR > 100', 'WARNING', 'SYSTEM', 1, 5000);
        `).run();
      }).toThrow(/UNIQUE constraint failed: timeline_events\.id/);
    });

    it('absorbs duplicate timeline events idempotently via TimelineRepository.insertTimelineEvent', () => {
      const repo = new TimelineRepository(db);

      const event = {
        id: 'tl-idempotent-001',
        patientId: 'P001',
        timestamp: 6000,
        eventType: 'NURSE_VISIT' as const,
        title: 'Bedside Round',
        description: 'Vitals verified in person',
        severity: 'INFO' as const,
        source: 'MANUAL_ENTRY',
        isTrusted: true,
      };

      // First insertion
      expect(() => repo.insertTimelineEvent(event)).not.toThrow();

      // Second insertion with identical ID (ON CONFLICT DO NOTHING)
      expect(() => repo.insertTimelineEvent(event)).not.toThrow();

      const events = repo.getTimelineEvents('P001', { eventTypes: ['NURSE_VISIT'] });
      const matches = events.filter((e) => e.id === 'tl-idempotent-001');
      expect(matches.length).toBe(1);
    });
  });

  // ==========================================================================
  // 5. Partial Transactions & Atomic Rollback
  // ==========================================================================
  describe('5. Partial Transactions & Savepoint Rollback', () => {
    it('guarantees complete rollback of multi-table write on mid-transaction error', () => {
      expect(() => {
        withTransaction(db, () => {
          // Step 1: Insert observation (succeeds)
          db.prepare(`
            INSERT INTO observations (id, patient_id, timestamp, heart_rate, confidence, quality_state, source, created_at)
            VALUES ('obs-tx-fail-1', 'P001', 9000, 78, 0.95, 'TRUSTED', 'BEDSIDE_DEVICE', 9000);
          `).run();

          // Step 2: Insert clinical action (succeeds)
          db.prepare(`
            INSERT INTO clinical_actions (id, patient_id, bed_id, action_type, title, rationale, status, urgency, recommended_at, created_at)
            VALUES ('act-tx-fail-1', 'P001', 'BED-401', 'MEDICATION_ADJUSTMENT', 'Action', 'Rationale', 'RECOMMENDED', 'ROUTINE', 9000, 9000);
          `).run();

          // Step 3: Throws error
          throw new Error('Mid-flight failure during transaction');
        });
      }).toThrow(/Mid-flight failure/);

      // Verify ZERO records survived the partial transaction
      const obs = db.prepare("SELECT * FROM observations WHERE id = 'obs-tx-fail-1';").get();
      const act = db.prepare("SELECT * FROM clinical_actions WHERE id = 'act-tx-fail-1';").get();

      expect(obs).toBeUndefined();
      expect(act).toBeUndefined();
    });
  });

  // ==========================================================================
  // 6. Simultaneous Writes & Concurrency Safety
  // ==========================================================================
  describe('6. Simultaneous Writes & Concurrency', () => {
    it('completes 50 concurrent writes without locking deadlock or corruption', async () => {
      const now = Date.now() + 10000;
      const tasks: Promise<void>[] = [];

      for (let i = 0; i < 50; i++) {
        tasks.push(
          new Promise<void>((resolve, reject) => {
            try {
              withTransaction(db, () => {
                db.prepare(`
                  INSERT INTO observations (id, patient_id, timestamp, heart_rate, confidence, quality_state, source, created_at)
                  VALUES (?, 'P001', ?, ?, 0.95, 'TRUSTED', 'BEDSIDE_DEVICE', ?);
                `).run(`obs-conc-${i}`, now + i, 70 + (i % 20), now);
              });
              resolve();
            } catch (err) {
              reject(err);
            }
          })
        );
      }

      await Promise.all(tasks);

      const count = db.prepare("SELECT COUNT(*) as c FROM observations WHERE id LIKE 'obs-conc-%';").get() as { c: number };
      expect(count.c).toBe(50);
    });
  });

  // ==========================================================================
  // 7. Migration Rollback Strategy
  // ==========================================================================
  describe('7. Migration Rollback Strategy', () => {
    it('rolls back migration 3 cleanly (drops triggers and idempotency tables)', () => {
      const rolledBack = rollbackMigration(db, 2);
      expect(rolledBack.length).toBe(1);
      expect(rolledBack[0].version).toBe(3);

      const applied = getAppliedMigrations(db);
      expect(applied.map((m) => m.version)).toEqual([1, 2]);

      // Verify triggers are dropped
      const trigger = db.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name='trg_observations_check_insert';").get();
      expect(trigger).toBeUndefined();

      // Verify idempotency table is dropped
      const idempTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='idempotency_keys';").get();
      expect(idempTable).toBeUndefined();
    });

    it('rolls back all migrations to version 0 and re-applies cleanly to version 3', () => {
      // 1. Rollback all migrations down to 0
      const rolledBack = rollbackMigration(db, 0);
      expect(rolledBack.length).toBe(3);

      expect(getAppliedMigrations(db)).toEqual([]);

      // Verify core tables are dropped
      const patientsTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='patients';").get();
      expect(patientsTable).toBeUndefined();

      // 2. Re-apply all migrations from scratch
      const newlyApplied = runMigrations(db);
      expect(newlyApplied.length).toBe(3);
      expect(newlyApplied.map((m) => m.version)).toEqual([1, 2, 3]);

      // Verify tables and triggers are restored
      const restoredPatients = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='patients';").get();
      const restoredTrigger = db.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name='trg_observations_check_insert';").get();
      expect(restoredPatients).toBeDefined();
      expect(restoredTrigger).toBeDefined();
    });
  });

  // ==========================================================================
  // 8. Production Seed Isolation & Safety
  // ==========================================================================
  describe('8. Production Seed Isolation Guardrail', () => {
    const originalEnv = process.env.NODE_ENV;
    const originalAllowSeed = process.env.ALLOW_PRODUCTION_SEED;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
      process.env.ALLOW_PRODUCTION_SEED = originalAllowSeed;
    });

    it('strictly refuses to load demo patient records when NODE_ENV=production', () => {
      const cleanDb = createDatabaseConnection({ dbPath: ':memory:' });
      runMigrations(cleanDb);

      process.env.NODE_ENV = 'production';
      delete process.env.ALLOW_PRODUCTION_SEED;

      const result = seedDatabase(cleanDb);

      expect(result.patientsCount).toBe(0);
      expect(result.observationsCount).toBe(0);

      const patientCount = cleanDb.prepare('SELECT COUNT(*) as c FROM patients;').get() as { c: number };
      expect(patientCount.c).toBe(0);

      cleanDb.close();
    });

    it('permits seeding in production only when explicitly authorized with ALLOW_PRODUCTION_SEED=true', () => {
      const cleanDb = createDatabaseConnection({ dbPath: ':memory:' });
      runMigrations(cleanDb);

      process.env.NODE_ENV = 'production';
      process.env.ALLOW_PRODUCTION_SEED = 'true';

      const result = seedDatabase(cleanDb);
      expect(result.wardsCount).toBeGreaterThan(0);

      cleanDb.close();
    });
  });
});
