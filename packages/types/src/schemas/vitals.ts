import { z } from 'zod';
import {
  VitalTypeEnum,
  VitalUnitEnum,
  ObservationSourceEnum,
  QualityStatusEnum,
} from '../enums';
import { TimestampSchema, ProvenanceSchema } from '../provenance';

// ============================================================================
// Physiological Sanity Limits
// Any value outside these ranges is clinically impossible or immediate artifact
// ============================================================================
export const PHYSIOLOGICAL_LIMITS = {
  HEART_RATE: { min: 20, max: 300, unit: 'BPM' as const },
  RESPIRATORY_RATE: { min: 4, max: 80, unit: 'BREATHS_PER_MINUTE' as const },
  SYSTOLIC_BP: { min: 30, max: 300, unit: 'MMHG' as const },
  DIASTOLIC_BP: { min: 20, max: 200, unit: 'MMHG' as const },
  BODY_TEMPERATURE: { min: 25.0, max: 45.0, unit: 'CELSIUS' as const },
  OXYGEN_SATURATION: { min: 50, max: 100, unit: 'PERCENT' as const },
  HRV_RMSSD: { min: 0, max: 500, unit: 'MILLISECONDS' as const },
  SHOCK_INDEX: { min: 0.1, max: 5.0, unit: 'RATIO' as const },
} as const;

// Base schema shared by every physiological measurement
const BaseVitalMeasurementSchema = z.object({
  id: z.string().min(1, 'Measurement ID is required'),
  timestamp: TimestampSchema,
  source: ObservationSourceEnum,
  confidence: z
    .number()
    .min(0.0, 'Confidence must be at least 0.0')
    .max(1.0, 'Confidence cannot exceed 1.0'),
  qualityStatus: QualityStatusEnum,
  deviceModel: z.string().optional(),
  operatorNotes: z.string().optional(),
});

// 1. Heart Rate (BPM)
export const HeartRateMeasurementSchema = BaseVitalMeasurementSchema.extend({
  type: z.literal(VitalTypeEnum.enum.HEART_RATE),
  unit: z.literal(VitalUnitEnum.enum.BPM),
  value: z
    .number()
    .min(
      PHYSIOLOGICAL_LIMITS.HEART_RATE.min,
      `Heart rate cannot be below ${PHYSIOLOGICAL_LIMITS.HEART_RATE.min} BPM`
    )
    .max(
      PHYSIOLOGICAL_LIMITS.HEART_RATE.max,
      `Heart rate cannot exceed ${PHYSIOLOGICAL_LIMITS.HEART_RATE.max} BPM`
    ),
  provenance: ProvenanceSchema.optional(),
});
export type HeartRateMeasurement = z.infer<typeof HeartRateMeasurementSchema>;

// 2. Respiratory Rate (/min)
export const RespiratoryRateMeasurementSchema = BaseVitalMeasurementSchema.extend({
  type: z.literal(VitalTypeEnum.enum.RESPIRATORY_RATE),
  unit: z.literal(VitalUnitEnum.enum.BREATHS_PER_MINUTE),
  value: z
    .number()
    .min(
      PHYSIOLOGICAL_LIMITS.RESPIRATORY_RATE.min,
      `Respiratory rate cannot be below ${PHYSIOLOGICAL_LIMITS.RESPIRATORY_RATE.min} breaths/min`
    )
    .max(
      PHYSIOLOGICAL_LIMITS.RESPIRATORY_RATE.max,
      `Respiratory rate cannot exceed ${PHYSIOLOGICAL_LIMITS.RESPIRATORY_RATE.max} breaths/min`
    ),
  provenance: ProvenanceSchema.optional(),
});
export type RespiratoryRateMeasurement = z.infer<typeof RespiratoryRateMeasurementSchema>;

