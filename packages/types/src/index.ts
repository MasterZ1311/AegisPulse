/**
 * AegisPulse Shared Domain Contracts & Types
 * Defined strictly according to docs/PRODUCT_SPEC.md & docs/ARCHITECTURE_PRINCIPLES.md
 */

// ==========================================
// 1. Patient Master Record
// ==========================================
export interface Patient {
  id: string;
  name: string;
  age: number;
  gender: 'M' | 'F' | 'Other';
  bedNumber: string;
  admissionDiagnosis: string;
  admissionTimestamp: number;
  baselineMEWS: number;
  history?: string[];
  notes?: string[];
}

// ==========================================
// 2. Sensor Quality & Signal Integrity
// ==========================================
export type SensorQualityState = 'TRUSTED' | 'DEGRADED' | 'UNRELIABLE' | 'LOST';

export type ObservationSource = 'OPTICAL_RPPG' | 'NURSE_MANUAL' | 'BEDSIDE_DEVICE' | 'SIMULATION';

export interface PhysiologicalObservation {
  id: string;
  patientId: string;
  timestamp: number;
  source: ObservationSource;
  confidence: number; // 0.0 to 1.0 (Signal Quality Index)
  qualityState: SensorQualityState;
  heartRate?: number;
  respiratoryRate?: number;
  systolicBP?: number;
  diastolicBP?: number;
  temperature?: number;
  hrv?: number; // RMSSD in ms
  shockIndex?: number; // Derived HR / Systolic BP
  spo2?: number; // External pulse oximeter probe only (never from optical rPPG)
  avpu?: 'A' | 'V' | 'P' | 'U';
}

// ==========================================
// 3. Laboratory Biomarkers Panel
// ==========================================
export interface LabBiomarkerRecord {
  patientId: string;
  timestamp: number;
  lactate?: number; // mmol/L (Critical > 2.0)
  wbc?: number; // x10^9/L (Critical < 4.0 or > 12.0)
  creatinine?: number; // mg/dL
  platelets?: number; // x10^9/L
  crp?: number; // mg/L
}

// ==========================================
// 4. Trend & Physiological Velocity Vectors
// ==========================================
export type TrajectoryDirection = 'IMPROVING' | 'STABLE' | 'DECOMPENSATING' | 'RAPID_CRASH';
export type ShockIndexTrend = 'STABLE' | 'RISING' | 'FALLING';

export interface TrendVector {
  patientId: string;
  hrVelocity: number; // % change per hour (dHR/dt)
  rrVelocity: number; // % change per hour (dRR/dt)
  shockIndexCurrent: number; // HR / Systolic BP
  shockIndexTrend: ShockIndexTrend;
  mewsDelta: number; // Change in MEWS over last 2 hours
  trajectoryDirection: TrajectoryDirection;
}

// ==========================================
// 5. Attention Priority Assessment (Core Output)
// ==========================================
export type AttentionPriorityCategory = 'LOW' | 'WATCH' | 'EVALUATE' | 'CRITICAL_REVIEW';

export interface AttentionAssessment {
  patientId: string;
  bedNumber: string;
  apsScore: number; // 0 to 100 (Attention Priority Score)
  priorityCategory: AttentionPriorityCategory;
  wardRank: number; // 1 to Total Active Patients
  whyReasons: string[]; // Bullet points of exact physiological / operational drivers
  signalConfidence: number; // 0% to 100%
  informationAgeMinutes: number; // Minutes elapsed since last trusted observation
  recommendedAction: string; // Clinical action (e.g. SBAR escalation, 15s re-check)
  velocityScore: number; // Rate-of-change component (0 - 100)
  decayScore: number; // Information decay component (0 - 100)
  mewsComponent: number; // MEWS component (0 - 100)
  biomarkerComponent: number; // Lab biomarker component (0 - 100)
  timestamp: number;
}

// ==========================================
// 6. Clinical Handoff (SBAR)
// ==========================================
export interface SBARReport {
  patientId: string;
  bedNumber: string;
  patientName: string;
  situation: string;
  background: string;
  assessment: string;
  recommendation: string;
  generatedAt: number;
  apsScore: number;
  priorityCategory: AttentionPriorityCategory;
}

// ==========================================
// 7. System & API Health
// ==========================================
export interface HealthCheckResponse {
  status: 'ok' | 'degraded' | 'error';
  service: string;
  version: string;
  timestamp: string;
  uptimeSeconds: number;
  environment: string;
}
