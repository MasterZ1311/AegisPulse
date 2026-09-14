import type { DatasetMetadata } from '../schema';

export const COHFACE_DATASET: DatasetMetadata = {
  slug: 'cohface',
  name: 'COHFACE (Contactless Remote Physiological Monitoring Dataset)',
  source: {
    institution: 'Idiap Research Institute (Martigny, Switzerland)',
    primaryCitation: 'Heusch, G., Anjos, A., & Marcel, S. (2017). "A reproducible study on remote photoplethysmography." Idiap Research Report, Idiap-RR-14-2017.',
    doiOrUrl: 'https://www.idiap.ch/en/dataset/cohface',
    publicationYear: 2017,
  },
  license: {
    name: 'Idiap Non-Commercial Research License',
    commercialUsePermitted: false,
    attributionRequired: true,
    redistributionPermitted: false,
  },
  accessRequirements: {
    accessType: 'RESEARCH_DUA_REQUIRED',
    ethicsApprovalStatement: 'Recorded in conformity with Swiss federal human research data ethics guidelines; signed consent forms archived at Idiap.',
    dataUseAgreementSummary: 'Access granted following formal academic applicant verification; distribution of original biometric video strictly prohibited.',
    credentialingUrl: 'https://www.idiap.ch/en/dataset/cohface',
  },
  categories: ['RPPG', 'HEART_RATE', 'RESPIRATORY_RATE', 'LIGHTING_VARIATION'],
  population: {
    cohortDescription: '40 adult subjects recorded under 2 controlled lighting setups: studio illumination (clean continuous halogen) vs natural ambient daylight.',
    totalSubjects: 40,
    ageRangeYears: [21, 58],
    genderRatio: { malePercent: 72, femalePercent: 28 },
    acuityLevel: 'HEALTHY_VOLUNTEERS',
    fitzpatrickScale: {
      typeI: 15,
      typeII: 60,
      typeIII: 25,
      typeIV: 0,
      typeV: 0,
      typeVI: 0,
      documented: true,
      notes: 'European research institute cohort; exclusively lighter skin tones (I–III).',
    },
  },
  size: {
    subjectsCount: 40,
    recordingsCount: 160,
    totalDurationHours: 2.6,
    approximateStorageFootprintMb: 42000,
  },
  modalities: {
    videoSpecs: {
      cameraType: 'Logitech HD Pro Webcam C920',
      resolution: '640x480',
      framerateFps: 20,
      colorSpace: 'RGB',
      compression: 'LOSSY_COMPRESSED',
    },
    contactSensors: ['Thought Technology BioRadio Wireless Physiological Monitor'],
    physiologicalChannels: ['PPG', 'IMPEDANCE_RESPIRATION', 'HEART_RATE'],
  },
  groundTruth: {
    primaryDeviceModel: 'Thought Technology BioRadio',
    fdaClearedOrCeMarked: true,
    samplingRateHz: 256,
    synchronizationMethod: 'Hardware timestamp synchronization via BioRadio acquisition software and video frame trigger.',
    signalsAvailable: ['FINGER_PPG', 'THORACIC_RESPIRATORY_BELT', 'ECG_LEAD_II'],
  },
  knownLimitations: [
    'Camera captured at non-standard 20 FPS (rather than 30 or 60 FPS), decreasing Nyquist temporal bandwidth for heart rate variability and harmonic resolution.',
    'Severe MPEG-4 compression with noticeable macro-blocking around facial boundaries.',
    'No clinical acute deterioration or respiratory distress represented; participants were comfortably seated.',
    'Near-zero dark skin phototype representation.',
  ],
  intendedExperiment: {
    experimentIds: ['EXP-RESPIRATORY-DEFENSIBILITY-001', 'EXP-LIGHTING-STUDIO-VS-DAYLIGHT-002'],
    primaryHypothesis: 'Defensible respiratory rate estimation achieves < 2.5 breaths/min error only on high-SQI windows with > 12-second temporal support.',
    benchmarkingObjective: 'Benchmark respiratory sinus arrhythmia (RSA) and thoracic baseline extraction against the BioRadio chest belt reference.',
  },
  clinicalClaimBoundary:
    'COHFACE cannot be used to prove respiratory monitoring safety in tachypneic, asthmatic, or mechanically ventilated patients.',
};
