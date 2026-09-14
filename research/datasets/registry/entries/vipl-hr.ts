import type { DatasetMetadata } from '../schema';

export const VIPL_HR_DATASET: DatasetMetadata = {
  slug: 'vipl-hr',
  name: 'VIPL-HR (Visual-Infrared-Physiological Video Database)',
  source: {
    institution: 'Institute of Computing Technology, Chinese Academy of Sciences (CAS VIPL)',
    primaryCitation: 'Niu, X., Shan, S., Han, H., & Chen, X. (2018). "VIPL-HR: A multi-modal database for pulse rate estimation from human faces." IEEE Transactions on Image Processing, 28(8), 3991-4004.',
    doiOrUrl: 'https://vipl.ict.ac.cn/resources/databases/vipl-hr',
    publicationYear: 2018,
  },
  license: {
    name: 'VIPL-HR Academic Non-Commercial Release License',
    commercialUsePermitted: false,
    attributionRequired: true,
    redistributionPermitted: false,
  },
  accessRequirements: {
    accessType: 'RESEARCH_DUA_REQUIRED',
    ethicsApprovalStatement: 'Approved by the Ethics Review Board of ICT, Chinese Academy of Sciences; written informed consent obtained from all subjects.',
    dataUseAgreementSummary: 'Institutional research agreement signed by department chair required. Re-identification and commercial deployment forbidden.',
    credentialingUrl: 'https://vipl.ict.ac.cn/resources/databases/vipl-hr',
  },
  categories: ['RPPG', 'HEART_RATE', 'MOTION_ROBUSTNESS', 'LIGHTING_VARIATION'],
  population: {
    cohortDescription: '107 subjects evaluated under 9 distinct conditions combining head movement (pitch, yaw, speech), distance variation (0.5m to 1.5m), and lighting variation (bright, dim, dark).',
    totalSubjects: 107,
    ageRangeYears: [17, 41],
    genderRatio: { malePercent: 74, femalePercent: 26 },
    acuityLevel: 'SIMULATED_STRESS',
    fitzpatrickScale: {
      typeI: 0,
      typeII: 5,
      typeIII: 65,
      typeIV: 30,
      typeV: 0,
      typeVI: 0,
      documented: true,
      notes: 'East Asian cohort; Fitzpatrick types III and IV predominate; Fitzpatrick I, V, and VI are absent.',
    },
  },
  size: {
    subjectsCount: 107,
    recordingsCount: 2378,
    totalDurationHours: 19.8,
    approximateStorageFootprintMb: 120000,
  },
  modalities: {
    videoSpecs: {
      cameraType: 'Multi-camera rig: Logitech C310, RealSense F200 (RGB+NIR), and HUAWEI P9 phone',
      resolution: '1920x1080 (RealSense) / 640x480 (Webcam)',
      framerateFps: 30,
      colorSpace: 'RGB',
      compression: 'LOSSY_COMPRESSED',
    },
    contactSensors: ['Contec CMS60C Medical Pulse Oximeter with Finger Sensor'],
    physiologicalChannels: ['PPG', 'HEART_RATE', 'SPO2'],
  },
  groundTruth: {
    primaryDeviceModel: 'Contec Medical CMS60C',
    fdaClearedOrCeMarked: true,
    samplingRateHz: 60,
    synchronizationMethod: 'Serial port hardware trigger timestamp sync logged per frame.',
    signalsAvailable: ['BVP_PULSE_WAVEFORM', 'INSTANTANEOUS_HEART_RATE', 'BLOOD_OXYGEN'],
  },
  knownLimitations: [
    'Single ethnic demographic (predominantly East Asian); lacks African, South Asian, and Northern European phenotypes.',
    'Multi-camera compression and varying shutter latencies introduce inter-camera variance.',
    'Exercise-induced post-exercise tachycardia is included, but zero real medical morbidity or pathological dysrhythmias.',
  ],
  intendedExperiment: {
    experimentIds: ['EXP-DISTANCE-VARIATION-001', 'EXP-MULTI-DEVICE-CROSS-VALIDATION-002'],
    primaryHypothesis: 'POS algorithm exhibits less than 20% increase in error across distances from 0.5m to 1.5m compared to near-field capture.',
    benchmarkingObjective: 'Measure spatial distance tolerance and multi-device degradation in general ward spot-check simulations.',
  },
  clinicalClaimBoundary:
    'VIPL-HR cannot be used to certify monitoring performance on elderly medical patients, pediatric cohorts, or patients suffering hemodynamic shock.',
};
