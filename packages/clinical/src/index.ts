/**
 * @aegispulse/clinical
 * Clinical Early Warning & Central Attention Priority Engine
 */

import type {
  PhysiologicalObservation,
  AttentionPriorityCategory,
} from '@aegispulse/types';

// Central Attention Priority Engine exports
export * from './attentionPriority';

// Explainability & Clinical Reasoning Engine exports
export * from './explainability';

// Standalone Clinical Rule Layer (Subbe 2001 & Singer 2016)
export * as mews from './mews';
export * as qsofa from './qsofa';
export { calculateMEWS } from './mews';
export { calculateQSOFA, calculateQSOFA as calculateqSOFA } from './qsofa';

// Unified Patient Timeline Engine
export * from './timeline';
export * as timeline from './timeline';

// APS Calibration Laboratory & Empirical Validation Suite
export * from './calibration';
export * as calibration from './calibration';

// Attention & Notification Event Policy Engine (Decoupled Alert Lifecycle)
export * from './eventPolicy';
export * as eventPolicy from './eventPolicy';

// Human Action Workflow & Clinical Verification Protocols
export * from './workflow';
export * as workflow from './workflow';

// SBAR Handoff Generator (Deterministic & AI-Assisted)
export * from './sbar';
export * as sbar from './sbar';

// AI Clinical Copilot & Advisory Decision Support Layer
export * from './copilot';
export * as copilot from './copilot';

// Stubs preserved for backward compatibility
export interface LegacyMEWSInput {
  heartRate?: number;
  systolicBP?: number;
  respiratoryRate?: number;
  temperature?: number;
  avpu?: 'A' | 'V' | 'P' | 'U';
}

export interface LegacyMEWSResult {
  score: number;
  triageLevel: 'green' | 'yellow' | 'red';
  isSevere: boolean;
}

/**
 * Backward-compatible MEWS helper for legacy tests
 */
export function calculateMEWSStub(input: LegacyMEWSInput): LegacyMEWSResult {
  let score = 0;
  if ((input.heartRate ?? 70) > 100) score += 2;
  if ((input.respiratoryRate ?? 16) >= 22) score += 2;

  const triageLevel = score >= 5 ? 'red' : score >= 3 ? 'yellow' : 'green';
  return {
    score,
    triageLevel,
    isSevere: score >= 5,
  };
}

/**
 * Backward-compatible APS stub for legacy callers
 */
export function calculateAPSStub(
  _observations: PhysiologicalObservation[],
  _timeElapsedMinutes: number
): { score: number; category: AttentionPriorityCategory } {
  return {
    score: 0,
    category: 'LOW',
  };
}

export interface ClinicalModuleInfo {
  version: string;
  status: 'scaffold' | 'ready';
}

export const clinicalModuleInfo: ClinicalModuleInfo = {
  version: '0.1.0',
  status: 'scaffold',
};
