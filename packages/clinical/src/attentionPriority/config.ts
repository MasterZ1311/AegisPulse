/**
 * Attention Priority Configuration
 * Centralized, deterministic scoring weights, clinical thresholds, decay rates, and safety floors.
 * Zero hard-coded magic values in scoring algorithms.
 */

export interface AttentionPriorityWeights {
  abnormality: number;
  baselineDeviation: number;
  velocity: number;
  informationDecay: number;
  signalConfidence: number;
  mews: number;
  qsofa: number;
  biomarkers: number;
  missingInfo: number;
}

export interface VitalRanges {
  hr: {
    bradySevere: number;
    bradyMild: number;
    normalMin: number;
    normalMax: number;
    tachyMild: number;
    tachyModerate: number;
    tachySevere: number;
  };
  rr: {
    bradySevere: number;
    normalMin: number;
    normalMax: number;
    tachyMild: number;
    tachyModerate: number;
    tachySevere: number;
  };
  sbp: {
    hypoSevere: number;
    hypoModerate: number;
    hypoMild: number;
    normalMin: number;
    normalMax: number;
    hyperMild: number;
    hyperSevere: number;
  };
  dbp: {
    hypoMild: number;
    normalMin: number;
    normalMax: number;
    hyperMild: number;
    hyperSevere: number;
  };
  spo2: {
    hypoxiaSevere: number;
    hypoxiaModerate: number;
    hypoxiaMild: number;
    normalMin: number;
  };
  temp: {
    hypothermia: number;
    normalMin: number;
    normalMax: number;
    feverMild: number;
    feverHigh: number;
  };
  shockIndex: {
    normalMax: number;
    mildElevated: number;
    occultShock: number;
    severeShock: number;
  };
}

export interface BaselineDeviationThresholds {
  hrPercentMild: number;
  hrPercentModerate: number;
  hrPercentSevere: number;
  rrPercentMild: number;
  rrPercentModerate: number;
  rrPercentSevere: number;
  sbpDropPercentMild: number;
  sbpDropPercentSevere: number;
}

export interface VelocityThresholds {
  hrBpmPerHourMild: number;
  hrBpmPerHourModerate: number;
  hrBpmPerHourSevere: number;
  rrBreathsPerHourMild: number;
  rrBreathsPerHourModerate: number;
  rrBreathsPerHourSevere: number;
  siPerHourMild: number;
  siPerHourSevere: number;
  accelerationMultiplier: number;
}

export interface PersistenceThresholds {
  transientWindowMinutes: number;
  sustainedWindowMinutes: number;
  minSpikeDampingFactor: number;
  motionArtifactDiscountFactor: number;
}

export interface DecayThresholds {
  halfLifeMinutes: number;
  warnThresholdMinutes: number;
  criticalThresholdMinutes: number;
  maxDecayMinutes: number;
}

export interface ConfidenceThresholds {
  unreliableThreshold: number;
  degradedThreshold: number;
  trustedThreshold: number;
  lowConfidenceVelocityDiscount: number;
}

export interface LabThresholds {
  lactateElevated: number;
  lactateCritical: number;
  wbcLow: number;
  wbcHigh: number;
  wbcCritical: number;
  creatinineElevated: number;
  plateletsLow: number;
}

export interface CategoryThresholds {
  lowMax: number;
  watchMax: number;
  evaluateMax: number;
  criticalMin: number;
}

export interface OverrideFloors {
  qsofaSevereMinScore: number;
  mewsSevereMinScore: number;
  criticalShockIndexMinScore: number;
  criticalLactateMinScore: number;
}

export interface AttentionPriorityConfig {
  weights: AttentionPriorityWeights;
  vitalThresholds: VitalRanges;
  baselineDeviationThresholds: BaselineDeviationThresholds;
  velocityThresholds: VelocityThresholds;
  persistenceThresholds: PersistenceThresholds;
  decayThresholds: DecayThresholds;
  confidenceThresholds: ConfidenceThresholds;
  labThresholds: LabThresholds;
  categoryThresholds: CategoryThresholds;
  overrideFloors: OverrideFloors;
}

