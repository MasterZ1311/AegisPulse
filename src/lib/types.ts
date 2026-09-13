export type TriageLevel = 'green' | 'yellow' | 'red';

export type SimulationMode = 'live_webcam' | 'normal_sinus' | 'acute_tachycardia' | 'sepsis_decompensation';

export type AttentionPriorityCategory = 'LOW' | 'WATCH' | 'EVALUATE' | 'CRITICAL_REVIEW';

export interface AttentionAssessment {
  score: number;                  // Attention Priority Score (0 - 100)
  rank: number;                   // #1 to #N
  category: AttentionPriorityCategory;
  whyReasons: string[];           // Plain-English bulleted reasons
  recommendedAction: string;      // Human verification action (e.g. SBAR escalation)
  velocityScore: number;          // Rate-of-change component (0 - 100)
  decayScore: number;             // Information decay component (0 - 100)
  mewsComponent: number;          // MEWS component (0 - 100)
  biomarkerComponent: number;     // Lab biomarker component (0 - 100)
}

export interface VitalsReading {
  heartRate: number;              // Beats per minute (rPPG or manual)
  respiratoryRate: number;        // Breaths per minute (rPPG or manual)
  hrv: number;                    // RMSSD in ms
  temperature: number;            // Celsius (Clinical thermometer)
  systolicBP: number;             // mmHg (NIBP cuff / manual dial)
  diastolicBP: number;            // mmHg (NIBP cuff / manual dial)
  shockIndex: number;             // Heart Rate / Systolic BP (normal 0.5 - 0.7)
  mewsScore: number;              // 0 - 14
  qsofaScore: number;             // 0 - 3
  triageLevel: TriageLevel;
  signalQuality: number;          // 0 - 100% (Signal Quality Index)
  timestamp: number;
  spo2?: number;                  // External pulse oximeter probe only (never from webcam)
  attentionAssessment?: AttentionAssessment;
}

export interface LabBiomarkers {
  wbc: number;                  // x10^9 / L (Normal: 4.0 - 11.0)
  creatinine: number;           // mg/dL (Normal: 0.7 - 1.3)
  lactate: number;              // mmol/L (Normal: 0.5 - 2.0; Sepsis > 2.0)
  platelets: number;            // x10^9 / L (Normal: 150 - 450)
  crp: number;                  // C-reactive protein mg/L (< 5)
}

export interface PatientRecord {
  id: string;
  name: string;
  age: number;
  gender: 'M' | 'F' | 'Other';
  bedNumber: string;
  admissionReason: string;
  history: string[];
  vitals: VitalsReading;
  labs: LabBiomarkers;
  notes: string[];
  status?: 'active' | 'discharged' | 'icu_transferred';
  createdAt?: string;
}

export interface ClinicalAlert {
  id: string;
  patientId: string;
  bedNumber: string;
  patientName: string;
  level: TriageLevel;
  title: string;
  description: string;
  timestamp: string;
  resolved: boolean;
}

export interface SystemSettings {
  geminiApiKey: string;
  hospitalUnit: string;
  audioAlerts: boolean;
  alertThresholdMews: number;
}
