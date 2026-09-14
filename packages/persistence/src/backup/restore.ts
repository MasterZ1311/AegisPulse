import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { readFileSync, copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

export interface RestoreResult {
  restoredPath: string;
  sourceBackupPath: string;
  checksumVerified: boolean;
  integrityCheckPassed: boolean;
  integrityMessage: string;
}

export function restoreDatabaseBackup(
  backupFilePath: string,
  targetDbPath: string,
  expectedChecksum?: string
): RestoreResult {
  const resolvedBackup = resolve(backupFilePath);
  const resolvedTarget = resolve(targetDbPath);

  if (!existsSync(resolvedBackup)) {
    throw new Error(`Backup file not found at: ${resolvedBackup}`);
  }

  // 1. Verify Checksum if provided
  let checksumVerified = false;
  if (expectedChecksum) {
    const fileBytes = readFileSync(resolvedBackup);
    const calculated = createHash('sha256').update(fileBytes).digest('hex');
    if (calculated !== expectedChecksum) {
      throw new Error(`Checksum mismatch: expected ${expectedChecksum}, got ${calculated}`);
    }
    checksumVerified = true;
  }

  // 2. Ensure target directory exists
  const targetDir = dirname(resolvedTarget);
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }

  // 3. Copy backup file to target location
  copyFileSync(resolvedBackup, resolvedTarget);

  // 4. Open and perform PRAGMA integrity_check
  const testDb = new DatabaseSync(resolvedTarget);
  const row = testDb.prepare('PRAGMA integrity_check;').get() as { integrity_check?: string } | undefined;
  const integrityMessage = (row && (row as any).integrity_check) || 'ok';
  const integrityCheckPassed = integrityMessage.toLowerCase() === 'ok';

  testDb.close();

  if (!integrityCheckPassed) {
    throw new Error(`SQLite integrity check failed for restored database: ${integrityMessage}`);
  }

  return {
    restoredPath: resolvedTarget,
    sourceBackupPath: resolvedBackup,
    checksumVerified,
    integrityCheckPassed,
    integrityMessage,
  };
}
