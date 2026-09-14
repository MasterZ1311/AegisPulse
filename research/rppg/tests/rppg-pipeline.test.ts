import { describe, it, expect } from 'vitest';
import { RppgPipeline } from '../src/pipeline/rppg-pipeline';
import { generateSyntheticRgbSeries } from '../src/evaluation/synthetic-dataset';

describe('12-Stage Contactless Sensing rPPG Pipeline', () => {
  const pipeline = new RppgPipeline();

  it('produces valid SignalMeasurement conforming to contract specification', () => {
    const { series, groundTruthHr, groundTruthRr } = generateSyntheticRgbSeries({
      fps: 30,
      durationSeconds: 15,
      targetHeartRateBpm: 72,
      targetRespRateBpm: 16,
      motionIntensity: 0.0,
      snrAdditiveNoise: 0.01,
    });

    const measurement = pipeline.processRgbSeries(series, 'POS', 0.02, 0.95);

    // Conformance with user specification interface:
    expect(measurement).toHaveProperty('heartRate');
    expect(measurement).toHaveProperty('respiratoryRate');
    expect(measurement).toHaveProperty('signalQuality');
    expect(measurement).toHaveProperty('confidence');
    expect(measurement).toHaveProperty('status');
    expect(measurement).toHaveProperty('timestamp');
    expect(measurement).toHaveProperty('source');
    expect(measurement).toHaveProperty('algorithm');

    expect(measurement.source).toBe('OPTICAL_RPPG');
    expect(measurement.algorithm).toBe('POS');
    expect(measurement.status).toBe('VALID');
    expect(measurement.confidence).toBeGreaterThanOrEqual(0.7);
    expect(measurement.confidence).toBeLessThanOrEqual(1.0);

    // Heart rate accuracy
    expect(Math.abs(measurement.heartRate - groundTruthHr)).toBeLessThanOrEqual(2.0);

    // Respiratory rate accuracy (where defensible)
    expect(measurement.respiratoryRate).toBeDefined();
    expect(Math.abs(measurement.respiratoryRate! - groundTruthRr!)).toBeLessThanOrEqual(3.0);
  });

  it('degrades and suppresses signal status under heavy motion perturbation', () => {
    const { series } = generateSyntheticRgbSeries({
      fps: 30,
      durationSeconds: 10,
      targetHeartRateBpm: 80,
      motionIntensity: 0.8, // Heavy motion
      snrAdditiveNoise: 0.15,
    });

    // High motion magnitude passed into pipeline
    const measurement = pipeline.processRgbSeries(series, 'POS', 0.75, 0.9);

    expect(measurement.status).toBe('UNUSABLE');
    expect(measurement.signalQuality.motionDetected).toBe(true);
    expect(measurement.confidence).toBeLessThanOrEqual(0.3);
    // Vitals withheld when status is UNUSABLE
    expect(measurement.heartRate).toBe(0);
    expect(measurement.respiratoryRate).toBeUndefined();
  });

  it('guarantees zero patient video or image frames are stored in pipeline metadata', () => {
    const { series } = generateSyntheticRgbSeries({
      fps: 30,
      durationSeconds: 6,
      targetHeartRateBpm: 68,
    });

    const measurement = pipeline.processRgbSeries(series, 'CHROM');

    // Verify no raw frame buffers, base64 strings, or video URLs exist
    expect((measurement as any).rawVideo).toBeUndefined();
    expect((measurement as any).frameBuffer).toBeUndefined();
    expect((measurement as any).videoUrl).toBeUndefined();
    expect(measurement.metadata?.disclaimer).toContain('Investigational');
  });

  it('aggregates ROI frame series without retaining pixel matrices', () => {
    const rois = [
      { frameIndex: 0, timestampMs: 0, boundingBox: [0.2, 0.2, 0.4, 0.4] as [number, number, number, number], meanR: 180, meanG: 140, meanB: 110, pixelCount: 5000, skinFraction: 0.85 },
      { frameIndex: 1, timestampMs: 33, boundingBox: [0.2, 0.2, 0.4, 0.4] as [number, number, number, number], meanR: 181, meanG: 139, meanB: 109, pixelCount: 5000, skinFraction: 0.85 },
      { frameIndex: 2, timestampMs: 66, boundingBox: [0.2, 0.2, 0.4, 0.4] as [number, number, number, number], meanR: 179, meanG: 141, meanB: 111, pixelCount: 5000, skinFraction: 0.85 },
    ];

    const series = pipeline.aggregateFrameRois(rois, 30);
    expect(series.timestampsMs).toHaveLength(3);
    expect(series.r).toEqual([180, 181, 179]);
    expect(series.g).toEqual([140, 139, 141]);
    expect(series.b).toEqual([110, 109, 111]);
    // Ensure raw pixel buffers do not exist in aggregated series
    expect((series as any).pixels).toBeUndefined();
  });
});
