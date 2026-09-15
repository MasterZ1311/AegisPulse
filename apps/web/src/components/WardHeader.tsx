import {
  Activity,
  Wifi,
  WifiOff,
  ShieldCheck,
  AlertOctagon,
  Clock,
  Camera,
  User,
  Sliders,
  Sun,
  Moon,
  Sparkles,
  ShieldAlert,
  KeyRound,
  UserPlus,
} from 'lucide-react';
import type { StreamConnectionStatus } from '../services/stream-client';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

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
  isAdmin?: boolean;
  adminUser?: { username: string; fullName: string } | null;
  onOpenAdminAuth?: () => void;
  onOpenAdmitPatient?: () => void;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
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
  isAdmin = false,
  adminUser,
  onOpenAdminAuth,
  onOpenAdmitPatient,
  theme = 'dark',
  onToggleTheme,
}) => {
  const isOnline = connectivityState === 'ONLINE' && streamStatus === 'CONNECTED';
  const isSyncing = connectivityState === 'SYNCING';
  const isDegraded = connectivityState === 'DEGRADED' || streamStatus === 'RECONNECTING';

  return (
    <header className="neu-flat sticky top-0 z-40 w-full px-5 sm:px-8 py-3.5 mb-2 transition-colors duration-200">
      <div className="max-w-[1780px] mx-auto flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        {/* Left: Brand Identity & Shift Information */}
        <div className="flex items-center gap-4">
          <div className="neu-button relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl p-1.5 bg-white/80 dark:bg-slate-900/80 shadow-xs">
            <img src="/aegis-logo.png" alt="AegisPulse" className="h-8 w-8 object-contain" />
            <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>

          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-foreground flex items-center gap-2">
                AegisPulse
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg neu-inset-sm text-sky-600 dark:text-sky-400">
                  RADAR
                </span>
              </h1>
              <span className="text-muted-foreground/40 hidden sm:inline">|</span>
              <span className="text-xs font-semibold text-muted-foreground hidden sm:inline">
                {wardName}
              </span>
            </div>

            <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground flex-wrap font-mono">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-sky-600 dark:text-sky-400" />
                {shiftHours}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <User className="h-3 w-3 text-sky-600 dark:text-sky-400" />
                {shiftLead}
              </span>
              <span className="hidden md:inline">•</span>
              {onOpenCamera ? (
                <button
                  type="button"
                  id="header-camera-badge"
                  onClick={onOpenCamera}
                  className="hidden md:inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold hover:underline cursor-pointer"
                  title="Open Optical rPPG Bedside Sensor"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Zero Video Exfiltration
                </button>
              ) : (
                <span className="hidden md:inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Zero Video Exfiltration
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Center: Real-Time Patient Risk Counters in Soft Neumorphic Inset Pills */}
        <div className="neu-inset rounded-2xl p-1.5 flex items-center gap-2 overflow-x-auto">
          {/* Total Beds */}
          <div className="px-3.5 py-1.5 rounded-xl neu-flat-sm flex items-center gap-2 text-xs font-mono">
            <span className="text-muted-foreground font-medium">Beds:</span>
            <span className="font-extrabold text-foreground text-sm">{totalPatients}</span>
          </div>

          {/* Critical Review (Rose Red) */}
          <div
            className={`px-3.5 py-1.5 rounded-xl flex items-center gap-2 text-xs font-mono transition-all duration-200 ${
              criticalCount > 0
                ? 'neu-button bg-rose-500/20 text-rose-700 dark:text-rose-300 font-bold shadow-[0_0_12px_rgba(244,63,94,0.25)]'
                : 'neu-flat-sm text-muted-foreground'
            }`}
          >
            <AlertOctagon className={`h-3.5 w-3.5 ${criticalCount > 0 ? 'text-rose-500 animate-pulse' : ''}`} />
            <span>Critical:</span>
            <span className={`font-black text-sm ${criticalCount > 0 ? 'text-rose-600 dark:text-rose-400' : ''}`}>
              {criticalCount}
            </span>
          </div>

          {/* Evaluate (Vivid Orange) */}
          <div
            className={`px-3.5 py-1.5 rounded-xl flex items-center gap-2 text-xs font-mono transition-all duration-200 ${
              evaluateCount > 0
                ? 'neu-button bg-orange-500/20 text-orange-800 dark:text-orange-300 font-bold shadow-[0_0_10px_rgba(249,115,22,0.22)]'
                : 'neu-flat-sm text-muted-foreground'
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-orange-500" />
            <span>Evaluate:</span>
            <span className={`font-black text-sm ${evaluateCount > 0 ? 'text-orange-600 dark:text-orange-400' : ''}`}>
              {evaluateCount}
            </span>
          </div>

          {/* Watch (Topaz Gold) */}
          <div className="px-3.5 py-1.5 rounded-xl neu-flat-sm flex items-center gap-2 text-xs font-mono text-yellow-700 dark:text-yellow-300">
            <span className="h-2 w-2 rounded-full bg-yellow-400" />
            <span className="text-muted-foreground">Watch:</span>
            <span className="font-bold text-sm">{watchCount}</span>
          </div>

          {/* Low (Clinical Emerald) */}
          <div className="px-3.5 py-1.5 rounded-xl neu-flat-sm flex items-center gap-2 text-xs font-mono text-emerald-700 dark:text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-muted-foreground">Low:</span>
            <span className="font-bold text-sm">{lowCount}</span>
          </div>
        </div>

        {/* Right: Theme Mode Switcher, Scenario, Camera, Diagnostics & Live Badge */}
        <div className="flex items-center gap-2.5 flex-wrap justify-end">
          {/* Theme Mode Toggle (Light / Dark) */}
          {onToggleTheme && (
            <Button
              variant="outline"
              size="icon"
              onClick={onToggleTheme}
              className="h-9 w-9 text-muted-foreground hover:text-foreground"
              title={`Switch to ${theme === 'dark' ? 'Light Mode' : 'Dark Mode'}`}
              aria-label="Toggle Theme Mode"
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4 text-amber-400" />
              ) : (
                <Moon className="h-4 w-4 text-sky-600" />
              )}
            </Button>
          )}

          {/* Optical Bedside Camera Trigger Button */}
          {onOpenCamera && (
            <Button
              variant="outline"
              size="sm"
              id="header-open-camera-btn"
              onClick={onOpenCamera}
              className="gap-1.5 font-mono text-emerald-700 dark:text-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-300"
              title="Open Bedside Optical Camera & Privacy Inspector"
            >
              <Camera className="h-3.5 w-3.5" />
              <span className="hidden xl:inline">Bedside rPPG</span>
            </Button>
          )}

          {/* Scenario Select */}
          <Select
            icon={<Sparkles className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />}
            value={activeScenario}
            onChange={(e) => onScenarioChange(e.target.value)}
            aria-label="Simulation Shift Scenario"
            className="w-[190px] xl:w-[210px]"
          >
            <option value="SINGLE_PATIENT_DETERIORATION">Bed 403 Occult Shock</option>
            <option value="NORMAL_SHIFT">Normal Stable Shift</option>
            <option value="MULTIPLE_PATIENT_SCENARIO">Dual Decompensation</option>
            <option value="SIGNAL_FAILURE_SCENARIO">Optical Dropout</option>
          </Select>

          {/* Admin Access / Status Button */}
          {onOpenAdminAuth && (
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenAdminAuth}
              className={`gap-1.5 font-mono ${
                isAdmin
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400 font-bold'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
              title={isAdmin ? `Administrator: ${adminUser?.fullName || 'Aegis System Admin'}` : 'Manage Admin Access & Credentials'}
            >
              {isAdmin ? (
                <>
                  <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
                  <span className="hidden xl:inline">Admin Active</span>
                </>
              ) : (
                <>
                  <KeyRound className="h-3.5 w-3.5 text-slate-400" />
                  <span className="hidden sm:inline">Admin Access</span>
                </>
              )}
            </Button>
          )}

          {/* Admit Patient Button (Visible when Admin) */}
          {isAdmin && onOpenAdmitPatient && (
            <Button
              variant="default"
              size="sm"
              onClick={onOpenAdmitPatient}
              className="gap-1.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs"
              title="Admit a New Patient to Ward Census"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span className="hidden md:inline">+ Admit Patient</span>
            </Button>
          )}

          {/* Diagnostics Button */}
          {onOpenDiagnostics && (
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenDiagnostics}
              className="gap-1.5 font-mono"
              title="Open Operational Diagnostics"
            >
              <Sliders className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
              <span className="hidden sm:inline">Diagnostics</span>
            </Button>
          )}

          {/* Connectivity Badge */}
          <button
            type="button"
            onClick={onOpenDiagnostics}
            className="neu-flat-sm rounded-xl px-3 py-1.5 flex items-center gap-2 text-xs font-mono font-semibold cursor-pointer hover:opacity-90 transition-opacity"
          >
            {isOnline ? (
              <Wifi className="h-3.5 w-3.5 text-emerald-500" />
            ) : isSyncing ? (
              <Activity className="h-3.5 w-3.5 text-sky-500 animate-spin" />
            ) : isDegraded ? (
              <Wifi className="h-3.5 w-3.5 text-amber-500" />
            ) : (
              <WifiOff className="h-3.5 w-3.5 text-rose-500" />
            )}
            <span className="text-foreground">
              {isSyncing
                ? `SYNC (${pendingSyncCount})`
                : connectivityState === 'OFFLINE'
                ? pendingSyncCount > 0
                  ? `OFFLINE (${pendingSyncCount})`
                  : 'OFFLINE'
                : isDegraded
                ? 'DEGRADED'
                : 'ONLINE'}
            </span>
            {streamSeq > 0 && (
              <span className="text-muted-foreground text-[10px] pl-1 border-l border-border/50">
                #{streamSeq}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
