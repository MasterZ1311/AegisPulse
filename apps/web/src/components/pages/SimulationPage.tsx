import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Layers,
} from 'lucide-react';
import {
  demoScenarioController,
  type DemoStepMetadata,
  ORDERED_DEMO_STEPS,
} from '../../services/demo-scenario-controller';
import type { WardPatientRadarState } from '../../types/radar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface SimulationPageProps {
  activeScenario: string;
  onScenarioChange: (scenario: string) => void;
  onApplyStep: (patients: WardPatientRadarState[], targetPatientId?: string) => void;
  onNavigateToPatient: (patient: WardPatientRadarState) => void;
  patients: WardPatientRadarState[];
}

export const SimulationPage: React.FC<SimulationPageProps> = ({
  activeScenario,
  onScenarioChange,
  onApplyStep,
  onNavigateToPatient,
  patients,
}) => {
  const [currentStep, setCurrentStep] = useState<DemoStepMetadata>(
    demoScenarioController.getCurrentStep()
  );
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  // Auto-play timer
  useEffect(() => {
    let timer: any = null;
    if (isPlaying) {
      timer = setInterval(() => {
        const nextIdx = (demoScenarioController.getStepIndex() + 1) % ORDERED_DEMO_STEPS.length;
        handleJump(nextIdx);
        if (nextIdx === ORDERED_DEMO_STEPS.length - 1) {
          setIsPlaying(false);
        }
      }, 7000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isPlaying]);

  const handleJump = (index: number) => {
    const updated = demoScenarioController.setStep(index);
    const step = demoScenarioController.getCurrentStep();
    setCurrentStep(step);
    onApplyStep(updated, step.targetPatientId !== 'ALL' ? step.targetPatientId : undefined);
  };

  const handleNext = () => {
    const updated = demoScenarioController.nextStep();
    const step = demoScenarioController.getCurrentStep();
    setCurrentStep(step);
    onApplyStep(updated, step.targetPatientId !== 'ALL' ? step.targetPatientId : undefined);
  };

  const handlePrev = () => {
    const updated = demoScenarioController.prevStep();
    const step = demoScenarioController.getCurrentStep();
    setCurrentStep(step);
    onApplyStep(updated, step.targetPatientId !== 'ALL' ? step.targetPatientId : undefined);
  };

  const handleReset = () => {
    setIsPlaying(false);
    const updated = demoScenarioController.reset();
    const step = demoScenarioController.getCurrentStep();
    setCurrentStep(step);
    onApplyStep(updated);
  };

  const targetPatient = patients.find((p) => p.patientId === currentStep.targetPatientId);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. Simulation Header */}
      <section className="neu-flat rounded-2xl p-6 transition-colors">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
              <img src="/aegis-logo.png" alt="AegisPulse" className="h-6 w-6 object-contain inline-block" />
              AegisPulse Simulation & Time-Travel Lab
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Test deterministic deterioration scenarios, evaluate false-alarm suppression, and replay critical inpatient decompensations.
            </p>
          </div>

          {/* Master Controller Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant={isPlaying ? 'default' : 'outline'}
              size="sm"
              onClick={() => setIsPlaying(!isPlaying)}
              className={`gap-1.5 font-bold text-xs h-9 ${
                isPlaying ? 'bg-amber-500 hover:bg-amber-600 text-slate-950' : 'text-foreground'
              }`}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 text-emerald-500" />}
              <span>{isPlaying ? 'Pause Simulation' : 'Auto Play'}</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handlePrev}
              className="h-9 w-9 p-0"
              title="Previous Step"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleNext}
              className="h-9 w-9 p-0"
              title="Next Step"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="h-9 gap-1 text-xs font-mono"
              title="Reset Simulation to Initial State"
            >
              <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Reset</span>
            </Button>
          </div>
        </div>
      </section>

      {/* 2. Step Scrubber Ribbon */}
      <Card className="neu-flat p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-sky-600 dark:text-sky-400" />
            <h3 className="text-sm font-bold text-foreground font-mono uppercase tracking-wider">
              Step {currentStep.index + 1} of {ORDERED_DEMO_STEPS.length}: {currentStep.title}
            </h3>
          </div>

          <span className="text-xs font-mono neu-inset px-2.5 py-1 rounded-lg text-foreground font-bold">
            Sim Step: #{currentStep.index + 1}
          </span>
        </div>

        {/* Interactive Step Pill Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mb-6">
          {ORDERED_DEMO_STEPS.map((stepKey, idx) => {
            const isCurrent = currentStep.index === idx;
            const isPassed = idx < currentStep.index;

            return (
              <button
                key={stepKey}
                type="button"
                onClick={() => handleJump(idx)}
                className={`p-3 rounded-xl text-left transition-all cursor-pointer ${
                  isCurrent
                    ? 'neu-button bg-sky-600 text-white shadow-md font-bold ring-2 ring-sky-400/50'
                    : isPassed
                    ? 'neu-inset text-foreground'
                    : 'neu-flat text-muted-foreground hover:text-foreground'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-mono mb-1">
                  <span>STEP {idx + 1}</span>
                  {isPassed && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                </div>
                <p className="text-xs font-bold line-clamp-1">
                  {idx === 0
                    ? 'Baseline'
                    : idx === 1
                    ? 'Transient Spike'
                    : idx === 2
                    ? 'Sensor Dropout'
                    : idx === 3
                    ? 'Occult Shock'
                    : idx === 4
                    ? 'Inspection'
                    : idx === 5
                    ? 'Reassessment'
                    : 'Recovery'}
                </p>
                <span className="text-[10px] opacity-75 font-mono">+{idx * 15}m</span>
              </button>
            );
          })}
        </div>

        {/* Current Step Detailed Impact Box */}
        <div className="neu-inset rounded-2xl p-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-sky-600 dark:text-sky-400 font-bold">
                Clinical Narrative & Mechanics
              </span>
              <h4 className="text-base font-bold text-foreground mt-0.5">{currentStep.subtitle}</h4>
            </div>

            {targetPatient && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigateToPatient(targetPatient)}
                className="gap-1.5 text-xs font-semibold self-start sm:self-auto"
              >
                <span>Inspect Bed {targetPatient.bedNumber}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>

          <p className="text-xs text-foreground/85 leading-relaxed font-sans">
            {currentStep.whyExplanation}
          </p>

          <div className="pt-2 border-t border-border/40 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
            <div>
              <span className="text-muted-foreground">Target Bed: </span>
              <span className="font-bold text-foreground">
                {currentStep.targetBed}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Recommended Action: </span>
              <span className="font-bold text-sky-600 dark:text-sky-400">{currentStep.recommendedAction}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* 3. Scenario Presets & Signal Quality Assurance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Scenario Presets */}
        <Card className="neu-flat p-6">
          <h3 className="text-sm font-bold text-foreground font-mono uppercase tracking-wider mb-4">
            Available Simulation Scenarios
          </h3>
          <div className="space-y-3">
            {[
              {
                id: 'SINGLE_PATIENT_DETERIORATION',
                name: 'Bed 403 Occult Shock (Rapid Sepsis)',
                desc: 'Single post-op patient accelerates into septic shock while other beds remain stable.',
              },
              {
                id: 'NORMAL_SHIFT',
                name: 'Normal Stable Shift',
                desc: 'All 6 beds exhibit normal physiological circadian variation without acute alerts.',
              },
              {
                id: 'MULTIPLE_PATIENT_SCENARIO',
                name: 'Dual Decompensation',
                desc: 'Two concurrent decompensations testing triage attention queue prioritization.',
              },
              {
                id: 'SIGNAL_FAILURE_SCENARIO',
                name: 'Optical Dropout & Artefact Rejection',
                desc: 'Tests camera occlusion, lighting shifts, and sensor noise suppression.',
              },
            ].map((sc) => {
              const isSel = activeScenario === sc.id;
              return (
                <div
                  key={sc.id}
                  onClick={() => onScenarioChange(sc.id)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    isSel
                      ? 'neu-inset border-sky-500/50 bg-sky-500/5'
                      : 'neu-flat-sm border-transparent hover:border-border'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-xs text-foreground">{sc.name}</h4>
                    {isSel && (
                      <span className="text-[10px] font-mono font-bold text-sky-600 dark:text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">{sc.desc}</p>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Signal Quality & Hardware Edge Telemetry */}
        <Card className="neu-flat p-6">
          <h3 className="text-sm font-bold text-foreground font-mono uppercase tracking-wider mb-4">
            Edge Hardware & Signal Integrity
          </h3>
          <div className="space-y-4 text-xs font-mono">
            <div className="neu-inset p-3 rounded-xl flex items-center justify-between">
              <span className="text-muted-foreground">Video Exfiltration:</span>
              <span className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="h-4 w-4" />
                Zero (RAM Pixel Buffer Only)
              </span>
            </div>

            <div className="neu-inset p-3 rounded-xl flex items-center justify-between">
              <span className="text-muted-foreground">Signal-to-Noise Ratio (SNR):</span>
              <span className="font-bold text-foreground">18.4 dB (Optimal)</span>
            </div>

            <div className="neu-inset p-3 rounded-xl flex items-center justify-between">
              <span className="text-muted-foreground">Motion Artifact Suppressor:</span>
              <span className="font-bold text-sky-600 dark:text-sky-400">POS rPPG Active</span>
            </div>

            <div className="neu-inset p-3 rounded-xl flex items-center justify-between">
              <span className="text-muted-foreground">Edge Persistence:</span>
              <span className="font-bold text-foreground">SQLite WAL (Zero Data Loss)</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
