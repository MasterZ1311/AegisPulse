import React, { useState } from 'react';
import {
  X,
  Maximize2,
  Minimize2,
  AlertOctagon,
  AlertTriangle,
  Eye,
  CheckCircle2,
  TrendingUp,
  Clock,
  Radio,
  ShieldCheck,
  HeartPulse,
  Wind,
  Droplets,
  Activity,
  Thermometer,
  FileText,
  UserCheck,
  Flame,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronUp,
  Search,
  HelpCircle,
  Camera,
  QrCode,
} from 'lucide-react';
import type { WardPatientRadarState } from '../types/radar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { OpticalSpotCheckModal } from './OpticalSpotCheckModal';
import { SbarModal } from './SbarModal';
import { BedsideQrModal } from './BedsideQrModal';

interface PatientDetailPanelProps {
  patient: WardPatientRadarState | null;
  isEmbedded?: boolean;
  onClose?: () => void;
  onAcknowledge: (patientId: string, event?: React.MouseEvent) => void;
  onLogAssessment: (patientId: string, note: string) => void;
  onEscalate: (patientId: string) => void;
  onSpotCheckComplete?: (
    patientId: string,
    vitals: { heartRate: number; respiratoryRate?: number | null; confidence: number }
  ) => void;
}

interface ProvenanceModalData {
  title: string;
  derivedValue: string | number;
  calculationFormula: string;
  sourceObservations: string[];
  clinicalRationale: string;
  timestamps: string;
}

