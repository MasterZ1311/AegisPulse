import React, { useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  Eye,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Minus,
  Radio,
  Clock,
  HeartPulse,
  Wind,
  Droplets,
  Activity,
  ArrowUpDown,
  Check,
} from 'lucide-react';
import type { WardPatientRadarState } from '../types/radar';

interface AttentionQueueProps {
  patients: WardPatientRadarState[];
  selectedPatientId: string | null;
  focusedPatientIndex: number;
  onSelectPatient: (patient: WardPatientRadarState) => void;
  onAcknowledgePatient: (patientId: string, event: React.MouseEvent) => void;
}

export const AttentionQueue: React.FC<AttentionQueueProps> = ({
  patients,
  selectedPatientId,
  focusedPatientIndex,
  onSelectPatient,
  onAcknowledgePatient,
}) => {
  const [sortBy, setSortBy] = useState<'APS' | 'CATEGORY' | 'BED' | 'FRESHNESS'>('APS');

  // Sort queue dynamically
  const sortedPatients = [...patients].sort((a, b) => {
    switch (sortBy) {
      case 'APS':
        return b.apsScore - a.apsScore;
      case 'CATEGORY': {
        const order: Record<string, number> = {
          CRITICAL_REVIEW: 4,
          EVALUATE: 3,
          WATCH: 2,
          LOW: 1,
        };
        return (order[b.category] || 0) - (order[a.category] || 0) || b.apsScore - a.apsScore;
      }
      case 'BED':
        return a.bedNumber.localeCompare(b.bedNumber);
      case 'FRESHNESS':
        return b.lastTrustedElapsedMinutes - a.lastTrustedElapsedMinutes;
      default:
        return b.apsScore - a.apsScore;
    }
  });

  const getCategoryConfig = (category: string) => {
    switch (category) {
      case 'CRITICAL_REVIEW':
        return {
          badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/50',
          indicatorClass: 'bg-rose-500',
          borderHighlight: 'border-l-rose-500 hover:border-rose-400',
          cardGlow: 'shadow-[0_0_20px_rgba(244,63,94,0.15)]',
          label: 'CRITICAL REVIEW',
          icon: <AlertOctagon className="h-4 w-4 text-rose-400 animate-pulse" />,
        };
      case 'EVALUATE':
        return {
          badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/50',
          indicatorClass: 'bg-amber-500',
          borderHighlight: 'border-l-amber-500 hover:border-amber-400',
          cardGlow: 'shadow-[0_0_15px_rgba(245,158,11,0.1)]',
          label: 'EVALUATE',
          icon: <AlertTriangle className="h-4 w-4 text-amber-400" />,
        };
      case 'WATCH':
        return {
          badgeClass: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
          indicatorClass: 'bg-yellow-500',
          borderHighlight: 'border-l-yellow-500 hover:border-yellow-400',
          cardGlow: '',
          label: 'WATCH',
          icon: <Eye className="h-4 w-4 text-yellow-400" />,
        };
      case 'LOW':
      default:
        return {
          badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
          indicatorClass: 'bg-emerald-500',
          borderHighlight: 'border-l-emerald-500/80 hover:border-emerald-400',
          cardGlow: '',
          label: 'LOW RISK',
          icon: <CheckCircle2 className="h-4 w-4 text-emerald-400" />,
        };
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'RAPIDLY_RISING':
        return (
          <span className="flex items-center gap-1 text-rose-400 font-semibold text-xs">
            <TrendingUp className="h-4 w-4 text-rose-400 animate-bounce" />
            Rapid Acceleration
          </span>
        );
      case 'RISING':
        return (
          <span className="flex items-center gap-1 text-amber-400 text-xs">
            <TrendingUp className="h-4 w-4 text-amber-400" />
            Trending Up
          </span>
        );
      case 'RECOVERING':
        return (
          <span className="flex items-center gap-1 text-emerald-400 text-xs">
            <TrendingDown className="h-4 w-4 text-emerald-400" />
            Recovering
          </span>
        );
      case 'STEADY':
      default:
        return (
          <span className="flex items-center gap-1 text-slate-400 text-xs">
            <Minus className="h-4 w-4 text-slate-500" />
            Steady Baseline
          </span>
        );
    }
  };

  return (
    <section
      aria-label="Ward Primary Attention Queue"
      className="w-full flex flex-col space-y-4"
    >
      {/* Question & Sort Command Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-900/90 border border-slate-800 rounded-xl px-4 py-3 shadow-inner">
        <div>
          <span className="text-[11px] font-mono tracking-wider uppercase text-cyan-400 font-semibold block">
            Clinical Priority Triage
          </span>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            Who needs my attention next?
            <span className="text-xs font-normal text-slate-400">
              (Ranked by Attention Priority Score & Velocity)
            </span>
          </h2>
        </div>

        {/* Dynamic Sort Controls & Keyboard Pill */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 text-[11px] font-mono text-slate-400 bg-slate-950 px-2.5 py-1 rounded-md border border-slate-800">
            <span className="text-cyan-400 font-bold">KEYS:</span>
            <span>[↑/↓] Select</span>
            <span>•</span>
            <span>[Enter] Detail</span>
            <span>•</span>
            <span>[1-6] Jump</span>
            <span>•</span>
            <span>[A] Ack</span>
          </div>

          <div className="flex items-center gap-1.5 text-xs bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800">
            <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-slate-400">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-slate-200 font-medium focus:outline-none cursor-pointer"
              aria-label="Sort Attention Queue By"
            >
              <option value="APS" className="bg-slate-900 text-slate-200">
                APS Score (Highest First)
              </option>
              <option value="CATEGORY" className="bg-slate-900 text-slate-200">
                Risk Tier Severity
              </option>
              <option value="BED" className="bg-slate-900 text-slate-200">
                Bed Number (Numerical)
              </option>
              <option value="FRESHNESS" className="bg-slate-900 text-slate-200">
                Longest Elapsed Since Trusted Check
              </option>
            </select>
          </div>
        </div>
      </div>

      {/* Primary Cards Queue */}
      <div className="space-y-3" role="list" aria-label="Patients Queue">
        {sortedPatients.map((patient, index) => {
          const config = getCategoryConfig(patient.category);
          const isSelected = selectedPatientId === patient.patientId;
          const isKeyboardFocused = focusedPatientIndex === index;

          return (
            <div
              key={patient.patientId}
              role="listitem"
              tabIndex={0}
              onClick={() => onSelectPatient(patient)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectPatient(patient);
                }
              }}
              className={`group relative rounded-xl bg-slate-900/80 border transition-all duration-200 cursor-pointer overflow-hidden p-4 sm:p-5 ${
                config.borderHighlight
              } border-l-[6px] ${
                isSelected
                  ? 'border-cyan-500 bg-slate-900 ring-2 ring-cyan-400/50 shadow-lg shadow-cyan-500/10'
                  : isKeyboardFocused
                  ? 'border-cyan-400/80 bg-slate-900 ring-2 ring-cyan-500/40'
                  : 'border-slate-800/80 hover:bg-slate-850 hover:border-slate-700'
              } ${config.cardGlow}`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                {/* 1. Bed & Demographics */}
                <div className="flex items-start gap-3.5 min-w-[240px]">
                  {/* Bed Badge */}
                  <div className="flex flex-col items-center justify-center h-14 w-16 rounded-xl bg-slate-950 border border-slate-800 text-center shadow-inner group-hover:border-slate-700">
                    <span className="text-[10px] font-mono uppercase text-slate-400 font-semibold">
                      BED
                    </span>
                    <span className="text-base font-extrabold text-white font-mono">
                      {patient.bedNumber}
                    </span>
                  </div>

                  {/* Name & Admission Context */}
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-white group-hover:text-cyan-300 transition-colors">
                        {patient.name}
                      </h3>
                      <span className="text-xs font-mono text-slate-400">
                        ({patient.gender === 'FEMALE' ? 'F' : 'M'}, {patient.age}y)
                      </span>
                      <span className="text-[11px] font-mono text-slate-500">
                        {patient.mrn}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                      {patient.admissionDiagnosis}
                    </p>

                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400 font-mono">
                      <span className="flex items-center gap-1 text-slate-300">
                        <Radio className="h-3 w-3 text-cyan-400" />
                        {patient.signalQuality.confidencePercent}% Confidence
                      </span>
                      <span>•</span>
                      <span
                        className={`flex items-center gap-1 ${
                          patient.isStale ? 'text-rose-400 font-bold' : 'text-slate-400'
                        }`}
                      >
                        <Clock className="h-3 w-3" />
                        {patient.lastTrustedElapsedMinutes <= 1
                          ? 'Just now'
                          : `${patient.lastTrustedElapsedMinutes}m ago`}
                        {patient.isStale && ' [STALE]'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. Primary Clinical Reason & Trend */}
                <div className="flex-1 lg:max-w-xl">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[11px] font-mono uppercase font-semibold text-slate-400">
                      Primary Clinical Trigger:
                    </span>
                    {getTrendIcon(patient.trendDirection)}
                  </div>
                  <div className="text-xs sm:text-sm text-slate-200 font-medium bg-slate-950/70 border border-slate-800/80 rounded-lg p-2.5 line-clamp-2">
                    {patient.topContributingReasons[0]?.explanation || patient.whyNowSummary}
                  </div>
                </div>

                {/* 3. Vitals Mini Strip */}
                <div className="grid grid-cols-4 gap-2 bg-slate-950/80 border border-slate-800/90 rounded-xl p-2 min-w-[260px]">
                  <div className="flex flex-col items-center text-center">
                    <span className="text-[10px] font-mono text-slate-500 flex items-center gap-0.5">
                      <HeartPulse className="h-2.5 w-2.5 text-rose-400" /> HR
                    </span>
                    <span
                      className={`text-sm font-bold font-mono ${
                        patient.vitals.heartRate > 105
                          ? 'text-rose-400'
                          : patient.vitals.heartRate > 95
                          ? 'text-amber-300'
                          : 'text-white'
                      }`}
                    >
                      {patient.vitals.heartRate}
                    </span>
                    <span className="text-[9px] text-slate-500 font-mono">bpm</span>
                  </div>

                  <div className="flex flex-col items-center text-center border-l border-slate-800">
                    <span className="text-[10px] font-mono text-slate-500 flex items-center gap-0.5">
                      <Wind className="h-2.5 w-2.5 text-cyan-400" /> RR
                    </span>
                    <span
                      className={`text-sm font-bold font-mono ${
                        patient.vitals.respiratoryRate >= 24
                          ? 'text-rose-400'
                          : patient.vitals.respiratoryRate >= 20
                          ? 'text-amber-300'
                          : 'text-white'
                      }`}
                    >
                      {patient.vitals.respiratoryRate}
                    </span>
                    <span className="text-[9px] text-slate-500 font-mono">/min</span>
                  </div>

                  <div className="flex flex-col items-center text-center border-l border-slate-800">
                    <span className="text-[10px] font-mono text-slate-500 flex items-center gap-0.5">
                      <Droplets className="h-2.5 w-2.5 text-blue-400" /> SpO2
                    </span>
                    <span
                      className={`text-sm font-bold font-mono ${
                        patient.vitals.spo2 < 92
                          ? 'text-rose-400'
                          : patient.vitals.spo2 < 95
                          ? 'text-amber-300'
                          : 'text-white'
                      }`}
                    >
                      {patient.vitals.spo2}%
                    </span>
                    <span className="text-[9px] text-slate-500 font-mono">pulse</span>
                  </div>

                  <div className="flex flex-col items-center text-center border-l border-slate-800">
                    <span className="text-[10px] font-mono text-slate-500 flex items-center gap-0.5">
                      <Activity className="h-2.5 w-2.5 text-purple-400" /> BP
                    </span>
                    <span
                      className={`text-xs font-bold font-mono ${
                        patient.vitals.systolicBP < 95
                          ? 'text-rose-400'
                          : 'text-white'
                      }`}
                    >
                      {patient.vitals.systolicBP}/{patient.vitals.diastolicBP}
                    </span>
                    <span className="text-[9px] text-slate-500 font-mono">
                      MAP {patient.vitals.meanArterialPressure}
                    </span>
                  </div>
                </div>

                {/* 4. Attention Priority Score Gauge & Action */}
                <div className="flex items-center justify-between lg:justify-end gap-3 min-w-[180px]">
                  <div className="flex flex-col items-end">
                    {/* Urgency Badge */}
                    <div
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-bold tracking-wider uppercase font-mono ${config.badgeClass}`}
                    >
                      {config.icon}
                      <span>{config.label}</span>
                    </div>

                    {/* APS Score Number */}
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-[10px] font-mono text-slate-400">APS</span>
                      <span
                        className={`text-2xl font-black font-mono tracking-tight ${
                          patient.apsScore >= 80
                            ? 'text-rose-400'
                            : patient.apsScore >= 60
                            ? 'text-amber-300'
                            : patient.apsScore >= 35
                            ? 'text-yellow-300'
                            : 'text-emerald-300'
                        }`}
                      >
                        {patient.apsScore}
                      </span>
                      <span className="text-[11px] font-mono text-slate-500">/100</span>
                    </div>
                  </div>

                  {/* Acknowledge Button */}
                  <div className="flex flex-col items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => onAcknowledgePatient(patient.patientId, e)}
                      title={patient.isAcknowledged ? 'Priority Acknowledged' : 'Acknowledge Priority Alert'}
                      aria-label={`Acknowledge Priority for ${patient.name}`}
                      className={`h-9 px-3 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                        patient.isAcknowledged
                          ? 'bg-emerald-950/30 text-emerald-400 border-emerald-800/40 hover:bg-emerald-900/40'
                          : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-cyan-900/60 hover:text-cyan-200 hover:border-cyan-600'
                      }`}
                    >
                      <Check className={`h-3.5 w-3.5 ${patient.isAcknowledged ? 'text-emerald-400' : 'text-slate-400'}`} />
                      <span>{patient.isAcknowledged ? 'Acked' : 'Ack'}</span>
                    </button>
                    <span className="text-[10px] font-mono text-slate-500 hidden sm:inline">
                      [Key: A]
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
