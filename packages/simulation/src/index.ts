/**
 * @aegispulse/simulation
 * Deterministic Ward Patient Deterioration Simulation Engine
 */

export * from './prng';
export * from './clock';
export * from './models';
export * from './phenomena';
export * from './scenarios';
export * from './engine';

// ============================================================================
// Backward Compatibility Stubs & Integration
// ============================================================================
import type { PhysiologicalObservation } from '@aegispulse/types';
import type { ScenarioId } from './scenarios/scenario-catalog';

export type SimulationScenario = ScenarioId | 'NORMAL_RECOVERY' | 'COMPENSATING_SHOCK' | 'ACUTE_SEPSIS_CRASH' | 'INFORMATION_DECAY_BLINDSPOT';

export interface ScenarioDefinition {
  id: string;
  name: string;
  description: string;
  durationSeconds: number;
}

export interface SimulationModuleInfo {
  version: string;
  status: 'scaffold' | 'ready';
}

export const simulationModuleInfo: SimulationModuleInfo = {
  version: '0.1.0',
  status: 'scaffold',
};

/**
 * Generate simulated observation for a patient under given scenario.
 * Maintained for backward compatibility with initial scaffolds and tests.
 */
export function generateSimulatedObservation(
  patientId: string,
  scenario: SimulationScenario,
  tick: number
): PhysiologicalObservation {
  const isSevere = scenario === 'ACUTE_SEPSIS_CRASH' || scenario === 'SINGLE_PATIENT_DETERIORATION' || scenario === 'MULTIPLE_PATIENT_SCENARIO';
  const baseHR = isSevere ? 130 + (tick % 10) : 74 + (tick % 4);
  const baseRR = isSevere ? 26 : 16;
  const systolicBP = isSevere ? 82 : 118;
  const diastolicBP = isSevere ? 52 : 76;

  return {
    id: `sim-obs-${patientId}-${Date.now()}`,
    patientId,
    timestamp: Date.now(),
    source: 'SIMULATION',
    confidence: 0.95,
    qualityState: 'TRUSTED',
    heartRate: baseHR,
    respiratoryRate: baseRR,
    systolicBP,
    diastolicBP,
    shockIndex: Number((baseHR / systolicBP).toFixed(2)),
  };
}

/**
 * Convenience factory to create and initialize a WardSimulator.
 */
import { WardSimulator, type WardSimulatorOptions } from './engine/ward-simulator';

export function createWardSimulator(options?: WardSimulatorOptions): WardSimulator {
  return new WardSimulator(options);
}
