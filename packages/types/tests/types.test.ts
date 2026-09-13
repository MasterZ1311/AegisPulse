import { describe, it, expect } from 'vitest';
import type { Patient, AttentionAssessment, HealthCheckResponse } from '../src/index';

describe('@aegispulse/types contracts', () => {
  it('instantiates valid Patient object adhering to PRODUCT_SPEC.md', () => {
    const patient: Patient = {
      id: 'P001',
      name: 'Ananya Ramanathan',
      age: 42,
      gender: 'F',
      bedNumber: '401-A',
      admissionDiagnosis: 'Post-Op Day 1: Laparoscopic Cholecystectomy',
      admissionTimestamp: Date.now() - 86400000,
      baselineMEWS: 0,
    };

    expect(patient.id).toBe('P001');
    expect(patient.bedNumber).toBe('401-A');
    expect(patient.baselineMEWS).toBe(0);
  });

  it('instantiates valid AttentionAssessment record', () => {
    const assessment: AttentionAssessment = {
      patientId: 'P003',
      bedNumber: '402-A',
      apsScore: 88,
      priorityCategory: 'CRITICAL_REVIEW',
      wardRank: 1,
      whyReasons: [
        'Heart Rate elevated +22% over 35 min',
        'Respiratory Rate tachypneic (24/min)',
        '3h 40m elapsed since last trusted bedside observation',
      ],
      signalConfidence: 94,
      informationAgeMinutes: 220,
      recommendedAction: 'Immediate bedside recheck within 10 minutes; generate SBAR report.',
      velocityScore: 35,
      decayScore: 25,
      mewsComponent: 20,
      biomarkerComponent: 8,
      timestamp: Date.now(),
    };

    expect(assessment.apsScore).toBe(88);
    expect(assessment.priorityCategory).toBe('CRITICAL_REVIEW');
    expect(assessment.wardRank).toBe(1);
    expect(assessment.whyReasons).toHaveLength(3);
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

    expect(health.status).toBe('ok');
    expect(health.service).toBe('aegispulse-api');
  });
});