export const PatientDetailPanel: React.FC<PatientDetailPanelProps> = ({
  patient,
  isEmbedded: _isEmbedded = false,
  onClose,
  onAcknowledge,
  onLogAssessment,
  onEscalate,
  onSpotCheckComplete,
}) => {
  const [activeTab, setActiveTab] = useState<string>('ALL_OVERVIEW');
  const [expandedProvenanceId, setExpandedProvenanceId] = useState<string | null>(null);
  const [provenanceModal, setProvenanceModal] = useState<ProvenanceModalData | null>(null);
  const [assessmentNote, setAssessmentNote] = useState('');
  const [isAssessmentModalOpen, setIsAssessmentModalOpen] = useState(false);
  const [isSpotCheckModalOpen, setIsSpotCheckModalOpen] = useState(false);
  const [isSbarModalOpen, setIsSbarModalOpen] = useState(false);
  const [isBedsideQrModalOpen, setIsBedsideQrModalOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [completedCheckIds, setCompletedCheckIds] = useState<Record<string, boolean>>({});

  if (!patient) {
    return (
      <Card className="min-h-[440px] flex flex-col items-center justify-center p-8 text-center bg-card border-border/80">
        <Activity className="h-12 w-12 text-muted-foreground mb-4 animate-pulse" />
        <h3 className="text-base font-bold text-foreground font-mono">No Bed Selected</h3>
        <p className="text-xs text-muted-foreground mt-1.5 max-w-xs leading-relaxed">
          Select a patient from the Primary Attention Queue or use keyboard [↑/↓] or [1-6] to inspect clinical trajectory.
        </p>
      </Card>
    );
  }

  const toggleCheck = (id: string) => {
    setCompletedCheckIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const getCategoryConfig = (category: string) => {
    switch (category) {
      case 'CRITICAL_REVIEW':
        return {
          badgeVariant: 'critical' as const,
          label: 'CRITICAL REVIEW',
          icon: <AlertOctagon className="h-4 w-4 text-rose-500 animate-pulse" />,
          cardGlow: 'border-rose-500/40 shadow-rose-500/5',
          textColor: 'text-rose-600 dark:text-rose-400',
        };
      case 'EVALUATE':
        return {
          badgeVariant: 'evaluate' as const,
          label: 'EVALUATE',
          icon: <AlertTriangle className="h-4 w-4 text-orange-500" />,
          cardGlow: 'border-orange-500/40 shadow-orange-500/5',
          textColor: 'text-orange-600 dark:text-orange-400',
        };
      case 'WATCH':
        return {
          badgeVariant: 'watch' as const,
          label: 'WATCH',
          icon: <Eye className="h-4 w-4 text-yellow-500" />,
          cardGlow: 'border-yellow-500/30',
          textColor: 'text-yellow-700 dark:text-yellow-400',
        };
      case 'LOW':
      default:
        return {
          badgeVariant: 'low' as const,
          label: 'LOW RISK',
          icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
          cardGlow: 'border-emerald-500/30',
          textColor: 'text-emerald-700 dark:text-emerald-400',
        };
    }
  };

  const config = getCategoryConfig(patient.category);

  const openProvenance = (
    metricName: string,
    derivedValue: string | number,
    formula: string,
    observations: string[],
    rationale: string
  ) => {
    setProvenanceModal({
      title: metricName,
      derivedValue,
      calculationFormula: formula,
      sourceObservations: observations,
      clinicalRationale: rationale,
      timestamps: new Date(patient.lastTrustedObservationIso).toLocaleTimeString(),
    });
  };

  const containerClass = isMaximized
    ? 'fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-md overflow-y-auto'
    : 'relative w-full flex flex-col';

  const panelCardClass = isMaximized
    ? 'relative w-full max-w-5xl rounded-2xl bg-card border border-border/80 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]'
    : 'w-full flex flex-col rounded-xl bg-card border border-border/80 shadow-xs';

  return (
    <div className={containerClass}>
      <div className={panelCardClass}>
        {/* PANEL HEADER: Bed, Patient Profile & Controls */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-border/50 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-14 sm:h-11 sm:w-16 rounded-xl bg-muted/70 border border-border/60 text-center font-mono font-black text-foreground text-sm shrink-0">
              {patient.bedNumber}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold text-foreground tracking-tight">
                  {patient.name}
                </h3>
                <span className="text-xs font-mono text-muted-foreground">
                  ({patient.gender === 'FEMALE' ? 'F' : 'M'}, {patient.age}y)
                </span>
                <span className="text-[10px] font-mono text-primary font-bold px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20">
                  {patient.mrn}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-sm sm:max-w-md">
                {patient.admissionDiagnosis}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Badge variant={config.badgeVariant} dot className="py-1 px-2.5 text-xs font-mono">
              {config.label}
            </Badge>

            <Button
              variant="outline"
              size="icon"
              onClick={() => setIsMaximized(!isMaximized)}
              className="h-8 w-8 text-muted-foreground hover:text-foreground hidden sm:flex"
              title={isMaximized ? 'Restore View' : 'Maximize View'}
            >
              {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>

            {onClose && (
              <Button
                variant="outline"
                size="icon"
                onClick={onClose}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                aria-label="Close Panel"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-1 flex flex-col overflow-hidden">
          <div className="px-4 sm:px-6 border-b border-border/50 py-2 shrink-0">
            <TabsList className="bg-muted/70 p-1 rounded-xl border border-border/50 h-auto gap-1 grid grid-cols-2 sm:grid-cols-4 w-full">
              <TabsTrigger value="ALL_OVERVIEW" className="gap-1.5 py-1.5 px-2 sm:px-3 text-xs justify-center font-medium">
                <Activity className="h-3.5 w-3.5 shrink-0" />
                <span>Overview</span>
              </TabsTrigger>
              <TabsTrigger value="TRAJECTORY" className="gap-1.5 py-1.5 px-2 sm:px-3 text-xs justify-center font-medium">
                <TrendingUp className="h-3.5 w-3.5 shrink-0" />
                <span>Trajectory (60m)</span>
              </TabsTrigger>
              <TabsTrigger value="RULES_LABS" className="gap-1.5 py-1.5 px-2 sm:px-3 text-xs justify-center font-medium">
                <Flame className="h-3.5 w-3.5 shrink-0" />
                <span>MEWS & Labs</span>
              </TabsTrigger>
              <TabsTrigger value="TIMELINE" className="gap-1.5 py-1.5 px-2 sm:px-3 text-xs justify-center font-medium">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                <span>Audit ({patient.timeline.length})</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* SCROLLABLE BODY */}
          <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
            {/* TAB 1: EXECUTIVE CLINICAL VIEW */}
            <TabsContent value="ALL_OVERVIEW" className="mt-0 space-y-5">
              {/* TOP METRICS STRIP */}
              <div className="rounded-xl border border-border/70 bg-muted/20 p-4 grid grid-cols-2 lg:grid-cols-4 gap-4 items-center">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      openProvenance(
                        'Attention Priority Score (APS)',
                        `${patient.apsScore}/100`,
                        'APS = Σ (ComponentWeight_i × NormalizedScore_i). Bounded in [0, 100].',
                        ['OBS-P003-HR-040', 'OBS-P003-BP-030', 'OBS-P003-RR-032'],
                        'Combines physiological velocity, abnormality bounds, shock index, and comorbidity factors.'
                      )
                    }
                    className="group flex items-baseline gap-2 text-left focus:outline-none cursor-pointer"
                    title="Click to Trace APS Provenance"
                  >
                    <span className="text-xs font-mono text-muted-foreground group-hover:text-primary flex items-center gap-0.5">
                      APS <HelpCircle className="h-3.5 w-3.5 inline" />
                    </span>
                    <span
                      className={`text-3xl sm:text-4xl font-black font-mono tracking-tight group-hover:underline ${
                        patient.apsScore >= 80
                          ? 'text-rose-600 dark:text-rose-400'
                          : patient.apsScore >= 60
                          ? 'text-amber-600 dark:text-amber-400'
                          : patient.apsScore >= 35
                          ? 'text-amber-700 dark:text-amber-300'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {patient.apsScore}
                    </span>
                    <span className="text-xs font-mono text-muted-foreground">/100</span>
                  </button>

                  <div className="border-l border-border/60 pl-3">
                    <span className="text-[10px] font-mono uppercase text-muted-foreground block font-bold">
                      Triage Category
                    </span>
                    <span className={`text-xs font-mono font-bold ${config.textColor}`}>
                      {patient.category.replace('_', ' ')} (Rank #{patient.categoryRank})
                    </span>
                  </div>
                </div>

                <div className="border-l border-border/40 pl-3">
                  <span className="text-[10px] text-muted-foreground uppercase block font-bold font-mono">
                    Trajectory Velocity
                  </span>
                  <span
                    className={`flex items-center gap-1 font-bold text-xs font-mono ${
                      patient.trendDirection === 'RAPIDLY_RISING'
                        ? 'text-rose-600 dark:text-rose-400 animate-pulse'
                        : patient.trendDirection === 'RISING'
                        ? 'text-amber-700 dark:text-amber-400'
                        : patient.trendDirection === 'RECOVERING'
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-foreground'
                    }`}
                  >
                    <TrendingUp className="h-3.5 w-3.5" />
                    {patient.trendDirection.replace('_', ' ')} ({patient.trendVelocityPointsPerHour > 0 ? '+' : ''}
                    {patient.trendVelocityPointsPerHour} pts/hr)
                  </span>
                </div>

                <div className="border-l border-border/40 pl-3">
                  <span className="text-[10px] text-muted-foreground uppercase block font-bold font-mono">
                    Optical Signal Quality
                  </span>
                  <span className="flex items-center gap-1 text-foreground font-semibold text-xs font-mono">
                    <Radio className="h-3.5 w-3.5 text-primary" />
                    {patient.signalQuality.confidencePercent}% SNR ({patient.signalQuality.snrDb} dB)
                  </span>
                </div>

                <div className="border-l border-border/40 pl-3">
                  <span className="text-[10px] text-muted-foreground uppercase block font-bold font-mono">
                    Last Observation
                  </span>
                  <span
                    className={`flex items-center gap-1 text-xs font-mono ${
                      patient.isStale ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-foreground'
                    }`}
                  >
                    <Clock className="h-3.5 w-3.5" />
                    {patient.lastTrustedElapsedMinutes <= 1
                      ? 'Live'
                      : `${patient.lastTrustedElapsedMinutes}m ago`}
                    {patient.isStale && ' [STALE]'}
                  </span>
                </div>
              </div>

              {/* "WHY NOW?" HERO SECTION */}
              <div className={`p-4 sm:p-5 rounded-xl border bg-card shadow-xs ${config.cardGlow}`}>
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-primary animate-ping" />
                    <h4 className="text-xs sm:text-sm font-mono font-bold tracking-wider text-primary uppercase">
                      WHY NOW? — Operational Clinical Synthesis
                    </h4>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    Deterministic Explainability
                  </Badge>
                </div>

                <p className="text-xs sm:text-sm text-foreground font-medium leading-relaxed bg-muted/40 border border-border/50 p-3.5 sm:p-4 rounded-xl">
                  {patient.whyNowSummary}
                </p>

                {/* Ranked Contributing Factors */}
                <div className="mt-4 pt-3 border-t border-border/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-muted-foreground uppercase font-bold">
                      Ranked Mathematical Contributing Factors:
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      Click factor to inspect formula
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {patient.topContributingReasons.map((reason) => {
                      const isExpanded = expandedProvenanceId === reason.id;

                      return (
                        <div
                          key={reason.id}
                          className="rounded-xl border border-border/60 bg-muted/20 p-3.5 flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <Badge
                                variant={
                                  reason.severity === 'CRITICAL'
                                    ? 'critical'
                                    : reason.severity === 'WARNING'
                                    ? 'evaluate'
                                    : 'default'
                                }
                                className="text-[10px] py-0 px-2 font-mono uppercase"
                              >
                                {reason.title}
                              </Badge>
                              <span className="text-xs font-mono font-bold text-primary">
                                {reason.contributionPercent}% impact
                              </span>
                            </div>

                            <p className="text-xs text-foreground leading-relaxed mt-1">
                              {reason.explanation}
                            </p>

                            <div className="mt-2.5 text-[10px] font-mono text-muted-foreground rounded-lg border border-border/50 bg-background/80 px-2.5 py-1.5 flex items-center justify-between">
                              <span>
                                <span>Evidence: </span>
                                <span className="text-foreground font-bold">{reason.evidence.currentValue}</span>
                                {reason.evidence.delta && (
                                  <span className="text-rose-600 dark:text-rose-400 font-bold ml-1">
                                    ({reason.evidence.delta})
                                  </span>
                                )}
                              </span>
                              <button
                                type="button"
                                onClick={() => setExpandedProvenanceId(isExpanded ? null : reason.id)}
                                className="text-[10px] font-mono text-primary hover:underline flex items-center gap-0.5 ml-2 cursor-pointer font-bold"
                              >
                                <span>Inspect</span>
                                {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                              </button>
                            </div>
                          </div>

                          {/* Inline Provenance Expansion */}
                          {isExpanded && (
                            <div className="mt-2.5 p-3 rounded-lg bg-muted/60 border border-primary/30 text-[10px] font-mono text-foreground space-y-1.5">
                              <div className="text-primary font-bold flex items-center gap-1">
                                <Search className="h-3 w-3" /> Provenance Audit Trace:
                              </div>
                              <div>Rule: <span className="text-foreground font-semibold">{reason.provenance.calculationRule}</span></div>
                              <div>Observation IDs: <span className="text-primary font-semibold">{reason.provenance.sourceObservationIds.join(', ')}</span></div>
                              <div>Normalized Weight: <span className="text-amber-600 dark:text-amber-400 font-bold">{reason.provenance.normalizedWeight}</span> (Raw: {reason.provenance.rawScore})</div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* CURRENT STATE VS BASELINE VITALS (HARMONIZED PALETTE) */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-mono uppercase font-bold text-foreground flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" />
                    Bedside Physiological State vs Established Baseline
                  </h4>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    Click vital card to trace derivation
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
                  {/* HR - Crimson Rose */}
                  <div
                    onClick={() =>
                      openProvenance(
                        'Heart Rate Velocity & Baseline Excursion',
                        `${patient.vitals.heartRate} bpm`,
                        `ΔHR = Current (${patient.vitals.heartRate}) - Baseline (${patient.vitals.heartRateBaseline}) = +${patient.vitals.heartRate - patient.vitals.heartRateBaseline} bpm (+51.3%).`,
                        ['OBS-P003-HR-040', 'OBS-P003-HR-000'],
                        'Progressive increase exceeding 0.6 bpm/min slope over 40 minutes.'
                      )
                    }
                    className="p-3.5 rounded-xl cursor-pointer hover:border-rose-500/60 transition-all bg-rose-500/10 border border-rose-500/30 shadow-xs"
                  >
                    <div className="flex items-center justify-between text-muted-foreground text-xs font-mono">
                      <span className="flex items-center gap-1 text-rose-700 dark:text-rose-300 font-bold">
                        <HeartPulse className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" /> HR
                      </span>
                      <span className="text-[9px] font-mono font-semibold px-1 py-0.5 rounded bg-rose-500/10 text-rose-700 dark:text-rose-300">
                        {patient.lastTrustedElapsedMinutes < 2
                          ? 'CURRENT'
                          : `LAST • ${patient.lastTrustedElapsedMinutes}m`}
                      </span>
                    </div>
                    <div className="my-1.5 text-2xl font-black font-mono text-rose-700 dark:text-rose-300">
                      {patient.vitals.heartRate}
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground">
                      Base: {patient.vitals.heartRateBaseline}
                      <span
                        className={`block font-bold ${
                          patient.vitals.heartRate - patient.vitals.heartRateBaseline > 20
                            ? 'text-rose-600 dark:text-rose-400'
                            : ''
                        }`}
                      >
                        Δ {patient.vitals.heartRate - patient.vitals.heartRateBaseline > 0 ? '+' : ''}
                        {patient.vitals.heartRate - patient.vitals.heartRateBaseline}
                      </span>
                    </div>
                  </div>

                  {/* RR - Mint Emerald */}
                  <div
                    onClick={() =>
                      openProvenance(
                        'Respiratory Rate Persistence',
                        `${patient.vitals.respiratoryRate} /min`,
                        `ΔRR = Current (${patient.vitals.respiratoryRate}) - Baseline (${patient.vitals.respiratoryRateBaseline}) = +${patient.vitals.respiratoryRate - patient.vitals.respiratoryRateBaseline} /min. Sustained > 24 /min for 32m.`,
                        ['OBS-P003-RR-032'],
                        'qSOFA Tachypnea criterion met (RR ≥ 22 /min).'
                      )
                    }
                    className="p-3.5 rounded-xl cursor-pointer hover:border-emerald-500/60 transition-all bg-emerald-500/10 border border-emerald-500/30 shadow-xs"
                  >
                    <div className="flex items-center justify-between text-muted-foreground text-xs font-mono">
                      <span className="flex items-center gap-1 text-emerald-800 dark:text-emerald-300 font-bold">
                        <Wind className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> RR
                      </span>
                      <span className="text-[9px] font-mono font-semibold px-1 py-0.5 rounded bg-emerald-500/10 text-emerald-800 dark:text-emerald-300">
                        {patient.lastTrustedElapsedMinutes < 2
                          ? 'CURRENT'
                          : `LAST • ${patient.lastTrustedElapsedMinutes}m`}
                      </span>
                    </div>
                    <div className="my-1.5 text-2xl font-black font-mono text-emerald-800 dark:text-emerald-300">
                      {patient.vitals.respiratoryRate}
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground">
                      Base: {patient.vitals.respiratoryRateBaseline}
                      <span
                        className={`block font-bold ${
                          patient.vitals.respiratoryRate - patient.vitals.respiratoryRateBaseline > 6
                            ? 'text-rose-600 dark:text-rose-400'
                            : ''
                        }`}
                      >
                        Δ {patient.vitals.respiratoryRate - patient.vitals.respiratoryRateBaseline > 0 ? '+' : ''}
                        {patient.vitals.respiratoryRate - patient.vitals.respiratoryRateBaseline}
                      </span>
                    </div>
                  </div>

                  {/* SpO2 - Sky Blue */}
                  <div
                    onClick={() =>
                      openProvenance(
                        'Pulse Oximetry (SpO2)',
                        `${patient.vitals.spo2}%`,
                        `Optical pulse waveform SpO2 derived from dual-wavelength rPPG ratio. Baseline: ${patient.vitals.spo2Baseline}%.`,
                        ['OBS-P003-SPO2-010'],
                        'Delivery Mode: ' + patient.vitals.oxygenDelivery
                      )
                    }
                    className="p-3.5 rounded-xl cursor-pointer hover:border-sky-500/60 transition-all bg-sky-500/10 border border-sky-500/30 shadow-xs"
                  >
                    <div className="flex items-center justify-between text-muted-foreground text-xs font-mono">
                      <span className="flex items-center gap-1 text-sky-800 dark:text-sky-300 font-bold">
                        <Droplets className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" /> SpO2
                      </span>
                      <span className="text-[9px]">pulse</span>
                    </div>
                    <div className="my-1.5 text-2xl font-black font-mono text-sky-800 dark:text-sky-300">
                      {patient.vitals.spo2}%
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground truncate">
                      {patient.vitals.oxygenDelivery}
                    </div>
                  </div>

                  {/* BP / MAP - Precision Indigo */}
                  <div
                    onClick={() =>
                      openProvenance(
                        'Mean Arterial Pressure (MAP)',
                        `${patient.vitals.meanArterialPressure} mmHg`,
                        `MAP = DBP + 1/3 (SBP - DBP) = ${patient.vitals.diastolicBP} + 1/3 (${patient.vitals.systolicBP} - ${patient.vitals.diastolicBP}) = ${patient.vitals.meanArterialPressure} mmHg.`,
                        ['OBS-P003-BP-030'],
                        'Narrow pulse pressure indicates reduced stroke volume or peripheral vasoconstriction.'
                      )
                    }
                    className="p-3.5 rounded-xl cursor-pointer hover:border-indigo-500/60 transition-all bg-indigo-500/10 border border-indigo-500/30 shadow-xs"
                  >
                    <div className="flex items-center justify-between text-muted-foreground text-xs font-mono">
                      <span className="flex items-center gap-1 text-indigo-800 dark:text-indigo-300 font-bold">
                        <Activity className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" /> BP / MAP
                      </span>
                      <span className="text-[9px]">mmHg</span>
                    </div>
                    <div className="my-1.5 text-lg font-black font-mono text-indigo-800 dark:text-indigo-300">
                      {patient.vitals.systolicBP}/{patient.vitals.diastolicBP}
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground">
                      MAP: <span className="font-bold text-foreground">{patient.vitals.meanArterialPressure}</span>
                    </div>
                  </div>

                  {/* Shock Index - Warm Amber */}
                  <div
                    onClick={() =>
                      openProvenance(
                        'Shock Index (SI)',
                        patient.vitals.shockIndex.toFixed(2),
                        `Shock Index = HR (${patient.vitals.heartRate}) / SBP (${patient.vitals.systolicBP}) = ${(patient.vitals.heartRate / patient.vitals.systolicBP).toFixed(2)}. Normal range: 0.5 - 0.7.`,
                        ['OBS-P003-HR-040', 'OBS-P003-BP-030'],
                        'SI ≥ 1.0 indicates severe hemodynamic instability or occult shock.'
                      )
                    }
                    className="p-3.5 rounded-xl cursor-pointer hover:border-amber-500/60 transition-all bg-amber-500/10 border border-amber-500/30 shadow-xs"
                  >
                    <div className="flex items-center justify-between text-muted-foreground text-xs font-mono">
                      <span className="flex items-center gap-1 text-amber-800 dark:text-amber-300 font-bold">
                        <Activity className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" /> Shock Index
                      </span>
                      <span className="text-[9px]">HR/SBP</span>
                    </div>
                    <div className="my-1.5">
                      <span
                        className={`text-2xl font-black font-mono ${
                          patient.vitals.shockIndex >= 1.0
                            ? 'text-rose-600 dark:text-rose-400'
                            : patient.vitals.shockIndex >= 0.8
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-foreground'
                        }`}
                      >
                        {patient.vitals.shockIndex.toFixed(2)}
                      </span>
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground">
                      Normal &lt; 0.70
                    </div>
                  </div>

                  {/* Temp / AVPU - Ochre Amber */}
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 shadow-xs">
                    <div className="flex items-center justify-between text-muted-foreground text-xs font-mono">
                      <span className="flex items-center gap-1 text-amber-800 dark:text-amber-300 font-bold">
                        <Thermometer className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" /> Temp/AVPU
                      </span>
                    </div>
                    <div className="my-1.5 text-2xl font-black font-mono text-foreground">
                      {patient.vitals.bodyTemperature}°C
                    </div>
                    <div className="text-[10px] font-mono text-primary font-bold">
                      AVPU: {patient.vitals.avpu}
                    </div>
                  </div>
                </div>
              </div>

              {/* RECOMMENDED HUMAN VERIFICATION CHECKLIST */}
              <div className="p-4 sm:p-5 rounded-xl border border-border/80 bg-card shadow-xs">
                <h5 className="text-xs font-mono uppercase font-bold text-foreground mb-3 flex items-center gap-2">
                  <CheckSquare className="h-4 w-4 text-primary" />
                  Recommended Bedside Verification Checklist
                </h5>

                <div className="space-y-2">
                  {patient.recommendedVerifications.map((check) => {
                    const isChecked = completedCheckIds[check.id] ?? check.completed;

                    return (
                      <div
                        key={check.id}
                        onClick={() => toggleCheck(check.id)}
                        className={`p-3 rounded-xl border border-border/50 flex items-start gap-3 cursor-pointer transition-all duration-150 ${
                          isChecked
                            ? 'bg-muted/40 opacity-80'
                            : 'bg-muted/10 hover:bg-muted/30'
                        }`}
                      >
                        <div className="mt-0.5">
                          {isChecked ? (
                            <CheckSquare className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <Square className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className={`text-xs font-semibold ${isChecked ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                            {check.text}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                            Rationale: {check.rationale}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* NON-INVASIVE OPTICAL TELEMETRY PRIVACY SEAL & SPOT-CHECK TRIGGER */}
              <div className="rounded-xl border border-border/60 bg-muted/30 p-3 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
                <div className="flex items-center gap-2 text-foreground font-medium flex-wrap">
                  <Radio className="h-4 w-4 text-primary" />
                  <span>rPPG Optical Pulse ({patient.signalQuality.cameraDeviceId})</span>
                  <span className="text-muted-foreground">|</span>
                  <span className="text-muted-foreground">{patient.signalQuality.illuminationLux} Lux</span>
                  <span className="text-muted-foreground">|</span>
                  <Badge variant="low" className="text-[10px] py-0 px-2 font-mono">
                    <ShieldCheck className="h-3.5 w-3.5 mr-1 text-emerald-500" />
                    Zero Video Stored
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsBedsideQrModalOpen(true)}
                    className="border-primary/40 hover:bg-primary/10 text-primary font-bold font-mono text-xs gap-1.5 h-8 px-3 cursor-pointer"
                  >
                    <QrCode className="h-3.5 w-3.5" />
                    <span>Mobile Bedside QR</span>
                  </Button>

                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => setIsSpotCheckModalOpen(true)}
                    className="font-bold font-mono text-xs gap-1.5 h-8 px-3 shadow-xs cursor-pointer"
                  >
                    <Camera className="h-3.5 w-3.5" />
                    <span>Launch 15s Optical Spot-Check</span>
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: MULTIVARIATE TRAJECTORY PLOT */}
            <TabsContent value="TRAJECTORY" className="mt-0 space-y-4">
              <div className="p-4 sm:p-5 rounded-xl border border-border/80 bg-card shadow-xs">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <h4 className="text-xs font-bold text-foreground font-mono flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    Multivariate Physiological Trajectory (Last 60 Minutes)
                  </h4>
                  <div className="flex items-center gap-4 text-xs font-mono">
                    <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-bold">
                      <span className="h-2.5 w-2.5 bg-rose-500 inline-block rounded-full" /> HR (bpm)
                    </span>
                    <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                      <span className="h-2.5 w-2.5 bg-emerald-500 inline-block rounded-full" /> RR (/min)
                    </span>
                    <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-bold">
                      <span className="h-2.5 w-2.5 bg-amber-500 inline-block rounded-full" /> APS Score
                    </span>
                  </div>
                </div>

                <div className="h-56 w-full rounded-xl p-4 bg-muted/30 border border-border/50 relative flex items-end">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 500 200" preserveAspectRatio="none">
                    <line x1="0" y1="50" x2="500" y2="50" stroke="currentColor" className="text-border/40" strokeDasharray="3 3" />
                    <line x1="0" y1="100" x2="500" y2="100" stroke="currentColor" className="text-border/40" strokeDasharray="3 3" />
                    <line x1="0" y1="150" x2="500" y2="150" stroke="currentColor" className="text-border/40" strokeDasharray="3 3" />

                    {/* HR Polyline - Crimson Rose */}
                    <polyline
                      fill="none"
                      stroke="#f43f5e"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      points={patient.trajectory
                        .map((pt, i) => {
                          const x = (i / (patient.trajectory.length - 1)) * 500;
                          const y = 180 - ((pt.heartRate - 60) / 70) * 160;
                          return `${x},${y}`;
                        })
                        .join(' ')}
                    />

                    {/* RR Polyline - Emerald Mint */}
                    <polyline
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeDasharray="4 3"
                      points={patient.trajectory
                        .map((pt, i) => {
                          const x = (i / (patient.trajectory.length - 1)) * 500;
                          const y = 180 - ((pt.respiratoryRate - 10) / 25) * 160;
                          return `${x},${y}`;
                        })
                        .join(' ')}
                    />

                    {/* APS Polyline - Amber Gold */}
                    <polyline
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="3.5"
                      points={patient.trajectory
                        .map((pt, i) => {
                          const x = (i / (patient.trajectory.length - 1)) * 500;
                          const y = 190 - (pt.apsScore / 100) * 170;
                          return `${x},${y}`;
                        })
                        .join(' ')}
                    />

                    {/* Data Points */}
                    {patient.trajectory.map((pt, i) => {
                      const x = (i / (patient.trajectory.length - 1)) * 500;
                      const yHR = 180 - ((pt.heartRate - 60) / 70) * 160;
                      const yAPS = 190 - (pt.apsScore / 100) * 170;

                      return (
                        <g key={i}>
                          <circle cx={x} cy={yHR} r="4.5" fill="#f43f5e" />
                          <circle cx={x} cy={yAPS} r="4.5" fill="#f59e0b" />
                        </g>
                      );
                    })}
                  </svg>
                </div>

                <div className="flex justify-between text-xs font-mono text-muted-foreground mt-3 px-1">
                  {patient.trajectory.map((pt, i) => (
                    <span key={i} className="font-semibold">{pt.timeOffsetMinutes === 0 ? 'NOW' : `${pt.timeOffsetMinutes}m`}</span>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* TAB 3: RULES & LABS */}
            <TabsContent value="RULES_LABS" className="mt-0 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* MEWS Card - Amber */}
                <div className="p-4 sm:p-5 rounded-xl border border-border/80 bg-card shadow-xs">
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="text-xs font-mono uppercase font-bold text-foreground flex items-center gap-1.5">
                      <Flame className="h-4 w-4 text-amber-500" />
                      MEWS Score: {patient.mews.totalScore} / 14
                    </h5>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        openProvenance(
                          'Modified Early Warning Score (MEWS)',
                          patient.mews.totalScore,
                          'MEWS = HR_pts (2) + RR_pts (2) + SBP_pts (1) + Temp_pts (0) + AVPU_pts (1) = 6.',
                          ['OBS-P003-ALL'],
                          'Deterministic standard scoring based on documented protocol thresholds.'
                        )
                      }
                      className="h-7 px-2 text-[11px] font-mono text-primary"
                    >
                      <Search className="h-3 w-3 mr-1" /> Trace Points
                    </Button>
                  </div>

                  <div className="space-y-1.5 text-xs font-mono">
                    {patient.mews.breakdown.map((row, i) => (
                      <div key={i} className="p-2 rounded-lg bg-muted/40 border border-border/40 flex justify-between">
                        <span className="text-foreground">{row.parameter}: <span className="font-bold">{row.value}</span></span>
                        <span className="font-extrabold text-amber-600 dark:text-amber-400">+{row.points} pt</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* qSOFA Card - Crimson */}
                {patient.qsofa && (
                  <div className="p-4 sm:p-5 rounded-xl border border-border/80 bg-card shadow-xs">
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="text-xs font-mono uppercase font-bold text-foreground flex items-center gap-1.5">
                        <AlertOctagon className="h-4 w-4 text-rose-500" />
                        qSOFA Sepsis Screening: {patient.qsofa.criteriaMet} / 3 Criteria
                      </h5>
                      <Badge variant="critical" className="text-[10px] font-mono font-bold">
                        SEPSIS ALERT
                      </Badge>
                    </div>

                    <div className="space-y-1.5 text-xs font-mono">
                      {patient.qsofa.breakdown.map((q, i) => (
                        <div
                          key={i}
                          className={`p-2 rounded-lg border border-border/40 flex justify-between ${
                            q.isMet ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300 font-bold border-rose-500/30' : 'bg-muted/40 text-muted-foreground'
                          }`}
                        >
                          <span>{q.criterion}</span>
                          <span className="font-bold">{q.value} ({q.isMet ? 'MET (+1)' : '0'})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Diagnostic Labs - Precision Indigo */}
              <div className="p-4 sm:p-5 rounded-xl border border-border/80 bg-card shadow-xs">
                <h5 className="text-xs font-mono uppercase font-bold text-foreground flex items-center gap-2 mb-3">
                  <Activity className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  Diagnostic Laboratory Results
                </h5>

                {patient.labs.length ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs font-mono">
                    {patient.labs.map((lab) => (
                      <div key={lab.id} className="p-3 rounded-xl bg-muted/30 border border-border/40 flex items-center justify-between">
                        <div>
                          <span className="text-foreground font-bold block">{lab.testName}</span>
                          <span className="text-[10px] text-muted-foreground">
                            Ref: {lab.referenceRange.low}-{lab.referenceRange.high} {lab.unit}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className={`text-sm font-extrabold block ${lab.isCritical ? 'text-rose-600 dark:text-rose-400' : 'text-foreground'}`}>
                            {lab.value} {lab.unit}
                          </span>
                          <Badge variant={lab.isCritical ? 'critical' : 'low'} className="text-[9px] py-0 px-1.5">
                            {lab.isCritical ? 'CRITICAL' : 'NORMAL'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground font-mono">No abnormal laboratory values recorded.</p>
                )}
              </div>
            </TabsContent>

            {/* TAB 4: AUDIT TIMELINE */}
            <TabsContent value="TIMELINE" className="mt-0 space-y-3">
              <h4 className="text-xs font-bold text-foreground font-mono uppercase">Monotonic Audit Event Ledger</h4>
              <div className="relative border-l-2 border-border/60 ml-3 space-y-3">
                {patient.timeline.map((event) => (
                  <div key={event.id} className="relative pl-5">
                    <span
                      className={`absolute -left-[9px] top-2 h-4 w-4 rounded-full border-2 border-background ${
                        event.severity === 'CRITICAL'
                          ? 'bg-rose-500 shadow-sm shadow-rose-500/40'
                          : event.severity === 'WARNING'
                          ? 'bg-amber-500 shadow-sm shadow-amber-500/40'
                          : 'bg-primary shadow-sm shadow-primary/40'
                      }`}
                    />
                    <div className="p-3 rounded-xl border border-border/70 bg-card shadow-xs text-xs">
                      <div className="flex items-center justify-between gap-1 mb-1 font-mono">
                        <span className="font-bold text-foreground">{event.title}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-muted-foreground text-[11px] leading-relaxed">{event.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          </div>

          {/* PANEL FOOTER: Clinical Actions */}
          <div className="px-4 sm:px-6 py-3.5 border-t border-border/50 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="text-xs font-mono text-muted-foreground">
              <span>Nurse: <span className="text-foreground font-bold">{patient.primaryNurse}</span></span>
              <span className="mx-2">•</span>
              <span className={patient.isAcknowledged ? 'text-emerald-700 dark:text-emerald-400 font-bold' : 'text-amber-700 dark:text-amber-400 font-bold'}>
                {patient.isAcknowledged ? 'Priority Acknowledged' : 'Bedside Verification Pending'}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSpotCheckModalOpen(true)}
                className="font-mono text-xs font-semibold gap-1.5 text-primary hover:text-primary"
              >
                <Camera className="h-3.5 w-3.5" />
                <span>Optical Spot-Check</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSbarModalOpen(true)}
                className="font-mono text-xs font-semibold gap-1.5 text-foreground"
              >
                <FileText className="h-3.5 w-3.5 text-amber-500" />
                <span>Generate SBAR</span>
              </Button>

              <Button
                variant={patient.isAcknowledged ? 'outline' : 'default'}
                size="sm"
                onClick={(e) => onAcknowledge(patient.patientId, e)}
                className={`font-mono text-xs font-bold ${
                  patient.isAcknowledged ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-400' : ''
                }`}
              >
                <UserCheck className="h-3.5 w-3.5 mr-1" />
                <span>{patient.isAcknowledged ? 'Acknowledged' : 'Acknowledge Priority'}</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAssessmentModalOpen(true)}
                className="font-mono text-xs"
              >
                <FileText className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                <span>Log Assessment</span>
              </Button>

              <Button
                variant="destructive"
                size="sm"
                onClick={() => onEscalate(patient.patientId)}
                className="font-mono text-xs font-bold shadow-sm shadow-rose-600/30"
              >
                <AlertOctagon className="h-3.5 w-3.5 mr-1" />
                <span>Escalate (RRT)</span>
              </Button>
            </div>
          </div>
        </Tabs>
      </div>

      {/* DETERMINISTIC PROVENANCE MODAL */}
      {provenanceModal && (
        <Dialog open={Boolean(provenanceModal)} onOpenChange={(open) => !open && setProvenanceModal(null)}>
          <DialogContent onClose={() => setProvenanceModal(null)} className="font-mono text-xs max-w-lg border-border/50">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-primary" />
                <DialogTitle className="text-sm font-bold text-foreground">
                  Deterministic Provenance Trace
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-muted-foreground">
                Formula and raw sensor inputs derived mathematically
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div>
                <span className="text-muted-foreground block text-[10px]">Derived Metric:</span>
                <span className="text-sm font-bold text-foreground">{provenanceModal.title}</span>
              </div>

              <div>
                <span className="text-muted-foreground block text-[10px]">Calculated Value:</span>
                <span className="text-base font-bold text-primary">{provenanceModal.derivedValue}</span>
              </div>

              <div className="p-3 rounded-xl bg-muted/50 border border-border/50">
                <span className="text-muted-foreground block text-[10px] mb-1">Calculation Formula:</span>
                <span className="text-amber-600 dark:text-amber-400 font-semibold">{provenanceModal.calculationFormula}</span>
              </div>

              <div className="p-3 rounded-xl bg-muted/50 border border-border/50">
                <span className="text-muted-foreground block text-[10px] mb-1">Source Observation Records:</span>
                <span className="text-foreground">{provenanceModal.sourceObservations.join(', ')}</span>
              </div>

              <div>
                <span className="text-muted-foreground block text-[10px]">Clinical Rationale:</span>
                <span className="text-foreground">{provenanceModal.clinicalRationale}</span>
              </div>
            </div>

            <div className="flex justify-end pt-3">
              <Button variant="secondary" size="sm" onClick={() => setProvenanceModal(null)}>
                Close Trace
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* NURSE ASSESSMENT MODAL */}
      {isAssessmentModalOpen && (
        <Dialog open={isAssessmentModalOpen} onOpenChange={setIsAssessmentModalOpen}>
          <DialogContent onClose={() => setIsAssessmentModalOpen(false)} className="max-w-md border-border/50">
            <DialogHeader>
              <DialogTitle className="text-sm font-bold text-foreground font-mono">
                Log Bedside Physical Exam
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Record findings, manual radial pulse, or manual cuff verification.
              </DialogDescription>
            </DialogHeader>

            <Textarea
              value={assessmentNote}
              onChange={(e) => setAssessmentNote(e.target.value)}
              placeholder="e.g. Bedside pulse auscultated at 116 bpm, manual cuff BP 96/60, cold extremities..."
              rows={4}
              className="mt-2"
            />

            <div className="flex justify-end gap-2 mt-4">
              <Button variant="ghost" size="sm" onClick={() => setIsAssessmentModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  if (assessmentNote.trim()) {
                    onLogAssessment(patient.patientId, assessmentNote);
                    setAssessmentNote('');
                    setIsAssessmentModalOpen(false);
                  }
                }}
              >
                Submit Audit Entry
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
      {/* 15-SECOND OPTICAL SPOT-CHECK MODAL */}
      <OpticalSpotCheckModal
        isOpen={isSpotCheckModalOpen}
        onClose={() => setIsSpotCheckModalOpen(false)}
        patient={patient}
        onCommitVitals={(pId, vitals) => {
          if (onSpotCheckComplete) {
            onSpotCheckComplete(pId, vitals);
          } else {
            const rrStr = vitals.respiratoryRate ? `, RR ${vitals.respiratoryRate} /min` : '';
            onLogAssessment(
              pId,
              `15-Second Optical Spot-Check: HR ${vitals.heartRate} bpm${rrStr} (SQI ${vitals.confidence}%). Zero raw video stored.`
            );
          }
        }}
      />

      {/* SBAR CLINICAL HANDOFF DOSSIER MODAL */}
      <SbarModal
        isOpen={isSbarModalOpen}
        onClose={() => setIsSbarModalOpen(false)}
        patient={patient}
      />

      {/* BEDSIDE MOBILE QR MODAL */}
      <BedsideQrModal
        isOpen={isBedsideQrModalOpen}
        onClose={() => setIsBedsideQrModalOpen(false)}
        patientId={patient.patientId}
        bedNumber={patient.bedNumber}
      />
    </div>
  );
};
