import type { DatasetMetadata } from '../schema';

export const UBFC_RPPG_DATASET: DatasetMetadata = {
  slug: 'ubfc-rppg',
  name: 'UBFC-rPPG (University of Bourgogne Franche-Comté)',
  source: {
    institution: 'University of Bourgogne Franche-Comté (LE2I, France)',
    primaryCitation: 'Bousefsaf, F., Choubeila, M. A., & Maaoui, C. (2018). "Continuous photoplethysmographic signal estimation from video under ambient light." IEEE Transactions on Consumer Electronics.',
    doiOrUrl: 'https://sites.google.com/view/ybvision/ubfc-rppg',
    publicationYear: 2018,
  },
  license: {
    name: 'Academic Research Non-Commercial License',
    commercialUsePermitted: false,
    attributionRequired: true,
    redistributionPermitted: false,
  },
  accessRequirements: {
    accessType: 'REGISTRATION_REQUIRED',
    ethicsApprovalStatement: 'Approved by the ethical board of University of Bourgogne Franche-Comté; all subjects provided written informed consent.',
    dataUseAgreementSummary: 'Permitted exclusively for non-commercial academic benchmarking of computer vision and contactless physiological estimation algorithms.',
    credentialingUrl: 'https://sites.google.com/view/ybvision/ubfc-rppg',
  },
  categories: ['RPPG', 'HEART_RATE'],
  population: {
    cohortDescription: 'Healthy undergraduate and graduate student volunteers performing resting and synthetic cognitive stress tasks (mental arithmetic).',
    totalSubjects: 56,
    ageRangeYears: [19, 32],
    ageMedianYears: 24,
    genderRatio: { malePercent: 68, femalePercent: 32 },
    acuityLevel: 'SIMULATED_STRESS',
    fitzpatrickScale: {
      typeI: 20,
      typeII: 55,
      typeIII: 20,
      typeIV: 5,
      typeV: 0,
      typeVI: 0,
      documented: true,
      notes: 'Heavy skew toward lighter European phototypes (Fitzpatrick I-III); Fitzpatrick V-VI entirely unrepresented.',
    },
  },
  size: {
    subjectsCount: 56,
    recordingsCount: 56,
    totalDurationHours: 2.1,
    approximateStorageFootprintMb: 45000,
  },
  modalities: {
    videoSpecs: {
      cameraType: 'Custom Logitech C920 HD Webcam',
      resolution: '640x480',
      framerateFps: 30,
      colorSpace: 'RGB',
      compression: 'UNCOMPRESSED_RAW',
    },
    contactSensors: ['Contec Medical CMS50E Finger Clip Pulse Oximeter'],
    physiologicalChannels: ['PPG', 'HEART_RATE'],
  },
  groundTruth: {
    primaryDeviceModel: 'Contec CMS50E Pulse Oximeter',
    fdaClearedOrCeMarked: true,
    samplingRateHz: 60,
    synchronizationMethod: 'Hardware timestamps logged synchronously via custom C++ acquisition software.',
    signalsAvailable: ['BVP_PULSE_WAVEFORM', 'INSTANTANEOUS_HR'],
  },
  knownLimitations: [
    'Restricted age cohort of young healthy adults (19-32 years); zero representation of cardiovascular pathology, arrhythmias, or pediatric/geriatric physiology.',
    'Near-zero representation of darker skin phototypes (Fitzpatrick V-VI).',
    'Controlled indoor artificial fluorescent lighting; lacks natural sunlight shifts or high-glare environments.',
    'Stationary seated posture; head motion is limited to minor nodding and conversational gestures.',
  ],
  intendedExperiment: {
    experimentIds: ['EXP-RPPG-BASELINE-001', 'EXP-RPPG-FFT-RESOLUTION-002'],
    primaryHypothesis: 'POS algorithm achieves < 1.5 BPM MAE against ground-truth finger PPG on clean, uncompressed video streams.',
    benchmarkingObjective: 'Establish golden baseline accuracy for GREEN, CHROM, and POS extraction in optimal seated conditions.',
  },
  clinicalClaimBoundary:
    'UBFC-rPPG benchmark results can NEVER be cited to substantiate clinical diagnostic accuracy, critical care reliability, or suitability across racially diverse patient populations.',
};
