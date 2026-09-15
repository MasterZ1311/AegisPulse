import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  User,
  Check,
  CheckCircle2,
  HeartPulse,
  Wind,
  Droplets,
  Activity,
  Camera,
  FileText,
  Search,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import type { WardPatientRadarState } from '../../types/radar';
import { Button } from '@/components/ui/button';
import { PatientDetailPanel } from '../PatientDetailPanel';

interface PatientWorkstationPageProps {
  patients: WardPatientRadarState[];
  selectedPatient: WardPatientRadarState | null;
  onSelectPatient: (patient: WardPatientRadarState) => void;
  onBackToRadar: () => void;
  onAcknowledge: (patientId: string, event?: React.MouseEvent) => void;
  onLogAssessment: (patientId: string, note: string) => void;
  onEscalate: (patientId: string) => void;
  onSpotCheckComplete?: (
    patientId: string,
    vitals: { heartRate: number; respiratoryRate: number; confidence: number }
  ) => void;
  onOpenCamera?: () => void;
}

export const PatientWorkstationPage: React.FC<PatientWorkstationPageProps> = ({
  patients,
  selectedPatient,
  onSelectPatient,
  onBackToRadar,
  onAcknowledge,
  onLogAssessment,
  onEscalate,
  onSpotCheckComplete,
  onOpenCamera,
}) => {
  const [rosterSearch, setRosterSearch] = useState('');
  const [showFullDossier, setShowFullDossier] = useState(false);

  if (!selectedPatient) {
    return (
      <div className="bg-white rounded-3xl p-12 text-center max-w-xl mx-auto my-12 border border-slate-200/60 shadow-lg">
        <User className="h-12 w-12 text-slate-400 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-900">No Patient Selected</h2>
        <p className="text-xs text-slate-500 mt-1 mb-4">
          Please select a bed from the Ward Radar to review patient telemetry.
        </p>
        <Button onClick={onBackToRadar} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
          <ArrowLeft className="h-4 w-4" />
          <span>Go to Ward Radar</span>
        </Button>
      </div>
    );
  }

  // Filtered patients for left triage roster
  const filteredRoster = useMemo(() => {
    return patients.filter((p) => {
      if (!rosterSearch.trim()) return true;
      const q = rosterSearch.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.bedNumber.toLowerCase().includes(q) ||
        p.admissionDiagnosis.toLowerCase().includes(q)
      );
    });
  }, [patients, rosterSearch]);

  const criticalPatients = filteredRoster.filter((p) => p.category === 'CRITICAL_REVIEW');
  const watchPatients = filteredRoster.filter((p) => p.category === 'EVALUATE' || p.category === 'WATCH');
  const stablePatients = filteredRoster.filter((p) => p.category === 'LOW');

  // Simulated sparkline points for Heart Rate (6 data points)
  const hrTrend = [
    { time: '10:00', value: 84 },
    { time: '10:15', value: 92 },
    { time: '10:30', value: 98 },
    { time: '10:45', value: 106 },
    { time: '11:00', value: selectedPatient.vitals.heartRate ?? 118 },
    { time: '11:15', value: selectedPatient.vitals.heartRate ? selectedPatient.vitals.heartRate + 2 : 120 },
  ];

  // Simulated sparkline points for APS Risk Score (6 data points)
  const apsTrend = [
    { time: '10:00', value: 34 },
    { time: '10:15', value: 48 },
    { time: '10:30', value: 62 },
    { time: '10:45', value: 76 },
    { time: '11:00', value: selectedPatient.apsScore },
    { time: '11:15', value: Math.min(100, selectedPatient.apsScore + 1) },
  ];

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  const sbp = selectedPatient.vitals.systolicBP;
  const dbp = selectedPatient.vitals.diastolicBP;
  const map = sbp && dbp ? Math.round((2 * dbp + sbp) / 3) : null;
  const hr = selectedPatient.vitals.heartRate;
  const spo2 = selectedPatient.vitals.spo2;
  const rr = selectedPatient.vitals.respiratoryRate;

  const hrStatus = hr ? (hr > 100 ? 'Tachycardia' : hr < 60 ? 'Bradycardia' : 'Normal') : '--';
  const bpStatus = sbp ? (sbp < 90 ? 'Hypotensive' : sbp > 140 ? 'Hypertensive' : 'Normotensive') : '--';
  const spo2Status = spo2 ? (spo2 < 95 ? 'Hypoxic' : 'Adequate') : '--';
  const rrStatus = rr ? (rr > 20 ? 'Tachypneic' : rr < 12 ? 'Bradypneic' : 'Normal') : '--';

  return (
    <div className="space-y-3.5 sm:space-y-4">
      {/* Mobile & Tablet Quick-Switch Patient Strip (< xl) */}
      <div className="xl:hidden pb-1">
        <div className="flex items-center justify-between pb-1.5 px-0.5">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider font-mono flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Triage Priority Switcher ({patients.length})
          </span>
          <span className="text-[10px] text-slate-400 font-mono">Tap bed to switch</span>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          {patients.map((p) => {
            const isSelected = p.patientId === selectedPatient.patientId;
            const isCrit = p.category === 'CRITICAL_REVIEW';
            const isEval = p.category === 'EVALUATE';

            return (
              <button
                key={p.patientId}
                type="button"
                onClick={() => onSelectPatient(p)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer shrink-0 border ${
                  isSelected
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs scale-[1.02]'
                    : isCrit
                    ? 'bg-rose-50 text-rose-700 border-rose-200/80 hover:bg-rose-100'
                    : isEval
                    ? 'bg-amber-50 text-amber-700 border-amber-200/80 hover:bg-amber-100'
                    : 'bg-[#F3F6F4] text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span className="font-mono font-bold">Bed {p.bedNumber}</span>
                <span className="opacity-50">•</span>
                <span className="truncate max-w-[80px] sm:max-w-[110px]">{p.name.split(' ')[0]}</span>
                <span
                  className={`font-mono text-[10px] font-black px-1.5 py-0.2 rounded-md ${
                    isSelected
                      ? 'bg-white/20 text-white'
                      : isCrit
                      ? 'bg-rose-500 text-white'
                      : isEval
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {p.apsScore}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Upper Layout: Split View with Left Roster on desktop & Right Workstation Cards */}
      <div className="flex flex-col xl:flex-row gap-3.5 sm:gap-4 lg:gap-5 items-start">
        {/* ================================================================= */}
        {/* 1. LEFT COLUMN: PATIENT TRIAGE ROSTER (Desktop Only xl+)          */}
        {/* ================================================================= */}
        <div className="hidden xl:block w-[280px] lg:w-[290px] xl:w-[300px] bg-white rounded-2xl border border-slate-200/70 p-3.5 shrink-0 shadow-xs">
          {/* Header */}
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Patients</h2>
              <p className="text-[10px] text-slate-500 font-medium">Triage Priority Queue</p>
            </div>
            <span className="text-xs font-mono font-bold text-slate-800 bg-[#F3F6F4] px-2.5 py-0.5 rounded-full border border-slate-200/60">
              {patients.length} Monitored
            </span>
          </div>

          {/* Search Box */}
          <div className="relative my-2.5">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={rosterSearch}
              onChange={(e) => setRosterSearch(e.target.value)}
              placeholder="Search patient or bed..."
              className="w-full bg-[#F3F6F4] text-slate-800 placeholder:text-slate-400 rounded-xl pl-8 pr-3 py-1.5 text-xs font-medium border border-slate-200/60 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          {/* Grouped Patient List */}
          <div className="space-y-3.5 max-h-[540px] overflow-y-auto pr-1">
            {/* Critical Group */}
            {criticalPatients.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                  Critical Deterioration ({criticalPatients.length})
                </p>
                <div className="space-y-1">
                  {criticalPatients.map((p) => {
                    const isSelected = p.patientId === selectedPatient.patientId;
                    return (
                      <button
                        key={p.patientId}
                        type="button"
                        onClick={() => onSelectPatient(p)}
                        className={`w-full text-left p-2 rounded-xl transition-all flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-[#F3F6F4] border border-slate-200/90 shadow-xs'
                            : 'hover:bg-slate-50 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="h-7 w-7 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center justify-center shrink-0">
                            {getInitials(p.name)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 truncate leading-tight">
                              {p.name}
                            </p>
                            <p className="text-[10px] text-slate-500 truncate">
                              Bed {p.bedNumber} • {p.admissionDiagnosis}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0 pl-1.5">
                          <span className="text-xs font-mono font-black text-rose-600">
                            {p.apsScore}
                          </span>
                          <p className="text-[9px] font-semibold text-rose-500 uppercase">APS</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Watch / Escalating Group */}
            {watchPatients.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  Escalating / Watch ({watchPatients.length})
                </p>
                <div className="space-y-1">
                  {watchPatients.map((p) => {
                    const isSelected = p.patientId === selectedPatient.patientId;
                    return (
                      <button
                        key={p.patientId}
                        type="button"
                        onClick={() => onSelectPatient(p)}
                        className={`w-full text-left p-2 rounded-xl transition-all flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-[#F3F6F4] border border-slate-200/90 shadow-xs'
                            : 'hover:bg-slate-50 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="h-7 w-7 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold flex items-center justify-center shrink-0">
                            {getInitials(p.name)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 truncate leading-tight">
                              {p.name}
                            </p>
                            <p className="text-[10px] text-slate-500 truncate">
                              Bed {p.bedNumber} • {p.admissionDiagnosis}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0 pl-1.5">
                          <span className="text-xs font-mono font-bold text-amber-600">
                            {p.apsScore}
                          </span>
                          <p className="text-[9px] font-semibold text-amber-500 uppercase">APS</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Stable Group */}
            {stablePatients.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Stable Ward Beds ({stablePatients.length})
                </p>
                <div className="space-y-1">
                  {stablePatients.map((p) => {
                    const isSelected = p.patientId === selectedPatient.patientId;
                    return (
                      <button
                        key={p.patientId}
                        type="button"
                        onClick={() => onSelectPatient(p)}
                        className={`w-full text-left p-2 rounded-xl transition-all flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-[#F3F6F4] border border-slate-200/90 shadow-xs'
                            : 'hover:bg-slate-50 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="h-7 w-7 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold flex items-center justify-center shrink-0">
                            {getInitials(p.name)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 truncate leading-tight">
                              {p.name}
                            </p>
                            <p className="text-[10px] text-slate-500 truncate">
                              Bed {p.bedNumber} • {p.admissionDiagnosis}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0 pl-1.5">
                          <span className="text-xs font-mono font-bold text-emerald-600">
                            {p.apsScore}
                          </span>
                          <p className="text-[9px] font-semibold text-emerald-500 uppercase">APS</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ================================================================= */}
        {/* 2. RIGHT MAIN AREA: DUAL WORKSTATION PANELS                        */}
        {/* ================================================================= */}
        <div className="flex-1 w-full space-y-3.5 sm:space-y-4 min-w-0">
          {/* Patient Overview Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pb-2.5 border-b border-slate-100">
            {/* Left: Patient Identity & Breadcrumbs */}
            <div className="flex items-center gap-2.5 min-w-0">
              <Button
                variant="outline"
                size="sm"
                onClick={onBackToRadar}
                className="gap-1 text-xs font-semibold rounded-xl h-8 px-2.5 shrink-0"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Ward Radar</span>
              </Button>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-black text-slate-900 truncate">
                    {selectedPatient.name}
                  </h2>
                  <span className="bg-[#F3F6F4] text-slate-700 font-mono text-xs font-bold px-2 py-0.5 rounded-md border border-slate-200 shrink-0">
                    Bed {selectedPatient.bedNumber}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium truncate">
                  {selectedPatient.admissionDiagnosis} • Admitted {selectedPatient.lastTrustedElapsedMinutes}m ago
                </p>
              </div>
            </div>

            {/* Right: Quick Clinical Actions */}
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              {onOpenCamera && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onOpenCamera}
                  className="gap-1 text-xs font-bold text-emerald-700 border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100 rounded-xl h-8"
                >
                  <Camera className="h-3.5 w-3.5" />
                  <span>Spot-Check [C]</span>
                </Button>
              )}

              {!selectedPatient.isAcknowledged &&
              (selectedPatient.category === 'CRITICAL_REVIEW' || selectedPatient.category === 'EVALUATE') ? (
                <Button
                  size="sm"
                  onClick={(e) => onAcknowledge(selectedPatient.patientId, e)}
                  className="gap-1.5 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-xs h-8"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Acknowledge [A]</span>
                </Button>
              ) : (
                <div className="flex items-center gap-1.5 text-xs font-mono text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2.5 py-1 rounded-xl font-semibold h-8">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Verified Bedside</span>
                </div>
              )}
            </div>
          </div>

          {/* Two Comparison Cards Side-by-Side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 sm:gap-4">
            {/* ------------------------------------------------------------- */}
            {/* CARD 1: LIVE BEDSIDE TELEMETRY & OPTICAL SENSING              */}
            {/* ------------------------------------------------------------- */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col justify-between">
              {/* Top Mint Gradient Banner */}
              <div className="bg-gradient-to-b from-[#EAF7EC] to-white p-3.5 sm:p-4 border-b border-emerald-100/70">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <img src="/aegis-logo.png" alt="AegisPulse" className="h-5 w-5 sm:h-6 sm:w-6 object-contain" />
                    <div>
                      <h3 className="text-xs sm:text-sm font-black text-slate-900 tracking-tight">
                        AegisPulse Live Telemetry Stream
                      </h3>
                      <p className="text-[10px] text-slate-500 font-medium">Physiological Vitals & Contactless rPPG</p>
                    </div>
                  </div>
                  <span className="bg-white/90 text-emerald-700 font-mono text-[11px] sm:text-xs font-bold px-2.5 py-0.5 rounded-full border border-emerald-200/60 shadow-2xs">
                    {selectedPatient.signalQuality?.confidencePercent ?? 98}% SQI • Valid
                  </span>
                </div>

                {/* 4 High-Visibility Clinical Vital Tiles (2x2 Grid) */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {/* Tile 1: Heart Rate */}
                  <div className="bg-white/90 rounded-xl p-2.5 border border-emerald-100 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                        <HeartPulse className="h-3.5 w-3.5 text-rose-500" />
                        Heart Rate
                      </span>
                      <span
                        className={`text-[9px] font-bold font-mono px-1.5 py-0.5 rounded ${
                          hr && hr > 100
                            ? 'bg-rose-100 text-rose-700'
                            : hr && hr < 60
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {hrStatus}
                      </span>
                    </div>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="text-xl sm:text-2xl font-black font-mono text-slate-900">
                        {hr ?? '--'}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500 font-medium">BPM</span>
                    </div>
                    <p className="text-[9px] text-slate-400 font-mono mt-0.5">Range: 60-100</p>
                  </div>

                  {/* Tile 2: Blood Pressure */}
                  <div className="bg-white/90 rounded-xl p-2.5 border border-emerald-100 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                        <Droplets className="h-3.5 w-3.5 text-sky-500" />
                        Blood Pressure
                      </span>
                      <span
                        className={`text-[9px] font-bold font-mono px-1.5 py-0.5 rounded ${
                          sbp && sbp < 90
                            ? 'bg-rose-100 text-rose-700'
                            : sbp && sbp > 140
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {bpStatus}
                      </span>
                    </div>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="text-lg sm:text-xl font-black font-mono text-slate-900">
                        {sbp && dbp ? `${sbp}/${dbp}` : '--/--'}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500 font-medium">mmHg</span>
                    </div>
                    <p className="text-[9px] text-slate-400 font-mono mt-0.5">
                      {map ? `MAP: ${map} mmHg` : 'Range: 90-140 SBP'}
                    </p>
                  </div>

                  {/* Tile 3: Oxygen Saturation */}
                  <div className="bg-white/90 rounded-xl p-2.5 border border-emerald-100 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                        <Activity className="h-3.5 w-3.5 text-blue-500" />
                        SpO2
                      </span>
                      <span
                        className={`text-[9px] font-bold font-mono px-1.5 py-0.5 rounded ${
                          spo2 && spo2 < 95
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {spo2Status}
                      </span>
                    </div>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="text-xl sm:text-2xl font-black font-mono text-slate-900">
                        {spo2 ?? '--'}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500 font-medium">%</span>
                    </div>
                    <p className="text-[9px] text-slate-400 font-mono mt-0.5">Target: ≥95%</p>
                  </div>

                  {/* Tile 4: Respiratory Rate */}
                  <div className="bg-white/90 rounded-xl p-2.5 border border-emerald-100 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                        <Wind className="h-3.5 w-3.5 text-emerald-600" />
                        Resp Rate
                      </span>
                      <span
                        className={`text-[9px] font-bold font-mono px-1.5 py-0.5 rounded ${
                          rr && rr > 20
                            ? 'bg-amber-100 text-amber-700'
                            : rr && rr < 12
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {rrStatus}
                      </span>
                    </div>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="text-xl sm:text-2xl font-black font-mono text-slate-900">
                        {rr ?? '--'}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500 font-medium">/min</span>
                    </div>
                    <p className="text-[9px] text-slate-400 font-mono mt-0.5">Range: 12-20</p>
                  </div>
                </div>
              </div>

              {/* Bottom Sparkline Graph */}
              <div className="p-3.5 sm:p-4 pt-2.5">
                <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1.5 font-medium">
                  <span>Heart Rate Trajectory (60m)</span>
                  <span className="font-mono text-emerald-700 font-bold text-[10px]">● High Frequency</span>
                </div>

                {/* SVG Smooth Curve Waveform */}
                <div className="relative h-24 sm:h-28 w-full">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 300 100" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="emerald-sparkline" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#059669" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#059669" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    <line x1="0" y1="20" x2="300" y2="20" stroke="#f1f5f9" strokeDasharray="3 3" />
                    <line x1="0" y1="50" x2="300" y2="50" stroke="#f1f5f9" strokeDasharray="3 3" />
                    <line x1="0" y1="80" x2="300" y2="80" stroke="#f1f5f9" strokeDasharray="3 3" />

                    <path
                      d="M 0 85 C 50 80, 80 65, 120 50 C 160 35, 200 40, 240 25 C 270 15, 290 10, 300 8 L 300 100 L 0 100 Z"
                      fill="url(#emerald-sparkline)"
                    />

                    <path
                      d="M 0 85 C 50 80, 80 65, 120 50 C 160 35, 200 40, 240 25 C 270 15, 290 10, 300 8"
                      fill="none"
                      stroke="#059669"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />

                    <circle cx="280" cy="12" r="4" fill="#059669" className="animate-ping" opacity="0.75" />
                    <circle cx="280" cy="12" r="3.5" fill="#059669" />
                  </svg>

                  {/* Floating Pill Tooltip */}
                  <div className="absolute right-2 top-0 bg-slate-900 text-white rounded-full px-2.5 py-0.5 flex items-center gap-1.5 shadow-md text-[10px] font-bold">
                    <div className="h-3.5 w-3.5 rounded-full bg-rose-500 text-[8px] flex items-center justify-center font-mono">
                      HR
                    </div>
                    <span>{selectedPatient.vitals.heartRate ?? 118} BPM</span>
                  </div>
                </div>

                {/* X-Axis Timestamps */}
                <div className="flex justify-between text-[9px] text-slate-400 font-mono pt-1.5 border-t border-slate-100">
                  {hrTrend.map((pt, i) => (
                    <span key={i}>{pt.time}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* ------------------------------------------------------------- */}
            {/* CARD 2: CLINICAL DETERIORATION & ACTIONS                      */}
            {/* ------------------------------------------------------------- */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col justify-between">
              {/* Top Sky Gradient Banner */}
              <div className="bg-gradient-to-b from-[#EBF4FA] to-white p-3.5 sm:p-4 border-b border-sky-100/70">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <img src="/aegis-logo.png" alt="AegisPulse" className="h-5 w-5 sm:h-6 sm:w-6 object-contain" />
                    <div>
                      <h3 className="text-xs sm:text-sm font-black text-slate-900 tracking-tight">
                        AegisPulse Clinical Trajectory
                      </h3>
                      <p className="text-[10px] text-slate-500 font-medium">Attention Allocation Protocol</p>
                    </div>
                  </div>
                  <span className="bg-white/90 text-rose-700 font-mono text-[11px] sm:text-xs font-bold px-2.5 py-0.5 rounded-full border border-rose-200/60 shadow-2xs">
                    APS {selectedPatient.apsScore} • Immediate Action
                  </span>
                </div>

                {/* Actions Table */}
                <div className="space-y-1.5 pt-0.5 text-xs">
                  <div className="flex items-center justify-between py-1 border-b border-sky-50">
                    <div className="flex items-center gap-2 text-slate-700 font-semibold text-xs">
                      <Sparkles className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      <span className="truncate">Draw Blood Cultures & Lactate</span>
                    </div>
                    <span className="bg-rose-50 text-rose-700 font-bold px-2 py-0.5 rounded text-[10px] border border-rose-200/60 shrink-0">
                      STAT • Required
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-sky-50">
                    <div className="flex items-center gap-2 text-slate-700 font-semibold text-xs">
                      <Droplets className="h-3.5 w-3.5 text-sky-500 shrink-0" />
                      <span className="truncate">IV Fluid Resuscitation (500mL)</span>
                    </div>
                    <span className="bg-sky-50 text-sky-700 font-bold px-2 py-0.5 rounded text-[10px] border border-sky-200/60 shrink-0">
                      In Progress
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-sky-50">
                    <div className="flex items-center gap-2 text-slate-700 font-semibold text-xs">
                      <User className="h-3.5 w-3.5 text-purple-500 shrink-0" />
                      <span className="truncate">Notify Attending MD (Dr. Chen)</span>
                    </div>
                    <span className="bg-purple-50 text-purple-700 font-bold px-2 py-0.5 rounded text-[10px] border border-purple-200/60 shrink-0">
                      Paged • 10m ago
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-sky-50">
                    <div className="flex items-center gap-2 text-slate-700 font-semibold text-xs">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      <span className="truncate">Bedside QR Safety Verification</span>
                    </div>
                    <span className="bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded text-[10px] border border-emerald-200/60 shrink-0">
                      Verified
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom Sparkline Graph */}
              <div className="p-3.5 sm:p-4 pt-2.5">
                <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1.5 font-medium">
                  <span>Deterioration Index Progression</span>
                  <span className="font-mono text-sky-700 font-bold text-[10px]">● Multi-Organ MEWS</span>
                </div>

                {/* SVG Smooth Curve Waveform in Sky Blue */}
                <div className="relative h-24 sm:h-28 w-full">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 300 100" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="sky-sparkline" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0284c7" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#0284c7" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    <line x1="0" y1="20" x2="300" y2="20" stroke="#f1f5f9" strokeDasharray="3 3" />
                    <line x1="0" y1="50" x2="300" y2="50" stroke="#f1f5f9" strokeDasharray="3 3" />
                    <line x1="0" y1="80" x2="300" y2="80" stroke="#f1f5f9" strokeDasharray="3 3" />

                    <path
                      d="M 0 75 C 60 70, 90 55, 140 45 C 180 35, 220 28, 250 18 C 275 10, 290 8, 300 6 L 300 100 L 0 100 Z"
                      fill="url(#sky-sparkline)"
                    />

                    <path
                      d="M 0 75 C 60 70, 90 55, 140 45 C 180 35, 220 28, 250 18 C 275 10, 290 8, 300 6"
                      fill="none"
                      stroke="#0284c7"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />

                    <circle cx="285" cy="8" r="4" fill="#0284c7" className="animate-ping" opacity="0.75" />
                    <circle cx="285" cy="8" r="3.5" fill="#0284c7" />
                  </svg>

                  {/* Floating Pill Tooltip */}
                  <div className="absolute right-2 top-0 bg-slate-900 text-white rounded-full px-2.5 py-0.5 flex items-center gap-1.5 shadow-md text-[10px] font-bold">
                    <div className="h-3.5 w-3.5 rounded-full bg-amber-500 text-[8px] flex items-center justify-center font-mono">
                      APS
                    </div>
                    <span>Score {selectedPatient.apsScore} Peak</span>
                  </div>
                </div>

                {/* X-Axis Timestamps */}
                <div className="flex justify-between text-[9px] text-slate-400 font-mono pt-1.5 border-t border-slate-100">
                  {apsTrend.map((pt, i) => (
                    <span key={i}>{pt.time}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Expandable Section: Comprehensive Clinical Dossier & Deep Dive */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
            <button
              type="button"
              onClick={() => setShowFullDossier(!showFullDossier)}
              className="w-full flex items-center justify-between text-xs font-bold text-slate-800 hover:text-slate-950 transition-colors cursor-pointer py-1"
            >
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-emerald-600" />
                <span>Full Clinical Dossier & Labs (Timeline, SBAR, Diagnostic Provenance)</span>
              </div>
              {showFullDossier ? (
                <ChevronUp className="h-4 w-4 text-slate-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-400" />
              )}
            </button>

            {showFullDossier && (
              <div className="pt-4 border-t border-slate-100 mt-3">
                <PatientDetailPanel
                  patient={selectedPatient}
                  isEmbedded={true}
                  onAcknowledge={onAcknowledge}
                  onLogAssessment={onLogAssessment}
                  onEscalate={onEscalate}
                  onSpotCheckComplete={onSpotCheckComplete}
                  onOpenCamera={onOpenCamera}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
