/**
 * @aegispulse/signal - Sensing State Machine
 * Deterministic Finite State Machine governing the contactless optical rPPG lifecycle.
 * Enforces strict backward transitions on any sensing perturbation.
 */

import type {
  SensingState,
  SensingStateMachineListener,
  DetectedFace,
  FaceRoiRegions,
} from './types';

export class SensingStateMachine {
  private currentState: SensingState = 'NO_CAMERA';
  private listeners: Set<SensingStateMachineListener> = new Set();
  private lastStateChangeAt: number = Date.now();
  private stableFaceFrames = 0;
  private minStableFramesRequired = 8; // ~260ms of stability at 30 FPS

  constructor(initialState: SensingState = 'NO_CAMERA') {
    this.currentState = initialState;
  }

  public getState(): SensingState {
    return this.currentState;
  }

  public getLastStateChangeAt(): number {
    return this.lastStateChangeAt;
  }

  public subscribe(listener: SensingStateMachineListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private transition(newState: SensingState, reason?: string): void {
    if (this.currentState === newState) return;
    const oldState = this.currentState;
    this.currentState = newState;
    this.lastStateChangeAt = Date.now();

    for (const listener of this.listeners) {
      try {
        listener.onStateChange(newState, oldState, reason);
      } catch (err) {
        console.error('Error in SensingStateMachine listener:', err);
      }
    }
  }

  /**
   * Main state evaluation step executed on each incoming frame analysis.
   */
  public stepFrame(params: {
    isCameraActive: boolean;
    hasCameraPermission: boolean;
    faces: DetectedFace[];
    primaryFace?: DetectedFace;
    isMotionDetected: boolean;
    rois: FaceRoiRegions | null;
    illuminationLux: number;
    bufferDurationSeconds: number;
    sqiScore?: number;
    snrDb?: number;
    confidence?: number;
  }): SensingState {
    // 1. Hardware camera health gates
    if (!params.hasCameraPermission) {
      this.transition('CAMERA_PERMISSION_DENIED', 'Camera access permission denied by user or OS');
      return this.currentState;
    }

    if (!params.isCameraActive) {
      if (this.currentState !== 'NO_CAMERA' && this.currentState !== 'CAMERA_DISCONNECTED') {
        this.transition('CAMERA_DISCONNECTED', 'Camera stream ceased');
      }
      return this.currentState;
    }

    // 2. Lighting adequacy gate
    if (params.illuminationLux < 35) {
      this.transition('INSUFFICIENT_LIGHT', `Illumination ${params.illuminationLux} Lux is below optical threshold`);
      return this.currentState;
    }

    // 3. Multi-Face Gate (Never guess!)
    if (params.faces.length > 1) {
      this.stableFaceFrames = 0;
      this.transition('MULTIPLE_FACES_DETECTED', `Multiple (${params.faces.length}) faces detected in camera frame`);
      for (const listener of this.listeners) {
        listener.onMultipleFaces?.(params.faces.length);
      }
      return this.currentState;
    }

    // 4. No Face Gate (The Critical Release-Blocking Invariant)
    if (params.faces.length === 0 || !params.primaryFace) {
      this.stableFaceFrames = 0;
      // If we previously had a face, transition through FACE_LOST first
      if (
        this.currentState === 'FACE_STABLE' ||
        this.currentState === 'ACQUIRING_SIGNAL' ||
        this.currentState === 'MEASUREMENT_VALID' ||
        this.currentState === 'LOW_SIGNAL_QUALITY' ||
        this.currentState === 'MOTION_CONTAMINATED'
      ) {
        this.transition('FACE_LOST', 'Subject face left camera view');
        return this.currentState;
      }

      this.transition('SEARCHING_FOR_FACE', 'Searching for patient face');
      return this.currentState;
    }

    const face = params.primaryFace;

    // 5. Motion Contamination Gate
    if (params.isMotionDetected || face.stability < 0.65) {
      this.stableFaceFrames = 0;
      this.transition('MOTION_CONTAMINATED', 'Excessive subject or camera motion detected');
      return this.currentState;
    }

    // 6. Face Stability Progression
    this.stableFaceFrames++;
    if (this.stableFaceFrames < this.minStableFramesRequired) {
      this.transition('FACE_DETECTED_UNSTABLE', 'Face found, waiting for spatial stabilization');
      return this.currentState;
    }

    // Face is verified stable
    if (this.currentState === 'SEARCHING_FOR_FACE' || this.currentState === 'FACE_DETECTED_UNSTABLE' || this.currentState === 'FACE_LOST') {
      this.transition('FACE_STABLE', `Face locked with stability ${face.stability}`);
    }

    // 7. ROI Validation Gate
    if (!params.rois || !params.rois.isValid) {
      this.transition('ROI_INVALID', 'Unable to extract anatomically valid forehead/cheek ROIs');
      return this.currentState;
    }

    // 8. Signal Acquisition Duration Gate
    // Minimum 3.0s of continuous buffer required for FFT spectral peak extraction
    if (params.bufferDurationSeconds < 3.0) {
      this.transition('ACQUIRING_SIGNAL', `Buffering optical skin signal (${params.bufferDurationSeconds.toFixed(1)}s / 3.0s minimum)`);
      return this.currentState;
    }

    // 9. Signal Quality (SQI & SNR) Gate
    const snr = params.snrDb ?? 0;
    const confidence = params.confidence ?? 0;

    if (snr < 1.0 || confidence < 0.55) {
      this.transition('LOW_SIGNAL_QUALITY', `Optical SNR (${snr.toFixed(1)} dB) or confidence (${(confidence * 100).toFixed(0)}%) degraded`);
      return this.currentState;
    }

    // 10. Valid Measurement State Reached
    this.transition('MEASUREMENT_VALID', 'High-confidence physiological measurement extracted');
    return this.currentState;
  }

  public reset(): void {
    this.stableFaceFrames = 0;
    this.transition('SEARCHING_FOR_FACE', 'State machine reset');
  }

  public forceState(state: SensingState, reason?: string): void {
    this.transition(state, reason);
  }
}
