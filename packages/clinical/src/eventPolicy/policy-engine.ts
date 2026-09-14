import type {
  MeasurementStatus,
  AttentionPolicyEvent,
  Alert,
  AttentionReason,
  AttentionReasonCode,
  AttentionPriorityCategory,
  PolicyAction,
  PriorityChangeClassification,
} from '@aegispulse/types';
import type { AttentionPriorityResult } from '../attentionPriority/types';
import {
  type EventPolicyConfig,
  DEFAULT_EVENT_POLICY_CONFIG,
  categoryToTier,
  categoryToSeverity,
  getCategoryEntryThreshold,
  getCategoryLowerHysteresisThreshold,
  scoreToCategory,
} from './config';
import { PatientAttentionStateTracker } from './state-tracker';

/**
 * Attention & Notification Event Policy Engine
 * Decoupled from the continuous Attention Priority Score (APS).
 *
 * Implements:
 * - Dual-threshold Hysteresis (prevents boundary oscillation / alarm flapping)
 * - Persistence Windows (suppresses transient artifacts & spikes)
 * - Clinical Safety Fast-Path (bypasses persistence for acute life-threats)
 * - Priority Escalation & De-Escalation Lifecycles
 * - Staff Acknowledgement & Silence Grace Periods
 * - Duplicate Suppression & Cooldown Windows
 * - 6-State Priority Classification:
 *   [NEW_PRIORITY, RISING_PRIORITY, PERSISTENT_PRIORITY, RESOLVED, UNCONFIRMED, SIGNAL_FAILURE]
 */
export class AttentionEventPolicyEngine {
  private readonly config: EventPolicyConfig;
  private readonly stateTracker: PatientAttentionStateTracker;

  constructor(
    customConfig?: Partial<EventPolicyConfig>,
    stateTracker?: PatientAttentionStateTracker
  ) {
    this.config = { ...DEFAULT_EVENT_POLICY_CONFIG, ...(customConfig ?? {}) };
    this.stateTracker = stateTracker ?? new PatientAttentionStateTracker();
  }

  /**
   * Access underlying state tracker.
   */
  public getStateTracker(): PatientAttentionStateTracker {
    return this.stateTracker;
  }

