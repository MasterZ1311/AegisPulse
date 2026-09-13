export type TriageLevel = 'green' | 'yellow' | 'red';

export type SimulationMode = 'live_webcam' | 'normal_sinus' | 'acute_tachycardia' | 'sepsis_decompensation';

export interface VitalsReading {
  heartRate: number;            // Beats per minute
  respiratoryRate: number;      // Breaths per minute
  hrv: number;                  // RMSSD in ms
  spo2: number;                 // Blood oxygen %
  temperature: number;          // Celsius
  systolicBP: number;           // mmHg
  diastolicBP: number;          // mmHg
  mewsScore: number;            // 0 - 14
  qsofaScore: number;           // 0 - 3
  triageLevel: TriageLevel;
  signalQuality: number;        // 0 - 100%
  timestamp: number;
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
