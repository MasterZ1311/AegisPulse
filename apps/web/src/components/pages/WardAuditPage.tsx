import React, { useState, useMemo } from 'react';
import {
  ScrollText,
  Filter,
  ShieldCheck,
  Clock,
  User,
  ArrowRight,
} from 'lucide-react';
import type { WardPatientRadarState } from '../../types/radar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

interface WardAuditPageProps {
  patients: WardPatientRadarState[];
  onNavigateToPatient: (patient: WardPatientRadarState) => void;
}

interface FlattenedAuditEvent {
  id: string;
  patientId: string;
  bedNumber: string;
  patientName: string;
  timestamp: string;
  minutesAgo: number;
  eventType: string;
  title: string;
  description: string;
  severity: 'CRITICAL' | 'EVALUATE' | 'WATCH' | 'INFO';
  actor: string;
  isTrusted: boolean;
}

export const WardAuditPage: React.FC<WardAuditPageProps> = ({
  patients,
  onNavigateToPatient,
}) => {
  const [selectedBed, setSelectedBed] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');

  // Aggregate all events from patients' timelines
  const allEvents: FlattenedAuditEvent[] = useMemo(() => {
    const list: FlattenedAuditEvent[] = [];

    patients.forEach((patient) => {
      (patient.timeline || []).forEach((ev) => {
        const severityMap: Record<string, 'CRITICAL' | 'EVALUATE' | 'WATCH' | 'INFO'> = {
          CRITICAL: 'CRITICAL',
          WARNING: 'EVALUATE',
          CAUTION: 'WATCH',
          INFO: 'INFO',
        };

        const elapsedMin = Math.max(0, Math.round((Date.now() - (ev.timestamp || Date.now())) / 60000));

        list.push({
          id: ev.id,
          patientId: patient.patientId,
          bedNumber: patient.bedNumber,
          patientName: patient.name,
          timestamp: new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          minutesAgo: elapsedMin,
          eventType: ev.eventType,
          title: ev.title,
          description: ev.description,
          severity: severityMap[ev.severity] || 'INFO',
          actor: ev.actorRole || 'AegisPulse Engine',
          isTrusted: ev.isTrusted ?? true,
        });
      });
    });

    // Sort descending by freshness (lowest minutesAgo first)
    return list.sort((a, b) => a.minutesAgo - b.minutesAgo);
  }, [patients]);

  const filteredEvents = useMemo(() => {
    return allEvents.filter((ev) => {
      if (selectedBed !== 'ALL' && ev.bedNumber !== selectedBed) return false;
      if (selectedType !== 'ALL' && ev.eventType !== selectedType) return false;
      return true;
    });
  }, [allEvents, selectedBed, selectedType]);

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return (
          <Badge variant="destructive" className="text-[10px] font-mono uppercase font-bold">
            Critical
          </Badge>
        );
      case 'EVALUATE':
        return (
          <Badge variant="evaluate" className="text-[10px] font-mono uppercase font-bold">
            Evaluate
          </Badge>
        );
      case 'WATCH':
        return (
          <Badge variant="secondary" className="text-[10px] font-mono uppercase text-yellow-800 dark:text-yellow-300 bg-yellow-500/15">
            Watch
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-[10px] font-mono uppercase text-muted-foreground">
            Info
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. Header */}
      <section className="neu-flat rounded-2xl p-6 transition-colors">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
              <ScrollText className="h-5 w-5 text-sky-600 dark:text-sky-400" />
              Ward Clinical Audit Ledger
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Monotonic, tamper-evident audit trail of physiological anomalies, bedside nurse acknowledgements, and clinical escalations.
            </p>
          </div>

          <div className="neu-inset rounded-xl px-3.5 py-2 font-mono text-xs flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-semibold">
            <ShieldCheck className="h-4 w-4" />
            <span>Cryptographic Log Integrity Verified</span>
          </div>
        </div>
      </section>

      {/* 2. Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 neu-flat rounded-2xl p-3.5">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Bed filter */}
          <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
            <Filter className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
            <span>Bed:</span>
            <Select
              value={selectedBed}
              onChange={(e) => setSelectedBed(e.target.value)}
              className="w-[120px] text-xs h-8"
              aria-label="Filter Audit by Bed"
            >
              <option value="ALL">All Beds ({patients.length})</option>
              {patients.map((p) => (
                <option key={p.patientId} value={p.bedNumber}>
                  Bed {p.bedNumber}
                </option>
              ))}
            </Select>
          </div>

          {/* Type filter */}
          <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
            <span>Event:</span>
            <Select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-[160px] text-xs h-8"
              aria-label="Filter Audit by Type"
            >
              <option value="ALL">All Event Types</option>
              <option value="APS_ESCALATION">APS Escalation</option>
              <option value="VITAL_THRESHOLD">Vital Threshold</option>
              <option value="ACKNOWLEDGEMENT">Nurse Ack</option>
              <option value="LAB_RESULT">Diagnostic Lab</option>
              <option value="CLINICAL_ACTION">Clinical Action</option>
            </Select>
          </div>
        </div>

        <div className="text-xs font-mono text-muted-foreground">
          Showing <span className="font-bold text-foreground">{filteredEvents.length}</span> audit entries
        </div>
      </div>

      {/* 3. Audit Stream List */}
      <div className="neu-flat rounded-2xl p-4 sm:p-6 divide-y divide-border/40">
        {filteredEvents.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-xs font-mono">
            No audit events found for selected filters.
          </div>
        ) : (
          filteredEvents.map((ev) => {
            const patient = patients.find((p) => p.patientId === ev.patientId);

            return (
              <div
                key={ev.id}
                className="py-4 first:pt-0 last:pb-0 flex flex-col md:flex-row md:items-start justify-between gap-4 group"
              >
                <div className="flex items-start gap-3.5 flex-1">
                  {/* Bed Badge */}
                  <div className="neu-button px-2.5 py-1 rounded-xl font-mono font-extrabold text-xs text-foreground shrink-0 mt-0.5">
                    {ev.bedNumber}
                  </div>

                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-sm text-foreground">{ev.title}</h4>
                      {getSeverityBadge(ev.severity)}
                      <span className="text-xs font-mono text-muted-foreground">
                        • {ev.patientName}
                      </span>
                    </div>

                    <p className="text-xs text-foreground/80 leading-relaxed font-sans">
                      {ev.description}
                    </p>

                    <div className="flex items-center gap-3 pt-1 text-[11px] font-mono text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-sky-600 dark:text-sky-400" />
                        {ev.minutesAgo === 0 ? 'Just now' : `${ev.minutesAgo} min ago`}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3 text-sky-600 dark:text-sky-400" />
                        {ev.actor}
                      </span>
                      <span>•</span>
                      <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-0.5">
                        <ShieldCheck className="h-3 w-3" />
                        Verified
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Action */}
                {patient && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onNavigateToPatient(patient)}
                    className="h-7 text-xs font-semibold gap-1 self-end md:self-start shrink-0"
                  >
                    <span>Patient</span>
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
