/**
 * @aegispulse/research - Hospital Deterioration Benchmark Suite
 * Benchmarks AegisPulse Attention Priority Scoring (APS) vs standard MEWS and qSOFA.
 * Quantifies lead time before deterioration, sensitivity, and false alarm suppression.
 */

import type { StandardizedDeteriorationCase } from '../datasets/preprocessing/clinical-adapter';
import { AttentionPriorityEngine, calculateMEWS, calculateqSOFA } from '@aegispulse/clinical';

export interface DeteriorationEvaluationReport {
  suiteName: string;
  totalPatientCases: number;
  casesWithDeterioration: number;
  apsMetrics: {
    meanLeadTimeHours: number;
    sensitivityPercent: number;
    specificityPercent: number;
    alarmSuppressionRatePercent: number; // Percentage of non-actionable alarms suppressed vs MEWS
  };
  mewsMetrics: {
    meanLeadTimeHours: number;
    sensitivityPercent: number;
    specificityPercent: number;
  };
  qsofaMetrics: {
    meanLeadTimeHours: number;
    sensitivityPercent: number;
    specificityPercent: number;
  };
}

export class DeteriorationBenchmarkRunner {
  /**
   * Benchmarks APS vs MEWS vs qSOFA across longitudinal hospital cases (MIMIC-IV / eICU)
   */
  public evaluateDeteriorationDetection(
    cases: StandardizedDeteriorationCase[]
  ): DeteriorationEvaluationReport {
    const apsEngine = new AttentionPriorityEngine();
    let casesWithDet = 0;

    const apsLeadTimes: number[] = [];
    const mewsLeadTimes: number[] = [];
    const qsofaLeadTimes: number[] = [];

    let apsTruePositives = 0;
    let apsFalsePositives = 0;
    let apsTrueNegatives = 0;
    let apsFalseNegatives = 0;

    let mewsTruePositives = 0;
    let mewsFalsePositives = 0;
    let mewsTrueNegatives = 0;
    let mewsFalseNegatives = 0;

    let qsofaTruePositives = 0;
    let qsofaFalsePositives = 0;
    let qsofaTrueNegatives = 0;
    let qsofaFalseNegatives = 0;

    let totalMewsAlarms = 0;
    let totalApsCriticalAlarms = 0;

    for (const c of cases) {
      const willDeteriorate = c.groundTruthOutcomes.deteriorationOccurred;
      if (willDeteriorate) casesWithDet++;

      const detTime = c.groundTruthOutcomes.deteriorationTimestampMs || 0;

      let apsTriggered = false;
      let mewsTriggered = false;
      let qsofaTriggered = false;

      let firstApsTriggerTime: number | undefined;
      let firstMewsTriggerTime: number | undefined;
      let firstQsofaTriggerTime: number | undefined;

      const windowHistory: any[] = [];

      for (const obs of c.observationsChronological) {
        windowHistory.push(obs);

        const avpuChar = obs.consciousness?.level === 'ALERT' ? 'A' :
                         obs.consciousness?.level === 'VOICE' ? 'V' :
                         obs.consciousness?.level === 'PAIN' ? 'P' :
                         obs.consciousness?.level === 'UNRESPONSIVE' ? 'U' : undefined;

        // 1. Evaluate MEWS (Threshold >= 5 is standard clinical emergency trigger)
        const mews = calculateMEWS({
          heartRate: obs.heartRate?.value,
          respiratoryRate: obs.respiratoryRate?.value,
          systolicBP: obs.bloodPressure?.systolic,
          temperature: obs.temperature?.value,
          avpu: avpuChar,
        });

        if (mews.totalScore >= 5) {
          totalMewsAlarms++;
          if (!mewsTriggered) {
            mewsTriggered = true;
            firstMewsTriggerTime = obs.timestamp;
          }
        }

        // 2. Evaluate qSOFA (Threshold >= 2 is Sepsis-3 high-risk trigger)
        const qsofa = calculateqSOFA({
          respiratoryRate: obs.respiratoryRate?.value,
          systolicBP: obs.bloodPressure?.systolic,
          avpu: avpuChar,
        });

        if (qsofa.totalScore >= 2) {
          if (!qsofaTriggered) {
            qsofaTriggered = true;
            firstQsofaTriggerTime = obs.timestamp;
          }
        }

        // 3. Evaluate AegisPulse APS (Attention Priority Score >= 65 is CRITICAL_REVIEW)
        const aps = apsEngine.evaluate({
          currentObservation: obs,
          windowHistory: windowHistory.slice(-5),
          clinicalContext: c.clinicalContext,
          currentTimestamp: obs.timestamp,
        });

        if (aps.score >= 65) {
          totalApsCriticalAlarms++;
          if (!apsTriggered) {
            apsTriggered = true;
            firstApsTriggerTime = obs.timestamp;
          }
        }
      }

      // Calculate Lead Times if deterioration occurred
      if (willDeteriorate && detTime > 0) {
        if (firstApsTriggerTime && firstApsTriggerTime <= detTime) {
          apsLeadTimes.push((detTime - firstApsTriggerTime) / (3600 * 1000));
        }
        if (firstMewsTriggerTime && firstMewsTriggerTime <= detTime) {
          mewsLeadTimes.push((detTime - firstMewsTriggerTime) / (3600 * 1000));
        }
        if (firstQsofaTriggerTime && firstQsofaTriggerTime <= detTime) {
          qsofaLeadTimes.push((detTime - firstQsofaTriggerTime) / (3600 * 1000));
        }
      }

      // Confusion matrices
      if (willDeteriorate) {
        if (apsTriggered) apsTruePositives++; else apsFalseNegatives++;
        if (mewsTriggered) mewsTruePositives++; else mewsFalseNegatives++;
        if (qsofaTriggered) qsofaTruePositives++; else qsofaFalseNegatives++;
      } else {
        if (apsTriggered) apsFalsePositives++; else apsTrueNegatives++;
        if (mewsTriggered) mewsFalsePositives++; else mewsTrueNegatives++;
        if (qsofaTriggered) qsofaFalsePositives++; else qsofaTrueNegatives++;
      }
    }

    const meanLeadTimeAps =
      apsLeadTimes.length > 0 ? apsLeadTimes.reduce((a, b) => a + b, 0) / apsLeadTimes.length : 0;
    const meanLeadTimeMews =
      mewsLeadTimes.length > 0 ? mewsLeadTimes.reduce((a, b) => a + b, 0) / mewsLeadTimes.length : 0;
    const meanLeadTimeQsofa =
      qsofaLeadTimes.length > 0 ? qsofaLeadTimes.reduce((a, b) => a + b, 0) / qsofaLeadTimes.length : 0;

    const sensAps =
      casesWithDet > 0 ? Math.round((apsTruePositives / casesWithDet) * 1000) / 10 : 0;
    const specAps =
      cases.length - casesWithDet > 0
        ? Math.round((apsTrueNegatives / (cases.length - casesWithDet)) * 1000) / 10
        : 100;

    const sensMews =
      casesWithDet > 0 ? Math.round((mewsTruePositives / casesWithDet) * 1000) / 10 : 0;
    const specMews =
      cases.length - casesWithDet > 0
        ? Math.round((mewsTrueNegatives / (cases.length - casesWithDet)) * 1000) / 10
        : 100;

    const sensQsofa =
      casesWithDet > 0 ? Math.round((qsofaTruePositives / casesWithDet) * 1000) / 10 : 0;
    const specQsofa =
      cases.length - casesWithDet > 0
        ? Math.round((qsofaTrueNegatives / (cases.length - casesWithDet)) * 1000) / 10
        : 100;

    // Alarm suppression: reduction of alert burden vs standard MEWS
    const alarmSuppression =
      totalMewsAlarms > 0
        ? Math.round((1.0 - totalApsCriticalAlarms / totalMewsAlarms) * 1000) / 10
        : 0;

    return {
      suiteName: 'Hospital-Deterioration-Prediction-Benchmark',
      totalPatientCases: cases.length,
      casesWithDeterioration: casesWithDet,
      apsMetrics: {
        meanLeadTimeHours: Math.round(meanLeadTimeAps * 10) / 10,
        sensitivityPercent: sensAps,
        specificityPercent: specAps,
        alarmSuppressionRatePercent: Math.max(0, alarmSuppression),
      },
      mewsMetrics: {
        meanLeadTimeHours: Math.round(meanLeadTimeMews * 10) / 10,
        sensitivityPercent: sensMews,
        specificityPercent: specMews,
      },
      qsofaMetrics: {
        meanLeadTimeHours: Math.round(meanLeadTimeQsofa * 10) / 10,
        sensitivityPercent: sensQsofa,
        specificityPercent: specQsofa,
      },
    };
  }
}
