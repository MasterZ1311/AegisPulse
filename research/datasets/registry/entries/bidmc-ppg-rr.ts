import type { DatasetMetadata } from '../schema';

export const BIDMC_PPG_RR_DATASET: DatasetMetadata = {
  slug: 'bidmc-ppg-rr',
  name: 'BIDMC PPG and Respiration Dataset',
  source: {
    institution: 'PhysioNet / Beth Israel Deaconess Medical Center & King’s College London',
    primaryCitation: 'Pimentel, M. A., Johnson, A. E., Charlton, P. H., et al. (2016). "Toward a Robust Estimation of Respiratory Rate from Pulse Oximeters." IEEE Transactions on Biomedical Engineering, 64(8), 1914-1923.',
    doiOrUrl: 'https://physionet.org/content/bidmc/1.0.0/',
    publicationYear: 2016,
  },
  license: {
    name: 'Open Data Commons Attribution License v1.0 (ODC-By)',
    commercialUsePermitted: true,
    attributionRequired: true,
    redistributionPermitted: true,
  },
  accessRequirements: {
    accessType: 'OPEN_ACCESS',
    ethicsApprovalStatement: 'Exempted de-identified subset derived from the MIMIC-II ICU database; approved by the Institutional Review Boards of BIDMC and MIT.',
    dataUseAgreementSummary: 'Standard PhysioNet Open Data Agreement; requires citation and prohibition of re-identification attempts.',
    credentialingUrl: 'https://physionet.org/content/bidmc/1.0.0/',
  },
  categories: ['HEART_RATE', 'RESPIRATORY_RATE', 'PHYSIOLOGICAL_WAVEFORM'],
  population: {
    cohortDescription: '53 hospitalized adult intensive care patients monitored at Beth Israel Deaconess Medical Center, exhibiting real medical acuity and medication effects.',
    totalSubjects: 53,
    ageRangeYears: [19, 90],
    ageMedianYears: 65,
    genderRatio: { malePercent: 55, femalePercent: 45 },
    acuityLevel: 'INTENSIVE_CARE',
    fitzpatrickScale: {
      documented: false,
      notes: 'Fitzpatrick phototype not routinely recorded in hospital electronic medical charts.',
    },
  },
  size: {
    subjectsCount: 53,
    recordingsCount: 53,
    totalDurationHours: 7.1,
    approximateStorageFootprintMb: 450,
  },
  modalities: {
    contactSensors: ['Philips MP70 Bedside ICU Patient Monitor'],
    physiologicalChannels: ['PPG', 'ECG', 'IMPEDANCE_RESPIRATION', 'HEART_RATE', 'RESPIRATORY_RATE'],
  },
  groundTruth: {
    primaryDeviceModel: 'Philips MP70 Multi-Parameter Bedside Telemetry Monitor',
    fdaClearedOrCeMarked: true,
    samplingRateHz: 125,
    synchronizationMethod: 'ICU network digital telemetry synchronous hardware clock logging.',
    signalsAvailable: ['PPG_SIGNAL_125HZ', 'ECG_LEAD_II_125HZ', 'IMPEDANCE_PNEUMOGRAPHY_125HZ', 'EXPERT_ANNOTATED_BREATHS'],
  },
  knownLimitations: [
    'Derived from contact pulse oximetry, not video cameras (used as gold-standard benchmark for physiological waveform decomposition and RR extraction algorithms).',
    'Severely ill ICU cohort; frequent vasopressor infusions, inotropes, and invasive ventilation confound baseline autonomic respiratory sinus arrhythmia.',
    'Signal dropouts and electrocautery artifacts during surgical procedures.',
  ],
  intendedExperiment: {
    experimentIds: ['EXP-WAVEFORM-DECOMPOSITION-001', 'EXP-RR-IMPEDANCE-VS-PPG-002'],
    primaryHypothesis: 'Filtering respiratory sinus arrhythmia (RSA) and baseline wander in [0.133, 0.60] Hz yields < 2.0 breaths/min error against impedance pneumography.',
    benchmarkingObjective: 'Validate mathematical correctness of PPG waveform detrending, filter bank frequency extraction, and respiratory rate estimation.',
  },
  clinicalClaimBoundary:
    'Validation on contact PPG signals establishes digital filter integrity, but DOES NOT validate camera optical skin extraction.',
};
