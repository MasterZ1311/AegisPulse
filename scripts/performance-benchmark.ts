import { performance } from 'node:perf_hooks';
import {
  AttentionPriorityEngine,
  ExplainabilityEngine,
  type PatientStateInput,
} from '@aegispulse/clinical';
import { extractPulsePos, extractPulseChrom, extractPulseGreen } from '../research/rppg/src/index.ts';
import { wardStateService } from '../services/api/src/services/ward-state.service.ts';

export interface BenchmarkReport {
  timestamp: string;
  environment: string;
  nodeVersion: string;
  measurements: {
    apsCalculation: {
      runs10AvgMs: number;
      runs100AvgMs: number;
      runs1000AvgMs: number;
      p50Ms: number;
      p95Ms: number;
      p99Ms: number;
      opsPerSec: number;
    };
    databaseLatency: {
      insertObservationMs: number;
      queryObservationsMs: number;
      queryPatientMs: number;
    };
    rppgProcessingLatency: {
      posAlgorithmMs: number;
      chromAlgorithmMs: number;
      greenAlgorithmMs: number;
    };
    telemetryPayloadSizes: {
      observationEnvelopeBytes: number;
      apsEnvelopeBytes: number;
      wardSnapshotBytes: number;
    };
  };
}

export function runPerformanceBenchmark(): BenchmarkReport {
  console.log('============================================================');
  console.log('  AEGISPULSE REPRODUCIBLE PERFORMANCE BENCHMARK ENGINE');
  console.log('============================================================\n');

  // 1. Benchmark Attention Priority Engine Calculation
  const apsEngine = new AttentionPriorityEngine();
  const explainEngine = new ExplainabilityEngine();

  const mockState: PatientStateInput = {
    patientId: 'P003',
    bedNumber: '403-A',
    currentTimestamp: Date.now(),
    observations: [
      { id: '1', patientId: 'P003', vitalType: 'HEART_RATE', value: 112, timestamp: Date.now(), source: 'BEDSIDE_DEVICE', confidence: 1.0, qualityStatus: 'TRUSTED' },
      { id: '2', patientId: 'P003', vitalType: 'RESPIRATORY_RATE', value: 26, timestamp: Date.now(), source: 'BEDSIDE_DEVICE', confidence: 1.0, qualityStatus: 'TRUSTED' },
      { id: '3', patientId: 'P003', vitalType: 'SYSTOLIC_BP', value: 88, timestamp: Date.now(), source: 'BEDSIDE_DEVICE', confidence: 1.0, qualityStatus: 'TRUSTED' },
      { id: '4', patientId: 'P003', vitalType: 'DIASTOLIC_BP', value: 54, timestamp: Date.now(), source: 'BEDSIDE_DEVICE', confidence: 1.0, qualityStatus: 'TRUSTED' },
      { id: '5', patientId: 'P003', vitalType: 'OXYGEN_SATURATION', value: 93, timestamp: Date.now(), source: 'BEDSIDE_DEVICE', confidence: 1.0, qualityStatus: 'TRUSTED' },
    ],
    latestSignalQuality: {
      sqiPercentage: 92,
      snrDb: 6.5,
      illuminationLux: 350,
      motionArtifactIndex: 0.05,
      state: 'TRUSTED',
      isUsable: true,
      faceDetected: true,
    },
  };

  // Warmup
  for (let i = 0; i < 50; i++) {
    const res = apsEngine.evaluate(mockState);
    explainEngine.explainPatient(mockState, res);
  }

  // 10 Runs
  const t0_10 = performance.now();
  for (let i = 0; i < 10; i++) {
    const res = apsEngine.evaluate(mockState);
    explainEngine.explainPatient(mockState, res);
  }
  const runs10AvgMs = (performance.now() - t0_10) / 10;

  // 100 Runs
  const t0_100 = performance.now();
  for (let i = 0; i < 100; i++) {
    const res = apsEngine.evaluate(mockState);
    explainEngine.explainPatient(mockState, res);
  }
  const runs100AvgMs = (performance.now() - t0_100) / 100;

  // 1000 Runs & Latency Reservoir
  const samples: number[] = [];
  const t0_1000 = performance.now();
  for (let i = 0; i < 1000; i++) {
    const start = performance.now();
    const res = apsEngine.evaluate(mockState);
    explainEngine.explainPatient(mockState, res);
    samples.push(performance.now() - start);
  }
  const total1000Duration = performance.now() - t0_1000;
  const runs1000AvgMs = total1000Duration / 1000;
  const opsPerSec = Math.round(1000 / runs1000AvgMs);

  samples.sort((a, b) => a - b);
  const p50Ms = Number((samples[Math.floor(samples.length * 0.5)]).toFixed(3));
  const p95Ms = Number((samples[Math.floor(samples.length * 0.95)]).toFixed(3));
  const p99Ms = Number((samples[Math.floor(samples.length * 0.99)]).toFixed(3));

  console.log('1. Attention Priority Engine & Explainability Benchmark:');
  console.log(`   - 10 runs avg:     ${runs10AvgMs.toFixed(3)} ms`);
  console.log(`   - 100 runs avg:    ${runs100AvgMs.toFixed(3)} ms`);
  console.log(`   - 1,000 runs avg:  ${runs1000AvgMs.toFixed(3)} ms`);
  console.log(`   - p50:             ${p50Ms} ms`);
  console.log(`   - p95:             ${p95Ms} ms`);
  console.log(`   - p99:             ${p99Ms} ms`);
  console.log(`   - Throughput:      ${opsPerSec} calculations/sec\n`);

  // 2. Database Persistence Benchmark
  const now = Date.now();
  const testObs = {
    id: `bench-obs-${now}`,
    patientId: 'P001',
    timestamp: now,
    source: 'BEDSIDE_DEVICE' as const,
    confidence: 1.0,
    qualityState: 'TRUSTED' as const,
    heartRate: 80,
    respiratoryRate: 18,
    systolicBP: 120,
    diastolicBP: 80,
  };

  const tDbInsert = performance.now();
  wardStateService.addObservation(testObs);
  const insertObservationMs = Number((performance.now() - tDbInsert).toFixed(3));

  const tDbQueryObs = performance.now();
  wardStateService.getObservations('P001', { limit: 20 });
  const queryObservationsMs = Number((performance.now() - tDbQueryObs).toFixed(3));

  const tDbQueryPat = performance.now();
  wardStateService.getPatient('P001');
  const queryPatientMs = Number((performance.now() - tDbQueryPat).toFixed(3));

  console.log('2. SQLite Persistence Latency Benchmark:');
  console.log(`   - Insert Observation:  ${insertObservationMs} ms`);
  console.log(`   - Query Observations:  ${queryObservationsMs} ms`);
  console.log(`   - Query Patient State: ${queryPatientMs} ms\n`);

  // 3. rPPG Chrominance Signal Processing Benchmark (300-frame optical window = 10 sec @ 30fps)
  const windowLength = 300;
  const r = Array.from({ length: windowLength }, (_, i) => 120 + Math.sin(i * 0.2) * 5);
  const g = Array.from({ length: windowLength }, (_, i) => 80 + Math.sin(i * 0.2 + 0.1) * 7);
  const b = Array.from({ length: windowLength }, (_, i) => 60 + Math.sin(i * 0.2 + 0.2) * 4);

  const tPos = performance.now();
  extractPulsePos(r, g, b, { fps: 30 });
  const posAlgorithmMs = Number((performance.now() - tPos).toFixed(3));

  const tChrom = performance.now();
  extractPulseChrom(r, g, b, { fps: 30 });
  const chromAlgorithmMs = Number((performance.now() - tChrom).toFixed(3));

  const tGreen = performance.now();
  extractPulseGreen(g, { fps: 30 });
  const greenAlgorithmMs = Number((performance.now() - tGreen).toFixed(3));

  console.log('3. rPPG Optical Chrominance Processing Latency (300 Frames):');
  console.log(`   - Plane-Orthogonal-to-Skin (POS): ${posAlgorithmMs} ms`);
  console.log(`   - Chrominance (CHROM):            ${chromAlgorithmMs} ms`);
  console.log(`   - Green Channel Fast Baseline:    ${greenAlgorithmMs} ms\n`);

  // 4. Telemetry Payload Size Analysis
  const sampleObsEnvelope = {
    seq: 142,
    eventId: 'evt-obs-P003-1726322000000',
    eventType: 'OBSERVATION_UPDATED',
    timestamp: now,
    wardId: 'WARD-4B',
    patientId: 'P003',
    data: {
      patientId: 'P003',
      bedId: 'BED-403',
      wardId: 'WARD-4B',
      timestamp: now,
      heartRate: 108,
      respiratoryRate: 24,
      systolicBP: 92,
      diastolicBP: 58,
      spo2: 95,
      confidence: 1.0,
      qualityState: 'TRUSTED',
      source: 'BEDSIDE_DEVICE',
      shockIndex: 1.17,
    },
  };

  const sampleApsEnvelope = {
    seq: 143,
    eventId: 'evt-aps-P003-1726322000050',
    eventType: 'APS_UPDATED',
    timestamp: now,
    wardId: 'WARD-4B',
    patientId: 'P003',
    data: {
      patientId: 'P003',
      wardId: 'WARD-4B',
      apsScore: 88,
      category: 'CRITICAL_REVIEW',
      previousScore: 62,
      confidence: 0.98,
      freshnessScore: 100,
      topReason: 'Occult Shock Trajectory: Tachycardia paired with narrow pulse pressure.',
      reasons: [
        { id: '1', category: 'PHYSIOLOGY', severity: 'CRITICAL', humanReadableExplanation: 'Heart rate 108 BPM (> 20% above baseline).' },
        { id: '2', category: 'VELOCITY', severity: 'HIGH', humanReadableExplanation: 'Respiratory rate velocity accelerating at +6 breaths/hr.' },
      ],
      recommendedActions: ['Manual Bedside Verification', 'Rapid Response Consultation'],
    },
  };

  const sampleWardSnapshot = {
    type: 'SNAPSHOT',
    wardId: 'WARD-4B',
    timestamp: now,
    sequenceNumber: 143,
    radar: [sampleObsEnvelope.data, sampleObsEnvelope.data, sampleObsEnvelope.data, sampleObsEnvelope.data, sampleObsEnvelope.data, sampleObsEnvelope.data],
  };

  const observationEnvelopeBytes = Buffer.byteLength(JSON.stringify(sampleObsEnvelope), 'utf8');
  const apsEnvelopeBytes = Buffer.byteLength(JSON.stringify(sampleApsEnvelope), 'utf8');
  const wardSnapshotBytes = Buffer.byteLength(JSON.stringify(sampleWardSnapshot), 'utf8');

  console.log('4. Streaming Telemetry Wire Overhead:');
  console.log(`   - OBSERVATION_UPDATED Envelope: ${observationEnvelopeBytes} bytes`);
  console.log(`   - APS_UPDATED Envelope:         ${apsEnvelopeBytes} bytes`);
  console.log(`   - Complete 6-Bed Ward Snapshot: ${wardSnapshotBytes} bytes\n`);

  console.log('============================================================');
  console.log('  BENCHMARK COMPLETED SUCCESSFULLY');
  console.log('============================================================\n');

  return {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'test',
    nodeVersion: process.version,
    measurements: {
      apsCalculation: {
        runs10AvgMs,
        runs100AvgMs,
        runs1000AvgMs,
        p50Ms,
        p95Ms,
        p99Ms,
        opsPerSec,
      },
      databaseLatency: {
        insertObservationMs,
        queryObservationsMs,
        queryPatientMs,
      },
      rppgProcessingLatency: {
        posAlgorithmMs,
        chromAlgorithmMs,
        greenAlgorithmMs,
      },
      telemetryPayloadSizes: {
        observationEnvelopeBytes,
        apsEnvelopeBytes,
        wardSnapshotBytes,
      },
    },
  };
}

// Run when executed directly
if (process.argv[1]?.includes('performance-benchmark')) {
  runPerformanceBenchmark();
}
