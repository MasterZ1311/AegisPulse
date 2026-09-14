/**
 * @aegispulse/research - Deterministic Dataset Fixtures
 * High-fidelity, synthetic test fixtures matching exact public schemas of UBFC, PURE, MMPD, BIDMC, and MIMIC-IV.
 * Enables 100% offline reproducible evaluation without downloading external multi-gigabyte video files.
 */

import type { RawRppgRecordingInput } from '../rppg-adapter';
import type { RawWaveformInput } from '../waveform-adapter';
import type { RawEhrPatientRecord } from '../clinical-adapter';

/**
 * Creates a deterministic rPPG recording fixture matching UBFC-rPPG format
 */
export function createUbfcFixture(durationSec = 20, targetHr = 72): RawRppgRecordingInput {
  const fps = 30;
  const totalFrames = fps * durationSec;
  const timestampsMs = new Array<number>(totalFrames);
  const meanR = new Array<number>(totalFrames);
  const meanG = new Array<number>(totalFrames);
  const meanB = new Array<number>(totalFrames);

  const gtTimestampsMs: number[] = [];
  const gtHeartRateBpm: number[] = [];

  let phase = 0;

  for (let i = 0; i < totalFrames; i++) {
    const t = i / fps;
    const tMs = Math.round(t * 1000);
    timestampsMs[i] = tMs;

    // Dynamic physiological HR curve (mental arithmetic stress & recovery)
    const hrInstant = targetHr + 8 * Math.sin((2 * Math.PI * t) / Math.max(1, durationSec));
    const fCardiac = hrInstant / 60;
    phase += (2 * Math.PI * fCardiac) / fps;

    const pulse = Math.sin(phase) + 0.3 * Math.sin(2 * phase);
    meanR[i] = 180 * (1.0 - 0.005 * pulse);
    meanG[i] = 140 * (1.0 - 0.015 * pulse);
    meanB[i] = 110 * (1.0 - 0.002 * pulse);

    if (i % 30 === 0) {
      gtTimestampsMs.push(tMs);
      gtHeartRateBpm.push(Math.round(hrInstant * 10) / 10);
    }
  }

  return {
    datasetSlug: 'ubfc-rppg',
    subjectId: 'subject-01',
    scenarioName: 'resting-baseline',
    fps,
    timestampsMs,
    meanR,
    meanG,
    meanB,
    gtTimestampsMs,
    gtHeartRateBpm,
    gtSamplingRateHz: 1,
    attributes: {
      motionLevel: 'STATIONARY',
      lightingLevel: 'FLUORESCENT',
      fitzpatrickType: 'II',
    },
  };
}

/**
 * Creates a deterministic PURE motion fixture with periodic head rotation
 */
export function createPureMotionFixture(durationSec = 20, targetHr = 80): RawRppgRecordingInput {
  const fps = 30;
  const totalFrames = fps * durationSec;
  const timestampsMs = new Array<number>(totalFrames);
  const meanR = new Array<number>(totalFrames);
  const meanG = new Array<number>(totalFrames);
  const meanB = new Array<number>(totalFrames);

  const gtTimestampsMs: number[] = [];
  const gtHeartRateBpm: number[] = [];

  const fCardiac = targetHr / 60;

  for (let i = 0; i < totalFrames; i++) {
    const t = i / fps;
    const tMs = Math.round(t * 1000);
    timestampsMs[i] = tMs;

    const pulse = Math.sin(2 * Math.PI * fCardiac * t);
    // Specular motion artifact along illuminant vector [1, 1, 1] at 1.25 Hz
    const specular = 15.0 * Math.sin(2 * Math.PI * 1.25 * t);

    meanR[i] = 175 * (1.0 - 0.005 * pulse) + specular;
    meanG[i] = 135 * (1.0 - 0.015 * pulse) + specular;
    meanB[i] = 105 * (1.0 - 0.002 * pulse) + specular;

    if (i % 30 === 0) {
      gtTimestampsMs.push(tMs);
      gtHeartRateBpm.push(targetHr);
    }
  }

  return {
    datasetSlug: 'pure',
    subjectId: 'pure-subject-04',
    scenarioName: 'head-rotation-medium',
    fps,
    timestampsMs,
    meanR,
    meanG,
    meanB,
    gtTimestampsMs,
    gtHeartRateBpm,
    gtSamplingRateHz: 1,
    attributes: {
      motionLevel: 'HEAD_ROTATION',
      lightingLevel: 'OPTIMAL_STUDIO',
      fitzpatrickType: 'III',
    },
  };
}

