import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';
import { existsSync, rmSync, mkdirSync } from 'node:fs';
import { runMigrations } from '../src/migrations/runner';
import { seedDatabase } from '../src/seeds/seed';
import { createDatabaseBackup } from '../src/backup/backup';
import { restoreDatabaseBackup } from '../src/backup/restore';
import { PatientRepository } from '../src/repositories/patient.repository';

describe('Database Backup & Restore Procedure', () => {
  const tempDir = resolve(process.cwd(), 'temp-backup-test');
  const tempDbPath = resolve(tempDir, 'live.db');
  const backupPath = resolve(tempDir, 'backup.db');
  const restorePath = resolve(tempDir, 'restored.db');

  beforeAll(() => {
    if (existsSync(tempDir)) {
      try {
        rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore
      }
    }
    mkdirSync(tempDir, { recursive: true });
  });

  afterAll(async () => {
    await new Promise((r) => setTimeout(r, 100));
    try {
      if (existsSync(tempDir)) {
        rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {
      // Ignore OS lock delay on Windows
    }
  });

  it('performs atomic point-in-time online backup with SHA-256 manifest', () => {
    // 1. Initialize live disk database and seed it
    const liveDb = new DatabaseSync(tempDbPath);
    runMigrations(liveDb);
    seedDatabase(liveDb);

    // 2. Perform online backup via VACUUM INTO
    const backupResult = createDatabaseBackup(liveDb, backupPath);

    expect(existsSync(backupPath)).toBe(true);
    expect(existsSync(backupResult.manifestFilePath)).toBe(true);
    expect(backupResult.sha256Checksum.length).toBe(64);
    expect(backupResult.sizeBytes).toBeGreaterThan(0);

    liveDb.close();
  }, 60000);

  it('restores from backup, validates checksum, and verifies SQLite integrity check', () => {
    const liveDb = new DatabaseSync(tempDbPath);
    const backupResult = createDatabaseBackup(liveDb, backupPath);

    // Mutate live database to verify difference
    liveDb.exec("DELETE FROM patients WHERE id = 'P001';");
    const countAfterDelete = liveDb.prepare('SELECT COUNT(*) as count FROM patients;').get() as any;
    expect(countAfterDelete.count).toBe(5);
    liveDb.close();

    // Restore to new target
    const restoreResult = restoreDatabaseBackup(
      backupPath,
      restorePath,
      backupResult.sha256Checksum
    );

    expect(restoreResult.checksumVerified).toBe(true);
    expect(restoreResult.integrityCheckPassed).toBe(true);
    expect(restoreResult.integrityMessage).toBe('ok');

    // Verify restored database has all 6 patients including P001
    const restoredDb = new DatabaseSync(restorePath);
    const patientRepo = new PatientRepository(restoredDb);
    const p1 = patientRepo.getPatient('P001');
    expect(p1).toBeDefined();
    expect(p1?.name).toBe('Ananya Ramanathan');

    const totalPatients = restoredDb.prepare('SELECT COUNT(*) as count FROM patients;').get() as any;
    expect(totalPatients.count).toBe(6);

    restoredDb.close();
  });

  it('rejects restore if expected checksum does not match', () => {
    expect(() => {
      restoreDatabaseBackup(backupPath, restorePath, 'invalid-checksum-hash-value');
    }).toThrow(/Checksum mismatch/);
  });
});
