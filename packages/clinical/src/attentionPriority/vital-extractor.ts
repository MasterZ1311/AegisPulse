import type { Observation } from '@aegispulse/types';
import type { ExtractedVitals, ExtractedVitalHistory, VitalReading } from './types';

export interface VitalExtractionResult {
  latest: ExtractedVitals;
  history: ExtractedVitalHistory;
  lastTrustedTimestamp?: number;
  overallSignalConfidence: number;
  observationIds: string[];
}

/**
 * Deterministically extracts current vitals and historical trajectories from observation time series.
 */
export function extractVitalsFromObservations(
  observations: Observation[],
  evaluationTimestamp: number
): VitalExtractionResult {
  if (!observations || observations.length === 0) {
    return {
      latest: {},
      history: {},
      lastTrustedTimestamp: undefined,
      overallSignalConfidence: 100, // Default full confidence if no sensor data
      observationIds: ['OBS-NONE'],
    };
  }

  // Sort chronologically ascending
  const sorted = [...observations].sort((a, b) => a.timestamp - b.timestamp);

  const history: ExtractedVitalHistory = {};
  const latest: ExtractedVitals = {};
  let lastTrustedTimestamp: number | undefined;
  let confidenceSum = 0;
  let confidenceCount = 0;
  const observationIds: string[] = [];

  for (const obs of sorted) {
    observationIds.push(obs.id);

    const reading: VitalReading = {
      value: obs.value,
      timestamp: obs.timestamp,
      confidence: obs.confidence,
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
      if (!lastTrustedTimestamp || obs.timestamp > lastTrustedTimestamp) {
        lastTrustedTimestamp = obs.timestamp;
      }
    }

    // Accumulate confidence for recent observations (within last 30 minutes of evaluation)
    if (evaluationTimestamp - obs.timestamp <= 30 * 60 * 1000) {
      confidenceSum += obs.confidence;
      confidenceCount++;
    }
  }

  // Calculate or derive Shock Index (HR / SBP) if not explicitly present
  if (!latest.SHOCK_INDEX && latest.HEART_RATE && latest.SYSTOLIC_BP && latest.SYSTOLIC_BP.value > 0) {
    const siValue = Number(
      (latest.HEART_RATE.value / latest.SYSTOLIC_BP.value).toFixed(2)
    );
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

  // Overall confidence percentage (0 to 100)
  const overallSignalConfidence =
    confidenceCount > 0
      ? Math.round((confidenceSum / confidenceCount) * 100)
      : 100;

  return {
    latest,
    history,
    lastTrustedTimestamp,
    overallSignalConfidence,
    observationIds: observationIds.length > 0 ? observationIds : ['OBS-DEFAULT'],
  };
}
