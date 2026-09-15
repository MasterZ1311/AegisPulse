/**
 * @aegispulse/signal - Face-First Sensing Types & State Contracts
 * Strict clinical and privacy-preserving contracts for contactless optical rPPG.
 */

export type SensingState =
  | 'NO_CAMERA'
  | 'CAMERA_PERMISSION_DENIED'
  | 'CAMERA_INITIALIZING'
  | 'SEARCHING_FOR_FACE'
  | 'FACE_DETECTED_UNSTABLE'
  | 'FACE_STABLE'
  | 'ROI_INVALID'
  | 'ACQUIRING_SIGNAL'
  | 'LOW_SIGNAL_QUALITY'
  | 'MOTION_CONTAMINATED'
  | 'INSUFFICIENT_LIGHT'
  | 'MEASUREMENT_VALID'
  | 'FACE_LOST'
  | 'MULTIPLE_FACES_DETECTED'
  | 'CAMERA_DISCONNECTED'
  | 'ERROR';

export type FacePresenceStatus =
  | 'NO_FACE'
  | 'ONE_VALID_FACE'
  | 'MULTIPLE_FACES'
  | 'UNSTABLE_FACE';

export interface NormalizedRect {
  x: number;      // 0.0 to 1.0 (left)
  y: number;      // 0.0 to 1.0 (top)
  width: number;  // 0.0 to 1.0
  height: number; // 0.0 to 1.0
}

export interface DetectedFace {
  trackingId: string;
  boundingBox: NormalizedRect;
  confidence: number;            // 0.0 to 1.0
  lastSeenAt: number;            // Unix epoch ms
  stability: number;             // 0.0 (erratic) to 1.0 (completely stationary)
  poseQuality: number;           // 0.0 (extreme tilt) to 1.0 (ideal frontal)
  occlusionQuality: number;      // 0.0 (severe occlusion) to 1.0 (unoccluded skin)
  skinFraction: number;          // 0.0 to 1.0 percentage of viable skin pixels
  landmarks?: {
    leftEye?: [number, number];
    rightEye?: [number, number];
    noseTip?: [number, number];
    mouthCenter?: [number, number];
  };
}

export interface FaceDetectionFrameResult {
  timestampMs: number;
  status: FacePresenceStatus;
  faces: DetectedFace[];
  primaryFace?: DetectedFace;
  totalFacesDetected: number;
  illuminationLux: number;
  frameWidth: number;
  frameHeight: number;
}

export interface FaceRoiRegions {
  forehead: NormalizedRect;
  leftCheek: NormalizedRect;
  rightCheek: NormalizedRect;
  isValid: boolean;
  skinFraction: number;
  lastCalculatedAt: number;
}

export interface RoiSpatialAverages {
  foreheadRgb: [number, number, number]; // [meanR, meanG, meanB]
  leftCheekRgb?: [number, number, number];
  rightCheekRgb?: [number, number, number];
  compositeRgb: [number, number, number];
  pixelCount: number;
  skinFraction: number;
}

export type SessionLockStatus =
  | 'IDLE'
  | 'LOCKING'
  | 'LOCKED'
  | 'FACE_LOST'
  | 'PAUSED_MULTIPLE_FACES'
  | 'COMPLETED'
  | 'ABORTED';

export interface FaceAssignment {
  patientId: string;
  bedId: string;
  sessionId: string;
  faceTrackingId: string;
  assignedAt: number;
  status: SessionLockStatus;
  lastActiveTimestamp: number;
}

export interface PatientMeasurementSession {
  sessionId: string;
  patientId: string;
  bedId: string;
  nurseId?: string;
  deviceId?: string;
  startedAt: number;
  completedAt?: number;
  faceAssignment?: FaceAssignment;
  state: SensingState;
  sampleCount: number;
  windowDurationSeconds: number;
}

export interface SensingStateMachineListener {
  onStateChange: (newState: SensingState, previousState: SensingState, reason?: string) => void;
  onFaceLost?: (trackingId: string, elapsedMs: number) => void;
  onMultipleFaces?: (faceCount: number) => void;
  onMeasurementReady?: (heartRate: number, respiratoryRate?: number, confidence?: number) => void;
}
