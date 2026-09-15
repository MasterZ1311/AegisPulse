import React from 'react';
import {
  Activity,
  LayoutGrid,
  User,
  BarChart3,
  ScrollText,
  Sparkles,
  Sliders,
  Sun,
  Moon,
  Wifi,
  WifiOff,
  AlertOctagon,
  Camera,
} from 'lucide-react';
import type { StreamConnectionStatus } from '../services/stream-client';
import { Button } from '@/components/ui/button';

export type AppPage = 'RADAR' | 'PATIENT' | 'ANALYTICS' | 'AUDIT' | 'SIMULATION';

interface NavigationProps {
  activePage: AppPage;
  onNavigate: (page: AppPage) => void;
  wardName: string;
  shiftLead: string;
  shiftHours: string;
  selectedBedNumber?: string;
  totalPatients: number;
  criticalCount: number;
  evaluateCount?: number;
  watchCount?: number;
  lowCount?: number;
  streamStatus: StreamConnectionStatus;
  streamSeq: number;
  connectivityState?: 'ONLINE' | 'DEGRADED' | 'OFFLINE' | 'SYNCING';
  pendingSyncCount?: number;
  onOpenDiagnostics?: () => void;
  onOpenCamera?: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  activePage,
  onNavigate,
  wardName,
  selectedBedNumber,
  totalPatients,
  criticalCount,
  streamStatus,
  streamSeq,
  connectivityState = 'ONLINE',
  pendingSyncCount = 0,
  onOpenDiagnostics,
  onOpenCamera,
  theme,
  onToggleTheme,
}) => {
  const isOnline = connectivityState === 'ONLINE' && streamStatus === 'CONNECTED';
  const isSyncing = connectivityState === 'SYNCING';
  const isDegraded = connectivityState === 'DEGRADED' || streamStatus === 'RECONNECTING';

  const navItems = [
    {
      id: 'RADAR' as AppPage,
      label: 'Radar',
      shortLabel: 'Radar',
      icon: LayoutGrid,
      count: totalPatients,
    },
    {
      id: 'PATIENT' as AppPage,
      label: selectedBedNumber ? `Bed ${selectedBedNumber}` : 'Patient',
      shortLabel: selectedBedNumber ? `Bed ${selectedBedNumber.split('-')[0]}` : 'Patient',
      icon: User,
      alert: criticalCount > 0,
    },
    {
      id: 'ANALYTICS' as AppPage,
      label: 'Analytics',
      shortLabel: 'Trends',
      icon: BarChart3,
    },
    {
      id: 'AUDIT' as AppPage,
      label: 'Audit',
      shortLabel: 'Audit',
      icon: ScrollText,
    },
    {
      id: 'SIMULATION' as AppPage,
      label: 'Simulation',
      shortLabel: 'Sim',
      icon: Sparkles,
    },
  ];

  return (
    <header className="neu-flat sticky top-0 z-40 w-full transition-colors duration-200 border-b border-border/40">
      <div className="max-w-[1780px] mx-auto px-3 sm:px-6 py-2.5 space-y-2 lg:space-y-0 lg:flex lg:items-center lg:justify-between lg:gap-4">
        {/* Top Tier (Mobile) / Left (Desktop): Brand & All Key Utilities */}
        <div className="flex items-center justify-between gap-3 w-full lg:w-auto">
          {/* Brand Mark */}
          <button
            type="button"
            onClick={() => onNavigate('RADAR')}
            className="flex items-center gap-2.5 text-left cursor-pointer group shrink-0"
          >
            <div className="neu-button relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl p-1 bg-white/80 dark:bg-slate-900/80 group-hover:scale-105 transition-transform shadow-xs">
              <img src="/aegis-logo.png" alt="AegisPulse" className="h-7 w-7 object-contain" />
              <span className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-base font-black tracking-tight text-foreground">
                AegisPulse
              </span>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md neu-inset-sm text-sky-600 dark:text-sky-400">
                {wardName.split('—')[0]?.trim() || 'Ward 4B'}
              </span>
            </div>
          </button>

          {/* Fully Visible Utilities (Never Hidden on Mobile or Desktop) */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Critical Alert Pill */}
            {criticalCount > 0 && (
              <button
                type="button"
                onClick={() => onNavigate('RADAR')}
                className="neu-button bg-rose-500/20 text-rose-700 dark:text-rose-300 font-bold px-2 py-1 rounded-lg flex items-center gap-1 text-[11px] font-mono animate-pulse cursor-pointer shrink-0"
                title={`${criticalCount} patient(s) in Critical Review`}
              >
                <AlertOctagon className="h-3 w-3 text-rose-500" />
                <span>{criticalCount} Crit</span>
              </button>
            )}

            {/* Connection Status Pill */}
            <button
              type="button"
              onClick={onOpenDiagnostics}
              className="neu-flat-sm rounded-xl px-2 py-1 flex items-center gap-1.5 text-xs font-mono font-semibold cursor-pointer hover:opacity-90 transition-opacity shrink-0"
              title={`Connection: ${isOnline ? 'ONLINE' : connectivityState}`}
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
              <span className="text-foreground text-[10px] sm:text-[11px]">
                {isSyncing ? `SYNC (${pendingSyncCount})` : isOnline ? 'ONLINE' : 'OFFLINE'}
              </span>
              {streamSeq > 0 && (
                <span className="text-muted-foreground text-[10px] pl-1 border-l border-border/50 font-mono hidden xl:inline">
                  #{streamSeq}
                </span>
              )}
            </button>

            {/* Bedside Camera Button */}
            {onOpenCamera && (
              <Button
                variant="outline"
                size="icon"
                id="header-open-camera-btn"
                onClick={onOpenCamera}
                className="h-8 w-8 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 shrink-0"
                title="Bedside Optical Camera [C]"
              >
                <Camera className="h-3.5 w-3.5" />
              </Button>
            )}

            {/* Diagnostics Button */}
            {onOpenDiagnostics && (
              <Button
                variant="outline"
                size="icon"
                onClick={onOpenDiagnostics}
                className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
                title="Diagnostics [D]"
              >
                <Sliders className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
              </Button>
            )}

            {/* Theme Mode Toggle */}
            <Button
              variant="outline"
              size="icon"
              onClick={onToggleTheme}
              className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
              title={`Switch to ${theme === 'dark' ? 'Light Mode' : 'Dark Mode'}`}
              aria-label="Toggle Theme Mode"
            >
              {theme === 'dark' ? (
                <Sun className="h-3.5 w-3.5 text-amber-400" />
              ) : (
                <Moon className="h-3.5 w-3.5 text-sky-600" />
              )}
            </Button>
          </div>
        </div>

        {/* Center / Row 2: 100% Fit Grid Segmented Navigation Bar (Zero Hidden Items) */}
        <nav
          className="neu-inset rounded-xl p-1 grid grid-cols-5 w-full lg:w-auto lg:min-w-[500px] gap-1"
          aria-label="Main Navigation"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`flex items-center justify-center gap-1 sm:gap-1.5 px-1.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold transition-all duration-200 cursor-pointer w-full text-center ${
                  isActive
                    ? 'neu-button bg-sky-600 text-white shadow-sm font-bold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5'
                }`}
                title={item.label}
              >
                <Icon className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-white' : 'text-sky-600 dark:text-sky-400'}`} />
                <span className="hidden sm:inline truncate">{item.label}</span>
                <span className="inline sm:hidden truncate">{item.shortLabel}</span>

                {item.alert && !isActive && (
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse shrink-0" />
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
