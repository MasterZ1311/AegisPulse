import React, { useState, useMemo } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  Eye,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  HeartPulse,
  Wind,
  Droplets,
  Activity,
  Search,
  SlidersHorizontal,
  ArrowRight,
  Check,
  LayoutGrid,
  List,
} from 'lucide-react';
import type { WardPatientRadarState } from '../../types/radar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

interface WardRadarPageProps {
  patients: WardPatientRadarState[];
  selectedPatientId: string | null;
  onSelectPatient: (patient: WardPatientRadarState) => void;
  onAcknowledgePatient: (patientId: string, event: React.MouseEvent) => void;
  onNavigateToPatient: (patient: WardPatientRadarState) => void;
}

export const WardRadarPage: React.FC<WardRadarPageProps> = ({
  patients,
  selectedPatientId,
  onSelectPatient,
  onAcknowledgePatient,
  onNavigateToPatient,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'CRITICAL_REVIEW' | 'EVALUATE' | 'WATCH' | 'LOW'>('ALL');
  const [sortBy, setSortBy] = useState<'APS' | 'CATEGORY' | 'BED' | 'FRESHNESS'>('APS');
  const [viewMode, setViewMode] = useState<'GRID' | 'LIST'>('GRID');

  // Summary counts
  const totalBeds = patients.length;
  const criticalCount = patients.filter((p) => p.category === 'CRITICAL_REVIEW').length;
  const evaluateCount = patients.filter((p) => p.category === 'EVALUATE').length;
  const watchCount = patients.filter((p) => p.category === 'WATCH').length;
  const lowCount = patients.filter((p) => p.category === 'LOW').length;

  // Filter and sort patients
  const filteredPatients = useMemo(() => {
    return patients
      .filter((patient) => {
        // Search filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = patient.name.toLowerCase().includes(q);
          const matchBed = patient.bedNumber.toLowerCase().includes(q);
          const matchDiag = patient.admissionDiagnosis.toLowerCase().includes(q);
          if (!matchName && !matchBed && !matchDiag) return false;
        }
        // Category filter
        if (categoryFilter !== 'ALL' && patient.category !== categoryFilter) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
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
            return 0;
        }
      });
  }, [patients, searchQuery, categoryFilter, sortBy]);

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'CRITICAL_REVIEW':
        return (
          <Badge variant="destructive" className="gap-1 font-bold text-xs uppercase tracking-wider">
            <AlertOctagon className="h-3 w-3" />
            Critical Review
          </Badge>
        );
      case 'EVALUATE':
        return (
          <Badge variant="evaluate" className="gap-1 font-bold text-xs uppercase tracking-wider">
            <AlertTriangle className="h-3 w-3" />
            Evaluate
          </Badge>
        );
      case 'WATCH':
        return (
          <Badge variant="secondary" className="gap-1 font-semibold text-xs uppercase tracking-wider text-yellow-800 dark:text-yellow-300 bg-yellow-500/15">
            <Eye className="h-3 w-3 text-yellow-600 dark:text-yellow-400" />
            Watch
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="gap-1 font-semibold text-xs uppercase tracking-wider text-emerald-800 dark:text-emerald-300 bg-emerald-500/10">
            <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
            Low Priority
          </Badge>
        );
    }
  };

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case 'RAPIDLY_RISING':
        return <TrendingUp className="h-4 w-4 text-rose-500 stroke-[2.5]" />;
      case 'RISING':
        return <TrendingUp className="h-3.5 w-3.5 text-orange-500" />;
      case 'FALLING':
      case 'RAPIDLY_FALLING':
        return <TrendingDown className="h-3.5 w-3.5 text-emerald-500" />;
      default:
        return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. Executive Triage Summary Ribbon */}
      <Card className="p-4 sm:p-5 transition-colors border-border/70" aria-label="Ward Overview Triage Stats">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
              Ward Deterioration Radar
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30">
                LIVE TELEMETRY
              </span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Deterministic Early Warning Scoring (APS) across all monitored inpatient beds.
            </p>
          </div>

          {/* Metric Stat Pills */}
          <div className="bg-muted/50 border border-border/60 rounded-xl p-1.5 flex items-center gap-1.5 sm:gap-2 overflow-x-auto">
            {/* Total Beds */}
            <div className="px-3 py-1.5 rounded-lg bg-background border border-border/60 flex items-center gap-2 text-xs font-mono shadow-xs shrink-0">
              <span className="text-muted-foreground font-medium">Beds:</span>
              <span className="font-extrabold text-foreground text-sm">{totalBeds}</span>
            </div>

            {/* Critical */}
            <button
              type="button"
              onClick={() => setCategoryFilter(categoryFilter === 'CRITICAL_REVIEW' ? 'ALL' : 'CRITICAL_REVIEW')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-mono transition-all cursor-pointer shrink-0 border ${
                categoryFilter === 'CRITICAL_REVIEW'
                  ? 'bg-rose-600 text-white font-bold border-rose-600 shadow-xs'
                  : criticalCount > 0
                  ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40 font-bold hover:bg-rose-500/25'
                  : 'bg-background text-muted-foreground border-border/60 hover:text-foreground'
              }`}
            >
              <AlertOctagon className="h-3.5 w-3.5 text-rose-500" />
              <span>Critical:</span>
              <span className="font-black text-sm">{criticalCount}</span>
            </button>

            {/* Evaluate */}
            <button
              type="button"
              onClick={() => setCategoryFilter(categoryFilter === 'EVALUATE' ? 'ALL' : 'EVALUATE')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-mono transition-all cursor-pointer shrink-0 border ${
                categoryFilter === 'EVALUATE'
                  ? 'bg-orange-600 text-white font-bold border-orange-600 shadow-xs'
                  : evaluateCount > 0
                  ? 'bg-orange-500/15 text-orange-800 dark:text-orange-300 border-orange-500/40 font-bold hover:bg-orange-500/25'
                  : 'bg-background text-muted-foreground border-border/60 hover:text-foreground'
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-orange-500" />
              <span>Evaluate:</span>
              <span className="font-black text-sm">{evaluateCount}</span>
            </button>

            {/* Watch */}
            <button
              type="button"
              onClick={() => setCategoryFilter(categoryFilter === 'WATCH' ? 'ALL' : 'WATCH')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-mono transition-all cursor-pointer shrink-0 border ${
                categoryFilter === 'WATCH'
                  ? 'bg-amber-600 text-white font-bold border-amber-600 shadow-xs'
                  : 'bg-background text-amber-700 dark:text-amber-300 border-border/60 hover:text-foreground'
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              <span>Watch:</span>
              <span className="font-black text-sm">{watchCount}</span>
            </button>

            {/* Low */}
            <button
              type="button"
              onClick={() => setCategoryFilter(categoryFilter === 'LOW' ? 'ALL' : 'LOW')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-mono transition-all cursor-pointer shrink-0 border ${
                categoryFilter === 'LOW'
                  ? 'bg-emerald-600 text-white font-bold border-emerald-600 shadow-xs'
                  : 'bg-background text-emerald-700 dark:text-emerald-400 border-border/60 hover:text-foreground'
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>Low:</span>
              <span className="font-black text-sm">{lowCount}</span>
            </button>
          </div>
        </div>
      </Card>

      {/* 2. Search, Category Filters, Sorting, and View Switcher */}
      <Card className="p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-border/70">
        <div className="flex items-center gap-2.5 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by bed, patient name, diagnosis..."
              className="pl-9 pr-8 h-8 text-xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Sorting & View Toggle */}
        <div className="flex items-center gap-2.5 flex-wrap justify-end">
          <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
            <SlidersHorizontal className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
            <span className="hidden sm:inline">Sort:</span>
            <Select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-[140px] text-xs h-8"
              aria-label="Sort Ward Patients"
            >
              <option value="APS">APS Score</option>
              <option value="CATEGORY">Urgency Tier</option>
              <option value="BED">Bed Number</option>
              <option value="FRESHNESS">Freshness</option>
            </Select>
          </div>

          <div className="bg-muted/60 border border-border/50 p-0.5 rounded-lg flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => setViewMode('GRID')}
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                viewMode === 'GRID' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('LIST')}
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                viewMode === 'LIST' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Dense List View"
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </Card>

      {/* 3. Empty State */}
      {filteredPatients.length === 0 && (
        <div className="neu-flat rounded-2xl p-12 text-center">
          <p className="text-sm font-semibold text-foreground">No patients matched your filter criteria.</p>
          <p className="text-xs text-muted-foreground mt-1">Try clearing the search or category filters.</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSearchQuery('');
              setCategoryFilter('ALL');
            }}
            className="mt-4"
          >
            Reset Filters
          </Button>
        </div>
      )}

      {/* 4. Patients Cards Grid */}
      {viewMode === 'GRID' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-5">
          {filteredPatients.map((patient) => {
            const isSelected = selectedPatientId === patient.patientId;
            const isCritical = patient.category === 'CRITICAL_REVIEW';
            const isEvaluate = patient.category === 'EVALUATE';

            const hr = patient.vitals.heartRate;
            const isHrAbnormal = hr > 100 || hr < 55;
            const rr = patient.vitals.respiratoryRate;
            const isRrAbnormal = rr > 22 || rr < 10;
            const spo2 = patient.vitals.spo2;
            const isSpo2Abnormal = spo2 < 94;
            const sbp = patient.vitals.systolicBP;
            const dbp = patient.vitals.diastolicBP;
            const isBpAbnormal = sbp < 95 || sbp > 160;

            return (
              <Card
                key={patient.patientId}
                className={`p-4 sm:p-5 transition-all duration-200 relative group flex flex-col justify-between border-border/70 ${
                  isSelected ? 'ring-2 ring-primary bg-accent/30' : 'hover:border-primary/50 hover:shadow-md'
                } ${
                  isCritical
                    ? 'border-l-4 border-l-rose-500'
                    : isEvaluate
                    ? 'border-l-4 border-l-orange-500'
                    : patient.category === 'WATCH'
                    ? 'border-l-4 border-l-amber-500'
                    : 'border-l-4 border-l-emerald-500'
                }`}
              >
                <div>
                  {/* Top Bar: Bed #, Patient Name, Triage Category */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="bg-secondary text-secondary-foreground border border-border/70 px-2.5 py-1 rounded-lg font-mono font-extrabold text-xs shadow-xs">
                        Bed {patient.bedNumber}
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-foreground leading-tight group-hover:text-primary transition-colors">
                          {patient.name}
                        </h3>
                        <p className="text-[11px] text-muted-foreground font-medium">
                          {patient.age}y {patient.gender} • {patient.mrn}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      {getCategoryBadge(patient.category)}
                      <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3 text-sky-600 dark:text-sky-400" />
                        {patient.lastTrustedElapsedMinutes}m ago
                      </span>
                    </div>
                  </div>

                  {/* Diagnosis & Code Status */}
                  <div className="mb-3.5">
                    <p className="text-xs text-foreground/90 font-medium line-clamp-1" title={patient.admissionDiagnosis}>
                      {patient.admissionDiagnosis}
                    </p>
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground mt-1 inline-block border border-border/40">
                      {patient.codeStatus}
                    </span>
                  </div>

                  {/* APS Score + Trend Row */}
                  <div className="bg-muted/40 border border-border/60 rounded-xl p-3 mb-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-11 w-11 rounded-xl flex items-center justify-center font-mono font-black text-lg border shadow-xs ${
                          isCritical
                            ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
                            : isEvaluate
                            ? 'bg-orange-500/15 text-orange-800 dark:text-orange-300 border-orange-500/30'
                            : 'bg-yellow-500/15 text-yellow-800 dark:text-yellow-300 border-yellow-500/30'
                        }`}
                      >
                        {patient.apsScore}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                          <span>APS Score</span>
                          {getTrendIcon(patient.trendDirection)}
                        </div>
                        <p className="text-[11px] text-muted-foreground font-mono">
                          {patient.trendVelocityPointsPerHour > 0
                            ? `+${patient.trendVelocityPointsPerHour} pts/hr`
                            : 'Stable baseline'}
                        </p>
                      </div>
                    </div>

                    {patient.isAcknowledged && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-lg font-mono">
                        <Check className="h-3 w-3" />
                        Ack'd
                      </span>
                    )}
                  </div>

                  {/* 4-Channel Live Vitals Telemetry Pills */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3.5">
                    {/* Heart Rate (Rose) */}
                    <div
                      className={`bg-muted/40 border border-border/50 p-2 rounded-xl text-center ${
                        isHrAbnormal ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/40 font-bold' : ''
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground font-mono">
                        <HeartPulse className="h-3 w-3 text-rose-500" />
                        <span>HR</span>
                      </div>
                      <p className="font-mono font-black text-sm mt-0.5">
                        {hr}
                        <span className="text-[9px] font-normal text-muted-foreground ml-0.5">bpm</span>
                      </p>
                    </div>

                    {/* Respiratory Rate (Emerald) */}
                    <div
                      className={`bg-muted/40 border border-border/50 p-2 rounded-xl text-center ${
                        isRrAbnormal ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 border-emerald-500/40 font-bold' : ''
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground font-mono">
                        <Wind className="h-3 w-3 text-emerald-500" />
                        <span>RR</span>
                      </div>
                      <p className="font-mono font-black text-sm mt-0.5">
                        {rr}
                        <span className="text-[9px] font-normal text-muted-foreground ml-0.5">/m</span>
                      </p>
                    </div>

                    {/* SpO2 (Sky) */}
                    <div
                      className={`bg-muted/40 border border-border/50 p-2 rounded-xl text-center ${
                        isSpo2Abnormal ? 'bg-sky-500/10 text-sky-800 dark:text-sky-200 border-sky-500/40 font-bold' : ''
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground font-mono">
                        <Droplets className="h-3 w-3 text-sky-500" />
                        <span>SpO2</span>
                      </div>
                      <p className="font-mono font-black text-sm mt-0.5">
                        {spo2}
                        <span className="text-[9px] font-normal text-muted-foreground ml-0.5">%</span>
                      </p>
                    </div>

                    {/* Blood Pressure (Indigo) */}
                    <div
                      className={`bg-muted/40 border border-border/50 p-2 rounded-xl text-center ${
                        isBpAbnormal ? 'bg-indigo-500/10 text-indigo-800 dark:text-indigo-200 border-indigo-500/40 font-bold' : ''
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground font-mono">
                        <Activity className="h-3 w-3 text-indigo-500" />
                        <span>BP</span>
                      </div>
                      <p className="font-mono font-black text-xs mt-1">
                        {sbp}/{dbp}
                      </p>
                    </div>
                  </div>

                  {/* Why Now Clinical Reason Preview */}
                  <div className="text-xs text-muted-foreground line-clamp-2 mb-3.5 bg-muted/40 border border-border/40 p-2.5 rounded-lg font-sans">
                    <span className="font-semibold text-foreground">Why Now: </span>
                    {patient.whyNowSummary}
                  </div>
                </div>

                {/* Bottom Action Strip */}
                <div className="flex items-center justify-between gap-2 pt-3 border-t border-border/40">
                  <div className="flex items-center gap-2">
                    {!patient.isAcknowledged && (patient.category === 'CRITICAL_REVIEW' || patient.category === 'EVALUATE') ? (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={(e) => onAcknowledgePatient(patient.patientId, e)}
                        className="bg-sky-600 hover:bg-sky-700 text-white font-bold h-8 text-xs gap-1.5 shadow-xs"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Acknowledge
                      </Button>
                    ) : (
                      <span className="text-[11px] font-mono text-muted-foreground">
                        Bedside verified
                      </span>
                    )}
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onSelectPatient(patient);
                      onNavigateToPatient(patient);
                    }}
                    className="h-8 text-xs font-semibold gap-1 hover:bg-primary hover:text-primary-foreground transition-colors"
                  >
                    <span>Review Patient</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        /* High-Density List View */
        <Card className="divide-y divide-border/50 overflow-hidden border-border/70 shadow-xs">
          {filteredPatients.map((patient) => {
            const isCritical = patient.category === 'CRITICAL_REVIEW';
            const isEvaluate = patient.category === 'EVALUATE';

            const hr = patient.vitals.heartRate;
            const isHrAbnormal = hr > 100 || hr < 55;
            const rr = patient.vitals.respiratoryRate;
            const isRrAbnormal = rr > 22 || rr < 10;
            const spo2 = patient.vitals.spo2;
            const isSpo2Abnormal = spo2 < 94;
            const sbp = patient.vitals.systolicBP;
            const dbp = patient.vitals.diastolicBP;
            const isBpAbnormal = sbp < 95 || sbp > 160;

            return (
              <div
                key={patient.patientId}
                className="p-3.5 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 hover:bg-accent/40 transition-colors"
              >
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="bg-secondary text-secondary-foreground border border-border/70 px-3 py-1.5 rounded-lg font-mono font-extrabold text-xs shadow-xs">
                    Bed {patient.bedNumber}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-foreground">{patient.name}</h4>
                      <span className="text-xs text-muted-foreground font-mono">
                        ({patient.age}y {patient.gender})
                      </span>
                      {getCategoryBadge(patient.category)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{patient.admissionDiagnosis}</p>
                  </div>
                </div>

                {/* Vitals Summary in List */}
                <div className="flex items-center gap-4 font-mono text-xs flex-wrap">
                  <div className={isHrAbnormal ? 'text-rose-600 font-bold' : 'text-muted-foreground'}>
                    HR: <span className="text-foreground font-extrabold">{hr}</span>
                  </div>
                  <div className={isRrAbnormal ? 'text-emerald-700 font-bold' : 'text-muted-foreground'}>
                    RR: <span className="text-foreground font-extrabold">{rr}</span>
                  </div>
                  <div className={isSpo2Abnormal ? 'text-sky-600 font-bold' : 'text-muted-foreground'}>
                    SpO2: <span className="text-foreground font-extrabold">{spo2}%</span>
                  </div>
                  <div className={isBpAbnormal ? 'text-indigo-600 font-bold' : 'text-muted-foreground'}>
                    BP: <span className="text-foreground font-extrabold">{sbp}/{dbp}</span>
                  </div>
                  <div className="neu-inset px-2 py-1 rounded font-black text-sm">
                    APS: {patient.apsScore}
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-auto">
                  {!patient.isAcknowledged && (isCritical || isEvaluate) && (
                    <Button
                      size="sm"
                      variant="default"
                      onClick={(e) => onAcknowledgePatient(patient.patientId, e)}
                      className="bg-sky-600 text-white h-8 text-xs font-bold"
                    >
                      Ack
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onSelectPatient(patient);
                      onNavigateToPatient(patient);
                    }}
                    className="h-8 text-xs font-semibold gap-1"
                  >
                    <span>Review</span>
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
};
