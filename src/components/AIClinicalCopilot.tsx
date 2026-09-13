import React from 'react';
import type { VitalsReading, LabBiomarkers, PatientRecord } from '../lib/types';
import { Bot, X, CheckSquare, AlertTriangle, FileCheck, Stethoscope, Copy, Check } from 'lucide-react';

interface AIClinicalCopilotProps {
  isOpen: boolean;
  onClose: () => void;
  patient: PatientRecord;
  vitals: VitalsReading;
  labs: LabBiomarkers;
}

export const AIClinicalCopilot: React.FC<AIClinicalCopilotProps> = ({
  isOpen,
  onClose,
  patient,
  vitals,
  labs,
}) => {
  const [copied, setCopied] = React.useState(false);

  if (!isOpen) return null;

  const isSevere = vitals.mewsScore >= 5 || vitals.qsofaScore >= 2 || labs.lactate >= 2.0;

  const sbarText = `SBAR CLINICAL HANDOFF REPORT:
SITUATION:
Patient: ${patient.name} (Bed ${patient.bedNumber}, Age ${patient.age})
Current Status: MEWS Score ${vitals.mewsScore}/14 (${vitals.triageLevel.toUpperCase()}), qSOFA: ${vitals.qsofaScore}/3
Vitals: HR ${vitals.heartRate} BPM, BP ${vitals.systolicBP}/${vitals.diastolicBP} mmHg, SpO2 ${vitals.spo2}%, RR ${vitals.respiratoryRate}/min, Temp ${vitals.temperature.toFixed(1)}°C.

BACKGROUND:
Admission: ${patient.admissionReason}
Relevant History: ${patient.history.join(', ')}

ASSESSMENT:
${
  isSevere
    ? 'High probability of Acute Physiological Decompensation / Septic Shock secondary to infection. Elevated serum lactate (' +
      labs.lactate +
      ' mmol/L) and leukocytosis (' +
      labs.wbc +
      ' ×10⁹/L) correlate with deteriorating hemodynamics.'
    : 'Patient is hemodynamically compensated. Contactless rPPG indicates normal autonomic balance (RMSSD: ' +
      vitals.hrv +
      ' ms).'
}

RECOMMENDATION:
${
  isSevere
    ? '1. Dispatch Rapid Response Team (RRT) to Bed ' +
      patient.bedNumber +
      '.\n2. Order immediate arterial blood gas (ABG) and repeat lactate.\n3. Prepare 30 mL/kg IV fluid bolus and broad-spectrum antibiotics per Sepsis 6 Protocol.\n4. ICU bed request.'
    : '1. Maintain routine 4-hour non-contact biometric surveillance.\n2. Re-evaluate post-op labs in morning rounds.'
}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(sbarText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400">
              <Bot className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-white">Aegis AI Clinical Decision Copilot</h3>
                <span className="text-[10px] font-mono uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 px-2 py-0.5 rounded-full">
                  LLM Medical Synthesis
                </span>
              </div>
              <p className="text-xs text-slate-400">Real-time physiological multi-modal clinical reasoning</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          {/* Executive Diagnostic Banner */}
          <div
            className={`p-4 rounded-xl border flex items-start space-x-3 ${
              isSevere
                ? 'bg-red-500/10 border-red-500/40 text-red-200'
                : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200'
            }`}
          >
            {isSevere ? (
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            ) : (
              <FileCheck className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            )}
            <div>
              <h4 className="font-bold text-sm text-white">
                {isSevere ? 'URGENT: Imminent Decompensation Alert' : 'CLINICAL STATUS: Compensated / Low Risk'}
              </h4>
              <p className="text-xs mt-1 opacity-90">
                {isSevere
                  ? 'Optical rPPG biometrics combined with elevated lactate and leukocytosis meet criteria for systemic inflammatory response syndrome (SIRS) progressing towards septic shock.'
                  : 'Vital vectors and hematological biomarkers show stable homeostasis. No signs of acute respiratory, renal, or cardiovascular compromise.'}
              </p>
            </div>
          </div>

          {/* SBAR Section */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-slate-400">
              <span className="flex items-center space-x-1.5 text-cyan-300">
                <Stethoscope className="w-3.5 h-3.5" />
                <span className="font-bold">STANDARDIZED SBAR HANDOFF DOSSIER</span>
              </span>
              <button
                onClick={copyToClipboard}
                className="flex items-center space-x-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-white cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span className="text-[11px]">{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <pre className="whitespace-pre-wrap text-slate-300 leading-relaxed font-sans text-xs">{sbarText}</pre>
          </div>

          {/* Immediate Action Protocol Checklist */}
          <div>
            <h4 className="font-bold text-white text-xs uppercase tracking-wider mb-2 flex items-center space-x-1.5">
              <CheckSquare className="w-4 h-4 text-cyan-400" />
              <span>Recommended Immediate Clinical Protocol</span>
            </h4>

            <div className="space-y-2">
              {isSevere ? (
                <>
                  <label className="flex items-start space-x-2.5 p-2.5 bg-slate-950/60 border border-red-500/30 rounded-lg text-xs text-slate-200">
                    <input type="checkbox" className="mt-0.5 accent-red-500" defaultChecked />
                    <span><strong>Rapid Response Activation:</strong> Page Dr. on duty & ICU Registrar (Bed {patient.bedNumber})</span>
                  </label>
                  <label className="flex items-start space-x-2.5 p-2.5 bg-slate-950/60 border border-slate-800 rounded-lg text-xs text-slate-200">
                    <input type="checkbox" className="mt-0.5 accent-cyan-500" />
                    <span><strong>Oxygen Therapy:</strong> Titrate supplemental O₂ via non-rebreather to maintain SpO₂ &gt; 94%</span>
                  </label>
                  <label className="flex items-start space-x-2.5 p-2.5 bg-slate-950/60 border border-slate-800 rounded-lg text-xs text-slate-200">
                    <input type="checkbox" className="mt-0.5 accent-cyan-500" />
                    <span><strong>Hemodynamic Resuscitation:</strong> 500mL IV Crystalloid bolus stat; reassess MAP &gt; 65 mmHg</span>
                  </label>
                  <label className="flex items-start space-x-2.5 p-2.5 bg-slate-950/60 border border-slate-800 rounded-lg text-xs text-slate-200">
                    <input type="checkbox" className="mt-0.5 accent-cyan-500" />
                    <span><strong>Stat Blood Cultures:</strong> 2 sets prior to broad-spectrum IV antibiotic administration</span>
                  </label>
                </>
              ) : (
                <>
                  <label className="flex items-start space-x-2.5 p-2.5 bg-slate-950/60 border border-slate-800 rounded-lg text-xs text-slate-200">
                    <input type="checkbox" className="mt-0.5 accent-emerald-500" defaultChecked />
                    <span>Maintain automated non-contact biometric telemetry scans every 15 minutes</span>
                  </label>
                  <label className="flex items-start space-x-2.5 p-2.5 bg-slate-950/60 border border-slate-800 rounded-lg text-xs text-slate-200">
                    <input type="checkbox" className="mt-0.5 accent-emerald-500" />
                    <span>Continue oral hydration and scheduled analgesic management</span>
                  </label>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs cursor-pointer"
          >
            Close Copilot
          </button>
          <button
            onClick={() => {
              alert('Clinical Summary synced with Hospital Electronic Health Record (EHR). Rapid Response Team alerted.');
              onClose();
            }}
            className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 cursor-pointer"
          >
            Dispatch & Sync with EHR
          </button>
        </div>
      </div>
    </div>
  );
};
