import type { DatasetMetadata } from '../schema';

export const MIMIC_IV_DATASET: DatasetMetadata = {
  slug: 'mimic-iv',
  name: 'MIMIC-IV (Medical Information Mart for Intensive Care IV)',
  source: {
    institution: 'MIT Laboratory for Computational Physiology & Beth Israel Deaconess Medical Center',
    primaryCitation: 'Johnson, A. E., Bulgarelli, L., Shen, L., et al. (2023). "MIMIC-IV, a freely accessible electronic health record dataset." Scientific Data, 10(1), 1.',
    doiOrUrl: 'https://physionet.org/content/mimiciv/2.2/',
    publicationYear: 2023,
  },
  license: {
    name: 'PhysioNet Credentialed Health Data Use Agreement 1.5.0',
    commercialUsePermitted: false,
    attributionRequired: true,
    redistributionPermitted: false,
  },
  accessRequirements: {
    accessType: 'PHYSIONET_CREDENTIALED',
    ethicsApprovalStatement: 'Approved by the Institutional Review Boards of MIT (Protocol #0403000206) and Beth Israel Deaconess Medical Center; requirement for individual informed consent waived due to HIPAA Safe Harbor de-identification.',
    dataUseAgreementSummary: 'Requires CITI "Data or Specimens Only Research" certification, identity verification, institutional endorsement, and signed PhysioNet Credentialed DUA forbidding re-identification.',
    credentialingUrl: 'https://physionet.org/content/mimiciv/2.2/',
  },
  categories: ['HEART_RATE', 'RESPIRATORY_RATE', 'HOSPITAL_DETERIORATION'],
  population: {
    cohortDescription: '>65,000 adult intensive care unit and emergency department admissions with comprehensive longitudinal vital signs, lab tests, medications, nurse assessments, and clinical outcomes.',
    totalSubjects: 65375,
    ageRangeYears: [18, 91],
    ageMedianYears: 67,
    genderRatio: { malePercent: 54, femalePercent: 46 },
    acuityLevel: 'INTENSIVE_CARE',
    fitzpatrickScale: {
      documented: false,
      notes: 'Contains racial/ethnic self-reported categories (White 67%, Black 15%, Hispanic 7%, Asian 4%, Other 7%), but not Fitzpatrick dermatological scales.',
    },
  },
  size: {
    subjectsCount: 65375,
    recordingsCount: 76540,
    totalDurationHours: 1250000,
    approximateStorageFootprintMb: 4800000,
  },
  modalities: {
    contactSensors: ['Philips Intellivue ICU Network', 'Hospital EHR (Epic/MetaVision)'],
    physiologicalChannels: ['EHR_VITALS', 'LAB_PANELS', 'HEART_RATE', 'RESPIRATORY_RATE', 'SPO2', 'BP_CONTINUOUS'],
  },
  groundTruth: {
    primaryDeviceModel: 'Hospital Electronic Health Record & Verified Clinical Outcomes',
    fdaClearedOrCeMarked: true,
    samplingRateHz: 0.0167, // Typical 1-hour to 15-minute nurse chart intervals
    synchronizationMethod: 'Hospital networked master time server.',
    signalsAvailable: ['HR', 'RR', 'SBP', 'DBP', 'MAP', 'SPO2', 'TEMPERATURE', 'LACTATE', 'WBC', 'IN_HOSPITAL_MORTALITY', 'ICU_TRANSFER'],
  },
  knownLimitations: [
    'Observation frequency is clinically driven (nurses chart more frequently when a patient is visibly deteriorating, introducing significant observation bias / informative sampling).',
    'Retrospective observational data from a single tertiary academic medical center in Boston, MA, USA; clinical workflows may not represent low-resource district general wards in India or elsewhere.',
    'Vital sign values in EHR contain transcription errors and delayed chart entries.',
  ],
  intendedExperiment: {
    experimentIds: ['EXP-APS-DETERIORATION-PREDICTION-001', 'EXP-MEWS-QSOFA-COMPARISON-002'],
    primaryHypothesis: 'AegisPulse Attention Priority Score (APS) identifies decompensating septic and shock patients with > 4.0 hours average lead time before emergency ICU transfer.',
    benchmarkingObjective: 'Benchmark sensitivity, specificity, and false-alarm suppression of APS against standard MEWS and qSOFA thresholds on longitudinal hospital patient trajectories.',
  },
  clinicalClaimBoundary:
    'Retrospective EHR modeling demonstrates statistical risk association; it DOES NOT prove prospective clinical safety or mortality reduction without a randomized controlled trial (RCT).',
};
