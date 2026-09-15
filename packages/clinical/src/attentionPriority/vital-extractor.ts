import type { Observation, SensorReading, QualityStatus } from '@aegispulse/types';
import type { ExtractedVitals, ExtractedVitalHistory, VitalReading } from './types';

export interface VitalExtractionResult {
  latest: ExtractedVitals;
  history: ExtractedVitalHistory;
  lastTrustedTimestamp?: number;
  lastManualTimestamp?: number;
  lastCameraTimestamp?: number;
  overallSignalConfidence: number;
  latestConfidence: number;
  observationIds: string[];
}


/**
 * Deterministically extracts current vitals and historical trajectories from observation time series
 * and direct SensorReadings.
 *
 * UNCERTAINTY INVARIANT:
 * When a sensor reading has `measurementStatus = 'LOW_CONFIDENCE'`, vitals are NOT fabricated.
 * Confidence and sensor state reflect the uncertainty, but unconfident readings never update trusted vitals.
 */
export function extractVitalsFromObservations(
  observations: Observation[],
  evaluationTimestamp: number,
  sensorReadings?: SensorReading[]
): VitalExtractionResult {
  const hasObs = observations && observations.length > 0;
  const hasSensors = sensorReadings && sensorReadings.length > 0;

  if (!hasObs && !hasSensors) {
    return {
      latest: {},
      history: {},
      lastTrustedTimestamp: undefined,
      lastManualTimestamp: undefined,
      lastCameraTimestamp: undefined,
      overallSignalConfidence: 100, // Default full confidence if no sensor data
      latestConfidence: 1.0,
      observationIds: ['OBS-NONE'],
    };
  }

  const history: ExtractedVitalHistory = {};
  const latest: ExtractedVitals = {};
  let lastTrustedTimestamp: number | undefined;
  let lastManualTimestamp: number | undefined;
  let lastCameraTimestamp: number | undefined;
  let latestConfidence = 1.0;
  let confidenceSum = 0;
  let confidenceCount = 0;
  const observationIds: string[] = [];


  // 1. Process Observations (if present)
  if (hasObs) {
    const sorted = [...observations]
      .filter((o) => o && Number.isFinite(o.timestamp))
      .sort((a, b) => a.timestamp - b.timestamp);

    for (const obs of sorted) {
      observationIds.push(obs.id);

      // Defensively skip observations with non-finite values (NaN / Infinity)
      if (typeof obs.value !== 'number' || !Number.isFinite(obs.value)) {
        continue;
      }

      const reading: VitalReading = {
        value: obs.value,
        timestamp: obs.timestamp,
        confidence: Number.isFinite(obs.confidence) ? Math.max(0, Math.min(1, obs.confidence)) : 0.5,
        qualityStatus: obs.qualityStatus,
        sourceObservationId: obs.id,
      };

      // Track history
      if (!history[obs.vitalType]) {
        history[obs.vitalType] = [];
      }
      history[obs.vitalType]!.push(reading);

      // Latest is the last one encountered since sorted ascending
      latest[obs.vitalType] = reading;

      // Track trusted observations
      if (obs.qualityStatus === 'TRUSTED') {
        if (lastTrustedTimestamp === undefined || obs.timestamp > lastTrustedTimestamp) {
          lastTrustedTimestamp = obs.timestamp;
        }
      }

      // Track manual bedside observations
      if (obs.source === 'NURSE_MANUAL') {
        if (lastManualTimestamp === undefined || obs.timestamp > lastManualTimestamp) {
          lastManualTimestamp = obs.timestamp;
        }
      }

      // Track optical camera observations
      if (obs.source === 'OPTICAL_RPPG') {
        if (lastCameraTimestamp === undefined || obs.timestamp > lastCameraTimestamp) {
          lastCameraTimestamp = obs.timestamp;
        }
      }

      latestConfidence = reading.confidence;

      // Accumulate confidence for recent observations (within last 30 minutes of evaluation)
      if (
        Number.isFinite(evaluationTimestamp) &&
        evaluationTimestamp - obs.timestamp <= 30 * 60 * 1000
      ) {
        confidenceSum += reading.confidence;
        confidenceCount++;
      }
    }
  }

  // 2. Process SensorReadings (if present)
  if (hasSensors) {
    const sortedSensors = [...sensorReadings]
      .filter((sr) => sr && Number.isFinite(sr.timestamp))
      .sort((a, b) => a.timestamp - b.timestamp);

    for (const sr of sortedSensors) {
      observationIds.push(sr.id);

      // Track optical camera readings
      if (sr.source === 'OPTICAL_RPPG' || sr.source === 'WEBCAM') {
        if (lastCameraTimestamp === undefined || sr.timestamp > lastCameraTimestamp) {
          lastCameraTimestamp = sr.timestamp;
        }
      }

      latestConfidence = Number.isFinite(sr.confidence) ? Math.max(0, Math.min(1, sr.confidence)) : 0.5;

      // Accumulate confidence for recent readings
      if (
        Number.isFinite(evaluationTimestamp) &&
        evaluationTimestamp - sr.timestamp <= 30 * 60 * 1000
      ) {
        confidenceSum += latestConfidence;
        confidenceCount++;
      }

      const isLowConfidence =
        sr.measurementStatus === 'LOW_CONFIDENCE' ||
        sr.measurement_status === 'LOW_CONFIDENCE';

      if (isLowConfidence) {
        // ZERO-FABRICATION: When confidence is insufficient, NEVER fabricate a physiological measurement!
        // Do NOT update latest vitals or lastTrustedTimestamp with uncertain reading.
        continue;
      }

      const qualityStatus: QualityStatus = sr.signalQuality.state;
      const isTrusted = qualityStatus === 'TRUSTED';

      if (isTrusted) {
        if (lastTrustedTimestamp === undefined || sr.timestamp > lastTrustedTimestamp) {
          lastTrustedTimestamp = sr.timestamp;
        }
      }

      // Extract valid vitals with strict finiteness validation
      if (sr.heartRate !== undefined && Number.isFinite(sr.heartRate)) {
        const r: VitalReading = {
          value: sr.heartRate,
          timestamp: sr.timestamp,
          confidence: latestConfidence,
          qualityStatus,
          sourceObservationId: sr.id,
        };
        if (!history.HEART_RATE) history.HEART_RATE = [];
        history.HEART_RATE.push(r);
        latest.HEART_RATE = r;
      }

      if (sr.respiratoryRate !== undefined && Number.isFinite(sr.respiratoryRate)) {
        const r: VitalReading = {
          value: sr.respiratoryRate,
          timestamp: sr.timestamp,
          confidence: latestConfidence,
          qualityStatus,
          sourceObservationId: sr.id,
        };
        if (!history.RESPIRATORY_RATE) history.RESPIRATORY_RATE = [];
        history.RESPIRATORY_RATE.push(r);
        latest.RESPIRATORY_RATE = r;
      }

      if (sr.systolicBP !== undefined && Number.isFinite(sr.systolicBP)) {
        const r: VitalReading = {
          value: sr.systolicBP,
          timestamp: sr.timestamp,
          confidence: latestConfidence,
          qualityStatus,
          sourceObservationId: sr.id,
        };
        if (!history.SYSTOLIC_BP) history.SYSTOLIC_BP = [];
        history.SYSTOLIC_BP.push(r);
        latest.SYSTOLIC_BP = r;
      }

      if (sr.diastolicBP !== undefined && Number.isFinite(sr.diastolicBP)) {
        const r: VitalReading = {
          value: sr.diastolicBP,
          timestamp: sr.timestamp,
          confidence: latestConfidence,
          qualityStatus,
          sourceObservationId: sr.id,
        };
        if (!history.DIASTOLIC_BP) history.DIASTOLIC_BP = [];
        history.DIASTOLIC_BP.push(r);
        latest.DIASTOLIC_BP = r;
      }

      if (sr.temperature !== undefined && Number.isFinite(sr.temperature)) {
        const r: VitalReading = {
          value: sr.temperature,
          timestamp: sr.timestamp,
          confidence: latestConfidence,
          qualityStatus,
          sourceObservationId: sr.id,
        };
        if (!history.BODY_TEMPERATURE) history.BODY_TEMPERATURE = [];
        history.BODY_TEMPERATURE.push(r);
        latest.BODY_TEMPERATURE = r;
      }

      if (sr.spo2 !== undefined && Number.isFinite(sr.spo2)) {
        const r: VitalReading = {
          value: sr.spo2,
          timestamp: sr.timestamp,
          confidence: latestConfidence,
          qualityStatus,
          sourceObservationId: sr.id,
        };
        if (!history.OXYGEN_SATURATION) history.OXYGEN_SATURATION = [];
        history.OXYGEN_SATURATION.push(r);
        latest.OXYGEN_SATURATION = r;
      }
    }
  }

  // 3. Calculate or derive Shock Index (HR / SBP) if not explicitly present
  if (
    !latest.SHOCK_INDEX &&
    latest.HEART_RATE &&
    latest.SYSTOLIC_BP &&
    Number.isFinite(latest.HEART_RATE.value) &&
    Number.isFinite(latest.SYSTOLIC_BP.value) &&
    latest.SYSTOLIC_BP.value > 0
  ) {
    const rawSi = latest.HEART_RATE.value / latest.SYSTOLIC_BP.value;
    if (Number.isFinite(rawSi)) {
      const siValue = Number(rawSi.toFixed(2));
      const siTimestamp = Math.max(latest.HEART_RATE.timestamp, latest.SYSTOLIC_BP.timestamp);
      const siConfidence = Math.min(latest.HEART_RATE.confidence, latest.SYSTOLIC_BP.confidence);
      const siQuality =
        latest.HEART_RATE.qualityStatus === 'TRUSTED' && latest.SYSTOLIC_BP.qualityStatus === 'TRUSTED'
          ? 'TRUSTED'
          : 'DEGRADED';

      latest.SHOCK_INDEX = {
        value: siValue,
        timestamp: siTimestamp,
        confidence: siConfidence,
        qualityStatus: siQuality,
        sourceObservationId: `${latest.HEART_RATE.sourceObservationId}_${latest.SYSTOLIC_BP.sourceObservationId}`,
      };
    }
  }

  // Overall confidence percentage (0 to 100)
  const overallSignalConfidence =
    confidenceCount > 0
      ? Math.round((confidenceSum / confidenceCount) * 100)
      : 100;

  return {
    latest,
    history,
    lastTrustedTimestamp,
    lastManualTimestamp,
    lastCameraTimestamp,
    overallSignalConfidence,
    latestConfidence,
    observationIds: observationIds.length > 0 ? observationIds : ['OBS-DEFAULT'],
  };
}
