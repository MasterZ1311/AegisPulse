import { describe, it, expect } from 'vitest';
import {
  HeartRateMeasurementSchema,
  RespiratoryRateMeasurementSchema,
  SystolicBPMeasurementSchema,
  DiastolicBPMeasurementSchema,
  BloodPressurePairSchema,
  BodyTemperatureMeasurementSchema,
  OxygenSaturationMeasurementSchema,
  HRVRMSSDMeasurementSchema,
  ShockIndexMeasurementSchema,
  SignalQualitySchema,
  PHYSIOLOGICAL_LIMITS,
  validateVitalMeasurement,
} from '../src/index';

describe('Physiological Vitals Validation Suite', () => {
  const validTimestamp = Date.now();
  const validProvenance = {
    derivedAt: validTimestamp,
    algorithm: 'SHOCK_INDEX_DERIVER',
    algorithmVersion: '1.0.0',
    sourceObservationIds: ['obs-hr-01', 'obs-sys-01'],
    confidence: 0.98,
  };

  describe('1. Heart Rate Validation', () => {
    it('accepts valid physiological heart rates', () => {
      const valid = HeartRateMeasurementSchema.safeParse({
        id: 'hr-1',
        type: 'HEART_RATE',
        unit: 'BPM',
        value: 72,
        timestamp: validTimestamp,
        source: 'BEDSIDE_DEVICE',
        confidence: 0.95,
        qualityStatus: 'TRUSTED',
      });
      expect(valid.success).toBe(true);
    });

    it('rejects heart rates below minimum bound (20 BPM)', () => {
      const low = HeartRateMeasurementSchema.safeParse({
        id: 'hr-low',
        type: 'HEART_RATE',
        unit: 'BPM',
        value: 19,
        timestamp: validTimestamp,
        source: 'BEDSIDE_DEVICE',
        confidence: 0.95,
        qualityStatus: 'TRUSTED',
      });
      expect(low.success).toBe(false);
      if (!low.success) {
        expect(low.error.issues[0].message).toContain(`cannot be below ${PHYSIOLOGICAL_LIMITS.HEART_RATE.min}`);
      }
    });

    it('rejects heart rates above maximum bound (300 BPM)', () => {
      const high = HeartRateMeasurementSchema.safeParse({
        id: 'hr-high',
        type: 'HEART_RATE',
        unit: 'BPM',
        value: 301,
        timestamp: validTimestamp,
        source: 'BEDSIDE_DEVICE',
        confidence: 0.95,
        qualityStatus: 'TRUSTED',
      });
      expect(high.success).toBe(false);
      if (!high.success) {
        expect(high.error.issues[0].message).toContain(`cannot exceed ${PHYSIOLOGICAL_LIMITS.HEART_RATE.max}`);
      }
    });

    it('accepts boundary limits (20 and 300 BPM)', () => {
      const min = HeartRateMeasurementSchema.safeParse({
        id: 'hr-min',
        type: 'HEART_RATE',
        unit: 'BPM',
        value: 20,
        timestamp: validTimestamp,
        source: 'BEDSIDE_DEVICE',
        confidence: 0.95,
        qualityStatus: 'TRUSTED',
      });
      const max = HeartRateMeasurementSchema.safeParse({
        id: 'hr-max',
        type: 'HEART_RATE',
        unit: 'BPM',
        value: 300,
        timestamp: validTimestamp,
        source: 'BEDSIDE_DEVICE',
        confidence: 0.95,
        qualityStatus: 'TRUSTED',
      });
      expect(min.success).toBe(true);
      expect(max.success).toBe(true);
    });
  });

  describe('2. Respiratory Rate Validation', () => {
    it('accepts valid respiratory rates within 4 to 80 breaths/min', () => {
      const res = RespiratoryRateMeasurementSchema.safeParse({
        id: 'rr-1',
        type: 'RESPIRATORY_RATE',
        unit: 'BREATHS_PER_MINUTE',
        value: 18,
        timestamp: validTimestamp,
        source: 'OPTICAL_RPPG',
        confidence: 0.88,
        qualityStatus: 'TRUSTED',
      });
      expect(res.success).toBe(true);
    });

    it('rejects respiratory rates < 4 or > 80', () => {
      const tooLow = RespiratoryRateMeasurementSchema.safeParse({
        id: 'rr-low',
        type: 'RESPIRATORY_RATE',
        unit: 'BREATHS_PER_MINUTE',
        value: 3,
        timestamp: validTimestamp,
        source: 'OPTICAL_RPPG',
        confidence: 0.88,
        qualityStatus: 'TRUSTED',
      });
      const tooHigh = RespiratoryRateMeasurementSchema.safeParse({
        id: 'rr-high',
        type: 'RESPIRATORY_RATE',
        unit: 'BREATHS_PER_MINUTE',
        value: 81,
        timestamp: validTimestamp,
        source: 'OPTICAL_RPPG',
        confidence: 0.88,
        qualityStatus: 'TRUSTED',
      });
      expect(tooLow.success).toBe(false);
      expect(tooHigh.success).toBe(false);
    });
  });

  describe('3. Blood Pressure Validation', () => {
    it('accepts valid systolic and diastolic blood pressures', () => {
      const sys = SystolicBPMeasurementSchema.safeParse({
        id: 'sys-1',
        type: 'SYSTOLIC_BP',
        unit: 'MMHG',
        value: 120,
        timestamp: validTimestamp,
        source: 'BEDSIDE_DEVICE',
        confidence: 0.99,
        qualityStatus: 'TRUSTED',
      });
      const dia = DiastolicBPMeasurementSchema.safeParse({
        id: 'dia-1',
        type: 'DIASTOLIC_BP',
        unit: 'MMHG',
        value: 80,
        timestamp: validTimestamp,
        source: 'BEDSIDE_DEVICE',
        confidence: 0.99,
        qualityStatus: 'TRUSTED',
      });
      expect(sys.success).toBe(true);
      expect(dia.success).toBe(true);
    });

    it('rejects non-integer blood pressures', () => {
      const floatBP = SystolicBPMeasurementSchema.safeParse({
        id: 'sys-float',
        type: 'SYSTOLIC_BP',
        unit: 'MMHG',
        value: 120.4,
        timestamp: validTimestamp,
        source: 'BEDSIDE_DEVICE',
        confidence: 0.99,
        qualityStatus: 'TRUSTED',
      });
      expect(floatBP.success).toBe(false);
    });

    it('rejects out of bound blood pressures', () => {
      const sysLow = SystolicBPMeasurementSchema.safeParse({
        id: 'sys-low',
        type: 'SYSTOLIC_BP',
        unit: 'MMHG',
        value: 29,
        timestamp: validTimestamp,
        source: 'BEDSIDE_DEVICE',
        confidence: 0.99,
        qualityStatus: 'TRUSTED',
      });
      const diaHigh = DiastolicBPMeasurementSchema.safeParse({
        id: 'dia-high',
        type: 'DIASTOLIC_BP',
        unit: 'MMHG',
        value: 201,
        timestamp: validTimestamp,
        source: 'BEDSIDE_DEVICE',
        confidence: 0.99,
        qualityStatus: 'TRUSTED',
      });
      expect(sysLow.success).toBe(false);
      expect(diaHigh.success).toBe(false);
    });

    it('enforces positive pulse pressure (Systolic >= Diastolic + 5)', () => {
      const validPair = BloodPressurePairSchema.safeParse({
        systolic: {
          id: 'sys-p',
          type: 'SYSTOLIC_BP',
          unit: 'MMHG',
          value: 110,
          timestamp: validTimestamp,
          source: 'BEDSIDE_DEVICE',
          confidence: 0.95,
          qualityStatus: 'TRUSTED',
        },
        diastolic: {
          id: 'dia-p',
          type: 'DIASTOLIC_BP',
          unit: 'MMHG',
          value: 70,
          timestamp: validTimestamp,
          source: 'BEDSIDE_DEVICE',
          confidence: 0.95,
          qualityStatus: 'TRUSTED',
        },
      });
      expect(validPair.success).toBe(true);

      const invalidNarrowPulse = BloodPressurePairSchema.safeParse({
        systolic: {
          id: 'sys-narrow',
          type: 'SYSTOLIC_BP',
          unit: 'MMHG',
          value: 82,
          timestamp: validTimestamp,
          source: 'BEDSIDE_DEVICE',
          confidence: 0.95,
          qualityStatus: 'TRUSTED',
        },
        diastolic: {
          id: 'dia-narrow',
          type: 'DIASTOLIC_BP',
          unit: 'MMHG',
          value: 80,
          timestamp: validTimestamp,
          source: 'BEDSIDE_DEVICE',
          confidence: 0.95,
          qualityStatus: 'TRUSTED',
        },
      });
      expect(invalidNarrowPulse.success).toBe(false);
    });
  });

  describe('4. Body Temperature Validation', () => {
    it('accepts temperatures between 25.0°C and 45.0°C', () => {
      const normal = BodyTemperatureMeasurementSchema.safeParse({
        id: 'temp-1',
        type: 'BODY_TEMPERATURE',
        unit: 'CELSIUS',
        value: 36.8,
        timestamp: validTimestamp,
        source: 'NURSE_MANUAL',
        confidence: 1.0,
        qualityStatus: 'TRUSTED',
        site: 'TYMPANIC',
      });
      expect(normal.success).toBe(true);
    });

    it('rejects extreme temperatures', () => {
      const hypothermiaExtreme = BodyTemperatureMeasurementSchema.safeParse({
        id: 'temp-low',
        type: 'BODY_TEMPERATURE',
        unit: 'CELSIUS',
        value: 24.9,
        timestamp: validTimestamp,
        source: 'NURSE_MANUAL',
        confidence: 1.0,
        qualityStatus: 'TRUSTED',
      });
      const hyperpyrexiaExtreme = BodyTemperatureMeasurementSchema.safeParse({
        id: 'temp-high',
        type: 'BODY_TEMPERATURE',
        unit: 'CELSIUS',
        value: 45.1,
        timestamp: validTimestamp,
        source: 'NURSE_MANUAL',
        confidence: 1.0,
        qualityStatus: 'TRUSTED',
      });
      expect(hypothermiaExtreme.success).toBe(false);
      expect(hyperpyrexiaExtreme.success).toBe(false);
    });
  });

  describe('5. Oxygen Saturation (SpO2) Safety Constraints', () => {
    it('accepts SpO2 from contact pulse oximeter or nurse entry', () => {
      const validSpO2 = OxygenSaturationMeasurementSchema.safeParse({
        id: 'spo2-1',
        type: 'OXYGEN_SATURATION',
        unit: 'PERCENT',
        value: 97,
        timestamp: validTimestamp,
        source: 'BEDSIDE_DEVICE',
        confidence: 0.98,
        qualityStatus: 'TRUSTED',
      });
      expect(validSpO2.success).toBe(true);
    });

    it('STRICT SAFETY INVARIANT: Rejects SpO2 sourced from OPTICAL_RPPG', () => {
      const rppgSpO2 = OxygenSaturationMeasurementSchema.safeParse({
        id: 'spo2-rppg',
        type: 'OXYGEN_SATURATION',
        unit: 'PERCENT',
        value: 98,
        timestamp: validTimestamp,
        source: 'OPTICAL_RPPG',
        confidence: 0.95,
        qualityStatus: 'TRUSTED',
      });
      expect(rppgSpO2.success).toBe(false);
      if (!rppgSpO2.success) {
        expect(rppgSpO2.error.issues[0].message).toContain('SAFETY VIOLATION');
      }
    });

    it('rejects out of bounds SpO2 (< 50% or > 100%)', () => {
      const low = OxygenSaturationMeasurementSchema.safeParse({
        id: 'spo2-low',
        type: 'OXYGEN_SATURATION',
        unit: 'PERCENT',
        value: 49,
        timestamp: validTimestamp,
        source: 'BEDSIDE_DEVICE',
        confidence: 0.9,
        qualityStatus: 'TRUSTED',
      });
      const high = OxygenSaturationMeasurementSchema.safeParse({
        id: 'spo2-high',
        type: 'OXYGEN_SATURATION',
        unit: 'PERCENT',
        value: 101,
        timestamp: validTimestamp,
        source: 'BEDSIDE_DEVICE',
        confidence: 0.9,
        qualityStatus: 'TRUSTED',
      });
      expect(low.success).toBe(false);
      expect(high.success).toBe(false);
    });
  });

  describe('6. HRV RMSSD Validation', () => {
    it('accepts valid HRV values', () => {
      const hrv = HRVRMSSDMeasurementSchema.safeParse({
        id: 'hrv-1',
        type: 'HRV_RMSSD',
        unit: 'MILLISECONDS',
        value: 45.2,
        timestamp: validTimestamp,
        source: 'OPTICAL_RPPG',
        confidence: 0.85,
        qualityStatus: 'TRUSTED',
      });
      expect(hrv.success).toBe(true);
    });

    it('rejects negative HRV or HRV > 500 ms', () => {
      const negative = HRVRMSSDMeasurementSchema.safeParse({
        id: 'hrv-neg',
        type: 'HRV_RMSSD',
        unit: 'MILLISECONDS',
        value: -1,
        timestamp: validTimestamp,
        source: 'OPTICAL_RPPG',
        confidence: 0.85,
        qualityStatus: 'TRUSTED',
      });
      const excessive = HRVRMSSDMeasurementSchema.safeParse({
        id: 'hrv-high',
        type: 'HRV_RMSSD',
        unit: 'MILLISECONDS',
        value: 501,
        timestamp: validTimestamp,
        source: 'OPTICAL_RPPG',
        confidence: 0.85,
        qualityStatus: 'TRUSTED',
      });
      expect(negative.success).toBe(false);
      expect(excessive.success).toBe(false);
    });
  });

  describe('7. Shock Index and Mandatory Provenance', () => {
    it('accepts valid Shock Index with complete Provenance', () => {
      const si = ShockIndexMeasurementSchema.safeParse({
        id: 'si-1',
        type: 'SHOCK_INDEX',
        unit: 'RATIO',
        value: 0.85,
        timestamp: validTimestamp,
        source: 'DERIVED',
        confidence: 0.98,
        qualityStatus: 'TRUSTED',
        provenance: validProvenance,
      });
      expect(si.success).toBe(true);
    });

    it('REJECTS Shock Index when Provenance is missing', () => {
      const siMissing = ShockIndexMeasurementSchema.safeParse({
        id: 'si-no-prov',
        type: 'SHOCK_INDEX',
        unit: 'RATIO',
        value: 0.85,
        timestamp: validTimestamp,
        source: 'DERIVED',
        confidence: 0.98,
        qualityStatus: 'TRUSTED',
      });
      expect(siMissing.success).toBe(false);
    });

    it('rejects Shock Index outside [0.1, 5.0]', () => {
      const tooLow = ShockIndexMeasurementSchema.safeParse({
        id: 'si-low',
        type: 'SHOCK_INDEX',
        unit: 'RATIO',
        value: 0.05,
        timestamp: validTimestamp,
        source: 'DERIVED',
        confidence: 0.98,
        qualityStatus: 'TRUSTED',
        provenance: validProvenance,
      });
      const tooHigh = ShockIndexMeasurementSchema.safeParse({
        id: 'si-high',
        type: 'SHOCK_INDEX',
        unit: 'RATIO',
        value: 5.1,
        timestamp: validTimestamp,
        source: 'DERIVED',
        confidence: 0.98,
        qualityStatus: 'TRUSTED',
        provenance: validProvenance,
      });
      expect(tooLow.success).toBe(false);
      expect(tooHigh.success).toBe(false);
    });
  });

  describe('8. Signal Quality (SQI) Telemetry', () => {
    it('validates compliant SQI packet', () => {
      const sqi = SignalQualitySchema.safeParse({
        sqiPercentage: 88,
        snrDb: 7.4,
        illuminationLux: 350,
        motionArtifactIndex: 0.12,
        state: 'TRUSTED',
        isUsable: true,
        faceDetected: true,
      });
      expect(sqi.success).toBe(true);
    });

    it('rejects SQI percentage > 100 or < 0', () => {
      const invalidPercent = SignalQualitySchema.safeParse({
        sqiPercentage: 105,
        snrDb: 7.4,
        illuminationLux: 350,
        motionArtifactIndex: 0.12,
        state: 'TRUSTED',
        isUsable: true,
        faceDetected: true,
      });
      expect(invalidPercent.success).toBe(false);
    });
  });

  describe('9. Discriminated Union Resolver', () => {
    it('safely parses via validateVitalMeasurement union', () => {
      const res = validateVitalMeasurement({
        id: 'hr-discrim',
        type: 'HEART_RATE',
        unit: 'BPM',
        value: 84,
        timestamp: validTimestamp,
        source: 'BEDSIDE_DEVICE',
        confidence: 0.95,
        qualityStatus: 'TRUSTED',
      });
      expect(res.success).toBe(true);
    });

    it('rejects mismatched unit in discriminated union', () => {
      const res = validateVitalMeasurement({
        id: 'hr-mismatch',
        type: 'HEART_RATE',
        unit: 'MMHG', // Invalid unit for HR
        value: 84,
        timestamp: validTimestamp,
        source: 'BEDSIDE_DEVICE',
        confidence: 0.95,
        qualityStatus: 'TRUSTED',
      });
      expect(res.success).toBe(false);
    });
  });
});