/**
 * Creates a deterministic BIDMC contact PPG and Respiration fixture
 */
export function createBidmcWaveformFixture(durationSec = 60, targetHr = 75, targetRr = 16): RawWaveformInput {
  const fs = 125;
  const totalSamples = fs * durationSec;
  const ppg = new Array<number>(totalSamples);
  const respiration = new Array<number>(totalSamples);
  const annotatedBreathsTimestampsSec: number[] = [];

  const fHr = targetHr / 60;
  const fRr = targetRr / 60;
  const breathPeriodSec = 60 / targetRr;

  for (let tSec = 0; tSec < durationSec; tSec += breathPeriodSec) {
    annotatedBreathsTimestampsSec.push(Math.round(tSec * 10) / 10);
  }

  for (let i = 0; i < totalSamples; i++) {
    const t = i / fs;
    const cardiac = Math.sin(2 * Math.PI * fHr * t) + 0.35 * Math.sin(4 * Math.PI * fHr * t);
    const resp = Math.sin(2 * Math.PI * fRr * t);

    // PPG exhibits both pulsatile arterial expansion and respiratory baseline modulation
    ppg[i] = 2048 + 400 * cardiac + 80 * resp;
    respiration[i] = 1000 + 300 * resp;
  }

  return {
    datasetSlug: 'bidmc-ppg-rr',
    patientId: 'bidmc-icu-patient-09',
    samplingRateHz: fs,
    ppg,
    respiration,
    annotatedBreathsTimestampsSec,
  };
}

/**
 * Creates a deterministic MIMIC-IV longitudinal hospital deterioration case
 */
export function createMimicDeteriorationFixture(): RawEhrPatientRecord {
  const baseTime = Date.now() - 3600 * 1000 * 12; // 12 hours ago

  // Patient decompensating with occult sepsis: increasing HR, rising RR, falling BP
  const chartEvents = [
    { timestampMs: baseTime, hr: 74, rr: 14, sbp: 124, dbp: 78, spo2: 98, tempC: 37.0, avpu: 'ALERT' as const },
    { timestampMs: baseTime + 3600 * 1000 * 3, hr: 88, rr: 18, sbp: 115, dbp: 72, spo2: 97, tempC: 37.6, avpu: 'ALERT' as const },
    { timestampMs: baseTime + 3600 * 1000 * 6, hr: 104, rr: 23, sbp: 102, dbp: 64, spo2: 95, tempC: 38.3, avpu: 'ALERT' as const },
    { timestampMs: baseTime + 3600 * 1000 * 9, hr: 122, rr: 28, sbp: 88, dbp: 52, spo2: 92, tempC: 38.9, avpu: 'VOICE' as const, lactate: 3.8 },
  ];

  return {
    datasetSlug: 'mimic-iv',
    patientId: 'mimic-pat-48192',
    admissionId: 'hadm-209148',
    chartEvents,
    clinicalContext: {
      patientId: 'mimic-pat-48192',
      age: 68,
      primaryDiagnosis: 'Post-operative intra-abdominal infection',
      comorbidities: ['Type 2 Diabetes', 'Hypertension'],
      baselineVitals: { heartRate: 72, respiratoryRate: 14, systolicBp: 120 },
      isPostOp: true,
      surgicalSite: 'Abdominal laparotomy',
      immunosuppressed: false,
    },
    outcomes: {
      deteriorationOccurred: true,
      deteriorationType: 'SEPTIC_SHOCK',
      deteriorationTimestampMs: baseTime + 3600 * 1000 * 9.5,
      hoursToDeterioration: 9.5,
      inHospitalMortality: false,
    },
  };
}
