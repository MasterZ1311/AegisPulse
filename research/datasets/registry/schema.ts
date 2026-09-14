/**
 * @aegispulse/research - Dataset Registry Schema
 * Formal metadata specifications for physiological, rPPG, and clinical deterioration datasets.
 */

export type DatasetCategory =
  | 'RPPG'
  | 'HEART_RATE'
  | 'RESPIRATORY_RATE'
  | 'MOTION_ROBUSTNESS'
  | 'LIGHTING_VARIATION'
  | 'SKIN_TONE_DIVERSITY'
  | 'PHYSIOLOGICAL_WAVEFORM'
  | 'HOSPITAL_DETERIORATION';

export interface FitzpatrickDistribution {
  typeI?: number;     // Percentage or count
  typeII?: number;
  typeIII?: number;
  typeIV?: number;
  typeV?: number;
  typeVI?: number;
  documented: boolean;
  notes?: string;
}

export interface DatasetPopulation {
  cohortDescription: string;
  totalSubjects: number;
  ageRangeYears?: [number, number];
  ageMedianYears?: number;
  genderRatio?: { malePercent: number; femalePercent: number };
  acuityLevel: 'HEALTHY_VOLUNTEERS' | 'SIMULATED_STRESS' | 'AMBULATORY_PATIENTS' | 'ACUTE_WARD' | 'INTENSIVE_CARE';
  fitzpatrickScale?: FitzpatrickDistribution;
}

export interface DatasetSize {
  subjectsCount: number;
  recordingsCount: number;
  totalDurationHours: number;
  approximateStorageFootprintMb: number;
}

export interface DatasetModalitySpec {
  videoSpecs?: {
    cameraType: string;
    resolution: string;
    framerateFps: number;
    colorSpace: 'RGB' | 'NIR' | 'MULTI_SPECTRAL';
    compression: 'UNCOMPRESSED_RAW' | 'LOSSLESS_PNG' | 'LOSSY_COMPRESSED';
  };
  contactSensors?: string[];
  physiologicalChannels: ('PPG' | 'ECG' | 'IMPEDANCE_RESPIRATION' | 'BP_CONTINUOUS' | 'SPO2' | 'EHR_VITALS' | 'LAB_PANELS')[];
}

export interface GroundTruthSpec {
  primaryDeviceModel: string;
  fdaClearedOrCeMarked: boolean;
  samplingRateHz: number;
  synchronizationMethod: string;
  signalsAvailable: string[];
}

export interface DatasetMetadata {
  /** Unique URL-friendly slug */
  slug: string;
  /** Formal academic or institutional title */
  name: string;
  /** Primary source citation, institution, and official URL */
  source: {
    institution: string;
    primaryCitation: string;
    doiOrUrl: string;
    publicationYear: number;
  };
  /** Governing license */
  license: {
    name: string;
    commercialUsePermitted: boolean;
    attributionRequired: boolean;
    redistributionPermitted: boolean;
  };
  /** Specific credentialing and access workflow */
  accessRequirements: {
    accessType: 'OPEN_ACCESS' | 'REGISTRATION_REQUIRED' | 'RESEARCH_DUA_REQUIRED' | 'PHYSIONET_CREDENTIALED';
    ethicsApprovalStatement: string;
    dataUseAgreementSummary: string;
    credentialingUrl?: string;
  };
  /** Research categories satisfied by this dataset */
  categories: DatasetCategory[];
  /** Detailed cohort demographics and clinical profile */
  population: DatasetPopulation;
  /** Dataset volume metrics */
  size: DatasetSize;
  /** Modality specifications */
  modalities: DatasetModalitySpec;
  /** Medical-grade reference ground truth */
  groundTruth: GroundTruthSpec;
  /** Explicit documented physiological, algorithmic, and demographic limitations */
  knownLimitations: string[];
  /** Primary intended AegisPulse research experiments */
  intendedExperiment: {
    experimentIds: string[];
    primaryHypothesis: string;
    benchmarkingObjective: string;
  };
  /**
   * CRITICAL ETHICAL & CLINICAL INVARIANT:
   * Explicit boundary describing what clinical claims CANNOT be made from this dataset.
   */
  clinicalClaimBoundary: string;
}

/**
 * Validates that a dataset metadata record satisfies all required ethical,
 * demographic, and limitation fields before inclusion in benchmarks.
 */
export function validateDatasetMetadata(data: DatasetMetadata): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.slug || !data.slug.match(/^[a-z0-9-]+$/)) {
    errors.push('Slug must be non-empty and kebab-case');
  }
  if (!data.name || data.name.trim().length < 3) {
    errors.push('Name must be descriptive (at least 3 characters)');
  }
  if (!data.source?.institution || !data.source?.doiOrUrl) {
    errors.push('Source must include institution and verifiable DOI or URL');
  }
  if (!data.license?.name) {
    errors.push('License name must be specified');
  }
  if (!data.accessRequirements?.accessType || !data.accessRequirements?.dataUseAgreementSummary) {
    errors.push('Access requirements must detail accessType and DUA summary');
  }
  if (!data.population || data.population.totalSubjects <= 0) {
    errors.push('Population totalSubjects must be greater than 0');
  }
  if (!data.knownLimitations || data.knownLimitations.length === 0) {
    errors.push('Known limitations must be explicitly documented');
  }
  if (!data.clinicalClaimBoundary || data.clinicalClaimBoundary.trim().length < 20) {
    errors.push('Clinical claim boundary must be an explicit, rigorous statement (>= 20 characters)');
  }
  if (!data.categories || data.categories.length === 0) {
    errors.push('At least one DatasetCategory must be assigned');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
