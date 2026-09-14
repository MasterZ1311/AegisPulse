import React, { useState } from 'react';
import {
  X,
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
} from 'lucide-react';
import type { WardPatientRadarState } from '../types/radar';

interface PatientDetailModalProps {
  patient: WardPatientRadarState | null;
  onClose: () => void;
  onAcknowledge: (patientId: string) => void;
  onLogAssessment: (patientId: string, note: string) => void;
  onEscalate: (patientId: string) => void;
}

export const PatientDetailModal: React.FC<PatientDetailModalProps> = ({
  patient,
  onClose,
  onAcknowledge,
  onLogAssessment,
  onEscalate,
}) => {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'VITALS_TRAJECTORY' | 'CLINICAL_RULES' | 'LABS_CONTEXT' | 'TIMELINE'>('OVERVIEW');
  const [expandedProvenanceId, setExpandedProvenanceId] = useState<string | null>(null);
  const [assessmentNote, setAssessmentNote] = useState('');
  const [isAssessmentModalOpen, setIsAssessmentModalOpen] = useState(false);
  const [completedCheckIds, setCompletedCheckIds] = useState<Record<string, boolean>>({});

  if (!patient) return null;

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
          glow: 'border-rose-500/40 bg-rose-950/20',
        };
      case 'EVALUATE':
        return {
          badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/50',
          label: 'EVALUATE',
          icon: <AlertTriangle className="h-4 w-4 text-amber-400" />,
          glow: 'border-amber-500/40 bg-amber-950/20',
        };
      case 'WATCH':
        return {
          badgeClass: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
          label: 'WATCH',
          icon: <Eye className="h-4 w-4 text-yellow-400" />,
          glow: 'border-yellow-500/30 bg-yellow-950/20',
        };
      case 'LOW':
      default:
        return {
          badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
          label: 'LOW RISK',
          icon: <CheckCircle2 className="h-4 w-4 text-emerald-400" />,
          glow: 'border-emerald-500/30 bg-emerald-950/20',
        };
    }
  };

  const config = getCategoryConfig(patient.category);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Patient Attention Detail: ${patient.name}`}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md overflow-y-auto"
    >
      <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Top Header Bar */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-14 rounded-lg bg-slate-850 border border-slate-700 text-center font-mono font-bold text-white text-sm">
              {patient.bedNumber}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-white tracking-tight">{patient.name}</h2>
                <span className="text-xs font-mono text-slate-400">
                  {patient.gender === 'FEMALE' ? 'Female' : 'Male'}, {patient.age}y
                </span>
                <span className="text-xs font-mono text-cyan-400 font-semibold bg-cyan-950/70 border border-cyan-800/40 px-2 py-0.5 rounded">
                  {patient.mrn}
                </span>
                <span className="text-xs font-mono text-purple-300 bg-purple-950/60 border border-purple-800/40 px-2 py-0.5 rounded">
                  {patient.codeStatus}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {patient.admissionDiagnosis} • Attending: {patient.attendingPhysician}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-md border text-xs font-bold font-mono ${config.badgeClass}`}>
              {config.icon}
              <span>{config.label}</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              aria-label="Close Patient Detail Modal (Escape)"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 border-b border-slate-800 bg-slate-950/50 flex items-center gap-4 overflow-x-auto text-xs font-mono">
          <button
            type="button"
            onClick={() => setActiveTab('OVERVIEW')}
            className={`py-2.5 border-b-2 font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'OVERVIEW'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="h-3.5 w-3.5" />
            Why Now & Vitals
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('VITALS_TRAJECTORY')}
            className={`py-2.5 border-b-2 font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'VITALS_TRAJECTORY'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            Trajectory Trends
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('CLINICAL_RULES')}
            className={`py-2.5 border-b-2 font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'CLINICAL_RULES'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Flame className="h-3.5 w-3.5" />
            MEWS & qSOFA
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('LABS_CONTEXT')}
            className={`py-2.5 border-b-2 font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'LABS_CONTEXT'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            Labs & Context
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('TIMELINE')}
            className={`py-2.5 border-b-2 font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'TIMELINE'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            Event Timeline ({patient.timeline.length})
          </button>
        </div>

        {/* Modal Scrollable Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-900/60">
          {/* ================================================================= */}
          {/* TAB: OVERVIEW */}
          {/* ================================================================= */}
          {activeTab === 'OVERVIEW' && (
            <>
              {/* 1. "WHY NOW?" Hero Card */}
              <div className={`p-5 rounded-xl border ${config.glow} relative overflow-hidden shadow-lg`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-cyan-400 animate-ping" />
                    <h3 className="text-sm font-mono font-bold tracking-wider text-cyan-300 uppercase">
                      WHY NOW? — Clinical Attention Synthesis
                    </h3>
                  </div>
                  <span className="text-xs font-mono text-slate-400">
                    APS Rank #{patient.categoryRank} in Ward
                  </span>
                </div>

                <p className="text-sm sm:text-base text-slate-100 font-medium leading-relaxed">
                  {patient.whyNowSummary}
                </p>

                {/* Contributing Reasons Breakdown */}
                <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-3">
                  <span className="text-xs font-mono text-slate-400 uppercase font-semibold block">
                    Ranked Contributing Factors (Deterministic Explainability Engine):
                  </span>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {patient.topContributingReasons.map((reason) => {
                      const isExpanded = expandedProvenanceId === reason.id;

                      return (
                        <div
                          key={reason.id}
                          className="bg-slate-950/70 border border-slate-800 rounded-lg p-3.5 flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-1.5">
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
                              <span className="text-xs font-mono font-semibold text-cyan-400">
                                {reason.contributionPercent}% impact
                              </span>
                            </div>

                            <p className="text-xs text-slate-200 leading-normal">
                              {reason.explanation}
                            </p>

                            <div className="mt-2 text-[11px] font-mono text-slate-400 bg-slate-900/90 rounded px-2 py-1 border border-slate-800/60">
                              <span className="text-slate-500">Evidence: </span>
                              <span className="text-white">{reason.evidence.currentValue}</span>
                              {reason.evidence.delta && (
                                <span className="text-rose-400 font-bold ml-1">
                                  ({reason.evidence.delta})
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Provenance Trace Inspector */}
                          <div className="mt-2 pt-2 border-t border-slate-800/60">
                            <button
                              type="button"
                              onClick={() => setExpandedProvenanceId(isExpanded ? null : reason.id)}
                              className="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                            >
                              <span>Provenance Trace</span>
                              {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            </button>

                            {isExpanded && (
                              <div className="mt-2 p-2 bg-slate-950 rounded text-[10px] font-mono text-slate-300 space-y-1 border border-slate-800">
                                <div className="text-slate-400">
                                  Rule: <span className="text-white">{reason.provenance.calculationRule}</span>
                                </div>
                                <div className="text-slate-400">
                                  Observations: <span className="text-cyan-300">{reason.provenance.sourceObservationIds.join(', ')}</span>
                                </div>
                                <div className="text-slate-400">
                                  Weights: Raw={reason.provenance.rawScore}, NormWeight={reason.provenance.normalizedWeight}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 2. Primary Vitals Matrix */}
              <div>
                <h4 className="text-xs font-mono uppercase font-semibold text-slate-400 mb-3 flex items-center gap-2">
                  <Activity className="h-3.5 w-3.5 text-cyan-400" />
                  Current Vital Signs vs Established Baseline
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {/* HR */}
                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
                      <span className="flex items-center gap-1">
                        <HeartPulse className="h-3.5 w-3.5 text-rose-400" /> HR
                      </span>
                      <span className="text-[10px]">bpm</span>
                    </div>
                    <div className="my-1.5">
                      <span className="text-2xl font-black font-mono text-white">
                        {patient.vitals.heartRate}
                      </span>
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">
                      Baseline: {patient.vitals.heartRateBaseline} bpm
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
                  </div>

                  {/* RR */}
                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
                      <span className="flex items-center gap-1">
                        <Wind className="h-3.5 w-3.5 text-cyan-400" /> RR
                      </span>
                      <span className="text-[10px]">/min</span>
                    </div>
                    <div className="my-1.5">
                      <span className="text-2xl font-black font-mono text-white">
                        {patient.vitals.respiratoryRate}
                      </span>
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">
                      Baseline: {patient.vitals.respiratoryRateBaseline} /min
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
                  </div>

                  {/* SpO2 */}
                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
                      <span className="flex items-center gap-1">
                        <Droplets className="h-3.5 w-3.5 text-blue-400" /> SpO2
                      </span>
                      <span className="text-[10px]">pulse</span>
                    </div>
                    <div className="my-1.5">
                      <span className="text-2xl font-black font-mono text-white">
                        {patient.vitals.spo2}%
                      </span>
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">
                      {patient.vitals.oxygenDelivery}
                    </div>
                  </div>

                  {/* Blood Pressure & MAP */}
                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
                      <span className="flex items-center gap-1">
                        <Activity className="h-3.5 w-3.5 text-purple-400" /> BP / MAP
                      </span>
                      <span className="text-[10px]">mmHg</span>
                    </div>
                    <div className="my-1.5">
                      <span className="text-lg font-black font-mono text-white">
                        {patient.vitals.systolicBP}/{patient.vitals.diastolicBP}
                      </span>
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">
                      MAP: <span className="font-bold text-white">{patient.vitals.meanArterialPressure}</span> mmHg
                    </div>
                  </div>

                  {/* Shock Index */}
                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
                      <span className="flex items-center gap-1">
                        <Activity className="h-3.5 w-3.5 text-amber-400" /> Shock Index
                      </span>
                      <span className="text-[10px]">HR/SBP</span>
                    </div>
                    <div className="my-1.5">
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
                      Target &lt; 0.70
                    </div>
                  </div>

                  {/* Temp & AVPU */}
                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
                      <span className="flex items-center gap-1">
                        <Thermometer className="h-3.5 w-3.5 text-yellow-400" /> Temp / AVPU
                      </span>
                    </div>
                    <div className="my-1.5">
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

              {/* 3. Non-Invasive Optical Signal Quality */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <Radio className="h-4 w-4 text-cyan-400" />
                    <h4 className="text-xs font-mono uppercase font-semibold text-white">
                      Non-Invasive Optical rPPG Telemetry
                    </h4>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>Zero Raw Video Transmitted or Stored</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Signal Confidence</span>
                    <span className="text-base font-bold text-white">
                      {patient.signalQuality.confidencePercent}%
                    </span>
                  </div>

                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Pulse SNR</span>
                    <span className="text-base font-bold text-cyan-300">
                      {patient.signalQuality.snrDb} dB
                    </span>
                  </div>

                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Motion Artifact</span>
                    <span
                      className={`text-base font-bold ${
                        patient.signalQuality.motionDetected ? 'text-amber-400' : 'text-emerald-400'
                      }`}
                    >
                      {patient.signalQuality.motionDetected ? 'Motion Detected' : 'Minimal (0.04)'}
                    </span>
                  </div>

                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Ambient Light</span>
                    <span className="text-base font-bold text-white">
                      {patient.signalQuality.illuminationLux} Lux (Optimal)
                    </span>
                  </div>
                </div>
              </div>

              {/* 4. Recommended Human Verification Checklist */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4">
                <h4 className="text-xs font-mono uppercase font-semibold text-slate-300 mb-3 flex items-center gap-2">
                  <CheckSquare className="h-4 w-4 text-cyan-400" />
                  Recommended Human Verification Checklist
                </h4>

                <div className="space-y-2">
                  {patient.recommendedVerifications.map((check) => {
                    const isChecked = completedCheckIds[check.id] ?? check.completed;

                    return (
                      <div
                        key={check.id}
                        onClick={() => toggleCheck(check.id)}
                        className={`p-3 rounded-lg border flex items-start gap-3 cursor-pointer transition-colors ${
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
                          <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                            Rationale: {check.rationale}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* ================================================================= */}
          {/* TAB: VITALS TRAJECTORY TRENDS */}
          {/* ================================================================= */}
          {activeTab === 'VITALS_TRAJECTORY' && (
            <div className="space-y-6">
              <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-cyan-400" />
                    Multivariate Physiological Trajectory (Last 60 Minutes)
                  </h3>
                  <div className="flex items-center gap-4 text-xs font-mono">
                    <span className="flex items-center gap-1.5 text-rose-400">
                      <span className="h-2 w-3 bg-rose-500 inline-block rounded-xs" /> Heart Rate (bpm)
                    </span>
                    <span className="flex items-center gap-1.5 text-cyan-400">
                      <span className="h-2 w-3 bg-cyan-500 inline-block rounded-xs" /> Resp Rate (/min)
                    </span>
                    <span className="flex items-center gap-1.5 text-amber-400">
                      <span className="h-2 w-3 bg-amber-500 inline-block rounded-xs" /> APS Score (0-100)
                    </span>
                  </div>
                </div>

                {/* SVG Sparkline & Trajectory Plot */}
                <div className="h-64 w-full bg-slate-900/90 rounded-lg border border-slate-800 p-4 relative flex items-end">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 500 200" preserveAspectRatio="none">
                    {/* Grid lines */}
                    <line x1="0" y1="50" x2="500" y2="50" stroke="#1e293b" strokeDasharray="3 3" />
                    <line x1="0" y1="100" x2="500" y2="100" stroke="#1e293b" strokeDasharray="3 3" />
                    <line x1="0" y1="150" x2="500" y2="150" stroke="#1e293b" strokeDasharray="3 3" />

                    {/* HR Trajectory Line */}
                    <polyline
                      fill="none"
                      stroke="#f43f5e"
                      strokeWidth="3"
                      strokeLinecap="round"
                      points={patient.trajectory
                        .map((pt, i) => {
                          const x = (i / (patient.trajectory.length - 1)) * 500;
                          // Scale HR: 60 = 180, 130 = 20
                          const y = 180 - ((pt.heartRate - 60) / 70) * 160;
                          return `${x},${y}`;
                        })
                        .join(' ')}
                    />

                    {/* RR Trajectory Line */}
                    <polyline
                      fill="none"
                      stroke="#06b6d4"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeDasharray="4 2"
                      points={patient.trajectory
                        .map((pt, i) => {
                          const x = (i / (patient.trajectory.length - 1)) * 500;
                          // Scale RR: 10 = 180, 35 = 20
                          const y = 180 - ((pt.respiratoryRate - 10) / 25) * 160;
                          return `${x},${y}`;
                        })
                        .join(' ')}
                    />

                    {/* APS Trajectory Line */}
                    <polyline
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="3"
                      points={patient.trajectory
                        .map((pt, i) => {
                          const x = (i / (patient.trajectory.length - 1)) * 500;
                          // Scale APS: 0 = 190, 100 = 10
                          const y = 190 - (pt.apsScore / 100) * 170;
                          return `${x},${y}`;
                        })
                        .join(' ')}
                    />

                    {/* Data Points */}
                    {patient.trajectory.map((pt, i) => {
                      const x = (i / (patient.trajectory.length - 1)) * 500;
                      const yHR = 180 - ((pt.heartRate - 60) / 70) * 160;
                      const yAPS = 190 - (pt.apsScore / 100) * 170;

                      return (
                        <g key={i}>
                          <circle cx={x} cy={yHR} r="4" fill="#f43f5e" />
                          <circle cx={x} cy={yAPS} r="4" fill="#f59e0b" />
                        </g>
                      );
                    })}
                  </svg>
                </div>

                {/* X-Axis Timeline Labels */}
                <div className="flex justify-between text-[11px] font-mono text-slate-400 mt-2 px-1">
                  {patient.trajectory.map((pt, i) => (
                    <span key={i}>{pt.timeOffsetMinutes === 0 ? 'NOW' : `${pt.timeOffsetMinutes}m`}</span>
                  ))}
                </div>
              </div>

              {/* Numerical Trajectory Data Table */}
              <div className="bg-slate-950/90 border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="p-3">Time Offset</th>
                      <th className="p-3">APS Score</th>
                      <th className="p-3">Heart Rate</th>
                      <th className="p-3">Resp Rate</th>
                      <th className="p-3">Blood Pressure</th>
                      <th className="p-3">SpO2</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {patient.trajectory.map((pt, i) => (
                      <tr key={i} className="hover:bg-slate-900/50">
                        <td className="p-3 text-slate-300 font-bold">
                          {pt.timeOffsetMinutes === 0 ? 'NOW (Latest)' : `${pt.timeOffsetMinutes} mins ago`}
                        </td>
                        <td className="p-3 text-amber-300 font-bold">{pt.apsScore}</td>
                        <td className="p-3 text-rose-300">{pt.heartRate} bpm</td>
                        <td className="p-3 text-cyan-300">{pt.respiratoryRate} /min</td>
                        <td className="p-3 text-slate-300">{pt.systolicBP}/{pt.diastolicBP}</td>
                        <td className="p-3 text-blue-300">{pt.spo2}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB: CLINICAL RULES (MEWS & qSOFA) */}
          {/* ================================================================= */}
          {activeTab === 'CLINICAL_RULES' && (
            <div className="space-y-6">
              {/* MEWS Section */}
              <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
                      <Flame className="h-4 w-4 text-amber-400" />
                      Modified Early Warning Score (MEWS)
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Deterministic standard scoring based on documented protocol thresholds.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-400">Total Points:</span>
                    <span
                      className={`text-2xl font-black font-mono px-3 py-1 rounded-lg border ${
                        patient.mews.totalScore >= 5
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/50'
                          : patient.mews.totalScore >= 3
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                          : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                      }`}
                    >
                      {patient.mews.totalScore}
                    </span>
                  </div>
                </div>

                <div className="overflow-hidden border border-slate-800 rounded-lg">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="p-2.5">Parameter</th>
                        <th className="p-2.5">Observed Value</th>
                        <th className="p-2.5">Reference Bounds</th>
                        <th className="p-2.5 text-right">MEWS Points</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {patient.mews.breakdown.map((row, i) => (
                        <tr key={i} className="hover:bg-slate-900/50">
                          <td className="p-2.5 font-semibold text-white">{row.parameter}</td>
                          <td className="p-2.5 text-slate-200">{row.value}</td>
                          <td className="p-2.5 text-slate-400">{row.normalRange}</td>
                          <td className="p-2.5 text-right font-bold text-amber-300">
                            +{row.points}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* qSOFA Section */}
              {patient.qsofa && (
                <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
                        <AlertOctagon className="h-4 w-4 text-rose-400" />
                        Quick SOFA (qSOFA) Bedside Sepsis Screening
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Identifies patients with suspected infection at high risk of poor hospital outcomes.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-slate-400">Criteria Met:</span>
                      <span
                        className={`text-2xl font-black font-mono px-3 py-1 rounded-lg border ${
                          patient.qsofa.criteriaMet >= 2
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 animate-pulse'
                            : 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}
                      >
                        {patient.qsofa.criteriaMet} / 3
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {patient.qsofa.breakdown.map((q, i) => (
                      <div
                        key={i}
                        className={`p-3 rounded-lg border flex items-center justify-between ${
                          q.isMet
                            ? 'bg-rose-950/30 border-rose-800/50 text-rose-200'
                            : 'bg-slate-900/70 border-slate-800 text-slate-400'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-2.5 w-2.5 rounded-full ${
                              q.isMet ? 'bg-rose-500' : 'bg-slate-700'
                            }`}
                          />
                          <span className="text-xs font-semibold">{q.criterion}</span>
                        </div>
                        <span className="text-xs font-mono font-bold">
                          {q.value} ({q.isMet ? '+1 pt' : '0 pt'})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB: LABS & CLINICAL CONTEXT */}
          {/* ================================================================= */}
          {activeTab === 'LABS_CONTEXT' && (
            <div className="space-y-6">
              {/* Clinical Context */}
              <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-5">
                <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2 mb-3">
                  <FileText className="h-4 w-4 text-cyan-400" />
                  Clinical Context & Surgical Profile
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-2">
                    <div>
                      <span className="text-slate-400 block font-mono">Admission Reason:</span>
                      <span className="text-white font-medium">{patient.clinicalContext.admissionReason}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-mono">Comorbidities:</span>
                      <div className="flex gap-1.5 flex-wrap mt-1">
                        {patient.clinicalContext.comorbidities.map((c, i) => (
                          <span key={i} className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 font-mono text-[11px]">
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 font-mono">
                    <div>
                      <span className="text-slate-400 block">Post-Operative Day:</span>
                      <span className="text-white font-bold">POD #{patient.clinicalContext.postOpDay}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Allergies:</span>
                      <span className="text-rose-300 font-bold">
                        {patient.allergies.length ? patient.allergies.join(', ') : 'No known drug allergies (NKDA)'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Laboratory Results */}
              <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-5">
                <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2 mb-3">
                  <Activity className="h-4 w-4 text-purple-400" />
                  Recent Laboratory Results
                </h3>

                {patient.labs.length ? (
                  <div className="overflow-hidden border border-slate-800 rounded-lg">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
                        <tr>
                          <th className="p-2.5">Test</th>
                          <th className="p-2.5">Result</th>
                          <th className="p-2.5">Reference Bounds</th>
                          <th className="p-2.5">Status</th>
                          <th className="p-2.5">Collected</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {patient.labs.map((lab) => (
                          <tr key={lab.id} className="hover:bg-slate-900/50">
                            <td className="p-2.5 font-bold text-white">{lab.testName}</td>
                            <td className={`p-2.5 font-bold ${lab.isCritical ? 'text-rose-400' : 'text-slate-200'}`}>
                              {lab.value} {lab.unit}
                            </td>
                            <td className="p-2.5 text-slate-400">
                              {lab.referenceRange.low} - {lab.referenceRange.high} {lab.unit}
                            </td>
                            <td className="p-2.5">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  lab.isCritical
                                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                                    : 'bg-emerald-500/20 text-emerald-400'
                                }`}
                              >
                                {lab.isCritical ? 'ABNORMAL' : 'NORMAL'}
                              </span>
                            </td>
                            <td className="p-2.5 text-slate-400">
                              {new Date(lab.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 font-mono">No pending or recent abnormal labs.</p>
                )}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB: TIMELINE */}
          {/* ================================================================= */}
          {activeTab === 'TIMELINE' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
                <Clock className="h-4 w-4 text-cyan-400" />
                Chronological Unified Patient Timeline
              </h3>

              <div className="relative border-l border-slate-800 ml-4 space-y-6">
                {patient.timeline.map((event) => (
                  <div key={event.id} className="relative pl-6">
                    <span
                      className={`absolute -left-2 top-1.5 h-4 w-4 rounded-full border-2 border-slate-900 flex items-center justify-center ${
                        event.severity === 'CRITICAL'
                          ? 'bg-rose-500'
                          : event.severity === 'WARNING'
                          ? 'bg-amber-500'
                          : 'bg-cyan-500'
                      }`}
                    />
                    <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-bold text-white">{event.title}</span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300">{event.description}</p>
                      <div className="mt-1 flex items-center gap-2 text-[10px] font-mono text-slate-500">
                        <span>Source: {event.source}</span>
                        <span>•</span>
                        <span>Severity: {event.severity}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Operational Action Controls */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <span>Primary RN: {patient.primaryNurse}</span>
            <span>•</span>
            <span className={patient.isAcknowledged ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
              {patient.isAcknowledged
                ? `Acknowledged at ${new Date(patient.lastAcknowledgedAt || Date.now()).toLocaleTimeString()}`
                : 'Attention Unacknowledged'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Acknowledge Button */}
            <button
              type="button"
              onClick={() => onAcknowledge(patient.patientId)}
              className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
                patient.isAcknowledged
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                  : 'bg-cyan-600 text-white hover:bg-cyan-500 shadow-md shadow-cyan-600/20'
              }`}
            >
              <UserCheck className="h-4 w-4" />
              <span>{patient.isAcknowledged ? 'Acknowledged' : 'Acknowledge Priority'}</span>
            </button>

            {/* Log Bedside Assessment */}
            <button
              type="button"
              onClick={() => setIsAssessmentModalOpen(true)}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700 flex items-center gap-1.5 transition-colors"
            >
              <FileText className="h-4 w-4 text-slate-400" />
              <span>Log Assessment</span>
            </button>

            {/* Escalate to RRT */}
            <button
              type="button"
              onClick={() => onEscalate(patient.patientId)}
              className="px-4 py-2 rounded-lg text-xs font-bold bg-rose-600 text-white hover:bg-rose-500 shadow-md shadow-rose-600/20 flex items-center gap-1.5 transition-colors"
            >
              <AlertOctagon className="h-4 w-4" />
              <span>Escalate (RRT)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Embedded Sub-Modal for Bedside Assessment Note */}
      {isAssessmentModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 max-w-md w-full shadow-2xl">
            <h4 className="text-sm font-bold text-white font-mono mb-2">Log Bedside Nurse Assessment</h4>
            <p className="text-xs text-slate-400 mb-3">
              Record physical exam findings, bedside pulse check, or manual cuff verification.
            </p>
            <textarea
              value={assessmentNote}
              onChange={(e) => setAssessmentNote(e.target.value)}
              placeholder="e.g. Bedside pulse auscultated at 116 bpm, manual BP 96/60. Patient awake but diaphoretic. IV crystalloid bolus commenced..."
              rows={4}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
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
