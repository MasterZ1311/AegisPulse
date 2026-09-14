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
  ShieldAlert,
} from 'lucide-react';
import {
  demoScenarioController,
  type DemoStepMetadata,
  ORDERED_DEMO_STEPS,
} from '../services/demo-scenario-controller';
import type { WardPatientRadarState } from '../types/radar';

interface DemoScrubberProps {
  onApplyStep: (patients: WardPatientRadarState[], targetPatientId?: string) => void;
}

export const DemoScrubber: React.FC<DemoScrubberProps> = ({ onApplyStep }) => {
  const [currentStep, setCurrentStep] = useState<DemoStepMetadata>(
    demoScenarioController.getCurrentStep()
  );
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

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
    <div className="w-full max-w-[1720px] mx-auto px-3 sm:px-4 lg:px-6 mb-4">
      <div className="rounded-2xl border border-cyan-900/60 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 shadow-xl shadow-cyan-950/20 overflow-hidden font-sans">
        {/* Top Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-cyan-950 text-cyan-400 border border-cyan-800/50 text-xs font-mono font-bold tracking-wide">
              <Sparkles className="h-3.5 w-3.5" />
              FLAGSHIP DEMO CONTROLLER
            </div>
            <span className="text-xs font-bold text-white hidden sm:inline">
              Step {currentStep.index} of {ORDERED_DEMO_STEPS.length - 1}:
            </span>
            <span className="text-xs text-cyan-300 font-semibold">{currentStep.title}</span>
          </div>

          {/* Controls: Reset, Prev, Play, Next */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-mono transition-colors"
              title="Reset Demo to Baseline"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Reset</span>
            </button>

            <button
              type="button"
              onClick={handlePrev}
              disabled={currentStep.index === 0}
              className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-300 hover:text-white text-xs transition-colors"
              title="Previous Event"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition-colors ${
                isPlaying
                  ? 'bg-amber-600 hover:bg-amber-500 text-white'
                  : 'bg-cyan-600 hover:bg-cyan-500 text-white'
              }`}
              title={isPlaying ? 'Pause Auto-Play' : 'Auto-Play Flagship Scenario'}
            >
              {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
              <span>{isPlaying ? 'Pause' : 'Auto-Play'}</span>
            </button>

            <button
              type="button"
              onClick={handleNext}
              disabled={currentStep.index === ORDERED_DEMO_STEPS.length - 1}
              className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-300 hover:text-white text-xs transition-colors"
              title="Next Event"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 ml-1 rounded-lg text-slate-400 hover:text-white transition-colors"
              title={isExpanded ? 'Collapse Scenario Cards' : 'Expand Scenario Cards'}
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Step Jump Pills */}
        <div className="flex items-center gap-1.5 px-4 py-2 bg-slate-950/40 overflow-x-auto border-b border-slate-800/60 text-xs font-mono">
          {ORDERED_DEMO_STEPS.map((stepKey, idx) => {
            const isActive = currentStep.index === idx;
            return (
              <button
                key={stepKey}
                type="button"
                onClick={() => handleJump(idx)}
                className={`px-2.5 py-1 rounded-md transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-cyan-500 text-black font-bold shadow-md shadow-cyan-500/20'
                    : 'bg-slate-800/80 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                }`}
              >
                {idx === 0 ? '0. Baseline' : `Event ${idx}`}
              </button>
            );
          })}
        </div>

        {/* Expandable BEFORE / CHANGE / WHY / PRIORITY / ACTION / OUTCOME Cards */}
        {isExpanded && (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs animate-fadeIn">
            {/* 1. BEFORE */}
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
                  1. Before
                </span>
                <p className="text-slate-300 mt-1 font-medium leading-relaxed">
                  {currentStep.beforeState}
                </p>
              </div>
              <div className="mt-2 text-[10px] font-mono text-slate-500 flex items-center gap-1">
                Target: <span className="text-cyan-400 font-semibold">{currentStep.targetBed}</span>
              </div>
            </div>

            {/* 2. CHANGE */}
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400">
                  2. Change
                </span>
                <p className="text-slate-200 mt-1 font-medium leading-relaxed">
                  {currentStep.changeDescription}
                </p>
              </div>
              <div className="mt-2 text-[10px] font-mono text-amber-400/80 flex items-center gap-1">
                <ArrowRight className="h-3 w-3" /> Dynamic Input
              </div>
            </div>

            {/* 3. WHY */}
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-400">
                  3. Why (Engine Logic)
                </span>
                <p className="text-slate-300 mt-1 font-medium leading-relaxed">
                  {currentStep.whyExplanation}
                </p>
              </div>
              <div className="mt-2 text-[10px] font-mono text-cyan-400/80">Deterministic Rules</div>
            </div>

            {/* 4. PRIORITY */}
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-rose-400">
                  4. Priority Outcome
                </span>
                <p className="text-white mt-1 font-semibold leading-relaxed">
                  {currentStep.priorityOutcome}
                </p>
              </div>
              <div className="mt-2 text-[10px] font-mono text-rose-400 flex items-center gap-1">
                <ShieldAlert className="h-3 w-3" /> Queue Dynamic
              </div>
            </div>

            {/* 5. ACTION */}
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400">
                  5. Clinician Action
                </span>
                <p className="text-emerald-300 mt-1 font-medium leading-relaxed">
                  {currentStep.recommendedAction}
                </p>
              </div>
              <div className="mt-2 text-[10px] font-mono text-emerald-500">Human-In-The-Loop</div>
            </div>

            {/* 6. OUTCOME */}
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-purple-400">
                  6. Clinical Value
                </span>
                <p className="text-slate-300 mt-1 font-medium leading-relaxed">
                  {currentStep.subtitle}
                </p>
              </div>
              <div className="mt-2 text-[10px] font-mono text-purple-400">Zero Randomness</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