  /**
   * Evaluates an APS result for a patient and applies the notification policy.
   */
  public evaluate(
    apsResult: AttentionPriorityResult,
    options?: {
      signalStatus?: MeasurementStatus;
      timestamp?: number;
      actorUserId?: string;
    }
  ): AttentionPolicyEvent {
    const now = options?.timestamp ?? apsResult.timestamp ?? Date.now();
    const { patientId, bedNumber } = apsResult;
    const state = this.stateTracker.getOrCreate(patientId, bedNumber, now);

    const currentScore = apsResult.score;
    const confirmedCategory = state.confirmedCategory;
    const confirmedScore = state.confirmedScore;
    const rawCategory = scoreToCategory(currentScore, this.config);
    const currentTier = categoryToTier(rawCategory);
    const confirmedTier = categoryToTier(confirmedCategory);
    const scoreDelta = currentScore - confirmedScore;

    // Reason codes extraction
    const reasonCodes: AttentionReasonCode[] = (apsResult.reasons ?? []).map(
      (r: AttentionReason) => r.code
    );

    // ========================================================================
    // 1. SIGNAL FAILURE EVALUATION
    // ========================================================================
    const isSignalFailure =
      options?.signalStatus === 'LOW_CONFIDENCE' ||
      options?.signalStatus === 'UNRELIABLE' ||
      options?.signalStatus === 'TARGET_LOST' ||
      options?.signalStatus === 'DEVICE_DISCONNECTED' ||
      (apsResult.signalConfidence !== undefined &&
        apsResult.signalConfidence / 100 < this.config.signalFailureConfidenceThreshold);

    if (isSignalFailure) {
      return this.handleSignalFailure(
        patientId,
        bedNumber,
        currentScore,
        confirmedScore,
        confirmedCategory,
        now,
        options?.signalStatus
      );
    }

    // ========================================================================
    // 2. CLINICAL SAFETY FAST-PATH EVALUATION
    // ========================================================================
    // Acute life-threat bypasses persistence delay: instant CRITICAL_REVIEW escalation.
    const isFastPath =
      currentScore >= this.config.fastPathMinScore ||
      apsResult.mewsComponent >= 5 ||
      reasonCodes.includes('QSOFA_ESCALATION') ||
      reasonCodes.includes('SHOCK_INDEX_OCCULT');

    // ========================================================================
    // 3. UPWARD ESCALATION EVALUATION (Tier Increase)
    // ========================================================================
    if (currentTier > confirmedTier) {
      if (isFastPath) {
        // Fast-path bypasses persistence hold completely
        this.stateTracker.clearCandidate(patientId);
        this.stateTracker.clearDeEscalation(patientId);
        return this.confirmUpwardTransition(
          apsResult,
          state,
          rawCategory,
          currentScore,
          confirmedCategory,
          confirmedScore,
          scoreDelta,
          now,
          true
        );
      }

      // Standard persistence evaluation
      if (state.candidateCategory !== rawCategory) {
        // First observation of candidate higher category: start persistence hold
        this.stateTracker.setCandidate(patientId, rawCategory, currentScore, now);
        this.stateTracker.clearDeEscalation(patientId);

        return this.createEvent({
          id: `ev-policy-${patientId}-${now}`,
          patientId,
          bedNumber,
          timestamp: now,
          classification: 'UNCONFIRMED',
          action: 'HOLD_UNCONFIRMED',
          currentCategory: rawCategory,
          previousCategory: confirmedCategory,
          currentScore,
          previousScore: confirmedScore,
          scoreDelta,
          isEscalation: true,
          suppressionReason: 'PERSISTENCE_PENDING',
          suppressionDetail: `Awaiting persistence confirmation (${this.config.persistenceWindowMs / 1000}s required)`,
          persistenceProgress: {
            requiredMs: this.config.persistenceWindowMs,
            elapsedMs: 0,
            isMet: false,
          },
          reasons: reasonCodes,
        });
      } else {
        // Continuing candidate observation: evaluate elapsed hold time
        const elapsedMs = now - (state.candidateFirstSeenTimestamp ?? now);
        this.stateTracker.incrementCandidate(patientId, currentScore, now);

        if (elapsedMs < this.config.persistenceWindowMs) {
          return this.createEvent({
            id: `ev-policy-${patientId}-${now}`,
            patientId,
            bedNumber,
            timestamp: now,
            classification: 'UNCONFIRMED',
            action: 'HOLD_UNCONFIRMED',
            currentCategory: rawCategory,
            previousCategory: confirmedCategory,
            currentScore,
            previousScore: confirmedScore,
            scoreDelta,
            isEscalation: true,
            suppressionReason: 'PERSISTENCE_PENDING',
            suppressionDetail: `Persistence pending: ${(elapsedMs / 1000).toFixed(1)}s / ${(this.config.persistenceWindowMs / 1000).toFixed(0)}s`,
            persistenceProgress: {
              requiredMs: this.config.persistenceWindowMs,
              elapsedMs,
              isMet: false,
            },
            reasons: reasonCodes,
          });
        }

        // Persistence satisfied! Confirm upward transition
        this.stateTracker.clearCandidate(patientId);
        this.stateTracker.clearDeEscalation(patientId);
        return this.confirmUpwardTransition(
          apsResult,
          state,
          rawCategory,
          currentScore,
          confirmedCategory,
          confirmedScore,
          scoreDelta,
          now,
          false
        );
      }
    }

    // If score dropped back down while candidate was pending, abandon candidate
    if (state.candidateCategory && currentTier <= confirmedTier) {
      this.stateTracker.clearCandidate(patientId);
    }

    // ========================================================================
    // 4. DOWNWARD DE-ESCALATION EVALUATION (Hysteresis & Recovery)
    // ========================================================================
    if (currentTier < confirmedTier) {
      const upwardThreshold = getCategoryEntryThreshold(confirmedCategory, this.config);
      const lowerThreshold = getCategoryLowerHysteresisThreshold(
        confirmedCategory,
        this.config
      );

      // Check if patient is in the hysteresis gap [lowerThreshold, upwardThreshold)
      if (currentScore >= lowerThreshold) {
        // Hysteresis hold: retain confirmed category, suppress flapping
        this.stateTracker.clearDeEscalation(patientId);

        return this.createEvent({
          id: `ev-policy-${patientId}-${now}`,
          patientId,
          bedNumber,
          timestamp: now,
          classification: 'PERSISTENT_PRIORITY',
          action: 'SUPPRESS',
          currentCategory: confirmedCategory,
          previousCategory: confirmedCategory,
          currentScore,
          previousScore: confirmedScore,
          scoreDelta,
          isEscalation: false,
          suppressionReason: 'HYSTERESIS_HOLD',
          suppressionDetail: `Score ${currentScore} within hysteresis band [${lowerThreshold}, ${upwardThreshold}]. Flapping avoided.`,
          hysteresisMargin: {
            currentScore,
            upwardThreshold,
            downwardThreshold: lowerThreshold,
            margin: this.config.hysteresisMargin,
          },
          reasons: reasonCodes,
        });
      }

      // Patient dropped below lower hysteresis threshold: start/evaluate de-escalation hold
      if (state.deEscalationFirstSeenTimestamp === undefined) {
        this.stateTracker.setDeEscalationFirstSeen(patientId, now);

        return this.createEvent({
          id: `ev-policy-${patientId}-${now}`,
          patientId,
          bedNumber,
          timestamp: now,
          classification: 'UNCONFIRMED',
          action: 'SUPPRESS',
          currentCategory: confirmedCategory,
          previousCategory: confirmedCategory,
          currentScore,
          previousScore: confirmedScore,
          scoreDelta,
          isEscalation: false,
          suppressionReason: 'HYSTERESIS_HOLD',
          suppressionDetail: `De-escalation hold initiated (${this.config.deEscalationWindowMs / 1000}s stabilization required)`,
          persistenceProgress: {
            requiredMs: this.config.deEscalationWindowMs,
            elapsedMs: 0,
            isMet: false,
          },
          reasons: reasonCodes,
        });
      }

      const deEscalationElapsed = now - state.deEscalationFirstSeenTimestamp;
      if (deEscalationElapsed < this.config.deEscalationWindowMs) {
        return this.createEvent({
          id: `ev-policy-${patientId}-${now}`,
          patientId,
          bedNumber,
          timestamp: now,
          classification: 'UNCONFIRMED',
          action: 'SUPPRESS',
          currentCategory: confirmedCategory,
          previousCategory: confirmedCategory,
          currentScore,
          previousScore: confirmedScore,
          scoreDelta,
          isEscalation: false,
          suppressionReason: 'HYSTERESIS_HOLD',
          suppressionDetail: `De-escalation stabilizing: ${(deEscalationElapsed / 1000).toFixed(1)}s / ${(this.config.deEscalationWindowMs / 1000).toFixed(0)}s`,
          persistenceProgress: {
            requiredMs: this.config.deEscalationWindowMs,
            elapsedMs: deEscalationElapsed,
            isMet: false,
          },
          reasons: reasonCodes,
        });
      }

      // De-escalation hold satisfied!
      this.stateTracker.clearDeEscalation(patientId);
      const targetCategory = rawCategory;

      if (targetCategory === 'LOW') {
        // Complete resolution
        if (state.activeAlert) {
          state.activeAlert.status = 'RESOLVED';
          state.activeAlert.resolvedAt = now;
        }
        this.stateTracker.clearActiveAlert(patientId);
        this.stateTracker.updateConfirmed(patientId, 'LOW', currentScore, now);

        return this.createEvent({
          id: `ev-policy-${patientId}-${now}`,
          patientId,
          bedNumber,
          timestamp: now,
          classification: 'RESOLVED',
          action: 'RESOLVE',
          currentCategory: 'LOW',
          previousCategory: confirmedCategory,
          currentScore,
          previousScore: confirmedScore,
          scoreDelta,
          isEscalation: false,
          reasons: reasonCodes,
          metadata: { resolvedAlertId: state.activeAlertId ?? 'none' },
        });
      } else {
        // Downgraded to lower active tier (e.g. CRITICAL_REVIEW -> WATCH)
        this.stateTracker.updateConfirmed(patientId, targetCategory, currentScore, now);

        return this.createEvent({
          id: `ev-policy-${patientId}-${now}`,
          patientId,
          bedNumber,
          timestamp: now,
          classification: 'RESOLVED',
          action: 'DE_ESCALATE',
          currentCategory: targetCategory,
          previousCategory: confirmedCategory,
          currentScore,
          previousScore: confirmedScore,
          scoreDelta,
          isEscalation: false,
          reasons: reasonCodes,
        });
      }
    }

    // ========================================================================
    // 5. SAME TIER EVALUATION (Persistent Priority, Rising Delta, Suppression)
    // ========================================================================
    this.stateTracker.clearCandidate(patientId);
    this.stateTracker.clearDeEscalation(patientId);

    // If at baseline LOW, remain quiescent
    if (confirmedTier === 0) {
      this.stateTracker.updateConfirmed(patientId, 'LOW', currentScore, now);
      return this.createEvent({
        id: `ev-policy-${patientId}-${now}`,
        patientId,
        bedNumber,
        timestamp: now,
        classification: 'PERSISTENT_PRIORITY',
        action: 'SUPPRESS',
        currentCategory: 'LOW',
        previousCategory: 'LOW',
        currentScore,
        previousScore: confirmedScore,
        scoreDelta,
        isEscalation: false,
        suppressionReason: 'COOLDOWN_ACTIVE',
        reasons: reasonCodes,
      });
    }

    // Check for acute intra-category surge: RISING_PRIORITY
    if (scoreDelta >= this.config.risingPriorityMinDelta) {
      this.stateTracker.updateConfirmed(patientId, confirmedCategory, currentScore, now);
      return this.confirmUpwardTransition(
        apsResult,
        state,
        confirmedCategory,
        currentScore,
        confirmedCategory,
        confirmedScore,
        scoreDelta,
        now,
        false,
        true // isIntraCategorySurge
      );
    }

    // Patient remains elevated: evaluate duplicate suppression, cooldown, and ack
    const isAcknowledgedSilent =
      state.acknowledgedUntilTimestamp !== undefined &&
      now < state.acknowledgedUntilTimestamp;

    if (isAcknowledgedSilent) {
      return this.createEvent({
        id: `ev-policy-${patientId}-${now}`,
        patientId,
        bedNumber,
        timestamp: now,
        classification: 'PERSISTENT_PRIORITY',
        action: 'SUPPRESS',
        currentCategory: confirmedCategory,
        previousCategory: confirmedCategory,
        currentScore,
        previousScore: confirmedScore,
        scoreDelta,
        isEscalation: false,
        suppressionReason: 'ACKNOWLEDGED_SILENT',
        suppressionDetail: `Silenced under acknowledgement until ${new Date(state.acknowledgedUntilTimestamp!).toLocaleTimeString()}`,
        reasons: reasonCodes,
      });
    }

    const timeSinceLastNotification =
      now - (state.lastNotificationTimestamp ?? 0);

    // Cooldown check
    if (timeSinceLastNotification < this.config.cooldownPeriodMs) {
      return this.createEvent({
        id: `ev-policy-${patientId}-${now}`,
        patientId,
        bedNumber,
        timestamp: now,
        classification: 'PERSISTENT_PRIORITY',
        action: 'SUPPRESS',
        currentCategory: confirmedCategory,
        previousCategory: confirmedCategory,
        currentScore,
        previousScore: confirmedScore,
        scoreDelta,
        isEscalation: false,
        suppressionReason: 'COOLDOWN_ACTIVE',
        suppressionDetail: `Cooldown active (${((this.config.cooldownPeriodMs - timeSinceLastNotification) / 1000).toFixed(0)}s remaining)`,
        reasons: reasonCodes,
      });
    }

    // Duplicate reason check within suppression window
    const hasSameReasons =
      state.lastReasonCodes.length > 0 &&
      reasonCodes.length > 0 &&
      reasonCodes.every((r) => state.lastReasonCodes.includes(r));

    if (
      hasSameReasons &&
      timeSinceLastNotification < this.config.duplicateSuppressionWindowMs
    ) {
      return this.createEvent({
        id: `ev-policy-${patientId}-${now}`,
        patientId,
        bedNumber,
        timestamp: now,
        classification: 'PERSISTENT_PRIORITY',
        action: 'SUPPRESS',
        currentCategory: confirmedCategory,
        previousCategory: confirmedCategory,
        currentScore,
        previousScore: confirmedScore,
        scoreDelta,
        isEscalation: false,
        suppressionReason: 'DUPLICATE_DEDUPED',
        suppressionDetail: 'Identical alert reasons within duplicate suppression window',
        reasons: reasonCodes,
      });
    }

    // Periodic heartbeat reminder if unacknowledged and re-alert interval elapsed
    if (timeSinceLastNotification >= this.config.reAlertIntervalMs) {
      const reminderAlert = this.buildAlert(
        patientId,
        bedNumber,
        confirmedCategory,
        currentScore,
        apsResult,
        now,
        `Persistent ${confirmedCategory} Attention Reminder`
      );
      this.stateTracker.recordNotification(patientId, now);
      this.stateTracker.setLastReasonCodes(patientId, reasonCodes);

      return this.createEvent({
        id: `ev-policy-${patientId}-${now}`,
        patientId,
        bedNumber,
        timestamp: now,
        classification: 'PERSISTENT_PRIORITY',
        action: 'EMIT_ALERT',
        currentCategory: confirmedCategory,
        previousCategory: confirmedCategory,
        currentScore,
        previousScore: confirmedScore,
        scoreDelta,
        isEscalation: false,
        alert: reminderAlert,
        reasons: reasonCodes,
        metadata: { isPeriodicReminder: true },
      });
    }

    // Default suppression
    return this.createEvent({
      id: `ev-policy-${patientId}-${now}`,
      patientId,
      bedNumber,
      timestamp: now,
      classification: 'PERSISTENT_PRIORITY',
      action: 'SUPPRESS',
      currentCategory: confirmedCategory,
      previousCategory: confirmedCategory,
      currentScore,
      previousScore: confirmedScore,
      scoreDelta,
      isEscalation: false,
      suppressionReason: 'COOLDOWN_ACTIVE',
      reasons: reasonCodes,
    });
  }

