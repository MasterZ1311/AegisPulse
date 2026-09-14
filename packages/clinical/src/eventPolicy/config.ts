import type { AttentionPriorityCategory, AlertSeverity } from '@aegispulse/types';

/**
 * Event Policy Engine Configuration
 * Controls hysteresis margins, persistence windows, escalation fast-paths,
 * duplicate suppression, cooldowns, and re-alert intervals.
 */
export interface EventPolicyConfig {
  /**
   * Hysteresis delta (in score points).
   * Downward de-escalation requires: score < (threshold - hysteresisMargin).
   * Default: 6 points.
   */
  hysteresisMargin: number;

  /**
   * Minimum duration (in milliseconds) a candidate higher score must persist
   * continuously before an escalation alert is confirmed.
   * Default: 45,000 ms (45 seconds).
   */
  persistenceWindowMs: number;

  /**
   * Minimum duration (in milliseconds) a recovering patient must continuously
   * remain below the lower hysteresis threshold before de-escalation/resolution confirms.
   * Default: 120,000 ms (120 seconds).
   */
  deEscalationWindowMs: number;

  /**
   * Minimum cooldown period (in milliseconds) between audible/visual notifications
   * of the same priority tier for a single patient.
   * Default: 180,000 ms (3 minutes).
   */
  cooldownPeriodMs: number;

  /**
   * Time window (in milliseconds) during which identical alerts (same category/reasons)
   * are deduplicated into active alert history rather than firing new notifications.
   * Default: 300,000 ms (5 minutes).
   */
  duplicateSuppressionWindowMs: number;

  /**
   * Interval (in milliseconds) for periodic unacknowledged persistent alert reminders.
   * Default: 900,000 ms (15 minutes).
   */
  reAlertIntervalMs: number;

  /**
   * Grace period duration (in milliseconds) following staff acknowledgement.
   * Silences non-escalating alerts unless higher severity transition occurs.
   * Default: 900,000 ms (15 minutes).
   */
  acknowledgementGracePeriodMs: number;

  /**
   * Score threshold for instant clinical fast-path bypass (zero persistence delay).
   * Acute life-threat scores jump straight to confirmed alert.
   * Default: 85.
   */
  fastPathMinScore: number;

  /**
   * Score increase delta within the same category required to trigger RISING_PRIORITY.
   * Default: 15 points.
   */
  risingPriorityMinDelta: number;

  /**
   * Minimum optical/sensor signal confidence below which events are classified
   * as SIGNAL_FAILURE rather than physiological collapse.
   * Default: 0.35 (35%).
   */
  signalFailureConfidenceThreshold: number;

  /**
   * Standard category entry thresholds.
   */
  categoryThresholds: {
    lowMax: number;
    watchMax: number;
    evaluateMax: number;
    criticalMin: number;
  };
}

export const DEFAULT_EVENT_POLICY_CONFIG: EventPolicyConfig = {
  hysteresisMargin: 6,
  persistenceWindowMs: 45_000,
  deEscalationWindowMs: 120_000,
  cooldownPeriodMs: 180_000,
  duplicateSuppressionWindowMs: 300_000,
  reAlertIntervalMs: 900_000,
  acknowledgementGracePeriodMs: 900_000,
  fastPathMinScore: 85,
  risingPriorityMinDelta: 15,
  signalFailureConfidenceThreshold: 0.35,
  categoryThresholds: {
    lowMax: 29,
    watchMax: 54,
    evaluateMax: 74,
    criticalMin: 75,
  },
};

/**
 * Maps category to numerical tier (0 = LOW, 1 = WATCH, 2 = EVALUATE, 3 = CRITICAL_REVIEW).
 */
export function categoryToTier(category: AttentionPriorityCategory): number {
  switch (category) {
    case 'LOW':
      return 0;
    case 'WATCH':
      return 1;
    case 'EVALUATE':
      return 2;
    case 'CRITICAL_REVIEW':
      return 3;
    default:
      return 0;
  }
}

/**
 * Maps numerical tier to category.
 */
export function tierToCategory(tier: number): AttentionPriorityCategory {
  if (tier >= 3) return 'CRITICAL_REVIEW';
  if (tier === 2) return 'EVALUATE';
  if (tier === 1) return 'WATCH';
  return 'LOW';
}

/**
 * Maps category to appropriate AlertSeverity.
 */
export function categoryToSeverity(category: AttentionPriorityCategory): AlertSeverity {
  switch (category) {
    case 'CRITICAL_REVIEW':
      return 'CRITICAL';
    case 'EVALUATE':
      return 'WARNING';
    case 'WATCH':
      return 'WARNING';
    case 'LOW':
    default:
      return 'INFO';
  }
}

/**
 * Returns entry threshold for a category.
 */
export function getCategoryEntryThreshold(
  category: AttentionPriorityCategory,
  config: EventPolicyConfig
): number {
  switch (category) {
    case 'CRITICAL_REVIEW':
      return config.categoryThresholds.criticalMin; // 75
    case 'EVALUATE':
      return config.categoryThresholds.watchMax + 1; // 55
    case 'WATCH':
      return config.categoryThresholds.lowMax + 1; // 30
    case 'LOW':
    default:
      return 0;
  }
}

/**
 * Returns lower hysteresis threshold for a category.
 * Below this threshold, patient is eligible for de-escalation.
 */
export function getCategoryLowerHysteresisThreshold(
  category: AttentionPriorityCategory,
  config: EventPolicyConfig
): number {
  const entry = getCategoryEntryThreshold(category, config);
  return Math.max(0, entry - config.hysteresisMargin);
}

/**
 * Resolves raw score into category based on entry thresholds.
 */
export function scoreToCategory(
  score: number,
  config: EventPolicyConfig
): AttentionPriorityCategory {
  if (score >= config.categoryThresholds.criticalMin) {
    return 'CRITICAL_REVIEW';
  }
  if (score > config.categoryThresholds.watchMax) {
    return 'EVALUATE';
  }
  if (score > config.categoryThresholds.lowMax) {
    return 'WATCH';
  }
  return 'LOW';
}
