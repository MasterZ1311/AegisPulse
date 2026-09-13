import type { PatientRecord, VitalsReading, LabBiomarkers, ClinicalAlert, SystemSettings } from './types';

const API_BASE = 'http://localhost:5000/api';

export const api = {
  // Patients
  async getPatients(): Promise<PatientRecord[]> {
    try {
      const res = await fetch(`${API_BASE}/patients`);
      if (!res.ok) throw new Error('Failed to fetch patients');
      const json = await res.json();
      return json.data;
    } catch (e) {
      console.warn('[API] Backend unreachable, using fallback patient store:', e);
      return [];
    }
  },

  async addPatient(patientData: Partial<PatientRecord>): Promise<PatientRecord | null> {
    try {
      const res = await fetch(`${API_BASE}/patients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patientData),
      });
      const json = await res.json();
      return json.data;
    } catch (e) {
      console.error('[API] Error adding patient:', e);
      return null;
    }
  },

  async dischargePatient(id: string): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/patients/${id}`, { method: 'DELETE' });
      return res.ok;
    } catch (e) {
      console.error('[API] Error discharging patient:', e);
      return false;
    }
  },

  // Vitals
  async logVitals(patientId: string, vitals: VitalsReading): Promise<void> {
    try {
      await fetch(`${API_BASE}/vitals/${patientId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vitals),
      });
    } catch (e) {
      // ignore offline errors
    }
  },

  async getVitalsHistory(patientId: string): Promise<VitalsReading[]> {
    try {
      const res = await fetch(`${API_BASE}/vitals/${patientId}/history`);
      const json = await res.json();
      return json.data || [];
    } catch (e) {
      return [];
    }
  },

  // Labs
  async updateLabs(patientId: string, labs: Partial<LabBiomarkers>): Promise<LabBiomarkers | null> {
    try {
      const res = await fetch(`${API_BASE}/labs/${patientId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(labs),
      });
      const json = await res.json();
      return json.data;
    } catch (e) {
      console.error('[API] Error updating labs:', e);
      return null;
    }
  },

  // Alerts
  async getAlerts(): Promise<ClinicalAlert[]> {
    try {
      const res = await fetch(`${API_BASE}/alerts`);
      const json = await res.json();
      return json.data || [];
    } catch (e) {
      return [];
    }
  },

  async resolveAlert(id: string): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/alerts/${id}/resolve`, { method: 'POST' });
      return res.ok;
    } catch (e) {
      return false;
    }
  },

  // Copilot Analysis
  async analyzeCopilot(patientId: string, vitals?: VitalsReading, labs?: LabBiomarkers): Promise<{ source: string; analysis: string }> {
    try {
      const res = await fetch(`${API_BASE}/copilot/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, vitals, labs }),
      });
      const json = await res.json();
      return { source: json.source, analysis: json.analysis };
    } catch (e) {
      console.error('[API] Error calling Copilot:', e);
      return {
        source: 'local-emergency-heuristics',
        analysis: 'Unable to reach backend Copilot server. Please ensure port 5000 is online.',
      };
    }
  },

  // Settings
  async getSettings(): Promise<SystemSettings & { hasApiKey: boolean; maskedApiKey: string }> {
    try {
      const res = await fetch(`${API_BASE}/settings`);
      const json = await res.json();
      return json.data;
    } catch (e) {
      return {
        geminiApiKey: '',
        hospitalUnit: 'Ward 4B - Acute Triage Unit',
        audioAlerts: true,
        alertThresholdMews: 5,
        hasApiKey: false,
        maskedApiKey: '',
      };
    }
  },

  async updateSettings(settings: Partial<SystemSettings>): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      return res.ok;
    } catch (e) {
      console.error('[API] Error updating settings:', e);
      return false;
    }
  },
};
