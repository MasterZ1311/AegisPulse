import { DatabaseSync } from 'node:sqlite';

/**
 * Executes a function within an SQLite transaction.
 * Uses SAVEPOINT to correctly handle nested transactions without crashing.
 */
export function withTransaction<T>(db: DatabaseSync, fn: () => T): T {
  const savepointName = `sp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  db.exec(`SAVEPOINT ${savepointName};`);
  try {
    const result = fn();
    db.exec(`RELEASE SAVEPOINT ${savepointName};`);
    return result;
  } catch (err) {
    try {
      db.exec(`ROLLBACK TO SAVEPOINT ${savepointName};`);
    } catch {
      // Ignore rollback failure if db is already closed or in error state
    }
    throw err;
  }
}