  /**
   * Confirms upward transition into an elevated category or acute surge.
   */
  private confirmUpwardTransition(
    apsResult: AttentionPriorityResult,
    _state: ReturnType<PatientAttentionStateTracker['getOrCreate']>,
    newCategory: AttentionPriorityCategory,
    currentScore: number,
    previousCategory: AttentionPriorityCategory,
    previousScore: number,
    scoreDelta: number,
    now: number,
    isFastPath = false,
    isIntraCategorySurge = false
  ): AttentionPolicyEvent {
    const isFirstElevation = categoryToTier(previousCategory) === 0;
    const classification: PriorityChangeClassification = isFirstElevation
      ? 'NEW_PRIORITY'
      : 'RISING_PRIORITY';
    const action: PolicyAction = isFirstElevation ? 'EMIT_ALERT' : 'ESCALATE';

    const alert = this.buildAlert(
      apsResult.patientId,
      apsResult.bedNumber,
      newCategory,
      currentScore,
      apsResult,
      now,
      isFastPath
        ? `CRITICAL EMERGENCY: Life-Threat Escalation (${newCategory})`
        : isIntraCategorySurge
          ? `RISING DETERIORATION: Acute Score Surge (+${scoreDelta})`
          : `NEW PRIORITY: Patient Escalated to ${newCategory}`
    );

    this.stateTracker.updateConfirmed(apsResult.patientId, newCategory, currentScore, now);
    this.stateTracker.setActiveAlert(apsResult.patientId, alert);
    this.stateTracker.recordNotification(apsResult.patientId, now);
    this.stateTracker.setLastReasonCodes(
      apsResult.patientId,
      (apsResult.reasons ?? []).map((r: AttentionReason) => r.code)
    );

    return this.createEvent({
      id: `ev-policy-${apsResult.patientId}-${now}`,
      patientId: apsResult.patientId,
      bedNumber: apsResult.bedNumber,
      timestamp: now,
      classification,
      action,
      currentCategory: newCategory,
      previousCategory,
      currentScore,
      previousScore,
      scoreDelta,
      isEscalation: true,
      alert,
      reasons: (apsResult.reasons ?? []).map((r: AttentionReason) => r.code),
      metadata: {
        isFastPath,
        isIntraCategorySurge,
      },
    });
  }

