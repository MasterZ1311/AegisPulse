import type {
  AttentionPriorityResult,
  PatientStateInput,
} from '../attentionPriority/types';
import { extractVitalsFromObservations } from '../attentionPriority/vital-extractor';
import type { Reason, ReasonContribution } from './types';

/**
 * Deterministically generates all candidate reasons supported by the underlying patient state.
 * Grounding Guarantee: Every generated reason references actual measurements and observations.
 */
export function generateCandidateReasons(
  state: PatientStateInput,
  apsResult: AttentionPriorityResult
): Reason[] {
  const now = state.currentTimestamp ?? Date.now();
  const reasons: Reason[] = [];
  const patientId = state.patientId;

  // Extract vitals and history
  const { latest, history, lastTrustedTimestamp, overallSignalConfidence, observationIds } =
    extractVitalsFromObservations(state.observations, now);

  const effectiveLastTrusted =
    state.lastTrustedObservationTimestamp ?? lastTrustedTimestamp;

  // Helper to construct Reason
  let reasonCounter = 1;
  const createReason = (
    category: Reason['category'],
    severity: Reason['severity'],
    explanation: string,
    evidence: Reason['evidence'],
    calculation: Reason['provenance']['calculation'],
    contributionWeight: number,
    scoreImpact: number
  ): Reason => {
    const activeScore = Math.max(1, apsResult.score);
    const percentageOfTotal = Math.min(100, Math.round((scoreImpact / activeScore) * 100));

    const contribution: ReasonContribution = {
      normalizedWeight: Number(contributionWeight.toFixed(2)),
      scoreImpact: Math.round(scoreImpact),
      percentageOfTotal,
    };

    return {
      id: `RSN-${patientId}-${now}-${reasonCounter++}`,
      patientId,
      category,
      severity,
      evidence,
      contribution,
      timestamp: now,
      humanReadableExplanation: explanation,
      provenance: {
        patientId,
        sourceObservationIds:
          evidence.observationIds.length > 0 ? evidence.observationIds : observationIds,
        calculation,
        derivedAt: now,
      },
    };
  };

  // ==========================================================================
  // 1. Physiological Velocity Reasons (Rate of Change over Window)
  // ==========================================================================
  // Heart Rate Velocity
  if (latest.HEART_RATE && history.HEART_RATE && history.HEART_RATE.length >= 2) {
    const hrHistory = history.HEART_RATE;
    const currentHR = latest.HEART_RATE;
    // Look back over the last 60 minutes
    const windowCutoff = now - 60 * 60 * 1000;
    const recent = hrHistory.filter((r) => r.timestamp >= windowCutoff);

    if (recent.length >= 2) {
      const oldest = recent[0];
      const timeWindowMinutes = Math.max(
        1,
        Math.round((currentHR.timestamp - oldest.timestamp) / 60000)
      );
      const diffHR = currentHR.value - oldest.value;

      // Check change from baseline if specified, else from window start
      const baselineHR = state.baseline?.heartRate;
      let pctChange: number;
      let referenceVal: number;
      let explanationText: string;

      if (baselineHR && baselineHR > 0 && currentHR.value > baselineHR) {
        pctChange = Math.round(((currentHR.value - baselineHR) / baselineHR) * 100);
        referenceVal = baselineHR;
        explanationText = `Heart rate increased ${pctChange}% from baseline over ${timeWindowMinutes} minutes.`;
      } else {
        pctChange = Math.round((diffHR / oldest.value) * 100);
        referenceVal = oldest.value;
        explanationText = `Heart rate increased ${pctChange}% over ${timeWindowMinutes} minutes.`;
      }

      if (pctChange >= 15 && diffHR >= 8) {
        const severity = pctChange >= 35 ? 'CRITICAL' : pctChange >= 25 ? 'HIGH' : 'MEDIUM';
        reasons.push(
          createReason(
            'PHYSIOLOGICAL_VELOCITY',
            severity,
            explanationText,
            {
              vitalType: 'HEART_RATE',
              currentValue: currentHR.value,
              referenceValue: referenceVal,
              unit: 'BPM',
              timeWindowMinutes,
              changePercentage: pctChange,
              observationIds: [oldest.sourceObservationId, currentHR.sourceObservationId],
              measuredAt: currentHR.timestamp,
            },
            {
              algorithm: 'HEART_RATE_VELOCITY_CALCULATOR',
              formula: 'pct = ((current - baseline) / baseline) * 100',
              inputs: {
                current: currentHR.value,
                reference: referenceVal,
                timeWindowMinutes,
              },
            },
            0.30,
            apsResult.rankInputs.velocity.weightedContribution +
              apsResult.rankInputs.baselineDeviation.weightedContribution
          )
        );
      }
    }
  }

  // ==========================================================================
  // 2. Sustained Abnormality / Persistence Reasons
  // ==========================================================================
  // Respiratory Rate Sustained Increase / Tachypnea
  if (latest.RESPIRATORY_RATE && history.RESPIRATORY_RATE && history.RESPIRATORY_RATE.length >= 2) {
    const rrHistory = history.RESPIRATORY_RATE;
    const currentRR = latest.RESPIRATORY_RATE;

    // Check continuous increase or sustained tachypnea (>= 20/min)
    let continuousIncreaseOnset = currentRR.timestamp;
    for (let i = rrHistory.length - 1; i >= 1; i--) {
      if (rrHistory[i].value >= rrHistory[i - 1].value) {
        continuousIncreaseOnset = rrHistory[i - 1].timestamp;
      } else {
        break;
      }
    }

    const continuousMinutes = Math.max(
      1,
      Math.round((now - continuousIncreaseOnset) / 60000)
    );

    if (continuousMinutes >= 10 && currentRR.value >= 20) {
      const severity = continuousMinutes >= 25 ? 'CRITICAL' : 'HIGH';
      reasons.push(
        createReason(
          'SUSTAINED_ABNORMALITY',
          severity,
          `Respiratory rate has increased continuously for ${continuousMinutes} minutes.`,
          {
            vitalType: 'RESPIRATORY_RATE',
            currentValue: currentRR.value,
            referenceValue: 16,
            unit: 'BREATHS_PER_MINUTE',
            timeWindowMinutes: continuousMinutes,
            observationIds: [currentRR.sourceObservationId],
            measuredAt: currentRR.timestamp,
          },
          {
            algorithm: 'RESPIRATORY_PERSISTENCE_DETECTOR',
            formula: 'duration = currentTimestamp - continuousIncreaseOnset',
            inputs: {
              continuousMinutes,
              currentRR: currentRR.value,
            },
          },
          0.35,
          apsResult.rankInputs.abnormality.weightedContribution + 15
        )
      );
    }
  }

  // ==========================================================================
  // 3. Information Decay Reasons (Time Since Trusted Observation)
  // ==========================================================================
  if (effectiveLastTrusted !== undefined) {
    const elapsedMinutes = Math.max(0, Math.round((now - effectiveLastTrusted) / 60000));

    if (elapsedMinutes >= 60) {
      const hours = Math.floor(elapsedMinutes / 60);
      const minutes = elapsedMinutes % 60;
      const timeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

      const severity =
        elapsedMinutes >= 240 ? 'CRITICAL' : elapsedMinutes >= 180 ? 'HIGH' : 'MEDIUM';

      reasons.push(
        createReason(
          'INFORMATION_DECAY',
          severity,
          `No trusted observation has been recorded for ${timeStr}.`,
          {
            currentValue: elapsedMinutes,
            referenceValue: 120,
            unit: 'MINUTES',
            timeWindowMinutes: elapsedMinutes,
            observationIds: observationIds.slice(0, 3),
            measuredAt: effectiveLastTrusted,
          },
          {
            algorithm: 'INFORMATION_DECAY_CALCULATOR',
            formula: 'elapsed = now - lastTrustedTimestamp',
            inputs: {
              now,
              effectiveLastTrusted,
              elapsedMinutes,
            },
          },
          0.25,
          apsResult.rankInputs.informationDecay.weightedContribution
        )
      );
    }
  }

  // ==========================================================================
  // 4. Signal Confidence / Sensor Suppression Reasons
  // ==========================================================================
  const signalQuality = state.latestSignalQuality;
  const sqi = signalQuality
    ? signalQuality.sqiPercentage
    : overallSignalConfidence;

  if (sqi < 70 || signalQuality?.state === 'DEGRADED' || signalQuality?.state === 'UNRELIABLE') {
    const severity = sqi < 40 || signalQuality?.state === 'UNRELIABLE' ? 'HIGH' : 'MEDIUM';
    reasons.push(
      createReason(
        'SIGNAL_CONFIDENCE',
        severity,
        `Current signal confidence is only ${Math.round(sqi)}%; physiological readings are therefore suppressed.`,
        {
          currentValue: Math.round(sqi),
          referenceValue: 85,
          unit: 'PERCENT',
          observationIds: observationIds.slice(0, 2),
          measuredAt: now,
        },
        {
          algorithm: 'SIGNAL_QUALITY_SUPPRESSION_ANALYZER',
          formula: 'sqi = signalQuality.sqiPercentage',
          inputs: {
            sqi,
            qualityState: signalQuality?.state ?? 'UNKNOWN',
          },
        },
        0.20,
        apsResult.rankInputs.signalConfidence.weightedContribution + 10
      )
    );
  }

  // ==========================================================================
  // 5. Hemodynamic Instability / Shock Index Reasons
  // ==========================================================================
  if (latest.SHOCK_INDEX && latest.SHOCK_INDEX.value >= 0.85) {
    const si = latest.SHOCK_INDEX.value;
    const hrVal = latest.HEART_RATE?.value ?? 0;
    const sbpVal = latest.SYSTOLIC_BP?.value ?? 0;
    const severity = si >= 1.10 ? 'CRITICAL' : si >= 0.95 ? 'HIGH' : 'MEDIUM';

    reasons.push(
      createReason(
        'HEMODYNAMIC_INSTABILITY',
        severity,
        `Shock index elevated to ${si.toFixed(2)} (HR ${hrVal} / SBP ${sbpVal}) indicating occult tissue hypoperfusion.`,
        {
          vitalType: 'SHOCK_INDEX',
          currentValue: si,
          referenceValue: 0.70,
          unit: 'RATIO',
          observationIds: [latest.SHOCK_INDEX.sourceObservationId],
          measuredAt: latest.SHOCK_INDEX.timestamp,
        },
        {
          algorithm: 'SHOCK_INDEX_HEMODYNAMIC_EVALUATOR',
          formula: 'SI = HeartRate / SystolicBP',
          inputs: { hr: hrVal, sbp: sbpVal, si },
        },
        0.35,
        apsResult.rankInputs.abnormality.weightedContribution
      )
    );
  }

  // ==========================================================================
  // 6. Sepsis Risk (qSOFA) Reasons
  // ==========================================================================
  const qsofa = apsResult.rankInputs.qsofa.rawScore;
  if (qsofa >= 1) {
    const criteriaList: string[] = [];
    if ((latest.RESPIRATORY_RATE?.value ?? 0) >= 22) {
      criteriaList.push(`RR ${latest.RESPIRATORY_RATE?.value}/min >= 22`);
    }
    if (latest.SYSTOLIC_BP && latest.SYSTOLIC_BP.value <= 100) {
      criteriaList.push(`SBP ${latest.SYSTOLIC_BP.value} mmHg <= 100`);
    }
    if (state.avpu && state.avpu !== 'A') {
      criteriaList.push(`Altered mentation (AVPU=${state.avpu})`);
    }

    const severity = qsofa >= 2 ? 'CRITICAL' : 'HIGH';
    reasons.push(
      createReason(
        'SEPSIS_RISK',
        severity,
        `qSOFA criteria positive (${qsofa}/3: ${criteriaList.join(', ')}) indicating high sepsis mortality risk.`,
        {
          currentValue: qsofa,
          referenceValue: 2,
          unit: 'SCORE',
          observationIds: observationIds.slice(0, 3),
          measuredAt: now,
        },
        {
          algorithm: 'QSOFA_SEPSIS_EVALUATOR',
          formula: 'sum(RR>=22, SBP<=100, AVPU!=A)',
          inputs: { qsofa, criteriaList },
        },
        0.40,
        apsResult.rankInputs.qsofa.weightedContribution + (qsofa >= 2 ? 30 : 15)
      )
    );
  }

  // ==========================================================================
  // 7. Biomarkers Critical Reasons
  // ==========================================================================
  if (state.labs && state.labs.length > 0) {
    const lactate = state.labs.find((l) => l.testCode === 'LACTATE');
    if (lactate && lactate.value >= 2.0) {
      const severity = lactate.value >= 4.0 ? 'CRITICAL' : 'HIGH';
      reasons.push(
        createReason(
          'BIOMARKER_CRITICAL',
          severity,
          `Serum lactate elevated to ${lactate.value} mmol/L indicating systemic cellular hypoperfusion.`,
          {
            labCode: 'LACTATE',
            currentValue: lactate.value,
            referenceValue: 2.0,
            unit: 'MMOL_PER_L',
            observationIds: [lactate.id],
            measuredAt: lactate.timestamp,
          },
          {
            algorithm: 'LACTATE_BIOMARKER_EVALUATOR',
            formula: 'value >= 2.0 mmol/L',
            inputs: { lactate: lactate.value },
          },
          0.35,
          apsResult.rankInputs.biomarkers.weightedContribution
        )
      );
    }

    const wbc = state.labs.find((l) => l.testCode === 'WBC');
    if (wbc && (wbc.value >= 12.0 || wbc.value <= 4.0)) {
      reasons.push(
        createReason(
          'BIOMARKER_CRITICAL',
          wbc.value >= 20.0 ? 'HIGH' : 'MEDIUM',
          `White blood cell count abnormal at ${wbc.value} x10^9/L indicating systemic inflammatory response.`,
          {
            labCode: 'WBC',
            currentValue: wbc.value,
            referenceValue: 11.0,
            unit: 'X10_9_PER_L',
            observationIds: [wbc.id],
            measuredAt: wbc.timestamp,
          },
          {
            algorithm: 'WBC_LEUKOCYTOSIS_EVALUATOR',
            formula: 'value >= 12.0 || value <= 4.0',
            inputs: { wbc: wbc.value },
          },
          0.20,
          10
        )
      );
    }
  }

  // ==========================================================================
  // 8. Missing Telemetry Reasons
  // ==========================================================================
  const missingVitals: string[] = [];
  if (!latest.SYSTOLIC_BP) missingVitals.push('Blood Pressure');
  if (!latest.RESPIRATORY_RATE) missingVitals.push('Respiratory Rate');

  if (missingVitals.length > 0 && apsResult.rankInputs.missingInfo.normalizedContribution >= 30) {
    reasons.push(
      createReason(
        'MISSING_TELEMETRY',
        'MEDIUM',
        `Incomplete vital sign set: no ${missingVitals.join(', ')} recorded in current shift.`,
        {
          currentValue: missingVitals.length,
          referenceValue: 0,
          unit: 'COUNT',
          observationIds: observationIds.slice(0, 1),
          measuredAt: now,
        },
        {
          algorithm: 'MISSING_TELEMETRY_EVALUATOR',
          formula: 'missing_count = sum(missing_vital_types)',
          inputs: { missingVitals },
        },
        0.15,
        apsResult.rankInputs.missingInfo.weightedContribution
      )
    );
  }

  // ==========================================================================
  // 9. Physiological Stability (Fall-through for completely stable patient)
  // ==========================================================================
  if (reasons.length === 0) {
    reasons.push(
      createReason(
        'PHYSIOLOGICAL_STABILITY',
        'LOW',
        'All physiological parameters are stable and within normal biological limits tracking baseline.',
        {
          currentValue: apsResult.score,
          referenceValue: 29,
          unit: 'APS',
          observationIds: observationIds.slice(0, 2),
          measuredAt: now,
        },
        {
          algorithm: 'PHYSIOLOGICAL_STABILITY_EVALUATOR',
          formula: 'all_parameters_within_envelope',
          inputs: { apsScore: apsResult.score },
        },
        0.0,
        0
      )
    );
  }

  return reasons;
}
