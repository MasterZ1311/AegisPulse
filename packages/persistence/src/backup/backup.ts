import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, unlinkSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

export interface BackupResult {
  backupFilePath: string;
  manifestFilePath: string;
  timestamp: number;
  sha256Checksum: string;
  sizeBytes: number;
}

export function createDatabaseBackup(db: DatabaseSync, destinationPath: string): BackupResult {
  const resolvedDest = resolve(destinationPath);
  const destDir = dirname(resolvedDest);

  if (!existsSync(destDir)) {
    mkdirSync(destDir, { recursive: true });
  }

  // SQLite VACUUM INTO requires target file not to exist
  if (existsSync(resolvedDest)) {
    unlinkSync(resolvedDest);
  }

  // SQLite online atomic backup into destination file
  // Note: Path parameter must be properly escaped in SQL string for VACUUM INTO
  const sanitizedPath = resolvedDest.replace(/'/g, "''");
  db.exec(`VACUUM INTO '${sanitizedPath}';`);

  // Compute SHA-256 checksum
  const fileBytes = readFileSync(resolvedDest);
  const hash = createHash('sha256').update(fileBytes).digest('hex');
  const sizeBytes = statSync(resolvedDest).size;
  const timestamp = Date.now();

  const manifest = {
    backupFilePath: resolvedDest,
    timestamp,
    sha256Checksum: hash,
    sizeBytes,
    createdAtIso: new Date(timestamp).toISOString(),
    aegisPulseVersion: '1.0.0',
  };

  const manifestPath = `${resolvedDest}.manifest.json`;
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  return {
    backupFilePath: resolvedDest,
    manifestFilePath: manifestPath,
    timestamp,
    sha256Checksum: hash,
    sizeBytes,
  };
}
