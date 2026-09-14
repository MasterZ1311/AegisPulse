/**
 * @aegispulse/research - Reproducible rPPG Preprocessing Adapter
 * Standardizes rPPG datasets into uniform analysis windows with ground-truth synchronization.
 * ENFORCES PRIVACY INVARIANT: Rejects and deallocates raw video pixel matrices.
 */

import type { RgbTimeSeries } from '../../rppg/src/types';

export interface StandardizedRppgWindow {
  windowId: string;
  datasetSlug: string;
  subjectId: string;
  scenarioName: string;
  startTimeMs: number;
  endTimeMs: number;
  durationSeconds: number;
  fps: number;
  series: RgbTimeSeries;
  groundTruth: {
    meanHeartRateBpm: number;
    instantaneousHrBpm?: number[];
    meanRespiratoryRateBpm?: number;
    bvpWaveform?: number[];
    samplingRateHz: number;
  };
  attributes: {
    motionLevel: 'STATIONARY' | 'CONVERSATIONAL' | 'HEAD_ROTATION' | 'UNCONSTRAINED';
    lightingLevel: 'OPTIMAL_STUDIO' | 'DIM_NATURAL' | 'FLUORESCENT' | 'EXTREME_GLARE';
    fitzpatrickType?: 'I' | 'II' | 'III' | 'IV' | 'V' | 'VI';
  };
}

export interface RawRppgRecordingInput {
  datasetSlug: string;
  subjectId: string;
  scenarioName: string;
  fps: number;
  timestampsMs: number[];
  meanR: number[];
  meanG: number[];
  meanB: number[];
  /** Ground truth pulse timeseries */
  gtTimestampsMs: number[];
  gtHeartRateBpm: number[];
  gtRespRateBpm?: number[];
  gtBvpWaveform?: number[];
  gtSamplingRateHz: number;
  attributes: StandardizedRppgWindow['attributes'];
}

export class RppgDatasetAdapter {
  /**
   * Preprocesses a raw rPPG recording into uniform, overlapping temporal windows
   */
  public static preprocessRecording(
    input: RawRppgRecordingInput,
    windowSeconds = 12.0,
    strideSeconds = 2.0
  ): StandardizedRppgWindow[] {
    // 1. Enforce Zero Video Storage Invariant
    if ((input as any).videoFrames || (input as any).rawPixels || (input as any).videoBuffer) {
      throw new Error(
        'PRIVACY VIOLATION: Raw video frames detected in rPPG preprocessing input. Video buffers must be discarded at camera edge.'
      );
    }

    const { fps, timestampsMs, meanR, meanG, meanB } = input;
    const totalFrames = Math.min(timestampsMs.length, meanR.length, meanG.length, meanB.length);
    const windowFrames = Math.floor(fps * windowSeconds);
    const strideFrames = Math.floor(fps * strideSeconds);

    if (totalFrames < windowFrames) {
      return [];
    }

    const windows: StandardizedRppgWindow[] = [];
    let winIndex = 0;

    for (let start = 0; start <= totalFrames - windowFrames; start += strideFrames) {
      const end = start + windowFrames;
      const winTimestamps = timestampsMs.slice(start, end);
      const winR = meanR.slice(start, end);
      const winG = meanG.slice(start, end);
      const winB = meanB.slice(start, end);

      const startTimeMs = winTimestamps[0];
      const endTimeMs = winTimestamps[winTimestamps.length - 1];

      // Synchronize ground truth HR within window bounds
      const matchingGtHr: number[] = [];
      for (let i = 0; i < input.gtTimestampsMs.length; i++) {
        const t = input.gtTimestampsMs[i];
        if (t >= startTimeMs && t <= endTimeMs) {
          matchingGtHr.push(input.gtHeartRateBpm[i]);
        }
      }

      const meanGtHr =
        matchingGtHr.length > 0
          ? matchingGtHr.reduce((a, b) => a + b, 0) / matchingGtHr.length
          : input.gtHeartRateBpm[0] || 72;

      // Optional ground truth RR
      let meanGtRr: number | undefined;
      if (input.gtRespRateBpm && input.gtRespRateBpm.length > 0) {
        const matchingGtRr: number[] = [];
        for (let i = 0; i < input.gtTimestampsMs.length; i++) {
          const t = input.gtTimestampsMs[i];
          if (t >= startTimeMs && t <= endTimeMs && input.gtRespRateBpm[i] !== undefined) {
            matchingGtRr.push(input.gtRespRateBpm[i]);
          }
        }
        if (matchingGtRr.length > 0) {
          meanGtRr = matchingGtRr.reduce((a, b) => a + b, 0) / matchingGtRr.length;
        }
      }

      windows.push({
        windowId: `${input.datasetSlug}-${input.subjectId}-win${winIndex++}`,
        datasetSlug: input.datasetSlug,
        subjectId: input.subjectId,
        scenarioName: input.scenarioName,
        startTimeMs,
        endTimeMs,
        durationSeconds: windowSeconds,
        fps,
        series: {
          fps,
          timestampsMs: winTimestamps,
          r: winR,
          g: winG,
          b: winB,
        },
        groundTruth: {
          meanHeartRateBpm: Math.round(meanGtHr * 10) / 10,
          instantaneousHrBpm: matchingGtHr,
          meanRespiratoryRateBpm: meanGtRr ? Math.round(meanGtRr * 10) / 10 : undefined,
          samplingRateHz: input.gtSamplingRateHz,
        },
        attributes: input.attributes,
      });
    }

    return windows;
  }
}
