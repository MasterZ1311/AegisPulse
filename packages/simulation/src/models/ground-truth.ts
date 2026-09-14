/**
 * Ground Truth Physiology & Environment Models.
 * STRICT ISOLATION INVARIANT:
 * Ground truth represents the absolute biological reality of the patient.
 * It is maintained internally for validation and developer inspection,
 * and MUST NEVER be directly leaked to the clinical ward dashboard.
 */

export interface GroundTruthVitals {
  heartRate: number;
  respiratoryRate: number;
  systolicBP: number;
  diastolicBP: number;
  bodyTemperature: number;
  oxygenSaturation: number; // True arterial saturation
  hrvRmssd: number;
  shockIndex: number; // Derived true ratio HR / Systolic BP
}

export type PatientActivityState =
  | 'RESTING_QUIET'
  | 'TURNING_IN_BED'
  | 'COUGHING_TALKING'
  | 'SITTING_UP'
  | 'AMBULATING'
  | 'ACUTE_DISTRESS';

export interface EnvironmentalState {
  illuminationLux: number; // Normal ward day: 300-500 lux; night: 15-40 lux
  opticalLineOfSight: boolean; // Face/skin visible to camera sensor
  motionMagnitude: number; // 0.0 (still) to 1.0 (violent motion/seizure)
  contactSensorAttached: boolean; // Is bedside finger probe / BP cuff connected
  roomTemperatureCelsius: number;
}

export interface PatientSimulationState {
  patientId: string;
  bedNumber: string;
  virtualTimeMs: number;
  groundTruthVitals: GroundTruthVitals;
  activity: PatientActivityState;
  environment: EnvironmentalState;
  activePhenomena: string[];
  lastManualVitalsTimestamp: number;
}

/**
 * Developer-Only Ground Truth Diagnostic Snapshot.
 * Used exclusively for algorithmic bench-testing, unit test assertions,
 * and ground truth vs observed sensor discrepancy verification.
 */
export interface DeveloperGroundTruthSnapshot {
  simulationTimestamp: number;
  simulationIso: string;
  activeScenarioId: string;
  patients: {
    patientId: string;
    bedNumber: string;
    name: string;
    trueVitals: GroundTruthVitals;
    observedVitalsSummary: {
      observedHR: number | null;
      observedRR: number | null;
      observedSysBP: number | null;
      observedDiaBP: number | null;
      observedSpO2: number | null;
      sqiPercentage: number;
      sensorQualityState: string;
    };
    noiseDelta: {
      hrDelta: number;
      rrDelta: number;
    };
    activity: PatientActivityState;
    environment: EnvironmentalState;
    activePhenomena: string[];
    minutesSinceLastManualCheck: number;
  }[];
}
