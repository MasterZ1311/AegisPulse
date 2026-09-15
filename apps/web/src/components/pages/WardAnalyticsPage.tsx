import React from 'react';
import {
  BarChart3,
  TrendingUp,
  AlertOctagon,
  Activity,
  HeartPulse,
  ArrowRight,
  ShieldAlert,
  Clock,
} from 'lucide-react';
import type { WardPatientRadarState } from '../../types/radar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface WardAnalyticsPageProps {
  patients: WardPatientRadarState[];
  onNavigateToPatient: (patient: WardPatientRadarState) => void;
}

export const WardAnalyticsPage: React.FC<WardAnalyticsPageProps> = ({
  patients,
  onNavigateToPatient,
}) => {
  const total = patients.length;
  const critical = patients.filter((p) => p.category === 'CRITICAL_REVIEW');
  const evaluate = patients.filter((p) => p.category === 'EVALUATE');
  const watch = patients.filter((p) => p.category === 'WATCH');
  const low = patients.filter((p) => p.category === 'LOW');

  // Calculate ward averages
  const meanAps = total > 0 ? (patients.reduce((sum, p) => sum + p.apsScore, 0) / total).toFixed(1) : '0';
  const meanHr = total > 0 ? Math.round(patients.reduce((sum, p) => sum + p.vitals.heartRate, 0) / total) : 0;
  const meanRr = total > 0 ? Math.round(patients.reduce((sum, p) => sum + p.vitals.respiratoryRate, 0) / total) : 0;
  const meanSpo2 = total > 0 ? (patients.reduce((sum, p) => sum + p.vitals.spo2, 0) / total).toFixed(1) : '0';

  // Accelerating tachycardia count
  const acceleratingPatients = patients.filter(
    (p) => p.trendDirection === 'RAPIDLY_RISING' || p.trendDirection === 'RISING'
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. Executive Analytics Header */}
      <section className="rounded-xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs transition-colors">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Ward Acuity & Deterioration Analytics
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Surveillance summary of hemodynamic stability, risk distribution, and shock index across all monitored ward beds.
            </p>
          </div>

          <div className="rounded-lg border border-border/50 bg-muted/60 px-3 py-1.5 font-mono text-xs flex items-center gap-2 shrink-0 self-start md:self-auto">
            <Clock className="h-3.5 w-3.5 text-primary" />
            <span className="text-muted-foreground">Rolling Window:</span>
            <span className="font-bold text-foreground">Last 60 Minutes</span>
          </div>
        </div>
      </section>

      {/* 2. Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Mean APS */}
        <Card className="p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider font-mono">
              Mean Ward APS
            </span>
            <Activity className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black font-mono text-foreground">{meanAps}</span>
            <span className="text-xs font-mono text-muted-foreground">/ 100 max</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            {Number(meanAps) > 60 ? 'High baseline acuity across ward' : 'Normal ward acuity distribution'}
          </p>
        </Card>

        {/* Escalating Patients */}
        <Card className="p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider font-mono">
              Acuity Velocity
            </span>
            <TrendingUp className="h-4 w-4 text-rose-500" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black font-mono text-rose-600 dark:text-rose-400">
              {acceleratingPatients.length}
            </span>
            <span className="text-xs font-mono text-muted-foreground">/ {total} deteriorating</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            {acceleratingPatients.length > 0 ? 'Active physiological deterioration detected' : 'All beds stable'}
          </p>
        </Card>

        {/* Mean Vitals */}
        <Card className="p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider font-mono">
              Mean Vital Telemetry
            </span>
            <HeartPulse className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center font-mono">
            <div className="bg-muted/60 border border-border/40 p-1.5 rounded-lg">
              <span className="text-[10px] text-muted-foreground block">HR</span>
              <span className="text-sm font-extrabold text-foreground">{meanHr}</span>
            </div>
            <div className="bg-muted/60 border border-border/40 p-1.5 rounded-lg">
              <span className="text-[10px] text-muted-foreground block">RR</span>
              <span className="text-sm font-extrabold text-foreground">{meanRr}</span>
            </div>
            <div className="bg-muted/60 border border-border/40 p-1.5 rounded-lg">
              <span className="text-[10px] text-muted-foreground block">SpO2</span>
              <span className="text-sm font-extrabold text-foreground">{meanSpo2}%</span>
            </div>
          </div>
        </Card>

        {/* Unacknowledged High Priority */}
        <Card className="p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider font-mono">
              Active Priority Alerts
            </span>
            <AlertOctagon className="h-4 w-4 text-orange-500" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black font-mono text-orange-600 dark:text-orange-400">
              {critical.length + evaluate.length}
            </span>
            <span className="text-xs font-mono text-muted-foreground">require attention</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            {critical.length} Critical Review, {evaluate.length} Evaluate
          </p>
        </Card>
      </div>

      {/* 3. Acuity Tier Distribution Visual Bar */}
      <Card className="p-4 sm:p-6 shadow-xs">
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider font-mono mb-3">
          Ward Triage Acuity Distribution
        </h3>
        {/* Proportional Stacked Bar */}
        <div className="h-5 w-full rounded-xl overflow-hidden flex bg-muted/70 border border-border/50 p-0.5 gap-0.5">
          {critical.length > 0 && (
            <div
              style={{ width: `${(critical.length / total) * 100}%` }}
              className="bg-rose-600 rounded-lg transition-all"
              title={`Critical Review: ${critical.length} beds (${Math.round((critical.length / total) * 100)}%)`}
            />
          )}
          {evaluate.length > 0 && (
            <div
              style={{ width: `${(evaluate.length / total) * 100}%` }}
              className="bg-orange-500 rounded-lg transition-all"
              title={`Evaluate: ${evaluate.length} beds (${Math.round((evaluate.length / total) * 100)}%)`}
            />
          )}
          {watch.length > 0 && (
            <div
              style={{ width: `${(watch.length / total) * 100}%` }}
              className="bg-yellow-400 rounded-lg transition-all"
              title={`Watch: ${watch.length} beds (${Math.round((watch.length / total) * 100)}%)`}
            />
          )}
          {low.length > 0 && (
            <div
              style={{ width: `${(low.length / total) * 100}%` }}
              className="bg-emerald-500 rounded-lg transition-all"
              title={`Low Priority: ${low.length} beds (${Math.round((low.length / total) * 100)}%)`}
            />
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded bg-rose-600 shrink-0" />
            <span className="text-muted-foreground">Critical Review:</span>
            <span className="font-bold text-foreground">{critical.length} ({total > 0 ? Math.round((critical.length / total) * 100) : 0}%)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded bg-orange-500 shrink-0" />
            <span className="text-muted-foreground">Evaluate:</span>
            <span className="font-bold text-foreground">{evaluate.length} ({total > 0 ? Math.round((evaluate.length / total) * 100) : 0}%)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded bg-yellow-400 shrink-0" />
            <span className="text-muted-foreground">Watch:</span>
            <span className="font-bold text-foreground">{watch.length} ({total > 0 ? Math.round((watch.length / total) * 100) : 0}%)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded bg-emerald-500 shrink-0" />
            <span className="text-muted-foreground">Low:</span>
            <span className="font-bold text-foreground">{low.length} ({total > 0 ? Math.round((low.length / total) * 100) : 0}%)</span>
          </div>
        </div>
      </Card>

      {/* 4. Shock Index & Hemodynamic Surveillance Table */}
      <Card className="p-4 sm:p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider font-mono flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-indigo-500" />
              Hemodynamic Surveillance & Shock Index (SI = HR / SBP)
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Shock Index ≥ 0.9 identifies occult hypovolemia or septic decompensation before overt hypotension occurs.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-border/50 text-left text-muted-foreground">
                <th className="pb-2.5 font-bold">Bed</th>
                <th className="pb-2.5 font-bold">Patient</th>
                <th className="pb-2.5 font-bold">HR (bpm)</th>
                <th className="pb-2.5 font-bold">BP (mmHg)</th>
                <th className="pb-2.5 font-bold">Shock Index</th>
                <th className="pb-2.5 font-bold">Hemodynamic Risk</th>
                <th className="pb-2.5 font-bold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {patients.map((p) => {
                const hr = p.vitals.heartRate;
                const sbp = p.vitals.systolicBP;
                const dbp = p.vitals.diastolicBP;
                const si = sbp > 0 ? Number((hr / sbp).toFixed(2)) : 0;
                const isHighShock = si >= 0.9;
                const isModerateShock = si >= 0.7 && si < 0.9;
                const isHrAbnormal = hr > 100 || hr < 55;

                return (
                  <tr key={p.patientId} className="hover:bg-muted/40 transition-colors">
                    <td className="py-3 font-extrabold text-foreground">{p.bedNumber}</td>
                    <td className="py-3 font-sans font-semibold text-foreground">{p.name}</td>
                    <td className={`py-3 ${isHrAbnormal ? 'text-rose-600 font-bold' : 'text-foreground'}`}>
                      {hr}
                    </td>
                    <td className="py-3 text-foreground">
                      {sbp}/{dbp}
                    </td>
                    <td className="py-3">
                      <span
                        className={`px-2 py-0.5 rounded font-black ${
                          isHighShock
                            ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 font-extrabold'
                            : isModerateShock
                            ? 'bg-orange-500/20 text-orange-800 dark:text-orange-300'
                            : 'bg-muted/50 border border-border/40 text-foreground'
                        }`}
                      >
                        {si}
                      </span>
                    </td>
                    <td className="py-3">
                      {isHighShock ? (
                        <span className="text-rose-600 font-bold flex items-center gap-1">
                          <AlertOctagon className="h-3 w-3" />
                          High Occult Risk (SI ≥ 0.9)
                        </span>
                      ) : isModerateShock ? (
                        <span className="text-orange-600 font-medium">Borderline (0.7–0.89)</span>
                      ) : (
                        <span className="text-emerald-700 dark:text-emerald-400">Normal Range (&lt; 0.7)</span>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onNavigateToPatient(p)}
                        className="h-7 text-xs font-semibold gap-1"
                      >
                        <span>Review</span>
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
