import { describe, it, expect } from 'vitest';
import {
  SBARReportSchema,
  type Observation,
  type LaboratoryResult,
  type AttentionPriorityCategory,
  type AttentionReasonCode,
} from '@aegispulse/types';
import {
  generateDeterministicSbar,
  AISummarizationLayer,
  validateAiIntegrity,
  AiModificationProhibitedError,
  type SbarInputData,
} from '../src/sbar';
import type { AttentionPriorityResult } from '../src/attentionPriority/types';

function createMockApsResult(params: {
  patientId?: string;
  bedNumber?: string;
  score: number;
  category?: AttentionPriorityCategory;
  reasons?: AttentionReasonCode[];
  mews?: number;
  signalConfidence?: number;
  freshnessScore?: number;
  informationAgeMinutes?: number;
}): AttentionPriorityResult {
  const score = params.score;
  let category: AttentionPriorityCategory = 'LOW';
  if (score >= 75) category = 'CRITICAL_REVIEW';
  else if (score >= 55) category = 'EVALUATE';
  else if (score >= 30) category = 'WATCH';

  return {
    id: `aps-${params.patientId ?? 'p1'}-${Date.now()}`,
    patientId: params.patientId ?? 'p1',
    bedNumber: params.bedNumber ?? 'BED-02',
    score,
    apsScore: score,
    category: params.category ?? category,
    rankInputs: {} as any,
    reasons: (params.reasons ?? ['VELOCITY_HR_SPIKE', 'SHOCK_INDEX_OCCULT']).map((code) => ({
      code,
      title: code,
      description: code,
      severity: 'WARNING',
      category: 'PHYSIOLOGICAL_ACUITY',
    })),
    recommendedActions: [
      {
        actionType: 'MANUAL_VITALS_RECHECK',
        title: 'Immediate Manual Vital Signs Verification',
        rationale: 'Verify rapid heart rate elevation',
        urgency: 'CRITICAL_REVIEW',
        targetCompletionWindowMinutes: 10,
      },
      {
        actionType: 'ATTACH_CUFF',
        title: 'Attach Automated BP Cuff',
        rationale: 'Continuous hemodynamic monitoring',
        urgency: 'CRITICAL_REVIEW',
        targetCompletionWindowMinutes: 15,
      },
    ],
    recommendedAction: 'Immediate manual vital signs check recommended.',
    confidence: params.signalConfidence ?? 90,
    signalConfidence: params.signalConfidence ?? 90,
    timestamp: 1700000000000,
    calculatedAt: 1700000000000,
    wardRank: 1,
    velocityScore: 40,
    decayScore: 10,
    mewsComponent: params.mews ?? 5,
    biomarkerComponent: 0,
    informationAgeMinutes: params.informationAgeMinutes ?? 12,
    freshnessScore: params.freshnessScore ?? 92,
    uncertaintyIndex: 0.08,
    expectedMonitoringIntervalMinutes: 240,
    provenance: {
      derivedAt: 1700000000000,
      algorithm: 'TEST',
      algorithmVersion: '1.0.0',
      sourceObservationIds: ['obs-hr-01', 'obs-rr-01'],
      confidence: 1.0,
      parameters: {},
    },
  };
}

