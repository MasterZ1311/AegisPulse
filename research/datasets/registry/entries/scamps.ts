import type { DatasetMetadata } from '../schema';

export const SCAMPS_DATASET: DatasetMetadata = {
  slug: 'scamps',
  name: 'SCAMPS (Stanford / Microsoft Synthetic Cameras and Avatars for Physiological Sensing)',
  source: {
    institution: 'Stanford University & Microsoft Research',
    primaryCitation: 'McDuff, D., Hernandez, J., & Wood, E. (2022). "SCAMPS: Synthetics for camera measurement of physiological signals." Advances in Neural Information Processing Systems (NeurIPS), 35.',
    doiOrUrl: 'https://github.com/microsoft/SCAMPS',
    publicationYear: 2022,
  },
  license: {
    name: 'Creative Commons Attribution-NonCommercial 4.0 (CC BY-NC 4.0)',
    commercialUsePermitted: false,
    attributionRequired: true,
    redistributionPermitted: true,
  },
  accessRequirements: {
    accessType: 'OPEN_ACCESS',
    ethicsApprovalStatement: 'Synthetic rendering pipeline based on 3D computer graphics avatar meshes; no human privacy or HIPAA/GDPR biometric restrictions apply.',
    dataUseAgreementSummary: 'Freely accessible for non-commercial computer vision and biomedical benchmarking.',
    credentialingUrl: 'https://github.com/microsoft/SCAMPS',
  },
  categories: ['RPPG', 'HEART_RATE', 'RESPIRATORY_RATE', 'SKIN_TONE_DIVERSITY', 'LIGHTING_VARIATION', 'MOTION_ROBUSTNESS'],
  population: {
    cohortDescription: '2,800 photorealistically rendered 3D human avatar sequences with parameterized skin melanin, arterial blood volume pulse waveforms, and facial poses.',
    totalSubjects: 2800,
    ageRangeYears: [18, 70],
    genderRatio: { malePercent: 50, femalePercent: 50 },
    acuityLevel: 'SIMULATED_STRESS',
    fitzpatrickScale: {
      typeI: 16.7,
      typeII: 16.7,
      typeIII: 16.7,
      typeIV: 16.6,
      typeV: 16.7,
      typeVI: 16.6,
      documented: true,
      notes: 'Perfect synthetic demographic equity: exactly balanced representation across all 6 Fitzpatrick phototypes.',
    },
  },
  size: {
    subjectsCount: 2800,
    recordingsCount: 2800,
    totalDurationHours: 15.5,
    approximateStorageFootprintMb: 85000,
  },
  modalities: {
    videoSpecs: {
      cameraType: 'Simulated Cinema-Grade Raytracing Sensor (Unreal Engine / Maya)',
      resolution: '1280x720',
      framerateFps: 30,
      colorSpace: 'RGB',
      compression: 'LOSSLESS_PNG',
    },
    physiologicalChannels: ['PPG', 'HEART_RATE', 'IMPEDANCE_RESPIRATION'],
  },
  groundTruth: {
    primaryDeviceModel: 'Exact Raytraced Subsurface Hemodynamic Simulation',
    fdaClearedOrCeMarked: false,
    samplingRateHz: 30,
    synchronizationMethod: 'Zero jitter: per-frame rendered arterial absorption ground truth precisely coupled to light transmission equations.',
    signalsAvailable: ['GROUND_TRUTH_BVP', 'INSTANTANEOUS_HR', 'RESPIRATORY_WAVEFORM'],
  },
  knownLimitations: [
    'Synthetic-to-real domain gap: computer-generated skin subsurface scattering approximations may not fully capture microscopic stratum corneum oil, sweat, or fever flush.',
    'Rendered skin does not simulate pathology such as peripheral cyanosis, jaundice, severe pallor, or mottling.',
    'Lacks real optical sensor noise characteristics (dark current noise, thermal drift, rolling shutter distortions).',
  ],
  intendedExperiment: {
    experimentIds: ['EXP-FITZPATRICK-EQUITY-STRESS-001', 'EXP-SUB-WINDOW-POS-VALIDATION-002'],
    primaryHypothesis: 'POS algorithm demonstrates zero statistically significant MAE difference ($p > 0.05$) between Fitzpatrick I and Fitzpatrick VI under equal illuminance.',
    benchmarkingObjective: 'Perform controlled ablation isolating melanin concentration from motion and ambient lighting confounding factors.',
  },
  clinicalClaimBoundary:
    'SCAMPS synthetic benchmark parity DOES NOT guarantee real-world bedside performance on living human patients with varying microvascular perfusion.',
};
