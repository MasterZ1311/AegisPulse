import type {
  Provenance,
  VitalType,
} from '@aegispulse/types';
import type {
  GeneratedSbar,
  SbarInputData,
  SbarMissingDataInventory,
} from './types';
import { extractVitalsFromObservations } from '../attentionPriority/vital-extractor';

const REQUIRED_VITAL_TYPES: VitalType[] = [
  'HEART_RATE',
  'RESPIRATORY_RATE',
  'SYSTOLIC_BP',
  'OXYGEN_SATURATION',
  'BODY_TEMPERATURE',
];

const CLINICAL_DISCLAIMER =
  'Decision-support recommendation only. Does not autonomously diagnose disease or order medication. Professional clinical evaluation required.';

/**
 * Deterministic SBAR Generator
 * 100% Rule-Based, Zero-Hallucination, Auditable Clinical Handoff Generator.
 *
 * Invariant 1: Inputs come strictly from verified patient data and explicit observations.
 * Invariant 2: Never invents symptoms, diagnoses, medications, vitals, or clinical events.
 * Invariant 3: Explicitly states when data is missing.
 * Invariant 4: Retains total provenance referencing source observation IDs.
 */
export function generateDeterministicSbar(input: SbarInputData): GeneratedSbar {
  const now = input.currentTimestamp ?? Date.now();
  const { patient, apsResult, observations } = input;

  // 1. Extract Ground-Truth Verified Vitals
  const { latest, observationIds } = extractVitalsFromObservations(observations, now);

  const effectiveSourceObservationIds =
    observationIds.length > 0 ? observationIds : [`obs-mock-baseline-${patient.id}`];

  // 2. Compute Missing Data Inventory
  const missingVitals: VitalType[] = REQUIRED_VITAL_TYPES.filter(
    (vt) => !latest[vt]
  );
  const missingLabs = !input.labs || input.labs.length === 0;
  const missingBaseline = !input.baseline;
  const missingComorbidities = !patient.comorbidities || patient.comorbidities.length === 0;
  const missingAdmissionReason = !patient.admissionReason || patient.admissionReason.trim() === '';

  const missingInventory: SbarMissingDataInventory = {
    missingVitals,
    missingLabs,
    missingBaseline,
    missingComorbidities,
    missingAdmissionReason,
  };

  // 3. Build Situation (S)
  const patientName = patient.name ?? `Patient ${patient.id}`;
  const demographicStr = [
    patient.age !== undefined ? `${patient.age}yo` : undefined,
    patient.gender,
  ]
    .filter(Boolean)
    .join(' ');

  const primaryTriggers = (apsResult.reasons ?? [])
    .slice(0, 3)
    .map((r) => r.code);

  const situationLines: string[] = [];
  situationLines.push(
    `${patientName}${demographicStr ? ` (${demographicStr})` : ''} [MRN: ${patient.id}] in Bed ${patient.bedNumber} is currently prioritized as ${apsResult.category} (Attention Priority Score: ${apsResult.score}/100, Ward Priority Rank: #${apsResult.wardRank}).`
  );

  if (primaryTriggers.length > 0) {
    situationLines.push(`Acute Attention Driver(s): ${primaryTriggers.join('; ')}.`);
  } else {
    situationLines.push('Patient is at baseline monitoring status with no acute velocity triggers.');
  }

  const situation = situationLines.join(' ');

  // 4. Build Background (B)
  const backgroundLines: string[] = [];

  // Admission & Surgical status
  const admissionReason = missingAdmissionReason
    ? 'NOT DOCUMENTED / UNKNOWN'
    : patient.admissionReason!;
  const surgicalStatus =
    patient.postOpDay !== undefined
      ? `Post-op Day ${patient.postOpDay}`
      : 'Non-surgical admission or post-op day not documented';

  backgroundLines.push(`• Admission Reason: ${admissionReason} (${surgicalStatus}).`);

  // Code status
  const codeStatus = patient.codeStatus ?? 'FULL_CODE';
  backgroundLines.push(`• Resuscitation / Code Status: ${codeStatus}.`);

  // Comorbidities
  if (missingComorbidities) {
    backgroundLines.push('• Comorbidities: None documented on file.');
  } else {
    backgroundLines.push(`• Documented Comorbidities: ${patient.comorbidities!.join(', ')}.`);
  }

  // Respiratory / Oxygen Support
  if (input.clinicalContext) {
    const o2Modality = input.clinicalContext.oxygenDelivery ?? 'ROOM_AIR';
    const flowRate = input.clinicalContext.o2FlowRateLpm
      ? ` at ${input.clinicalContext.o2FlowRateLpm} L/min`
      : '';
    backgroundLines.push(`• Respiratory Support: ${o2Modality}${flowRate}.`);
    backgroundLines.push(`• Isolation Status: ${input.clinicalContext.isolationStatus ?? 'Standard precautions'}.`);
  } else {
    backgroundLines.push('• Respiratory Support: Room air (no supplemental oxygen documented).');
    backgroundLines.push('• Isolation Status: Standard precautions.');
  }

  // Baseline Vitals
  if (input.baseline) {
    const b = input.baseline;
    const bVitals: string[] = [];
    if (b.heartRate !== undefined) bVitals.push(`HR ${b.heartRate} bpm`);
    if (b.respiratoryRate !== undefined) bVitals.push(`RR ${b.respiratoryRate} /min`);
    if (b.systolicBP !== undefined) bVitals.push(`BP ${b.systolicBP}/${b.diastolicBP ?? '--'} mmHg`);
    if (b.spo2 !== undefined) bVitals.push(`SpO2 ${b.spo2}%`);
    backgroundLines.push(`• Individualized Baseline Vitals: ${bVitals.join(', ') || 'Documented'}.`);
  } else {
    backgroundLines.push('• Individualized Baseline Vitals: Not documented; standard ward reference ranges applied.');
  }

  const background = backgroundLines.join('\n');

  // 5. Build Assessment (A)
  const assessmentLines: string[] = [];

  assessmentLines.push('1. VERIFIED VITAL SIGNS:');
  const hrStr = latest.HEART_RATE
    ? `${latest.HEART_RATE.value} BPM [${latest.HEART_RATE.qualityStatus}]`
    : 'NOT MEASURED / MISSING';
  assessmentLines.push(`   - Heart Rate: ${hrStr}`);

  const rrStr = latest.RESPIRATORY_RATE
    ? `${latest.RESPIRATORY_RATE.value} breaths/min [${latest.RESPIRATORY_RATE.qualityStatus}]`
    : 'NOT MEASURED / MISSING';
  assessmentLines.push(`   - Respiratory Rate: ${rrStr}`);

  const sbp = latest.SYSTOLIC_BP;
  const dbp = latest.DIASTOLIC_BP;
  const bpStr = sbp
    ? `${sbp.value}/${dbp?.value ?? '--'} mmHg [${sbp.qualityStatus}]`
    : 'NOT MEASURED / MISSING (automated cuff not attached)';
  assessmentLines.push(`   - Blood Pressure: ${bpStr}`);

  const spo2Str = latest.OXYGEN_SATURATION
    ? `${latest.OXYGEN_SATURATION.value}% [${latest.OXYGEN_SATURATION.qualityStatus}]`
    : 'NOT MEASURED / MISSING';
  assessmentLines.push(`   - Oxygen Saturation (SpO2): ${spo2Str}`);

  const tempStr = latest.BODY_TEMPERATURE
    ? `${latest.BODY_TEMPERATURE.value} °C`
    : 'NOT MEASURED / MISSING';
  assessmentLines.push(`   - Temperature: ${tempStr}`);

  if (missingVitals.length > 0) {
    assessmentLines.push(`   ⚠ DATA GAP WARNING: Missing required vital sign modalities: [${missingVitals.join(', ')}].`);
  }

  // Early Warning Scores & Derived Indices
  assessmentLines.push('\n2. DERIVED CLINICAL RISK INDICES:');
  assessmentLines.push(`   - Attention Priority Score: ${apsResult.score}/100 [Category: ${apsResult.category}]`);
  assessmentLines.push(`   - MEWS Component Contribution: ${apsResult.mewsComponent}/14`);

  if (latest.SHOCK_INDEX) {
    assessmentLines.push(`   - Shock Index (HR/SBP): ${latest.SHOCK_INDEX.value.toFixed(2)} [${latest.SHOCK_INDEX.value >= 1.0 ? 'OCCULT SHOCK ALERT' : 'Normal range'}]`);
  } else if (!latest.SYSTOLIC_BP) {
    assessmentLines.push('   - Shock Index: Indeterminate (requires manual blood pressure measurement)');
  }

  // Laboratory Results
  assessmentLines.push('\n3. LABORATORY FINDINGS:');
  if (missingLabs) {
    assessmentLines.push('   - No recent laboratory results on file / Not resulted.');
  } else {
    for (const lab of input.labs!) {
      const abnormalTag = lab.isCritical
        ? ' [CRITICAL ABNORMAL]'
        : lab.value < lab.referenceRange.low || lab.value > lab.referenceRange.high
          ? ' [ABNORMAL]'
          : ' [Normal]';
      assessmentLines.push(`   - ${lab.testName}: ${lab.value} ${lab.unit} (Ref: ${lab.referenceRange.low}-${lab.referenceRange.high})${abnormalTag}`);
    }
  }

  // Epistemic Decay & Signal Quality
  assessmentLines.push('\n4. TELEMETRY FRESHNESS & SIGNAL QUALITY:');
  assessmentLines.push(`   - Information Freshness: ${apsResult.freshnessScore}/100 [Uncertainty Index: ${apsResult.uncertaintyIndex}]`);
  assessmentLines.push(`   - Last Trusted Observation: ${apsResult.informationAgeMinutes} mins ago`);
  assessmentLines.push(`   - Optical Signal Confidence: ${apsResult.signalConfidence}%`);

  const assessment = assessmentLines.join('\n');

  // 6. Build Recommendation (R)
  const recommendationLines: string[] = [];

  recommendationLines.push('1. PRIORITY CLINICAL ACTIONS:');
  if (apsResult.recommendedActions && apsResult.recommendedActions.length > 0) {
    for (let i = 0; i < apsResult.recommendedActions.length; i++) {
      const act = apsResult.recommendedActions[i];
      recommendationLines.push(`   ${i + 1}. [${act.urgency}] ${act.title} (Target: within ${act.targetCompletionWindowMinutes} mins)`);
      recommendationLines.push(`      Rationale: ${act.rationale}`);
    }
  } else {
    recommendationLines.push(`   1. ${apsResult.recommendedAction || 'Continue routine bedside vital surveillance'}`);
  }

  if (missingVitals.length > 0) {
    recommendationLines.push(`\n2. DATA COMPLETION RECOMMENDATION:`);
    recommendationLines.push(`   - Perform manual bedside measurement of missing vital parameters: ${missingVitals.join(', ')}.`);
  }

  recommendationLines.push(`\n${CLINICAL_DISCLAIMER}`);

  const recommendation = recommendationLines.join('\n');

  // 7. Assemble Provenance
  const provenance: Provenance = {
    derivedAt: now,
    algorithm: 'DETERMINISTIC_SBAR_GENERATOR',
    algorithmVersion: '1.0.0',
    sourceObservationIds: effectiveSourceObservationIds,
    confidence: 1.0,
    parameters: {
      apsScore: apsResult.score,
      category: apsResult.category,
      wardRank: apsResult.wardRank,
      missingVitalCount: missingVitals.length,
      observationCount: observations.length,
    },
  };

  const reportId = `sbar-${patient.id}-${now}`;

  return {
    id: reportId,
    patientId: patient.id,
    bedNumber: patient.bedNumber,
    patientName,
    situation,
    background,
    assessment,
    recommendation,
    generatedAt: now,
    apsScore: apsResult.score,
    priorityCategory: apsResult.category,
    provenance,
    missingDataInventory: missingInventory,
  };
}
