import type {
  Observation,
  SignalQuality,
  QualityStatus,
  ObservationSource,
} from '@aegispulse/types';
import type { SeededRandom } from '../prng/seeded-random';
import type { GroundTruthVitals, EnvironmentalState } from './ground-truth';

export interface SensorEmissionResult {
  observations: Observation[];
  signalQuality: SignalQuality;
  isObservationEmitted: boolean;
}

/**
 * Simulates physical sensor acquisition (optical camera rPPG + intermittent bedside devices).
 * Enforces all safety constraints, including strict prohibition of SpO2 via optical rPPG.
 */
export function simulateSensorAcquisition(
  patientId: string,
  bedId: string,
  virtualTimestamp: number,
  groundTruth: GroundTruthVitals,
  environment: EnvironmentalState,
  prng: SeededRandom,
  isManualNurseCheck: boolean = false
): SensorEmissionResult {
  // --------------------------------------------------------------------------
  // 1. Evaluate Optical Channel Environment
  // --------------------------------------------------------------------------
  const { illuminationLux, opticalLineOfSight, motionMagnitude } = environment;

  let qualityState: QualityStatus = 'TRUSTED';
  let isUsable = true;
  let reason: string | undefined = undefined;

  // Signal-to-Noise Ratio (dB) estimation from lighting and motion
  let snrDb = 8.5; // Pristine baseline
  if (illuminationLux < 40) {
    snrDb -= 6.0; // Dim room penalty
  } else if (illuminationLux < 100) {
    snrDb -= 2.5;
  }

  snrDb -= motionMagnitude * 10.0; // Motion noise penalty
  snrDb = Math.max(-5.0, Number(snrDb.toFixed(1)));

  // Motion Artifact Index [0.0, 1.0]
  const motionArtifactIndex = Math.min(1.0, Math.max(0.0, Number(motionMagnitude.toFixed(2))));

  // SQI percentage [0, 100]
  let sqi = 95 - motionMagnitude * 60;
  if (illuminationLux < 40) {
    sqi -= 40;
  } else if (illuminationLux < 100) {
    sqi -= 15;
  }
  sqi += prng.nextGaussian(0, 3);
  const sqiPercentage = Math.round(Math.min(100, Math.max(0, sqi)));

  // State transitions based on clinical thresholds
  if (!opticalLineOfSight) {
    qualityState = 'LOST';
    isUsable = false;
    reason = 'Patient face/skin out of optical field of view';
  } else if (motionMagnitude >= 0.65 || sqiPercentage < 30) {
    qualityState = 'UNRELIABLE';
    isUsable = false;
    reason = 'Excessive patient motion or severe illumination drop; optical vitals withheld';
  } else if (motionMagnitude >= 0.3 || sqiPercentage < 65) {
    qualityState = 'DEGRADED';
    isUsable = true;
    reason = 'Sub-optimal lighting or moderate movement detected';
  } else {
    qualityState = 'TRUSTED';
    isUsable = true;
  }

  const confidence = Number((sqiPercentage / 100).toFixed(2));

  const signalQuality: SignalQuality = {
    sqiPercentage,
    snrDb,
    illuminationLux,
    motionArtifactIndex,
    state: qualityState,
    isUsable,
    faceDetected: opticalLineOfSight,
    reason,
  };

  const observations: Observation[] = [];

  // If sensor is LOST or UNRELIABLE, optical vitals are withheld to prevent clinical false alarms
  if (!isManualNurseCheck && (!opticalLineOfSight || qualityState === 'UNRELIABLE')) {
    return {
      observations: [],
      signalQuality,
      isObservationEmitted: false,
    };
  }

  // --------------------------------------------------------------------------
  // 2. Synthesize Optical rPPG Observations (HR, RR, HRV)
  // --------------------------------------------------------------------------
  const source: ObservationSource = isManualNurseCheck ? 'NURSE_MANUAL' : 'OPTICAL_RPPG';
  const hrNoise = isUsable ? prng.nextGaussian(0, 0.8) : prng.nextGaussian(0, 4.0);
  const rrNoise = isUsable ? prng.nextGaussian(0, 0.5) : prng.nextGaussian(0, 2.0);

  const observedHR = Math.round(Math.max(25, Math.min(280, groundTruth.heartRate + hrNoise)));
  const observedRR = Math.round(Math.max(6, Math.min(70, groundTruth.respiratoryRate + rrNoise)));
  const observedHRV = Math.max(5, Math.min(200, Number((groundTruth.hrvRmssd + prng.nextGaussian(0, 2)).toFixed(1))));

  // Heart Rate Observation
  observations.push({
    id: `obs-hr-${patientId}-${virtualTimestamp}`,
    patientId,
    bedId,
    timestamp: virtualTimestamp,
    source,
    vitalType: 'HEART_RATE',
    value: observedHR,
    unit: 'BPM',
    confidence,
    qualityStatus: qualityState,
  });

  // Respiratory Rate Observation
  observations.push({
    id: `obs-rr-${patientId}-${virtualTimestamp}`,
    patientId,
    bedId,
    timestamp: virtualTimestamp,
    source,
    vitalType: 'RESPIRATORY_RATE',
    value: observedRR,
    unit: 'BREATHS_PER_MINUTE',
    confidence,
    qualityStatus: qualityState,
  });

  // HRV RMSSD Observation
  observations.push({
    id: `obs-hrv-${patientId}-${virtualTimestamp}`,
    patientId,
    bedId,
    timestamp: virtualTimestamp,
    source,
    vitalType: 'HRV_RMSSD',
    value: observedHRV,
    unit: 'MILLISECONDS',
    confidence,
    qualityStatus: qualityState,
  });

  // --------------------------------------------------------------------------
  // 3. Manual Nurse Observation or Intermittent Bedside Device
  // STRICT INVARIANT: SpO2, Blood Pressure, and Temp only originate from here!
  // --------------------------------------------------------------------------
  if (isManualNurseCheck) {
    const manualConfidence = 1.0;
    const manualQuality: QualityStatus = 'TRUSTED';

    // Systolic Blood Pressure
    observations.push({
      id: `obs-sys-${patientId}-${virtualTimestamp}`,
      patientId,
      bedId,
      timestamp: virtualTimestamp,
      source: 'NURSE_MANUAL',
      vitalType: 'SYSTOLIC_BP',
      value: Math.round(groundTruth.systolicBP + prng.nextGaussian(0, 1.5)),
      unit: 'MMHG',
      confidence: manualConfidence,
      qualityStatus: manualQuality,
    });

    // Diastolic Blood Pressure
    observations.push({
      id: `obs-dia-${patientId}-${virtualTimestamp}`,
      patientId,
      bedId,
      timestamp: virtualTimestamp,
      source: 'NURSE_MANUAL',
      vitalType: 'DIASTOLIC_BP',
      value: Math.round(groundTruth.diastolicBP + prng.nextGaussian(0, 1.0)),
      unit: 'MMHG',
      confidence: manualConfidence,
      qualityStatus: manualQuality,
    });

    // Body Temperature
    observations.push({
      id: `obs-temp-${patientId}-${virtualTimestamp}`,
      patientId,
      bedId,
      timestamp: virtualTimestamp,
      source: 'NURSE_MANUAL',
      vitalType: 'BODY_TEMPERATURE',
      value: Number((groundTruth.bodyTemperature + prng.nextGaussian(0, 0.1)).toFixed(1)),
      unit: 'CELSIUS',
      confidence: manualConfidence,
      qualityStatus: manualQuality,
    });

    // SpO2: Permitted exclusively from contact pulse oximetry or nurse entry
    observations.push({
      id: `obs-spo2-${patientId}-${virtualTimestamp}`,
      patientId,
      bedId,
      timestamp: virtualTimestamp,
      source: 'NURSE_MANUAL', // NEVER OPTICAL_RPPG
      vitalType: 'OXYGEN_SATURATION',
      value: Math.round(Math.min(100, Math.max(60, groundTruth.oxygenSaturation))),
      unit: 'PERCENT',
      confidence: manualConfidence,
      qualityStatus: manualQuality,
    });
  }

  return {
    observations,
    signalQuality,
    isObservationEmitted: true,
  };
}
