import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { PatientRecord, ClinicalAlert, SystemSettings, VitalsReading, LabBiomarkers } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'aegispulse_db.json');

interface DatabaseSchema {
  patients: PatientRecord[];
  vitalsHistory: { patientId: string; vitals: VitalsReading }[];
  alerts: ClinicalAlert[];
  settings: SystemSettings;
}

const DEFAULT_SETTINGS: SystemSettings = {
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  hospitalUnit: 'Ward 4B - Acute Triage Unit',
  audioAlerts: true,
  alertThresholdMews: 5,
};

const INITIAL_PATIENTS: PatientRecord[] = [
  {
    id: 'P001',
    name: 'Ananya Ramanathan',
    age: 42,
    gender: 'F',
    bedNumber: '401-A',
    admissionReason: 'Post-Op Day 1: Laparoscopic Cholecystectomy',
    history: ['Mild Hypertension', 'Asthma (Controlled)'],
    vitals: {
      heartRate: 74,
      respiratoryRate: 16,
      hrv: 48,
      spo2: 98,
      temperature: 36.8,
      systolicBP: 118,
      diastolicBP: 76,
      mewsScore: 0,
      qsofaScore: 0,
      triageLevel: 'green',
      signalQuality: 92,
      timestamp: Date.now(),
    },
    labs: {
      wbc: 7.4,
      creatinine: 0.9,
      lactate: 1.2,
      platelets: 240,
      crp: 4.1,
    },
    notes: ['Tolerating oral fluids', 'Minimal incisional pain', 'Alert and oriented x4'],
    status: 'active',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'P002',
    name: 'Rajesh Kannan',
    age: 58,
    gender: 'M',
    bedNumber: '401-B',
    admissionReason: 'Community-Acquired Lobar Pneumonia',
    history: ['Type 2 Diabetes', 'Smoker (15 pack-years)'],
    vitals: {
      heartRate: 88,
      respiratoryRate: 19,
      hrv: 34,
      spo2: 95,
      temperature: 37.8,
      systolicBP: 126,
      diastolicBP: 82,
      mewsScore: 1,
      qsofaScore: 0,
      triageLevel: 'green',
      signalQuality: 88,
      timestamp: Date.now(),
    },
    labs: {
      wbc: 11.8,
      creatinine: 1.1,
      lactate: 1.6,
      platelets: 190,
      crp: 28.0,
    },
    notes: ['Productive cough', 'Supplemental O2 2L nasal cannula'],
    status: 'active',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'P003',
    name: 'Meenakshi Sundaram',
    age: 67,
    gender: 'F',
    bedNumber: '402-A',
    admissionReason: 'Complicated UTI / Pyelonephritis (Sepsis Watch)',
    history: ['Chronic Kidney Disease Stage 2', 'Osteoarthritis'],
    vitals: {
      heartRate: 112,
      respiratoryRate: 23,
      hrv: 21,
      spo2: 93,
      temperature: 38.6,
      systolicBP: 96,
      diastolicBP: 60,
      mewsScore: 4,
      qsofaScore: 1,
      triageLevel: 'yellow',
      signalQuality: 84,
      timestamp: Date.now(),
    },
    labs: {
      wbc: 16.4,
      creatinine: 1.9,
      lactate: 2.4,
      platelets: 110,
      crp: 74.0,
    },
    notes: ['Flank tenderness', 'Chills and rigors reported'],
    status: 'active',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'P004',
    name: 'Vikram Murugan',
    age: 35,
    gender: 'M',
    bedNumber: '402-B',
    admissionReason: 'Acute Severe Pancreatitis',
    history: ['Hypertriglyceridemia'],
    vitals: {
      heartRate: 138,
      respiratoryRate: 28,
      hrv: 14,
      spo2: 89,
      temperature: 39.2,
      systolicBP: 82,
      diastolicBP: 52,
      mewsScore: 6,
      qsofaScore: 2,
      triageLevel: 'red',
      signalQuality: 90,
      timestamp: Date.now(),
    },
    labs: {
      wbc: 21.0,
      creatinine: 2.8,
      lactate: 4.1,
      platelets: 72,
      crp: 145.0,
    },
    notes: ['Severe epigastric pain', 'Oliguria noted', 'RRT consult triggered'],
    status: 'active',
    createdAt: new Date().toISOString(),
  },
];

class Database {
  private data: DatabaseSchema;

