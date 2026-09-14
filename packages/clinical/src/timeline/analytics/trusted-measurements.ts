import type {
  UnifiedTimelineEvent,
  TrustedMeasurementsResponse,
  TrustedMeasurementItem,
} from '@aegispulse/types';

export function analyzeTrustedMeasurements(
  events: UnifiedTimelineEvent[],
  patientId: string,
  filter?: { since?: number; until?: number; vitalType?: string }
): TrustedMeasurementsResponse {
  let relevantEvents = events.filter((ev) => ev.eventType === 'VITAL_MEASUREMENT');

  if (filter?.since !== undefined) {
    relevantEvents = relevantEvents.filter((ev) => ev.timestamp >= filter.since!);
  }
  if (filter?.until !== undefined) {
    relevantEvents = relevantEvents.filter((ev) => ev.timestamp <= filter.until!);
  }
  if (filter?.vitalType) {
    relevantEvents = relevantEvents.filter((ev) => ev.data?.vitalType === filter.vitalType);
  }

  const trustedMeasurements: TrustedMeasurementItem[] = [];
  const untrustedMeasurements: TrustedMeasurementItem[] = [];
  const reasonCountMap = new Map<string, number>();

  for (const ev of relevantEvents) {
    const data = ev.data || {};
    const vitalType = (data.vitalType || 'HEART_RATE') as any;
    const value = (data.value ?? 0) as number;
    const unit = (data.unit || 'BPM') as any;
    const confidence = (data.confidence ?? (ev.isTrusted ? 0.95 : 0.4)) as number;
    const source = (ev.source || 'OPTICAL_RPPG') as any;
    const qualityStatus = (data.qualityStatus || (ev.isTrusted ? 'VALID' : 'DEGRADED')) as string;

    const isTrusted = ev.isTrusted && confidence >= 0.7 && qualityStatus !== 'DEGRADED' && qualityStatus !== 'INVALID';

    let untrustedReason: string | undefined;
    if (!isTrusted) {
      untrustedReason =
        data.untrustedReason ||
        data.suppressionReason ||
        ev.description ||
        (confidence < 0.7
          ? `Signal confidence (${Math.round(confidence * 100)}%) below trusted threshold (70%)`
          : `Sensor quality status is ${qualityStatus}`);

      const reasonKey = untrustedReason || 'Unknown sensor suppression reason';
      reasonCountMap.set(reasonKey, (reasonCountMap.get(reasonKey) ?? 0) + 1);
    }

    const item: TrustedMeasurementItem = {
      observationId: (data.observationId || ev.id) as string,
      timestamp: ev.timestamp,
      vitalType,
      value,
      unit,
      confidence,
      source,
      qualityStatus,
      isTrusted,
      untrustedReason,
    };

    if (isTrusted) {
      trustedMeasurements.push(item);
    } else {
      untrustedMeasurements.push(item);
    }
  }

  const totalMeasurements = trustedMeasurements.length + untrustedMeasurements.length;
  const trustPercentage = totalMeasurements > 0
    ? Number(((trustedMeasurements.length / totalMeasurements) * 100).toFixed(1))
    : 100;

  const commonSuppressionReasons = Array.from(reasonCountMap.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);

  return {
    patientId,
    totalMeasurements,
    trustedCount: trustedMeasurements.length,
    untrustedCount: untrustedMeasurements.length,
    trustPercentage,
    trustedMeasurements,
    untrustedMeasurements,
    commonSuppressionReasons,
  };
}
