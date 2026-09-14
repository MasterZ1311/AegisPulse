import { z } from 'zod';

// ============================================================================
// Epistemic Risk & Observation Freshness Categories
// ============================================================================
export const EpistemicRiskCategoryEnum = z.enum([
  'FRESH',               // Recent trusted reading well within monitoring interval
  'MONITORING_DUE',      // Approaching expected monitoring interval threshold
  'STALE',               // Exceeded monitoring interval; uncertainty increasing
  'CRITICALLY_EXPIRED',  // Prolonged absence of trusted vitals; epistemic blindspot
]);
export type EpistemicRiskCategory = z.infer<typeof EpistemicRiskCategoryEnum>;

// ============================================================================
// Information Freshness & Uncertainty Schema
// Strictly separates physiological deterioration from epistemic uncertainty
// ============================================================================
export const InformationFreshnessSchema = z.object({
  // Observation Tracking Timestamps (epoch milliseconds)
  lastTrustedTimestamp: z.number().int().nonnegative().optional(),
  lastManualTimestamp: z.number().int().nonnegative().optional(),
  lastCameraTimestamp: z.number().int().nonnegative().optional(),

  // Observation Age & Intervals
  observationAgeMinutes: z.number().min(0, 'Observation age cannot be negative'),
  confidence: z
    .number()
    .min(0.0, 'Confidence must be at least 0.0')
    .max(1.0, 'Confidence cannot exceed 1.0'),
  expectedMonitoringIntervalMinutes: z
    .number()
    .min(1, 'Expected monitoring interval must be at least 1 minute'),
  isIntervalExceeded: z.boolean(),

  // Calculated Freshness & Uncertainty Metrics
  freshnessScore: z
    .number()
    .min(0, 'Freshness score must be >= 0')
    .max(100, 'Freshness score cannot exceed 100'),
  uncertaintyIndex: z
    .number()
    .min(0.0, 'Uncertainty index must be >= 0.0')
    .max(1.0, 'Uncertainty index cannot exceed 1.0'),
  decayScore: z
    .number()
    .min(0, 'Decay score must be >= 0')
    .max(100, 'Decay score cannot exceed 100'),
  epistemicRiskCategory: EpistemicRiskCategoryEnum,

  // Explicit Decoupling: Physiological Abnormality vs Epistemic Uncertainty
  physiologicalRiskVsUncertainty: z.object({
    physiologicalScore: z.number().min(0).max(100),
    uncertaintyScore: z.number().min(0).max(100),
    compoundedScore: z.number().min(0).max(100),
    couplingMultiplier: z.number().min(1.0),
    explanation: z.string(),
  }),

  // State Description
  stateDescription: z.string().min(1),
});

export type InformationFreshness = z.infer<typeof InformationFreshnessSchema>;

export const validateInformationFreshness = (data: unknown) =>
  InformationFreshnessSchema.safeParse(data);
