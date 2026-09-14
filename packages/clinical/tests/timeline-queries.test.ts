import { describe, it, expect } from 'vitest';
import { PatientTimelineRepository } from '../src/timeline/repository';
import type { UnifiedTimelineEvent } from '@aegispulse/types';

describe('Unified Patient Timeline Analytical Queries', () => {
  const repo = new PatientTimelineRepository();
  const patientId = 'PATIENT-001';
  const now = 1773500000000; // Reference timestamp

  it('answers "What changed during the last 4 hours?" with vital deltas, score transitions and narrative', () => {
    repo.clear(patientId);

    const fourHoursAgo = now - 4 * 60 * 60 * 1000;

    // Add baseline vital (4 hours ago)
    repo.addEvent({
      id: 'ev-hr-start',
      patientId,
      timestamp: fourHoursAgo,
      eventType: 'VITAL_MEASUREMENT',
      title: 'HR baseline',
      description: 'HR 70 bpm',
      source: 'OPTICAL_RPPG',
      isTrusted: true,
      severity: 'INFO',
      data: { vitalType: 'HEART_RATE', value: 70, unit: 'BPM' },
    });

    // Add elevated vital (now)
    repo.addEvent({
      id: 'ev-hr-end',
      patientId,
      timestamp: now,
      eventType: 'VITAL_MEASUREMENT',
      title: 'HR surge',
      description: 'HR 92 bpm',
      source: 'OPTICAL_RPPG',
      isTrusted: true,
      severity: 'WARNING',
      data: { vitalType: 'HEART_RATE', value: 92, unit: 'BPM' },
    });

    // Add MEWS transition
    repo.addEvent({
      id: 'ev-mews',
      patientId,
      timestamp: now - 30 * 60 * 1000,
      eventType: 'MEWS_CHANGE',
      title: 'MEWS Escalation',
      description: 'MEWS transitioned to 4 (YELLOW)',
      source: 'CLINICAL_ENGINE',
      isTrusted: true,
      severity: 'WARNING',
      data: { previousScore: 0, currentScore: 4, triageLevel: 'YELLOW' },
    });

    // Add nurse visit
    repo.addEvent({
      id: 'ev-nurse',
      patientId,
      timestamp: now - 60 * 60 * 1000,
      eventType: 'NURSE_VISIT',
      title: 'Nurse Bedside Round',
      description: 'Assessed patient comfort and hydration.',
      source: 'MANUAL_ENTRY',
      isTrusted: true,
      severity: 'INFO',
    });

    const res = repo.getChangesInWindow(patientId, 4, now);

    expect(res.patientId).toBe(patientId);
    expect(res.windowHours).toBe(4);
    expect(res.totalEventsInWindow).toBe(4);
    expect(res.vitalDeltas).toHaveLength(1);
    expect(res.vitalDeltas[0].vitalType).toBe('HEART_RATE');
    expect(res.vitalDeltas[0].startValue).toBe(70);
    expect(res.vitalDeltas[0].endValue).toBe(92);
    expect(res.vitalDeltas[0].percentChange).toBeCloseTo(31.4, 1);
    expect(res.vitalDeltas[0].trend).toBe('RISING');

    expect(res.scoreTransitions).toHaveLength(1);
    expect(res.scoreTransitions[0].scoreName).toBe('MEWS');
    expect(res.scoreTransitions[0].scoreDelta).toBe(4);
    expect(res.scoreTransitions[0].escalated).toBe(true);

    expect(res.nurseVisitsCount).toBe(1);
    expect(res.narrativeSummary).toContain('HEART_RATE');
    expect(res.narrativeSummary).toContain('MEWS');
  });

  it('answers "What caused the patient\'s priority to rise?" attributing respiratory surge and MEWS trigger', () => {
    repo.clear(patientId);

    const oneHourAgo = now - 60 * 60 * 1000;

    // Add baseline RR
    repo.addEvent({
      id: 'ev-rr-base',
      patientId,
      timestamp: oneHourAgo,
      eventType: 'VITAL_MEASUREMENT',
      title: 'Baseline RR',
      description: 'RR 16 /min',
      source: 'OPTICAL_RPPG',
      isTrusted: true,
      severity: 'INFO',
      data: { vitalType: 'RESPIRATORY_RATE', value: 16, unit: 'BREATHS_PER_MINUTE' },
    });

    // Add tachypneic RR
    repo.addEvent({
      id: 'ev-rr-acute',
      patientId,
      timestamp: now - 15 * 60 * 1000,
      eventType: 'VITAL_MEASUREMENT',
      title: 'Tachypnea Surge',
      description: 'RR 28 /min',
      source: 'OPTICAL_RPPG',
      isTrusted: true,
      severity: 'WARNING',
      data: { vitalType: 'RESPIRATORY_RATE', value: 28, unit: 'BREATHS_PER_MINUTE' },
    });

    // Add MEWS jump
    repo.addEvent({
      id: 'ev-mews-escalate',
      patientId,
      timestamp: now - 10 * 60 * 1000,
      eventType: 'MEWS_CHANGE',
      title: 'MEWS Escalation to 5 (RED)',
      description: 'Triggered emergency outreach',
      source: 'CLINICAL_ENGINE',
      isTrusted: true,
      severity: 'CRITICAL',
      data: { previousScore: 1, currentScore: 5, triageLevel: 'RED' },
    });

    // Add APS score jump
    repo.addEvent({
      id: 'ev-aps-jump',
      patientId,
      timestamp: now,
      eventType: 'APS_CHANGE',
      title: 'APS Jump to 78 (CRITICAL_REVIEW)',
      description: 'Acute decompensation alert',
      source: 'CLINICAL_ENGINE',
      isTrusted: true,
      severity: 'CRITICAL',
      data: { previousScore: 25, currentScore: 78, previousCategory: 'LOW', currentCategory: 'CRITICAL_REVIEW' },
    });

    const attribution = repo.getPriorityRiseAttribution(patientId, 4, now);

    expect(attribution.scoreDelta).toBe(53); // 78 - 25
    expect(attribution.currentCategory).toBe('CRITICAL_REVIEW');
    expect(attribution.contributingFactors.length).toBeGreaterThan(0);
    expect(attribution.primaryDriver).toContain('Respiratory rate increased');
    expect(attribution.triggerEvents.length).toBeGreaterThan(0);
  });

  it('answers "When was the patient last manually assessed?" detecting recent bedside nurse check', () => {
    repo.clear(patientId);

    const fortyFiveMinutesAgo = now - 45 * 60 * 1000;

    repo.addEvent({
      id: 'ev-bedside-vitals',
      patientId,
      timestamp: fortyFiveMinutesAgo,
      eventType: 'MANUAL_OBSERVATION',
      title: 'Manual Bedside Vitals Check',
      description: 'Manual cuff BP 124/80, AVPU Alert, bilateral lung sounds clear.',
      source: 'MANUAL_ENTRY',
      isTrusted: true,
      severity: 'INFO',
      actorUserId: 'nurse-sarah-12',
      actorRole: 'WARD_NURSE',
    });

    const res = repo.getLastManualAssessment(patientId, now);

    expect(res.lastAssessedTimestamp).toBe(fortyFiveMinutesAgo);
    expect(res.elapsedMinutes).toBe(45);
    expect(res.elapsedHuman).toBe('45m ago');
    expect(res.assessedBy).toBe('nurse-sarah-12');
    expect(res.assessorRole).toBe('WARD_NURSE');
    expect(res.assessmentType).toBe('MANUAL_OBSERVATION');
    expect(res.findings).toContain('Manual cuff BP 124/80');
    expect(res.isOverdue).toBe(false);
  });

  it('answers "When was the patient last manually assessed?" with overdue flag when > 4 hours', () => {
    repo.clear(patientId);

    const fiveHoursAgo = now - 5 * 60 * 60 * 1000;

    repo.addEvent({
      id: 'ev-old-visit',
      patientId,
      timestamp: fiveHoursAgo,
      eventType: 'NURSE_VISIT',
      title: 'Morning Routine Round',
      description: 'Patient resting comfortably.',
      source: 'MANUAL_ENTRY',
      isTrusted: true,
      severity: 'INFO',
      actorUserId: 'nurse-john-04',
      actorRole: 'WARD_NURSE',
    });

    const res = repo.getLastManualAssessment(patientId, now);

    expect(res.elapsedMinutes).toBe(300); // 5 hours = 300 min
    expect(res.elapsedHuman).toBe('5h 0m ago');
    expect(res.isOverdue).toBe(true);
    expect(res.assessmentType).toBe('NURSE_VISIT');
  });

  it('answers "Which measurements were trusted?" segregating valid vs suppressed readings', () => {
    repo.clear(patientId);

    // 3 trusted measurements
    for (let i = 1; i <= 3; i++) {
      repo.addEvent({
        id: `ev-trusted-${i}`,
        patientId,
        timestamp: now - i * 10000,
        eventType: 'VITAL_MEASUREMENT',
        title: 'Trusted HR',
        description: 'Quality valid',
        source: 'OPTICAL_RPPG',
        isTrusted: true,
        severity: 'INFO',
        data: { vitalType: 'HEART_RATE', value: 75, confidence: 0.92, qualityStatus: 'VALID' },
      });
    }

    // 1 untrusted measurement (motion artifact)
    repo.addEvent({
      id: 'ev-untrusted-1',
      patientId,
      timestamp: now - 5000,
      eventType: 'VITAL_MEASUREMENT',
      title: 'Suppressed HR',
      description: 'Optical SQI 0.35 below threshold due to patient movement',
      source: 'OPTICAL_RPPG',
      isTrusted: false,
      severity: 'WARNING',
      data: {
        vitalType: 'HEART_RATE',
        value: 110,
        confidence: 0.35,
        qualityStatus: 'DEGRADED',
        untrustedReason: 'Motion artifact detected',
      },
    });

    const res = repo.getTrustedMeasurements(patientId);

    expect(res.totalMeasurements).toBe(4);
    expect(res.trustedCount).toBe(3);
    expect(res.untrustedCount).toBe(1);
    expect(res.trustPercentage).toBe(75.0);
    expect(res.trustedMeasurements).toHaveLength(3);
    expect(res.untrustedMeasurements).toHaveLength(1);
    expect(res.untrustedMeasurements[0].untrustedReason).toBe('Motion artifact detected');
    expect(res.commonSuppressionReasons).toEqual([
      { reason: 'Motion artifact detected', count: 1 },
    ]);
  });
});
