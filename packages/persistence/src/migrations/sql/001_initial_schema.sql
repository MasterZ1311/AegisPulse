-- ==============================================================================
-- AegisPulse Migration 001: Initial Relational Schema
-- Standard ANSI SQL / SQLite Schema with Strict Relational Integrity
-- NOTE: Raw camera frames are NEVER persisted.
-- ==============================================================================

-- 1. Schema Migrations Registry
CREATE TABLE IF NOT EXISTS _schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at INTEGER NOT NULL
);

-- 2. Wards
CREATE TABLE IF NOT EXISTS wards (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  department TEXT NOT NULL,
  total_beds INTEGER NOT NULL,
  nurse_ratio TEXT NOT NULL,
  active_nurses_count INTEGER NOT NULL DEFAULT 0,
  hospital_name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 3. Beds
CREATE TABLE IF NOT EXISTS beds (
  id TEXT PRIMARY KEY,
  bed_number TEXT NOT NULL,
  ward_id TEXT NOT NULL REFERENCES wards(id) ON DELETE CASCADE,
  room_number TEXT NOT NULL,
  status TEXT NOT NULL,
  current_patient_id TEXT,
  camera_device_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 4. Patients
CREATE TABLE IF NOT EXISTS patients (
  id TEXT PRIMARY KEY,
  mrn TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  age INTEGER NOT NULL,
  gender TEXT NOT NULL,
  ward_id TEXT NOT NULL REFERENCES wards(id) ON DELETE CASCADE,
  bed_id TEXT NOT NULL REFERENCES beds(id) ON DELETE CASCADE,
  bed_number TEXT NOT NULL,
  admission_diagnosis TEXT NOT NULL,
  admission_timestamp INTEGER NOT NULL,
  attending_physician TEXT NOT NULL,
  primary_nurse TEXT NOT NULL,
  code_status TEXT NOT NULL,
  baseline_mews INTEGER NOT NULL DEFAULT 0,
  allergies TEXT NOT NULL DEFAULT '[]',
  isolation_status TEXT NOT NULL DEFAULT 'NONE',
  is_active INTEGER NOT NULL DEFAULT 1,
  history TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 5. Clinical Contexts
CREATE TABLE IF NOT EXISTS clinical_contexts (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL UNIQUE REFERENCES patients(id) ON DELETE CASCADE,
  admission_reason TEXT NOT NULL,
  post_op_day INTEGER,
  comorbidities TEXT NOT NULL DEFAULT '[]',
  code_status TEXT NOT NULL DEFAULT 'FULL_CODE',
  oxygen_delivery TEXT NOT NULL DEFAULT 'ROOM_AIR',
  o2_flow_rate_lpm REAL,
  isolation_status TEXT NOT NULL DEFAULT 'NONE',
  baseline_mews INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

-- 6. Physiological Observations (Continuous rPPG & Contact Vitals)
-- Note: Raw frames are discarded at signal edge. Only vitals & confidence persisted.
CREATE TABLE IF NOT EXISTS observations (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  timestamp INTEGER NOT NULL,
  source TEXT NOT NULL,
  confidence REAL NOT NULL,
  quality_state TEXT NOT NULL,
  heart_rate REAL,
  respiratory_rate REAL,
  systolic_bp REAL,
  diastolic_bp REAL,
  spo2 REAL,
  temperature REAL,
  signal_snr REAL,
  provenance TEXT,
  created_at INTEGER NOT NULL
);

-- 7. Laboratory Results
CREATE TABLE IF NOT EXISTS labs (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  test_type TEXT NOT NULL,
  value REAL NOT NULL,
  unit TEXT NOT NULL,
  reference_range_low REAL,
  reference_range_high REAL,
  status TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  ordered_by TEXT,
  panel TEXT,
  created_at INTEGER NOT NULL
);

-- 8. Unified Patient Timeline Events
CREATE TABLE IF NOT EXISTS timeline_events (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  timestamp INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL,
  source TEXT NOT NULL,
  is_trusted INTEGER NOT NULL DEFAULT 1,
  data TEXT,
  provenance TEXT,
  created_at INTEGER NOT NULL
);

-- 9. Central Attention Priority States
CREATE TABLE IF NOT EXISTS attention_states (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  timestamp INTEGER NOT NULL,
  score REAL NOT NULL,
  category TEXT NOT NULL,
  top_reason TEXT NOT NULL,
  reasons TEXT NOT NULL,
  rank_inputs TEXT NOT NULL,
  recommended_actions TEXT NOT NULL,
  confidence REAL NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

-- 10. Clinician Alert Acknowledgements
CREATE TABLE IF NOT EXISTS acknowledgements (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  alert_id TEXT,
  acknowledged_by_user_id TEXT NOT NULL,
  acknowledged_at INTEGER NOT NULL,
  reason TEXT,
  created_at INTEGER NOT NULL
);

-- 11. Clinical Actions & Bedside Tasks
CREATE TABLE IF NOT EXISTS clinical_actions (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  bed_id TEXT NOT NULL REFERENCES beds(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  title TEXT NOT NULL,
  rationale TEXT NOT NULL,
  status TEXT NOT NULL,
  urgency TEXT NOT NULL,
  recommended_at INTEGER NOT NULL,
  target_completion_timestamp INTEGER,
  completed_at INTEGER,
  completed_by_user_id TEXT,
  outcome_notes TEXT,
  created_at INTEGER NOT NULL
);

-- 12. Clinician & Administrative Users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL,
  department TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

-- 13. Audit Events (HIPAA & Security Compliance)
CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  timestamp INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  details TEXT,
  ip_address TEXT,
  request_id TEXT,
  created_at INTEGER NOT NULL
);
