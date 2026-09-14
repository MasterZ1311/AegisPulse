import type { DatasetMetadata } from '../schema';

export const MMPD_DATASET: DatasetMetadata = {
  slug: 'mmpd',
  name: 'MMPD (Multi-Domain Mobile Video Physiology Dataset)',
  source: {
    institution: 'Tsinghua University & Microsoft Research',
    primaryCitation: 'Tang, J., Chen, K., Wang, Y., et al. (2023). "MMPD: Multi-Domain Mobile Video Physiology Dataset." IEEE Transactions on Biomedical Engineering, 70(11), 3123-3135.',
    doiOrUrl: 'https://github.com/McDuff-Lab/MMPD',
    publicationYear: 2023,
  },
  license: {
    name: 'Open Research Dataset License (CC BY-NC 4.0)',
    commercialUsePermitted: false,
    attributionRequired: true,
    redistributionPermitted: true,
  },
  accessRequirements: {
    accessType: 'OPEN_ACCESS',
    ethicsApprovalStatement: 'Approved by the Institutional Review Board (IRB) of Tsinghua University; all participants signed explicit photographic and physiological data release waivers.',
    dataUseAgreementSummary: 'Open access for non-commercial research; user agreement requires proper citation of primary paper.',
    credentialingUrl: 'https://github.com/McDuff-Lab/MMPD',
  },
  categories: ['RPPG', 'HEART_RATE', 'LIGHTING_VARIATION', 'SKIN_TONE_DIVERSITY', 'MOTION_ROBUSTNESS'],
  population: {
    cohortDescription: '33 subjects evaluated across 4 lighting conditions, 4 physical motion states, and 4 Fitzpatrick skin-type categories (Fitzpatrick III through VI).',
    totalSubjects: 33,
    ageRangeYears: [20, 45],
    genderRatio: { malePercent: 61, femalePercent: 39 },
    acuityLevel: 'HEALTHY_VOLUNTEERS',
    fitzpatrickScale: {
      typeI: 0,
      typeII: 0,
      typeIII: 27,
      typeIV: 33,
      typeV: 24,
      typeVI: 16,
      documented: true,
      notes: 'Explicitly designed to bridge the dark-skin representation gap, with 40% of cohort representing Fitzpatrick V and VI.',
    },
  },
  size: {
    subjectsCount: 33,
    recordingsCount: 660,
    totalDurationHours: 11.0,
    approximateStorageFootprintMb: 68000,
  },
  modalities: {
    videoSpecs: {
      cameraType: 'Samsung Galaxy S22 Ultra (Commercial Mobile Phone RGB Sensor)',
      resolution: '1280x720',
      framerateFps: 30,
      colorSpace: 'RGB',
      compression: 'LOSSY_COMPRESSED',
    },
    contactSensors: ['HKH-11C Medical Finger-Clip Pulse Oximeter'],
    physiologicalChannels: ['PPG', 'HEART_RATE', 'SPO2'],
  },
  groundTruth: {
    primaryDeviceModel: 'HKH-11C Digital Pulse Oximeter',
    fdaClearedOrCeMarked: true,
    samplingRateHz: 60,
    synchronizationMethod: 'Software hardware-coupled timestamp matching with frame-level drift correction.',
    signalsAvailable: ['PPG_PLETHYSMOGRAM', 'HEART_RATE_BPM', 'OXYGEN_SATURATION'],
  },
  knownLimitations: [
    'Mobile video compression (H.264/AVC) introduces spatial blocking and chrominance subsampling (4:2:0), attenuating high-frequency pulse details.',
    'Exclusively healthy adult subjects; no recorded cases of sepsis, hypovolemia, or severe peripheral vasoconstriction.',
    'Mobile phone auto-exposure and auto-white-balance algorithms induce dynamic gain shifts that can confound optical normalization.',
  ],
  intendedExperiment: {
    experimentIds: ['EXP-SKIN-TONE-EQUITY-001', 'EXP-LIGHTING-EXTREMES-002'],
    primaryHypothesis: 'POS algorithm maintains < 3.0 BPM MAE across Fitzpatrick V and VI without recalibration, outperforming single-channel GREEN.',
    benchmarkingObjective: 'Benchmark algorithmic fairness, disparity ratio across skin tones, and resilience to multi-lux illuminant shifts.',
  },
  clinicalClaimBoundary:
    'MMPD demonstrates mobile device feasibility in healthy adults; it CANNOT be used to assert diagnostic parity in hypothermic, shock-state, or ICU patients.',
};
