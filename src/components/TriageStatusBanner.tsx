import React from 'react';
import type { VitalsReading } from '../lib/types';
import { Heart, Activity, Wind, Droplets, Thermometer, AlertOctagon, CheckCircle2, AlertTriangle, ShieldAlert } from 'lucide-react';

interface TriageStatusBannerProps {
  vitals: VitalsReading;
  onOpenCopilot: () => void;
}

export const TriageStatusBanner: React.FC<TriageStatusBannerProps> = ({ vitals, onOpenCopilot }) => {
  const { heartRate, respiratoryRate, spo2, temperature, systolicBP, diastolicBP, hrv, mewsScore, qsofaScore, triageLevel } = vitals;

  return (
    <div className="space-y-4">
      {/* Top Emergency Level Alert Bar */}
      <div
        className={`rounded-2xl p-5 border transition-all duration-500 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 ${
          triageLevel === 'red'
            ? 'bg-gradient-to-r from-red-950/80 via-red-900/60 to-slate-900 border-red-500/80 text-white shadow-red-500/20'
            : triageLevel === 'yellow'
            ? 'bg-gradient-to-r from-amber-950/80 via-amber-900/50 to-slate-900 border-amber-500/80 text-white shadow-amber-500/20'
            : 'bg-gradient-to-r from-emerald-950/80 via-emerald-900/50 to-slate-900 border-emerald-500/80 text-white shadow-emerald-500/20'
        }`}
      >
        <div className="flex items-center space-x-4">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg ${
              triageLevel === 'red'
                ? 'bg-red-500 text-white animate-bounce'
                : triageLevel === 'yellow'
                ? 'bg-amber-500 text-slate-950 animate-pulse'
                : 'bg-emerald-500 text-slate-950'
            }`}
          >
            {triageLevel === 'red' ? (
              <AlertOctagon className="w-8 h-8" />
            ) : triageLevel === 'yellow' ? (
              <AlertTriangle className="w-8 h-8" />
            ) : (
              <CheckCircle2 className="w-8 h-8" />
            )}
          </div>

          <div>
            <div className="flex items-center space-x-3">
              <span
                className={`text-xs uppercase font-extrabold tracking-widest px-2.5 py-0.5 rounded-full border ${
                  triageLevel === 'red'
                    ? 'bg-red-500/20 border-red-400 text-red-300'
                    : triageLevel === 'yellow'
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                    : 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                }`}
              >
                {triageLevel === 'red'
                  ? 'CODE RED: IMMEDIATE RESUSCITATION'
                  : triageLevel === 'yellow'
                  ? 'CODE YELLOW: ELEVATED RISK'
                  : 'CODE GREEN: PHYSIOLOGICALLY STABLE'}
              </span>
              <span className="text-xs text-slate-300 font-mono">
                MEWS Score: <strong className="text-base text-white">{mewsScore}</strong> / 14
              </span>
              {qsofaScore >= 2 && (
                <span className="bg-red-950 text-red-300 border border-red-500/60 px-2 py-0.5 rounded text-[11px] font-bold flex items-center space-x-1 animate-pulse">
                  <ShieldAlert className="w-3 h-3" />
                  <span>qSOFA POSITIVE ({qsofaScore}/3)</span>
                </span>
              )}
            </div>

            <h2 className="text-lg font-bold text-white mt-1">
              {triageLevel === 'red'
                ? 'Critical Decompensation Triggered — Rapid Response Team Dispatched'
                : triageLevel === 'yellow'
                ? 'Clinical Instability Detected — Increase Ward Surveillance to 30 mins'
                : 'All Hemodynamic & Respiratory Parameters Within Safe Physiological Bounds'}
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              {triageLevel === 'red'
                ? 'Emergency Protocol: SBAR handoff prepared, automated crash cart and ICU consult alert broadcasted.'
                : triageLevel === 'yellow'
                ? 'Recommendation: Review recent lab panels, conduct repeat rPPG biometric scan, notify senior registrar.'
                : 'Patient maintaining stable baseline perfusion and autonomic tone. Continuous contactless surveillance ongoing.'}
            </p>
          </div>
        </div>

        <button
          onClick={onOpenCopilot}
          className={`px-5 py-2.5 rounded-xl font-bold text-xs tracking-wider uppercase transition-all shadow-lg flex-shrink-0 cursor-pointer ${
            triageLevel === 'red'
              ? 'bg-red-500 hover:bg-red-400 text-white shadow-red-500/40'
              : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-cyan-500/30'
          }`}
        >
          Open AI Clinical Copilot
        </button>
      </div>

      {/* 6 Vital Sign Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Heart Rate */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 backdrop-blur-md relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-medium uppercase tracking-wider">Heart Rate</span>
            <Heart className={`w-4 h-4 ${heartRate > 100 ? 'text-red-400 animate-ping' : 'text-emerald-400'}`} />
          </div>
          <div className="flex items-baseline space-x-1.5">
            <span className="text-2xl font-black text-white font-mono">{heartRate}</span>
            <span className="text-xs text-slate-400">BPM</span>
          </div>
          <div className="mt-1 text-[10px] text-slate-500 font-mono">
            {heartRate > 100 ? '⚠️ Tachycardia' : heartRate < 60 ? '⚠️ Bradycardia' : '✓ Normal Sinus'}
          </div>
        </div>

        {/* SpO2 */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 backdrop-blur-md relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-medium uppercase tracking-wider">Oxygen SpO2</span>
            <Droplets className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="flex items-baseline space-x-1.5">
            <span className="text-2xl font-black text-white font-mono">{spo2}</span>
            <span className="text-xs text-slate-400">%</span>
          </div>
          <div className="mt-1 text-[10px] text-slate-500 font-mono">
            {spo2 < 90 ? '🚨 Critical Hypoxia' : spo2 < 95 ? '⚠️ Mild Hypoxia' : '✓ Normal Perfusion'}
          </div>
        </div>

        {/* Respiratory Rate */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 backdrop-blur-md relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-medium uppercase tracking-wider">Resp Rate</span>
            <Wind className="w-4 h-4 text-blue-400" />
          </div>
          <div className="flex items-baseline space-x-1.5">
            <span className="text-2xl font-black text-white font-mono">{respiratoryRate}</span>
            <span className="text-xs text-slate-400">/min</span>
          </div>
          <div className="mt-1 text-[10px] text-slate-500 font-mono">
            {respiratoryRate >= 22 ? '🚨 Tachypnea (qSOFA+)' : '✓ Normal Ventilation'}
          </div>
        </div>

        {/* Blood Pressure */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 backdrop-blur-md relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-medium uppercase tracking-wider">Blood Pressure</span>
            <Activity className="w-4 h-4 text-purple-400" />
          </div>
          <div className="flex items-baseline space-x-1">
            <span className="text-xl font-black text-white font-mono">{systolicBP}/{diastolicBP}</span>
            <span className="text-[10px] text-slate-400">mmHg</span>
          </div>
          <div className="mt-1 text-[10px] text-slate-500 font-mono">
            {systolicBP <= 90 ? '🚨 Hypotension' : '✓ Normotensive'}
          </div>
        </div>

        {/* Temperature */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 backdrop-blur-md relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-medium uppercase tracking-wider">Body Temp</span>
            <Thermometer className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline space-x-1.5">
            <span className="text-2xl font-black text-white font-mono">{temperature.toFixed(1)}</span>
            <span className="text-xs text-slate-400">°C</span>
          </div>
          <div className="mt-1 text-[10px] text-slate-500 font-mono">
            {temperature >= 38.5 ? '🚨 Pyrexia / Fever' : temperature < 35.0 ? '🚨 Hypothermia' : '✓ Normothermia'}
          </div>
        </div>

        {/* Heart Rate Variability / RMSSD */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 backdrop-blur-md relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-medium uppercase tracking-wider">Autonomic HRV</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline space-x-1.5">
            <span className="text-2xl font-black text-white font-mono">{hrv}</span>
            <span className="text-xs text-slate-400">ms</span>
          </div>
          <div className="mt-1 text-[10px] text-slate-500 font-mono">
            {hrv < 25 ? '⚠️ High Autonomic Stress' : '✓ Healthy RMSSD'}
          </div>
        </div>
      </div>
    </div>
  );
};
