import React, { useState } from 'react';
import type { LabBiomarkers, PatientRecord } from '../lib/types';
import { api } from '../lib/api';
import { FlaskConical, AlertCircle, CheckCircle, Save, Check, Info } from 'lucide-react';

interface LabDiagnosticsTabProps {
  patient: PatientRecord;
  onUpdateLabs: (updated: Partial<LabBiomarkers>) => void;
}

export const LabDiagnosticsTab: React.FC<LabDiagnosticsTabProps> = ({
  patient,
  onUpdateLabs,
}) => {
  const [isSaved, setIsSaved] = useState(false);
  const labs = patient.labs;

  const setPreset = (preset: 'normal' | 'sepsis' | 'inflammatory') => {
    if (preset === 'normal') {
      onUpdateLabs({ wbc: 7.2, creatinine: 0.9, lactate: 1.1, platelets: 260, crp: 3.2 });
    } else if (preset === 'sepsis') {
      onUpdateLabs({ wbc: 18.5, creatinine: 2.4, lactate: 3.8, platelets: 85, crp: 114.0 });
    } else if (preset === 'inflammatory') {
      onUpdateLabs({ wbc: 13.1, creatinine: 1.2, lactate: 1.8, platelets: 210, crp: 48.5 });
    }
  };

  const handleSaveToBackend = async () => {
    await api.updateLabs(patient.id, labs);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const isLactateCritical = labs.lactate >= 2.0;
  const isWbcCritical = labs.wbc > 12.0 || labs.wbc < 4.0;
  const isCreatinineHigh = labs.creatinine > 1.4;

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Top Header Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-2xl backdrop-blur-2xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-2xl text-purple-400">
            <FlaskConical className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-black text-white">Laboratory Hematology & Sepsis Biomarker Vault</h2>
              <span className="text-xs font-mono font-bold bg-purple-500/10 border border-purple-500/30 text-purple-300 px-2 py-0.5 rounded-full">
                Bed {patient.bedNumber}
              </span>
            </div>
            <p className="text-xs text-slate-400">Patient: <strong className="text-white">{patient.name}</strong> ({patient.age}y {patient.gender})</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setPreset('normal')}
            className="px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer transition-colors"
          >
            Normal Profile
          </button>
          <button
            onClick={() => setPreset('sepsis')}
            className="px-3 py-1.5 text-xs font-bold rounded-xl bg-red-950/80 hover:bg-red-900 text-red-300 border border-red-500/40 cursor-pointer transition-colors"
          >
            Sepsis Shock Profile
          </button>
          <button
            onClick={handleSaveToBackend}
            className="flex items-center space-x-1.5 px-4 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 cursor-pointer transition-all"
          >
            {isSaved ? <Check className="w-4 h-4 text-emerald-950" /> : <Save className="w-4 h-4" />}
            <span>{isSaved ? 'Saved' : 'Save to DB'}</span>
          </button>
        </div>
      </div>

      {/* Main Lab Parameters Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* WBC */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl backdrop-blur-xl">
          <div className="flex justify-between items-center mb-1 text-xs">
            <span className="font-bold text-slate-200">White Blood Cell Count (WBC)</span>
            <span className={`font-mono font-black text-sm ${isWbcCritical ? 'text-amber-400' : 'text-emerald-400'}`}>
              {labs.wbc} ×10⁹/L
            </span>
          </div>
          <div className="my-3">
            <input
              type="range"
              min="2.0"
              max="25.0"
              step="0.1"
              value={labs.wbc}
              onChange={(e) => onUpdateLabs({ wbc: parseFloat(e.target.value) })}
              className="w-full accent-purple-400 cursor-pointer"
            />
          </div>
          <div className="flex justify-between text-[11px] text-slate-500 font-mono">
            <span>Reference: 4.0 - 11.0</span>
            <span className={isWbcCritical ? 'text-amber-400 font-bold' : 'text-emerald-400'}>
              {isWbcCritical ? '⚠️ Leukocytosis' : 'Normal'}
            </span>
          </div>
        </div>

        {/* Serum Lactate */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl backdrop-blur-xl">
          <div className="flex justify-between items-center mb-1 text-xs">
            <span className="font-bold text-slate-200">Serum Lactate (Hypoperfusion)</span>
            <span className={`font-mono font-black text-sm ${isLactateCritical ? 'text-red-400' : 'text-emerald-400'}`}>
              {labs.lactate} mmol/L
            </span>
          </div>
          <div className="my-3">
            <input
              type="range"
              min="0.4"
              max="6.0"
              step="0.1"
              value={labs.lactate}
              onChange={(e) => onUpdateLabs({ lactate: parseFloat(e.target.value) })}
              className="w-full accent-red-400 cursor-pointer"
            />
          </div>
          <div className="flex justify-between text-[11px] text-slate-500 font-mono">
            <span>Reference: 0.5 - 2.0</span>
            <span className={isLactateCritical ? 'text-red-400 font-bold' : 'text-emerald-400'}>
              {isLactateCritical ? '🚨 Tissue Sepsis' : 'Normal'}
            </span>
          </div>
        </div>

        {/* Serum Creatinine */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl backdrop-blur-xl">
          <div className="flex justify-between items-center mb-1 text-xs">
            <span className="font-bold text-slate-200">Serum Creatinine (Renal)</span>
            <span className={`font-mono font-black text-sm ${isCreatinineHigh ? 'text-amber-400' : 'text-emerald-400'}`}>
              {labs.creatinine} mg/dL
            </span>
          </div>
          <div className="my-3">
            <input
              type="range"
              min="0.5"
              max="4.0"
              step="0.1"
              value={labs.creatinine}
              onChange={(e) => onUpdateLabs({ creatinine: parseFloat(e.target.value) })}
              className="w-full accent-purple-400 cursor-pointer"
            />
          </div>
          <div className="flex justify-between text-[11px] text-slate-500 font-mono">
            <span>Reference: 0.7 - 1.3</span>
            <span className={isCreatinineHigh ? 'text-amber-400 font-bold' : 'text-emerald-400'}>
              {isCreatinineHigh ? '⚠️ AKI Risk' : 'Normal'}
            </span>
          </div>
        </div>

        {/* Platelet Count */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl backdrop-blur-xl">
          <div className="flex justify-between items-center mb-1 text-xs">
            <span className="font-bold text-slate-200">Platelet Count</span>
            <span className={`font-mono font-black text-sm ${labs.platelets < 100 ? 'text-red-400' : 'text-emerald-400'}`}>
              {labs.platelets} ×10⁹/L
            </span>
          </div>
          <div className="my-3">
            <input
              type="range"
              min="30"
              max="500"
              step="5"
              value={labs.platelets}
              onChange={(e) => onUpdateLabs({ platelets: parseInt(e.target.value) })}
              className="w-full accent-blue-400 cursor-pointer"
            />
          </div>
          <div className="flex justify-between text-[11px] text-slate-500 font-mono">
            <span>Reference: 150 - 450</span>
            <span className={labs.platelets < 100 ? 'text-red-400 font-bold' : 'text-emerald-400'}>
              {labs.platelets < 100 ? '🚨 Thrombocytopenia' : 'Normal'}
            </span>
          </div>
        </div>

        {/* C-Reactive Protein (CRP) */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl backdrop-blur-xl">
          <div className="flex justify-between items-center mb-1 text-xs">
            <span className="font-bold text-slate-200">C-Reactive Protein (CRP)</span>
            <span className={`font-mono font-black text-sm ${labs.crp > 50 ? 'text-red-400' : 'text-emerald-400'}`}>
              {labs.crp} mg/L
            </span>
          </div>
          <div className="my-3">
            <input
              type="range"
              min="1.0"
              max="180.0"
              step="1.0"
              value={labs.crp}
              onChange={(e) => onUpdateLabs({ crp: parseFloat(e.target.value) })}
              className="w-full accent-amber-400 cursor-pointer"
            />
          </div>
          <div className="flex justify-between text-[11px] text-slate-500 font-mono">
            <span>Reference: &lt; 5.0</span>
            <span className={labs.crp > 50 ? 'text-red-400 font-bold' : 'text-emerald-400'}>
              {labs.crp > 50 ? '🚨 Severe Inflammation' : 'Normal'}
            </span>
          </div>
        </div>

        {/* Multi-Modal Correlation Summary */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl backdrop-blur-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 text-xs font-bold text-white mb-2">
              <Info className="w-4 h-4 text-cyan-400" />
              <span>Multi-Modal Sepsis Diagnostic Index</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              {isLactateCritical && isWbcCritical
                ? 'Clinical Alert: Optical pulse tachycardia (>100 BPM) correlates with hyperlactatemia (>2.0 mmol/L) and leukocytosis. High probability of systemic septic shock.'
                : 'Biomarkers indicate compensated hemodynamics. No signs of severe anaerobic cellular metabolism or systemic infection cascade.'}
            </p>
          </div>

          <div className="pt-3 border-t border-slate-800/80 flex items-center space-x-2">
            {isLactateCritical && isWbcCritical ? (
              <span className="text-red-400 font-mono text-xs font-bold flex items-center space-x-1">
                <AlertCircle className="w-4 h-4 animate-pulse" />
                <span>MEWS Sepsis Alert Triggered</span>
              </span>
            ) : (
              <span className="text-emerald-400 font-mono text-xs font-bold flex items-center space-x-1">
                <CheckCircle className="w-4 h-4" />
                <span>Biochemical Baseline Stable</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
