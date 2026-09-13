import React from 'react';
import type { LabBiomarkers } from '../lib/types';
import { FlaskConical, AlertCircle, CheckCircle } from 'lucide-react';

interface LabDiagnosticsPanelProps {
  labs: LabBiomarkers;
  onUpdateLabs: (updated: Partial<LabBiomarkers>) => void;
}

export const LabDiagnosticsPanel: React.FC<LabDiagnosticsPanelProps> = ({ labs, onUpdateLabs }) => {
  const setPreset = (preset: 'normal' | 'sepsis' | 'inflammatory') => {
    if (preset === 'normal') {
      onUpdateLabs({ wbc: 7.2, creatinine: 0.9, lactate: 1.1, platelets: 260, crp: 3.2 });
    } else if (preset === 'sepsis') {
      onUpdateLabs({ wbc: 18.5, creatinine: 2.4, lactate: 3.8, platelets: 85, crp: 114.0 });
    } else if (preset === 'inflammatory') {
      onUpdateLabs({ wbc: 13.1, creatinine: 1.2, lactate: 1.8, platelets: 210, crp: 48.5 });
    }
  };

  const isLactateCritical = labs.lactate >= 2.0;
  const isWbcCritical = labs.wbc > 12.0 || labs.wbc < 4.0;
  const isCreatinineHigh = labs.creatinine > 1.4;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-purple-500/10 border border-purple-500/30 rounded-lg text-purple-400">
            <FlaskConical className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide uppercase">
              Clinical Laboratory Ingestion
            </h3>
            <p className="text-xs text-slate-400">Hematology, Renal & Sepsis Biomarkers</p>
          </div>
        </div>

        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => setPreset('normal')}
            className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer"
          >
            Normal Labs
          </button>
          <button
            onClick={() => setPreset('sepsis')}
            className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-red-950/80 hover:bg-red-900 text-red-300 border border-red-500/40 cursor-pointer"
          >
            Sepsis Profile
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 mb-4">
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
          <div className="flex justify-between items-center mb-1 text-xs">
            <span className="font-semibold text-slate-300">White Blood Cells (WBC)</span>
            <span className={`font-mono font-bold ${isWbcCritical ? 'text-amber-400' : 'text-emerald-400'}`}>
              {labs.wbc} ×10⁹/L
            </span>
          </div>
          <input
            type="range"
            min="2.0"
            max="25.0"
            step="0.1"
            value={labs.wbc}
            onChange={(e) => onUpdateLabs({ wbc: parseFloat(e.target.value) })}
            className="w-full accent-purple-400 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-0.5">
            <span>Ref: 4.0 - 11.0</span>
            <span>{isWbcCritical ? '⚠️ Leukocytosis' : 'Normal'}</span>
          </div>
        </div>

        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
          <div className="flex justify-between items-center mb-1 text-xs">
            <span className="font-semibold text-slate-300">Serum Lactate</span>
            <span className={`font-mono font-bold ${isLactateCritical ? 'text-red-400' : 'text-emerald-400'}`}>
              {labs.lactate} mmol/L
            </span>
          </div>
          <input
            type="range"
            min="0.4"
            max="6.0"
            step="0.1"
            value={labs.lactate}
            onChange={(e) => onUpdateLabs({ lactate: parseFloat(e.target.value) })}
            className="w-full accent-red-400 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-0.5">
            <span>Ref: 0.5 - 2.0</span>
            <span>{isLactateCritical ? '🚨 Tissue Hypoperfusion' : 'Normal'}</span>
          </div>
        </div>

        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
          <div className="flex justify-between items-center mb-1 text-xs">
            <span className="font-semibold text-slate-300">Serum Creatinine</span>
            <span className={`font-mono font-bold ${isCreatinineHigh ? 'text-amber-400' : 'text-emerald-400'}`}>
              {labs.creatinine} mg/dL
            </span>
          </div>
          <input
            type="range"
            min="0.5"
            max="4.0"
            step="0.1"
            value={labs.creatinine}
            onChange={(e) => onUpdateLabs({ creatinine: parseFloat(e.target.value) })}
            className="w-full accent-purple-400 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-0.5">
            <span>Ref: 0.7 - 1.3</span>
            <span>{isCreatinineHigh ? '⚠️ Impaired Filtration' : 'Normal'}</span>
          </div>
        </div>

        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
          <div className="flex justify-between items-center mb-1 text-xs">
            <span className="font-semibold text-slate-300">Platelet Count</span>
            <span className={`font-mono font-bold ${labs.platelets < 100 ? 'text-red-400' : 'text-emerald-400'}`}>
              {labs.platelets} ×10⁹/L
            </span>
          </div>
          <input
            type="range"
            min="30"
            max="500"
            step="5"
            value={labs.platelets}
            onChange={(e) => onUpdateLabs({ platelets: parseInt(e.target.value) })}
            className="w-full accent-blue-400 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-0.5">
            <span>Ref: 150 - 450</span>
            <span>{labs.platelets < 100 ? '🚨 Thrombocytopenia' : 'Normal'}</span>
          </div>
        </div>

        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
          <div className="flex justify-between items-center mb-1 text-xs">
            <span className="font-semibold text-slate-300">C-Reactive Protein (CRP)</span>
            <span className={`font-mono font-bold ${labs.crp > 50 ? 'text-red-400' : 'text-emerald-400'}`}>
              {labs.crp} mg/L
            </span>
          </div>
          <input
            type="range"
            min="1.0"
            max="180.0"
            step="1.0"
            value={labs.crp}
            onChange={(e) => onUpdateLabs({ crp: parseFloat(e.target.value) })}
            className="w-full accent-amber-400 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-0.5">
            <span>Ref: &lt; 5.0</span>
            <span>{labs.crp > 50 ? '🚨 Acute Inflammation' : 'Normal'}</span>
          </div>
        </div>

        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between">
          <div className="text-xs">
            <span className="font-semibold text-slate-300 block mb-1">Laboratory Sepsis Index</span>
            <div className="flex items-center space-x-2">
              {isLactateCritical && isWbcCritical ? (
                <>
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 animate-pulse" />
                  <span className="text-red-300 text-[11px] font-bold">Biomarkers Confirm Active Sepsis</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <span className="text-emerald-300 text-[11px] font-bold">No Biochemical Shock Markers</span>
                </>
              )}
            </div>
          </div>
          <span className="text-[10px] text-slate-500 font-mono block mt-2">
            Multi-Modal Data Integration Active
          </span>
        </div>
      </div>
    </div>
  );
};