// 3. Systolic Blood Pressure (mmHg)
export const SystolicBPMeasurementSchema = BaseVitalMeasurementSchema.extend({
  type: z.literal(VitalTypeEnum.enum.SYSTOLIC_BP),
  unit: z.literal(VitalUnitEnum.enum.MMHG),
  value: z
    .number()
    .int('Blood pressure must be an integer')
    .min(
      PHYSIOLOGICAL_LIMITS.SYSTOLIC_BP.min,
      `Systolic BP cannot be below ${PHYSIOLOGICAL_LIMITS.SYSTOLIC_BP.min} mmHg`
    )
    .max(
      PHYSIOLOGICAL_LIMITS.SYSTOLIC_BP.max,
      `Systolic BP cannot exceed ${PHYSIOLOGICAL_LIMITS.SYSTOLIC_BP.max} mmHg`
    ),
  provenance: ProvenanceSchema.optional(),
});
export type SystolicBPMeasurement = z.infer<typeof SystolicBPMeasurementSchema>;

// 4. Diastolic Blood Pressure (mmHg)
export const DiastolicBPMeasurementSchema = BaseVitalMeasurementSchema.extend({
  type: z.literal(VitalTypeEnum.enum.DIASTOLIC_BP),
  unit: z.literal(VitalUnitEnum.enum.MMHG),
  value: z
    .number()
    .int('Blood pressure must be an integer')
    .min(
      PHYSIOLOGICAL_LIMITS.DIASTOLIC_BP.min,
      `Diastolic BP cannot be below ${PHYSIOLOGICAL_LIMITS.DIASTOLIC_BP.min} mmHg`
    )
    .max(
      PHYSIOLOGICAL_LIMITS.DIASTOLIC_BP.max,
      `Diastolic BP cannot exceed ${PHYSIOLOGICAL_LIMITS.DIASTOLIC_BP.max} mmHg`
    ),
  provenance: ProvenanceSchema.optional(),
});
export type DiastolicBPMeasurement = z.infer<typeof DiastolicBPMeasurementSchema>;

// 5. Dual Blood Pressure Pair (Systolic + Diastolic verified together)
export const BloodPressurePairSchema = z
  .object({
    systolic: SystolicBPMeasurementSchema,
    diastolic: DiastolicBPMeasurementSchema,
  })
  .refine(
    (bp) => bp.systolic.value >= bp.diastolic.value + 5,
    'Systolic BP must exceed Diastolic BP by at least 5 mmHg (positive pulse pressure required)'
  );
export type BloodPressurePair = z.infer<typeof BloodPressurePairSchema>;

// 6. Body Temperature (°C)
export const BodyTemperatureMeasurementSchema = BaseVitalMeasurementSchema.extend({
  type: z.literal(VitalTypeEnum.enum.BODY_TEMPERATURE),
  unit: z.literal(VitalUnitEnum.enum.CELSIUS),
  value: z
    .number()
    .min(
      PHYSIOLOGICAL_LIMITS.BODY_TEMPERATURE.min,
      `Body temperature cannot be below ${PHYSIOLOGICAL_LIMITS.BODY_TEMPERATURE.min}°C`
    )
    .max(
      PHYSIOLOGICAL_LIMITS.BODY_TEMPERATURE.max,
      `Body temperature cannot exceed ${PHYSIOLOGICAL_LIMITS.BODY_TEMPERATURE.max}°C`
    ),
  site: z.enum(['AXILLARY', 'ORAL', 'TYMPANIC', 'RECTAL', 'CORE']).optional(),
  provenance: ProvenanceSchema.optional(),
});
export type BodyTemperatureMeasurement = z.infer<typeof BodyTemperatureMeasurementSchema>;

