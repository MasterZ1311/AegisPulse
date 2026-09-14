/**
 * @aegispulse/research - Experiment Schemas & Validation Invariants
 * Formal definitions for reproducible experiments and machine-readable output results.
 */

import type { DatasetCategory, DatasetMetadata } from '../datasets/registry/schema';
import type { StatisticalMetricsResult } from '../benchmarks/metrics';
import type { CalibrationResult } from '../benchmarks/calibration';

export interface ExperimentDefinition {
  experimentId: string;
  name: string;
  targetCategory: DatasetCategory;
  datasetSlug: string;
  hypothesis: string;
  benchmarkingObjective: string;
  parameters: Record<string, unknown>;
}

export interface MachineReadableExperimentResult {
  experimentId: string;
  name: string;
  timestamp: string;
  gitCommitHash?: string;
  executionDurationMs: number;
  dataset: {
    slug: string;
    name: string;
    source: string;
    license: string;
    accessType: string;
    cohortDescription: string;
    totalSubjects: number;
    acuityLevel: string;
    fitzpatrickDocumented: boolean;
    knownLimitations: string[];
    clinicalClaimBoundary: string;
  };
  primaryMetrics: StatisticalMetricsResult;
  confidenceCalibration: CalibrationResult;
  algorithmComparisons?: Record<string, {
    metrics: StatisticalMetricsResult;
    calibration: CalibrationResult;
    throughputFps?: number;
  }>;
  customSummary?: Record<string, unknown>;
  disclaimer: string;
}

/**
 * Validates that an experiment result contains all mandatory population,
 * limitation, and ethical boundary fields before serialization.
 */
export function validateExperimentResult(result: MachineReadableExperimentResult): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!result.experimentId) {
    errors.push('experimentId is required');
  }
  if (!result.dataset) {
    errors.push('dataset metadata section is required');
  } else {
    if (!result.dataset.cohortDescription || result.dataset.cohortDescription.trim().length < 10) {
      errors.push('dataset.cohortDescription must be documented (at least 10 characters)');
    }
    if (result.dataset.totalSubjects <= 0) {
      errors.push('dataset.totalSubjects must be greater than 0');
    }
    if (!result.dataset.knownLimitations || result.dataset.knownLimitations.length === 0) {
      errors.push('dataset.knownLimitations must contain at least one documented limitation');
    }
    if (!result.dataset.clinicalClaimBoundary || result.dataset.clinicalClaimBoundary.trim().length < 20) {
      errors.push('dataset.clinicalClaimBoundary must be explicitly documented (at least 20 characters)');
    }
  }

  if (!result.disclaimer || !result.disclaimer.toLowerCase().includes('never make clinical claims')) {
    errors.push('disclaimer must include the mandatory notice: "Never make clinical claims from a dataset without documenting its population and limitations."');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
