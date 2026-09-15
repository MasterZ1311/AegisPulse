import {
  Activity,
  Wifi,
  WifiOff,
  ShieldCheck,
  AlertOctagon,
  Clock,
  Sparkles,
  Camera,
} from 'lucide-react';
import type { StreamConnectionStatus } from '../services/stream-client';

interface WardHeaderProps {
  wardName: string;
  shiftLead: string;
  shiftHours: string;
  streamStatus: StreamConnectionStatus;
  streamSeq: number;
  connectivityState?: 'ONLINE' | 'DEGRADED' | 'OFFLINE' | 'SYNCING';
  pendingSyncCount?: number;
  totalPatients: number;
  criticalCount: number;
  evaluateCount: number;
  watchCount: number;
  lowCount: number;
  activeScenario: string;
  onScenarioChange: (scenario: string) => void;
  onOpenDiagnostics?: () => void;
  onOpenCamera?: () => void;
}

export const WardHeader: React.FC<WardHeaderProps> = ({
  wardName,
  shiftLead,
  shiftHours,
  streamStatus,
  streamSeq,
  connectivityState = 'ONLINE',
  pendingSyncCount = 0,
  totalPatients,
  criticalCount,
  evaluateCount,
  watchCount,
  lowCount,
  activeScenario,
  onScenarioChange,
  onOpenDiagnostics,
  onOpenCamera,
}) => {
  return (
    <header className="bg-slate-950 border-b border-slate-800 px-4 sm:px-6 py-3 shrink-0 shadow-lg sticky top-0 z-30 font-sans">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Ward Identity & Lead Info */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-cyan-950 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-black text-lg shadow-inner">
            AP
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                AegisPulse
                <span className="text-xs uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/50">
                  Ward Attention Radar
                </span>
              </h1>
              <span className="text-slate-600 hidden sm:inline">|</span>
              <span className="text-sm font-medium text-slate-300 hidden sm:inline">
                {wardName}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-slate-500" />
                {shiftHours}
              </span>
              <span className="text-slate-700">•</span>
              <span>Lead: {shiftLead}</span>
              <span className="text-slate-700">•</span>
              {onOpenCamera ? (
                <button
                  type="button"
                  id="header-camera-badge"
                  onClick={onOpenCamera}
                  className="text-emerald-400 flex items-center gap-1 hover:text-emerald-300 transition-colors cursor-pointer"
                  title="Open Optical rPPG Bedside Sensor"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Optical rPPG (Zero Video Stored)
                </button>
              ) : (
                <span className="text-emerald-400 flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Optical rPPG (Zero Video Stored)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Center: Real-Time Patient Risk Counters */}
        <div className="flex items-center gap-2 overflow-x-auto py-1">
          <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center gap-2 text-xs">
            <span className="text-slate-400 font-medium">Beds:</span>
            <span className="font-bold text-white text-sm">{totalPatients}</span>
          </div>

          <div
            className={`px-3 py-1.5 rounded-lg border flex items-center gap-2 text-xs transition-colors ${
              criticalCount > 0
                ? 'bg-rose-950/40 border-rose-600/60 text-rose-200 animate-pulse font-semibold'
                : 'bg-slate-900/60 border-slate-800 text-slate-400'
            }`}
          >
            <AlertOctagon className={`h-4 w-4 ${criticalCount > 0 ? 'text-rose-400' : 'text-slate-500'}`} />
            <span>Critical Review:</span>
            <span className={`font-bold text-sm ${criticalCount > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
              {criticalCount}
            </span>
          </div>

          <div
            className={`px-3 py-1.5 rounded-lg border flex items-center gap-2 text-xs ${
              evaluateCount > 0
                ? 'bg-amber-950/40 border-amber-600/60 text-amber-200'
                : 'bg-slate-900/60 border-slate-800 text-slate-400'
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            <span>Evaluate:</span>
            <span className="font-bold text-sm text-amber-300">{evaluateCount}</span>
          </div>

          <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center gap-2 text-xs text-yellow-300">
            <span className="h-2 w-2 rounded-full bg-yellow-400" />
            <span className="text-slate-400">Watch:</span>
            <span className="font-bold text-sm text-yellow-300">{watchCount}</span>
          </div>

          <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center gap-2 text-xs text-emerald-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="text-slate-400">Low:</span>
            <span className="font-bold text-sm text-emerald-300">{lowCount}</span>
          </div>
        </div>

        {/* Right: Telemetry Stream Pill & Scenario Trigger */}
        <div className="flex items-center gap-3">
          {/* Scenario Select */}
          <div className="flex items-center gap-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5">
            <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
            <select
              value={activeScenario}
              onChange={(e) => onScenarioChange(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-none cursor-pointer text-xs"
              aria-label="Simulation Shift Scenario"
            >
              <option value="SINGLE_PATIENT_DETERIORATION" className="bg-slate-900 text-slate-200">
                Scenario: Bed 403 Occult Shock
              </option>
              <option value="NORMAL_SHIFT" className="bg-slate-900 text-slate-200">
                Scenario: Normal Stable Shift
              </option>
              <option value="MULTIPLE_PATIENT_SCENARIO" className="bg-slate-900 text-slate-200">
                Scenario: Dual Decompensation
              </option>
              <option value="SIGNAL_FAILURE_SCENARIO" className="bg-slate-900 text-slate-200">
                Scenario: Motion / Sensor Dropout
              </option>
            </select>
          </div>

          {/* Optical Bedside Camera Trigger Button */}
          {onOpenCamera && (
            <button
              type="button"
              id="header-open-camera-btn"
              onClick={onOpenCamera}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-800/40 text-emerald-300 hover:text-white transition-colors text-xs font-mono cursor-pointer"
              title="Open Bedside Optical Camera & Privacy Inspector"
            >
              <Camera className="h-3.5 w-3.5 text-emerald-400" />
              <span className="hidden xl:inline">Bedside rPPG</span>
            </button>
          )}

          {/* Developer Diagnostics Trigger Button */}
          {onOpenDiagnostics && (
            <button
              type="button"
              onClick={onOpenDiagnostics}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors text-xs font-mono"
              title="Open Operational Diagnostics"
            >
              <Activity className="h-3.5 w-3.5 text-cyan-400" />
              <span className="hidden xl:inline">Diagnostics</span>
            </button>
          )}

          {/* Explicit Connectivity State Pill (ONLINE / DEGRADED / OFFLINE / SYNCING) */}
          <button
            type="button"
            onClick={onOpenDiagnostics}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-mono font-medium shadow-sm transition-opacity hover:opacity-90 cursor-pointer ${
              connectivityState === 'ONLINE' && streamStatus === 'CONNECTED'
                ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/40'
                : connectivityState === 'SYNCING'
                ? 'bg-cyan-950/40 text-cyan-300 border-cyan-500/40 animate-pulse'
                : connectivityState === 'DEGRADED' || streamStatus === 'RECONNECTING'
                ? 'bg-amber-950/40 text-amber-300 border-amber-500/40 animate-pulse'
                : 'bg-rose-950/40 text-rose-300 border-rose-500/40'
            }`}
          >
            {connectivityState === 'ONLINE' && streamStatus === 'CONNECTED' ? (
              <Wifi className="h-3.5 w-3.5 text-emerald-400" />
            ) : connectivityState === 'SYNCING' ? (
              <Activity className="h-3.5 w-3.5 text-cyan-400 animate-spin" />
            ) : connectivityState === 'DEGRADED' || streamStatus === 'RECONNECTING' ? (
              <Wifi className="h-3.5 w-3.5 text-amber-400 animate-pulse" />
            ) : (
              <WifiOff className="h-3.5 w-3.5 text-rose-400" />
            )}
            <span className="tracking-wide">
              {connectivityState === 'SYNCING'
                ? `SYNCING (${pendingSyncCount})`
                : connectivityState === 'OFFLINE'
                ? pendingSyncCount > 0
                  ? `OFFLINE (QUEUED: ${pendingSyncCount})`
                  : 'OFFLINE'
                : connectivityState === 'DEGRADED'
                ? 'DEGRADED LINK'
                : 'LIVE ONLINE'}
            </span>
            {streamSeq > 0 && (
              <span className="text-slate-400 text-[10px] border-l border-slate-700 pl-2">
                #{streamSeq}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
