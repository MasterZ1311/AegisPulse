-- ==============================================================================
-- AegisPulse Migration 003: Database Constraints, Integrity Triggers & Idempotency
-- Strict enforcement of physiological ranges, deduplication, and replay prevention.
-- ==============================================================================

-- 1. Persistent Idempotency Ledger (Cross-Restart Edge Sync Protection)
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
