export type PhenomenonType =
  | 'STABLE_PATIENT'
  | 'GRADUAL_TACHYCARDIA'
  | 'GRADUAL_RESPIRATORY_DETERIORATION'
  | 'TRANSIENT_PHYSIOLOGICAL_SPIKE'
  | 'SENSOR_MOTION_ARTIFACT'
  | 'POOR_LIGHTING_LOW_CONFIDENCE'
  | 'MISSING_OBSERVATIONS'
  | 'RECOVERY'
  | 'PERSISTENT_DETERIORATION'
  | 'SIMULTANEOUS_DETERIORATION';

export interface PhenomenonConfig {
  type: PhenomenonType;
  patientId: string;
  startVirtualMs: number;
  durationMs: number;
  params?: {
    hrDeltaTarget?: number; // e.g., +25 BPM
    rrDeltaTarget?: number; // e.g., +10 breaths/min
    sysBpDeltaTarget?: number; // e.g., -25 mmHg
    spikeMagnitudeHR?: number; // e.g., +30 BPM
    motionPeak?: number; // e.g., 0.85
    luxLevel?: number; // e.g., 18 lux
    targetPatientIds?: string[]; // for simultaneous deterioration
  };
}
