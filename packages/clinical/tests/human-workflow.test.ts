import { describe, it, expect, beforeEach } from 'vitest';
import {
  AuditEventSchema,
  type AttentionPriorityCategory,
  type AttentionReasonCode,
} from '@aegispulse/types';
import {
  HumanWorkflowManager,
  generateVerificationProtocol,
  assertDecisionSupportBounds,
  ClinicalSafetyViolationError,
  CLINICAL_DECISION_SUPPORT_DISCLAIMER,
} from '../src/workflow';
import { AttentionPriorityEngine } from '../src/attentionPriority/attention-engine';
import { AttentionEventPolicyEngine } from '../src/eventPolicy/policy-engine';
import type { AttentionPriorityResult } from '../src/attentionPriority/types';

function createMockApsResult(params: {
  patientId?: string;
  bedNumber?: string;
  score: number;
  category?: AttentionPriorityCategory;
  reasons?: AttentionReasonCode[];
  signalConfidence?: number;
}): AttentionPriorityResult {
  const score = params.score;
  let category: AttentionPriorityCategory = 'LOW';
  if (score >= 75) category = 'CRITICAL_REVIEW';
  else if (score >= 55) category = 'EVALUATE';
  else if (score >= 30) category = 'WATCH';

  return {
    id: `aps-${params.patientId ?? 'p1'}-${Date.now()}`,
    patientId: params.patientId ?? 'p1',
    bedNumber: params.bedNumber ?? 'BED-04',
    score,
    apsScore: score,
    category: params.category ?? category,
    rankInputs: {} as any,
    reasons: (params.reasons ?? ['PERSISTENT_DETERIORATION']).map((code) => ({
      code,
      title: code,
      description: code,
      severity: 'WARNING',
      category: 'PHYSIOLOGICAL_ACUITY',
    })),
    recommendedActions: [],
    recommendedAction: 'Bedside nurse evaluation recommended.',
    confidence: params.signalConfidence ?? 100,
    signalConfidence: params.signalConfidence ?? 100,
    timestamp: Date.now(),
    calculatedAt: Date.now(),
    wardRank: 1,
    velocityScore: 0,
    decayScore: 0,
    mewsComponent: 0,
    biomarkerComponent: 0,
    informationAgeMinutes: 0,
    freshnessScore: 100,
    uncertaintyIndex: 0,
    expectedMonitoringIntervalMinutes: 240,
    provenance: {
      derivedAt: Date.now(),
      algorithm: 'TEST',
      algorithmVersion: '1.0.0',
      sourceObservationIds: [],
      confidence: 1.0,
      parameters: {},
    },
  };
}

