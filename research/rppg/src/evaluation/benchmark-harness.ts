/**
 * @aegispulse/rppg - Benchmark Evaluation Harness
 * Comparative statistical evaluation tooling for GREEN, CHROM, and POS algorithms.
 */

import type {
  RppgAlgorithmType,
  RgbTimeSeries,
  AlgorithmBenchmarkReport,
  DatasetEvaluationSample,
} from '../types';
import { RppgPipeline } from '../pipeline/rppg-pipeline';

export interface BenchmarkDatasetItem {
  id: string;
  series: RgbTimeSeries;
  groundTruthHeartRate: number;
  groundTruthRespRate?: number;
  motionIntensity?: number;
}

export class BenchmarkHarness {
  private readonly pipeline: RppgPipeline;

  constructor(pipeline = new RppgPipeline()) {
    this.pipeline = pipeline;
  }

  /**
   * Benchmarks a specific algorithm across a dataset
   */
  public evaluateAlgorithm(
    algorithm: RppgAlgorithmType,
    dataset: BenchmarkDatasetItem[],
    datasetName = 'Benchmark-Suite'
  ): AlgorithmBenchmarkReport {
    const samples: DatasetEvaluationSample[] = [];
    const startTime = performance.now();
    let totalFramesProcessed = 0;

    for (const item of dataset) {
      totalFramesProcessed += item.series.r.length;

      const measurement = this.pipeline.processRgbSeries(
        item.series,
        algorithm,
        item.motionIntensity || 0.05
      );

      const absErrHr = Math.abs(measurement.heartRate - item.groundTruthHeartRate);
      const absErrRr =
        measurement.respiratoryRate && item.groundTruthRespRate
          ? Math.abs(measurement.respiratoryRate - item.groundTruthRespRate)
          : undefined;

      samples.push({
        sampleId: item.id,
        groundTruthHeartRate: item.groundTruthHeartRate,
        groundTruthRespRate: item.groundTruthRespRate,
        estimatedMeasurement: measurement,
        absoluteErrorHr: absErrHr,
        absoluteErrorRr: absErrRr,
      });
    }

    const totalDurationMs = performance.now() - startTime;
    const fpsThroughput = totalDurationMs > 0 ? (totalFramesProcessed / totalDurationMs) * 1000 : 0;

    // Filter valid samples where signal was not gated/unusable
    const validSamples = samples.filter((s) => s.estimatedMeasurement.status !== 'UNUSABLE');
    const validCount = validSamples.length;
    const yieldPercentage = samples.length > 0 ? Math.round((validCount / samples.length) * 1000) / 10 : 0;

    // Mean Absolute Error (MAE)
    const maeBpm =
      validCount > 0
        ? validSamples.reduce((sum, s) => sum + s.absoluteErrorHr, 0) / validCount
        : 99.9;

    // Root Mean Square Error (RMSE)
    const rmseBpm =
      validCount > 0
        ? Math.sqrt(
            validSamples.reduce((sum, s) => sum + s.absoluteErrorHr ** 2, 0) / validCount
          )
        : 99.9;

    // Pearson Correlation (r)
    let pearsonR = 0;
    if (validCount > 1) {
      const x = validSamples.map((s) => s.groundTruthHeartRate);
      const y = validSamples.map((s) => s.estimatedMeasurement.heartRate);
      pearsonR = this.calculatePearsonCorrelation(x, y);
    }

    // Mean SNR & Confidence
    const meanSnr =
      samples.reduce((sum, s) => sum + s.estimatedMeasurement.signalQuality.snrDb, 0) /
      Math.max(1, samples.length);
    const meanConf =
      samples.reduce((sum, s) => sum + s.estimatedMeasurement.confidence, 0) /
      Math.max(1, samples.length);

    return {
      algorithm,
      datasetName,
      totalSamples: samples.length,
      validSamplesCount: validCount,
      yieldPercentage,
      meanAbsoluteErrorBpm: Math.round(maeBpm * 100) / 100,
      rootMeanSquareErrorBpm: Math.round(rmseBpm * 100) / 100,
      pearsonCorrelation: Math.round(pearsonR * 1000) / 1000,
      meanSnrDb: Math.round(meanSnr * 10) / 10,
      meanConfidence: Math.round(meanConf * 100) / 100,
      processingTimeMsTotal: Math.round(totalDurationMs),
      fpsThroughput: Math.round(fpsThroughput),
      disclaimer:
        'Benchmark results derived on investigational rPPG research dataset. Not intended as medical claims without formal clinical cohort trial.',
    };
  }

  /**
   * Compares all three algorithms (GREEN, CHROM, POS) across the same benchmark dataset
   */
  public compareAllAlgorithms(
    dataset: BenchmarkDatasetItem[],
    datasetName = 'Comparative-Benchmark'
  ): Record<RppgAlgorithmType, AlgorithmBenchmarkReport> {
    return {
      GREEN: this.evaluateAlgorithm('GREEN', dataset, datasetName),
      CHROM: this.evaluateAlgorithm('CHROM', dataset, datasetName),
      POS: this.evaluateAlgorithm('POS', dataset, datasetName),
    };
  }

  private calculatePearsonCorrelation(x: number[], y: number[]): number {
    const n = x.length;
    if (n <= 1) return 0;

    const meanX = x.reduce((a, b) => a + b, 0) / n;
    const meanY = y.reduce((a, b) => a + b, 0) / n;

    let num = 0;
    let denX = 0;
    let denY = 0;

    for (let i = 0; i < n; i++) {
      const dx = x[i] - meanX;
      const dy = y[i] - meanY;
      num += dx * dy;
      denX += dx * dx;
      denY += dy * dy;
    }

    const denom = Math.sqrt(denX * denY);
    if (denom === 0 || !isFinite(denom)) return 0;
    return num / denom;
  }
}
