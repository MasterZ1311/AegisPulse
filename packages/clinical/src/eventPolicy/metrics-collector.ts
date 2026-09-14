import type {
  AttentionPolicyEvent,
  PolicyMetrics,
  PriorityChangeClassification,
  SuppressionReason,
} from '@aegispulse/types';

/**
 * Quantitative Metrics Collector for Attention Policy Evaluation.
 * Measures alert counts, duplicate alarms, escalation delays, false alarms,
 * and suppression ratios to empirically prove alarm fatigue reduction.
 */
export class PolicyMetricsCollector {
  private events: AttentionPolicyEvent[] = [];
  private candidateStartTimes = new Map<string, number>();
  private escalationDelays: number[] = [];
  private falseEscalationCount = 0;

  /**
   * Ingests a policy event emitted by AttentionEventPolicyEngine.
   */
  public record(event: AttentionPolicyEvent, isKnownTransientSpike = false): void {
    this.events.push(event);

    // Track first candidate observation for escalation delay calculation
    if (event.action === 'HOLD_UNCONFIRMED' && event.classification === 'UNCONFIRMED') {
      if (!this.candidateStartTimes.has(event.patientId)) {
        this.candidateStartTimes.set(event.patientId, event.timestamp);
      }
    }

    // When alert confirms or escalates, measure delay
    if (event.action === 'EMIT_ALERT' || event.action === 'ESCALATE') {
      const startTime = this.candidateStartTimes.get(event.patientId);
      if (startTime !== undefined) {
        const delay = Math.max(0, event.timestamp - startTime);
        this.escalationDelays.push(delay);
        this.candidateStartTimes.delete(event.patientId);
      } else {
        // Fast-path instant escalation (0 delay)
        this.escalationDelays.push(0);
      }

      // If this alert fired on a scenario marked as a transient spike, flag as false escalation
      if (isKnownTransientSpike) {
        this.falseEscalationCount += 1;
      }
    }

    // Clear candidate tracker on resolution or cancellation
    if (event.action === 'RESOLVE' || (event.classification === 'PERSISTENT_PRIORITY' && event.suppressionReason === 'COOLDOWN_ACTIVE')) {
      if (event.currentCategory === 'LOW') {
        this.candidateStartTimes.delete(event.patientId);
      }
    }
  }

  /**
   * Resets collected metrics.
   */
  public reset(): void {
    this.events = [];
    this.candidateStartTimes.clear();
    this.escalationDelays = [];
    this.falseEscalationCount = 0;
  }

  /**
   * Computes comprehensive policy metrics summary.
   */
  public getMetrics(): PolicyMetrics {
    const total = this.events.length;
    if (total === 0) {
      return {
        totalEvaluations: 0,
        alertCount: 0,
        repeatedAlerts: 0,
        suppressedCount: 0,
        falseEscalations: 0,
        confirmedEscalations: 0,
        meanEscalationDelayMs: 0,
        maxEscalationDelayMs: 0,
        suppressionRatio: 0,
        flappingEventsAvoided: 0,
      };
    }

    let alertCount = 0;
    let repeatedAlerts = 0;
    let suppressedCount = 0;
    let confirmedEscalations = 0;
    let flappingEventsAvoided = 0;

    for (const ev of this.events) {
      if (ev.action === 'EMIT_ALERT' || ev.action === 'ESCALATE') {
        alertCount += 1;
        if (ev.classification === 'PERSISTENT_PRIORITY') {
          repeatedAlerts += 1;
        } else {
          confirmedEscalations += 1;
        }
      }

      if (ev.action === 'SUPPRESS' || ev.action === 'HOLD_UNCONFIRMED') {
        suppressedCount += 1;
      }

      if (ev.suppressionReason === 'HYSTERESIS_HOLD') {
        flappingEventsAvoided += 1;
      }
    }

    const sumDelay = this.escalationDelays.reduce((a, b) => a + b, 0);
    const meanEscalationDelayMs =
      this.escalationDelays.length > 0
        ? Math.round(sumDelay / this.escalationDelays.length)
        : 0;
    const maxEscalationDelayMs =
      this.escalationDelays.length > 0
        ? Math.max(...this.escalationDelays)
        : 0;

    const suppressionRatio = Number((suppressedCount / total).toFixed(4));

    return {
      totalEvaluations: total,
      alertCount,
      repeatedAlerts,
      suppressedCount,
      falseEscalations: this.falseEscalationCount,
      confirmedEscalations,
      meanEscalationDelayMs,
      maxEscalationDelayMs,
      suppressionRatio,
      flappingEventsAvoided,
    };
  }

  /**
   * Generates classification breakdown counts.
   */
  public getClassificationBreakdown(): Record<PriorityChangeClassification, number> {
    const counts: Record<PriorityChangeClassification, number> = {
      NEW_PRIORITY: 0,
      RISING_PRIORITY: 0,
      PERSISTENT_PRIORITY: 0,
      RESOLVED: 0,
      UNCONFIRMED: 0,
      SIGNAL_FAILURE: 0,
    };

    for (const ev of this.events) {
      counts[ev.classification] = (counts[ev.classification] ?? 0) + 1;
    }
    return counts;
  }

  /**
   * Generates suppression reason breakdown counts.
   */
  public getSuppressionBreakdown(): Record<SuppressionReason, number> {
    const counts: Record<SuppressionReason, number> = {
      HYSTERESIS_HOLD: 0,
      PERSISTENCE_PENDING: 0,
      COOLDOWN_ACTIVE: 0,
      ACKNOWLEDGED_SILENT: 0,
      DUPLICATE_DEDUPED: 0,
      SIGNAL_UNRELIABLE: 0,
    };

    for (const ev of this.events) {
      if (ev.suppressionReason) {
        counts[ev.suppressionReason] = (counts[ev.suppressionReason] ?? 0) + 1;
      }
    }
    return counts;
  }
}
