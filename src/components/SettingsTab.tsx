import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Key, Download, Server, Check } from 'lucide-react';

export const SettingsTab: React.FC = () => {
  const [geminiKey, setGeminiKey] = useState<string>('');
  const [hospitalUnit, setHospitalUnit] = useState<string>('Ward 4B - Acute Triage Unit');
  const [audioAlerts, setAudioAlerts] = useState<boolean>(true);
  const [alertThreshold, setAlertThreshold] = useState<number>(5);
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [maskedKey, setMaskedKey] = useState<string>('');
  const [backendStatus, setBackendStatus] = useState<'online' | 'offline'>('online');

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const data = await api.getSettings();
        if (data) {
          setHospitalUnit(data.hospitalUnit || 'Ward 4B - Acute Triage Unit');
          setAudioAlerts(data.audioAlerts ?? true);
          setAlertThreshold(data.alertThresholdMews || 5);
          setMaskedKey(data.maskedApiKey || '');
          setBackendStatus('online');
        }
      } catch (e) {
        setBackendStatus('offline');
      }
    };
    loadSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await api.updateSettings({
      geminiApiKey: geminiKey || undefined,
      hospitalUnit,
      audioAlerts,
      alertThresholdMews: alertThreshold,
    });

    if (success) {
      setIsSaved(true);
      if (geminiKey) {
        setMaskedKey(`${geminiKey.slice(0, 6)}...${geminiKey.slice(-4)}`);
        setGeminiKey('');
      }
      setTimeout(() => setIsSaved(false), 3000);
    }
  };

  const handleExportData = async () => {
    const patients = await api.getPatients();
    const blob = new Blob([JSON.stringify(patients, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AegisPulse_Ward_Telemetry_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Backend Status Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex items-center justify-between backdrop-blur-xl">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Local Node.js Telemetry Backend & SQLite Database</h3>
            <p className="text-xs text-slate-400">Port 5000 · REST API & WebSockets Active</p>
          </div>
        </div>

        <div className="flex items-center space-x-2 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-full text-emerald-400 text-xs font-mono font-bold">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>{backendStatus.toUpperCase()}</span>
        </div>
      </div>

      {/* Main Settings Form */}
      <form onSubmit={handleSave} className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-2xl backdrop-blur-2xl space-y-6">
        <div>
          <h2 className="text-base font-bold text-white mb-1">Production System Settings & Credentials</h2>
          <p className="text-xs text-slate-400">Configure AI models, alerting thresholds, and hospital unit identifiers.</p>
        </div>

        {/* Gemini API Key */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-bold text-white flex items-center space-x-2">
              <Key className="w-4 h-4 text-cyan-400" />
              <span>Google Gemini API Key (Clinical Copilot Reasoning)</span>
            </label>
            {maskedKey ? (
              <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 rounded-full flex items-center space-x-1">
                <Check className="w-3 h-3" />
                <span>Configured: {maskedKey}</span>
              </span>
            ) : (
              <span className="text-[11px] font-mono text-slate-500 bg-slate-800 px-2 py-0.5 rounded">
                Using Offline Rules Engine
              </span>
            )}
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Enter your Google Gemini API key to enable real-time multimodal LLM clinical reasoning. If omitted, AegisPulse automatically falls back to our deterministic, board-certified medical heuristics engine.
          </p>

          <input
            type="password"
            placeholder={maskedKey ? 'Enter new key to replace existing' : 'AIzaSy...'}
            value={geminiKey}
            onChange={(e) => setGeminiKey(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400 font-mono"
          />
        </div>

        {/* Ward & Clinical Configurations */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-2">
            <label className="text-xs font-bold text-slate-300 block">Hospital Department / Ward Unit</label>
            <input
              type="text"
              value={hospitalUnit}
              onChange={(e) => setHospitalUnit(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-400 font-medium"
            />
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-2">
            <label className="text-xs font-bold text-slate-300 block">
              Emergency Code Red MEWS Threshold (Default: 5)
            </label>
            <input
              type="number"
              min="3"
              max="10"
              value={alertThreshold}
              onChange={(e) => setAlertThreshold(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-400 font-mono"
            />
          </div>
        </div>

        {/* Audio Alerts Toggle */}
        <div className="flex items-center justify-between bg-slate-950/80 border border-slate-800 rounded-2xl p-4">
          <div>
            <h4 className="text-xs font-bold text-white">Audible Code Red Decompensation Sirens</h4>
            <p className="text-[11px] text-slate-400 mt-0.5">Play urgent synthesized auditory alert on telemetry terminals when MEWS &ge; 5</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={audioAlerts}
              onChange={(e) => setAudioAlerts(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
          </label>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={handleExportData}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all cursor-pointer"
          >
            <Download className="w-4 h-4 text-cyan-400" />
            <span>Export Ward Telemetry (JSON)</span>
          </button>

          <div className="flex items-center space-x-3">
            {isSaved && (
              <span className="text-xs text-emerald-400 font-mono flex items-center space-x-1 animate-in fade-in">
                <Check className="w-4 h-4" />
                <span>Settings Saved to SQLite DB</span>
              </span>
            )}
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-400 hover:from-cyan-400 hover:to-emerald-300 text-slate-950 font-black text-xs shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
            >
              Save Configuration
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