describe('Human Action Workflow & Verification Subsystem', () => {
  let attentionEngine: AttentionPriorityEngine;
  let policyEngine: AttentionEventPolicyEngine;
  let workflowManager: HumanWorkflowManager;

  beforeEach(() => {
    attentionEngine = new AttentionPriorityEngine();
    policyEngine = new AttentionEventPolicyEngine();
    workflowManager = new HumanWorkflowManager({
      attentionEngine,
      policyEngine,
    });
  });

  describe('1. Recommended Verification Protocols', () => {
    it('generates all 4 core verification protocols with clinical rationales and disclaimers', () => {
      const aps = createMockApsResult({
        patientId: 'p-proto-1',
        score: 78,
        reasons: ['VELOCITY_HR_SPIKE', 'VELOCITY_RR_SPIKE'],
      });

      const protocol = generateVerificationProtocol(aps);

      expect(protocol.patientId).toBe('p-proto-1');
      expect(protocol.apsScore).toBe(78);
      expect(protocol.category).toBe('CRITICAL_REVIEW');
      expect(protocol.clinicalDisclaimer).toBe(CLINICAL_DECISION_SUPPORT_DISCLAIMER);

      // Verify all 4 required verification items are present
      const types = protocol.items.map((i) => i.type);
      expect(types).toContain('BEDSIDE_VITAL_RECHECK');
      expect(types).toContain('MANUAL_BP_CONFIRMATION');
      expect(types).toContain('INSPECT_PATIENT');
      expect(types).toContain('CONFIRM_SIGNAL_QUALITY');

      // Check structure of each protocol item
      for (const item of protocol.items) {
        expect(item.id).toBeDefined();
        expect(item.title).toBeTruthy();
        expect(item.description).toBeTruthy();
        expect(item.rationale).toBeTruthy();
        expect(item.urgency).toBeDefined();
        expect(item.targetWindowMinutes).toBeGreaterThan(0);
        expect(item.isCompleted).toBe(false);
      }
    });

    it('contextually prioritizes manual BP confirmation when occult shock index is flagged', () => {
      const aps = createMockApsResult({
        patientId: 'p-proto-shock',
        score: 82,
        reasons: ['SHOCK_INDEX_OCCULT'],
      });

      const protocol = generateVerificationProtocol(aps);
      const bpItem = protocol.items.find((i) => i.type === 'MANUAL_BP_CONFIRMATION');
      expect(bpItem).toBeDefined();
      expect(bpItem?.urgency).toBe('CRITICAL_REVIEW');
      expect(bpItem?.targetWindowMinutes).toBe(5); // Rapid 5-min target for shock
      expect(bpItem?.rationale).toContain('Occult Shock Index elevation');
    });

    it('contextually prioritizes signal quality confirmation when optical confidence is degraded', () => {
      const aps = createMockApsResult({
        patientId: 'p-proto-signal',
        score: 45,
        reasons: ['SENSOR_CONFIDENCE_DEGRADED'],
        signalConfidence: 30,
      });

      const protocol = generateVerificationProtocol(aps);
      const signalItem = protocol.items.find((i) => i.type === 'CONFIRM_SIGNAL_QUALITY');
      expect(signalItem).toBeDefined();
      expect(signalItem?.urgency).toBe('EVALUATE');
      expect(signalItem?.targetWindowMinutes).toBe(10);
      expect(signalItem?.rationale).toContain('telemetry confidence degraded');
    });
  });

  describe('2. The 6 Nurse Actions & State Machine', () => {
    const patientId = 'p-actions';
    const bedNumber = 'BED-07';

    it('executes ACKNOWLEDGE and silences active alerts during grace period', () => {
      // Create initial active alert in policy engine
      const aps = createMockApsResult({ patientId, bedNumber, score: 65 });
      policyEngine.evaluate(aps, { timestamp: 1000 });
      policyEngine.evaluate(aps, { timestamp: 50000 }); // Confirmed NEW_PRIORITY

      const result = workflowManager.executeAction({
        action: 'ACKNOWLEDGE',
        patientId,
        bedNumber,
        actorId: 'nurse-jane',
        actorRole: 'WARD_NURSE',
        notes: 'Heading to bedside to check telemetry.',
        timestamp: 55000,
      });

      expect(result.success).toBe(true);
      expect(result.action).toBe('ACKNOWLEDGE');
      expect(result.previousState).toBe('IDLE');
      expect(result.newState).toBe('ACKNOWLEDGED');

      // Verify alert is acknowledged in policy engine
      const patientState = policyEngine.getStateTracker().get(patientId);
      expect(patientState?.activeAlert?.isAcknowledged).toBe(true);
      expect(patientState?.activeAlert?.acknowledgedByUserId).toBe('nurse-jane');
    });

    it('executes START_ASSESSMENT transitioning workflow to ASSESSING', () => {
      const result = workflowManager.executeAction({
        action: 'START_ASSESSMENT',
        patientId,
        bedNumber,
        actorId: 'nurse-jane',
        actorRole: 'WARD_NURSE',
        notes: 'At bedside, inspecting patient mentation and work of breathing.',
      });

      expect(result.success).toBe(true);
      expect(result.action).toBe('START_ASSESSMENT');
      expect(result.newState).toBe('ASSESSING');
    });

    it('executes COMPLETE_ASSESSMENT with verified observations', () => {
      const result = workflowManager.executeAction({
        action: 'COMPLETE_ASSESSMENT',
        patientId,
        bedNumber,
        actorId: 'nurse-jane',
        actorRole: 'WARD_NURSE',
        notes: 'Bedside manual vitals confirmed stable.',
        newObservations: [
          { vitalType: 'HEART_RATE', value: 72, unit: 'BPM' },
          { vitalType: 'RESPIRATORY_RATE', value: 16, unit: 'BREATHS_PER_MINUTE' },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.action).toBe('COMPLETE_ASSESSMENT');
      expect(result.newState).toBe('COMPLETED');
    });

    it('executes DISMISS with required clinical rationale', () => {
      const result = workflowManager.executeAction({
        action: 'DISMISS',
        patientId,
        bedNumber,
        actorId: 'nurse-jane',
        actorRole: 'WARD_NURSE',
        dismissReason: 'Patient was ambulating to restroom, causing transient tachycardic spike.',
      });

      expect(result.success).toBe(true);
      expect(result.action).toBe('DISMISS');
      expect(result.newState).toBe('DISMISSED');
    });

    it('executes ESCALATE to trigger rapid response or physician review', () => {
      const result = workflowManager.executeAction({
        action: 'ESCALATE',
        patientId,
        bedNumber,
        actorId: 'nurse-jane',
        actorRole: 'WARD_NURSE',
        escalationTarget: 'RAPID_RESPONSE',
        notes: 'Persistent diaphoresis and uncompensated hypotension.',
      });

      expect(result.success).toBe(true);
      expect(result.action).toBe('ESCALATE');
      expect(result.newState).toBe('ESCALATED');
      expect(result.auditEvent.description).toContain('RAPID_RESPONSE');
    });

    it('executes MARK_FALSE_POSITIVE documenting telemetry artifact and silencing alerts', () => {
      const result = workflowManager.executeAction({
        action: 'MARK_FALSE_POSITIVE',
        patientId,
        bedNumber,
        actorId: 'nurse-jane',
        actorRole: 'WARD_NURSE',
        falsePositiveReason: 'SENSOR_DISLODGED',
        notes: 'Camera optical probe misaligned after patient changed posture. Readjusted.',
      });

      expect(result.success).toBe(true);
      expect(result.action).toBe('MARK_FALSE_POSITIVE');
      expect(result.newState).toBe('FALSE_POSITIVE');
      expect(result.auditEvent.description).toContain('SENSOR_DISLODGED');
    });
  });

  describe('3. Immutable Regulatory Audit Events', () => {
    it('strictly creates valid AuditEvents conforming to Zod schema for every action', () => {
      const actions = [
        { action: 'ACKNOWLEDGE' as const, notes: 'Acknowledged' },
        { action: 'START_ASSESSMENT' as const, notes: 'Started' },
        {
          action: 'COMPLETE_ASSESSMENT' as const,
          notes: 'Completed',
          newObservations: [{ vitalType: 'HEART_RATE' as const, value: 74, unit: 'BPM' as const }],
        },
        { action: 'DISMISS' as const, dismissReason: 'Stable resting' },
        { action: 'ESCALATE' as const, escalationTarget: 'PHYSICIAN_SBAR' as const },
        { action: 'MARK_FALSE_POSITIVE' as const, falsePositiveReason: 'MOTION_ARTIFACT' as const },
      ];

      for (const act of actions) {
        const result = workflowManager.executeAction({
          ...act,
          patientId: 'p-audit-check',
          bedNumber: 'BED-10',
          actorId: 'nurse-bob',
          actorRole: 'CHARGE_NURSE',
          timestamp: 1700000000000,
        });

        // Strict Zod parsing validates HIPAA / med-device regulatory conformance
        const parsed = AuditEventSchema.parse(result.auditEvent);
        expect(parsed.id).toMatch(/^audit-wf-/);
        expect(parsed.actorId).toBe('nurse-bob');
        expect(parsed.actorRole).toBe('CHARGE_NURSE');
        expect(parsed.action).toBe(act.action);
        expect(parsed.targetEntity).toBe('PATIENT_ATTENTION_WORKFLOW');
        expect(parsed.patientId).toBe('p-audit-check');
        expect(parsed.description.length).toBeGreaterThan(10);
      }
    });
  });

  describe('4. Dynamic Closed-Loop APS Response to New Observations', () => {
    it('re-evaluates APS immediately and drops score to baseline when nurse logs normal verified vitals', () => {
      const patientId = 'p-closed-loop';
      const bedNumber = 'BED-12';
      const t0 = 1700000000000;

      // 1. Initial State: Abnormal telemetry (HR 125, RR 28, score 78, CRITICAL_REVIEW)
      const initialObservations = [
        {
          id: 'obs-initial-hr',
          patientId,
          bedId: bedNumber,
          timestamp: t0 - 100000,
          source: 'OPTICAL_RPPG' as const,
          vitalType: 'HEART_RATE' as const,
          value: 125,
          unit: 'BPM' as const,
          confidence: 0.85,
          qualityStatus: 'TRUSTED' as const,
        },
        {
          id: 'obs-initial-rr',
          patientId,
          bedId: bedNumber,
          timestamp: t0 - 100000,
          source: 'OPTICAL_RPPG' as const,
          vitalType: 'RESPIRATORY_RATE' as const,
          value: 28,
          unit: 'BREATHS_PER_MINUTE' as const,
          confidence: 0.85,
          qualityStatus: 'TRUSTED' as const,
        },
      ];

      const initialAps = attentionEngine.evaluate({
        patientId,
        bedNumber,
        currentTimestamp: t0,
        observations: initialObservations,
      });

      expect(initialAps.score).toBeGreaterThanOrEqual(35);
      expect(initialAps.category).toBe('WATCH');

      // 2. Nurse performs bedside check and logs verified normal manual vitals
      const actionResult = workflowManager.executeAction({
        action: 'COMPLETE_ASSESSMENT',
        patientId,
        bedNumber,
        actorId: 'nurse-carol',
        actorRole: 'WARD_NURSE',
        notes: 'Bedside evaluation complete. Patient resting calmly after anxiety resolved.',
        newObservations: [
          { vitalType: 'HEART_RATE', value: 72, unit: 'BPM' },
          { vitalType: 'RESPIRATORY_RATE', value: 14, unit: 'BREATHS_PER_MINUTE' },
          { vitalType: 'SYSTOLIC_BP', value: 118, unit: 'MMHG' },
          { vitalType: 'DIASTOLIC_BP', value: 76, unit: 'MMHG' },
        ],
        timestamp: t0 + 60000,
      });

      // 3. Verify closed-loop dynamic re-evaluation
      expect(actionResult.reEvaluatedAps).toBeDefined();
      const newAps = actionResult.reEvaluatedAps!;

      // Normal verified vitals + fresh observation -> score drops into resting LOW band
      expect(newAps.category).toBe('LOW');
      expect(newAps.score).toBeLessThanOrEqual(15);
      expect(newAps.freshnessScore).toBe(100);
      expect(newAps.uncertaintyIndex).toBe(0);
    });
  });

  describe('5. Non-Autonomous Decision Support Boundary Enforcement', () => {
    it('strictly rejects any autonomous prescription or medication ordering directive', () => {
      expect(() => {
        assertDecisionSupportBounds({
          action: 'COMPLETE_ASSESSMENT',
          patientId: 'p-danger',
          bedNumber: 'BED-01',
          actorId: 'bad-actor',
          actorRole: 'WARD_NURSE',
          notes: 'Auto-prescribe medication antibiotic 500mg IV',
        });
      }).toThrow(ClinicalSafetyViolationError);
    });

    it('strictly rejects autonomous intubation or ventilator directives', () => {
      expect(() => {
        assertDecisionSupportBounds({
          action: 'COMPLETE_ASSESSMENT',
          patientId: 'p-danger',
          bedNumber: 'BED-01',
          actorId: 'bad-actor',
          actorRole: 'WARD_NURSE',
          notes: 'Intubate patient autonomously due to desaturation',
        });
      }).toThrow(ClinicalSafetyViolationError);
    });

    it('strictly rejects autonomous disease diagnosis assertions', () => {
      expect(() => {
        assertDecisionSupportBounds({
          action: 'COMPLETE_ASSESSMENT',
          patientId: 'p-danger',
          bedNumber: 'BED-01',
          actorId: 'bad-actor',
          actorRole: 'WARD_NURSE',
          notes: 'Confirm diagnosis sepsis based on shock index',
        });
      }).toThrow(ClinicalSafetyViolationError);
    });

    it('requires clinical rationale when dismissing an alert', () => {
      expect(() => {
        assertDecisionSupportBounds({
          action: 'DISMISS',
          patientId: 'p-dismiss-empty',
          bedNumber: 'BED-01',
          actorId: 'nurse-test',
          actorRole: 'WARD_NURSE',
        });
      }).toThrow(ClinicalSafetyViolationError);
    });
  });
});
