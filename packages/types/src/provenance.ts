import { z } from 'zod';

/**
 * Timestamp Validation:
 * Must be a positive integer representing epoch milliseconds,
 * after Jan 1, 2020 (1577836800000) and not in the distant future (+60s tolerance for clock drift).
 */
export const TimestampSchema = z
  .number()
  .int('Timestamp must be an integer epoch in milliseconds')
  .min(1577836800000, 'Timestamp cannot be prior to year 2020')
  .refine(
    (ts) => ts <= Date.now() + 60000,
    'Timestamp cannot be in the future (exceeds clock drift threshold)'
  );
export type Timestamp = z.infer<typeof TimestampSchema>;

/**
 * Target / Deadline Timestamp Validation:
 * For future deadlines, scheduled actions, or expected completion times.
 * Must be a positive integer representing epoch milliseconds >= Jan 1, 2020.
 */
export const TargetTimestampSchema = z
  .number()
  .int('Target timestamp must be an integer epoch in milliseconds')
  .min(1577836800000, 'Target timestamp cannot be prior to year 2020');
export type TargetTimestamp = z.infer<typeof TargetTimestampSchema>;

/**
 * Provenance Schema:
 * Required on every derived clinical metric to guarantee total mathematical and clinical auditability.
 */
export const ProvenanceSchema = z.object({
  derivedAt: TimestampSchema,
  algorithm: z.string().min(1, 'Algorithm identifier is required'),
  algorithmVersion: z.string().min(1, 'Algorithm version is required'),
  sourceObservationIds: z
    .array(z.string().min(1, 'Observation ID cannot be empty'))
    .min(1, 'Derived value must reference at least one source observation ID'),
  confidence: z
    .number()
    .min(0.0, 'Confidence cannot be negative')
    .max(1.0, 'Confidence cannot exceed 1.0'),
  operatorId: z.string().optional(),
  parameters: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])).optional(),
});
export type Provenance = z.infer<typeof ProvenanceSchema>;
