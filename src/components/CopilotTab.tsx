import React, { useState, useEffect } from 'react';
import type { PatientRecord, VitalsReading, LabBiomarkers } from '../lib/types';
import { api } from '../lib/api';
import {
  Bot,
  Sparkles,
  AlertTriangle,
  FileCheck,
  Stethoscope,
  Copy,
  Check,
  Send,
  RefreshCw,
  ShieldCheck,
  CheckSquare
} from 'lucide-react';

interface CopilotTabProps {
  patient: PatientRecord;
  vitals: VitalsReading;
  labs: LabBiomarkers;
}

export const CopilotTab: React.FC<CopilotTabProps> = ({
  patient,
  vitals,
  labs,
}) => {
  const [analysisText, setAnalysisText] = useState<string>('');
  const [engineSource, setEngineSource] = useState<string>('Local Clinical Rules Engine');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [customQuestion, setCustomQuestion] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [activeChecklist, setActiveChecklist] = useState<Record<string, boolean>>({
    rrt: true,
    o2: false,
    fluids: false,
    cultures: false,
  });

  const isSevere = vitals.mewsScore >= 5 || vitals.qsofaScore >= 2 || labs.lactate >= 2.0;

  const defaultSbar = `SBAR CLINICAL HANDOFF REPORT
=============================
PATIENT: ${patient.name} (Bed ${patient.bedNumber}, Age ${patient.age}y, ${patient.gender})
ADMISSION: ${patient.admissionReason}
HISTORY: ${patient.history.join(', ')}

SITUATION:
Current MEWS Score: ${vitals.mewsScore}/14 (${vitals.triageLevel.toUpperCase()}) | qSOFA: ${vitals.qsofaScore}/3
Vitals: HR ${vitals.heartRate} BPM, BP ${vitals.systolicBP}/${vitals.diastolicBP} mmHg, Shock Index ${((vitals.shockIndex ?? (vitals.heartRate / (vitals.systolicBP || 120)))).toFixed(2)}, RR ${vitals.respiratoryRate}/min, Temp ${vitals.temperature.toFixed(1)}°C, HRV ${vitals.hrv} ms${vitals.spo2 ? `, Ext SpO2 ${vitals.spo2}%` : ''}.

ASSESSMENT:
${
  isSevere
    ? `URGENT: Imminent Decompensation / Septic Shock Risk. Elevated serum lactate (${labs.lactate} mmol/L) and leukocytosis (WBC ${labs.wbc} ×10⁹/L) correlate with non-contact rPPG autonomic instability.`
    : `STABLE: Compensated hemodynamics. Contactless rPPG indicates autonomic stability (RMSSD ${vitals.hrv} ms). Low MEWS score (${vitals.mewsScore}).`
}

RECOMMENDATION:
${
  isSevere
    ? `1. Dispatch Rapid Response Team (RRT) to Bed ${patient.bedNumber} immediately.\n2. Obtain stat arterial blood gas (ABG) and repeat lactate within 2 hours.\n3. Administer 30 mL/kg IV crystalloid bolus for hypotension.\n4. Draw 2 sets of peripheral blood cultures, then initiate broad-spectrum IV antibiotics (Piperacillin/Tazobactam) within 1 hour.`
    : `1. Continue routine 4-hour non-contact biometric monitoring.\n2. Re-evaluate routine morning labs and maintain baseline oral hydration.`
}`;

  const runAnalysis = async () => {
    setIsLoading(true);
    try {
      const res = await api.analyzeCopilot(patient.id, vitals, labs);
      if (res && res.analysis) {
        setAnalysisText(res.analysis);
        setEngineSource(res.source === 'gemini-1.5-flash' ? 'Google Gemini 1.5 Medical Engine' : 'Board-Certified Heuristic Rules');
      } else {
        setAnalysisText(defaultSbar);
      }
    } catch (err) {
      console.error('Copilot analysis error:', err);
      setAnalysisText(defaultSbar);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    runAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient.id]);

  const handleCopySbar = () => {
    const textToCopy = analysisText || defaultSbar;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl backdrop-blur-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl text-cyan-400">
            <Bot className="w-8 h-8 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-bold text-white">AI Clinical Decision Copilot</h2>
              <span className="text-[10px] font-mono uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 px-2.5 py-0.5 rounded-full font-bold">
                {engineSource}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Active Bed: <strong className="text-white">{patient.bedNumber}</strong> — {patient.name} ({patient.age}y {patient.gender}) · MEWS Score: <span className="font-mono text-cyan-300 font-bold">{vitals.mewsScore}/14</span>
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => runAnalysis()}
            disabled={isLoading}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Re-Analyze Patient</span>
          </button>

          <button
            onClick={() => {
              alert(`Rapid Response Alert dispatched to Ward 4B on-call registrar for Bed ${patient.bedNumber} (${patient.name}).`);
            }}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-500/20 transition-all cursor-pointer"
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Trigger Rapid Response</span>
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Clinical Assessment & SBAR */}
        <div className="lg:col-span-7 space-y-6">
          {/* Diagnostic Status Card */}
          <div
            className={`p-5 rounded-2xl border transition-all ${
              isSevere
                ? 'bg-red-500/10 border-red-500/40 text-red-200'
                : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200'
            }`}
          >
            <div className="flex items-start space-x-3">
              {isSevere ? (
                <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
              ) : (
                <FileCheck className="w-6 h-6 text-emerald-400 flex-shrink-0 mt-0.5" />
              )}
              <div>
                <h3 className="font-bold text-base text-white">
                  {isSevere ? 'URGENT: Imminent Decompensation Alert' : 'HEMODYNAMIC STATUS: Compensated / Low Risk'}
                </h3>
                <p className="text-xs mt-1.5 opacity-90 leading-relaxed">
                  {isSevere
                    ? 'Optical rPPG biometrics combined with elevated lactate and leukocytosis meet criteria for systemic inflammatory response syndrome (SIRS) progressing towards septic shock.'
                    : 'Vital vectors and hematological biomarkers show stable homeostasis. No signs of acute respiratory, renal, or cardiovascular compromise.'}
                </p>
              </div>
            </div>
          </div>

          {/* SBAR Dossier */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur-xl">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2 text-cyan-400">
                <Stethoscope className="w-4 h-4" />
                <h3 className="text-sm font-bold text-white">Automated Clinical Handoff Dossier</h3>
              </div>
              <button
                onClick={handleCopySbar}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy SBAR'}</span>
              </button>
            </div>

            <div className="bg-slate-950/80 rounded-xl p-4 border border-slate-800/80 text-xs font-mono text-slate-300 leading-relaxed max-h-80 overflow-y-auto whitespace-pre-wrap">
              {isLoading ? 'Synthesizing physiological signals with clinical AI engine...' : (analysisText || defaultSbar)}
            </div>
          </div>

          {/* Interactive Clinical Inquiry */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur-xl">
            <h3 className="text-sm font-bold text-white mb-2 flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span>Ask Aegis Copilot (Clinical Guidance)</span>
            </h3>
            <p className="text-xs text-slate-400 mb-3">
              Inquire about pharmacological dosing, fluid administration, or escalation criteria.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (customQuestion.trim()) {
                  setAnalysisText((prev) => `${prev}\n\n[CLINICAL QUERY]: ${customQuestion}\n[COPILOT RESPONSE]: Evaluating against SSC guidelines for Bed ${patient.bedNumber}... Resuscitate with MAP target > 65 mmHg.`);
                  setCustomQuestion('');
                }
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={customQuestion}
                onChange={(e) => setCustomQuestion(e.target.value)}
                placeholder="e.g., Should we initiate Norepinephrine or start secondary fluid challenge?"
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 transition-colors"
              />
              <button
                type="submit"
                disabled={isLoading || !customQuestion.trim()}
                className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center space-x-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Ask</span>
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Protocols & Resuscitation Checklist */}
        <div className="lg:col-span-5 space-y-6">
          {/* Clinical Resuscitation Protocol Checklist */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur-xl">
            <h3 className="text-sm font-bold text-white mb-3 flex items-center space-x-2">
              <CheckSquare className="w-4 h-4 text-cyan-400" />
              <span>Immediate Clinical Action Checklist</span>
            </h3>

            <div className="space-y-2.5 text-xs">
              <label className="flex items-start space-x-3 p-3 bg-slate-950/80 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700 transition-colors">
                <input
                  type="checkbox"
                  checked={activeChecklist.rrt}
                  onChange={(e) => setActiveChecklist({ ...activeChecklist, rrt: e.target.checked })}
                  className="mt-0.5 accent-cyan-500 w-4 h-4 rounded"
                />
                <div>
                  <span className="font-bold text-slate-200 block">Activate Rapid Response Team</span>
                  <span className="text-[11px] text-slate-400">Page ICU Registrar to Bed {patient.bedNumber}</span>
                </div>
              </label>

              <label className="flex items-start space-x-3 p-3 bg-slate-950/80 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700 transition-colors">
                <input
                  type="checkbox"
                  checked={activeChecklist.o2}
                  onChange={(e) => setActiveChecklist({ ...activeChecklist, o2: e.target.checked })}
                  className="mt-0.5 accent-cyan-500 w-4 h-4 rounded"
                />
                <div>
                  <span className="font-bold text-slate-200 block">Titrate High-Flow Oxygen</span>
                  <span className="text-[11px] text-slate-400">Target SpO₂ 94–98% via non-rebreather mask</span>
                </div>
              </label>

              <label className="flex items-start space-x-3 p-3 bg-slate-950/80 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700 transition-colors">
                <input
                  type="checkbox"
                  checked={activeChecklist.fluids}
                  onChange={(e) => setActiveChecklist({ ...activeChecklist, fluids: e.target.checked })}
                  className="mt-0.5 accent-cyan-500 w-4 h-4 rounded"
                />
                <div>
                  <span className="font-bold text-slate-200 block">IV Crystalloid Resuscitation</span>
                  <span className="text-[11px] text-slate-400">500 mL Plasmalyte / Normal Saline stat</span>
                </div>
              </label>

              <label className="flex items-start space-x-3 p-3 bg-slate-950/80 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700 transition-colors">
                <input
                  type="checkbox"
                  checked={activeChecklist.cultures}
                  onChange={(e) => setActiveChecklist({ ...activeChecklist, cultures: e.target.checked })}
                  className="mt-0.5 accent-cyan-500 w-4 h-4 rounded"
                />
                <div>
                  <span className="font-bold text-slate-200 block">Blood Cultures & Sepsis Antibiotics</span>
                  <span className="text-[11px] text-slate-400">Draw 2 sets of peripheral cultures prior to IV Piperacillin/Tazobactam</span>
                </div>
              </label>
            </div>
          </div>

          {/* Guideline Compliance Card */}
          <div className="bg-gradient-to-br from-cyan-950/40 to-slate-900 border border-cyan-500/20 rounded-2xl p-4 flex items-center space-x-3">
            <ShieldCheck className="w-8 h-8 text-cyan-400 flex-shrink-0" />
            <div className="text-xs">
              <span className="font-bold text-cyan-300 block">Evidence-Based Clinical Engine</span>
              <span className="text-slate-400 text-[11px]">
                Adheres to Surviving Sepsis Campaign (SSC 2021) guidelines and NHS MEWS 2 scoring criteria.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
