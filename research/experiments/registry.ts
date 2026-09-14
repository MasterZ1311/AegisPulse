/**
 * @aegispulse/research - Formal Research Experiment Registry
 * Catalog of structured, reproducible research experiments.
 */

import type { ExperimentDefinition } from './schema';

export const FORMAL_EXPERIMENTS: Record<string, ExperimentDefinition> = {
  'EXP-RPPG-001': {
    experimentId: 'EXP-RPPG-001',
    name: 'Resting Baseline rPPG Accuracy & Optical Convergence',
    targetCategory: 'RPPG',
    datasetSlug: 'ubfc-rppg',
    hypothesis: 'POS algorithm achieves < 1.5 BPM MAE and > 0.98 Pearson correlation on stationary uncompressed webcam video.',
    benchmarkingObjective: 'Measure baseline precision of GREEN, CHROM, and POS algorithms in optimal indoor lighting without motion.',
    parameters: {
      windowDurationSeconds: 12.0,
      strideSeconds: 2.0,
      algorithms: ['GREEN', 'CHROM', 'POS'],
    },
  },
  'EXP-MOTION-002': {
    experimentId: 'EXP-MOTION-002',
    name: 'Rigid & Angular Head Motion Resilience Benchmark',
    targetCategory: 'MOTION_ROBUSTNESS',
    datasetSlug: 'pure',
    hypothesis: 'POS algorithm sustains < 3.0 BPM MAE under head rotation, demonstrating at least 50% lower MAE than single-channel GREEN.',
    benchmarkingObjective: 'Benchmark specular reflection rejection and error inflation under kinetic head turns and conversational motion.',
    parameters: {
      windowDurationSeconds: 12.0,
      strideSeconds: 2.0,
      motionToleranceThreshold: 0.35,
    },
  },
  'EXP-SKIN-003': {
    experimentId: 'EXP-SKIN-003',
    name: 'Phototype Equity & Multi-Illuminant Robustness',
    targetCategory: 'SKIN_TONE_DIVERSITY',
    datasetSlug: 'mmpd',
    hypothesis: 'Plane-Orthogonal-to-Skin projection maintains consistent error across Fitzpatrick III through VI without demographic recalibration.',
    benchmarkingObjective: 'Evaluate disparity ratio and error variance across skin phototypes under diverse ambient illuminants.',
    parameters: {
      windowDurationSeconds: 10.0,
      strideSeconds: 2.0,
      targetFitzpatrickCategories: ['III', 'IV', 'V', 'VI'],
    },
  },
  'EXP-RESP-004': {
    experimentId: 'EXP-RESP-004',
    name: 'Defensible Respiratory Rate Extraction from Photoplethysmography',
    targetCategory: 'RESPIRATORY_RATE',
    datasetSlug: 'bidmc-ppg-rr',
    hypothesis: 'Digital bandpass extraction of respiratory sinus arrhythmia (RSA) achieves < 2.0 breaths/min error against impedance pneumography.',
    benchmarkingObjective: 'Verify mathematical integrity of the zero-phase bandpass filter bank and spectral peak detection on real patient waveforms.',
    parameters: {
      segmentDurationSeconds: 30.0,
      strideSeconds: 10.0,
      filterPassbandHz: [0.133, 0.60],
    },
  },
  'EXP-CLIN-005': {
    experimentId: 'EXP-CLIN-005',
    name: 'Longitudinal Deterioration Early Warning Lead Time & Alarm Suppression',
    targetCategory: 'HOSPITAL_DETERIORATION',
    datasetSlug: 'mimic-iv',
    hypothesis: 'AegisPulse Attention Priority Scoring delivers > 3.0 hours average lead time prior to ICU transfer while reducing false alarms by > 30% vs MEWS.',
    benchmarkingObjective: 'Benchmark sensitivity, specificity, and alarm fatigue mitigation on longitudinal ward patient cohorts.',
    parameters: {
      apsEmergencyThreshold: 65,
      mewsEmergencyThreshold: 5,
      qsofaEmergencyThreshold: 2,
    },
  },
};
