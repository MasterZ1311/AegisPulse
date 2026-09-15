import React from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  User,
  Check,
  CheckCircle2,
} from 'lucide-react';
import type { WardPatientRadarState } from '../../types/radar';
import { Button } from '@/components/ui/button';
import { PatientDetailPanel } from '../PatientDetailPanel';

interface PatientWorkstationPageProps {
  patients: WardPatientRadarState[];
  selectedPatient: WardPatientRadarState | null;
  onSelectPatient: (patient: WardPatientRadarState) => void;
  onBackToRadar: () => void;
  onAcknowledge: (patientId: string, event?: React.MouseEvent) => void;
  onLogAssessment: (patientId: string, note: string) => void;
  onEscalate: (patientId: string) => void;
  onSpotCheckComplete?: (
    patientId: string,
    vitals: { heartRate: number; respiratoryRate: number; confidence: number }
  ) => void;
}

export const PatientWorkstationPage: React.FC<PatientWorkstationPageProps> = ({
  patients,
  selectedPatient,
  onSelectPatient,
  onBackToRadar,
  onAcknowledge,
  onLogAssessment,
  onEscalate,
  onSpotCheckComplete,
}) => {
  if (!selectedPatient) {
    return (
      <div className="neu-flat rounded-2xl p-12 text-center max-w-xl mx-auto my-12">
        <User className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <h2 className="text-lg font-bold text-foreground">No Patient Selected</h2>
        <p className="text-xs text-muted-foreground mt-1 mb-4">
          Please select a bed from the Ward Radar to review patient telemetry.
        </p>
        <Button onClick={onBackToRadar} className="gap-2 bg-sky-600 text-white font-bold">
          <ArrowLeft className="h-4 w-4" />
          <span>Go to Ward Radar</span>
        </Button>
      </div>
    );
  }

  // Find index for prev/next cycling
  const currentIndex = patients.findIndex((p) => p.patientId === selectedPatient.patientId);
  const prevPatient = currentIndex > 0 ? patients[currentIndex - 1] : patients[patients.length - 1];
  const nextPatient = currentIndex < patients.length - 1 ? patients[currentIndex + 1] : patients[0];

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* 1. Patient Workstation Header & Switcher Strip */}
      <section className="neu-flat rounded-2xl p-4 sm:p-5 transition-colors border-l-4 border-l-sky-600">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Back button & Patient selector */}
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={onBackToRadar}
              className="gap-1.5 text-xs font-semibold"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Ward Radar</span>
            </Button>

            {/* Quick Switcher Buttons */}
            <div className="neu-inset rounded-xl p-1 flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onSelectPatient(prevPatient)}
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                title={`Previous Patient: Bed ${prevPatient.bedNumber}`}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <div className="flex items-center gap-1 px-1">
                {patients.map((p, idx) => {
                  const isActive = p.patientId === selectedPatient.patientId;
                  const isCrit = p.category === 'CRITICAL_REVIEW';
                  const isEval = p.category === 'EVALUATE';

                  return (
                    <button
                      key={p.patientId}
                      type="button"
                      onClick={() => onSelectPatient(p)}
                      className={`px-2 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                        isActive
                          ? 'neu-button bg-sky-600 text-white shadow-sm'
                          : isCrit
                          ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-500/10'
                          : isEval
                          ? 'text-orange-600 dark:text-orange-400 hover:bg-orange-500/10'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                      title={`[${idx + 1}] Bed ${p.bedNumber} - ${p.name}`}
                    >
                      <span>{p.bedNumber.split('-')[0]}</span>
                      {isCrit && !isActive && <span className="text-rose-500 ml-0.5">•</span>}
                    </button>
                  );
                })}
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => onSelectPatient(nextPatient)}
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                title={`Next Patient: Bed ${nextPatient.bedNumber}`}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Quick Bedside Acknowledge CTA */}
          <div className="flex items-center gap-3 justify-end">
            {!selectedPatient.isAcknowledged &&
            (selectedPatient.category === 'CRITICAL_REVIEW' || selectedPatient.category === 'EVALUATE') ? (
              <Button
                size="sm"
                variant="default"
                onClick={(e) => onAcknowledge(selectedPatient.patientId, e)}
                className="bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs gap-1.5 h-9 px-4 shadow-sm"
              >
                <Check className="h-4 w-4" />
                <span>Acknowledge [A]</span>
              </Button>
            ) : (
              <div className="flex items-center gap-1.5 text-xs font-mono text-emerald-700 dark:text-emerald-400 neu-inset-sm px-3 py-1.5 rounded-xl">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Telemetry Verified</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 2. Full-Width Patient Detail Deep-Dive Panel */}
      <div className="w-full">
        <PatientDetailPanel
          patient={selectedPatient}
          isEmbedded={true}
          onAcknowledge={onAcknowledge}
          onLogAssessment={onLogAssessment}
          onEscalate={onEscalate}
          onSpotCheckComplete={onSpotCheckComplete}
        />
      </div>
    </div>
  );
};