  /**
   * Handles degraded sensor readings or telemetry connection loss.
   */
  private handleSignalFailure(
    patientId: string,
    bedNumber: string,
    currentScore: number,
    confirmedScore: number,
    confirmedCategory: AttentionPriorityCategory,
    now: number,
    signalStatus?: MeasurementStatus
  ): AttentionPolicyEvent {
    const state = this.stateTracker.getOrCreate(patientId, bedNumber, now);
    const timeSinceLastNotification =
      now - (state.lastNotificationTimestamp ?? 0);

    if (timeSinceLastNotification < this.config.cooldownPeriodMs) {
      return this.createEvent({
        id: `ev-policy-${patientId}-${now}`,
        patientId,
        bedNumber,
        timestamp: now,
        classification: 'SIGNAL_FAILURE',
        action: 'SUPPRESS',
        currentCategory: confirmedCategory,
        previousCategory: confirmedCategory,
        currentScore,
        previousScore: confirmedScore,
        scoreDelta: 0,
        isEscalation: false,
        suppressionReason: 'COOLDOWN_ACTIVE',
        suppressionDetail: 'Signal failure notification in cooldown',
        reasons: ['SENSOR_CONFIDENCE_DEGRADED'],
      });
    }

    const technicalAlert: Alert = {
      id: `alert-tech-${patientId}-${now}`,
      patientId,
      bedNumber,
      timestamp: now,
      severity: 'WARNING',
      status: 'ACTIVE',
      code: 'SENSOR_CONFIDENCE_DEGRADED',
      title: 'Telemetry Signal Quality Degraded',
      message: `Sensor measurement status: ${signalStatus ?? 'LOW_CONFIDENCE'}. Reposition camera or verify bedside probe.`,
      isAcknowledged: false,
    };

    this.stateTracker.recordNotification(patientId, now);

    return this.createEvent({
      id: `ev-policy-${patientId}-${now}`,
      patientId,
      bedNumber,
      timestamp: now,
      classification: 'SIGNAL_FAILURE',
      action: 'EMIT_ALERT',
      currentCategory: confirmedCategory,
      previousCategory: confirmedCategory,
      currentScore,
      previousScore: confirmedScore,
      scoreDelta: 0,
      isEscalation: false,
      alert: technicalAlert,
      reasons: ['SENSOR_CONFIDENCE_DEGRADED'],
      metadata: { signalStatus: signalStatus ?? 'LOW_CONFIDENCE' },
    });
  }