  constructor() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        this.data = JSON.parse(raw);
      } catch (err) {
        console.error('Error reading database file, reinitializing:', err);
        this.data = this.getDefaultSchema();
        this.save();
      }
    } else {
      this.data = this.getDefaultSchema();
      this.save();
    }
  }

  private getDefaultSchema(): DatabaseSchema {
    return {
      patients: INITIAL_PATIENTS,
      vitalsHistory: [],
      alerts: [
        {
          id: 'ALT-001',
          patientId: 'P004',
          bedNumber: '402-B',
          patientName: 'Vikram Murugan',
          level: 'red',
          title: 'CODE RED: Acute Hemodynamic Collapse (MEWS 6)',
          description: 'Sustained severe tachycardia (138 BPM) with hypotension (82/52 mmHg) and lactate 4.1 mmol/L.',
          timestamp: new Date().toISOString(),
          resolved: false,
        },
      ],
      settings: DEFAULT_SETTINGS,
    };
  }

  private save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to write database file:', err);
    }
  }

  // Patients CRUD
  public getPatients(): PatientRecord[] {
    return this.data.patients.filter((p) => p.status === 'active');
  }

  public getPatientById(id: string): PatientRecord | undefined {
    return this.data.patients.find((p) => p.id === id);
  }

  public addPatient(patientData: Omit<PatientRecord, 'id' | 'createdAt'>): PatientRecord {
    const id = `P${String(this.data.patients.length + 1).padStart(3, '0')}`;
    const newPatient: PatientRecord = {
      ...patientData,
      id,
      createdAt: new Date().toISOString(),
    };
    this.data.patients.push(newPatient);
    this.save();
    return newPatient;
  }

  public updatePatient(id: string, updates: Partial<PatientRecord>): PatientRecord | undefined {
    const idx = this.data.patients.findIndex((p) => p.id === id);
    if (idx === -1) return undefined;
    this.data.patients[idx] = { ...this.data.patients[idx], ...updates };
    this.save();
    return this.data.patients[idx];
  }

  public deletePatient(id: string): boolean {
    const idx = this.data.patients.findIndex((p) => p.id === id);
    if (idx === -1) return false;
    this.data.patients[idx].status = 'discharged';
    this.save();
    return true;
  }

  // Vitals Logging
  public logVitals(patientId: string, vitals: VitalsReading): void {
    const patient = this.getPatientById(patientId);
    if (!patient) return;

    patient.vitals = vitals;
    this.data.vitalsHistory.push({ patientId, vitals });

    // Keep history trimmed to last 2000 points
    if (this.data.vitalsHistory.length > 2000) {
      this.data.vitalsHistory.shift();
    }

    // Auto-generate alert if MEWS threshold breached
    if (vitals.mewsScore >= this.data.settings.alertThresholdMews && vitals.triageLevel === 'red') {
      const existingUnresolved = this.data.alerts.find(
        (a) => a.patientId === patientId && !a.resolved && a.level === 'red'
      );
      if (!existingUnresolved) {
        this.data.alerts.unshift({
          id: `ALT-${Date.now().toString().slice(-4)}`,
          patientId,
          bedNumber: patient.bedNumber,
          patientName: patient.name,
          level: 'red',
          title: `CODE RED: Bed ${patient.bedNumber} Decompensation (MEWS ${vitals.mewsScore})`,
          description: `Pulse: ${vitals.heartRate} BPM, SpO2: ${vitals.spo2}%, RR: ${vitals.respiratoryRate}/min, BP: ${vitals.systolicBP}/${vitals.diastolicBP} mmHg.`,
          timestamp: new Date().toISOString(),
          resolved: false,
        });
      }
    }

    this.save();
  }

  public getVitalsHistory(patientId: string, limit = 50): VitalsReading[] {
    return this.data.vitalsHistory
      .filter((h) => h.patientId === patientId)
      .slice(-limit)
      .map((h) => h.vitals);
  }

  // Labs
  public updateLabs(patientId: string, labs: Partial<LabBiomarkers>): LabBiomarkers | undefined {
    const patient = this.getPatientById(patientId);
    if (!patient) return undefined;
    patient.labs = { ...patient.labs, ...labs };
    this.save();
    return patient.labs;
  }

  // Alerts
  public getAlerts(): ClinicalAlert[] {
    return this.data.alerts;
  }

  public resolveAlert(alertId: string): boolean {
    const alert = this.data.alerts.find((a) => a.id === alertId);
    if (!alert) return false;
    alert.resolved = true;
    this.save();
    return true;
  }

  // Settings
  public getSettings(): SystemSettings {
    return this.data.settings;
  }

  public updateSettings(newSettings: Partial<SystemSettings>): SystemSettings {
    this.data.settings = { ...this.data.settings, ...newSettings };
    this.save();
    return this.data.settings;
  }
}

export const db = new Database();