describe('SBAR Clinical Handoff Generator Subsystem', () => {
  const patientId = 'p-sbar-01';
  const bedNumber = 'BED-04';
  const baseTime = 1700000000000;

  const standardObservations: Observation[] = [
    {
      id: 'obs-hr-01',
      patientId,
      bedId: bedNumber,
      timestamp: baseTime,
      source: 'OPTICAL_RPPG',
      vitalType: 'HEART_RATE',
      value: 124,
      unit: 'BPM',
      confidence: 0.95,
      qualityStatus: 'TRUSTED',
    },
    {
      id: 'obs-rr-01',
      patientId,
      bedId: bedNumber,
      timestamp: baseTime,
      source: 'OPTICAL_RPPG',
      vitalType: 'RESPIRATORY_RATE',
      value: 28,
      unit: 'BREATHS_PER_MINUTE',
      confidence: 0.90,
      qualityStatus: 'TRUSTED',
    },
  ];

  describe('1. Deterministic Generation & Section Content', () => {
    it('generates complete Situation, Background, Assessment, and Recommendation conforming to SBARReportSchema', () => {
      const aps = createMockApsResult({ patientId, bedNumber, score: 81 });

      const input: SbarInputData = {
        patient: {
          id: patientId,
          bedNumber,
          name: 'Eleanor Vance',
          age: 67,
          gender: 'FEMALE',
          codeStatus: 'FULL_CODE',
          admissionReason: 'Acute cholecystitis with biliary colic',
          postOpDay: 2,
          comorbidities: ['Hypertension', 'Type 2 Diabetes Mellitus'],
        },
        apsResult: aps,
        observations: standardObservations,
        clinicalContext: {
          id: 'ctx-01',
          patientId,
          admissionReason: 'Acute cholecystitis',
          comorbidities: ['Hypertension'],
          codeStatus: 'FULL_CODE',
          oxygenDelivery: 'NASAL_CANNULA',
          o2FlowRateLpm: 2.0,
          isolationStatus: 'NONE',
          baselineMEWS: 1,
          updatedAt: baseTime,
        },
        currentTimestamp: baseTime,
      };

      const sbar = generateDeterministicSbar(input);

      // 1. Strict Schema Validation (Zod)
      const parsed = SBARReportSchema.parse(sbar);
      expect(parsed.id).toMatch(/^sbar-p-sbar-01-/);
      expect(parsed.patientName).toBe('Eleanor Vance');
      expect(parsed.apsScore).toBe(81);
      expect(parsed.priorityCategory).toBe('CRITICAL_REVIEW');

      // 2. Situation Section Verification
      expect(sbar.situation).toContain('Eleanor Vance (67yo FEMALE)');
      expect(sbar.situation).toContain('[MRN: p-sbar-01] in Bed BED-04');
      expect(sbar.situation).toContain('CRITICAL_REVIEW');
      expect(sbar.situation).toContain('Attention Priority Score: 81/100');
      expect(sbar.situation).toContain('Ward Priority Rank: #1');
      expect(sbar.situation).toContain('VELOCITY_HR_SPIKE');

      // 3. Background Section Verification
      expect(sbar.background).toContain('Acute cholecystitis with biliary colic (Post-op Day 2)');
      expect(sbar.background).toContain('Resuscitation / Code Status: FULL_CODE');
      expect(sbar.background).toContain('Hypertension, Type 2 Diabetes Mellitus');
      expect(sbar.background).toContain('NASAL_CANNULA at 2 L/min');

      // 4. Assessment Section Verification
      expect(sbar.assessment).toContain('124 BPM [TRUSTED]');
      expect(sbar.assessment).toContain('28 breaths/min [TRUSTED]');
      expect(sbar.assessment).toContain('MEWS Component Contribution: 5/14');
      expect(sbar.assessment).toContain('Information Freshness: 92/100');

      // 5. Recommendation Section Verification
      expect(sbar.recommendation).toContain('Immediate Manual Vital Signs Verification');
      expect(sbar.recommendation).toContain('Attach Automated BP Cuff');
      expect(sbar.recommendation).toContain('Decision-support recommendation only');
    });
  });

  describe('2. Anti-Hallucination & Explicit Missing Information Reporting', () => {
    it('explicitly states missing vital signs and does not invent unmeasured parameters', () => {
      // Input only contains Heart Rate and Respiratory Rate (Blood pressure, SpO2, and Temp are missing)
      const aps = createMockApsResult({ patientId, score: 75 });
      const input: SbarInputData = {
        patient: {
          id: patientId,
          bedNumber,
        },
        apsResult: aps,
        observations: standardObservations, // No BP, no SpO2, no Temp
        currentTimestamp: baseTime,
      };

      const sbar = generateDeterministicSbar(input);

      // Verifies exact missingness reporting in Assessment
      expect(sbar.assessment).toContain('Blood Pressure: NOT MEASURED / MISSING (automated cuff not attached)');
      expect(sbar.assessment).toContain('Oxygen Saturation (SpO2): NOT MEASURED / MISSING');
      expect(sbar.assessment).toContain('Temperature: NOT MEASURED / MISSING');
      expect(sbar.assessment).toContain('DATA GAP WARNING: Missing required vital sign modalities: [SYSTOLIC_BP, OXYGEN_SATURATION, BODY_TEMPERATURE]');

      // Verifies Recommendation prompts for data completion
      expect(sbar.recommendation).toContain('DATA COMPLETION RECOMMENDATION:');
      expect(sbar.recommendation).toContain('Perform manual bedside measurement of missing vital parameters: SYSTOLIC_BP, OXYGEN_SATURATION, BODY_TEMPERATURE');

      // Missing inventory metadata
      expect(sbar.missingDataInventory.missingVitals).toContain('SYSTOLIC_BP');
      expect(sbar.missingDataInventory.missingVitals).toContain('OXYGEN_SATURATION');
      expect(sbar.missingDataInventory.missingVitals).toContain('BODY_TEMPERATURE');
    });

    it('explicitly reports missing background, comorbidities, and laboratory data', () => {
      const aps = createMockApsResult({ patientId, score: 35, category: 'WATCH' });
      const input: SbarInputData = {
        patient: {
          id: patientId,
          bedNumber,
          // No admissionReason, no comorbidities, no postOpDay
        },
        apsResult: aps,
        observations: standardObservations,
        // No labs
        currentTimestamp: baseTime,
      };

      const sbar = generateDeterministicSbar(input);

      // Verifies Background missingness reporting
      expect(sbar.background).toContain('Admission Reason: NOT DOCUMENTED / UNKNOWN');
      expect(sbar.background).toContain('Comorbidities: None documented on file');
      expect(sbar.background).toContain('Individualized Baseline Vitals: Not documented; standard ward reference ranges applied');

      // Verifies Labs missingness reporting
      expect(sbar.assessment).toContain('No recent laboratory results on file / Not resulted');
      expect(sbar.missingDataInventory.missingLabs).toBe(true);
      expect(sbar.missingDataInventory.missingComorbidities).toBe(true);
      expect(sbar.missingDataInventory.missingAdmissionReason).toBe(true);
    });

    it('faithfully reports resulted laboratory values when present without fabricating extras', () => {
      const aps = createMockApsResult({ patientId, score: 75 });
      const testLabs: LaboratoryResult[] = [
        {
          id: 'lab-lactate',
          patientId,
          timestamp: baseTime - 15 * 60 * 1000,
          testCode: 'LACTATE',
          testName: 'Serum Lactate',
          value: 3.4,
          unit: 'MMOL_PER_L',
          referenceRange: { low: 0.5, high: 2.0 },
          isCritical: true,
          provenance: {
            derivedAt: baseTime,
            algorithm: 'LAB',
            algorithmVersion: '1',
            sourceObservationIds: ['lis-1'],
            confidence: 1,
          },
        },
      ];

      const input: SbarInputData = {
        patient: { id: patientId, bedNumber },
        apsResult: aps,
        observations: standardObservations,
        labs: testLabs,
        currentTimestamp: baseTime,
      };

      const sbar = generateDeterministicSbar(input);

      expect(sbar.assessment).toContain('Serum Lactate: 3.4 MMOL_PER_L');
      expect(sbar.assessment).toContain('[CRITICAL ABNORMAL]');
      // Ensure no unmeasured labs like WBC or Creatinine were hallucinated
      expect(sbar.assessment).not.toContain('WBC:');
      expect(sbar.assessment).not.toContain('Creatinine:');
    });
  });

  describe('3. Strict Provenance Retention', () => {
    it('retains all source observation IDs and mathematical provenance parameters', () => {
      const aps = createMockApsResult({ patientId, score: 85 });
      const input: SbarInputData = {
        patient: { id: patientId, bedNumber },
        apsResult: aps,
        observations: standardObservations,
        currentTimestamp: baseTime,
      };

      const sbar = generateDeterministicSbar(input);

      expect(sbar.provenance).toBeDefined();
      expect(sbar.provenance.algorithm).toBe('DETERMINISTIC_SBAR_GENERATOR');
      expect(sbar.provenance.algorithmVersion).toBe('1.0.0');
      expect(sbar.provenance.sourceObservationIds).toEqual(['obs-hr-01', 'obs-rr-01']);
      expect(sbar.provenance.confidence).toBe(1.0);
      expect(sbar.provenance.parameters?.apsScore).toBe(85);
      expect(sbar.provenance.parameters?.category).toBe('CRITICAL_REVIEW');
    });
  });

  describe('4. AI-Assisted Summarization Layer (Read-Only)', () => {
    const aiLayer = new AISummarizationLayer();

    it('generates an executive verbal handoff note while strictly preserving underlying SBAR data', async () => {
      const aps = createMockApsResult({ patientId, score: 81 });
      const input: SbarInputData = {
        patient: { id: patientId, bedNumber, name: 'Arthur Pendelton', age: 72 },
        apsResult: aps,
        observations: standardObservations,
        currentTimestamp: baseTime,
      };

      const originalSbar = generateDeterministicSbar(input);
      const aiResult = await aiLayer.enhance(originalSbar);

      // Verify executive note was generated
      expect(aiResult.executiveHandoffNote).toBeTruthy();
      expect(aiResult.executiveHandoffNote).toContain('[EXECUTIVE VERBAL HANDOFF - CRITICAL_REVIEW]');
      expect(aiResult.executiveHandoffNote).toContain('Bed BED-04');

      // Verify underlying SBAR is marked as enhanced
      expect(aiResult.enhancedSbar.isAiEnhanced).toBe(true);
      expect(aiResult.enhancedSbar.aiSummary).toBe(aiResult.executiveHandoffNote);

      // Verify strict audit invariant
      expect(aiResult.readOnlyAudit.verifiedUnalteredAps).toBe(81);
      expect(aiResult.readOnlyAudit.verifiedUnalteredCategory).toBe('CRITICAL_REVIEW');
      expect(aiResult.readOnlyAudit.preservedObservationCount).toBe(2);
    });

    it('prohibits and blocks any AI layer attempt to modify APS score', () => {
      const aps = createMockApsResult({ patientId, score: 80 });
      const originalSbar = generateDeterministicSbar({
        patient: { id: patientId, bedNumber },
        apsResult: aps,
        observations: standardObservations,
      });

      // Tampered clone where AI lowered score
      const tamperedSbar = {
        ...originalSbar,
        apsScore: 25, // Malicious / erroneous score modification!
      };

      expect(() => {
        validateAiIntegrity(originalSbar, tamperedSbar);
      }).toThrow(AiModificationProhibitedError);
    });

    it('prohibits and blocks any AI layer attempt to alter priority category', () => {
      const aps = createMockApsResult({ patientId, score: 80 });
      const originalSbar = generateDeterministicSbar({
        patient: { id: patientId, bedNumber },
        apsResult: aps,
        observations: standardObservations,
      });

      // Tampered category
      const tamperedSbar = {
        ...originalSbar,
        priorityCategory: 'LOW' as const,
      };

      expect(() => {
        validateAiIntegrity(originalSbar, tamperedSbar);
      }).toThrow(AiModificationProhibitedError);
    });

    it('prohibits and blocks any AI layer attempt to alter source observation IDs', () => {
      const aps = createMockApsResult({ patientId, score: 80 });
      const originalSbar = generateDeterministicSbar({
        patient: { id: patientId, bedNumber },
        apsResult: aps,
        observations: standardObservations,
      });

      // Tampered observation provenance
      const tamperedSbar = {
        ...originalSbar,
        provenance: {
          ...originalSbar.provenance,
          sourceObservationIds: ['invented-fake-id'],
        },
      };

      expect(() => {
        validateAiIntegrity(originalSbar, tamperedSbar);
      }).toThrow(AiModificationProhibitedError);
    });
  });
});
