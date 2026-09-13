export type TriageLevel = 'green' | 'yellow' | 'red';

export interface VitalsReading {
  heartRate: number;
  respiratoryRate: number;
  hrv: number;
  spo2: number;
  temperature: number;
  systolicBP: number;
  diastolicBP: number;
  mewsScore: number;
  qsofaScore: number;
  triageLevel: TriageLevel;
  signalQuality: number;
  timestamp: number;
}

export interface LabBiomarkers {
  wbc: number;
  creatinine: number;
  lactate: number;
  platelets: number;
  crp: number;
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
  status: 'active' | 'discharged' | 'icu_transferred';
  createdAt: string;
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
