/**
 * @aegispulse/signal - Patient Measurement Session & Face Assignment
 * Enforces explicit clinical session binding between patient, bed, and tracked face.
 */

import type {
  FaceAssignment,
  PatientMeasurementSession,
  SessionLockStatus,
  SensingState,
} from './types';

export class SensingSessionManager {
  private currentSession: PatientMeasurementSession | null = null;

  /**
   * Initiates a new spot-check sensing session for an explicitly selected patient.
   */
  public startSession(params: {
    patientId: string;
    bedId: string;
    nurseId?: string;
    deviceId?: string;
  }): PatientMeasurementSession {
    // If an existing session is running, abort it safely first
    if (this.currentSession && !this.currentSession.completedAt) {
      this.abortSession('Superseded by new patient session');
    }

    const sessionId = `SES-${params.patientId}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

    this.currentSession = {
      sessionId,
      patientId: params.patientId,
      bedId: params.bedId,
      nurseId: params.nurseId,
      deviceId: params.deviceId,
      startedAt: Date.now(),
      state: 'CAMERA_INITIALIZING',
      sampleCount: 0,
      windowDurationSeconds: 0,
    };

    return this.currentSession;
  }

  /**
   * Locks an identified face track to the active patient session.
   */
  public lockFace(faceTrackingId: string): FaceAssignment | null {
    if (!this.currentSession) return null;

    const assignment: FaceAssignment = {
      patientId: this.currentSession.patientId,
      bedId: this.currentSession.bedId,
      sessionId: this.currentSession.sessionId,
      faceTrackingId,
      assignedAt: Date.now(),
      status: 'LOCKED',
      lastActiveTimestamp: Date.now(),
    };

    this.currentSession.faceAssignment = assignment;
    return assignment;
  }

  /**
   * Verifies if an observed face matches the locked session face.
   */
  public verifyFaceMatch(trackingId: string): boolean {
    if (!this.currentSession || !this.currentSession.faceAssignment) return false;
    return this.currentSession.faceAssignment.faceTrackingId === trackingId;
  }

  /**
   * Updates the lock status of the active session.
   */
  public updateLockStatus(status: SessionLockStatus): void {
    if (!this.currentSession || !this.currentSession.faceAssignment) return;
    this.currentSession.faceAssignment.status = status;
    this.currentSession.faceAssignment.lastActiveTimestamp = Date.now();
  }

  public updateState(state: SensingState, sampleCount?: number, windowSeconds?: number): void {
    if (!this.currentSession) return;
    this.currentSession.state = state;
    if (typeof sampleCount === 'number') this.currentSession.sampleCount = sampleCount;
    if (typeof windowSeconds === 'number') this.currentSession.windowDurationSeconds = windowSeconds;
  }

  public getSession(): PatientMeasurementSession | null {
    return this.currentSession;
  }

  public completeSession(): PatientMeasurementSession | null {
    if (!this.currentSession) return null;
    this.currentSession.completedAt = Date.now();
    this.updateLockStatus('COMPLETED');
    const finished = { ...this.currentSession };
    this.currentSession = null;
    return finished;
  }

  public abortSession(_reason?: string): PatientMeasurementSession | null {
    if (!this.currentSession) return null;
    this.currentSession.completedAt = Date.now();
    this.updateLockStatus('ABORTED');
    const aborted = { ...this.currentSession };
    this.currentSession = null;
    return aborted;
  }
}