// 7. Oxygen Saturation (SpO2 %) - STRICT INVARIANT: Cannot originate from OPTICAL_RPPG
export const OxygenSaturationMeasurementSchema = BaseVitalMeasurementSchema.extend({
  type: z.literal(VitalTypeEnum.enum.OXYGEN_SATURATION),
  unit: z.literal(VitalUnitEnum.enum.PERCENT),
  value: z
    .number()
    .min(
      PHYSIOLOGICAL_LIMITS.OXYGEN_SATURATION.min,
      `SpO2 cannot be below ${PHYSIOLOGICAL_LIMITS.OXYGEN_SATURATION.min}%`
    )
    .max(
      PHYSIOLOGICAL_LIMITS.OXYGEN_SATURATION.max,
      `SpO2 cannot exceed ${PHYSIOLOGICAL_LIMITS.OXYGEN_SATURATION.max}%`
    ),
  provenance: ProvenanceSchema.optional(),
}).refine(
  (obs) => obs.source !== ObservationSourceEnum.enum.OPTICAL_RPPG,
  'SAFETY VIOLATION: SpO2 cannot be measured via optical camera rPPG. Must originate from contact pulse oximetry or manual nurse verification.'
);
export type OxygenSaturationMeasurement = z.infer<typeof OxygenSaturationMeasurementSchema>;

// 8. HRV (RMSSD in milliseconds)
export const HRVRMSSDMeasurementSchema = BaseVitalMeasurementSchema.extend({
  type: z.literal(VitalTypeEnum.enum.HRV_RMSSD),
  unit: z.literal(VitalUnitEnum.enum.MILLISECONDS),
  value: z
    .number()
    .min(PHYSIOLOGICAL_LIMITS.HRV_RMSSD.min, 'RMSSD cannot be negative')
    .max(
      PHYSIOLOGICAL_LIMITS.HRV_RMSSD.max,
      `RMSSD cannot exceed ${PHYSIOLOGICAL_LIMITS.HRV_RMSSD.max} ms`
    ),
  provenance: ProvenanceSchema.optional(),
});
export type HRVRMSSDMeasurement = z.infer<typeof HRVRMSSDMeasurementSchema>;

// 9. Shock Index (HR / Systolic BP) - STRICT INVARIANT: Always derived, requires Provenance
export const ShockIndexMeasurementSchema = BaseVitalMeasurementSchema.extend({
  type: z.literal(VitalTypeEnum.enum.SHOCK_INDEX),
  unit: z.literal(VitalUnitEnum.enum.RATIO),
  value: z
    .number()
    .min(
      PHYSIOLOGICAL_LIMITS.SHOCK_INDEX.min,
      `Shock index cannot be below ${PHYSIOLOGICAL_LIMITS.SHOCK_INDEX.min}`
    )
    .max(
      PHYSIOLOGICAL_LIMITS.SHOCK_INDEX.max,
      `Shock index cannot exceed ${PHYSIOLOGICAL_LIMITS.SHOCK_INDEX.max}`
    ),
  provenance: ProvenanceSchema, // MANDATORY for derived Shock Index
});
export type ShockIndexMeasurement = z.infer<typeof ShockIndexMeasurementSchema>;

// ============================================================================
// Discriminated Union for any Vital Measurement
// Guarantees that type, unit, and valid limits match perfectly
// ============================================================================
export const VitalMeasurementSchema = z.discriminatedUnion('type', [
  HeartRateMeasurementSchema,
  RespiratoryRateMeasurementSchema,
  SystolicBPMeasurementSchema,
  DiastolicBPMeasurementSchema,
  BodyTemperatureMeasurementSchema,
  OxygenSaturationMeasurementSchema,
  HRVRMSSDMeasurementSchema,
  ShockIndexMeasurementSchema,
]);
export type VitalMeasurement = z.infer<typeof VitalMeasurementSchema>;

// ============================================================================
// Signal Quality Telemetry (SQI)
// ============================================================================
export const SignalQualitySchema = z.object({
  sqiPercentage: z
    .number()
    .min(0, 'SQI percentage must be >= 0')
    .max(100, 'SQI percentage must be <= 100'),
  snrDb: z.number(),
  illuminationLux: z.number().min(0, 'Illumination Lux cannot be negative'),
  motionArtifactIndex: z
    .number()
    .min(0.0, 'Motion artifact index must be >= 0.0')
    .max(1.0, 'Motion artifact index must be <= 1.0'),
  state: QualityStatusEnum,
  isUsable: z.boolean(),
  faceDetected: z.boolean(),
  reason: z.string().optional(),
});
export type SignalQuality = z.infer<typeof SignalQualitySchema>;
