/**
 * @aegispulse/research - Physiological Waveform Preprocessing Adapter
 * Standardizes continuous multi-parameter physiological waveform recordings (PPG, ECG, Respiration).
 */

export interface StandardizedWaveformSegment {
  segmentId: string;
  datasetSlug: string;
  patientId: string;
  samplingRateHz: number;
  durationSeconds: number;
  ppgSignal: number[];
  ecgSignal?: number[];
  respirationSignal?: number[];
  groundTruth: {
    referenceHeartRateBpm: number;
    referenceRespiratoryRateBpm?: number;
    annotatedBreathCount?: number;
  };
}

export interface RawWaveformInput {
  datasetSlug: string;
  patientId: string;
  samplingRateHz: number;
  ppg: number[];
  ecg?: number[];
  respiration?: number[];
  annotatedBreathsTimestampsSec?: number[];
}

export class WaveformDatasetAdapter {
  /**
   * Slices and normalizes raw continuous waveform records into uniform benchmark segments
   */
  public static preprocessWaveform(
    input: RawWaveformInput,
    segmentDurationSeconds = 30.0,
    strideSeconds = 10.0
  ): StandardizedWaveformSegment[] {
    const { samplingRateHz, ppg, ecg, respiration, annotatedBreathsTimestampsSec = [] } = input;
    const samplesPerSegment = Math.floor(samplingRateHz * segmentDurationSeconds);
    const strideSamples = Math.floor(samplingRateHz * strideSeconds);

    if (ppg.length < samplesPerSegment) {
      return [];
    }

    const segments: StandardizedWaveformSegment[] = [];
    let segIdx = 0;

    for (let start = 0; start <= ppg.length - samplesPerSegment; start += strideSamples) {
      const end = start + samplesPerSegment;
      const ppgSlice = ppg.slice(start, end);
      const ecgSlice = ecg ? ecg.slice(start, end) : undefined;
      const respSlice = respiration ? respiration.slice(start, end) : undefined;

      const segStartSec = start / samplingRateHz;
      const segEndSec = end / samplingRateHz;

      // Count annotated breaths falling within segment
      const breathsInSegment = annotatedBreathsTimestampsSec.filter(
        (t) => t >= segStartSec && t <= segEndSec
      );

      // Estimate reference RR from inter-breath intervals
      let refRrBpm: number | undefined;
      if (breathsInSegment.length >= 2) {
        const intervalSec =
          (breathsInSegment[breathsInSegment.length - 1] - breathsInSegment[0]) /
          (breathsInSegment.length - 1);
        refRrBpm = intervalSec > 0 ? Math.round((60 / intervalSec) * 10) / 10 : undefined;
      }

      // Simple beat peak detection for reference HR
      const refHrBpm = this.estimatePulseRateFromPeaks(ppgSlice, samplingRateHz);

      segments.push({
        segmentId: `${input.datasetSlug}-${input.patientId}-seg${segIdx++}`,
        datasetSlug: input.datasetSlug,
        patientId: input.patientId,
        samplingRateHz,
        durationSeconds: segmentDurationSeconds,
        ppgSignal: ppgSlice,
        ecgSignal: ecgSlice,
        respirationSignal: respSlice,
        groundTruth: {
          referenceHeartRateBpm: refHrBpm,
          referenceRespiratoryRateBpm: refRrBpm,
          annotatedBreathCount: breathsInSegment.length,
        },
      });
    }

    return segments;
  }

  private static estimatePulseRateFromPeaks(signal: number[], fs: number): number {
    // Basic peak interval detector
    const minDistanceSamples = Math.floor(fs * 0.4); // Max 150 bpm
    let peakCount = 0;

    for (let i = 1; i < signal.length - 1; i++) {
      if (signal[i] > signal[i - 1] && signal[i] > signal[i + 1]) {
        peakCount++;
        i += minDistanceSamples;
      }
    }

    const durationMinutes = signal.length / (fs * 60);
    return durationMinutes > 0 ? Math.round((peakCount / durationMinutes) * 10) / 10 : 72;
  }
}