  /**
   * Clinician acknowledges an active alert, initiating silence grace period.
   */
  public acknowledgeAlert(
    patientId: string,
    alertId: string,
    userId: string,
    now: number = Date.now(),
    gracePeriodMs?: number
  ): AttentionPolicyEvent | null {
    const state = this.stateTracker.get(patientId);
    if (!state || !state.activeAlert || state.activeAlert.id !== alertId) {
      return null;
    }

    const effectiveGrace = gracePeriodMs ?? this.config.acknowledgementGracePeriodMs;
    this.stateTracker.acknowledgeAlert(patientId, alertId, userId, now, effectiveGrace);

    return this.createEvent({
      id: `ev-policy-ack-${patientId}-${now}`,
      patientId,
      bedNumber: state.bedNumber,
      timestamp: now,
      classification: 'PERSISTENT_PRIORITY',
      action: 'ACKNOWLEDGE',
      currentCategory: state.confirmedCategory,
      previousCategory: state.confirmedCategory,
      currentScore: state.confirmedScore,
      previousScore: state.confirmedScore,
      scoreDelta: 0,
      isEscalation: false,
      alert: state.activeAlert,
      reasons: state.lastReasonCodes,
      metadata: {
        acknowledgedByUserId: userId,
        silenceUntil: now + effectiveGrace,
      },
    });
  }

