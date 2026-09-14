import type { WorkflowActionPayload } from '@aegispulse/types';

/**
 * Custom Error thrown when a payload or action violates clinical decision-support boundaries.
 */
export class ClinicalSafetyViolationError extends Error {
  constructor(message: string) {
    super(`CLINICAL SAFETY VIOLATION: ${message}`);
    this.name = 'ClinicalSafetyViolationError';
  }
}

/**
 * Forbidden autonomous keywords that cannot be issued autonomously by the software.
 */
const FORBIDDEN_AUTONOMOUS_PATTERNS = [
  /\b(prescribe|order|administer)\s+(medication|drug|antibiotic|vasopressor|fluid|norepinephrine|bolus)\b/i,
  /\b(intubate|defibrillate|ventilate)\s+(autonomously|patient)\b/i,
  /\b(diagnose|confirm diagnosis)\s+(sepsis|pneumonia|covid|myocardial infarction|stroke)\b/i,
  /\b(autonomous order|autonomous prescription)\b/i,
];

/**
 * Validates that an action payload strictly conforms to observational decision-support bounds.
 * Rejects any attempt to autonomously prescribe therapy, order medication, or issue diagnosis.
 */
export function assertDecisionSupportBounds(payload: WorkflowActionPayload): void {
  // 1. Validate action is an allowed human clinician action
  const allowedActions = [
    'ACKNOWLEDGE',
    'START_ASSESSMENT',
    'COMPLETE_ASSESSMENT',
    'DISMISS',
    'ESCALATE',
    'MARK_FALSE_POSITIVE',
  ];

  if (!allowedActions.includes(payload.action)) {
    throw new ClinicalSafetyViolationError(
      `Action '${payload.action}' is not an authorized human verification action.`
    );
  }

  // 2. Scan notes or rationale for unauthorized autonomous treatment/diagnosis directives
  const textToScan = `${payload.notes ?? ''} ${payload.dismissReason ?? ''}`;
  for (const pattern of FORBIDDEN_AUTONOMOUS_PATTERNS) {
    if (pattern.test(textToScan)) {
      throw new ClinicalSafetyViolationError(
        'AegisPulse is an observational decision-support platform. The software must never autonomously order treatment, alter therapy, or diagnose disease. All interventions require licensed clinician orders.'
      );
    }
  }

  // 3. Complete Assessment must include valid clinical verification notes or observations
  if (payload.action === 'COMPLETE_ASSESSMENT') {
    if (!payload.notes && (!payload.newObservations || payload.newObservations.length === 0)) {
      throw new ClinicalSafetyViolationError(
        'Assessment completion requires either documented clinical findings or verified vital observations.'
      );
    }
  }

  // 4. Dismissal requires documented clinical rationale
  if (payload.action === 'DISMISS') {
    if (!payload.dismissReason && !payload.notes) {
      throw new ClinicalSafetyViolationError(
        'Dismissing an elevated alert requires documented clinical rationale for audit trail.'
      );
    }
  }
}
