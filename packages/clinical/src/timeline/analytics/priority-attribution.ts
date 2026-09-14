import type {
  UnifiedTimelineEvent,
  PriorityRiseAttributionResponse,
  PriorityAttributionFactor,
  AttentionPriorityCategory,
} from '@aegispulse/types';

export function analyzePriorityRise(
  events: UnifiedTimelineEvent[],
  patientId: string,
  evaluationWindowHours: number = 4,
  referenceTimestamp: number = Date.now()
): PriorityRiseAttributionResponse {
  const windowMs = evaluationWindowHours * 60 * 60 * 1000;
  const startTime = referenceTimestamp - windowMs;

  const windowEvents = events.filter(
    (ev) => ev.timestamp >= startTime && ev.timestamp <= referenceTimestamp
  );

  // 1. Identify APS score trajectory
  const apsEvents = windowEvents.filter((ev) => ev.eventType === 'APS_CHANGE');
  let baselineApsScore = 15;
  let currentApsScore = 15;
  let baselineCategory: AttentionPriorityCategory = 'LOW';
  let currentCategory: AttentionPriorityCategory = 'LOW';

  if (apsEvents.length > 0) {
    const first = apsEvents[0];
    const last = apsEvents[apsEvents.length - 1];
    baselineApsScore = (first.data?.previousScore ?? first.data?.score ?? 15) as number;
    currentApsScore = (last.data?.currentScore ?? last.data?.score ?? baselineApsScore) as number;
    baselineCategory = (first.data?.previousCategory ?? first.data?.category ?? 'LOW') as AttentionPriorityCategory;
    currentCategory = (last.data?.currentCategory ?? last.data?.category ?? baselineCategory) as AttentionPriorityCategory;
  } else {
    // If no explicit APS_CHANGE event, inspect latest event metadata or MEWS
    const mewsEvents = windowEvents.filter((ev) => ev.eventType === 'MEWS_CHANGE');
    if (mewsEvents.length > 0) {
      const lastMews = mewsEvents[mewsEvents.length - 1];
      const mewsScore = (lastMews.data?.score ?? 0) as number;
      if (mewsScore >= 5) {
        currentApsScore = 75;
        currentCategory = 'CRITICAL_REVIEW';
      } else if (mewsScore >= 3) {
        currentApsScore = 50;
        currentCategory = 'EVALUATE';
      }
    }
  }

  const scoreDelta = Math.max(0, currentApsScore - baselineApsScore);

  // 2. Identify contributing factors and trigger events
  const contributingFactors: PriorityAttributionFactor[] = [];
  const triggerEvents: UnifiedTimelineEvent[] = [];

  // 2.1 Check for Respiratory Rate escalation
  const rrEvents = windowEvents.filter(
    (ev) => ev.eventType === 'VITAL_MEASUREMENT' && ev.data?.vitalType === 'RESPIRATORY_RATE'
  );
  if (rrEvents.length >= 2) {
    const startRR = rrEvents[0].data!.value as number;
    const endRR = rrEvents[rrEvents.length - 1].data!.value as number;
    if (endRR > startRR && endRR >= 22) {
      const pts = Math.min(35, Math.round((endRR - startRR) * 3));
      contributingFactors.push({
        factor: 'RESPIRATORY_VELOCITY_SURGE',
        category: 'PHYSIOLOGICAL_VELOCITY',
        pointsContribution: pts,
        percentageOfRise: scoreDelta > 0 ? Math.min(100, Math.round((pts / scoreDelta) * 100)) : 40,
        clinicalExplanation: `Respiratory rate increased from ${startRR} to ${endRR} breaths/min (+${Math.round(((endRR - startRR) / startRR) * 100)}%), triggering tachypnea warning.`,
        triggerValue: endRR,
        referenceValue: startRR,
      });
      triggerEvents.push(rrEvents[rrEvents.length - 1]);
    }
  }

  // 2.2 Check for Heart Rate tachycardia / velocity
  const hrEvents = windowEvents.filter(
    (ev) => ev.eventType === 'VITAL_MEASUREMENT' && ev.data?.vitalType === 'HEART_RATE'
  );
  if (hrEvents.length >= 2) {
    const startHR = hrEvents[0].data!.value as number;
    const endHR = hrEvents[hrEvents.length - 1].data!.value as number;
    if (endHR > startHR && endHR >= 100) {
      const pts = Math.min(25, Math.round((endHR - startHR) * 1.5));
      contributingFactors.push({
        factor: 'TACHYCARDIA_VELOCITY',
        category: 'PHYSIOLOGICAL_VELOCITY',
        pointsContribution: pts,
        percentageOfRise: scoreDelta > 0 ? Math.min(100, Math.round((pts / scoreDelta) * 100)) : 30,
        clinicalExplanation: `Heart rate climbed from ${startHR} to ${endHR} bpm, deviating significantly above baseline envelope.`,
        triggerValue: endHR,
        referenceValue: startHR,
      });
      triggerEvents.push(hrEvents[hrEvents.length - 1]);
    }
  }

  // 2.3 Check for MEWS escalation
  const mewsEvents = windowEvents.filter((ev) => ev.eventType === 'MEWS_CHANGE');
  if (mewsEvents.length > 0) {
    const latestMews = mewsEvents[mewsEvents.length - 1];
    const score = (latestMews.data?.score ?? 0) as number;
    if (score >= 3) {
      const pts = score >= 5 ? 30 : 15;
      contributingFactors.push({
        factor: 'MEWS_ESCALATION',
        category: 'CLINICAL_EARLY_WARNING',
        pointsContribution: pts,
        percentageOfRise: scoreDelta > 0 ? Math.min(100, Math.round((pts / scoreDelta) * 100)) : 35,
        clinicalExplanation: `MEWS score escalated to ${score}/14 (${latestMews.data?.triageLevel ?? 'ALERT'}). Triggered clinical outreach protocol.`,
        triggerValue: score,
        referenceValue: latestMews.data?.previousScore ?? 0,
      });
      triggerEvents.push(latestMews);
    }
  }

  // 2.4 Check for qSOFA Sepsis criteria
  const qsofaEvents = windowEvents.filter((ev) => ev.eventType === 'QSOFA_CHANGE');
  if (qsofaEvents.length > 0) {
    const latestQsofa = qsofaEvents[qsofaEvents.length - 1];
    if (latestQsofa.data?.isPositive) {
      const pts = 25;
      contributingFactors.push({
        factor: 'QSOFA_POSITIVE_SCREEN',
        category: 'SEPSIS_SURVEILLANCE',
        pointsContribution: pts,
        percentageOfRise: scoreDelta > 0 ? Math.min(100, Math.round((pts / scoreDelta) * 100)) : 30,
        clinicalExplanation: `qSOFA criteria positive (${latestQsofa.data?.score ?? 2}/3) indicating high risk of sepsis organ failure.`,
        triggerValue: latestQsofa.data?.score,
      });
      triggerEvents.push(latestQsofa);
    }
  }

  // 2.5 Check for Critical Labs (e.g. Lactate)
  const labEvents = windowEvents.filter((ev) => ev.eventType === 'LAB_RESULT');
  for (const lab of labEvents) {
    const testName = (lab.data?.testName ?? lab.title) as string;
    const value = lab.data?.value;
    if (testName.toLowerCase().includes('lactate') && typeof value === 'number' && value >= 2.0) {
      const pts = value >= 4.0 ? 30 : 15;
      contributingFactors.push({
        factor: 'CRITICAL_LACTATE',
        category: 'BIOMARKER_CRITICAL',
        pointsContribution: pts,
        percentageOfRise: scoreDelta > 0 ? Math.min(100, Math.round((pts / scoreDelta) * 100)) : 25,
        clinicalExplanation: `Venous lactate resulted at ${value} mmol/L indicating anaerobic cellular hypoperfusion.`,
        triggerValue: value,
        referenceValue: 2.0,
      });
      triggerEvents.push(lab);
    }
  }

  // Fallback if no specific factors triggered but score rose
  if (contributingFactors.length === 0) {
    if (scoreDelta > 0) {
      contributingFactors.push({
        factor: 'MULTISYSTEM_DRIFT',
        category: 'PHYSIOLOGICAL_ABNORMALITY',
        pointsContribution: scoreDelta,
        percentageOfRise: 100,
        clinicalExplanation: `Composite physiological drift across vital parameters increased attention score by +${scoreDelta} points.`,
      });
    } else {
      contributingFactors.push({
        factor: 'PHYSIOLOGICAL_STABILITY',
        category: 'STABLE_BASELINE',
        pointsContribution: 0,
        percentageOfRise: 0,
        clinicalExplanation: 'Patient priority has remained stable with no acute escalation in the evaluation window.',
      });
    }
  }

  // Sort factors by points contribution descending
  contributingFactors.sort((a, b) => b.pointsContribution - a.pointsContribution);

  const primaryDriver = scoreDelta > 0 && contributingFactors.length > 0
    ? `Primary rise driver: ${contributingFactors[0].clinicalExplanation}`
    : 'No significant priority rise observed in the evaluation window.';

  return {
    patientId,
    evaluationWindowHours,
    baselineApsScore,
    currentApsScore,
    scoreDelta,
    baselineCategory,
    currentCategory,
    primaryDriver,
    contributingFactors,
    triggerEvents,
    timestamp: referenceTimestamp,
  };
}
