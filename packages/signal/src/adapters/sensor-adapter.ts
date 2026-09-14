import type {
  SensorReading,
  PhysiologicalObservation,
  Observation,
  QualityStatus,
  VitalType,
  VitalUnit,
} from '@aegispulse/types';

/**
 * Maps sensor reading to clinical PhysiologicalObservation.
 * Strictly enforces zero-fabrication: if measurementStatus is LOW_CONFIDENCE,
 * vitals are undefined and qualityState is UNRELIABLE/DEGRADED.
 */
export function sensorReadingToPhysiologicalObservation(
  reading: SensorReading
): PhysiologicalObservation {
  const isLowConfidence =
    reading.measurementStatus === 'LOW_CONFIDENCE' ||
    reading.measurement_status === 'LOW_CONFIDENCE';

  let qualityState: QualityStatus = reading.signalQuality.state;
  if (isLowConfidence && qualityState === 'TRUSTED') {
    qualityState = 'DEGRADED';
  }

  // Shock index calculated ONLY if both cardiac and BP are trusted and present
  const shockIndex =
    !isLowConfidence &&
    reading.heartRate !== undefined &&
    reading.systolicBP !== undefined &&
    reading.systolicBP > 0
      ? Number((reading.heartRate / reading.systolicBP).toFixed(2))
      : undefined;

  return {
    id: `obs-${reading.id}`,
    patientId: reading.patientId,
    timestamp: reading.timestamp,
    source: reading.source === 'WEBCAM' ? 'OPTICAL_RPPG' : (reading.source as any),
    confidence: reading.confidence,
    qualityState,
    // ZERO-FABRICATION: Never fabricate vitals when confidence is insufficient
    heartRate: isLowConfidence ? undefined : reading.heartRate,
    respiratoryRate: isLowConfidence ? undefined : reading.respiratoryRate,
    spo2: isLowConfidence ? undefined : reading.spo2,
    systolicBP: isLowConfidence ? undefined : reading.systolicBP,
    diastolicBP: isLowConfidence ? undefined : reading.diastolicBP,
    temperature: isLowConfidence ? undefined : reading.temperature,
    shockIndex,
  };
}

/**
 * Converts atomic vital from a SensorReading into an individual Observation entity.
 */
export function sensorReadingToObservation(
  reading: SensorReading,
  vitalType: VitalType
): Observation | null {
  const isLowConfidence =
    reading.measurementStatus === 'LOW_CONFIDENCE' ||
    reading.measurement_status === 'LOW_CONFIDENCE';

  if (isLowConfidence) {
    // Cannot create valid single vital observation if confidence is insufficient
    return null;
  }

  let value: number | undefined;
  let unit: VitalUnit;

  switch (vitalType) {
    case 'HEART_RATE':
      value = reading.heartRate;
      unit = 'BPM';
      break;
    case 'RESPIRATORY_RATE':
      value = reading.respiratoryRate;
      unit = 'BREATHS_PER_MINUTE';
      break;
    case 'SYSTOLIC_BP':
      value = reading.systolicBP;
      unit = 'MMHG';
      break;
    case 'DIASTOLIC_BP':
      value = reading.diastolicBP;
      unit = 'MMHG';
      break;
    case 'BODY_TEMPERATURE':
      value = reading.temperature;
      unit = 'CELSIUS';
      break;
    case 'OXYGEN_SATURATION':
      value = reading.spo2;
      unit = 'PERCENT';
      break;
    case 'SHOCK_INDEX':
      if (reading.heartRate && reading.systolicBP && reading.systolicBP > 0) {
        value = Number((reading.heartRate / reading.systolicBP).toFixed(2));
      }
      unit = 'RATIO';
      break;
    default:
      return null;
  }

  if (value === undefined) {
    return null;
  }

  return {
    id: `obs-${reading.id}-${vitalType.toLowerCase()}`,
    patientId: reading.patientId,
    bedId: reading.bedId ?? 'BED-UNKNOWN',
    timestamp: reading.timestamp,
    source: reading.source === 'WEBCAM' ? 'OPTICAL_RPPG' : (reading.source as any),
    vitalType,
    value,
    unit,
    confidence: reading.confidence,
    qualityStatus: reading.signalQuality.state,
    notes: reading.signalQuality.reason,
  };
}
