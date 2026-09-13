/**
 * @aegispulse/simulation
 * Ward Patient Deterioration Simulation Engine (Stubs for Milestone 4)
 */

import type { PhysiologicalObservation } from '@aegispulse/types';

export type SimulationScenario =
  | 'NORMAL_RECOVERY'
  | 'COMPENSATING_SHOCK'
  | 'ACUTE_SEPSIS_CRASH'
  | 'INFORMATION_DECAY_BLINDSPOT';

export interface ScenarioDefinition {
  id: SimulationScenario;
  name: string;
  description: string;
  durationSeconds: number;
}

export const SCENARIO_CATALOG: Record<SimulationScenario, ScenarioDefinition> = {
  NORMAL_RECOVERY: {
    id: 'NORMAL_RECOVERY',
    name: 'Normal Post-Op Recovery',
    description: 'Hemodynamically stable post-operative trajectory with normal MEWS.',
    durationSeconds: 120,
  },
  COMPENSATING_SHOCK: {
    id: 'COMPENSATING_SHOCK',
    name: 'Compensating Occult Shock',
    description: 'Rising heart rate and respiratory rate with normal blood pressure (high velocity).',
    durationSeconds: 120,
  },
  ACUTE_SEPSIS_CRASH: {
    id: 'ACUTE_SEPSIS_CRASH',
    name: 'Acute Sepsis Decompensation',
    description: 'Severe tachycardia, tachypnea, hypotension, and elevated lactate.',
    durationSeconds: 120,
  },
  INFORMATION_DECAY_BLINDSPOT: {
    id: 'INFORMATION_DECAY_BLINDSPOT',
    name: 'Unobserved Ward Blindspot',
    description: 'Patient left unvisited for 4 hours; information decay drives priority rank.',
    durationSeconds: 120,
  },
};

/**
 * Generate simulated observation for a patient under given scenario
 */
export function generateSimulatedObservation(
  patientId: string,
  scenario: SimulationScenario,
  tick: number
): PhysiologicalObservation {
  const baseHR = scenario === 'ACUTE_SEPSIS_CRASH' ? 130 + (tick % 10) : 74 + (tick % 4);
  const baseRR = scenario === 'ACUTE_SEPSIS_CRASH' ? 26 : 16;

  return {
    id: `sim-obs-${patientId}-${Date.now()}`,
    patientId,
    timestamp: Date.now(),
    source: 'SIMULATION',
    confidence: 0.95,
    qualityState: 'TRUSTED',
    heartRate: baseHR,
    respiratoryRate: baseRR,
    systolicBP: scenario === 'ACUTE_SEPSIS_CRASH' ? 82 : 118,
    diastolicBP: scenario === 'ACUTE_SEPSIS_CRASH' ? 52 : 76,
    shockIndex: Number((baseHR / (scenario === 'ACUTE_SEPSIS_CRASH' ? 82 : 118)).toFixed(2)),
  };
}

export interface SimulationModuleInfo {
  version: string;
  status: 'scaffold' | 'ready';
}

export const simulationModuleInfo: SimulationModuleInfo = {
  version: '0.1.0',
  status: 'scaffold',
};
