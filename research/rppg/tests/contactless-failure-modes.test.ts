import { describe, it, expect } from 'vitest';
import { RppgPipeline } from '../src/pipeline/rppg-pipeline';
import { generateSyntheticRgbSeries } from '../src/evaluation/synthetic-dataset';
import { RppgSensorProvider } from '../../../packages/signal/src/providers/rppg-sensor-provider';
import type { VideoFrameRoi } from '../src/types';

describe('Contactless Sensing Complete Failure-Mode & Gating Verification Suite', () => {
  const pipeline = new RppgPipeline();

  // Helper: generates standard clean series
  function getCleanSeries(hr = 72) {
    return generateSyntheticRgbSeries({
      fps: 30,
      durationSeconds: 10,
      targetHeartRateBpm: hr,
      motionIntensity: 0.0,
      snrAdditiveNoise: 0.005,
      randomSeed: 1000 + hr,
    }).series;
  }

  describe('1. 15 Adversarial Failure Modes Verification', () => {
    it('FAILURE MODE 1: NO FACE - flags NO_FACE and withholds vitals', () => {
      const series = getCleanSeries(75);
      const provider = new RppgSensorProvider();

      const reading = provider.processRgbSeries(series, 'P001', 'B001', 0.0, 0.95, {
        faceDetected: false,
      });

      expect(reading.measurementStatus).toBe('NO_FACE');
      expect(reading.measurement_status).toBe('NO_FACE');
      expect(reading.heartRate).toBeUndefined();
      expect(reading.respiratoryRate).toBeUndefined();
      expect(reading.confidence).toBe(0);
      expect(reading.signalQuality.isUsable).toBe(false);
      expect(reading.signalQuality.faceDetected).toBe(false);
      expect(reading.signalQuality.reason).toContain('No face detected');
    });

    it('FAILURE MODE 2: FACE PARTIALLY OCCLUDED - flags LOW_CONFIDENCE and withholds vitals', () => {
      const series = getCleanSeries(75);
      const provider = new RppgSensorProvider();

      // Viable skin fraction = 0.25 (< 0.40 threshold, e.g. mask or blanket covering face)
      const reading = provider.processRgbSeries(series, 'P001', 'B001', 0.0, 0.95, {
        skinFraction: 0.25,
      });

      expect(reading.measurementStatus).toBe('LOW_CONFIDENCE');
      expect(reading.heartRate).toBeUndefined();
      expect(reading.confidence).toBeLessThan(0.30);
      expect(reading.signalQuality.isUsable).toBe(false);
      expect(reading.signalQuality.reason).toContain('occluded');
    });

    it('FAILURE MODE 3: PATIENT MOTION - flags MOTION_CONTAMINATED and withholds vitals', () => {
      const series = getCleanSeries(75);
      const provider = new RppgSensorProvider();

      // Motion magnitude = 0.55 (> 0.25 artifact threshold)
      const reading = provider.processRgbSeries(series, 'P001', 'B001', 0.55, 0.95, {
        motionMagnitude: 0.55,
      });

      expect(reading.measurementStatus).toBe('MOTION_CONTAMINATED');
      expect(reading.heartRate).toBeUndefined();
      expect(reading.respiratoryRate).toBeUndefined();
      expect(reading.confidence).toBeLessThan(0.30);
      expect(reading.signalQuality.isUsable).toBe(false);
      expect(reading.signalQuality.motionDetected).toBe(true);
      expect(reading.signalQuality.reason).toContain('motion artifact');
    });

    it('FAILURE MODE 4: HEAD ROTATION - flags MOTION_CONTAMINATED and withholds vitals', () => {
      const series = getCleanSeries(75);
      const provider = new RppgSensorProvider();

      const reading = provider.processRgbSeries(series, 'P001', 'B001', 0.15, 0.95, {
        headRotationDetected: true,
      });

      expect(reading.measurementStatus).toBe('MOTION_CONTAMINATED');
      expect(reading.heartRate).toBeUndefined();
      expect(reading.signalQuality.isUsable).toBe(false);
      expect(reading.signalQuality.reason).toContain('Head rotation');
    });

    it('FAILURE MODE 5: TALKING / SPEECH ARTIFACT - flags MOTION_CONTAMINATED and withholds vitals', () => {
      const series = getCleanSeries(75);
      const provider = new RppgSensorProvider();

      const reading = provider.processRgbSeries(series, 'P001', 'B001', 0.10, 0.95, {
        talkingDetected: true,
      });

      expect(reading.measurementStatus).toBe('MOTION_CONTAMINATED');
      expect(reading.heartRate).toBeUndefined();
      expect(reading.signalQuality.isUsable).toBe(false);
      expect(reading.signalQuality.reason).toContain('Mandibular speech');
    });

    it('FAILURE MODE 6: LOW LIGHT (< 30 Lux) - flags INSUFFICIENT_LIGHT and withholds vitals', () => {
      const series = getCleanSeries(75);
      const provider = new RppgSensorProvider();

      // Pitch black / deep twilight: 15 lux
      const reading = provider.processRgbSeries(series, 'P001', 'B001', 0.0, 0.04, {
        illuminationLux: 15,
        illuminationScore: 0.04,
      });

      expect(reading.measurementStatus).toBe('INSUFFICIENT_LIGHT');
      expect(reading.heartRate).toBeUndefined();
      expect(reading.confidence).toBe(0);
      expect(reading.signalQuality.isUsable).toBe(false);
      expect(reading.signalQuality.illuminationLux).toBe(15);
      expect(reading.signalQuality.reason).toContain('30 lux');
    });

    it('FAILURE MODE 7: RAPID BRIGHTNESS CHANGE - flags LOW_CONFIDENCE and withholds vitals', () => {
      const series = getCleanSeries(75);
      const provider = new RppgSensorProvider();

      const reading = provider.processRgbSeries(series, 'P001', 'B001', 0.05, 0.95, {
        rapidBrightnessChange: true,
      });

      expect(reading.measurementStatus).toBe('LOW_CONFIDENCE');
      expect(reading.heartRate).toBeUndefined();
      expect(reading.signalQuality.isUsable).toBe(false);
      expect(reading.signalQuality.reason).toContain('Rapid ambient brightness');
    });

    it('FAILURE MODE 8: CAMERA DISCONNECT - flags LOW_CONFIDENCE with CAMERA_DISCONNECTED reason', () => {
      const provider = new RppgSensorProvider();
      const reading = provider.handleCameraDisconnect('P001', 'B001');

      expect(reading.measurementStatus).toBe('LOW_CONFIDENCE');
      expect(reading.heartRate).toBeUndefined();
      expect(reading.confidence).toBe(0);
      expect(reading.signalQuality.isUsable).toBe(false);
      expect(reading.signalQuality.reason).toContain('Camera hardware disconnected');
    });

    it('FAILURE MODE 9: CAMERA PERMISSION DENIED - flags LOW_CONFIDENCE with PERMISSION_DENIED reason', () => {
      const provider = new RppgSensorProvider();
      const reading = provider.handleCameraPermissionDenied('P001', 'B001');

      expect(reading.measurementStatus).toBe('LOW_CONFIDENCE');
      expect(reading.heartRate).toBeUndefined();
      expect(reading.confidence).toBe(0);
      expect(reading.signalQuality.isUsable).toBe(false);
      expect(reading.signalQuality.reason).toContain('permission denied');
    });

    it('FAILURE MODE 10: LOW FRAME RATE (< 16 FPS) - flags LOW_CONFIDENCE (Nyquist violation)', () => {
      const clean = getCleanSeries(72);
      // Construct 12 fps series
      const lowFpsSeries = {
        ...clean,
        fps: 12,
      };
      const provider = new RppgSensorProvider();

      const reading = provider.processRgbSeries(lowFpsSeries, 'P001', 'B001', 0.05, 0.95);

      expect(reading.measurementStatus).toBe('LOW_CONFIDENCE');
      expect(reading.heartRate).toBeUndefined();
      expect(reading.signalQuality.isUsable).toBe(false);
      expect(reading.signalQuality.reason).toContain('16 FPS');
    });

    it('FAILURE MODE 11: FRAME DROPS & JITTER - flags LOW_CONFIDENCE when drop rate > 20%', () => {
      const series = getCleanSeries(75);
      const provider = new RppgSensorProvider();

      const reading = provider.processRgbSeries(series, 'P001', 'B001', 0.05, 0.95, {
        frameDropRate: 0.35, // 35% dropped frames
      });

      expect(reading.measurementStatus).toBe('LOW_CONFIDENCE');
      expect(reading.heartRate).toBeUndefined();
      expect(reading.signalQuality.isUsable).toBe(false);
      expect(reading.signalQuality.reason).toContain('frame drop rate');
    });

    it('FAILURE MODE 12: POOR CAMERA QUALITY (High Noise / Low SNR) - flags LOW_CONFIDENCE', () => {
      // Very noisy camera sensor
      const noisySeries = generateSyntheticRgbSeries({
        fps: 30,
        durationSeconds: 10,
        targetHeartRateBpm: 72,
        snrAdditiveNoise: 0.25, // Massive sensor noise
        randomSeed: 999,
      }).series;

      const provider = new RppgSensorProvider({ minConfidenceThreshold: 0.60 });
      const reading = provider.processRgbSeries(noisySeries, 'P001', 'B001', 0.05, 0.95);

      expect(reading.measurementStatus).toBe('LOW_CONFIDENCE');
      expect(reading.heartRate).toBeUndefined();
      expect(reading.signalQuality.isUsable).toBe(false);
    });

    it('FAILURE MODE 13: ROI INSTABILITY - flags MOTION_CONTAMINATED when bbox jitter > 0.15', () => {
      const series = getCleanSeries(75);
      const provider = new RppgSensorProvider();

      const reading = provider.processRgbSeries(series, 'P001', 'B001', 0.05, 0.95, {
        roiInstability: 0.22, // 22% bbox jitter
      });

      expect(reading.measurementStatus).toBe('MOTION_CONTAMINATED');
      expect(reading.heartRate).toBeUndefined();
      expect(reading.signalQuality.isUsable).toBe(false);
      expect(reading.signalQuality.reason).toContain('ROI tracking displacement');
    });

    it('FAILURE MODE 14: OPTICAL SIGNAL DROPOUT (Flatline) - flags LOW_CONFIDENCE', () => {
      // Sensor disconnect flatline (constant values, 0 variance)
      const flatlineSeries = {
        fps: 30,
        timestampsMs: Array.from({ length: 300 }, (_, i) => i * 33),
        r: Array(300).fill(128.0),
        g: Array(300).fill(128.0),
        b: Array(300).fill(128.0),
      };

      const provider = new RppgSensorProvider();
      const reading = provider.processRgbSeries(flatlineSeries, 'P001', 'B001', 0.0, 0.95);

      expect(reading.measurementStatus).toBe('LOW_CONFIDENCE');
      expect(reading.heartRate).toBeUndefined();
      expect(reading.signalQuality.isUsable).toBe(false);
      expect(reading.signalQuality.reason).toContain('flatline');
    });

    it('FAILURE MODE 15: PHYSIOLOGICAL IMPLAUSIBILITY - flags PHYSIOLOGICALLY_IMPLAUSIBLE', () => {
      // Generate synthetic signal with implausibly fast frequency (240 BPM = 4.0 Hz, exceeding biological max 210)
      const implausibleSeries = generateSyntheticRgbSeries({
        fps: 30,
        durationSeconds: 10,
        targetHeartRateBpm: 240, // Implausibly fast
        randomSeed: 240,
      }).series;

      const provider = new RppgSensorProvider();
      const reading = provider.processRgbSeries(implausibleSeries, 'P001', 'B001', 0.05, 0.95);

      expect(reading.measurementStatus).toBe('PHYSIOLOGICALLY_IMPLAUSIBLE');
      expect(reading.heartRate).toBeUndefined();
      expect(reading.signalQuality.isUsable).toBe(false);
      expect(reading.signalQuality.reason).toContain('biological limits');
    });
  });

  describe('2. Behavioral States Exhaustive Verification (7 States)', () => {
    const provider = new RppgSensorProvider();
    const cleanSeries = getCleanSeries(74);

    it('State 1: VALID - produces genuine vitals with high confidence and isUsable=true', () => {
      const reading = provider.processRgbSeries(cleanSeries, 'P001', 'B001', 0.02, 0.95);

      expect(reading.measurementStatus).toBe('VALID');
      expect(reading.signalQuality.isUsable).toBe(true);
      expect(reading.confidence).toBeGreaterThanOrEqual(0.60);
      expect(reading.heartRate).toBeDefined();
      expect(Math.abs(reading.heartRate! - 74)).toBeLessThanOrEqual(2.0);
    });

    it('State 2: LOW_CONFIDENCE - withholds vitals when confidence below threshold', () => {
      const reading = provider.processRgbSeries(cleanSeries, 'P001', 'B001', 0.05, 0.95, {
        frameDropRate: 0.30,
      });

      expect(reading.measurementStatus).toBe('LOW_CONFIDENCE');
      expect(reading.heartRate).toBeUndefined();
      expect(reading.signalQuality.isUsable).toBe(false);
    });

    it('State 3: CALIBRATING - withholds vitals while collecting buffer frames', () => {
      // Ingest single frame into provider buffer
      const singleRoi: VideoFrameRoi = {
        frameIndex: 1,
        timestampMs: 1000,
        boundingBox: [0.3, 0.2, 0.4, 0.3],
        meanR: 170,
        meanG: 130,
        meanB: 100,
        pixelCount: 4000,
        skinFraction: 0.85,
        faceDetected: true,
        illuminationLux: 240,
      };

      const reading = provider.pushFrameRoi(singleRoi, 'PAT-CALIB', 'B001', 30);
      expect(reading).not.toBeNull();
      expect(reading.measurementStatus).toBe('CALIBRATING');
      expect(reading.heartRate).toBeUndefined();
      expect(reading.signalQuality.isUsable).toBe(false);
      expect(reading.signalQuality.reason).toContain('calibration');
    });

    it('State 4: MOTION_CONTAMINATED - identifies gross movement', () => {
      const reading = provider.processRgbSeries(cleanSeries, 'P001', 'B001', 0.60, 0.95, {
        motionMagnitude: 0.60,
      });

      expect(reading.measurementStatus).toBe('MOTION_CONTAMINATED');
      expect(reading.heartRate).toBeUndefined();
      expect(reading.signalQuality.isUsable).toBe(false);
    });

    it('State 5: INSUFFICIENT_LIGHT - identifies sub-30 lux darkness', () => {
      const reading = provider.processRgbSeries(cleanSeries, 'P001', 'B001', 0.0, 0.05, {
        illuminationLux: 10,
      });

      expect(reading.measurementStatus).toBe('INSUFFICIENT_LIGHT');
      expect(reading.heartRate).toBeUndefined();
      expect(reading.signalQuality.isUsable).toBe(false);
    });

    it('State 6: NO_FACE - identifies absent subject', () => {
      const reading = provider.processRgbSeries(cleanSeries, 'P001', 'B001', 0.0, 0.95, {
        faceDetected: false,
      });

      expect(reading.measurementStatus).toBe('NO_FACE');
      expect(reading.heartRate).toBeUndefined();
      expect(reading.signalQuality.isUsable).toBe(false);
    });

    it('State 7: PHYSIOLOGICALLY_IMPLAUSIBLE - identifies non-biological pulse rate', () => {
      // Non-biological frequency: 240 bpm (4.0 Hz, well outside 42-210 bpm physiological range)
      const implausibleSeries = generateSyntheticRgbSeries({
        fps: 30,
        durationSeconds: 12,
        targetHeartRateBpm: 240,
        randomSeed: 240,
      }).series;

      const reading = provider.processRgbSeries(implausibleSeries, 'P001', 'B001', 0.0, 0.95);

      expect(reading.measurementStatus).toBe('PHYSIOLOGICALLY_IMPLAUSIBLE');
      expect(reading.heartRate).toBeUndefined();
      expect(reading.signalQuality.isUsable).toBe(false);
    });
  });

  describe('3. Anti-Fabrication Invariant: The system must NEVER produce apparently trustworthy numbers when the signal is unreliable', () => {
    const provider = new RppgSensorProvider();
    const cleanSeries = getCleanSeries(72);

    const testUnreliableScenarios = [
      { name: 'no face', opts: { faceDetected: false } },
      { name: 'occluded face', opts: { skinFraction: 0.2 } },
      { name: 'patient motion', opts: { motionMagnitude: 0.7 } },
      { name: 'talking', opts: { talkingDetected: true } },
      { name: 'head rotation', opts: { headRotationDetected: true } },
      { name: 'insufficient light', opts: { illuminationLux: 12, illuminationScore: 0.03 } },
      { name: 'rapid brightness change', opts: { rapidBrightnessChange: true } },
      { name: 'dropped frames', opts: { frameDropRate: 0.4 } },
      { name: 'roi instability', opts: { roiInstability: 0.3 } },
      { name: 'camera disconnected', opts: { cameraDisconnected: true } },
      { name: 'permission denied', opts: { permissionDenied: true } },
    ];

    for (const scenario of testUnreliableScenarios) {
      it(`ZERO-FABRICATION GUARANTEE under [${scenario.name}]`, () => {
        const reading = provider.processRgbSeries(cleanSeries, 'P-SAFETY', 'B-SAFETY', 0.05, 0.95, scenario.opts);

        // Invariant: heartRate must NEVER be defined as a number
        expect(reading.heartRate).toBeUndefined();
        // Invariant: respiratoryRate must NEVER be defined as a number
        expect(reading.respiratoryRate).toBeUndefined();
        // Invariant: signalQuality.isUsable MUST be false
        expect(reading.signalQuality.isUsable).toBe(false);
        // Invariant: confidence must be suppressed (< 0.30)
        expect(reading.confidence).toBeLessThan(0.30);
        // Invariant: measurementStatus must NOT be VALID
        expect(reading.measurementStatus).not.toBe('VALID');
      });
    }
  });

  describe('4. Recovery Pathways Verification', () => {
    it('RECOVERY 1: Camera Reconnect (disconnect -> reconnect -> calibrating -> valid)', () => {
      const provider = new RppgSensorProvider();

      // 1. Camera disconnects
      const disconnected = provider.handleCameraDisconnect('P-REC-1');
      expect(disconnected.measurementStatus).toBe('LOW_CONFIDENCE');
      expect(disconnected.signalQuality.reason).toContain('disconnected');
      expect(disconnected.heartRate).toBeUndefined();

      // 2. Camera reconnects -> enters CALIBRATING
      const reconnected = provider.handleCameraReconnect('P-REC-1');
      expect(reconnected.measurementStatus).toBe('CALIBRATING');
      expect(reconnected.heartRate).toBeUndefined();
      expect(reconnected.signalQuality.isUsable).toBe(false);

      // 3. Signal stabilizes and accumulates buffer -> enters VALID
      const clean = getCleanSeries(80);
      const valid = provider.processRgbSeries(clean, 'P-REC-1', 'B001', 0.02, 0.95);
      expect(valid.measurementStatus).toBe('VALID');
      expect(valid.signalQuality.isUsable).toBe(true);
      expect(Math.abs(valid.heartRate! - 80)).toBeLessThanOrEqual(2.0);
    });

    it('RECOVERY 2: Face Reappears (face lost -> face reacquired -> calibrating -> valid)', () => {
      const provider = new RppgSensorProvider();

      // 1. Face lost
      const lost = provider.handleFaceLost('P-REC-2');
      expect(lost.measurementStatus).toBe('NO_FACE');
      expect(lost.signalQuality.faceDetected).toBe(false);
      expect(lost.heartRate).toBeUndefined();

      // 2. Face reacquired -> enters CALIBRATING
      const reacquired = provider.handleFaceReacquired('P-REC-2');
      expect(reacquired.measurementStatus).toBe('CALIBRATING');
      expect(reacquired.heartRate).toBeUndefined();

      // 3. Tracking settles -> enters VALID
      const clean = getCleanSeries(68);
      const valid = provider.processRgbSeries(clean, 'P-REC-2', 'B001', 0.02, 0.95);
      expect(valid.measurementStatus).toBe('VALID');
      expect(valid.heartRate).toBeDefined();
      expect(Math.abs(valid.heartRate! - 68)).toBeLessThanOrEqual(2.0);
    });

    it('RECOVERY 3: Lighting Restored (darkness -> lighting restored -> calibrating -> valid)', () => {
      const provider = new RppgSensorProvider();
      const clean = getCleanSeries(75);

      // 1. Dark room (< 30 lux)
      const dark = provider.processRgbSeries(clean, 'P-REC-3', 'B001', 0.0, 0.02, {
        illuminationLux: 8,
      });
      expect(dark.measurementStatus).toBe('INSUFFICIENT_LIGHT');
      expect(dark.heartRate).toBeUndefined();

      // 2. Nurse turns on lamp -> lighting restored -> CALIBRATING
      const restored = provider.handleLightingRestored('P-REC-3');
      expect(restored.measurementStatus).toBe('CALIBRATING');
      expect(restored.heartRate).toBeUndefined();

      // 3. Photons reflect stably -> VALID
      const valid = provider.processRgbSeries(clean, 'P-REC-3', 'B001', 0.02, 0.95, {
        illuminationLux: 220,
      });
      expect(valid.measurementStatus).toBe('VALID');
      expect(valid.heartRate).toBeDefined();
    });

    it('RECOVERY 4: Patient Motion Ceased (moving -> motion ceased -> calibrating -> valid)', () => {
      const provider = new RppgSensorProvider();
      const clean = getCleanSeries(88);

      // 1. Patient coughing / tossing in bed
      const moving = provider.processRgbSeries(clean, 'P-REC-4', 'B001', 0.65, 0.95, {
        motionMagnitude: 0.65,
      });
      expect(moving.measurementStatus).toBe('MOTION_CONTAMINATED');
      expect(moving.heartRate).toBeUndefined();

      // 2. Patient rests still -> motion ceased -> CALIBRATING
      const calm = provider.handleMotionCeased('P-REC-4');
      expect(calm.measurementStatus).toBe('CALIBRATING');
      expect(calm.heartRate).toBeUndefined();

      // 3. Baseline settles -> VALID
      const valid = provider.processRgbSeries(clean, 'P-REC-4', 'B001', 0.02, 0.95);
      expect(valid.measurementStatus).toBe('VALID');
      expect(valid.heartRate).toBeDefined();
      expect(Math.abs(valid.heartRate! - 88)).toBeLessThanOrEqual(2.0);
    });
  });
});
