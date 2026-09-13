import { describe, it, expect } from 'vitest';
import {
  ClinicalContextSchema,
  LaboratoryResultSchema,
  AttentionReasonSchema,
  AttentionPrioritySchema,
  ClinicalActionSchema,
  validateClinicalContext,
  validateLaboratoryResult,
  validateAttentionPriority,
  validateClinicalAction,
} from '../src/index';

describe('Clinical Entities Validation Suite', () => {
  const validTimestamp = Date.now();
  const validProvenance = {
    derivedAt: validTimestamp,
    algorithm: 'APS_ENGINE',
    algorithmVersion: '1.0.0',
    sourceObservationIds: ['obs-01', 'obs-02'],
    confidence: 0.96,
  };

  describe('1. ClinicalContextSchema Rules', () => {
    it('accepts valid clinical context', () => {
      const context = {
        id: 'ctx-1',
        patientId: 'pat-101',
        admissionReason: 'Severe Community-Acquired Pneumonia',
        postOpDay: 3,
        comorbidities: ['COPD', 'Hypertension', 'Type 2 Diabetes'],
        codeStatus: 'FULL_CODE',
        oxygenDelivery: 'NASAL_CANNULA',
        o2FlowRateLpm: 3.5,
        isolationStatus: 'DROPLET',
        baselineMEWS: 2,
        updatedAt: validTimestamp,
      };
      const res = validateClinicalContext(context);
      expect(res.success).toBe(true);
    });

    it('rejects postOpDay outside [0, 120]', () => {
      const negativeDay = ClinicalContextSchema.safeParse({
        id: 'ctx-neg',
        patientId: 'pat-101',
        admissionReason: 'Observation',
        postOpDay: -1,
        comorbidities: [],
        codeStatus: 'FULL_CODE',
        oxygenDelivery: 'ROOM_AIR',
        isolationStatus: 'NONE',
        baselineMEWS: 0,
        updatedAt: validTimestamp,
      });
      const excessiveDay = ClinicalContextSchema.safeParse({
        id: 'ctx-high',
        patientId: 'pat-101',
        admissionReason: 'Observation',
        postOpDay: 121,
        comorbidities: [],
        codeStatus: 'FULL_CODE',
        oxygenDelivery: 'ROOM_AIR',
        isolationStatus: 'NONE',
        baselineMEWS: 0,
        updatedAt: validTimestamp,
      });
      expect(negativeDay.success).toBe(false);
      expect(excessiveDay.success).toBe(false);
    });

    it('rejects baseline MEWS > 14 or < 0', () => {
      const invalidMEWS = ClinicalContextSchema.safeParse({
        id: 'ctx-mews',
        patientId: 'pat-101',
        admissionReason: 'Observation',
        comorbidities: [],
        codeStatus: 'FULL_CODE',
        oxygenDelivery: 'ROOM_AIR',
        isolationStatus: 'NONE',
        baselineMEWS: 15,
        updatedAt: validTimestamp,
      });
      expect(invalidMEWS.success).toBe(false);
    });
  });

  describe('2. LaboratoryResultSchema & Biomarker Sanity Limits', () => {
    it('accepts valid lactate measurement within physiological limits', () => {
      const lactate = {
        id: 'lab-lac-1',
        patientId: 'pat-101',
        timestamp: validTimestamp,
        testCode: 'LACTATE',
        testName: 'Venous Lactate',
        value: 2.8,
        unit: 'MMOL_PER_L',
        referenceRange: { low: 0.5, high: 2.0 },
        isCritical: true,
        sourceLab: 'Stat Core Laboratory',
      };
      const res = validateLaboratoryResult(lactate);
      expect(res.success).toBe(true);
    });

    it('rejects impossible laboratory values (Lactate > 30.0 or < 0.1)', () => {
      const tooHigh = LaboratoryResultSchema.safeParse({
        id: 'lab-lac-err',
        patientId: 'pat-101',
        timestamp: validTimestamp,
        testCode: 'LACTATE',
        testName: 'Venous Lactate',
        value: 35.0,
        unit: 'MMOL_PER_L',
        referenceRange: { low: 0.5, high: 2.0 },
        isCritical: true,
        sourceLab: 'Stat Core Laboratory',
      });
      const tooLow = LaboratoryResultSchema.safeParse({
        id: 'lab-lac-low',
        patientId: 'pat-101',
        timestamp: validTimestamp,
        testCode: 'LACTATE',
        testName: 'Venous Lactate',
        value: 0.02,
        unit: 'MMOL_PER_L',
        referenceRange: { low: 0.5, high: 2.0 },
        isCritical: true,
        sourceLab: 'Stat Core Laboratory',
      });
      expect(tooHigh.success).toBe(false);
      expect(tooLow.success).toBe(false);
      if (!tooHigh.success) {
        expect(tooHigh.error.issues[0].message).toContain('clinical sanity limits');
      }
    });

    it('enforces WBC physiological boundaries [0.1, 150.0]', () => {
      const validWBC = LaboratoryResultSchema.safeParse({
        id: 'lab-wbc',
        patientId: 'pat-101',
        timestamp: validTimestamp,
        testCode: 'WBC',
        testName: 'White Blood Cell Count',
        value: 14.5,
        unit: 'X10_9_PER_L',
        referenceRange: { low: 4.0, high: 11.0 },
        isCritical: true,
        sourceLab: 'Stat Core Laboratory',
      });
      const invalidWBC = LaboratoryResultSchema.safeParse({
        id: 'lab-wbc-err',
        patientId: 'pat-101',
        timestamp: validTimestamp,
        testCode: 'WBC',
        testName: 'White Blood Cell Count',
        value: 155.0,
        unit: 'X10_9_PER_L',
        referenceRange: { low: 4.0, high: 11.0 },
        isCritical: true,
        sourceLab: 'Stat Core Laboratory',
      });
      expect(validWBC.success).toBe(true);
      expect(invalidWBC.success).toBe(false);
    });

    it('enforces Potassium physiological boundaries [1.0, 10.0]', () => {
      const validK = LaboratoryResultSchema.safeParse({
        id: 'lab-k',
        patientId: 'pat-101',
        timestamp: validTimestamp,
        testCode: 'POTASSIUM',
        testName: 'Serum Potassium',
        value: 4.8,
        unit: 'MEQ_PER_L',
        referenceRange: { low: 3.5, high: 5.0 },
        isCritical: false,
        sourceLab: 'Stat Core Laboratory',
      });
      const lethalK = LaboratoryResultSchema.safeParse({
        id: 'lab-k-err',
        patientId: 'pat-101',
        timestamp: validTimestamp,
        testCode: 'POTASSIUM',
        testName: 'Serum Potassium',
        value: 11.5,
        unit: 'MEQ_PER_L',
        referenceRange: { low: 3.5, high: 5.0 },
        isCritical: true,
        sourceLab: 'Stat Core Laboratory',
      });
      expect(validK.success).toBe(true);
      expect(lethalK.success).toBe(false);
    });
  });

  describe('3. AttentionReasonSchema Rules', () => {
    it('validates compliant attention reason', () => {
      const reason = {
        code: 'VELOCITY_HR_SPIKE',
        description: 'Heart rate increased +24% over past 30 minutes',
        contributionWeight: 0.35,
        triggerValue: 112,
        thresholdValue: 90,
        unit: 'BPM',
        urgency: 'EVALUATE',
      };
      const res = AttentionReasonSchema.safeParse(reason);
      expect(res.success).toBe(true);
    });

    it('rejects contribution weight > 1.0 or < 0.0', () => {
      const highWeight = AttentionReasonSchema.safeParse({
        code: 'VELOCITY_HR_SPIKE',
        description: 'Heart rate spike',
        contributionWeight: 1.25,
        triggerValue: 112,
        thresholdValue: 90,
        unit: 'BPM',
        urgency: 'EVALUATE',
      });
      expect(highWeight.success).toBe(false);
    });
  });

  describe('4. AttentionPrioritySchema & Mandatory Provenance', () => {
    const validAttention = {
      id: 'aps-001',
      patientId: 'pat-101',
      bedNumber: '401-A',
      apsScore: 84.5,
      wardRank: 1,
      category: 'CRITICAL_REVIEW',
      reasons: [
        {
          code: 'VELOCITY_HR_SPIKE',
          description: 'Heart rate rose from 76 to 108 BPM in 30 min',
          contributionWeight: 0.4,
          triggerValue: 108,
          thresholdValue: 90,
          unit: 'BPM',
          urgency: 'CRITICAL_REVIEW',
        },
        {
          code: 'INFORMATION_DECAY_TIMEOUT',
          description: '220 minutes since last manual bedside vitals validation',
          contributionWeight: 0.3,
          triggerValue: 220,
          thresholdValue: 120,
          unit: 'MINUTES',
          urgency: 'EVALUATE',
        },
      ],
      velocityScore: 38,
      decayScore: 26,
      mewsComponent: 15,
      biomarkerComponent: 5.5,
      informationAgeMinutes: 220,
      signalConfidence: 94,
      recommendedAction: 'Bedside reassessment within 10 minutes and manual BP cuff verification.',
      calculatedAt: validTimestamp,
      provenance: validProvenance,
    };

    it('accepts valid AttentionPriority calculation record', () => {
      const res = validateAttentionPriority(validAttention);
      expect(res.success).toBe(true);
    });

    it('REJECTS AttentionPriority without Provenance', () => {
      const { provenance: _removed, ...noProvenance } = validAttention;
      const res = AttentionPrioritySchema.safeParse(noProvenance);
      expect(res.success).toBe(false);
    });

    it('rejects APS score > 100 or < 0', () => {
      const highAPS = AttentionPrioritySchema.safeParse({
        ...validAttention,
        apsScore: 101,
      });
      expect(highAPS.success).toBe(false);
    });

    it('rejects empty reasons list', () => {
      const noReasons = AttentionPrioritySchema.safeParse({
        ...validAttention,
        reasons: [],
      });
      expect(noReasons.success).toBe(false);
    });
  });

  describe('5. ClinicalActionSchema Rules', () => {
    it('validates clinical action prescription', () => {
      const action = {
        id: 'act-001',
        patientId: 'pat-101',
        bedId: 'bed-401a',
        actionType: 'MANUAL_VITALS_RECHECK',
        title: 'Confirm Rapid Heart Rate Velocity',
        rationale: 'Optical rPPG indicates persistent tachycardia with high velocity; manual check required.',
        status: 'RECOMMENDED',
        urgency: 'CRITICAL_REVIEW',
        recommendedAt: validTimestamp,
        targetCompletionTimestamp: validTimestamp + 600000, // 10 min window
      };
      const res = validateClinicalAction(action);
      expect(res.success).toBe(true);
      expect(ClinicalActionSchema.safeParse(action).success).toBe(true);
    });
  });
});
