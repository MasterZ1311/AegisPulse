-- ==============================================================================
-- AegisPulse Migration 002: Performance Indexes
-- Indexes for: patient, timestamp, ward, active attention state
-- ==============================================================================

-- 1. Patient Indexes (Fast patient-scoped history & lookups)
CREATE INDEX IF NOT EXISTS idx_observations_patient_ts
  ON observations (patient_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_labs_patient_ts
  ON labs (patient_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_timeline_patient_ts
  ON timeline_events (patient_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_attention_patient_active
  ON attention_states (patient_id, is_active);

CREATE INDEX IF NOT EXISTS idx_acknowledgements_patient
  ON acknowledgements (patient_id, acknowledged_at DESC);

CREATE INDEX IF NOT EXISTS idx_clinical_contexts_patient
  ON clinical_contexts (patient_id);

CREATE INDEX IF NOT EXISTS idx_clinical_actions_patient
  ON clinical_actions (patient_id, status);

-- 2. Timestamp Indexes (Chronological sorting & time window bisect queries)
CREATE INDEX IF NOT EXISTS idx_observations_ts
  ON observations (timestamp);

CREATE INDEX IF NOT EXISTS idx_timeline_ts
  ON timeline_events (timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_audit_events_ts
  ON audit_events (timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_attention_ts
  ON attention_states (timestamp DESC);

-- 3. Ward Indexes (Ward census & overview queries)
CREATE INDEX IF NOT EXISTS idx_beds_ward
  ON beds (ward_id);

CREATE INDEX IF NOT EXISTS idx_patients_ward
  ON patients (ward_id);

-- 4. Active Attention State Indexes (Ward deterioration radar fast sort)
CREATE INDEX IF NOT EXISTS idx_attention_active_score
  ON attention_states (is_active, score DESC);

CREATE INDEX IF NOT EXISTS idx_attention_patient_active_ts
  ON attention_states (patient_id, is_active, timestamp DESC);
