import type {
  AuditEvent,
  AuditAction,
  NurseWorkflowAction,
  Observation,
  PatientVerificationProtocol,
  WorkflowActionPayload,
  WorkflowActionResult,
  AttentionPolicyEvent,
} from '@aegispulse/types';
import {
  generateVerificationProtocol,
  CLINICAL_DECISION_SUPPORT_DISCLAIMER,
} from './verification-protocols';
import { assertDecisionSupportBounds } from './safety-guards';
import { AttentionPriorityEngine } from '../attentionPriority/attention-engine';
import { AttentionEventPolicyEngine } from '../eventPolicy/policy-engine';
import type { AttentionPriorityResult } from '../attentionPriority/types';

export interface WorkflowPatientState {
  currentStep: 'IDLE' | 'ACKNOWLEDGED' | 'ASSESSING' | 'COMPLETED' | 'DISMISSED' | 'ESCALATED' | 'FALSE_POSITIVE';
  lastAction?: NurseWorkflowAction;
  protocol?: PatientVerificationProtocol;
  lastAuditId?: string;
  updatedAt: number;
}

/**
 * Human Workflow Manager
 * Coordinates bedside nursing actions, structured verification protocols,
 * immutable audit logging, and dynamic feedback into APS upon entry of verified vitals.
 *
 * Invariant: Never autonomously orders treatment or diagnoses disease.
 */
export class HumanWorkflowManager {
  private readonly states = new Map<string, WorkflowPatientState>();
  private readonly attentionEngine?: AttentionPriorityEngine;
  private readonly policyEngine?: AttentionEventPolicyEngine;

  constructor(options?: {
    attentionEngine?: AttentionPriorityEngine;
    policyEngine?: AttentionEventPolicyEngine;
  }) {
    this.attentionEngine = options?.attentionEngine;
    this.policyEngine = options?.policyEngine;
  }

  /**
   * Retrieves or initializes workflow state for a patient.
   */
  public getWorkflowState(patientId: string): WorkflowPatientState {
    let state = this.states.get(patientId);
    if (!state) {
      state = {
        currentStep: 'IDLE',
        updatedAt: Date.now(),
      };
      this.states.set(patientId, state);
    }
    return state;
  }

  /**
   * Generates and returns structured verification protocols for an elevated patient.
   */
  public getVerificationProtocol(
    apsResult: AttentionPriorityResult
  ): PatientVerificationProtocol {
    const protocol = generateVerificationProtocol(apsResult);
    const state = this.getWorkflowState(apsResult.patientId);
    state.protocol = protocol;
    state.updatedAt = Date.now();
    return protocol;
  }

