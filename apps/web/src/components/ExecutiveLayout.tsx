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
  WifiOff,
  Camera,
  Search,
  Bell,
  Settings,
  ChevronDown,
  HeartPulse,
  Clock,
} from 'lucide-react';
import type { AppPage } from './Navigation';
import type { StreamConnectionStatus } from '../services/stream-client';
import type { WardConnectivityState } from '../services/offline-sync-queue';

interface ExecutiveLayoutProps {
  activePage: AppPage;
  onNavigate: (page: AppPage) => void;
  wardName: string;
  totalPatients: number;
  criticalCount: number;
  evaluateCount?: number;
  watchCount?: number;
  lowCount?: number;
  maxApsScore?: number;
  streamStatus: StreamConnectionStatus;
  streamSeq: number;
  connectivityState?: WardConnectivityState;
  pendingSyncCount?: number;
  onOpenDiagnostics?: () => void;
  onOpenCamera?: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  children: React.ReactNode;
}

export const ExecutiveLayout: React.FC<ExecutiveLayoutProps> = ({
  activePage,
  onNavigate,
  wardName,
  totalPatients,
  criticalCount,
  evaluateCount = 0,
  watchCount = 0,
  lowCount = 0,
  maxApsScore = 88,
  streamStatus,
  streamSeq,
  connectivityState = 'ONLINE',
  pendingSyncCount = 0,
  onOpenDiagnostics,
  onOpenCamera,
  theme,
  onToggleTheme,
  searchQuery,
  onSearchChange,
  children,
}) => {
  const isOnline = connectivityState === 'ONLINE' && streamStatus === 'CONNECTED';
  const isSyncing = connectivityState === 'SYNCING';
  const isDegraded = connectivityState === 'DEGRADED' || streamStatus === 'RECONNECTING';

  const navDockItems = [
    {
      id: 'RADAR' as AppPage,
      label: 'Ward Radar',
      icon: LayoutGrid,
    },
    {
      id: 'PATIENT' as AppPage,
      label: 'Patient Workstation',
      icon: User,
    },
    {
      id: 'ANALYTICS' as AppPage,
      label: 'Analytics',
      icon: BarChart3,
    },
    {
      id: 'AUDIT' as AppPage,
      label: 'Audit Trail',
      icon: ScrollText,
    },
    {
      id: 'SIMULATION' as AppPage,
      label: 'Simulation Engine',
      icon: Sparkles,
    },
  ];

  const topTabs = [
    { id: 'RADAR' as AppPage, label: 'Ward Radar' },
    { id: 'PATIENT' as AppPage, label: 'Patient Workstation' },
    { id: 'ANALYTICS' as AppPage, label: 'Analytics' },
    { id: 'AUDIT' as AppPage, label: 'Audit Trail' },
    { id: 'SIMULATION' as AppPage, label: 'Simulation' },
  ];

  return (
    <div className="min-h-screen bg-[#DCE6DC] p-1.5 sm:p-2.5 lg:p-3.5 flex flex-col md:flex-row gap-2 sm:gap-3 lg:gap-3.5 font-sans text-slate-900 antialiased selection:bg-emerald-500 selection:text-white pb-20 md:pb-2">
      {/* 1. Navigation Dock: Fixed Bottom Bar on Mobile (< md), Left Vertical Pill on Desktop (md+) */}
      <aside className="fixed bottom-0 left-0 right-0 z-50 md:static md:w-[70px] lg:w-[74px] bg-[#0E1311] md:rounded-[28px] lg:rounded-[32px] px-4 py-2 md:py-5 flex flex-row md:flex-col items-center justify-around md:justify-between shadow-2xl text-white shrink-0 border-t border-white/10 md:border-t-0">
        {/* Top: AegisPulse Shield Crest Logo (hidden on mobile bottom bar) */}
        <button
          type="button"
          onClick={() => onNavigate('RADAR')}
          className="relative hidden md:flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 hover:bg-white/15 transition-all p-1 group cursor-pointer"
          title="AegisPulse Radar"
        >
          <img src="/aegis-logo.png" alt="AegisPulse" className="h-8 w-8 object-contain filter drop-shadow" />
          <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-4 ring-[#0E1311] animate-pulse" />
        </button>

        {/* Center: Main Navigation Icons */}
        <nav className="flex flex-row md:flex-col items-center justify-around w-full md:w-auto gap-1 sm:gap-2 lg:gap-3" aria-label="Dock Navigation">
          {navDockItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`relative flex items-center justify-center h-10 w-10 sm:h-11 sm:w-11 rounded-2xl transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-white text-slate-950 shadow-md scale-105 font-bold'
                    : 'text-zinc-400 hover:text-white hover:bg-white/10'
                }`}
                title={item.label}
              >
                <Icon className="h-5 w-5 stroke-[2.2]" />
                {item.id === 'RADAR' && criticalCount > 0 && !isActive && (
                  <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-rose-500 text-[9px] font-bold text-white flex items-center justify-center animate-pulse">
                    {criticalCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom Actions: Diagnostics, Theme, etc. */}
        <div className="flex flex-row md:flex-col items-center gap-1.5 md:gap-2">
          {/* Bedside Camera Modal Launcher */}
          {onOpenCamera && (
            <button
              type="button"
              id="dock-open-camera-btn"
              onClick={onOpenCamera}
              className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-2xl text-cyan-400 hover:bg-white/10 transition-all cursor-pointer"
              title="Bedside Contactless Camera [C]"
            >
              <Camera className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          )}

          {/* Diagnostics Modal Launcher (Visible on desktop dock) */}
          {onOpenDiagnostics && (
            <button
              type="button"
              id="dock-open-diagnostics-btn"
              onClick={onOpenDiagnostics}
              className="hidden md:flex h-10 w-10 items-center justify-center rounded-2xl text-sky-400 hover:bg-white/10 transition-all cursor-pointer"
              title="Diagnostics & Telemetry Health [D]"
            >
              <Sliders className="h-5 w-5" />
            </button>
          )}

          {/* Theme Toggle */}
          <button
            type="button"
            onClick={onToggleTheme}
            className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-2xl text-zinc-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4 sm:h-5 sm:w-5 text-amber-400" />
            ) : (
              <Moon className="h-4 w-4 sm:h-5 sm:w-5 text-sky-400" />
            )}
          </button>
        </div>
      </aside>

      {/* 2. Main Large White Floating Canvas */}
      <div className="flex-1 bg-white rounded-[20px] sm:rounded-[26px] md:rounded-[30px] p-3 sm:p-4.5 lg:p-5 shadow-[0_12px_45px_-12px_rgba(0,0,0,0.06)] border border-black/[0.04] flex flex-col min-h-[calc(100vh-1rem)] md:min-h-[calc(100vh-2rem)] overflow-x-hidden">
        {/* 2.1 Top Header Bar */}
        <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2.5 sm:gap-3 pb-3 sm:pb-3.5 border-b border-slate-100">
          <div className="flex items-center justify-between gap-2 w-full lg:w-auto">
            {/* Mobile Brand Logo and Title */}
            <div className="flex md:hidden items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-[#0E1311] flex items-center justify-center p-1 shadow-xs">
                <img src="/aegis-logo.png" alt="AegisPulse" className="h-6 w-6 object-contain" />
              </div>
              <span className="font-extrabold text-sm tracking-tight text-slate-900">AegisPulse</span>
            </div>

            {/* Pill Search Bar */}
            <div className="relative flex-1 sm:w-64 md:w-72 lg:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search patients, beds, vitals..."
                className="w-full bg-[#F3F6F4] text-slate-800 placeholder:text-slate-400 rounded-full pl-9 pr-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium border border-slate-200/60 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all"
              />
            </div>
          </div>

          {/* Center: Top Text Navigation Tabs */}
          <nav className="flex items-center justify-start lg:justify-center gap-4 sm:gap-6 overflow-x-auto no-scrollbar py-0.5 text-xs sm:text-sm">
            {topTabs.map((tab) => {
              const isActive = activePage === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onNavigate(tab.id)}
                  className={`transition-colors cursor-pointer whitespace-nowrap pb-1 font-medium ${
                    isActive
                      ? 'text-slate-900 font-bold border-b-2 border-slate-900'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {/* Right: Telemetry Status, Settings, Notification, Profile */}
          <div className="flex items-center justify-end gap-2 shrink-0">
            {/* Realtime Stream Status Pill */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-semibold border ${
                isOnline
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
                  : isSyncing
                  ? 'bg-sky-50 text-sky-700 border-sky-200/60 animate-pulse'
                  : isDegraded
                  ? 'bg-amber-50 text-amber-700 border-amber-200/60'
                  : 'bg-rose-50 text-rose-700 border-rose-200/60'
              }`}
              title={`Connection: ${connectivityState}`}
            >
              {isOnline ? (
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              ) : isSyncing ? (
                <Activity className="h-3 w-3 text-sky-500 animate-spin" />
              ) : (
                <WifiOff className="h-3 w-3 text-rose-500" />
              )}
              <span className="font-mono uppercase tracking-wider">
                {isSyncing ? `Sync (${pendingSyncCount})` : isOnline ? 'Online' : 'Offline'}
              </span>
              {streamSeq > 0 && (
                <span className="text-slate-400 font-mono text-[9px] pl-1 border-l border-slate-200">
                  #{streamSeq}
                </span>
              )}
            </div>

            {/* Notification Bell */}
            <button
              type="button"
              onClick={() => onNavigate('RADAR')}
              className="relative p-1.5 sm:p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
              title={`${criticalCount} active critical alert(s)`}
            >
              <Bell className="h-4 w-4" />
              {criticalCount > 0 && (
                <span className="absolute top-0.5 right-0.5 h-3 w-3 rounded-full bg-rose-500 text-white text-[8px] font-bold flex items-center justify-center ring-2 ring-white">
                  {criticalCount}
                </span>
              )}
            </button>

            {/* Diagnostics Gear Button */}
            {onOpenDiagnostics && (
              <button
                type="button"
                onClick={onOpenDiagnostics}
                className="p-1.5 sm:p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
                title="Operational Telemetry & Diagnostics"
              >
                <Settings className="h-4 w-4" />
              </button>
            )}

            {/* Clinician Avatar */}
            <div className="flex items-center gap-1.5 pl-1.5 border-l border-slate-200">
              <div className="relative h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-800 text-[11px] sm:text-xs font-bold shadow-xs">
                <span>SC</span>
                <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white" />
              </div>
              <div className="hidden sm:block text-left text-xs">
                <p className="font-bold text-slate-900 leading-tight">Dr. S. Chen</p>
                <p className="text-[9px] text-slate-500 font-medium">Attending MD</p>
              </div>
            </div>
          </div>
        </header>

        {/* 2.2 Ward Hero Title & Metric Bar */}
        <section className="py-2.5 sm:py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-slate-100">
          {/* Left: Ward Emblem, Title, Subtitle Pills */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 sm:gap-3">
              {/* Circular AegisPulse Shield Emblem */}
              <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-white border border-emerald-200/80 flex items-center justify-center p-1 shadow-xs overflow-hidden shrink-0">
                <img src="/aegis-logo.png" alt="AegisPulse" className="h-6 w-6 sm:h-7 sm:w-7 object-contain" />
              </div>

              {/* Big Title with Chevron */}
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex flex-col min-w-0">
                  <span className="text-[9px] sm:text-[10px] font-mono uppercase tracking-wider text-emerald-700 font-bold truncate">
                    AegisPulse Deterioration Radar
                  </span>
                  <h1 className="text-base sm:text-xl lg:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-1.5 truncate">
                    <span>St. Jude Acute Care - {wardName.split('—')[0]?.trim() || 'Ward 4B'}</span>
                    <ChevronDown className="h-4 w-4 text-slate-400 cursor-pointer hover:text-slate-700 transition-colors shrink-0" />
                  </h1>
                </div>
              </div>
            </div>

            {/* Overview Stat Pills */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap pt-0.5">
              <span className="bg-[#F3F6F4] text-slate-700 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[11px] sm:text-xs font-semibold flex items-center gap-1.5 border border-slate-200/50">
                <span className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-slate-400" />
                {totalPatients} Beds
              </span>

              {criticalCount > 0 && (
                <span className="bg-[#FDF0ED] text-[#E11D48] border border-rose-200/60 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[11px] sm:text-xs font-semibold flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-rose-500 animate-pulse" />
                  {criticalCount} Critical
                </span>
              )}

              {evaluateCount > 0 && (
                <span className="bg-[#FEF9EE] text-[#D97706] border border-amber-200/60 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[11px] sm:text-xs font-semibold flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-amber-500" />
                  {evaluateCount} Escalating
                </span>
              )}

              <span className="bg-[#EAF7EC] text-[#059669] border border-emerald-200/60 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[11px] sm:text-xs font-semibold flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-emerald-500" />
                {lowCount + watchCount} Stable
              </span>
            </div>
          </div>

          {/* Right: Large Hero Attention Metric & Shift Pill */}
          <div className="flex items-center justify-between md:justify-end gap-3 sm:gap-5 shrink-0 pt-1 md:pt-0 border-t md:border-t-0 border-slate-100">
            {/* Hero Metric */}
            <div className="text-left md:text-right">
              <div className="flex items-baseline md:justify-end gap-1.5">
                <HeartPulse className="h-5 w-5 text-rose-500 animate-pulse" />
                <span className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 font-mono tracking-tight">
                  APS {maxApsScore}
                </span>
                <span className="text-[10px] sm:text-xs font-bold text-rose-600 uppercase tracking-wider">
                  MAX
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] font-semibold text-slate-500 tracking-wide uppercase">
                Peak Deterioration Pressure
              </p>
            </div>

            {/* Shift Picker Pill */}
            <button
              type="button"
              className="bg-[#F3F6F4] hover:bg-slate-100 text-slate-700 border border-slate-200 px-3 py-1 sm:px-4 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-semibold flex items-center gap-1.5 sm:gap-2 transition-colors cursor-pointer shrink-0"
            >
              <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-slate-500" />
              <span className="hidden sm:inline">15 Sep - Morning Shift</span>
              <span className="sm:hidden">Morning Shift</span>
              <ChevronDown className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-slate-400" />
            </button>
          </div>
        </section>

        {/* 2.3 Main Application Content Body */}
        <main className="flex-1 overflow-y-auto pt-2.5 sm:pt-3.5">
          {children}
        </main>
      </div>
    </div>
  );
};
