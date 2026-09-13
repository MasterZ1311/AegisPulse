import React, { useState } from 'react';
import type { PatientRecord, TriageLevel } from '../lib/types';
import { UserPlus, Search, User, Trash2, AlertOctagon, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';

interface WardOverviewTabProps {
  patients: PatientRecord[];
  selectedPatientId?: string;
  onSelectPatient?: (id: string) => void;
  onSelectPatientForScan?: (id: string) => void;
  onAdmitClick?: () => void;
  onOpenAdmitModal?: () => void;
  onDischargePatient: (id: string) => void;
}

export const WardOverviewTab: React.FC<WardOverviewTabProps> = ({
  patients,
  selectedPatientId: _selectedPatientId,
  onSelectPatient,
  onSelectPatientForScan,
  onAdmitClick,
  onOpenAdmitModal,
  onDischargePatient,
}) => {
  const handleSelect = onSelectPatient || onSelectPatientForScan || (() => {});
  const handleOpenAdmit = onAdmitClick || onOpenAdmitModal || (() => {});
  const [filterLevel, setFilterLevel] = useState<'all' | TriageLevel>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredPatients = patients.filter((p) => {
    const matchesFilter = filterLevel === 'all' || p.vitals.triageLevel === filterLevel;
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.bedNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.admissionReason.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const countAll = patients.length;
  const countGreen = patients.filter((p) => p.vitals.triageLevel === 'green').length;
  const countYellow = patients.filter((p) => p.vitals.triageLevel === 'yellow').length;
  const countRed = patients.filter((p) => p.vitals.triageLevel === 'red').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header & Filter Controls */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-2xl backdrop-blur-2xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-black text-white tracking-wide">Ward 4B: Clinical Command Matrix</h2>
            <span className="text-xs font-mono font-bold bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 px-2.5 py-0.5 rounded-full">
              {patients.length} Active Beds
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">Centralized non-contact bedside telemetry surveillance</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search patient, bed..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 w-48 font-medium"
            />
          </div>

          {/* Admit New Patient Button */}
          <button
            onClick={handleOpenAdmit}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-400 hover:from-cyan-400 hover:to-emerald-300 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Admit Patient</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1">
        <button
          onClick={() => setFilterLevel('all')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
            filterLevel === 'all'
              ? 'bg-slate-800 border-cyan-400 text-white shadow-lg'
              : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          All Beds ({countAll})
        </button>
        <button
          onClick={() => setFilterLevel('green')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center space-x-1.5 ${
            filterLevel === 'green'
              ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
              : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-emerald-400'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Code Green · Stable ({countGreen})</span>
        </button>
        <button
          onClick={() => setFilterLevel('yellow')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center space-x-1.5 ${
            filterLevel === 'yellow'
              ? 'bg-amber-500/20 border-amber-400 text-amber-300'
              : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-amber-400'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Code Yellow · Alert ({countYellow})</span>
        </button>
        <button
          onClick={() => setFilterLevel('red')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center space-x-1.5 ${
            filterLevel === 'red'
              ? 'bg-red-500/20 border-red-400 text-red-300 shadow-red-500/20 shadow-lg'
              : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-red-400'
          }`}
        >
          <AlertOctagon className="w-3.5 h-3.5 animate-pulse" />
          <span>Code Red · Critical ({countRed})</span>
        </button>
      </div>

      {/* Patient Bed Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredPatients.map((p) => {
          const level = p.vitals.triageLevel;
          return (
            <div
              key={p.id}
              className={`bg-slate-900/90 border rounded-3xl p-5 shadow-2xl backdrop-blur-2xl flex flex-col justify-between transition-all duration-300 ${
                level === 'red'
                  ? 'border-red-500/60 shadow-red-500/10'
                  : level === 'yellow'
                  ? 'border-amber-500/50 shadow-amber-500/10'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                {/* Bed Tag & Status Light */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-mono font-black px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-cyan-300">
                      BED {p.bedNumber}
                    </span>
                    <span
                      className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full border ${
                        level === 'red'
                          ? 'bg-red-500/20 border-red-400 text-red-300 animate-pulse'
                          : level === 'yellow'
                          ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                          : 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                      }`}
                    >
                      {level === 'red' ? 'CRITICAL' : level === 'yellow' ? 'MONITOR' : 'STABLE'}
                    </span>
                  </div>

                  <button
                    onClick={() => onDischargePatient(p.id)}
                    title="Discharge Patient"
                    className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Patient Name & Demographics */}
                <h3 className="font-bold text-white text-base flex items-center space-x-2">
                  <User className="w-4 h-4 text-slate-400" />
                  <span>{p.name}</span>
                </h3>
                <div className="text-xs text-slate-400 mt-0.5">
                  {p.age} yrs · {p.gender === 'M' ? 'Male' : p.gender === 'F' ? 'Female' : 'Other'}
                </div>

                {/* Admission Reason */}
                <p className="mt-3 text-xs text-slate-300 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80 line-clamp-2">
                  {p.admissionReason}
                </p>

                {/* Vitals Telemetry Row */}
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="bg-slate-950 p-2 rounded-xl border border-slate-800/60">
                    <span className="text-[10px] uppercase text-slate-500 block font-semibold">Pulse</span>
                    <span className="text-sm font-mono font-black text-white">{p.vitals.heartRate} <span className="text-[9px] text-slate-500">BPM</span></span>
                  </div>
                  <div className="bg-slate-950 p-2 rounded-xl border border-slate-800/60">
                    <span className="text-[10px] uppercase text-slate-500 block font-semibold">Resp Rate</span>
                    <span className="text-sm font-mono font-black text-cyan-300">{p.vitals.respiratoryRate} <span className="text-[9px] text-slate-500">/min</span></span>
                  </div>
                  <div className="bg-slate-950 p-2 rounded-xl border border-slate-800/60">
                    <span className="text-[10px] uppercase text-slate-500 block font-semibold">MEWS</span>
                    <span
                      className={`text-sm font-mono font-black ${
                        level === 'red' ? 'text-red-400' : level === 'yellow' ? 'text-amber-400' : 'text-emerald-400'
                      }`}
                    >
                      {p.vitals.mewsScore}/14
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-5 pt-3 border-t border-slate-800/80">
                <button
                  onClick={() => handleSelect(p.id)}
                  className="w-full flex items-center justify-center space-x-2 py-2.5 rounded-xl bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-slate-200 font-bold text-xs transition-all cursor-pointer group"
                >
                  <span>Launch Live Telemetry Scan</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