export const DEFAULT_ATTENTION_CONFIG: AttentionPriorityConfig = {
  weights: {
    abnormality: 0.20,
    baselineDeviation: 0.10,
    velocity: 0.20,
    informationDecay: 0.15,
    signalConfidence: 0.05,
    mews: 0.10,
    qsofa: 0.05,
    biomarkers: 0.10,
    missingInfo: 0.05,
  },
  vitalThresholds: {
    hr: {
      bradySevere: 40,
      bradyMild: 50,
      normalMin: 60,
      normalMax: 100,
      tachyMild: 101,
      tachyModerate: 115,
      tachySevere: 130,
    },
    rr: {
      bradySevere: 8,
      normalMin: 12,
      normalMax: 20,
      tachyMild: 22,
      tachyModerate: 25,
      tachySevere: 28,
    },
    sbp: {
      hypoSevere: 70,
      hypoModerate: 80,
      hypoMild: 90,
      normalMin: 100,
      normalMax: 140,
      hyperMild: 160,
      hyperSevere: 180,
    },
    dbp: {
      hypoMild: 50,
      normalMin: 60,
      normalMax: 90,
      hyperMild: 95,
      hyperSevere: 110,
    },
    spo2: {
      hypoxiaSevere: 88,
      hypoxiaModerate: 92,
      hypoxiaMild: 95,
      normalMin: 96,
    },
    temp: {
      hypothermia: 35.0,
      normalMin: 36.0,
      normalMax: 37.5,
      feverMild: 38.0,
      feverHigh: 39.0,
    },
    shockIndex: {
      normalMax: 0.70,
      mildElevated: 0.80,
      occultShock: 0.90,
      severeShock: 1.10,
    },
  },
  baselineDeviationThresholds: {
    hrPercentMild: 0.15,
    hrPercentModerate: 0.25,
    hrPercentSevere: 0.40,
    rrPercentMild: 0.20,
    rrPercentModerate: 0.35,
    rrPercentSevere: 0.50,
    sbpDropPercentMild: 0.15,
    sbpDropPercentSevere: 0.25,
  },
  velocityThresholds: {
    hrBpmPerHourMild: 10,
    hrBpmPerHourModerate: 20,
    hrBpmPerHourSevere: 30,
    rrBreathsPerHourMild: 4,
    rrBreathsPerHourModerate: 8,
    rrBreathsPerHourSevere: 12,
    siPerHourMild: 0.10,
    siPerHourSevere: 0.20,
    accelerationMultiplier: 1.25,
  },
  persistenceThresholds: {
    transientWindowMinutes: 3.0,
    sustainedWindowMinutes: 10.0,
    minSpikeDampingFactor: 0.25,
    motionArtifactDiscountFactor: 0.30,
  },
  decayThresholds: {
    halfLifeMinutes: 120.0,
    warnThresholdMinutes: 180.0,
    criticalThresholdMinutes: 240.0,
    maxDecayMinutes: 360.0,
  },
  confidenceThresholds: {
    unreliableThreshold: 0.50,
    degradedThreshold: 0.75,
    trustedThreshold: 0.85,
    lowConfidenceVelocityDiscount: 0.20,
  },
  labThresholds: {
    lactateElevated: 2.0,
    lactateCritical: 4.0,
    wbcLow: 4.0,
    wbcHigh: 12.0,
    wbcCritical: 20.0,
    creatinineElevated: 1.5,
    plateletsLow: 100,
  },
  categoryThresholds: {
    lowMax: 29,
    watchMax: 54,
    evaluateMax: 74,
    criticalMin: 75,
  },
  overrideFloors: {
    qsofaSevereMinScore: 75,
    mewsSevereMinScore: 70,
    criticalShockIndexMinScore: 75,
    criticalLactateMinScore: 75,
  },
};

/**
 * Deep merge utility for custom configuration overrides
 */
export function mergeAttentionConfig(
  customConfig?: Partial<AttentionPriorityConfig>
): AttentionPriorityConfig {
  if (!customConfig) {
    return { ...DEFAULT_ATTENTION_CONFIG };
  }

  return {
    weights: {
      ...DEFAULT_ATTENTION_CONFIG.weights,
      ...(customConfig.weights ?? {}),
    },
    vitalThresholds: {
      hr: {
        ...DEFAULT_ATTENTION_CONFIG.vitalThresholds.hr,
        ...(customConfig.vitalThresholds?.hr ?? {}),
      },
      rr: {
        ...DEFAULT_ATTENTION_CONFIG.vitalThresholds.rr,
        ...(customConfig.vitalThresholds?.rr ?? {}),
      },
      sbp: {
        ...DEFAULT_ATTENTION_CONFIG.vitalThresholds.sbp,
        ...(customConfig.vitalThresholds?.sbp ?? {}),
      },
      dbp: {
        ...DEFAULT_ATTENTION_CONFIG.vitalThresholds.dbp,
        ...(customConfig.vitalThresholds?.dbp ?? {}),
      },
      spo2: {
        ...DEFAULT_ATTENTION_CONFIG.vitalThresholds.spo2,
        ...(customConfig.vitalThresholds?.spo2 ?? {}),
      },
      temp: {
        ...DEFAULT_ATTENTION_CONFIG.vitalThresholds.temp,
        ...(customConfig.vitalThresholds?.temp ?? {}),
      },
      shockIndex: {
        ...DEFAULT_ATTENTION_CONFIG.vitalThresholds.shockIndex,
        ...(customConfig.vitalThresholds?.shockIndex ?? {}),
      },
    },
    baselineDeviationThresholds: {
      ...DEFAULT_ATTENTION_CONFIG.baselineDeviationThresholds,
      ...(customConfig.baselineDeviationThresholds ?? {}),
    },
    velocityThresholds: {
      ...DEFAULT_ATTENTION_CONFIG.velocityThresholds,
      ...(customConfig.velocityThresholds ?? {}),
    },
    persistenceThresholds: {
      ...DEFAULT_ATTENTION_CONFIG.persistenceThresholds,
      ...(customConfig.persistenceThresholds ?? {}),
    },
    decayThresholds: {
      ...DEFAULT_ATTENTION_CONFIG.decayThresholds,
      ...(customConfig.decayThresholds ?? {}),
    },
    confidenceThresholds: {
      ...DEFAULT_ATTENTION_CONFIG.confidenceThresholds,
      ...(customConfig.confidenceThresholds ?? {}),
    },
    labThresholds: {
      ...DEFAULT_ATTENTION_CONFIG.labThresholds,
      ...(customConfig.labThresholds ?? {}),
    },
    categoryThresholds: {
      ...DEFAULT_ATTENTION_CONFIG.categoryThresholds,
      ...(customConfig.categoryThresholds ?? {}),
    },
    overrideFloors: {
      ...DEFAULT_ATTENTION_CONFIG.overrideFloors,
      ...(customConfig.overrideFloors ?? {}),
    },
  };
}
