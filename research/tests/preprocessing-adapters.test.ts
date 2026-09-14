import { describe, it, expect } from 'vitest';
import { RppgDatasetAdapter } from '../datasets/preprocessing/rppg-adapter';
import { WaveformDatasetAdapter } from '../datasets/preprocessing/waveform-adapter';
import { ClinicalDeteriorationAdapter } from '../datasets/preprocessing/clinical-adapter';
import {
  createUbfcFixture,
  createPureMotionFixture,
  createBidmcWaveformFixture,
  createMimicDeteriorationFixture,
} from '../datasets/preprocessing/fixtures/dataset-fixtures';

describe('Reproducible Dataset Preprocessing Adapters', () => {
  it('preprocesses rPPG fixture into uniform overlapping windows with synchronized ground truth', () => {
    const fixture = createUbfcFixture(24, 72);
    const windows = RppgDatasetAdapter.preprocessRecording(fixture, 12.0, 2.0);

    expect(windows.length).toBeGreaterThan(0);

    const first = windows[0];
    expect(first.datasetSlug).toBe('ubfc-rppg');
    expect(first.durationSeconds).toBe(12.0);
    expect(first.groundTruth.meanHeartRateBpm).toBeGreaterThan(65);
    expect(first.groundTruth.meanHeartRateBpm).toBeLessThan(90);
  });

  it('strictly enforces the Zero Video Storage Invariant during rPPG preprocessing', () => {
    const fixture = createUbfcFixture(15, 75);
    // Artificially inject forbidden video frames
    (fixture as any).videoFrames = ['frame1_binary_buffer', 'frame2_binary_buffer'];

    expect(() => {
      RppgDatasetAdapter.preprocessRecording(fixture);
    }).toThrow(/PRIVACY VIOLATION/);
  });

  it('preprocesses continuous physiological waveforms into standardized segments with reference breaths (BIDMC)', () => {
    const fixture = createBidmcWaveformFixture(60, 75, 15);
    const segments = WaveformDatasetAdapter.preprocessWaveform(fixture, 30.0, 10.0);

    expect(segments.length).toBeGreaterThanOrEqual(1);

    const first = segments[0];
    expect(first.datasetSlug).toBe('bidmc-ppg-rr');
    expect(first.samplingRateHz).toBe(125);
    expect(first.durationSeconds).toBe(30.0);
    expect(first.ppgSignal.length).toBe(30 * 125);
    expect(first.groundTruth.referenceHeartRateBpm).toBeGreaterThan(60);
    expect(first.groundTruth.referenceRespiratoryRateBpm).toBe(15);
  });

  it('preprocesses longitudinal hospital EHR patient records into structured clinical deterioration cases (MIMIC-IV)', () => {
    const fixture = createMimicDeteriorationFixture();
    const standardized = ClinicalDeteriorationAdapter.preprocessPatientCase(fixture);

    expect(standardized.caseId).toContain('mimic-iv');
    expect(standardized.observationsChronological.length).toBe(4);
    expect(standardized.groundTruthOutcomes.deteriorationOccurred).toBe(true);
    expect(standardized.groundTruthOutcomes.deteriorationType).toBe('SEPTIC_SHOCK');

    // MEWS and qSOFA baseline calculations
    expect(standardized.baselineScores.initialMews).toBeDefined();
    expect(standardized.baselineScores.peakMews).toBeGreaterThan(standardized.baselineScores.initialMews);
  });
});
