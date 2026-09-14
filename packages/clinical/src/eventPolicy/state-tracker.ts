import type {
  AttentionPriorityCategory,
  AttentionReasonCode,
  Alert,
  PatientAttentionState,
} from '@aegispulse/types';

/**
 * In-memory state tracker for individual patient attention lifecycles.
 * Maintains candidate transitions, hysteresis holds, active alerts,
 * and acknowledgement timeouts.
 */
export class PatientAttentionStateTracker {
  private readonly states = new Map<string, PatientAttentionState>();

  /**
   * Retrieves or initializes state for a patient.
   */
  public getOrCreate(
    patientId: string,
    bedNumber: string,
    now: number
  ): PatientAttentionState {
    let state = this.states.get(patientId);
    if (!state) {
      state = {
        patientId,
        bedNumber,
        confirmedCategory: 'LOW',
        confirmedScore: 0,
        candidateSampleCount: 0,
        lastReasonCodes: [],
        updatedAt: now,
      };
      this.states.set(patientId, state);
    } else if (bedNumber && state.bedNumber !== bedNumber) {
      state.bedNumber = bedNumber;
    }
    return state;
  }

  /**
   * Retrieves current state without creating if missing.
   */
  public get(patientId: string): PatientAttentionState | undefined {
    return this.states.get(patientId);
  }

  /**
   * Updates the confirmed category and score.
   */
  public updateConfirmed(
    patientId: string,
    category: AttentionPriorityCategory,
    score: number,
    now: number
  ): void {
    const state = this.states.get(patientId);
    if (state) {
      state.confirmedCategory = category;
      state.confirmedScore = score;
      state.updatedAt = now;
    }
  }

  /**
   * Records a candidate category crossing awaiting persistence confirmation.
   */
  public setCandidate(
    patientId: string,
    candidateCategory: AttentionPriorityCategory,
    candidateScore: number,
    now: number
  ): void {
    const state = this.states.get(patientId);
    if (state) {
      state.candidateCategory = candidateCategory;
      state.candidateScore = candidateScore;
      state.candidateFirstSeenTimestamp = now;
      state.candidateSampleCount = 1;
      state.updatedAt = now;
    }
  }

  /**
   * Increments candidate sample count while preserving original first seen timestamp.
   */
  public incrementCandidate(patientId: string, latestScore: number, now: number): void {
    const state = this.states.get(patientId);
    if (state) {
      state.candidateSampleCount += 1;
      state.candidateScore = latestScore;
      state.updatedAt = now;
    }
  }

  /**
   * Clears candidate pending state upon confirmation or abandonment.
   */
  public clearCandidate(patientId: string): void {
    const state = this.states.get(patientId);
    if (state) {
      state.candidateCategory = undefined;
      state.candidateFirstSeenTimestamp = undefined;
      state.candidateScore = undefined;
      state.candidateSampleCount = 0;
    }
  }

  /**
   * Sets de-escalation start timestamp.
   */
  public setDeEscalationFirstSeen(patientId: string, now: number): void {
    const state = this.states.get(patientId);
    if (state && state.deEscalationFirstSeenTimestamp === undefined) {
      state.deEscalationFirstSeenTimestamp = now;
      state.updatedAt = now;
    }
  }

  /**
   * Clears de-escalation timer when patient score rises back above recovery threshold.
   */
  public clearDeEscalation(patientId: string): void {
    const state = this.states.get(patientId);
    if (state) {
      state.deEscalationFirstSeenTimestamp = undefined;
    }
  }

  /**
   * Sets active alert.
   */
  public setActiveAlert(patientId: string, alert: Alert): void {
    const state = this.states.get(patientId);
    if (state) {
      state.activeAlert = alert;
      state.activeAlertId = alert.id;
      state.updatedAt = alert.timestamp;
    }
  }

  /**
   * Clears active alert upon resolution.
   */
  public clearActiveAlert(patientId: string): void {
    const state = this.states.get(patientId);
    if (state) {
      state.activeAlert = undefined;
      state.activeAlertId = undefined;
    }
  }

  /**
   * Records nurse/clinician acknowledgement.
   */
  public acknowledgeAlert(
    patientId: string,
    alertId: string,
    userId: string,
    now: number,
    gracePeriodMs: number
  ): boolean {
    const state = this.states.get(patientId);
    if (!state) return false;

    if (state.activeAlert && state.activeAlert.id === alertId) {
      state.activeAlert.isAcknowledged = true;
      state.activeAlert.acknowledgedByUserId = userId;
      state.activeAlert.acknowledgedAt = now;
      state.activeAlert.status = 'ACKNOWLEDGED';
    }

    state.lastAcknowledgedTimestamp = now;
    state.acknowledgedByUserId = userId;
    state.acknowledgedUntilTimestamp = now + gracePeriodMs;
    state.updatedAt = now;
    return true;
  }

  /**
   * Records notification dispatch timestamp for cooldown enforcement.
   */
  public recordNotification(patientId: string, now: number): void {
    const state = this.states.get(patientId);
    if (state) {
      state.lastNotificationTimestamp = now;
      state.updatedAt = now;
    }
  }

  /**
   * Updates last emitted reason codes for duplicate detection.
   */
  public setLastReasonCodes(patientId: string, reasons: AttentionReasonCode[]): void {
    const state = this.states.get(patientId);
    if (state) {
      state.lastReasonCodes = [...reasons];
    }
  }

  /**
   * Resets all or single patient tracking.
   */
  public reset(patientId?: string): void {
    if (patientId) {
      this.states.delete(patientId);
    } else {
      this.states.clear();
    }
  }
}
