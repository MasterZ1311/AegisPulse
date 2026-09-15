# AegisPulse Database Operations Manual

## 1. Persistence Architecture Overview

AegisPulse employs Node.js native `node:sqlite` (`DatabaseSync`) as its embedded, zero-network-dependency persistence engine. In high-acuity intensive care environments, eliminating network-hop latencies to external database clusters guarantees sub-millisecond Attention Priority Score (APS) computation and zero telemetry packet drops.

### Engine Configuration

| Setting / Pragma | Value | Purpose |
| :--- | :--- | :--- |
| **Storage Engine** | Embedded SQLite (`DatabaseSync`) | In-process zero-latency clinical storage |
| **Journal Mode** | `PRAGMA journal_mode = WAL;` | Write-Ahead Logging allows concurrent readers alongside a writer |
| **Synchronous** | `PRAGMA synchronous = NORMAL;` | Guarantees WAL durability with optimal NVMe write throughput |
| **Foreign Keys** | `PRAGMA foreign_keys = ON;` | Strict relational integrity and cascading deletes |
| **Busy Timeout** | `PRAGMA busy_timeout = 5000;` | Prevents lock contention failures between concurrent telemetry streams |
| **Cache Size** | `PRAGMA cache_size = -64000;` | Allocates 64MB RAM page cache |
| **Temp Store** | `PRAGMA temp_store = MEMORY;` | In-memory temporary tables and sorting |

---

## 2. Migration Procedure

All schema transformations are versioned and executed through `packages/persistence/src/migrations/runner.ts`.

### 2.1 Applied Migrations Ledger

Migrations record execution in the internal `_schema_migrations` audit table:
```sql
CREATE TABLE IF NOT EXISTS _schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at INTEGER NOT NULL
);
```

### 2.2 Forward Migration Execution

To apply pending migrations to a database:
```bash
# Programmatic execution
import { createDatabaseConnection, runMigrations } from '@aegispulse/persistence';

const db = createDatabaseConnection({ dbPath: process.env.AEGIS_DB_PATH });
const newlyApplied = runMigrations(db);
console.log(`Applied ${newlyApplied.length} migrations.`);
db.close();
```

**Transactional Guarantees:**
- Each migration is executed inside a `BEGIN IMMEDIATE; ... COMMIT;` transaction block.
- If any DDL statement fails, the transaction is immediately rolled back via `ROLLBACK;` and the migration is aborted without polluting `_schema_migrations`.
- `runMigrations()` is 100% idempotent: running it repeatedly against an up-to-date database executes zero SQL and introduces zero downtime.

### 2.3 Migration Rollback Procedure

When a deployment requires reversion to an earlier schema version:
```typescript
import { createDatabaseConnection, rollbackMigration } from '@aegispulse/persistence';

const db = createDatabaseConnection({ dbPath: process.env.AEGIS_DB_PATH });
// Reverts migrations down to targetVersion (e.g. down to version 2)
const rolledBack = rollbackMigration(db, 2);
console.log(`Rolled back ${rolledBack.length} migrations.`);
db.close();
```

**Rollback Invariants:**
- Reversions execute in strict reverse chronological order (e.g. Migration 3 $\rightarrow$ Migration 2 $\rightarrow$ Migration 1).
- Each down-migration executes inside an atomic `BEGIN IMMEDIATE; ... COMMIT;` block.
- Corresponding version rows are removed from `_schema_migrations`.

---

## 3. Backup Procedure

AegisPulse implements online atomic snapshotting using SQLite's native `VACUUM INTO` command. This creates a fully defragmented, consistent point-in-time copy of the database without stopping the service or interrupting real-time rPPG ingestion.

### 3.1 Automated Snapshot Script

```typescript
import { createDatabaseConnection, createDatabaseBackup } from '@aegispulse/persistence';

const db = createDatabaseConnection({ dbPath: process.env.AEGIS_DB_PATH });
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = `./backups/aegispulse_backup_${timestamp}.db`;

const result = createDatabaseBackup(db, backupPath);
console.log(`Backup created at: ${result.backupFilePath}`);
console.log(`SHA-256 Checksum: ${result.sha256Checksum}`);
console.log(`Manifest File: ${result.manifestFilePath}`);
```

### 3.2 Backup Manifest (`.manifest.json`)

Every snapshot generates an adjacent cryptographic manifest file:
```json
{
  "backupFilePath": "E:/AegisPulse/backups/aegispulse_backup_2026-09-15T13-30-00.db",
  "timestamp": 1789459800000,
  "sha256Checksum": "a1b2c3d4e5f6...",
  "sizeBytes": 1048576,
  "createdAtIso": "2026-09-15T13:30:00.000Z",
  "aegisPulseVersion": "1.0.0"
}
```

