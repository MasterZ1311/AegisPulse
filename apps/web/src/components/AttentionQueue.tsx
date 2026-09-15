import React, { useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  Eye,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Minus,
  Radio,
  Clock,
  HeartPulse,
  Wind,
  Droplets,
  Activity,
  ArrowUpDown,
  Check,
} from 'lucide-react';
import type { WardPatientRadarState } from '../types/radar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';

interface AttentionQueueProps {
  patients: WardPatientRadarState[];
  selectedPatientId: string | null;
  focusedPatientIndex: number;
  onSelectPatient: (patient: WardPatientRadarState) => void;
  onAcknowledgePatient: (patientId: string, event: React.MouseEvent) => void;
}

export const AttentionQueue: React.FC<AttentionQueueProps> = ({
  patients,
  selectedPatientId,
  focusedPatientIndex,
  onSelectPatient,
  onAcknowledgePatient,
}) => {
  const [sortBy, setSortBy] = useState<'APS' | 'CATEGORY' | 'BED' | 'FRESHNESS'>('APS');

  // Sort queue dynamically
  const sortedPatients = [...patients].sort((a, b) => {
    switch (sortBy) {
      case 'APS':
        return b.apsScore - a.apsScore;
      case 'CATEGORY': {
        const order: Record<string, number> = {
          CRITICAL_REVIEW: 4,
          EVALUATE: 3,
          WATCH: 2,
          LOW: 1,
        };
        return (order[b.category] || 0) - (order[a.category] || 0) || b.apsScore - a.apsScore;
      }
      case 'BED':
        return a.bedNumber.localeCompare(b.bedNumber);
      case 'FRESHNESS':
        return b.lastTrustedElapsedMinutes - a.lastTrustedElapsedMinutes;
      default:
        return b.apsScore - a.apsScore;
    }
  });

  const getCategoryConfig = (category: string) => {
    switch (category) {
      case 'CRITICAL_REVIEW':
        return {
          badgeVariant: 'critical' as const,
          glow: 'critical' as const,
          borderLeft: 'border-l-rose-600',
          label: 'CRITICAL REVIEW',
          icon: <AlertOctagon className="h-4 w-4 text-rose-600 animate-pulse" />,
        };
      case 'EVALUATE':
        return {
          badgeVariant: 'evaluate' as const,
          glow: 'evaluate' as const,
          borderLeft: 'border-l-orange-500',
          label: 'EVALUATE',
          icon: <AlertTriangle className="h-4 w-4 text-orange-600" />,
        };
      case 'WATCH':
        return {
          badgeVariant: 'watch' as const,
          glow: 'none' as const,
          borderLeft: 'border-l-yellow-400',
          label: 'WATCH',
          icon: <Eye className="h-4 w-4 text-yellow-600" />,
        };
      case 'LOW':
      default:
        return {
          badgeVariant: 'low' as const,
          glow: 'none' as const,
          borderLeft: 'border-l-emerald-600',
          label: 'LOW RISK',
          icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
        };
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'RAPIDLY_RISING':
        return (
          <span className="flex items-center gap-1.5 text-rose-700 dark:text-rose-400 font-black text-xs font-mono">
            <TrendingUp className="h-4 w-4 text-rose-600 dark:text-rose-400 animate-bounce" />
            Rapid Acceleration
          </span>
        );
      case 'RISING':
        return (
          <span className="flex items-center gap-1.5 text-orange-700 dark:text-orange-400 font-bold text-xs font-mono">
            <TrendingUp className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            Trending Up
          </span>
        );
      case 'RECOVERING':
        return (
          <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-bold text-xs font-mono">
            <TrendingDown className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            Stabilizing
          </span>
        );
      case 'STEADY':
      default:
        return (
          <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400 text-xs font-mono font-medium">
            <Minus className="h-3.5 w-3.5" />
            Baseline
          </span>
        );
    }
  };

  return (
    <section aria-label="Ward Primary Attention Queue" className="w-full flex flex-col space-y-4">
      {/* Question & Sort Command Bar */}
      <div className="neu-flat rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-[10px] font-mono tracking-wider uppercase text-sky-700 dark:text-sky-400 font-black block">
            Clinical Attention Allocation
          </span>
          <h2 className="text-base sm:text-lg font-black text-foreground flex items-center gap-2">
            Priority Attention Queue
            <span className="text-xs font-normal text-muted-foreground hidden md:inline">
              ({sortedPatients.length} active beds)
            </span>
          </h2>
        </div>

        {/* Dynamic Sort Controls & Keyboard Legend */}
        <div className="flex items-center gap-3">
          <div className="hidden xl:flex items-center gap-2 text-[11px] font-mono text-slate-700 dark:text-slate-300 neu-inset-sm px-3 py-1.5 rounded-xl font-semibold">
            <span className="text-sky-700 dark:text-sky-400 font-black">KEYS:</span>
            <span>[↑/↓] Navigate</span>
            <span>•</span>
            <span>[1-6] Jump</span>
            <span>•</span>
            <span>[A] Ack</span>
          </div>

          <Select
            icon={<ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            aria-label="Sort Attention Queue By"
            className="w-[180px]"
          >
            <option value="APS">Sort: APS Score</option>
            <option value="CATEGORY">Sort: Urgency Tier</option>
            <option value="BED">Sort: Bed Number</option>
            <option value="FRESHNESS">Sort: Freshness</option>
          </Select>
        </div>
      </div>

      {/* Spacious Restructured Patient Cards */}
      <div className="space-y-4" role="list" aria-label="Patients Queue">
        {sortedPatients.map((patient, index) => {
          const config = getCategoryConfig(patient.category);
          const isSelected = selectedPatientId === patient.patientId;
          const isKeyboardFocused = focusedPatientIndex === index;

          return (
            <Card
              key={patient.patientId}
              glow={patient.category === 'CRITICAL_REVIEW' ? 'critical' : patient.category === 'EVALUATE' ? 'evaluate' : 'none'}
              variant={isSelected ? 'inset' : 'flat'}
              role="listitem"
              tabIndex={0}
              onClick={() => onSelectPatient(patient)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectPatient(patient);
                }
              }}
              className={`relative border-l-[6px] cursor-pointer p-5 transition-all duration-200 ${
                config.borderLeft
              } ${
                isSelected
                  ? 'border-sky-500 ring-2 ring-sky-400/60 shadow-xl'
                  : isKeyboardFocused
                  ? 'border-sky-400 ring-2 ring-sky-500/40'
                  : 'hover:scale-[1.008]'
              }`}
            >
              {/* Card Section 1: Bed Demographics & Priority Badge */}
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-border/60">
                <div className="flex items-center gap-3.5">
                  {/* Bed Number Inset Box */}
                  <div className="neu-inset flex flex-col items-center justify-center h-12 w-16 rounded-xl text-center">
                    <span className="text-[9px] font-mono uppercase text-slate-600 dark:text-slate-400 font-bold">
                      BED
                    </span>
                    <span className="text-sm font-black text-foreground font-mono">
                      {patient.bedNumber}
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-black text-foreground hover:text-sky-600 dark:hover:text-sky-400 transition-colors">
                        {patient.name}
                      </h3>
                      <span className="text-xs font-mono font-semibold text-muted-foreground">
                        ({patient.gender === 'FEMALE' ? 'F' : 'M'}, {patient.age}y)
                      </span>
                      <span className="neu-inset-sm text-[10px] font-mono font-bold px-2 py-0.5 rounded text-slate-700 dark:text-slate-300">
                        {patient.mrn}
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground font-medium mt-0.5">
                      {patient.admissionDiagnosis}
                    </p>
                  </div>
                </div>

                {/* Status Badges on Top-Right */}
                <div className="flex items-center gap-2.5">
                  <Badge variant={config.badgeVariant} dot className="py-1 px-3 text-xs font-mono">
                    {config.label}
                  </Badge>

                  {/* APS Score Pill */}
                  <div className="neu-inset px-3 py-1 rounded-xl flex items-baseline gap-1">
                    <span className="text-[9px] font-mono text-slate-600 dark:text-slate-400 font-bold">APS</span>
                    <span
                      className={`text-xl font-black font-mono tracking-tight ${
                        patient.apsScore >= 80
                          ? 'text-rose-600 dark:text-rose-400'
                          : patient.apsScore >= 60
                          ? 'text-orange-600 dark:text-orange-400'
                          : patient.apsScore >= 35
                          ? 'text-yellow-600 dark:text-yellow-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {patient.apsScore}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 font-medium">/100</span>
                  </div>
                </div>
              </div>

              {/* Card Section 2: Clinical Trigger ("Why Now?") Synthesis */}
              <div className="my-3.5">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-[10px] font-mono uppercase font-black text-slate-700 dark:text-slate-300">
                    PRIMARY CLINICAL TRIGGER:
                  </span>
                  {getTrendIcon(patient.trendDirection)}
                </div>

                <div className="neu-inset rounded-xl p-3.5 text-xs sm:text-sm text-foreground font-medium leading-relaxed border border-border/40">
                  {patient.topContributingReasons[0]?.explanation || patient.whyNowSummary}
                </div>
              </div>

              {/* Card Section 3: High-Contrast Distinct Vitals Channels & Acknowledge Action */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-border/60">
                {/* 4 Distinct Vital Channels: Cardiac Rose, Respiratory Mint, O2 Sky, BP Indigo */}
                <div className="grid grid-cols-4 gap-2.5 flex-1 max-w-xl">
                  {/* HR - Cardiac Channel (Rose Red) */}
                  <div className="rounded-xl p-2.5 text-center neu-inset-sm bg-rose-500/10 border border-rose-500/30">
                    <span className="text-[10px] font-mono font-bold text-rose-700 dark:text-rose-300 flex items-center justify-center gap-1">
                      <HeartPulse className="h-3 w-3 text-rose-600 dark:text-rose-400" /> HR
                    </span>
                    <span className="text-base font-black font-mono text-rose-700 dark:text-rose-300 block my-0.5">
                      {patient.vitals.heartRate}
                    </span>
                    <span className="text-[9px] text-rose-800/80 dark:text-rose-300/80 block font-mono font-semibold">
                      bpm
                    </span>
                  </div>

                  {/* RR - Respiratory Channel (Mint Emerald - NOT Blue!) */}
                  <div className="rounded-xl p-2.5 text-center neu-inset-sm bg-emerald-500/10 border border-emerald-500/30">
                    <span className="text-[10px] font-mono font-bold text-emerald-800 dark:text-emerald-300 flex items-center justify-center gap-1">
                      <Wind className="h-3 w-3 text-emerald-600 dark:text-emerald-400" /> RR
                    </span>
                    <span className="text-base font-black font-mono text-emerald-800 dark:text-emerald-300 block my-0.5">
                      {patient.vitals.respiratoryRate}
                    </span>
                    <span className="text-[9px] text-emerald-900/80 dark:text-emerald-300/80 block font-mono font-semibold">
                      /min
                    </span>
                  </div>

                  {/* SpO2 - Oxygen Channel (Sky Blue) */}
                  <div className="rounded-xl p-2.5 text-center neu-inset-sm bg-sky-500/10 border border-sky-500/30">
                    <span className="text-[10px] font-mono font-bold text-sky-800 dark:text-sky-300 flex items-center justify-center gap-1">
                      <Droplets className="h-3 w-3 text-sky-600 dark:text-sky-400" /> SpO2
                    </span>
                    <span className="text-base font-black font-mono text-sky-800 dark:text-sky-300 block my-0.5">
                      {patient.vitals.spo2}%
                    </span>
                    <span className="text-[9px] text-sky-900/80 dark:text-sky-300/80 block font-mono font-semibold">
                      pulse
                    </span>
                  </div>

                  {/* BP - Hemodynamic Channel (Precision Indigo) */}
                  <div className="rounded-xl p-2.5 text-center neu-inset-sm bg-indigo-500/10 border border-indigo-500/30">
                    <span className="text-[10px] font-mono font-bold text-indigo-800 dark:text-indigo-300 flex items-center justify-center gap-1">
                      <Activity className="h-3 w-3 text-indigo-600 dark:text-indigo-400" /> BP
                    </span>
                    <span className="text-xs font-black font-mono text-indigo-800 dark:text-indigo-300 block my-0.5">
                      {patient.vitals.systolicBP}/{patient.vitals.diastolicBP}
                    </span>
                    <span className="text-[9px] text-indigo-900/80 dark:text-indigo-300/80 block font-mono font-semibold">
                      MAP {patient.vitals.meanArterialPressure}
                    </span>
                  </div>
                </div>

                {/* Telemetry metadata & High-Contrast Acknowledge Button */}
                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                  <div className="text-[10px] font-mono text-muted-foreground text-right">
                    <div className="flex items-center gap-1 justify-end text-foreground font-semibold">
                      <Radio className="h-3 w-3 text-sky-600 dark:text-sky-400" />
                      {patient.signalQuality.confidencePercent}% SNR
                    </div>
                    <div
                      className={`flex items-center gap-1 justify-end mt-0.5 font-semibold ${
                        patient.isStale ? 'text-rose-600 dark:text-rose-400 font-bold' : ''
                      }`}
                    >
                      <Clock className="h-3 w-3" />
                      {patient.lastTrustedElapsedMinutes <= 1
                        ? 'Live'
                        : `${patient.lastTrustedElapsedMinutes}m ago`}
                    </div>
                  </div>

                  <Button
                    variant={patient.isAcknowledged ? 'outline' : 'default'}
                    size="sm"
                    onClick={(e) => onAcknowledgePatient(patient.patientId, e)}
                    title={patient.isAcknowledged ? 'Priority Acknowledged' : 'Acknowledge Priority Alert'}
                    aria-label={`Acknowledge Priority for ${patient.name}`}
                    className={`h-9 px-3.5 text-xs font-mono font-bold ${
                      patient.isAcknowledged
                        ? 'text-emerald-700 dark:text-emerald-400 border border-emerald-500/50 bg-emerald-500/10'
                        : 'bg-sky-600 hover:bg-sky-500 text-white shadow-md shadow-sky-600/30'
                    }`}
                  >
                    <Check className={`h-3.5 w-3.5 ${patient.isAcknowledged ? 'text-emerald-600 dark:text-emerald-400' : 'text-white'}`} />
                    <span>{patient.isAcknowledged ? 'Acked' : 'Acknowledge'}</span>
                    <span className="text-[9px] opacity-80 hidden md:inline">[A]</span>
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
};