  /**
   * Manually resolves an active alert.
   */
  public resolveAlert(
    patientId: string,
    alertId: string,
    userId: string,
    now: number = Date.now()
  ): AttentionPolicyEvent | null {
    const state = this.stateTracker.get(patientId);
    if (!state || !state.activeAlert || state.activeAlert.id !== alertId) {
      return null;
    }

    state.activeAlert.status = 'RESOLVED';
    state.activeAlert.resolvedAt = now;
    const oldCategory = state.confirmedCategory;

    this.stateTracker.clearActiveAlert(patientId);
    this.stateTracker.updateConfirmed(patientId, 'LOW', 0, now);

    return this.createEvent({
      id: `ev-policy-resolve-${patientId}-${now}`,
      patientId,
      bedNumber: state.bedNumber,
      timestamp: now,
      classification: 'RESOLVED',
      action: 'RESOLVE',
      currentCategory: 'LOW',
      previousCategory: oldCategory,
      currentScore: 0,
      previousScore: state.confirmedScore,
      scoreDelta: -state.confirmedScore,
      isEscalation: false,
      reasons: [],
      metadata: { resolvedByUserId: userId, alertId },
    });
  }

  /**
   * Resets engine state for one or all patients.
   */
  public reset(patientId?: string): void {
    this.stateTracker.reset(patientId);
  }

  /**
   * Builds an Alert object.
   */
  private buildAlert(
    patientId: string,
    bedNumber: string,
    category: AttentionPriorityCategory,
    score: number,
    apsResult: AttentionPriorityResult,
    now: number,
    title: string
  ): Alert {
    const primaryReason = apsResult.reasons?.[0]?.code ?? 'PERSISTENT_DETERIORATION';
    const message =
      apsResult.recommendedAction ||
      `Patient requires attention. Category: ${category} (APS: ${score}).`;

    return {
      id: `alert-${patientId}-${now}-${Math.random().toString(36).substring(2, 7)}`,
      patientId,
      bedNumber,
      timestamp: now,
      severity: categoryToSeverity(category),
      status: 'ACTIVE',
      code: primaryReason,
      title,
      message,
      isAcknowledged: false,
    };
  }

  private createEvent(event: AttentionPolicyEvent): AttentionPolicyEvent {
    return event;
  }
}
