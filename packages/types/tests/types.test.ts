import { describe, it, expect } from 'vitest';
import {
  PatientSchema,
  AttentionAssessmentSchema,
  HealthCheckResponseSchema,
  type Patient,
  type AttentionAssessment,
  type HealthCheckResponse,
} from '../src/index';

describe('@aegispulse/types contracts and schema parsing', () => {
  const now = Date.now();

  it('instantiates and validates Patient object adhering to PRODUCT_SPEC.md', () => {
    const rawPatient = {
      id: 'P001',
      name: 'Ananya Ramanathan',
      age: 42,
      gender: 'F',
      bedNumber: '401-A',
      admissionDiagnosis: 'Post-Op Day 1: Laparoscopic Cholecystectomy',
      admissionTimestamp: now - 86400000,
      baselineMEWS: 0,
    };

    const parseResult = PatientSchema.safeParse(rawPatient);
    expect(parseResult.success).toBe(true);

    if (parseResult.success) {
      const patient: Patient = parseResult.data;
      expect(patient.id).toBe('P001');
      expect(patient.bedNumber).toBe('401-A');
      expect(patient.baselineMEWS).toBe(0);
      expect(patient.mrn).toBe('MRN-AUTO');
      expect(patient.attendingPhysician).toBe('Staff Attending');
    }
  });

  it('instantiates and validates AttentionAssessment with provenance', () => {
    const assessment: AttentionAssessment = {
      id: 'aps-p003',
      patientId: 'P003',
      bedNumber: '402-A',
      apsScore: 88,
      category: 'CRITICAL_REVIEW',
      wardRank: 1,
      reasons: [
        {
          code: 'VELOCITY_HR_SPIKE',
          description: 'Heart Rate elevated +22% over 35 min',
          contributionWeight: 0.4,
          triggerValue: 104,
          thresholdValue: 90,
          unit: 'BPM',
          urgency: 'CRITICAL_REVIEW',
        },
        {
          code: 'VELOCITY_RR_SPIKE',
          description: 'Respiratory Rate tachypneic (24/min)',
          contributionWeight: 0.35,
          triggerValue: 24,
          thresholdValue: 20,
          unit: 'BREATHS_PER_MINUTE',
          urgency: 'CRITICAL_REVIEW',
        },
        {
          code: 'INFORMATION_DECAY_TIMEOUT',
          description: '3h 40m elapsed since last trusted bedside observation',
          contributionWeight: 0.25,
          triggerValue: 220,
          thresholdValue: 120,
          unit: 'MINUTES',
          urgency: 'EVALUATE',
        },
      ],
      signalConfidence: 94,
      informationAgeMinutes: 220,
      recommendedAction: 'Immediate bedside recheck within 10 minutes; generate SBAR report.',
      velocityScore: 35,
      decayScore: 25,
      mewsComponent: 20,
      biomarkerComponent: 8,
      calculatedAt: now,
      provenance: {
        derivedAt: now,
        algorithm: 'APS_CORE_ENGINE',
        algorithmVersion: '1.0.0',
        sourceObservationIds: ['obs-1', 'obs-2'],
        confidence: 0.94,
      },
    };

    const parseResult = AttentionAssessmentSchema.safeParse(assessment);
    expect(parseResult.success).toBe(true);

    if (parseResult.success) {
      expect(assessment.apsScore).toBe(88);
      expect(assessment.category).toBe('CRITICAL_REVIEW');
      expect(assessment.wardRank).toBe(1);
      expect(assessment.reasons).toHaveLength(3);
    }
  });

  it('validates HealthCheckResponse format', () => {
    const health: HealthCheckResponse = {
      status: 'ok',
      service: 'aegispulse-api',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      uptimeSeconds: 42,
      environment: 'development',
    };

    const parseResult = HealthCheckResponseSchema.safeParse(health);
    expect(parseResult.success).toBe(true);
    expect(health.status).toBe('ok');
    expect(health.service).toBe('aegispulse-api');
  });
});
