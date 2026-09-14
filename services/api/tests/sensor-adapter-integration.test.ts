import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TelemetryPipelineService } from '../src/services/telemetry-pipeline.service';
import { EventBroadcaster } from '../src/stream/event-broadcaster';
import { wardStateService } from '../src/services/ward-state.service';
import {
  SimulationSensorProvider,
  RppgSensorProvider,
  type SensorReading,
} from '@aegispulse/signal';

describe('Sensor Adapter & Clinical Telemetry Pipeline Integration', () => {
  let broadcaster: EventBroadcaster;
  let pipeline: TelemetryPipelineService;

  beforeEach(() => {
    broadcaster = new EventBroadcaster();
    pipeline = new TelemetryPipelineService({ broadcaster });
  });

  afterEach(() => {
    pipeline.stopLiveSimulation();
  });

  it('processes SensorReading from any agnostic source and emits stream events', () => {
    const events: any[] = [];
    broadcaster.on('event', (evt) => {
      events.push(evt);
    });

    const reading: SensorReading = {
      id: 'sr-int-01',
      patientId: 'P001',
      bedId: 'BED-401',
      source: 'OPTICAL_RPPG',
      timestamp: Date.now(),
      confidence: 0.94,
      signalQuality: {
        sqiPercentage: 94,
        snrDb: 6.5,
        illuminationLux: 350,
        motionArtifactIndex: 0.04,
        state: 'TRUSTED',
        isUsable: true,
        faceDetected: true,
      },
      measurementStatus: 'VALID',
      heartRate: 74,
      respiratoryRate: 16,
    };

    pipeline.processSensorReading(reading);

    // Verify OBSERVATION_UPDATED event
    const obsEvent = events.find((e) => e.eventType === 'OBSERVATION_UPDATED');
    expect(obsEvent).toBeDefined();
    expect(obsEvent.data.heartRate).toBe(74);
    expect(obsEvent.data.respiratoryRate).toBe(16);
    expect(obsEvent.data.confidence).toBe(0.94);

    // Verify APS_UPDATED event
    const apsEvent = events.find((e) => e.eventType === 'APS_UPDATED');
    expect(apsEvent).toBeDefined();
    expect(apsEvent.data.apsScore).toBeDefined();
  });

  it('STRICT INVARIANT: when measurement_status = LOW_CONFIDENCE, no vitals are fabricated into stream', () => {
    const events: any[] = [];
    broadcaster.on('event', (evt) => {
      events.push(evt);
    });

    const lowConfidenceReading: SensorReading = {
      id: 'sr-int-low-01',
      patientId: 'P002',
      bedId: 'BED-402',
      source: 'WEBCAM',
      timestamp: Date.now(),
      confidence: 0.25,
      signalQuality: {
        sqiPercentage: 20,
        snrDb: -0.5,
        illuminationLux: 60,
        motionArtifactIndex: 0.75,
        state: 'UNRELIABLE',
        isUsable: false,
        faceDetected: true,
        reason: 'Patient movement artifact',
      },
      measurementStatus: 'LOW_CONFIDENCE',
      measurement_status: 'LOW_CONFIDENCE',
      heartRate: undefined,
      respiratoryRate: undefined,
    };

    pipeline.processSensorReading(lowConfidenceReading);

    // Broadcasted observation MUST NOT contain fabricated vitals
    const obsEvent = events.find((e) => e.eventType === 'OBSERVATION_UPDATED');
    expect(obsEvent).toBeDefined();
    expect(obsEvent.data.heartRate).toBeUndefined();
    expect(obsEvent.data.respiratoryRate).toBeUndefined();
    expect(obsEvent.data.confidence).toBe(0.25);
    expect(obsEvent.data.qualityState).toBe('UNRELIABLE');

    // APS evaluation must complete and note degraded telemetry
    const apsEvent = events.find((e) => e.eventType === 'APS_UPDATED');
    expect(apsEvent).toBeDefined();
    expect(
      apsEvent.data.reasons.some(
        (r: any) =>
          r.humanReadableExplanation.toLowerCase().includes('sensor') ||
          r.humanReadableExplanation.toLowerCase().includes('telemetry') ||
          r.category === 'SIGNAL_CONFIDENCE'
      )
    ).toBe(true);
  });


  it('attaches SimulationSensorProvider and streams readings seamlessly', () => {
    const simProvider = new SimulationSensorProvider({
      providerId: 'sim-attached-01',
      scenarioId: 'NORMAL_SHIFT',
    });

    const events: any[] = [];
    broadcaster.on('event', (evt) => {
      events.push(evt);
    });

    const unsub = pipeline.attachSensorProvider(simProvider);

    // Step simulator provider
    simProvider.stepAndEmit(1000);

    expect(events.length).toBeGreaterThan(0);
    const obsEvent = events.find((e) => e.eventType === 'OBSERVATION_UPDATED');
    expect(obsEvent).toBeDefined();
    expect(obsEvent.data.source).toBe('SIMULATION');

    unsub();
  });

  it('attaches RppgSensorProvider and processes contactless optical pulse streams', () => {
    const rppgProvider = new RppgSensorProvider({
      providerId: 'rppg-attached-01',
      algorithm: 'POS',
    });

    const events: any[] = [];
    broadcaster.on('event', (evt) => {
      events.push(evt);
    });

    const unsub = pipeline.attachSensorProvider(rppgProvider);

    // Feed synthetic 30fps cardiac pulse series
    const fps = 30;
    const totalFrames = fps * 8;
    const timestampsMs: number[] = [];
    const r: number[] = [];
    const g: number[] = [];
    const b: number[] = [];

    const start = Date.now();
    for (let i = 0; i < totalFrames; i++) {
      const t = i / fps;
      timestampsMs.push(start + Math.round(t * 1000));
      const cardiac = Math.sin(2 * Math.PI * 1.33 * t); // ~80 bpm
      r.push(160 + 0.5 * cardiac);
      g.push(120 + 3.0 * cardiac);
      b.push(100 + 0.3 * cardiac);
    }

    rppgProvider.processRgbSeries(
      { fps, timestampsMs, r, g, b },
      'P003',
      'BED-403',
      0.02,
      0.95
    );

    const obsEvent = events.find((e) => e.eventType === 'OBSERVATION_UPDATED');
    expect(obsEvent).toBeDefined();
    expect(obsEvent.data.source).toBe('OPTICAL_RPPG');
    expect(obsEvent.data.heartRate).toBeGreaterThanOrEqual(75);
    expect(obsEvent.data.heartRate).toBeLessThanOrEqual(85);

    unsub();
  });

  it('strictly rejects any reading containing raw camera pixels or video frames', () => {
    const illegalReading: any = {
      id: 'sr-hack-01',
      patientId: 'P001',
      source: 'OPTICAL_RPPG',
      timestamp: Date.now(),
      confidence: 0.90,
      signalQuality: {
        sqiPercentage: 90,
        snrDb: 5.0,
        illuminationLux: 350,
        motionArtifactIndex: 0.05,
        state: 'TRUSTED',
        isUsable: true,
        faceDetected: true,
      },
      measurementStatus: 'VALID',
      heartRate: 72,
      rawFrame: '0xDEADBEEF_RAW_PIXELS', // FORBIDDEN!
    };

    expect(() => {
      pipeline.processSensorReading(illegalReading);
    }).toThrow(/Security Violation: Raw video frame field 'rawFrame' is forbidden/);
  });
});
