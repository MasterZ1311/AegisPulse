import type { DatasetMetadata } from '../schema';

export const EICU_CRD_DATASET: DatasetMetadata = {
  slug: 'eicu-crd',
  name: 'eICU Collaborative Research Database',
  source: {
    institution: 'Philips Healthcare & MIT Laboratory for Computational Physiology',
    primaryCitation: 'Pollard, T. J., Johnson, A. E., Raffa, J. D., et al. (2018). "The eICU Collaborative Research Database, a freely available multi-center database for critical care research." Scientific Data, 5, 180178.',
    doiOrUrl: 'https://physionet.org/content/eicu-crd/2.0/',
    publicationYear: 2018,
  },
  license: {
    name: 'PhysioNet Credentialed Health Data Use Agreement 1.5.0',
    commercialUsePermitted: false,
    attributionRequired: true,
    redistributionPermitted: false,
  },
  accessRequirements: {
    accessType: 'PHYSIONET_CREDENTIALED',
    ethicsApprovalStatement: 'Multi-center critical care database certified as meeting Safe Harbor de-identification standards; exempt from individual patient authorization.',
    dataUseAgreementSummary: 'CITI certified training, researcher verification, institutional backing, and binding DUA forbidding re-identification.',
    credentialingUrl: 'https://physionet.org/content/eicu-crd/2.0/',
  },
  categories: ['HEART_RATE', 'RESPIRATORY_RATE', 'HOSPITAL_DETERIORATION'],
  population: {
    cohortDescription: '200,859 patient unit encounters across 208 distinct hospitals across the United States, providing multi-center heterogeneous ward and ICU operational telemetry.',
    totalSubjects: 139367,
    ageRangeYears: [18, 89],
    ageMedianYears: 64,
    genderRatio: { malePercent: 54, femalePercent: 46 },
    acuityLevel: 'INTENSIVE_CARE',
    fitzpatrickScale: {
      documented: false,
      notes: 'Contains US Census racial/ethnic self-reported categories; skin phototype not documented.',
    },
  },
  size: {
    subjectsCount: 139367,
    recordingsCount: 200859,
    totalDurationHours: 4200000,
    approximateStorageFootprintMb: 8500000,
  },
  modalities: {
    contactSensors: ['Philips eICU Telehealth Monitoring Platform', 'Bedside Monitors from 208 Hospitals'],
    physiologicalChannels: ['EHR_VITALS', 'LAB_PANELS', 'HEART_RATE', 'RESPIRATORY_RATE', 'SPO2', 'BP_CONTINUOUS'],
  },
  groundTruth: {
    primaryDeviceModel: 'Multi-Center Bedside Telemetry Monitors & Hospital Discharge Records',
    fdaClearedOrCeMarked: true,
    samplingRateHz: 0.0033, // 5-minute periodic telemetry averages
    synchronizationMethod: 'eICU platform synchronized telemetry timekeeper.',
    signalsAvailable: ['PERIODIC_HR', 'PERIODIC_RR', 'PERIODIC_SPO2', 'INVASIVE_AND_NONINVASIVE_BP', 'APACHE_IV_SCORE', 'UNIT_DISCHARGE_STATUS'],
  },
  knownLimitations: [
    'Highly variable documentation practices across 208 participating hospital centers.',
    'Different unit workflows and EHR vendor interfaces across community vs academic hospitals create data heterogeneity.',
    'High rate of unrecorded values for non-critical vitals in step-down units.',
  ],
  intendedExperiment: {
    experimentIds: ['EXP-MULTI-CENTER-GENERALIZATION-001', 'EXP-ATTENTION-SCALING-002'],
    primaryHypothesis: 'AegisPulse APS maintains stable calibration (Brier score < 0.12) across diverse hospital topologies without site-specific manual recalibration.',
    benchmarkingObjective: 'Validate cross-hospital generalization of physiological velocity and decay scoring against APACHE IV benchmarks.',
  },
  clinicalClaimBoundary:
    'Retrospective multi-center analysis validates scoring generalization, but cannot substitute for on-site nurse acceptance testing or local clinical governance.',
};
