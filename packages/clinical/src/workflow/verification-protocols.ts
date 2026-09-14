import type {
  AttentionPriorityCategory,
  AttentionReasonCode,
  PatientVerificationProtocol,
  VerificationProtocolItem,
} from '@aegispulse/types';
import type { AttentionPriorityResult } from '../attentionPriority/types';

/**
 * Standard Clinical Disclaimer for Decision Support Outputs.
 * Med-Device Regulatory Invariant: System never autonomously prescribes treatment or diagnoses disease.
 */
export const CLINICAL_DECISION_SUPPORT_DISCLAIMER =
  'Decision-support protocol only. Does not autonomously diagnose disease or prescribe treatment. Professional clinical judgment required.';

/**
 * Generates a structured clinical verification protocol for an elevated-priority patient.
 * Tailors items, completion time horizons, and urgency based on the dominant clinical driver.
 */
export function generateVerificationProtocol(
  apsResult: AttentionPriorityResult
): PatientVerificationProtocol {
  const { patientId, bedNumber, score, category, reasons } = apsResult;
  const reasonCodes: AttentionReasonCode[] = (reasons ?? []).map((r) => r.code);

  const dominantReason = reasonCodes[0];

  // 1. Bedside Vital Recheck
  let vitalRecheckUrgency: AttentionPriorityCategory = category;
  let vitalRecheckWindow = 15;
  let vitalRecheckRationale =
    'Direct nurse bedside manual verification of heart rate (radial/apical) and respiratory rate over a full 60 seconds.';

  if (reasonCodes.includes('VELOCITY_RR_SPIKE') || reasonCodes.includes('VELOCITY_HR_SPIKE')) {
    vitalRecheckUrgency = 'CRITICAL_REVIEW';
    vitalRecheckWindow = 10;
    vitalRecheckRationale =
      'Acute physiological acceleration detected. Verify that tachypnea/tachycardia is not an optical sensor artifact.';
  } else if (reasonCodes.includes('INFORMATION_DECAY_TIMEOUT')) {
    vitalRecheckRationale =
      'Telemetry blindspot: patient has exceeded expected monitoring interval without trusted bedside observations.';
  }

  const vitalRecheckItem: VerificationProtocolItem = {
    id: `proto-vitals-${patientId}-${Date.now()}`,
    type: 'BEDSIDE_VITAL_RECHECK',
    title: 'Bedside Vital Signs Recheck',
    description: 'Perform manual radial pulse count and observe respiratory cycle for 60 seconds.',
    rationale: vitalRecheckRationale,
    urgency: vitalRecheckUrgency,
    targetWindowMinutes: vitalRecheckWindow,
    isCompleted: false,
  };

  // 2. Manual BP Confirmation
  let bpUrgency: AttentionPriorityCategory = category;
  let bpWindow = 20;
  let bpRationale =
    'Cycle automated non-invasive blood pressure (NIBP) cuff or obtain manual sphygmomanometer reading.';

  if (reasonCodes.includes('SHOCK_INDEX_OCCULT')) {
    bpUrgency = 'CRITICAL_REVIEW';
    bpWindow = 5;
    bpRationale =
      'Occult Shock Index elevation (HR/SBP >= 1.0). Immediate hemodynamic verification required to rule out septic or hemorrhagic shock.';
  } else if (reasonCodes.includes('QSOFA_ESCALATION')) {
    bpUrgency = 'CRITICAL_REVIEW';
    bpWindow = 10;
    bpRationale =
      'qSOFA criteria flagged: evaluate for systolic hypotension (SBP <= 100 mmHg).';
  }

  const bpConfirmationItem: VerificationProtocolItem = {
    id: `proto-bp-${patientId}-${Date.now()}`,
    type: 'MANUAL_BP_CONFIRMATION',
    title: 'Manual Blood Pressure Confirmation',
    description: 'Verify systolic and diastolic arterial pressure using validated cuff.',
    rationale: bpRationale,
    urgency: bpUrgency,
    targetWindowMinutes: bpWindow,
    isCompleted: false,
  };

  // 3. Inspect Patient
  let inspectUrgency: AttentionPriorityCategory = category;
  let inspectWindow = 15;
  let inspectRationale =
    'Evaluate work of breathing (accessory muscle use, stridor, nasal flaring), skin perfusion (capillary refill, diaphoresis), and mental status (AVPU).';

  if (reasonCodes.includes('LAB_HYPOXIA_LACTATE')) {
    inspectUrgency = 'CRITICAL_REVIEW';
    inspectWindow = 10;
    inspectRationale =
      'Elevated lactate indicates tissue hypoperfusion. Check peripheral temperature, skin mottling, and urine output.';
  } else if (reasonCodes.includes('VELOCITY_RR_SPIKE')) {
    inspectRationale =
      'Assess for respiratory fatigue, speech dyspnea, and ability to clear secretions.';
  }

  const inspectPatientItem: VerificationProtocolItem = {
    id: `proto-inspect-${patientId}-${Date.now()}`,
    type: 'INSPECT_PATIENT',
    title: 'Direct Patient Clinical Inspection',
    description: 'Visual assessment of breathing effort, peripheral perfusion, and neurological responsiveness.',
    rationale: inspectRationale,
    urgency: inspectUrgency,
    targetWindowMinutes: inspectWindow,
    isCompleted: false,
  };

  // 4. Confirm Signal Quality
  let signalUrgency: AttentionPriorityCategory = 'WATCH';
  let signalWindow = 30;
  let signalRationale =
    'Verify contactless optical camera alignment, patient face illumination, and absence of physical occlusion.';

  if (reasonCodes.includes('SENSOR_CONFIDENCE_DEGRADED') || apsResult.signalConfidence < 50) {
    signalUrgency = 'EVALUATE';
    signalWindow = 10;
    signalRationale =
      'Contactless optical telemetry confidence degraded (< 50%). Reposition optical sensor or supplement with contact wearable.';
  }

  const confirmSignalItem: VerificationProtocolItem = {
    id: `proto-signal-${patientId}-${Date.now()}`,
    type: 'CONFIRM_SIGNAL_QUALITY',
    title: 'Confirm Sensor & Signal Quality',
    description: 'Inspect camera line-of-sight, ambient light levels, and patient position.',
    rationale: signalRationale,
    urgency: signalUrgency,
    targetWindowMinutes: signalWindow,
    isCompleted: false,
  };

  // Prioritize items based on acute severity
  const items: VerificationProtocolItem[] = [
    vitalRecheckItem,
    bpConfirmationItem,
    inspectPatientItem,
    confirmSignalItem,
  ];

  items.sort((a, b) => a.targetWindowMinutes - b.targetWindowMinutes);

  return {
    patientId,
    bedNumber,
    apsScore: score,
    category,
    dominantReason,
    items,
    generatedAt: Date.now(),
    clinicalDisclaimer: CLINICAL_DECISION_SUPPORT_DISCLAIMER,
  };
}
