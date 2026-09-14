/**
 * @aegispulse/research - Clinical Deterioration Preprocessing Adapter
 * Standardizes longitudinal EHR vital sign time-series, lab results, and deterioration event labels.
 */

import type { VitalObservation, ClinicalContext } from '@aegispulse/types';
import { calculateMEWS, calculateqSOFA } from '@aegispulse/clinical';

export interface StandardizedDeteriorationCase {
  caseId: string;
  datasetSlug: string;
  patientId: string;
  admissionId: string;
  observationsChronological: VitalObservation[];
  clinicalContext?: ClinicalContext;
  groundTruthOutcomes: {
    deteriorationOccurred: boolean;
    deteriorationType?: 'ICU_TRANSFER' | 'CARDIAC_ARREST' | 'SEPTIC_SHOCK' | 'ACUTE_RESPIRATORY_FAILURE';
    deteriorationTimestampMs?: number;
    hoursToDeterioration?: number;
    inHospitalMortality: boolean;
  };
  baselineScores: {
    initialMews: number;
    peakMews: number;
    initialqSOFA: number;
  };
}

export interface RawEhrPatientRecord {
  datasetSlug: string;
  patientId: string;
  admissionId: string;
  chartEvents: {
    timestampMs: number;
    hr?: number;
    rr?: number;
    sbp?: number;
    dbp?: number;
    spo2?: number;
    tempC?: number;
    avpu?: 'ALERT' | 'VOICE' | 'PAIN' | 'UNRESPONSIVE';
    lactate?: number;
    wbc?: number;
  }[];
  clinicalContext?: ClinicalContext;
  outcomes: StandardizedDeteriorationCase['groundTruthOutcomes'];
}

export class ClinicalDeteriorationAdapter {
  /**
   * Transforms raw EHR chart events into structured vital observations and standardized deterioration benchmarks
   */
  public static preprocessPatientCase(record: RawEhrPatientRecord): StandardizedDeteriorationCase {
    const observations: VitalObservation[] = [];
    const mewsScores: number[] = [];

    for (let i = 0; i < record.chartEvents.length; i++) {
      const e = record.chartEvents[i];
      const obs: VitalObservation = {
        id: `${record.admissionId}-obs-${i}`,
        patientId: record.patientId,
        timestamp: e.timestampMs,
        heartRate: e.hr !== undefined ? { value: e.hr, unit: 'BPM', confidence: 1.0 } : undefined,
        respiratoryRate: e.rr !== undefined ? { value: e.rr, unit: 'BPM', confidence: 1.0 } : undefined,
        bloodPressure:
          e.sbp !== undefined && e.dbp !== undefined
            ? { systolic: e.sbp, diastolic: e.dbp, unit: 'MMHG', confidence: 1.0 }
            : undefined,
        oxygenSaturation: e.spo2 !== undefined ? { value: e.spo2, unit: 'PERCENT', confidence: 1.0 } : undefined,
        temperature: e.tempC !== undefined ? { value: e.tempC, unit: 'CELSIUS', confidence: 1.0 } : undefined,
        consciousness: e.avpu ? { level: e.avpu, confidence: 1.0 } : undefined,
        source: 'MANUAL_ENTRY',
      };

      observations.push(obs);

      const avpuChar = e.avpu === 'ALERT' ? 'A' :
                       e.avpu === 'VOICE' ? 'V' :
                       e.avpu === 'PAIN' ? 'P' :
                       e.avpu === 'UNRESPONSIVE' ? 'U' : undefined;

      const mews = calculateMEWS({
        heartRate: e.hr,
        respiratoryRate: e.rr,
        systolicBP: e.sbp,
        temperature: e.tempC,
        avpu: avpuChar,
      });
      mewsScores.push(mews.totalScore);
    }

    // Sort chronologically
    observations.sort((a, b) => a.timestamp - b.timestamp);

    const initialMews = mewsScores.length > 0 ? mewsScores[0] : 0;
    const peakMews = mewsScores.length > 0 ? Math.max(...mewsScores) : 0;

    const firstE = record.chartEvents[0];
    const initialqSofa = firstE
      ? calculateqSOFA({
          respiratoryRate: firstE.rr,
          systolicBP: firstE.sbp,
          avpu: firstE.avpu === 'ALERT' ? 'A' :
                firstE.avpu === 'VOICE' ? 'V' :
                firstE.avpu === 'PAIN' ? 'P' :
                firstE.avpu === 'UNRESPONSIVE' ? 'U' : undefined,
        }).totalScore
      : 0;

    return {
      caseId: `${record.datasetSlug}-${record.admissionId}`,
      datasetSlug: record.datasetSlug,
      patientId: record.patientId,
      admissionId: record.admissionId,
      observationsChronological: observations,
      clinicalContext: record.clinicalContext,
      groundTruthOutcomes: record.outcomes,
      baselineScores: {
        initialMews,
        peakMews,
        initialqSOFA: initialqSofa,
      },
    };
  }
}
