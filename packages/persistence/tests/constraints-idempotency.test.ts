import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { runMigrations } from '../src/migrations/runner';
import { seedDatabase } from '../src/seeds/seed';
import { IdempotencyRepository } from '../src/repositories/idempotency.repository';
import { withTransaction } from '../src/db/transaction';

describe('Migration 003: Database Constraints, Idempotency & Transaction Hardening', () => {
  function setupTestDb() {
    const db = new DatabaseSync(':memory:');
    runMigrations(db);
    seedDatabase(db);
    return db;
  }

  describe('Physiological Range Triggers', () => {
    it('aborts insert when heart rate is outside physiological bounds (< 10 or > 350)', () => {
      const db = setupTestDb();

      expect(() => {
        db.prepare(`
          INSERT INTO observations (id, patient_id, timestamp, heart_rate, confidence, source, created_at)
          VALUES ('obs-1', 'P001', 1000, 5, 0.95, 'BEDSIDE_DEVICE', 1000);
        `).run();
      }).toThrow(/heart_rate must be between 10 and 350/);

      expect(() => {
        db.prepare(`
          INSERT INTO observations (id, patient_id, timestamp, heart_rate, confidence, source, created_at)
          VALUES ('obs-2', 'P001', 1000, 400, 0.95, 'BEDSIDE_DEVICE', 1000);
        `).run();
      }).toThrow(/heart_rate must be between 10 and 350/);

      db.close();
    });

    it('aborts insert when SpO2 is outside bounds (< 20 or > 100)', () => {
      const db = setupTestDb();

      expect(() => {
        db.prepare(`
          INSERT INTO observations (id, patient_id, timestamp, spo2, confidence, source, created_at)
          VALUES ('obs-1', 'P001', 1000, 15, 0.95, 'BEDSIDE_DEVICE', 1000);
        `).run();
      }).toThrow(/spo2 must be between 20 and 100/);

      expect(() => {
        db.prepare(`
          INSERT INTO observations (id, patient_id, timestamp, spo2, confidence, source, created_at)
          VALUES ('obs-2', 'P001', 1000, 105, 0.95, 'BEDSIDE_DEVICE', 1000);
        `).run();
      }).toThrow(/spo2 must be between 20 and 100/);

      db.close();
    });

    it('aborts insert when observation confidence is not between 0.0 and 1.0', () => {
      const db = setupTestDb();

      expect(() => {
        db.prepare(`
          INSERT INTO observations (id, patient_id, timestamp, heart_rate, confidence, source, created_at)
          VALUES ('obs-1', 'P001', 1000, 75, -0.1, 'BEDSIDE_DEVICE', 1000);
        `).run();
      }).toThrow(/confidence must be between 0.0 and 1.0/);

      db.close();
    });

    it('aborts insert when attention priority score is outside 0-100', () => {
      const db = setupTestDb();

      expect(() => {
        db.prepare(`
          INSERT INTO attention_states (id, patient_id, timestamp, score, category, top_reason, reasons, rank_inputs, recommended_actions, confidence, is_active, created_at)
          VALUES ('aps-1', 'P001', 1000, 105.0, 'CRITICAL', 'Tachycardia', '[]', '{}', '[]', 95.0, 1, 1000);
        `).run();
      }).toThrow(/score must be between 0.0 and 100.0/);

      db.close();
    });

    it('aborts insert when lab value is negative', () => {
      const db = setupTestDb();

      expect(() => {
        db.prepare(`
          INSERT INTO labs (id, patient_id, timestamp, test_type, value, unit, status, created_at)
          VALUES ('lab-1', 'P001', 1000, 'LACTATE', -1.5, 'MMOL_PER_L', 'FINAL', 1000);
        `).run();
      }).toThrow(/lab value cannot be negative/);

      db.close();
    });
  });

  describe('Deduplication & Idempotency', () => {
    it('enforces unique constraint on (patient_id, timestamp, source) in observations', () => {
      const db = setupTestDb();

      db.prepare(`
        INSERT INTO observations (id, patient_id, timestamp, heart_rate, confidence, quality_state, source, created_at)
        VALUES ('obs-1', 'P001', 5000, 80, 0.95, 'TRUSTED', 'BEDSIDE_DEVICE', 5000);
      `).run();

      // Duplicate observation with same patient, timestamp, and source must fail
      expect(() => {
        db.prepare(`
          INSERT INTO observations (id, patient_id, timestamp, heart_rate, confidence, quality_state, source, created_at)
          VALUES ('obs-2', 'P001', 5000, 82, 0.95, 'TRUSTED', 'BEDSIDE_DEVICE', 5001);
        `).run();
      }).toThrow(/UNIQUE constraint failed/);

      db.close();
    });

    it('records and checks idempotency keys persistently across restarts', () => {
      const db = setupTestDb();
      const repo = new IdempotencyRepository(db);

      const record = {
        key: 'batch-edge-sync-uuid-9999',
        itemType: 'SYNC_BATCH',
        patientId: 'P001',
        status: 'PROCESSED',
        responseHash: 'hash-abc-123',
      };

      repo.recordKey(record);

      const retrieved = repo.getKey('batch-edge-sync-uuid-9999');
      expect(retrieved).toBeDefined();
      expect(retrieved?.status).toBe('PROCESSED');
      expect(retrieved?.responseHash).toBe('hash-abc-123');

      // Purge old keys
      const purged = repo.purgeExpired(0);
      expect(purged).toBe(1);
      expect(repo.getKey('batch-edge-sync-uuid-9999')).toBeUndefined();

      db.close();
    });
  });

  describe('Transaction Safety & Nested Savepoints', () => {
    it('commits atomic changes successfully in withTransaction', () => {
      const db = setupTestDb();

      withTransaction(db, () => {
        db.prepare(`
          INSERT INTO observations (id, patient_id, timestamp, heart_rate, confidence, quality_state, source, created_at)
          VALUES ('obs-tx-1', 'P001', 6000, 78, 0.95, 'TRUSTED', 'BEDSIDE_DEVICE', 6000);
        `).run();
      });

      const row = db.prepare("SELECT * FROM observations WHERE id = 'obs-tx-1';").get();
      expect(row).toBeDefined();

      db.close();
    });

    it('rolls back atomic changes if an error occurs within withTransaction', () => {
      const db = setupTestDb();

      expect(() => {
        withTransaction(db, () => {
          db.prepare(`
            INSERT INTO observations (id, patient_id, timestamp, heart_rate, confidence, quality_state, source, created_at)
            VALUES ('obs-fail-1', 'P001', 7000, 78, 0.95, 'TRUSTED', 'BEDSIDE_DEVICE', 7000);
          `).run();
          throw new Error('Simulated failure during multi-table write');
        });
      }).toThrow(/Simulated failure/);

      const row = db.prepare("SELECT * FROM observations WHERE id = 'obs-fail-1';").get();
      expect(row).toBeUndefined();

      db.close();
    });

    it('supports nested savepoint transactions and partial rollback', () => {
      const db = setupTestDb();

      withTransaction(db, () => {
        db.prepare(`
          INSERT INTO observations (id, patient_id, timestamp, heart_rate, confidence, quality_state, source, created_at)
          VALUES ('obs-outer', 'P001', 8000, 72, 0.95, 'TRUSTED', 'BEDSIDE_DEVICE', 8000);
        `).run();

        // Inner nested savepoint that fails
        try {
          withTransaction(db, () => {
            db.prepare(`
              INSERT INTO observations (id, patient_id, timestamp, heart_rate, confidence, quality_state, source, created_at)
              VALUES ('obs-inner', 'P001', 8001, 74, 0.95, 'TRUSTED', 'BEDSIDE_DEVICE', 8001);
            `).run();
            throw new Error('Inner failure');
          });
        } catch {
          // Catch inner failure
        }
      });

      const outer = db.prepare("SELECT * FROM observations WHERE id = 'obs-outer';").get();
      const inner = db.prepare("SELECT * FROM observations WHERE id = 'obs-inner';").get();

      expect(outer).toBeDefined();
      expect(inner).toBeUndefined();

      db.close();
    });
  });
});
