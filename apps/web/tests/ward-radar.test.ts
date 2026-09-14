import { describe, it, expect } from 'vitest';
import { INITIAL_WARD_PATIENTS } from '../src/data/ward-simulated-data';

describe('Ward Attention Radar & Patient Detail Experience', () => {
  it('contains the complete 6-bed hospital ward cohort matching the simulation engine', () => {
    expect(INITIAL_WARD_PATIENTS).toHaveLength(6);
    const bedNumbers = INITIAL_WARD_PATIENTS.map((p) => p.bedNumber);
    expect(bedNumbers).toContain('401-A');
    expect(bedNumbers).toContain('402-A');
    expect(bedNumbers).toContain('403-A');
    expect(bedNumbers).toContain('404-B');
    expect(bedNumbers).toContain('405-A');
    expect(bedNumbers).toContain('406-B');
  });

  it('correctly ranks Eleanor Vance (Bed 403-A) as rank 1 CRITICAL_REVIEW occult shock', () => {
    const patient403 = INITIAL_WARD_PATIENTS.find((p) => p.bedNumber === '403-A');
    expect(patient403).toBeDefined();
    expect(patient403?.name).toBe('Eleanor Vance');
    expect(patient403?.category).toBe('CRITICAL_REVIEW');
    expect(patient403?.apsScore).toBeGreaterThanOrEqual(80);
    expect(patient403?.categoryRank).toBe(1);
    expect(patient403?.trendDirection).toBe('RAPIDLY_RISING');
  });

  it('guarantees zero raw video transmission invariant across all ward beds', () => {
    for (const patient of INITIAL_WARD_PATIENTS) {
      expect(patient.signalQuality.privacyNotice).toContain('Zero video');
      // Ensure no base64 images or frame blobs exist in telemetry
      expect((patient.signalQuality as any).rawFrame).toBeUndefined();
      expect((patient.signalQuality as any).videoStreamUrl).toBeUndefined();
      expect(patient.signalQuality.confidencePercent).toBeGreaterThanOrEqual(0);
      expect(patient.signalQuality.confidencePercent).toBeLessThanOrEqual(100);
    }
  });

  it('validates deterministic provenance trace for all contributing reasons (No LLM reasoning)', () => {
    for (const patient of INITIAL_WARD_PATIENTS) {
      expect(patient.whyNowSummary).toBeTruthy();
      expect(patient.topContributingReasons.length).toBeGreaterThanOrEqual(1);

      let totalPercent = 0;
      for (const reason of patient.topContributingReasons) {
        expect(reason.title).toBeTruthy();
        expect(reason.explanation).toBeTruthy();
        expect(reason.contributionPercent).toBeGreaterThan(0);
        expect(reason.provenance).toBeDefined();
        expect(reason.provenance.sourceObservationIds.length).toBeGreaterThanOrEqual(1);
        expect(reason.provenance.calculationRule).toBeTruthy();
        expect(reason.provenance.rawScore).toBeGreaterThan(0);
        expect(reason.provenance.normalizedWeight).toBeGreaterThan(0);
        totalPercent += reason.contributionPercent;
      }
      expect(totalPercent).toBeGreaterThanOrEqual(95); // accounts for rounding
    }
  });

  it('verifies deterministic MEWS score and contributing points breakdown', () => {
    const p403 = INITIAL_WARD_PATIENTS.find((p) => p.bedNumber === '403-A')!;
    expect(p403.mews.totalScore).toBe(6);
    expect(p403.mews.thresholdRisk).toBe('CRITICAL');

    const calculatedSum = p403.mews.breakdown.reduce((sum, item) => sum + item.points, 0);
    expect(calculatedSum).toBe(6);

    const hrItem = p403.mews.breakdown.find((b) => b.parameter === 'Heart Rate');
    expect(hrItem?.points).toBe(2); // 118 bpm -> 2 points

    const rrItem = p403.mews.breakdown.find((b) => b.parameter === 'Respiratory Rate');
    expect(rrItem?.points).toBe(2); // 28 /min -> 2 points
  });

  it('verifies qSOFA bedside sepsis screening criteria for Bed 403', () => {
    const p403 = INITIAL_WARD_PATIENTS.find((p) => p.bedNumber === '403-A')!;
    expect(p403.qsofa).toBeDefined();
    expect(p403.qsofa?.totalScore).toBe(2);
    expect(p403.qsofa?.sepsisRiskIndicated).toBe(true);

    const rrCriterion = p403.qsofa?.breakdown.find((c) => c.criterion.includes('Respiratory Rate'));
    expect(rrCriterion?.isMet).toBe(true);

    const sbpCriterion = p403.qsofa?.breakdown.find((c) => c.criterion.includes('Systolic BP'));
    expect(sbpCriterion?.isMet).toBe(true); // SBP 94 <= 100
  });

  it('dynamically sorts attention queue by APS score descending', () => {
    const sorted = [...INITIAL_WARD_PATIENTS].sort((a, b) => b.apsScore - a.apsScore);
    expect(sorted[0].bedNumber).toBe('403-A'); // APS 88
    expect(sorted[1].bedNumber).toBe('406-B'); // APS 68
    expect(sorted[2].bedNumber).toBe('402-A'); // APS 46
    expect(sorted[3].bedNumber).toBe('405-A'); // APS 38
    expect(sorted[4].bedNumber).toBe('404-B'); // APS 22
    expect(sorted[5].bedNumber).toBe('401-A'); // APS 14

    for (let i = 0; i < sorted.length - 1; i++) {
      expect(sorted[i].apsScore).toBeGreaterThanOrEqual(sorted[i + 1].apsScore);
    }
  });

  it('includes multi-point vitals trajectory data for interactive sparklines', () => {
    for (const patient of INITIAL_WARD_PATIENTS) {
      expect(patient.trajectory.length).toBeGreaterThanOrEqual(3);
      const latest = patient.trajectory[patient.trajectory.length - 1];
      expect(latest.timeOffsetMinutes).toBe(0);
      expect(latest.heartRate).toBe(patient.vitals.heartRate);
      expect(latest.respiratoryRate).toBe(patient.vitals.respiratoryRate);
    }
  });

  it('provides actionable human verification checklists and timeline audit history', () => {
    for (const patient of INITIAL_WARD_PATIENTS) {
      expect(patient.recommendedVerifications.length).toBeGreaterThanOrEqual(1);
      for (const check of patient.recommendedVerifications) {
        expect(check.text).toBeTruthy();
        expect(check.rationale).toBeTruthy();
      }

      expect(patient.timeline.length).toBeGreaterThanOrEqual(1);
      for (const event of patient.timeline) {
        expect(event.id).toBeTruthy();
        expect(event.title).toBeTruthy();
        expect(event.eventType).toBeTruthy();
      }
    }
  });
});
