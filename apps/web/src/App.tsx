import { useEffect, useState } from 'react';
import type { HealthCheckResponse } from '@aegispulse/types';
import {
  Activity,
  HeartPulse,
  ShieldCheck,
  Wifi,
  WifiOff,
  Server,
  Clock,
  Layers,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

export default function App() {
  const [health, setHealth] = useState<HealthCheckResponse | null>(null);
  const [loadingHealth, setLoadingHealth] = useState<boolean>(true);
  const [healthError, setHealthError] = useState<string | null>(null);

  const checkHealth = async () => {
    try {
      setLoadingHealth(true);
      setHealthError(null);
      const res = await fetch('/health');
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const data: HealthCheckResponse = await res.json();
      setHealth(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to reach API service';
      console.error('API health check failed:', err);
      setHealthError(message);
      setHealth(null);
    } finally {
      setLoadingHealth(false);
    }
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-white">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 ring-1 ring-cyan-400/40">
              <HeartPulse className="w-6 h-6 text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-lg tracking-tight text-white">AegisPulse</span>
                <span className="text-[10px] uppercase font-mono tracking-widest px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  Radar v0.1
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Patient Deterioration Radar & Nurse Attention Allocation Engine
              </p>
            </div>
          </div>

          {/* Service Health Pill */}
          <div className="flex items-center space-x-3">
            <button
              onClick={checkHealth}
              className="flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-mono border transition-all cursor-pointer bg-slate-900/80 hover:bg-slate-800"
            >
              {loadingHealth ? (
                <>
                  <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  <span className="text-slate-400">Pinging API...</span>
                </>
              ) : health?.status === 'ok' ? (
                <>
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-semibold">API Online</span>
                </>
              ) : (
                <>
                  <div className="w-2 h-2 rounded-full bg-red-400" />
                  <WifiOff className="w-3.5 h-3.5 text-red-400" />
                  <span className="text-red-400 font-semibold" title={healthError ?? undefined}>
                    API Disconnected
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Hero Alert & System Status Banner */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900/80 to-slate-950 p-6 sm:p-8 shadow-2xl">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Monorepo Infrastructure Active</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Ward Attention Allocation Engine
              </h1>
              <p className="text-sm text-slate-400 leading-relaxed">
                In crowded wards, the scarce resource is clinician attention. AegisPulse dynamically ranks
                patients by risk velocity, information decay, and baseline MEWS—prioritizing where nurses
                need to be next.
              </p>
            </div>

            {/* Live Service Metrics Card */}
            <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 min-w-[260px] space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between text-slate-400 pb-2 border-b border-slate-800">
                <span className="flex items-center space-x-1.5">
                  <Server className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Service</span>
                </span>
                <span className="text-slate-200">{health?.service || 'api'}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Status</span>
                <span className={health?.status === 'ok' ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                  {health?.status ? health.status.toUpperCase() : 'PENDING'}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span className="flex items-center space-x-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Uptime</span>
                </span>
                <span className="text-slate-200">{health ? `${health.uptimeSeconds}s` : '—'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Monorepo Architecture Overview Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40 hover:bg-slate-900/70 transition-all space-y-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Layers className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-sm text-white">@aegispulse/types</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Strict domain models for Patient, PhysiologicalObservation, TrendVector, and AttentionAssessment.
            </p>
            <div className="text-[11px] font-mono text-emerald-400 flex items-center space-x-1 pt-1">
              <span>Status: Frozen Contract</span>
            </div>
          </div>

          <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40 hover:bg-slate-900/70 transition-all space-y-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Activity className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-sm text-white">@aegispulse/clinical</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Deterministic Attention Priority Score (APS) calculation, information decay, and MEWS engine.
            </p>
            <div className="text-[11px] font-mono text-cyan-400 flex items-center space-x-1 pt-1">
              <span>Ready for Milestone 1</span>
            </div>
          </div>

          <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40 hover:bg-slate-900/70 transition-all space-y-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-sm text-white">@aegispulse/signal</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              POS rPPG chrominance projection and 4-state Signal Quality Index (SQI) confidence gating.
            </p>
            <div className="text-[11px] font-mono text-purple-400 flex items-center space-x-1 pt-1">
              <span>Ready for Milestone 3</span>
            </div>
          </div>
        </div>

        {/* Milestone 1 Ready Callout */}
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-300">
              <ArrowRight className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Next Phase: Milestone 1 & 2 Execution</h4>
              <p className="text-xs text-slate-400">
                Scaffolding complete. Ready to implement deterministic Attention Priority scoring and dynamic Ward Queue.
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded text-xs font-mono font-bold bg-cyan-500 text-slate-950">
            M0 DONE
          </span>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500 font-mono">
        AegisPulse Clinical Monorepo · VMedithon 3.0 · Zero Persistent Video Storage Guarantee
      </footer>
    </div>
  );
}
