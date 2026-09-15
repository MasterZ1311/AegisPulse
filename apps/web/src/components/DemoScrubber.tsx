import React, { useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  ChevronUp,
  ChevronDown,
  ArrowRight,
} from 'lucide-react';
import {
  demoScenarioController,
  type DemoStepMetadata,
  ORDERED_DEMO_STEPS,
  DEMO_STEPS_METADATA,
} from '../services/demo-scenario-controller';
import type { WardPatientRadarState } from '../types/radar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface DemoScrubberProps {
  onApplyStep: (patients: WardPatientRadarState[], targetPatientId?: string) => void;
}

export const DemoScrubber: React.FC<DemoScrubberProps> = ({ onApplyStep }) => {
  const [currentStep, setCurrentStep] = useState<DemoStepMetadata>(
    demoScenarioController.getCurrentStep()
  );
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

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
    onApplyStep(updated, 'P003');
  };

  return (
    <div className="w-full max-w-[1780px] mx-auto px-4 sm:px-8 mb-4">
      <Card className="neu-flat p-3 sm:p-4 transition-all duration-200">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Step indicator and title */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl neu-inset-sm text-sky-600 dark:text-sky-400 font-mono text-xs font-bold tracking-wide">
              <Sparkles className="h-3.5 w-3.5" />
              DEMO SCRUBBER
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-xs font-mono font-bold text-foreground">
                Step {currentStep.index}/{ORDERED_DEMO_STEPS.length - 1}:
              </span>
              <span className="text-xs text-sky-600 dark:text-sky-400 font-semibold font-mono">
                {currentStep.title}
              </span>
            </div>
          </div>

          {/* Stepper Timeline Pills */}
          <div className="hidden lg:flex items-center gap-1.5 neu-inset rounded-xl p-1 overflow-x-auto">
            {ORDERED_DEMO_STEPS.map((stepKey, idx) => {
              const meta = DEMO_STEPS_METADATA[stepKey];
              const isActive = meta.index === currentStep.index;

              return (
                <button
                  key={meta.stepId}
                  type="button"
                  onClick={() => handleJump(idx)}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-sky-600 text-white font-bold scale-105 shadow-md shadow-sky-600/30'
                      : 'text-slate-700 dark:text-slate-300 hover:text-foreground'
                  }`}
                  title={meta.title}
                >
                  #{meta.index} {meta.targetBed}
                </button>
              );
            })}
          </div>

          {/* Controls: Reset, Prev, Play, Next, Info Toggle */}
          <div className="flex items-center gap-1.5 ml-auto sm:ml-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="h-8 text-xs font-mono gap-1"
              title="Reset Demo to Baseline"
            >
              <RotateCcw className="h-3 w-3" />
              <span className="hidden sm:inline">Reset</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handlePrev}
              disabled={currentStep.index === 0}
              className="h-8 w-8 p-0"
              title="Previous Event"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <Button
              variant={isPlaying ? 'amber' : 'default'}
              size="sm"
              onClick={() => setIsPlaying(!isPlaying)}
              className="h-8 px-3 text-xs font-mono gap-1 font-bold"
            >
              {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              <span>{isPlaying ? 'Pause' : 'Auto'}</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleNext}
              disabled={currentStep.index === ORDERED_DEMO_STEPS.length - 1}
              className="h-8 w-8 p-0"
              title="Next Event"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
              title={isExpanded ? 'Hide Narrative' : 'Show Narrative'}
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Collapsible Clinical Narrative Section */}
        {isExpanded && (
          <div className="mt-3 pt-3 border-t border-border/40 grid grid-cols-1 md:grid-cols-12 gap-3 text-xs animate-in fade-in duration-200">
            <div className="md:col-span-8 flex flex-col justify-center space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase font-bold text-sky-600 dark:text-sky-400">
                  Event Narrative:
                </span>
                <span className="text-foreground font-semibold">{currentStep.changeDescription}</span>
              </div>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                <span className="font-mono text-muted-foreground/80">Mechanism:</span> {currentStep.whyExplanation}
              </p>
            </div>

            <div className="md:col-span-4 flex items-center justify-end gap-2 neu-inset-sm p-2 rounded-xl">
              <div className="text-right">
                <span className="text-[10px] font-mono text-muted-foreground uppercase block">Focal Patient</span>
                <span className="text-xs font-bold font-mono text-sky-600 dark:text-sky-400">
                  {currentStep.targetPatientId === 'ALL' ? 'Entire Ward (6 Beds)' : 'Bed 403 (Eleanor Vance)'}
                </span>
              </div>
              <ArrowRight className="h-4 w-4 text-sky-600 dark:text-sky-400" />
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};
