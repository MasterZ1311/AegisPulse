import type {
  UnifiedTimelineEvent,
  TimelineWindowChangesResponse,
  VitalDeltaSummary,
  ScoreTransitionSummary,
} from '@aegispulse/types';

export function analyzeWindowChanges(
  events: UnifiedTimelineEvent[],
  patientId: string,
  windowHours: number = 4,
  referenceTimestamp: number = Date.now()
): TimelineWindowChangesResponse {
  const windowMs = windowHours * 60 * 60 * 1000;
  const startTime = referenceTimestamp - windowMs;
  const endTime = referenceTimestamp;

  const windowEvents = events.filter(
    (ev) => ev.timestamp >= startTime && ev.timestamp <= endTime
  );

  // 1. Vital Deltas
  const vitalsByType = new Map<string, { first: UnifiedTimelineEvent; last: UnifiedTimelineEvent }>();
  for (const ev of windowEvents) {
    if (ev.eventType === 'VITAL_MEASUREMENT' && ev.data?.vitalType && typeof ev.data?.value === 'number') {
      const vt = ev.data.vitalType as string;
      if (!vitalsByType.has(vt)) {
        vitalsByType.set(vt, { first: ev, last: ev });
      } else {
        vitalsByType.get(vt)!.last = ev;
      }
    }
  }

  const vitalDeltas: VitalDeltaSummary[] = [];
  for (const [vt, pair] of vitalsByType.entries()) {
    const startVal = pair.first.data!.value as number;
    const endVal = pair.last.data!.value as number;
    const absChange = Number((endVal - startVal).toFixed(2));
    const pctChange = startVal !== 0 ? Number((((endVal - startVal) / startVal) * 100).toFixed(1)) : 0;
    const unit = (pair.last.data!.unit as any) || 'UNKNOWN';

    let trend: 'RISING' | 'FALLING' | 'STABLE' = 'STABLE';
    if (absChange > 0.05 * Math.abs(startVal || 1)) {
      trend = 'RISING';
    } else if (absChange < -0.05 * Math.abs(startVal || 1)) {
      trend = 'FALLING';
    }

    vitalDeltas.push({
      vitalType: vt as any,
      startValue: startVal,
      endValue: endVal,
      absoluteChange: absChange,
      percentChange: pctChange,
      unit,
      trend,
    });
  }

  // 2. Score Transitions (APS, MEWS, QSOFA)
  const scoreTransitions: ScoreTransitionSummary[] = [];
  const scoreEvents = {
    APS: windowEvents.filter((ev) => ev.eventType === 'APS_CHANGE'),
    MEWS: windowEvents.filter((ev) => ev.eventType === 'MEWS_CHANGE'),
    QSOFA: windowEvents.filter((ev) => ev.eventType === 'QSOFA_CHANGE'),
  };

  for (const [scoreName, evs] of Object.entries(scoreEvents)) {
    if (evs.length > 0) {
      const first = evs[0];
      const last = evs[evs.length - 1];
      const startScore = (first.data?.score ?? first.data?.previousScore ?? 0) as number;
      const endScore = (last.data?.score ?? last.data?.currentScore ?? 0) as number;
      const scoreDelta = endScore - startScore;

      scoreTransitions.push({
        scoreName: scoreName as any,
        startScore,
        endScore,
        scoreDelta,
        startCategoryOrLevel: (first.data?.category ?? first.data?.triageLevel) as string | undefined,
        endCategoryOrLevel: (last.data?.category ?? last.data?.triageLevel) as string | undefined,
        escalated: scoreDelta > 0,
      });
    }
  }

  // 3. New Labs, Signal Quality, Actions, Nurse Visits
  const newLabResults = windowEvents
    .filter((ev) => ev.eventType === 'LAB_RESULT')
    .map((ev) => ev.data || { title: ev.title, description: ev.description });

  const signalQualityEvents = windowEvents
    .filter((ev) => ev.eventType === 'SIGNAL_QUALITY_CHANGE')
    .map((ev) => ev.data || { title: ev.title, description: ev.description });

  const actionsRecommended = windowEvents
    .filter((ev) => ev.eventType === 'RECOMMENDED_ACTION')
    .map((ev) => ev.title);

  const actionsCompleted = windowEvents
    .filter((ev) => ev.eventType === 'COMPLETED_ACTION')
    .map((ev) => ev.title);

  const nurseVisitsCount = windowEvents.filter((ev) => ev.eventType === 'NURSE_VISIT').length;

  // 4. Synthesize human-readable narrative summary
  const narrativeParts: string[] = [];
  narrativeParts.push(`Timeline window: past ${windowHours} hours (${windowEvents.length} events recorded).`);

  if (vitalDeltas.length > 0) {
    const notableVitals = vitalDeltas.filter((vd) => Math.abs(vd.percentChange) >= 5);
    if (notableVitals.length > 0) {
      const vitalsText = notableVitals
        .map((vd) => `${vd.vitalType} ${vd.trend.toLowerCase()} by ${Math.abs(vd.percentChange)}% (${vd.startValue} -> ${vd.endValue} ${vd.unit})`)
        .join(', ');
      narrativeParts.push(`Key vital changes: ${vitalsText}.`);
    } else {
      narrativeParts.push('All recorded vital signs remained relatively stable within ±5% deviation.');
    }
  }

  if (scoreTransitions.length > 0) {
    const escalatedScores = scoreTransitions.filter((st) => st.escalated);
    if (escalatedScores.length > 0) {
      const scoreText = escalatedScores
        .map((st) => `${st.scoreName} escalated from ${st.startScore} to ${st.endScore}${st.endCategoryOrLevel ? ` (${st.endCategoryOrLevel})` : ''}`)
        .join(', ');
      narrativeParts.push(`Risk scores increased: ${scoreText}.`);
    }
  }

  if (nurseVisitsCount > 0) {
    narrativeParts.push(`${nurseVisitsCount} nurse bedside visit(s) conducted during this period.`);
  }

  if (newLabResults.length > 0) {
    narrativeParts.push(`${newLabResults.length} new laboratory test(s) resulted.`);
  }

  return {
    patientId,
    windowHours,
    startTime,
    endTime,
    narrativeSummary: narrativeParts.join(' '),
    vitalDeltas,
    scoreTransitions,
    newLabResults,
    signalQualityEvents,
    actionsRecommended,
    actionsCompleted,
    nurseVisitsCount,
    totalEventsInWindow: windowEvents.length,
  };
}
