import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { RPPGEngine } from './lib/rppgEngine';
import type { PatientRecord, VitalsReading, LabBiomarkers, SimulationMode } from './lib/types';
import { api } from './lib/api';
import { WaveformOscilloscope } from './components/WaveformOscilloscope';
import { WebcamBiometricScanner } from './components/WebcamBiometricScanner';
import { TriageStatusBanner } from './components/TriageStatusBanner';
import { WardOverviewTab } from './components/WardOverviewTab';
import { LabDiagnosticsTab } from './components/LabDiagnosticsTab';
import { CopilotTab } from './components/CopilotTab';
import { SettingsTab } from './components/SettingsTab';
import { AdmitPatientModal } from './components/AdmitPatientModal';
import { AIClinicalCopilot } from './components/AIClinicalCopilot';
import {
  HeartPulse,
  Activity,
  Building2,
  TestTube,
  Bot,
  Settings,
  UserPlus,
  Clock,
  Wifi,
  WifiOff,
  UserCheck
} from 'lucide-react';

const FALLBACK_PATIENTS: PatientRecord[] = [
  {
    id: 'P001',
    name: 'Ananya Ramanathan',
    age: 42,
    gender: 'F',
    bedNumber: '401-A',
    admissionReason: 'Post-Op Day 1: Laparoscopic Cholecystectomy',
    history: ['Mild Hypertension', 'No known allergies', 'Asthma (Controlled)'],
    vitals: {
      heartRate: 74,
      respiratoryRate: 16,
      hrv: 48,
      shockIndex: 0.63,
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
      shockIndex: 0.70,
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
    notes: ['Productive cough', 'On supplemental O2 2L nasal cannula'],
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
      shockIndex: 1.17,
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
    notes: ['Flank tenderness', 'Chills and rigors reported at 14:00'],
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
      shockIndex: 1.68,
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
  },
];

type ActiveTab = 'scanner' | 'ward' | 'labs' | 'copilot' | 'settings';

export const App: React.FC = () => {
  const engine = useMemo(() => new RPPGEngine(), []);
  const [activeTab, setActiveTab] = useState<ActiveTab>('scanner');
  const [patients, setPatients] = useState<PatientRecord[]>(FALLBACK_PATIENTS);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('P001');
  const [currentVitals, setCurrentVitals] = useState<VitalsReading>(FALLBACK_PATIENTS[0].vitals);
  const [isCopilotModalOpen, setIsCopilotModalOpen] = useState<boolean>(false);
  const [isAdmitModalOpen, setIsAdmitModalOpen] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(false);

  // Load patients from persistent backend
  const fetchPatientsFromBackend = useCallback(async () => {
    try {
      const data = await api.getPatients();
      if (Array.isArray(data) && data.length > 0) {
        setPatients(data);
        setIsBackendConnected(true);
      }
    } catch (err) {
      console.warn('Backend currently offline or unreachable, using local memory state.', err);
      setIsBackendConnected(false);
    }
  }, []);

  useEffect(() => {
    fetchPatientsFromBackend();
  }, [fetchPatientsFromBackend]);

  // Clock ticker
  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, []);

  // Poll vitals from rPPG engine every 250ms
  useEffect(() => {
    const interval = setInterval(() => {
      const reading = engine.getVitalsReading();
      setCurrentVitals(reading);

      setPatients((prev) =>
        prev.map((p) => (p.id === selectedPatientId ? { ...p, vitals: reading } : p))
      );
    }, 250);

    return () => clearInterval(interval);
  }, [engine, selectedPatientId]);

  // Periodically persist vitals to backend every 4 seconds
  useEffect(() => {
    const syncInterval = setInterval(() => {
      if (selectedPatientId && currentVitals) {
        api.logVitals(selectedPatientId, currentVitals).catch(() => {});
      }
    }, 4000);

    return () => clearInterval(syncInterval);
  }, [selectedPatientId, currentVitals]);

  const currentPatient = useMemo(
    () => patients.find((p) => p.id === selectedPatientId) || patients[0] || FALLBACK_PATIENTS[0],
    [patients, selectedPatientId]
  );

  const handleSelectPatient = (id: string) => {
    setSelectedPatientId(id);
    const target = patients.find((p) => p.id === id);
    if (target) {
      engine.updateManualVitals({
        heartRate: target.vitals.heartRate,
        systolicBP: target.vitals.systolicBP,
        diastolicBP: target.vitals.diastolicBP,
        respiratoryRate: target.vitals.respiratoryRate,
        temperature: target.vitals.temperature,
        spo2: target.vitals.spo2,
      });
      setCurrentVitals(target.vitals);
    }
  };

  const handleUpdateLabs = async (updatedLabs: Partial<LabBiomarkers>) => {
    setPatients((prev) =>
      prev.map((p) => (p.id === selectedPatientId ? { ...p, labs: { ...p.labs, ...updatedLabs } } : p))
    );

    try {
      await api.updateLabs(selectedPatientId, updatedLabs);
    } catch (err) {
      console.warn('Could not save labs to backend:', err);
    }
  };

  const handlePatientAdmitted = (newPatient: PatientRecord) => {
    setPatients((prev) => [newPatient, ...prev]);
    setSelectedPatientId(newPatient.id);
    setActiveTab('ward');
  };

  const handleDischargePatient = async (id: string) => {
    if (!confirm('Confirm clinical discharge of this patient?')) return;
    try {
      await api.dischargePatient(id);
      setPatients((prev) => prev.filter((p) => p.id !== id));
      if (selectedPatientId === id && patients.length > 1) {
        setSelectedPatientId(patients.find((p) => p.id !== id)?.id || 'P001');
      }
    } catch (err) {
      console.error('Failed to discharge patient:', err);
      setPatients((prev) => prev.filter((p) => p.id !== id));
    }
  };

  const handleModeChange = (_mode: SimulationMode) => {
    // Mode is updated in engine and synchronized via interval
  };

  return (
    <div className="min-h-screen bg-[#060a12] text-slate-100 font-sans antialiased selection:bg-cyan-500 selection:text-black flex flex-col">
      {/* Top Clinical Workstation Header */}
      <header className="border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-xl sticky top-0 z-40 px-4 lg:px-8 py-3">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          {/* Logo & Platform Name */}
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-teal-400 to-emerald-400 p-0.5 shadow-lg shadow-cyan-500/20 flex-shrink-0">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center text-cyan-400">
                <HeartPulse className="w-6 h-6 animate-pulse" />
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-black tracking-tight text-white flex items-center space-x-1.5">
                  <span>AEGIS</span>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400">
                    PULSE AI
                  </span>
                </h1>
                <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">
                  Ward 4B Command
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Contactless rPPG Bio-Sensing & Multi-Modal Clinical Triage System
              </p>
            </div>
          </div>

          {/* Center: Global Active Patient Selector */}
          <div className="flex items-center space-x-2 bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-xl">
            <UserCheck className="w-4 h-4 text-cyan-400 flex-shrink-0" />
            <span className="text-xs text-slate-400 hidden sm:inline">Active Bed:</span>
            <select
              value={selectedPatientId}
              onChange={(e) => handleSelectPatient(e.target.value)}
              className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer"
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                  Bed {p.bedNumber} — {p.name} ({p.vitals.triageLevel.toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          {/* Right Action Bar */}
          <div className="flex items-center space-x-2 text-xs">
            {/* Backend Connectivity Status Indicator */}
            <div
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-mono ${
                isBackendConnected
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
              }`}
            >
              {isBackendConnected ? (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">DB Online</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Local Memory</span>
                </>
              )}
            </div>

            {/* Live Clock */}
            <div className="hidden lg:flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 font-mono text-[11px]">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>{currentTime}</span>
            </div>

            {/* Quick Admit Button */}
            <button
              onClick={() => setIsAdmitModalOpen(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700 transition-all cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5 text-cyan-400" />
              <span>Admit Patient</span>
            </button>

            {/* Quick Copilot Modal Trigger */}
            <button
              onClick={() => setIsCopilotModalOpen(true)}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-400 hover:from-cyan-400 hover:to-teal-300 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
            >
              <Bot className="w-4 h-4" />
              <span>SBAR Alert</span>
            </button>
          </div>
        </div>

        {/* Primary 5-Tab Navigation Bar */}
        <div className="max-w-7xl mx-auto mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between overflow-x-auto gap-2">
          <div className="flex items-center space-x-1 sm:space-x-2">
            <button
              onClick={() => setActiveTab('scanner')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'scanner'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-lg shadow-cyan-500/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>Live Bio-Scanner</span>
            </button>

            <button
              onClick={() => setActiveTab('ward')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'ward'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-lg shadow-cyan-500/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Ward 4B Bed Matrix</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 font-mono">
                {patients.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('labs')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'labs'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-lg shadow-cyan-500/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <TestTube className="w-4 h-4" />
              <span>Pathology & Labs</span>
            </button>

            <button
              onClick={() => setActiveTab('copilot')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'copilot'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-lg shadow-cyan-500/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Bot className="w-4 h-4" />
              <span>Clinical Copilot</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'settings'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-lg shadow-cyan-500/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>System Settings</span>
            </button>
          </div>

          <div className="hidden md:flex items-center space-x-2 text-[11px] font-mono text-slate-400">
            <span>Triage:</span>
            <span
              className={`px-2 py-0.5 rounded font-bold uppercase ${
                currentVitals.triageLevel === 'red'
                  ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                  : currentVitals.triageLevel === 'yellow'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
              }`}
            >
              Code {currentVitals.triageLevel}
            </span>
          </div>
        </div>
      </header>

      {/* Main Workspace Body */}
      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-6 space-y-6 flex-1 w-full">
        {/* Persistent Triage Alert Banner */}
        <TriageStatusBanner vitals={currentVitals} onOpenCopilot={() => setActiveTab('copilot')} />

        {/* TAB 1: LIVE BIO-SCANNER */}
        {activeTab === 'scanner' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left: Non-Contact Facial rPPG Camera Scanner */}
              <div className="lg:col-span-5">
                <WebcamBiometricScanner
                  engine={engine}
                  triageLevel={currentVitals.triageLevel}
                  signalQuality={currentVitals.signalQuality}
                  onModeChange={handleModeChange}
                />
              </div>

              {/* Right: Live Arterial Waveform Oscilloscope & Active Patient Card */}
              <div className="lg:col-span-7 space-y-4">
                <WaveformOscilloscope
                  engine={engine}
                  triageLevel={currentVitals.triageLevel}
                  heartRate={currentVitals.heartRate}
                />

                {/* Active Bed Profile Dossier */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur-xl">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                    <div className="flex items-center space-x-2.5">
                      <span className="text-xs font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 px-2.5 py-0.5 rounded-md">
                        BED {currentPatient.bedNumber}
                      </span>
                      <span className="font-bold text-white text-base">{currentPatient.name}</span>
                      <span className="text-xs text-slate-400">
                        ({currentPatient.age}y {currentPatient.gender})
                      </span>
                    </div>
                    <span className="text-xs text-slate-400 font-mono">Record: {currentPatient.id}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-slate-400 font-semibold block mb-1">Clinical Admission Reason:</span>
                      <p className="text-slate-200 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80 leading-relaxed">
                        {currentPatient.admissionReason}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold block mb-1">Medical Background:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {currentPatient.history.map((h, i) => (
                          <span
                            key={i}
                            className="px-2.5 py-1 bg-slate-800/90 text-slate-300 rounded-lg text-[11px] border border-slate-700"
                          >
                            {h}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-slate-400">
                    <span>
                      <strong className="text-slate-300">Observation:</strong>{' '}
                      {currentPatient.notes && currentPatient.notes[0] ? currentPatient.notes[0] : 'Vital signs steady.'}
                    </span>
                    <button
                      onClick={() => setActiveTab('copilot')}
                      className="text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer underline flex items-center space-x-1"
                    >
                      <span>Analyze with Copilot →</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: WARD 4B BED MATRIX */}
        {activeTab === 'ward' && (
          <WardOverviewTab
            patients={patients}
            selectedPatientId={selectedPatientId}
            onSelectPatient={(id: string) => {
              handleSelectPatient(id);
              setActiveTab('scanner');
            }}
            onAdmitClick={() => setIsAdmitModalOpen(true)}
            onDischargePatient={handleDischargePatient}
          />
        )}

        {/* TAB 3: PATHOLOGY & LABS */}
        {activeTab === 'labs' && (
          <LabDiagnosticsTab
            patient={currentPatient}
            onUpdateLabs={handleUpdateLabs}
          />
        )}

        {/* TAB 4: CLINICAL COPILOT */}
        {activeTab === 'copilot' && (
          <CopilotTab
            patient={currentPatient}
            vitals={currentVitals}
            labs={currentPatient.labs}
          />
        )}

        {/* TAB 5: SYSTEM SETTINGS */}
        {activeTab === 'settings' && <SettingsTab />}
      </main>

      {/* Persistent Academic & Hackathon Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950/60 py-4 px-4 lg:px-8 text-xs text-slate-500 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            AegisPulse AI · VMedithon 3.0 Hackathon Track · School of Computer Science & Engineering, VIT Chennai
          </span>
          <div className="flex items-center space-x-3 font-mono text-[11px]">
            <a
              href="https://github.com/CodeSorcerer-007"
              target="_blank"
              rel="noreferrer"
              className="text-slate-400 hover:text-cyan-400 transition-colors font-semibold"
            >
              Architect: Thenappan T (MasterZ)
            </a>
            <span>·</span>
            <span className="text-emerald-400">100% Zero-Hardware Optical rPPG</span>
          </div>
        </div>
      </footer>

      {/* Admit Patient Modal */}
      <AdmitPatientModal
        isOpen={isAdmitModalOpen}
        onClose={() => setIsAdmitModalOpen(false)}
        onPatientAdmitted={handlePatientAdmitted}
      />

      {/* SBAR Quick Alert Modal */}
      <AIClinicalCopilot
        isOpen={isCopilotModalOpen}
        onClose={() => setIsCopilotModalOpen(false)}
        patient={currentPatient}
        vitals={currentVitals}
        labs={currentPatient.labs}
      />
    </div>
  );
};

export default App;