### 3.3 Production Backup Policy

- **Frequency:** Hourly automated snapshot during active inpatient monitoring.
- **Retention:** 24 hourly snapshots + 7 daily snapshots + 4 weekly snapshots.
- **Offsite Sync:** Automated push to encrypted cold storage volume.

---

## 4. Restore Procedure

Database restoration replaces the active database file with a verified backup snapshot.

### 4.1 Verification & Restore Protocol

```typescript
import { restoreDatabaseBackup } from '@aegispulse/persistence';

const sourceBackup = './backups/aegispulse_backup_2026-09-15T13-30-00.db';
const targetPath = process.env.AEGIS_DB_PATH;
const expectedChecksum = 'a1b2c3d4e5f6...'; // From manifest

const result = restoreDatabaseBackup(sourceBackup, targetPath, expectedChecksum);

console.log(`Restored database to: ${result.restoredPath}`);
console.log(`Checksum Verified: ${result.checksumVerified}`);
console.log(`Integrity Check: ${result.integrityMessage}`);
```

### 4.2 Step-by-Step Production Disaster Recovery

1. **Stop API Server:** Prevent writes during restore:
   ```bash
   npm run stop:api # or kill container process
   ```
2. **Locate Latest Valid Snapshot & Manifest:** Check the manifest for the expected SHA-256 checksum.
3. **Execute Restore:** Use `restoreDatabaseBackup()` which:
   - Computes SHA-256 of the backup file and verifies it against the manifest.
   - Copies the backup file to `AEGIS_DB_PATH`.
   - Opens the restored database and executes `PRAGMA integrity_check;`.
4. **Restart API Service:**
   ```bash
   npm run start:api
   ```
5. **Verify Readiness:** Probe `GET /ready` to confirm HTTP 200 OK and clinical database status `ONLINE`.

---

## 5. Recovery & Crash Consistency

### 5.1 WAL Crash Recovery

Because AegisPulse runs in WAL mode (`journal_mode = WAL`), any sudden container termination, power failure, or process crash leaves the main database file untouched while uncommitted transactions remain in the `-wal` file.
- Upon restart, `node:sqlite` automatically reads the WAL index and recovers to the last committed atomic transaction.
- Uncommitted transactions are automatically rolled back.

### 5.2 Clean Checkpointing (`wal_checkpoint`)

During graceful shutdown (`SIGINT` / `SIGTERM`), the service invokes:
```typescript
import { closeDatabaseConnection } from '@aegispulse/persistence';

closeDatabaseConnection(db);
```
This executes `PRAGMA wal_checkpoint(TRUNCATE);`, which flushes all WAL pages into the primary `.db` file and truncates the WAL file to 0 bytes, ensuring clean cold restarts.

---

## 6. Integrity Checks & Health Probes

### 6.1 Routine Health Diagnostics

| Command | Purpose | Expected Output |
| :--- | :--- | :--- |
| `PRAGMA integrity_check;` | Deep verification of B-trees, freelists, index sorting, and page allocation | `"ok"` |
| `PRAGMA foreign_key_check;` | Scans all tables for orphan foreign keys | Empty result set (0 rows) |
| `PRAGMA quick_check;` | Fast integrity check omitting index-data synchronization verification | `"ok"` |

### 6.2 Application Health Probe Integration

The `/ready` endpoint in `services/api/src/routes/v1/health.ts` evaluates database health on every probe request:
```typescript
const isDbHealthy = wardStateService.isDatabaseHealthy();
```
If `PRAGMA integrity_check;` fails or the database is closed, `/ready` automatically returns **HTTP 503 Service Unavailable**, taking the instance out of load-balancer rotation before corrupt data can be returned.

---

## 7. Production Seed Isolation & Guardrails

### 7.1 Policy Invariant

> **Strict Rule:** Demo patient profiles (`Eleanor Vance`, `Marcus Brody`), synthetic vital streams, and mock telemetry MUST NEVER be automatically seeded into a production clinical database.

### 7.2 Implementation Guardrail

In `packages/persistence/src/seeds/seed.ts`:
```typescript
export function isProductionSeedBlocked(): boolean {
  return process.env.NODE_ENV === 'production' && process.env.ALLOW_PRODUCTION_SEED !== 'true';
}
```
- When `NODE_ENV === 'production'`, `seedDatabase()` logs a warning and returns immediately without inserting any records.
- To seed a staging or demo environment that uses `NODE_ENV=production`, operators must explicitly supply `ALLOW_PRODUCTION_SEED=true`.
