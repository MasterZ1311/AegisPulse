import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

export interface DatabaseConnectionOptions {
  dbPath?: string;
  enableWal?: boolean;
  busyTimeoutMs?: number;
}

export function createDatabaseConnection(options?: DatabaseConnectionOptions): DatabaseSync {
  const dbPath = options?.dbPath || process.env.AEGIS_DB_PATH || ':memory:';

  // Ensure parent directory exists for file-based databases
  if (dbPath !== ':memory:' && !existsSync(dirname(dbPath))) {
    mkdirSync(dirname(dbPath), { recursive: true });
  }

  const db = new DatabaseSync(dbPath);

  // Enable foreign keys constraint enforcement
  db.exec('PRAGMA foreign_keys = ON;');

  // Set busy timeout to prevent locking contention between concurrent rPPG / simulation streams
  const timeout = options?.busyTimeoutMs ?? 5000;
  db.exec(`PRAGMA busy_timeout = ${timeout};`);

  // WAL mode for disk files (skip for in-memory)
  if (dbPath !== ':memory:' && (options?.enableWal ?? true)) {
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA synchronous = NORMAL;');
  }

  return db;
}
