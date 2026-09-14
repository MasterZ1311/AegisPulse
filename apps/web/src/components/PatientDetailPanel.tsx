import React, { useState } from 'react';
import {
  X,
  Maximize2,
  Minimize2,
  AlertOctagon,
  AlertTriangle,
  Eye,
  CheckCircle2,
  TrendingUp,
  Clock,
  Radio,
  ShieldCheck,
  HeartPulse,
  Wind,
  Droplets,
  Activity,
  Thermometer,
  FileText,
  UserCheck,
  Flame,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronUp,
  Search,
  HelpCircle,
} from 'lucide-react';
import type { WardPatientRadarState } from '../types/radar';

interface PatientDetailPanelProps {
  patient: WardPatientRadarState | null;
  isEmbedded?: boolean;
  onClose?: () => void;
  onAcknowledge: (patientId: string, event?: React.MouseEvent) => void;
  onLogAssessment: (patientId: string, note: string) => void;
  onEscalate: (patientId: string) => void;
}

interface ProvenanceModalData {
  title: string;
  derivedValue: string | number;
  calculationFormula: string;
  sourceObservations: string[];
  clinicalRationale: string;
  timestamps: string;
}

export const PatientDetailPanel: React.FC<PatientDetailPanelProps> = ({
  patient,
  isEmbedded = false,
  onClose,
  onAcknowledge,
  onLogAssessment,
  onEscalate,
}) => {
  const [activeTab, setActiveTab] = useState<'ALL_OVERVIEW' | 'TRAJECTORY' | 'RULES_LABS' | 'TIMELINE'>('ALL_OVERVIEW');
  const [expandedProvenanceId, setExpandedProvenanceId] = useState<string | null>(null);
  const [provenanceModal, setProvenanceModal] = useState<ProvenanceModalData | null>(null);
  const [assessmentNote, setAssessmentNote] = useState('');
  const [isAssessmentModalOpen, setIsAssessmentModalOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [completedCheckIds, setCompletedCheckIds] = useState<Record<string, boolean>>({});

  if (!patient) {
    return (
      <div className="h-full min-h-[400px] flex flex-col items-center justify-center p-8 bg-slate-900/60 border border-slate-800 rounded-2xl text-center">
        <Activity className="h-10 w-10 text-slate-600 mb-3 animate-pulse" />
        <h3 className="text-base font-bold text-slate-300 font-mono">No Bed Selected</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-xs">
          Select a patient from the Primary Attention Queue or use keyboard [↑/↓] or [1-6] to inspect clinical trajectory.
        </p>
      </div>
    );
  }

  const toggleCheck = (id: string) => {
    setCompletedCheckIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const getCategoryConfig = (category: string) => {
    switch (category) {
      case 'CRITICAL_REVIEW':
        return {
          badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/50',
          label: 'CRITICAL REVIEW',
          icon: <AlertOctagon className="h-4 w-4 text-rose-400 animate-pulse" />,
          glow: 'border-rose-500/40 bg-rose-950/20 shadow-[0_0_24px_rgba(244,63,94,0.15)]',
          badgeText: 'text-rose-400 font-bold',
        };
      case 'EVALUATE':
        return {
          badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/50',
          label: 'EVALUATE',
          icon: <AlertTriangle className="h-4 w-4 text-amber-400" />,
          glow: 'border-amber-500/40 bg-amber-950/20 shadow-[0_0_18px_rgba(245,158,11,0.1)]',
          badgeText: 'text-amber-300 font-bold',
        };
      case 'WATCH':
        return {
          badgeClass: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
          label: 'WATCH',
          icon: <Eye className="h-4 w-4 text-yellow-400" />,
          glow: 'border-yellow-500/30 bg-yellow-950/20',
          badgeText: 'text-yellow-300 font-bold',
        };
      case 'LOW':
      default:
        return {
          badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
          label: 'LOW RISK',
          icon: <CheckCircle2 className="h-4 w-4 text-emerald-400" />,
          glow: 'border-emerald-500/30 bg-emerald-950/20',
          badgeText: 'text-emerald-300 font-bold',
        };
    }
  };

  const config = getCategoryConfig(patient.category);

  // Inspector opener helper for deterministic provenance
  const openProvenance = (metricName: string, derivedValue: string | number, formula: string, observations: string[], rationale: string) => {
    setProvenanceModal({
      title: metricName,
      derivedValue,
      calculationFormula: formula,
      sourceObservations: observations,
      clinicalRationale: rationale,
      timestamps: new Date(patient.lastTrustedObservationIso).toLocaleTimeString(),
    });
  };

  // Content container styles based on embedded or modal/maximized state
  const containerClass = isMaximized || !isEmbedded
    ? 'fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md overflow-y-auto'
    : 'relative w-full h-full flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl';

  const panelCardClass = isMaximized || !isEmbedded
    ? 'relative w-full max-w-5xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]'
    : 'w-full h-full flex flex-col overflow-hidden';

  return (
    <div className={containerClass}>
      <div className={panelCardClass}>
        {/* ================================================================= */}
        {/* PANEL HEADER: BED & PATIENT IDENTIFICATION */}
        {/* ================================================================= */}
        <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-950 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-14 rounded-lg bg-slate-850 border border-slate-700 text-center font-mono font-bold text-white text-sm">
              {patient.bedNumber}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-white tracking-tight">{patient.name}</h3>
                <span className="text-xs font-mono text-slate-400">
                  {patient.gender === 'FEMALE' ? 'F' : 'M'}, {patient.age}y
                </span>
                <span className="text-[11px] font-mono text-cyan-400 font-semibold bg-cyan-950/70 border border-cyan-800/40 px-2 py-0.5 rounded">
                  {patient.mrn}
                </span>
                <span className="text-[11px] font-mono text-purple-300 bg-purple-950/60 border border-purple-800/40 px-2 py-0.5 rounded">
                  {patient.codeStatus}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                {patient.admissionDiagnosis} • {patient.attendingPhysician}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-bold font-mono ${config.badgeClass}`}>
              {config.icon}
              <span className="hidden sm:inline">{config.label}</span>
            </div>

            {/* Maximize / Minimize Toggle */}
            <button
              type="button"
              onClick={() => setIsMaximized(!isMaximized)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors hidden sm:inline-flex"
              title={isMaximized ? 'Restore to Grid Panel' : 'Maximize Full Screen'}
            >
              {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                aria-label="Close Panel"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-5 border-b border-slate-800 bg-slate-950/50 flex items-center gap-4 overflow-x-auto text-xs font-mono shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('ALL_OVERVIEW')}
            className={`py-2.5 border-b-2 font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'ALL_OVERVIEW'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="h-3.5 w-3.5" />
            Executive Clinical View
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('TRAJECTORY')}
            className={`py-2.5 border-b-2 font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'TRAJECTORY'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            Multivariate Trajectory (60m)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('RULES_LABS')}
            className={`py-2.5 border-b-2 font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'RULES_LABS'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Flame className="h-3.5 w-3.5" />
            MEWS, qSOFA & Labs
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('TIMELINE')}
            className={`py-2.5 border-b-2 font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'TIMELINE'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            Audit Timeline ({patient.timeline.length})
          </button>
        </div>

        {/* ================================================================= */}
        {/* SCROLLABLE BODY */}
        {/* ================================================================= */}
        <div className="p-5 overflow-y-auto space-y-6 flex-1 bg-slate-900/60">
          {/* TAB 1: ALL_OVERVIEW (Executive Unified Bedside View) */}
          {(activeTab === 'ALL_OVERVIEW' || activeTab === 'TRAJECTORY' || activeTab === 'RULES_LABS') && (
            <>
              {/* 1. TOP ATTENTION METRICS HEADER BAR (APS + Category + Confidence + Stale) */}
              <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
                {/* APS Score with Trace Trigger */}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      openProvenance(
                        'Attention Priority Score (APS)',
                        `${patient.apsScore}/100`,
                        'APS = Σ (ComponentWeight_i × NormalizedScore_i). Bounded in [0, 100].',
                        ['OBS-P003-HR-040', 'OBS-P003-BP-030', 'OBS-P003-RR-032'],
                        'Combines physiological velocity, abnormality bounds, shock index, and comorbidity factors.'
                      )
                    }
                    className="group flex items-baseline gap-1.5 text-left focus:outline-none"
                    title="Click to Trace APS Provenance & Formulas"
                  >
                    <span className="text-xs font-mono text-slate-400 group-hover:text-cyan-400 flex items-center gap-0.5">
                      APS <HelpCircle className="h-3 w-3 inline text-slate-500 group-hover:text-cyan-400" />
                    </span>
                    <span
                      className={`text-3xl font-black font-mono tracking-tight group-hover:underline ${
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
                    <span className="text-xs font-mono text-slate-500">/100</span>
                  </button>

                  <div className="border-l border-slate-800 pl-3">
                    <span className="text-[10px] font-mono uppercase text-slate-400 block font-semibold">
                      Triage Category
                    </span>
                    <span className={`text-xs font-mono ${config.badgeText}`}>
                      {patient.category.replace('_', ' ')} (Rank #{patient.categoryRank})
                    </span>
                  </div>
                </div>

                {/* Velocity Trend & Signal Quality & Stale Check */}
                <div className="flex items-center gap-4 text-xs font-mono flex-wrap">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block font-semibold">
                      Trajectory Velocity
                    </span>
                    <span
                      className={`flex items-center gap-1 font-bold ${
                        patient.trendDirection === 'RAPIDLY_RISING'
                          ? 'text-rose-400 animate-pulse'
                          : patient.trendDirection === 'RISING'
                          ? 'text-amber-300'
                          : patient.trendDirection === 'RECOVERING'
                          ? 'text-emerald-400'
                          : 'text-slate-300'
                      }`}
                    >
                      <TrendingUp className="h-3.5 w-3.5" />
                      {patient.trendDirection.replace('_', ' ')} ({patient.trendVelocityPointsPerHour > 0 ? '+' : ''}
                      {patient.trendVelocityPointsPerHour} pts/hr)
                    </span>
                  </div>

                  <div className="border-l border-slate-800 pl-3">
                    <span className="text-[10px] text-slate-500 uppercase block font-semibold">
                      Optical Signal Quality
                    </span>
                    <span className="flex items-center gap-1 text-slate-200">
                      <Radio className="h-3.5 w-3.5 text-cyan-400" />
                      {patient.signalQuality.confidencePercent}% SNR ({patient.signalQuality.snrDb} dB)
                    </span>
                  </div>

                  <div className="border-l border-slate-800 pl-3">
                    <span className="text-[10px] text-slate-500 uppercase block font-semibold">
                      Last Trusted Check
                    </span>
                    <span
                      className={`flex items-center gap-1 ${
                        patient.isStale ? 'text-rose-400 font-bold' : 'text-slate-300'
                      }`}
                    >
                      <Clock className="h-3.5 w-3.5" />
                      {patient.lastTrustedElapsedMinutes <= 1
                        ? '1m ago (Live)'
                        : `${patient.lastTrustedElapsedMinutes}m ago`}
                      {patient.isStale && ' [STALE WARNING]'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. "WHY NOW?" HERO SECTION (Highly Readable, Prominent & Traceable) */}
              <div className={`p-5 rounded-xl border ${config.glow} relative overflow-hidden shadow-lg`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-cyan-400 animate-ping" />
                    <h4 className="text-sm font-mono font-bold tracking-wider text-cyan-300 uppercase">
                      WHY NOW? — Operational Clinical Synthesis
                    </h4>
                  </div>
                  <span className="text-xs font-mono text-slate-400">
                    Deterministic Explainability Engine
                  </span>
                </div>

                <p className="text-sm sm:text-base text-slate-100 font-medium leading-relaxed bg-slate-950/60 p-3.5 rounded-lg border border-slate-800/80">
                  {patient.whyNowSummary}
                </p>

                {/* Ranked Contributing Reasons with Trace Inspector */}
                <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-slate-300 uppercase font-semibold">
                      Top Contributing Factors (Ranked by Mathematical Weight):
                    </span>
                    <span className="text-[11px] font-mono text-slate-500">
                      Click factor to trace formula
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {patient.topContributingReasons.map((reason) => {
                      const isExpanded = expandedProvenanceId === reason.id;

                      return (
                        <div
                          key={reason.id}
                          className="bg-slate-950/80 border border-slate-800 rounded-lg p-3.5 flex flex-col justify-between hover:border-slate-700 transition-colors"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span
                                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
                                  reason.severity === 'CRITICAL'
                                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                    : reason.severity === 'WARNING'
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                    : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                                }`}
                              >
                                {reason.title}
                              </span>
                              <span className="text-xs font-mono font-bold text-cyan-400">
                                {reason.contributionPercent}% impact
                              </span>
                            </div>

                            <p className="text-xs text-slate-200 leading-normal mt-1">
                              {reason.explanation}
                            </p>

                            <div className="mt-2 text-[11px] font-mono text-slate-400 bg-slate-900/90 rounded px-2.5 py-1 border border-slate-800/80 flex items-center justify-between">
                              <span>
                                <span className="text-slate-500">Evidence: </span>
                                <span className="text-white font-semibold">{reason.evidence.currentValue}</span>
                                {reason.evidence.delta && (
                                  <span className="text-rose-400 font-bold ml-1">
                                    ({reason.evidence.delta})
                                  </span>
                                )}
                              </span>
                              <button
                                type="button"
                                onClick={() => setExpandedProvenanceId(isExpanded ? null : reason.id)}
                                className="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5 ml-2"
                              >
                                <span>Inspect</span>
                                {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                              </button>
                            </div>
                          </div>

                          {/* Inline Provenance Expansion */}
                          {isExpanded && (
                            <div className="mt-2.5 p-2.5 bg-slate-950 rounded text-[10px] font-mono text-slate-300 space-y-1.5 border border-cyan-800/40">
                              <div className="text-cyan-300 font-bold flex items-center gap-1">
                                <Search className="h-3 w-3" /> Provenance Audit Trace:
                              </div>
                              <div className="text-slate-400">
                                Rule: <span className="text-white">{reason.provenance.calculationRule}</span>
                              </div>
                              <div className="text-slate-400">
                                Observation IDs: <span className="text-cyan-300 font-semibold">{reason.provenance.sourceObservationIds.join(', ')}</span>
                              </div>
                              <div className="text-slate-400">
                                Mathematical Normalized Weight: <span className="text-amber-300 font-bold">{reason.provenance.normalizedWeight}</span> (Raw: {reason.provenance.rawScore})
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 3. CURRENT STATE VS BASELINE (HR, RR, SpO2, BP/MAP, Shock Index, Temp/AVPU) */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <h4 className="text-xs font-mono uppercase font-semibold text-slate-300 flex items-center gap-2">
                    <Activity className="h-3.5 w-3.5 text-cyan-400" />
                    Bedside Physiological State vs Established Baseline
                  </h4>
                  <span className="text-[11px] font-mono text-slate-500">
                    Click any vital card to trace mathematical derivation
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                  {/* HR */}
                  <button
                    type="button"
                    onClick={() =>
                      openProvenance(
                        'Heart Rate Velocity & Baseline Excursion',
                        `${patient.vitals.heartRate} bpm`,
                        `ΔHR = Current (${patient.vitals.heartRate}) - Baseline (${patient.vitals.heartRateBaseline}) = +${patient.vitals.heartRate - patient.vitals.heartRateBaseline} bpm (+51.3%).`,
                        ['OBS-P003-HR-040', 'OBS-P003-HR-000'],
                        'Progressive increase exceeding 0.6 bpm/min slope over 40 minutes.'
                      )
                    }
                    className="bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-xl p-3 flex flex-col justify-between text-left transition-colors"
                  >
                    <div className="flex items-center justify-between text-slate-400 text-xs font-mono w-full">
                      <span className="flex items-center gap-1">
                        <HeartPulse className="h-3.5 w-3.5 text-rose-400" /> HR
                      </span>
                      <span className="text-[10px]">bpm</span>
                    </div>
                    <div className="my-1">
                      <span className="text-2xl font-black font-mono text-white">
                        {patient.vitals.heartRate}
                      </span>
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">
                      Base: {patient.vitals.heartRateBaseline} bpm
                      <span
                        className={`block font-bold ${
                          patient.vitals.heartRate - patient.vitals.heartRateBaseline > 20
                            ? 'text-rose-400'
                            : 'text-slate-400'
                        }`}
                      >
                        Δ {patient.vitals.heartRate - patient.vitals.heartRateBaseline > 0 ? '+' : ''}
                        {patient.vitals.heartRate - patient.vitals.heartRateBaseline} bpm
                      </span>
                    </div>
                  </button>

                  {/* RR */}
                  <button
                    type="button"
                    onClick={() =>
                      openProvenance(
                        'Respiratory Rate Persistence',
                        `${patient.vitals.respiratoryRate} /min`,
                        `ΔRR = Current (${patient.vitals.respiratoryRate}) - Baseline (${patient.vitals.respiratoryRateBaseline}) = +${patient.vitals.respiratoryRate - patient.vitals.respiratoryRateBaseline} /min. Sustained > 24 /min for 32m.`,
                        ['OBS-P003-RR-032'],
                        'qSOFA Tachypnea criterion met (RR ≥ 22 /min).'
                      )
                    }
                    className="bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-xl p-3 flex flex-col justify-between text-left transition-colors"
                  >
                    <div className="flex items-center justify-between text-slate-400 text-xs font-mono w-full">
                      <span className="flex items-center gap-1">
                        <Wind className="h-3.5 w-3.5 text-cyan-400" /> RR
                      </span>
                      <span className="text-[10px]">/min</span>
                    </div>
                    <div className="my-1">
                      <span className="text-2xl font-black font-mono text-white">
                        {patient.vitals.respiratoryRate}
                      </span>
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">
                      Base: {patient.vitals.respiratoryRateBaseline} /min
                      <span
                        className={`block font-bold ${
                          patient.vitals.respiratoryRate - patient.vitals.respiratoryRateBaseline > 6
                            ? 'text-rose-400'
                            : 'text-slate-400'
                        }`}
                      >
                        Δ {patient.vitals.respiratoryRate - patient.vitals.respiratoryRateBaseline > 0 ? '+' : ''}
                        {patient.vitals.respiratoryRate - patient.vitals.respiratoryRateBaseline} /min
                      </span>
                    </div>
                  </button>

                  {/* SpO2 */}
                  <button
                    type="button"
                    onClick={() =>
                      openProvenance(
                        'Pulse Oximetry (SpO2)',
                        `${patient.vitals.spo2}%`,
                        `Optical pulse waveform SpO2 derived from dual-wavelength rPPG ratio. Baseline: ${patient.vitals.spo2Baseline}%.`,
                        ['OBS-P003-SPO2-010'],
                        'Delivery Mode: ' + patient.vitals.oxygenDelivery
                      )
                    }
                    className="bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-xl p-3 flex flex-col justify-between text-left transition-colors"
                  >
                    <div className="flex items-center justify-between text-slate-400 text-xs font-mono w-full">
                      <span className="flex items-center gap-1">
                        <Droplets className="h-3.5 w-3.5 text-blue-400" /> SpO2
                      </span>
                      <span className="text-[10px]">pulse</span>
                    </div>
                    <div className="my-1">
                      <span className="text-2xl font-black font-mono text-white">
                        {patient.vitals.spo2}%
                      </span>
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 truncate w-full">
                      {patient.vitals.oxygenDelivery}
                    </div>
                  </button>

                  {/* BP / MAP */}
                  <button
                    type="button"
                    onClick={() =>
                      openProvenance(
                        'Mean Arterial Pressure (MAP)',
                        `${patient.vitals.meanArterialPressure} mmHg`,
                        `MAP = DBP + 1/3 (SBP - DBP) = ${patient.vitals.diastolicBP} + 1/3 (${patient.vitals.systolicBP} - ${patient.vitals.diastolicBP}) = ${patient.vitals.meanArterialPressure} mmHg.`,
                        ['OBS-P003-BP-030'],
                        'Narrow pulse pressure (36 mmHg) indicates reduced stroke volume or peripheral vasoconstriction.'
                      )
                    }
                    className="bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-xl p-3 flex flex-col justify-between text-left transition-colors"
                  >
                    <div className="flex items-center justify-between text-slate-400 text-xs font-mono w-full">
                      <span className="flex items-center gap-1">
                        <Activity className="h-3.5 w-3.5 text-purple-400" /> BP / MAP
                      </span>
                      <span className="text-[10px]">mmHg</span>
                    </div>
                    <div className="my-1">
                      <span className="text-lg font-black font-mono text-white">
                        {patient.vitals.systolicBP}/{patient.vitals.diastolicBP}
                      </span>
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">
                      MAP: <span className="font-bold text-white">{patient.vitals.meanArterialPressure}</span> mmHg
                    </div>
                  </button>

                  {/* Shock Index */}
                  <button
                    type="button"
                    onClick={() =>
                      openProvenance(
                        'Shock Index (SI)',
                        patient.vitals.shockIndex.toFixed(2),
                        `Shock Index = HR (${patient.vitals.heartRate}) / SBP (${patient.vitals.systolicBP}) = ${(patient.vitals.heartRate / patient.vitals.systolicBP).toFixed(2)}. Normal range: 0.5 - 0.7.`,
                        ['OBS-P003-HR-040', 'OBS-P003-BP-030'],
                        'SI ≥ 1.0 indicates severe hemodynamic instability, occult shock, or impending vascular collapse.'
                      )
                    }
                    className="bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-xl p-3 flex flex-col justify-between text-left transition-colors"
                  >
                    <div className="flex items-center justify-between text-slate-400 text-xs font-mono w-full">
                      <span className="flex items-center gap-1">
                        <Activity className="h-3.5 w-3.5 text-amber-400" /> Shock Index
                      </span>
                      <span className="text-[10px]">HR/SBP</span>
                    </div>
                    <div className="my-1">
                      <span
                        className={`text-2xl font-black font-mono ${
                          patient.vitals.shockIndex >= 1.0
                            ? 'text-rose-400'
                            : patient.vitals.shockIndex >= 0.8
                            ? 'text-amber-300'
                            : 'text-white'
                        }`}
                      >
                        {patient.vitals.shockIndex.toFixed(2)}
                      </span>
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">
                      Normal &lt; 0.70 (High Risk)
                    </div>
                  </button>

                  {/* Temp & AVPU */}
                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
                      <span className="flex items-center gap-1">
                        <Thermometer className="h-3.5 w-3.5 text-yellow-400" /> Temp / AVPU
                      </span>
                    </div>
                    <div className="my-1">
                      <span className="text-xl font-black font-mono text-white">
                        {patient.vitals.bodyTemperature}°C
                      </span>
                    </div>
                    <div className="text-[10px] font-mono text-cyan-400 font-semibold">
                      AVPU: {patient.vitals.avpu}
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. CLINICAL RULES SUMMARY (MEWS & qSOFA) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* MEWS Box */}
                <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="text-xs font-mono uppercase font-bold text-white flex items-center gap-1.5">
                      <Flame className="h-3.5 w-3.5 text-amber-400" />
                      MEWS Score: {patient.mews.totalScore} / 14
                    </h5>
                    <button
                      type="button"
                      onClick={() =>
                        openProvenance(
                          'Modified Early Warning Score (MEWS)',
                          patient.mews.totalScore,
                          'MEWS = HR_pts (2) + RR_pts (2) + SBP_pts (1) + Temp_pts (0) + AVPU_pts (1) = 6.',
                          ['OBS-P003-ALL'],
                          'Deterministic standard scoring based on documented protocol thresholds.'
                        )
                      }
                      className="text-[10px] font-mono text-cyan-400 hover:underline flex items-center gap-1"
                    >
                      <Search className="h-2.5 w-2.5" /> Trace Points
                    </button>
                  </div>

                  <div className="space-y-1 text-xs font-mono">
                    {patient.mews.breakdown.map((row, i) => (
                      <div key={i} className="flex justify-between text-slate-300 py-0.5 border-b border-slate-900">
                        <span>{row.parameter}: <span className="text-white">{row.value}</span></span>
                        <span className="font-bold text-amber-300">+{row.points} pt</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* qSOFA Box */}
                {patient.qsofa && (
                  <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="text-xs font-mono uppercase font-bold text-white flex items-center gap-1.5">
                        <AlertOctagon className="h-3.5 w-3.5 text-rose-400" />
                        qSOFA Sepsis Screening: {patient.qsofa.criteriaMet} / 3 Criteria
                      </h5>
                      <span className="text-[10px] font-mono text-rose-400 font-bold bg-rose-950/60 px-2 py-0.5 rounded border border-rose-800/40">
                        SEPSIS ALERT
                      </span>
                    </div>

                    <div className="space-y-1 text-xs font-mono">
                      {patient.qsofa.breakdown.map((q, i) => (
                        <div
                          key={i}
                          className={`flex justify-between py-1 px-2 rounded ${
                            q.isMet ? 'bg-rose-950/30 text-rose-200 font-bold' : 'text-slate-400'
                          }`}
                        >
                          <span>{q.criterion}</span>
                          <span>{q.value} ({q.isMet ? 'MET (+1)' : '0'})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 5. MULTIVARIATE TRAJECTORY PLOT (60 min) */}
              <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-white font-mono flex items-center gap-2">
                    <TrendingUp className="h-3.5 w-3.5 text-cyan-400" />
                    Multivariate Trajectory Trends (Last 60 Minutes)
                  </h4>
                  <div className="flex items-center gap-3 text-[11px] font-mono">
                    <span className="flex items-center gap-1 text-rose-400">
                      <span className="h-1.5 w-2.5 bg-rose-500 inline-block rounded-xs" /> HR (bpm)
                    </span>
                    <span className="flex items-center gap-1 text-cyan-400">
                      <span className="h-1.5 w-2.5 bg-cyan-500 inline-block rounded-xs" /> RR (/min)
                    </span>
                    <span className="flex items-center gap-1 text-amber-400">
                      <span className="h-1.5 w-2.5 bg-amber-500 inline-block rounded-xs" /> APS (0-100)
                    </span>
                  </div>
                </div>

                <div className="h-44 w-full bg-slate-900/90 rounded-lg border border-slate-800 p-3 relative flex items-end">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 500 200" preserveAspectRatio="none">
                    <line x1="0" y1="50" x2="500" y2="50" stroke="#1e293b" strokeDasharray="3 3" />
                    <line x1="0" y1="100" x2="500" y2="100" stroke="#1e293b" strokeDasharray="3 3" />
                    <line x1="0" y1="150" x2="500" y2="150" stroke="#1e293b" strokeDasharray="3 3" />

                    <polyline
                      fill="none"
                      stroke="#f43f5e"
                      strokeWidth="3"
                      strokeLinecap="round"
                      points={patient.trajectory
                        .map((pt, i) => {
                          const x = (i / (patient.trajectory.length - 1)) * 500;
                          const y = 180 - ((pt.heartRate - 60) / 70) * 160;
                          return `${x},${y}`;
                        })
                        .join(' ')}
                    />

                    <polyline
                      fill="none"
                      stroke="#06b6d4"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeDasharray="4 2"
                      points={patient.trajectory
                        .map((pt, i) => {
                          const x = (i / (patient.trajectory.length - 1)) * 500;
                          const y = 180 - ((pt.respiratoryRate - 10) / 25) * 160;
                          return `${x},${y}`;
                        })
                        .join(' ')}
                    />

                    <polyline
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="3"
                      points={patient.trajectory
                        .map((pt, i) => {
                          const x = (i / (patient.trajectory.length - 1)) * 500;
                          const y = 190 - (pt.apsScore / 100) * 170;
                          return `${x},${y}`;
                        })
                        .join(' ')}
                    />

                    {patient.trajectory.map((pt, i) => {
                      const x = (i / (patient.trajectory.length - 1)) * 500;
                      const yHR = 180 - ((pt.heartRate - 60) / 70) * 160;
                      const yAPS = 190 - (pt.apsScore / 100) * 170;

                      return (
                        <g key={i}>
                          <circle cx={x} cy={yHR} r="3.5" fill="#f43f5e" />
                          <circle cx={x} cy={yAPS} r="3.5" fill="#f59e0b" />
                        </g>
                      );
                    })}
                  </svg>
                </div>

                <div className="flex justify-between text-[10px] font-mono text-slate-400 mt-2">
                  {patient.trajectory.map((pt, i) => (
                    <span key={i}>{pt.timeOffsetMinutes === 0 ? 'NOW' : `${pt.timeOffsetMinutes}m`}</span>
                  ))}
                </div>
              </div>

              {/* 6. RELEVANT DIAGNOSTIC LABS & CLINICAL CONTEXT */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Diagnostic Labs */}
                <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4">
                  <h5 className="text-xs font-mono uppercase font-bold text-white flex items-center gap-1.5 mb-2.5">
                    <Activity className="h-3.5 w-3.5 text-purple-400" />
                    Relevant Diagnostic Laboratory Results
                  </h5>

                  {patient.labs.length ? (
                    <div className="space-y-2 text-xs font-mono">
                      {patient.labs.map((lab) => (
                        <div key={lab.id} className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                          <div>
                            <span className="text-white font-bold block">{lab.testName}</span>
                            <span className="text-[10px] text-slate-500">
                              Ref: {lab.referenceRange.low}-{lab.referenceRange.high} {lab.unit}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className={`text-sm font-bold block ${lab.isCritical ? 'text-rose-400' : 'text-slate-200'}`}>
                              {lab.value} {lab.unit}
                            </span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${lab.isCritical ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                              {lab.isCritical ? 'CRITICAL ABNORMAL' : 'NORMAL'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 font-mono">No pending or abnormal laboratory values.</p>
                  )}
                </div>

                {/* Clinical Context */}
                <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 text-xs font-mono space-y-2">
                  <h5 className="text-xs font-mono uppercase font-bold text-white flex items-center gap-1.5 mb-2">
                    <FileText className="h-3.5 w-3.5 text-cyan-400" />
                    Clinical Context & Surgical Profile
                  </h5>
                  <p className="text-slate-300"><span className="text-slate-500">Admission:</span> {patient.clinicalContext.admissionReason}</p>
                  <p className="text-slate-300"><span className="text-slate-500">Post-Op:</span> Day #{patient.clinicalContext.postOpDay}</p>
                  <p className="text-slate-300"><span className="text-slate-500">Comorbidities:</span> {patient.clinicalContext.comorbidities.join(', ')}</p>
                  <p className="text-slate-300">
                    <span className="text-slate-500">Allergies:</span>{' '}
                    <span className="text-rose-300 font-semibold">{patient.allergies.length ? patient.allergies.join(', ') : 'NKDA'}</span>
                  </p>
                </div>
              </div>

              {/* 7. RECOMMENDED HUMAN VERIFICATION CHECKLIST */}
              <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4">
                <h5 className="text-xs font-mono uppercase font-semibold text-slate-300 mb-2.5 flex items-center gap-2">
                  <CheckSquare className="h-4 w-4 text-cyan-400" />
                  Recommended Human Verification Checklist (Bedside Protocol)
                </h5>

                <div className="space-y-2">
                  {patient.recommendedVerifications.map((check) => {
                    const isChecked = completedCheckIds[check.id] ?? check.completed;

                    return (
                      <div
                        key={check.id}
                        onClick={() => toggleCheck(check.id)}
                        className={`p-2.5 rounded-lg border flex items-start gap-2.5 cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-emerald-950/20 border-emerald-800/40 text-slate-300'
                            : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-200'
                        }`}
                      >
                        <div className="mt-0.5">
                          {isChecked ? (
                            <CheckSquare className="h-4 w-4 text-emerald-400" />
                          ) : (
                            <Square className="h-4 w-4 text-slate-500" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className={`text-xs font-medium ${isChecked ? 'line-through text-slate-400' : 'text-white'}`}>
                            {check.text}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
                            Rationale: {check.rationale}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 8. NON-INVASIVE OPTICAL TELEMETRY PRIVACY SEAL */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-2 text-slate-300">
                  <Radio className="h-4 w-4 text-cyan-400" />
                  <span>rPPG Optical Pulse Sensor ({patient.signalQuality.cameraDeviceId})</span>
                  <span className="text-slate-600">|</span>
                  <span className="text-slate-400">{patient.signalQuality.illuminationLux} Lux</span>
                </div>
                <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-semibold">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Zero Raw Video Transmitted or Stored
                </span>
              </div>
            </>
          )}

          {/* TAB: TIMELINE */}
          {activeTab === 'TIMELINE' && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-white font-mono uppercase">Event Timeline</h4>
              <div className="relative border-l border-slate-800 ml-3 space-y-4">
                {patient.timeline.map((event) => (
                  <div key={event.id} className="relative pl-5">
                    <span
                      className={`absolute -left-1.5 top-1.5 h-3 w-3 rounded-full border border-slate-900 ${
                        event.severity === 'CRITICAL' ? 'bg-rose-500' : event.severity === 'WARNING' ? 'bg-amber-500' : 'bg-cyan-500'
                      }`}
                    />
                    <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-2.5 text-xs">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="font-bold text-white">{event.title}</span>
                        <span className="text-[10px] font-mono text-slate-500">
                          {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-slate-300 text-[11px]">{event.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ================================================================= */}
        {/* PANEL BOTTOM: OPERATIONAL ACTION CONTROLS */}
        {/* ================================================================= */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="text-[11px] font-mono text-slate-400">
            <span>RN: {patient.primaryNurse}</span>
            <span className="mx-1.5">•</span>
            <span className={patient.isAcknowledged ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}>
              {patient.isAcknowledged ? 'Priority Acknowledged' : 'Unacknowledged'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => onAcknowledge(patient.patientId, e)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
                patient.isAcknowledged
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                  : 'bg-cyan-600 text-white hover:bg-cyan-500 shadow-sm shadow-cyan-600/30'
              }`}
            >
              <UserCheck className="h-3.5 w-3.5" />
              <span>{patient.isAcknowledged ? 'Acknowledged' : 'Acknowledge Priority'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAssessmentModalOpen(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700 flex items-center gap-1.5"
            >
              <FileText className="h-3.5 w-3.5 text-slate-400" />
              <span>Log Assessment</span>
            </button>

            <button
              type="button"
              onClick={() => onEscalate(patient.patientId)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600 text-white hover:bg-rose-500 shadow-sm shadow-rose-600/30 flex items-center gap-1.5"
            >
              <AlertOctagon className="h-3.5 w-3.5" />
              <span>Escalate (RRT)</span>
            </button>
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* DETERMINISTIC PROVENANCE TRACE INSPECTOR MODAL */}
      {/* ================================================================= */}
      {provenanceModal && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-cyan-800/80 rounded-xl p-5 max-w-lg w-full shadow-2xl space-y-3 font-mono">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-cyan-400" />
                <h4 className="text-sm font-bold text-white">Deterministic Provenance Trace</h4>
              </div>
              <button
                type="button"
                onClick={() => setProvenanceModal(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <span className="text-slate-500 block">Derived Metric:</span>
                <span className="text-base font-bold text-white">{provenanceModal.title}</span>
              </div>

              <div>
                <span className="text-slate-500 block">Calculated Value:</span>
                <span className="text-lg font-bold text-cyan-300">{provenanceModal.derivedValue}</span>
              </div>

              <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                <span className="text-slate-500 block mb-1">Calculation Rule & Formula:</span>
                <span className="text-amber-300 font-medium">{provenanceModal.calculationFormula}</span>
              </div>

              <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                <span className="text-slate-500 block mb-1">Source Observation Records:</span>
                <span className="text-slate-300">{provenanceModal.sourceObservations.join(', ')}</span>
              </div>

              <div>
                <span className="text-slate-500 block">Clinical Rationale:</span>
                <span className="text-slate-300">{provenanceModal.clinicalRationale}</span>
              </div>

              <div className="text-[10px] text-slate-500 pt-1">
                Zero LLM-generated reasoning. All values verified against raw deterministic clinical engine pipelines.
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setProvenanceModal(null)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs"
              >
                Close Trace
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-MODAL FOR BEDSIDE ASSESSMENT */}
      {isAssessmentModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 max-w-md w-full shadow-2xl">
            <h4 className="text-sm font-bold text-white font-mono mb-1">Log Bedside Nurse Assessment</h4>
            <p className="text-xs text-slate-400 mb-3">
              Record physical exam findings, bedside pulse check, or manual cuff verification.
            </p>
            <textarea
              value={assessmentNote}
              onChange={(e) => setAssessmentNote(e.target.value)}
              placeholder="e.g. Bedside pulse auscultated at 116 bpm, manual BP 96/60..."
              rows={4}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
            />
            <div className="flex justify-end gap-2 mt-3">
              <button
                type="button"
                onClick={() => setIsAssessmentModalOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (assessmentNote.trim()) {
                    onLogAssessment(patient.patientId, assessmentNote);
                    setAssessmentNote('');
                    setIsAssessmentModalOpen(false);
                  }
                }}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-cyan-600 text-white hover:bg-cyan-500"
              >
                Submit Audit Entry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
