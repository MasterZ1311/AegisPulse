/**
 * @aegispulse/signal
 * Optical rPPG & Sensor Quality State Machine (Stubs for Milestone 3)
 */

import type { SensorQualityState } from '@aegispulse/types';

export interface SignalQualityAssessment {
  state: SensorQualityState;
  sqiPercentage: number; // 0 - 100
  snrDb: number;
  isUsable: boolean;
  reason?: string;
}

/**
 * Evaluates raw Signal Quality Index against defined clinical thresholds
 */
export function evaluateSQI(sqiPercentage: number): SignalQualityAssessment {
  if (sqiPercentage >= 75) {
    return {
      state: 'TRUSTED',
      sqiPercentage,
      snrDb: 6.2,
      isUsable: true,
    };
  }
  if (sqiPercentage >= 50) {
    return {
      state: 'DEGRADED',
      sqiPercentage,
      snrDb: 3.1,
      isUsable: true,
      reason: 'Partial motion or non-optimal lighting detected.',
    };
  }
  if (sqiPercentage >= 20) {
    return {
      state: 'UNRELIABLE',
      sqiPercentage,
      snrDb: 1.0,
      isUsable: false,
      reason: 'Excessive motion artifact. Vitals withheld.',
    };
  }
  return {
    state: 'LOST',
    sqiPercentage,
    snrDb: 0,
    isUsable: false,
    reason: 'Optical face tracking lost or pitch darkness.',
  };
}

export interface SignalModuleInfo {
  version: string;
  algorithm: 'POS' | 'CHROM' | 'GREEN';
  status: 'scaffold' | 'ready';
}

export const signalModuleInfo: SignalModuleInfo = {
  version: '0.1.0',
  algorithm: 'POS',
  status: 'scaffold',
};
