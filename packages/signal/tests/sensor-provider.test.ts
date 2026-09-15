import { describe, it, expect } from 'vitest';
import {
  SimulationSensorProvider,
  RppgSensorProvider,
  SensorHub,
  sensorReadingToPhysiologicalObservation,
  sensorReadingToObservation,
  type SensorReading,
} from '../src/index';
import type { RgbTimeSeries } from '@aegispulse/rppg';

describe('Sensor Adapter & Provider Architecture Suite', () => {
  describe('1. SimulationSensorProvider', () => {
    it('initializes and conforms to SensorProvider contract', () => {
      const provider = new SimulationSensorProvider({ providerId: 'sim-test-01' });
      expect(provider.getProviderId()).toBe('sim-test-01');
      expect(provider.getSource()).toBe('SIMULATION');

      const status = provider.getStatus();
      expect(status.state).toBe('IDLE');
      expect(status.connected).toBe(true);
      expect(status.isStreaming).toBe(false);
    });

    it('emits valid sensor readings under normal conditions', async () => {
      const provider = new SimulationSensorProvider({
        providerId: 'sim-test-normal',
        scenarioId: 'NORMAL_SHIFT',
        minConfidenceThreshold: 0.60,
      });

      const reading = await provider.read('P001');
      expect(reading).not.toBeNull();
      if (reading) {
        expect(reading.source).toBe('SIMULATION');
        expect(reading.measurementStatus).toBe('VALID');
        expect(reading.measurement_status).toBe('VALID');
        expect(reading.confidence).toBeGreaterThanOrEqual(0.60);
        expect(reading.heartRate).toBeDefined();
        expect(reading.heartRate).toBeGreaterThan(40);
        expect(reading.signalQuality.isUsable).toBe(true);
      }
    });

    it('STRICT INVARIANT: emits LOW_CONFIDENCE and ZERO fabricated vitals when threshold is unreached', () => {
      // Set unreachable confidence threshold (e.g. 0.999) to force LOW_CONFIDENCE
      const provider = new SimulationSensorProvider({
        providerId: 'sim-test-strict',
        minConfidenceThreshold: 0.999,
      });

      const readings = provider.stepAndEmit(1000);
      expect(readings.length).toBeGreaterThan(0);

      for (const r of readings) {
        expect(r.measurementStatus).toBe('LOW_CONFIDENCE');
        expect(r.measurement_status).toBe('LOW_CONFIDENCE');
        // ZERO-FABRICATION VERIFICATION:
        expect(r.heartRate).toBeUndefined();
        expect(r.respiratoryRate).toBeUndefined();
        expect(r.systolicBP).toBeUndefined();
        expect(r.diastolicBP).toBeUndefined();
        expect(r.signalQuality.isUsable).toBe(false);
      }
    });

    it('handles start and stop streaming with callbacks', async () => {
      const provider = new SimulationSensorProvider({
        streamingIntervalMs: 50,
      });

      const received: SensorReading[] = [];
      const unsub = provider.onReading((r) => {
        received.push(r);
      });

      provider.start();
      expect(provider.getStatus().state).toBe('STREAMING');

      // Wait for a few ticks
      await new Promise((resolve) => setTimeout(resolve, 150));

      provider.stop();
      expect(provider.getStatus().state).toBe('IDLE');
      unsub();

      expect(received.length).toBeGreaterThan(0);
    });
  });

  describe('2. RPPGSensorProvider', () => {
    it('initializes and conforms to SensorProvider contract', () => {
      const provider = new RppgSensorProvider({
        providerId: 'rppg-cam-01',
        algorithm: 'POS',
      });

      expect(provider.getProviderId()).toBe('rppg-cam-01');
      expect(provider.getSource()).toBe('OPTICAL_RPPG');
      expect(provider.getAlgorithm()).toBe('POS');

      const status = provider.getStatus();
      expect(status.state).toBe('IDLE');
      expect(status.connected).toBe(true);
    });

    it('processes clean RGB series and produces VALID SensorReading', () => {
      const provider = new RppgSensorProvider({
        algorithm: 'POS',
        minConfidenceThreshold: 0.50,
      });

      // Generate 8 seconds of synthetic 30fps cardiac pulse at 72 bpm (1.2 Hz)
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
        // Synthetic photoplethysmographic signal modulated on RGB channels
        const cardiac = Math.sin(2 * Math.PI * 1.2 * t);
        r.push(160 + 0.5 * cardiac);
        g.push(120 + 2.5 * cardiac);
        b.push(100 + 0.3 * cardiac);
      }

      const series: RgbTimeSeries = { fps, timestampsMs, r, g, b };
      const reading = provider.processRgbSeries(series, 'PAT-OPTICAL-01', 'BED-01', 0.02, 0.95);

      expect(reading.source).toBe('OPTICAL_RPPG');
      expect(reading.measurementStatus).toBe('VALID');
      expect(reading.measurement_status).toBe('VALID');
      expect(reading.heartRate).toBeDefined();
      expect(reading.heartRate).toBeGreaterThanOrEqual(68);
      expect(reading.heartRate).toBeLessThanOrEqual(76);
      expect(reading.signalQuality.snrDb).toBeGreaterThan(2.0);
    });

    it('STRICT INVARIANT: emits LOW_CONFIDENCE and ZERO fabricated vitals under severe motion or noise', () => {
      const provider = new RppgSensorProvider({
        algorithm: 'POS',
        minConfidenceThreshold: 0.60,
      });

      // Severe motion artifact
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
        // Random motion noise overwhelming cardiac pulse
        r.push(160 + (Math.random() - 0.5) * 40);
        g.push(120 + (Math.random() - 0.5) * 50);
        b.push(100 + (Math.random() - 0.5) * 40);
      }

      const series: RgbTimeSeries = { fps, timestampsMs, r, g, b };
      // Motion magnitude = 0.85 (violent head movement)
      const reading = provider.processRgbSeries(series, 'PAT-MOTION-01', 'BED-02', 0.85, 0.30);

      expect(['LOW_CONFIDENCE', 'MOTION_CONTAMINATED']).toContain(reading.measurementStatus);
      expect(['LOW_CONFIDENCE', 'MOTION_CONTAMINATED']).toContain(reading.measurement_status);
      // ZERO FABRICATION INVARIANT:
      expect(reading.heartRate).toBeUndefined();
      expect(reading.respiratoryRate).toBeUndefined();
      expect(reading.signalQuality.isUsable).toBe(false);
    });

    it('enforces privacy protection: throws error if raw frame buffer key is passed to pushFrameRoi', () => {
      const provider = new RppgSensorProvider();
      const illegalRoi: any = {
        frameIndex: 1,
        timestampMs: Date.now(),
        boundingBox: [0.2, 0.2, 0.4, 0.4],
        meanR: 150,
        meanG: 120,
        meanB: 95,
        pixelCount: 5000,
        skinFraction: 0.85,
        rawFrame: new Uint8Array(100), // FORBIDDEN: Raw video frame!
      };

      expect(() => {
        provider.pushFrameRoi(illegalRoi, 'PAT-01');
      }).toThrow(/PRIVACY VIOLATION/);
    });
  });

  describe('3. SensorHub Multi-Provider Registry', () => {
    it('aggregates readings and status from diverse sensor providers', async () => {
      const hub = new SensorHub();

      const simProvider = new SimulationSensorProvider({ providerId: 'sim-prov' });
      const rppgProvider = new RppgSensorProvider({ providerId: 'rppg-prov' });

      hub.registerProvider(simProvider);
      hub.registerProvider(rppgProvider);

      expect(hub.getAllProviders().length).toBe(2);
      expect(hub.getProvider('sim-prov')).toBeDefined();
      expect(hub.getProvider('rppg-prov')).toBeDefined();

      const receivedReadings: SensorReading[] = [];
      const unsub = hub.onReading((r) => {
        receivedReadings.push(r);
      });

      // Step simulator through provider
      simProvider.stepAndEmit(1000);

      expect(receivedReadings.length).toBeGreaterThan(0);
      expect(receivedReadings[0].source).toBe('SIMULATION');

      unsub();
      hub.unregisterProvider('sim-prov');
      hub.unregisterProvider('rppg-prov');
      expect(hub.getAllProviders().length).toBe(0);
    });
  });

  describe('4. Sensor Adapter Clinical Converters', () => {
    it('converts VALID SensorReading to trusted PhysiologicalObservation', () => {
      const reading: SensorReading = {
        id: 'sr-conv-01',
        patientId: 'PAT-CONV-01',
        bedId: 'BED-01',
        source: 'OPTICAL_RPPG',
        timestamp: Date.now(),
        confidence: 0.90,
        signalQuality: {
          sqiPercentage: 90,
          snrDb: 6.0,
          illuminationLux: 350,
          motionArtifactIndex: 0.04,
          state: 'TRUSTED',
          isUsable: true,
          faceDetected: true,
        },
        measurementStatus: 'VALID',
        heartRate: 72,
        respiratoryRate: 15,
      };

      const obs = sensorReadingToPhysiologicalObservation(reading);
      expect(obs.patientId).toBe('PAT-CONV-01');
      expect(obs.heartRate).toBe(72);
      expect(obs.respiratoryRate).toBe(15);
      expect(obs.qualityState).toBe('TRUSTED');

      const singleObs = sensorReadingToObservation(reading, 'HEART_RATE');
      expect(singleObs).not.toBeNull();
      expect(singleObs?.value).toBe(72);
      expect(singleObs?.unit).toBe('BPM');
    });

    it('converts LOW_CONFIDENCE SensorReading with strictly undefined vitals', () => {
      const reading: SensorReading = {
        id: 'sr-conv-02',
        patientId: 'PAT-CONV-02',
        source: 'OPTICAL_RPPG',
        timestamp: Date.now(),
        confidence: 0.30,
        signalQuality: {
          sqiPercentage: 25,
          snrDb: 0.2,
          illuminationLux: 150,
          motionArtifactIndex: 0.70,
          state: 'UNRELIABLE',
          isUsable: false,
          faceDetected: true,
        },
        measurementStatus: 'LOW_CONFIDENCE',
        measurement_status: 'LOW_CONFIDENCE',
        heartRate: undefined,
        respiratoryRate: undefined,
      };

      const obs = sensorReadingToPhysiologicalObservation(reading);
      expect(obs.heartRate).toBeUndefined();
      expect(obs.respiratoryRate).toBeUndefined();
      expect(obs.qualityState).toBe('UNRELIABLE');

      // Atomic observation cannot be created from low-confidence reading
      const singleObs = sensorReadingToObservation(reading, 'HEART_RATE');
      expect(singleObs).toBeNull();
    });
  });
});
