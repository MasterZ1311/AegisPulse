import type {
  AttentionPriorityCategory,
  UnifiedTimelineEvent,
  LaboratoryResult,
  ClinicalContext,
} from '@aegispulse/types';

export interface VitalsTrajectoryPoint {
  timeOffsetMinutes: number; // e.g. -60, -45, -30, -15, 0 (now)
  timestampIso: string;
  apsScore: number;
  heartRate: number;
  respiratoryRate: number;
  spo2: number;
  systolicBP: number;
  diastolicBP: number;
}

export interface ContributingReasonItem {
  id: string;
  category: 'PHYSIOLOGICAL_ABNORMALITY' | 'VELOCITY' | 'BASELINE_DEVIATION' | 'PERSISTENCE' | 'SIGNAL_CONFIDENCE' | 'CLINICAL_CONTEXT' | 'MISSING_DATA';
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  title: string;
  explanation: string;
  contributionPercent: number;
  evidence: {
    variable: string;
    currentValue: string | number;
    baselineValue?: string | number;
    delta?: string | number;
    durationMinutes?: number;
  };
  provenance: {
    sourceObservationIds: string[];
    calculationRule: string;
    rawScore: number;
    normalizedWeight: number;
  };
}

export interface MewsBreakdownItem {
  parameter: 'Heart Rate' | 'Respiratory Rate' | 'Systolic BP' | 'Temperature' | 'AVPU / Mentation';
  value: string;
  points: number;
  normalRange: string;
}

export interface QsofaBreakdownItem {
  criterion: 'Respiratory Rate ≥ 22 /min' | 'Altered Mentation (GCS < 15)' | 'Systolic BP ≤ 100 mmHg';
  isMet: boolean;
  value: string;
  points: number;
}

export interface VerificationCheckItem {
  id: string;
  text: string;
  rationale: string;
  completed: boolean;
  completedAt?: string;
  completedBy?: string;
}

export interface SignalTelemetryItem {
  confidencePercent: number;
  snrDb: number;
  motionMagnitude: number; // 0.0 to 1.0
  motionDetected: boolean;
  illuminationLux: number;
  opticalLineOfSight: boolean;
  cameraDeviceId: string;
  lastFrameProcessedIso: string;
  privacyNotice: string;
}

export interface WardPatientRadarState {
  patientId: string;
  bedNumber: string;
  roomNumber: string;
  mrn: string;
  name: string;
  age: number;
  gender: 'MALE' | 'FEMALE';
  admissionDiagnosis: string;
  admissionDate: string;
  attendingPhysician: string;
  primaryNurse: string;
  codeStatus: 'FULL_CODE' | 'DNR' | 'DNI';
  allergies: string[];
  isolationStatus: 'NONE' | 'DROPLET' | 'CONTACT' | 'AIRBORNE';

  // Attention Priority Score
  apsScore: number;
  category: AttentionPriorityCategory;
  categoryRank: number; // 1 = highest priority
  trendDirection: 'RAPIDLY_RISING' | 'RISING' | 'STEADY' | 'RECOVERING';
  trendVelocityPointsPerHour: number;

  // "Why Now?" Hero Explanation
  whyNowSummary: string;
  topContributingReasons: ContributingReasonItem[];

  // Clinical Rule Scores
  mews: {
    totalScore: number;
    thresholdRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    breakdown: MewsBreakdownItem[];
  };
  qsofa?: {
    totalScore: number;
    criteriaMet: number;
    sepsisRiskIndicated: boolean;
    breakdown: QsofaBreakdownItem[];
  };

  // Current Vitals & Baselines
  vitals: {
    heartRate: number;
    heartRateBaseline: number;
    respiratoryRate: number;
    respiratoryRateBaseline: number;
    spo2: number;
    spo2Baseline: number;
    systolicBP: number;
    systolicBPBaseline: number;
    diastolicBP: number;
    meanArterialPressure: number;
    bodyTemperature: number;
    shockIndex: number;
    avpu: 'ALERT' | 'VOICE' | 'PAIN' | 'UNRESPONSIVE';
    oxygenDelivery: string;
  };

  // Trajectory History for Sparklines & Charts
  trajectory: VitalsTrajectoryPoint[];

  // Non-Invasive Optical Signal
  signalQuality: SignalTelemetryItem;

  // Timestamps & Freshness
  lastTrustedObservationIso: string;
  lastTrustedElapsedMinutes: number;
  isStale: boolean;

  // Context & Labs
  clinicalContext: ClinicalContext;
  labs: LaboratoryResult[];

  // Action & Verification
  recommendedVerifications: VerificationCheckItem[];
  timeline: UnifiedTimelineEvent[];
  lastAcknowledgedAt?: string;
  lastAcknowledgedBy?: string;
  isAcknowledged: boolean;
}