  /**
   * Executes a human nursing action on a patient's attention workflow.
   * Enforces regulatory non-autonomous boundaries, generates an immutable audit event,
   * and optionally re-evaluates APS if new manual vitals are submitted.
   */
  public executeAction(
    payload: WorkflowActionPayload,
    _currentApsResult?: AttentionPriorityResult
  ): WorkflowActionResult & {
    reEvaluatedAps?: AttentionPriorityResult;
    policyEvent?: AttentionPolicyEvent;
  } {
    // 1. Strict Decision-Support Safety Check
    assertDecisionSupportBounds(payload);

    const now = payload.timestamp ?? Date.now();
    const state = this.getWorkflowState(payload.patientId);
    const previousState = state.currentStep;

    // 2. Determine New Workflow State
    let newState: WorkflowPatientState['currentStep'];
    switch (payload.action) {
      case 'ACKNOWLEDGE':
        newState = 'ACKNOWLEDGED';
        break;
      case 'START_ASSESSMENT':
        newState = 'ASSESSING';
        break;
      case 'COMPLETE_ASSESSMENT':
        newState = 'COMPLETED';
        break;
      case 'DISMISS':
        newState = 'DISMISSED';
        break;
      case 'ESCALATE':
        newState = 'ESCALATED';
        break;
      case 'MARK_FALSE_POSITIVE':
        newState = 'FALSE_POSITIVE';
        break;
      default:
        newState = previousState;
    }

    // 3. Generate Regulatory Audit Event
    const auditId = `audit-wf-${payload.patientId}-${now}-${Math.random().toString(36).substring(2, 7)}`;
    const auditDescription = this.buildAuditDescription(payload, previousState, newState);

    const auditEvent: AuditEvent = {
      id: auditId,
      timestamp: now,
      actorId: payload.actorId,
      actorRole: payload.actorRole,
      action: payload.action as AuditAction,
      targetEntity: 'PATIENT_ATTENTION_WORKFLOW',
      targetEntityId: payload.patientId,
      patientId: payload.patientId,
      description: auditDescription,
      previousState,
      newState,
    };

    // Update internal state
    state.currentStep = newState;
    state.lastAction = payload.action;
    state.lastAuditId = auditId;
    state.updatedAt = now;

    let reEvaluatedAps: AttentionPriorityResult | undefined;
    let policyEvent: AttentionPolicyEvent | undefined;

    // 4. Closed-Loop Physiological Re-Evaluation (if verified observations provided)
    if (payload.newObservations && payload.newObservations.length > 0 && this.attentionEngine) {
      const manualObservations: Observation[] = payload.newObservations.map((no, idx) => ({
        id: `obs-manual-${payload.patientId}-${now}-${idx}`,
        patientId: payload.patientId,
        bedId: payload.bedNumber,
        timestamp: now,
        source: 'NURSE_MANUAL',
        vitalType: no.vitalType,
        value: no.value,
        unit: no.unit,
        confidence: no.confidence ?? 1.0,
        qualityStatus: 'TRUSTED',
      }));

      // Re-evaluate APS with verified manual ground truth
      reEvaluatedAps = this.attentionEngine.evaluate({
        patientId: payload.patientId,
        bedNumber: payload.bedNumber,
        currentTimestamp: now,
        observations: manualObservations,
        lastManualObservationTimestamp: now,
        lastTrustedObservationTimestamp: now,
      });

      // Ingest re-evaluated score into policy engine
      if (this.policyEngine) {
        policyEvent = this.policyEngine.evaluate(reEvaluatedAps, {
          timestamp: now,
          actorUserId: payload.actorId,
        });
      }
    }

    // 5. Policy Engine Coordination
    if (this.policyEngine) {
      if (payload.action === 'ACKNOWLEDGE') {
        const activeAlertId = this.policyEngine.getStateTracker().get(payload.patientId)?.activeAlertId;
        if (activeAlertId) {
          this.policyEngine.acknowledgeAlert(payload.patientId, activeAlertId, payload.actorId, now);
        }
      } else if (payload.action === 'DISMISS' || payload.action === 'MARK_FALSE_POSITIVE') {
        const activeAlertId = this.policyEngine.getStateTracker().get(payload.patientId)?.activeAlertId;
        if (activeAlertId) {
          this.policyEngine.resolveAlert(payload.patientId, activeAlertId, payload.actorId, now);
        }
      }
    }

    return {
      success: true,
      action: payload.action,
      patientId: payload.patientId,
      bedNumber: payload.bedNumber,
      previousState,
      newState,
      auditEvent,
      disclaimer: CLINICAL_DECISION_SUPPORT_DISCLAIMER,
      notes: payload.notes,
      reEvaluatedAps,
      policyEvent,
    };
  }

  /**
   * Resets workflow state.
   */
  public reset(patientId?: string): void {
    if (patientId) {
      this.states.delete(patientId);
    } else {
      this.states.clear();
    }
  }

  /**
   * Builds clear, audit-ready clinical description.
   */
  private buildAuditDescription(
    payload: WorkflowActionPayload,
    prev: string,
    next: string
  ): string {
    const actorInfo = `[${payload.actorRole}] User ${payload.actorId}`;
    const bedInfo = `Bed ${payload.bedNumber} (Patient ${payload.patientId})`;

    switch (payload.action) {
      case 'ACKNOWLEDGE':
        return `${actorInfo} acknowledged alert for ${bedInfo}. Transition: ${prev} -> ${next}. Note: ${payload.notes ?? 'Standard bedside check planned.'}`;
      case 'START_ASSESSMENT':
        return `${actorInfo} initiated bedside assessment for ${bedInfo}. Transition: ${prev} -> ${next}.`;
      case 'COMPLETE_ASSESSMENT': {
        const obsSummary = payload.newObservations?.map((o) => `${o.vitalType}: ${o.value} ${o.unit}`).join(', ');
        return `${actorInfo} completed bedside assessment for ${bedInfo}. Transition: ${prev} -> ${next}. Findings: ${payload.notes ?? 'Vitals recorded'}.${obsSummary ? ` Entered Vitals: [${obsSummary}].` : ''}`;
      }
      case 'DISMISS':
        return `${actorInfo} dismissed attention priority for ${bedInfo}. Transition: ${prev} -> ${next}. Clinical Rationale: ${payload.dismissReason ?? payload.notes ?? 'Non-actionable'}.`;
      case 'ESCALATE':
        return `${actorInfo} triggered escalation to ${payload.escalationTarget ?? 'PHYSICIAN_SBAR'} for ${bedInfo}. Transition: ${prev} -> ${next}. Rationale: ${payload.notes ?? 'Clinical deterioration observed'}.`;
      case 'MARK_FALSE_POSITIVE':
        return `${actorInfo} marked alert as false positive for ${bedInfo}. Transition: ${prev} -> ${next}. Artifact Cause: ${payload.falsePositiveReason ?? 'SENSOR_DISLODGED'}. Note: ${payload.notes ?? 'Sensor readjusted'}.`;
      default:
        return `${actorInfo} performed action ${payload.action} for ${bedInfo}. Transition: ${prev} -> ${next}.`;
    }
  }
}
