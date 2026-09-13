import React from 'react';
import type { PatientRecord, TriageLevel } from '../lib/types';
import { Bed, User } from 'lucide-react';

interface MultiPatientWardViewProps {
  patients: PatientRecord[];
  selectedPatientId: string;
  onSelectPatient: (id: string) => void;
}

export const MultiPatientWardView: React.FC<MultiPatientWardViewProps> = ({
  patients,
  selectedPatientId,
  onSelectPatient,
}) => {
  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-400">
            <Bed className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide uppercase">
              Ward 4B: Telemetry Overview
            </h3>
            <p className="text-xs text-slate-400">Centralized non-contact bedside surveillance</p>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-xs font-mono text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>4 Beds Connected</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {patients.map((p) => {
          const isSelected = p.id === selectedPatientId;
          const level: TriageLevel = p.vitals.triageLevel;

          return (
            <div
              key={p.id}
              onClick={() => onSelectPatient(p.id)}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? 'bg-slate-800/90 border-cyan-400 ring-2 ring-cyan-500/30 shadow-lg'
                  : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-800/50 hover:border-slate-700'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">
                    BED {p.bedNumber}
                  </span>
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      level === 'red'
                        ? 'bg-red-500 animate-ping'
                        : level === 'yellow'
                        ? 'bg-amber-400'
                        : 'bg-emerald-400'
                    }`}
                  ></span>
                </div>

                <div className="font-bold text-sm text-white flex items-center space-x-1.5 mb-0.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span className="truncate">{p.name}</span>
                </div>
                <div className="text-[11px] text-slate-400 mb-2 truncate">
                  {p.age}y {p.gender} · {p.admissionReason}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs font-mono">
                <div>
                  <span className="text-slate-500 text-[10px] block">HR / SpO2</span>
                  <span className="text-white font-bold">
                    {p.vitals.heartRate} <span className="text-slate-400 text-[10px]">/ {p.vitals.spo2}%</span>
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-slate-500 text-[10px] block">MEWS</span>
                  <span
                    className={`font-black ${
                      level === 'red'
                        ? 'text-red-400'
                        : level === 'yellow'
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {p.vitals.mewsScore} / 14
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
