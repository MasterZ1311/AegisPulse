import type { SeededRandom } from '../prng/seeded-random';
import type { GroundTruthVitals, EnvironmentalState } from '../models/ground-truth';
import type { PhenomenonConfig } from './types';

/**
 * Evaluates and applies active physiological and environmental phenomena
 * to compute exact ground truth biological state at the current simulation tick.
 */
export class PhenomenonEngine {
  /**
   * Apply all active phenomena to baseline vitals and environment for a patient.
   */
  public static applyPhenomena(
    patientId: string,
    currentVirtualMs: number,
    baselineVitals: GroundTruthVitals,
    defaultEnvironment: EnvironmentalState,
    activePhenomena: readonly PhenomenonConfig[],
    prng: SeededRandom
  ): { vitals: GroundTruthVitals; environment: EnvironmentalState; activeNames: string[] } {
    const environment: EnvironmentalState = { ...defaultEnvironment };
    const activeNames: string[] = [];

    // Subtle natural baseline physiological variability (e.g. respiratory sinus arrhythmia)
    const naturalHRJitter = prng.nextGaussian(0, 0.4);
    const naturalRRJitter = prng.nextGaussian(0, 0.2);

    let hrDelta = naturalHRJitter;
    let rrDelta = naturalRRJitter;
    let sysBpDelta = 0;
    let diaBpDelta = 0;
    let spo2Delta = 0;
    let hrvMultiplier = 1.0;
    let recoveryProgress = 0;

    for (const config of activePhenomena) {
      // Check if phenomenon targets this patient (or is a multi-patient phenomenon targeting this ID)
      const isTarget =
        config.patientId === patientId ||
        (config.type === 'SIMULTANEOUS_DETERIORATION' &&
          config.params?.targetPatientIds?.includes(patientId));

      if (!isTarget) continue;

      // Check if within time window
      const endVirtualMs = config.startVirtualMs + config.durationMs;
      if (currentVirtualMs < config.startVirtualMs || currentVirtualMs > endVirtualMs) {
        continue;
      }

      // Compute progress ratio [0.0, 1.0] within the phenomenon window
      const elapsedMs = currentVirtualMs - config.startVirtualMs;
      const progress = Math.max(0.0, Math.min(1.0, elapsedMs / config.durationMs));

      activeNames.push(config.type);

      switch (config.type) {
        // 1. Stable Patient (controlled low-amplitude stationary walk)
        case 'STABLE_PATIENT': {
          hrDelta += prng.nextGaussian(0, 1.0);
          rrDelta += prng.nextGaussian(0, 0.5);
          environment.motionMagnitude = 0.05;
          environment.opticalLineOfSight = true;
          break;
        }

        // 2. Gradual Tachycardia (monotonically accelerating HR)
        case 'GRADUAL_TACHYCARDIA': {
          const targetDelta = config.params?.hrDeltaTarget ?? 24; // e.g. +24 BPM
          hrDelta += targetDelta * progress;
          hrvMultiplier *= Math.max(0.3, 1.0 - progress * 0.4);
          break;
        }

        // 3. Gradual Respiratory Deterioration (tachypneic ramp + mild desaturation)
        case 'GRADUAL_RESPIRATORY_DETERIORATION': {
          const targetDelta = config.params?.rrDeltaTarget ?? 10; // e.g. 16 -> 26
          rrDelta += targetDelta * progress;
          spo2Delta -= progress * 5;
          break;
        }

        // 4. Transient Physiological Spike (bell curve: cough, anxiety, phone call)
        case 'TRANSIENT_PHYSIOLOGICAL_SPIKE': {
          const magnitude = config.params?.spikeMagnitudeHR ?? 28;
          const factor = Math.sin(Math.PI * progress);
          hrDelta += magnitude * factor;
          rrDelta += 4 * factor;
          environment.motionMagnitude = Math.min(1.0, environment.motionMagnitude + factor * 0.4);
          break;
        }

        // 5. Sensor Motion Artifact (turning in bed / restless movement)
        case 'SENSOR_MOTION_ARTIFACT': {
          const peak = config.params?.motionPeak ?? 0.85;
          const factor = Math.sin(Math.PI * progress);
          environment.motionMagnitude = Math.max(environment.motionMagnitude, Number((peak * factor).toFixed(2)));
          hrDelta += 4 * factor;
          break;
        }

        // 6. Poor Lighting / Low Confidence (night curtain, lights off)
        case 'POOR_LIGHTING_LOW_CONFIDENCE': {
          const targetLux = config.params?.luxLevel ?? 18;
          environment.illuminationLux = targetLux;
          break;
        }

        // 7. Missing Observations (patient out of bed / camera occluded)
        case 'MISSING_OBSERVATIONS': {
          environment.opticalLineOfSight = false;
          break;
        }

        // 8. Recovery (decompensated vitals regress back towards baseline)
        case 'RECOVERY': {
          recoveryProgress = Math.max(recoveryProgress, progress);
          break;
        }

        // 9. Persistent Deterioration (multi-parameter crash: HR^, RR^, BPv, Shock Index surges)
        case 'PERSISTENT_DETERIORATION': {
          const hrInc = (config.params?.hrDeltaTarget ?? 35) * progress;
          const rrInc = (config.params?.rrDeltaTarget ?? 12) * progress;
          const bpDec = (config.params?.sysBpDeltaTarget ?? -25) * progress;

          hrDelta += hrInc;
          rrDelta += rrInc;
          sysBpDelta += bpDec;
          diaBpDelta += bpDec * 0.6;
          spo2Delta -= progress * 8;
          break;
        }

        // 10. Simultaneous Deterioration (handled per target patient ID)
        case 'SIMULTANEOUS_DETERIORATION': {
          if (patientId === 'P003') {
            hrDelta += 28 * progress;
            sysBpDelta -= 18 * progress;
          } else if (patientId === 'P006') {
            rrDelta += 11 * progress;
            spo2Delta -= progress * 7;
          } else {
            hrDelta += 20 * progress;
          }
          break;
        }
      }
    }

    // Apply recovery regression if clinical recovery is active
    if (recoveryProgress > 0) {
      const dampening = 1.0 - recoveryProgress;
      hrDelta *= dampening;
      rrDelta *= dampening;
      sysBpDelta *= dampening;
      diaBpDelta *= dampening;
      spo2Delta *= dampening;
    }

    const vitals: GroundTruthVitals = {
      heartRate: Math.round(baselineVitals.heartRate + hrDelta),
      respiratoryRate: Math.round(baselineVitals.respiratoryRate + rrDelta),
      systolicBP: Math.round(baselineVitals.systolicBP + sysBpDelta),
      diastolicBP: Math.round(baselineVitals.diastolicBP + diaBpDelta),
      bodyTemperature: baselineVitals.bodyTemperature,
      oxygenSaturation: Math.max(70, Math.min(100, Math.round(baselineVitals.oxygenSaturation + spo2Delta))),
      hrvRmssd: Math.max(8, Math.round(baselineVitals.hrvRmssd * hrvMultiplier)),
      shockIndex: 0,
    };

    // Derived ground truth Shock Index (HR / Systolic BP)
    vitals.shockIndex = Number((vitals.heartRate / Math.max(40, vitals.systolicBP)).toFixed(2));

    return {
      vitals,
      environment,
      activeNames,
    };
  }
}
