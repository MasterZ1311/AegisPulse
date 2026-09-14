/**
 * @aegispulse/research - rPPG Algorithm Benchmark Suite
 * Evaluates GREEN, CHROM, and POS algorithms across standardized windows and condition partitions.
 */

import type { RppgAlgorithmType } from '../rppg/src/types';
import { RppgPipeline } from '../rppg/src/pipeline/rppg-pipeline';
import type { StandardizedRppgWindow } from '../datasets/preprocessing/rppg-adapter';
import type { StatisticalMetricsResult, MetricSamplePair } from './metrics';
import { evaluateStatisticalMetrics } from './metrics';
import type { CalibrationResult } from './calibration';
import { evaluateConfidenceCalibration } from './calibration';

export interface AlgorithmEvaluationReport {
  algorithm: RppgAlgorithmType;
  datasetSlug: string;
  totalWindows: number;
  metrics: StatisticalMetricsResult;
  calibration: CalibrationResult;
  throughputFps: number;
  executionDurationMs: number;
}

export interface PartitionBenchmarkReport {
  partitionKey: string;
  partitionValue: string;
  reports: Record<RppgAlgorithmType, AlgorithmEvaluationReport>;
}

export class RppgBenchmarkRunner {
  private readonly pipeline: RppgPipeline;

  constructor(pipeline = new RppgPipeline()) {
    this.pipeline = pipeline;
  }

  /**
   * Benchmarks a single algorithm across an array of standardized windows
   */
  public benchmarkAlgorithm(
    algorithm: RppgAlgorithmType,
    windows: StandardizedRppgWindow[],
    datasetSlug = 'benchmark-suite'
  ): AlgorithmEvaluationReport {
    const pairs: MetricSamplePair[] = [];
    const startTime = performance.now();
    let totalFrames = 0;

    for (const win of windows) {
      totalFrames += win.series.r.length;

      // Estimate motion magnitude from window attributes
      let motionMag = 0.05;
      if (win.attributes.motionLevel === 'CONVERSATIONAL') motionMag = 0.20;
      if (win.attributes.motionLevel === 'HEAD_ROTATION') motionMag = 0.35;
      if (win.attributes.motionLevel === 'UNCONSTRAINED') motionMag = 0.55;

      const measurement = this.pipeline.processRgbSeries(win.series, algorithm, motionMag);

      pairs.push({
        estimated: measurement.heartRate,
        groundTruth: win.groundTruth.meanHeartRateBpm,
        confidence: measurement.confidence,
        isGatedOrUnusable: measurement.status === 'UNUSABLE',
      });
    }

    const durationMs = performance.now() - startTime;
    const throughputFps = durationMs > 0 ? Math.round((totalFrames / durationMs) * 1000) : 0;

    const metrics = evaluateStatisticalMetrics(pairs, 20.0);
    const calibration = evaluateConfidenceCalibration(pairs, { numBins: 5, clinicalToleranceBpm: 3.0 });

    return {
      algorithm,
      datasetSlug,
      totalWindows: windows.length,
      metrics,
      calibration,
      throughputFps,
      executionDurationMs: Math.round(durationMs),
    };
  }

  /**
   * Compares all three algorithms (GREEN, CHROM, POS) across the given dataset windows
   */
  public compareAll(
    windows: StandardizedRppgWindow[],
    datasetSlug = 'benchmark-suite'
  ): Record<RppgAlgorithmType, AlgorithmEvaluationReport> {
    return {
      GREEN: this.benchmarkAlgorithm('GREEN', windows, datasetSlug),
      CHROM: this.benchmarkAlgorithm('CHROM', windows, datasetSlug),
      POS: this.benchmarkAlgorithm('POS', windows, datasetSlug),
    };
  }

  /**
   * Partitions windows by an attribute (e.g. motionLevel) and runs comparative benchmarks
   */
  public benchmarkByMotionPartition(
    windows: StandardizedRppgWindow[]
  ): PartitionBenchmarkReport[] {
    const partitions: Record<string, StandardizedRppgWindow[]> = {};

    for (const win of windows) {
      const key = win.attributes.motionLevel;
      if (!partitions[key]) partitions[key] = [];
      partitions[key].push(win);
    }

    const results: PartitionBenchmarkReport[] = [];
    for (const [level, partitionWindows] of Object.entries(partitions)) {
      results.push({
        partitionKey: 'motionLevel',
        partitionValue: level,
        reports: this.compareAll(partitionWindows, `partition-${level}`),
      });
    }

    return results;
  }
}
