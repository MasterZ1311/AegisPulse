import type { DatasetMetadata } from '../schema';

export const PURE_DATASET: DatasetMetadata = {
  slug: 'pure',
  name: 'PURE (Pulse Rate Estimation dataset)',
  source: {
    institution: 'Fraunhofer Institute for Communication, Information Processing and Ergonomics (FKIE, Germany)',
    primaryCitation: 'Stricker, R., Müller, S., & Gross, H. M. (2014). "Non-contact video-based pulse rate measurement on a mobile service robot." IEEE International Conference on Robot and Human Interactive Communication (RO-MAN).',
    doiOrUrl: 'https://www.fkie.fraunhofer.de/en/departments/bvd/pure.html',
    publicationYear: 2014,
  },
  license: {
    name: 'Fraunhofer Academic Research License',
    commercialUsePermitted: false,
    attributionRequired: true,
    redistributionPermitted: false,
  },
  accessRequirements: {
    accessType: 'RESEARCH_DUA_REQUIRED',
    ethicsApprovalStatement: 'Approved by the Institutional Review Board of Technische Universität Ilmenau and Fraunhofer FKIE.',
    dataUseAgreementSummary: 'Signatures from department head and institutional supervisor required. Video distribution outside designated laboratory network prohibited.',
    credentialingUrl: 'https://www.fkie.fraunhofer.de/en/departments/bvd/pure.html',
  },
  categories: ['RPPG', 'HEART_RATE', 'MOTION_ROBUSTNESS'],
  population: {
    cohortDescription: '10 healthy adult participants (8 male, 2 female) performing 6 systematic head motion and conversational protocols.',
    totalSubjects: 10,
    ageRangeYears: [22, 38],
    genderRatio: { malePercent: 80, femalePercent: 20 },
    acuityLevel: 'HEALTHY_VOLUNTEERS',
    fitzpatrickScale: {
      typeI: 10,
      typeII: 70,
      typeIII: 20,
      typeIV: 0,
      typeV: 0,
      typeVI: 0,
      documented: true,
      notes: 'Predominantly Central European phototypes II and III.',
    },
  },
  size: {
    subjectsCount: 10,
    recordingsCount: 60,
    totalDurationHours: 1.0,
    approximateStorageFootprintMb: 35000,
  },
  modalities: {
    videoSpecs: {
      cameraType: 'ECO274CVGE Industrial Camera (SVS-Vistek GmbH)',
      resolution: '640x480',
      framerateFps: 30,
      colorSpace: 'RGB',
      compression: 'LOSSLESS_PNG',
    },
    contactSensors: ['Pulox CMS50F Wireless Finger Pulse Oximeter'],
    physiologicalChannels: ['PPG', 'HEART_RATE', 'SPO2'],
  },
  groundTruth: {
    primaryDeviceModel: 'Pulox CMS50F Pulse Oximeter',
    fdaClearedOrCeMarked: true,
    samplingRateHz: 60,
    synchronizationMethod: 'Hardware trigger coupled to frame-grabber timestamp log.',
    signalsAvailable: ['PPG_PLETHYSMOGRAM', 'PULSE_RATE_BPM', 'OXYGEN_SATURATION_PERCENT'],
  },
  knownLimitations: [
    'Very small cohort size ($N=10$), precluding statistical power for clinical variance.',
    'Head motions are scripted and synthetic (steady, talking, slow/fast translation, rotation); lacks spontaneous agitation, shivering, or seizures.',
    'No medical deterioration or cardiovascular instability represented.',
    'Fitzpatrick skin types IV, V, and VI are completely absent.',
  ],
  intendedExperiment: {
    experimentIds: ['EXP-MOTION-ROBUSTNESS-001', 'EXP-POS-VS-CHROM-MOTION-002'],
    primaryHypothesis: 'POS algorithm exhibits significantly lower MAE degradation under head rotation compared to single-channel GREEN.',
    benchmarkingObjective: 'Quantify motion artifact rejection and SNR degradation across 6 controlled kinetic motion conditions.',
  },
  clinicalClaimBoundary:
    'PURE dataset results can NEVER be used to assert efficacy for delirious, agitated, or convulsing hospital ward patients.',
};
