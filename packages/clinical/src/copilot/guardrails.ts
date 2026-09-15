import type {
  CopilotQueryType,
  CopilotRefusalReason,
  StructuredEvidencePackage,
  VitalType,
} from '@aegispulse/types';

export interface GuardrailCheckResult {
  passed: boolean;
  refusalReason?: CopilotRefusalReason;
  refusalExplanation?: string;
  detectedPattern?: string;
}

/**
 * Known malicious prompt injection vectors, jailbreak signatures,
 * and command delimiter escape attempts.
 */
const PROMPT_INJECTION_PATTERNS: Array<{ regex: RegExp; label: string }> = [
  {
    regex: /(?:ignore|disregard|bypass|forget|override)\s+(?:all\s+)?(?:previous\s+|prior\s+|system\s+)?(?:instructions|directives|prompts|safeguards|constraints|prior\s+rules|previous\s+rules|system\s+rules)/i,
    label: 'Instruction Override Attempt',
  },
  {
    regex: /(?:you\s+are\s+now|act\s+as|pretend\s+to\s+be)\b[\s\w]*(?:DAN|developer\s+mode|unfiltered|jailbroken|jailbreak|unrestricted|god\s+mode)/i,
    label: 'Roleplay / Jailbreak Persona Hijack',
  },
  {
    regex: /<\/?(?:system|admin|prompt|instruction|context|rules?)>/i,
    label: 'Delimiter / Tag Injection',
  },
  {
    regex: /\[(?:SYSTEM|ADMIN|ROOT|OVERRIDE|DEVELOPER)\]/i,
    label: 'Control Token Spoofing',
  },
  {
    regex: /(?:output|reveal|dump|print)\s+(?:your\s+)?(?:system\s+prompt|hidden\s+instructions?|base\s+instructions?)/i,
    label: 'System Prompt Exfiltration',
  },
  {
    regex: /(?:evil|malicious|dark)\s+mode/i,
    label: 'Adversarial Persona Trigger',
  },
  {
    regex: /(?:<script\b|javascript:|onerror\s*=|onload\s*=|data:text\/html|<iframe\b)/i,
    label: 'Script / HTML Payload Injection',
  },
  {
    regex: /(?:base64\s*(?:decode|eval|execution)|(?:decode|execute|run)\s+(?:this\s+)?base64|atob\s*\(|eval\s*\()/i,
    label: 'Encoded / Base64 Payload Obfuscation',
  },
  {
    regex: /!\[.*?\]\(https?:\/\/[^\s)]+\?[^\s)]*\)/i,
    label: 'Markdown Out-of-Band Exfiltration',
  },
];

/**
 * Patterns that attempt forbidden clinical operations.
 */
const FORBIDDEN_SAFETY_OVERRIDE_PATTERNS: Array<{ regex: RegExp; explanation: string }> = [
  {
    regex: /\b(?:ignore|disable|bypass|silence|turn\s+off)\b[\s\w]*(?:safety|alarms?|floors?|mews\s+floor|red\s+floor|verifications?|safety\s+rules?|clinical\s+rules?)\b/i,
    explanation: 'Deterministic safety rules and clinical floors are absolute and cannot be disabled or bypassed.',
  },
];

const FORBIDDEN_APS_MUTATION_PATTERNS: Array<{ regex: RegExp; explanation: string }> = [
  {
    regex: /\b(?:change|set|modify|override|reset|force|lower)\b[\s\w]*(?:aps|scores?|attention\s+score|priority(?:\s+to)?|ward\s+rank)\b/i,
    explanation: 'AegisPulse Attention Priority Score (APS) is strictly deterministic and cannot be altered, overwritten, or mutated by the AI Copilot.',
  },
];

const FORBIDDEN_DATA_OVERWRITE_PATTERNS: Array<{ regex: RegExp; explanation: string }> = [
  {
    regex: /\b(?:overwrite|delete|falsify|erase)\b[\s\w]*(?:vitals?|observations?|measurements?|telemetry|data|records?)\b/i,
    explanation: 'Clinical telemetry and observation ledgers are immutable and cannot be overwritten or altered by the AI Copilot.',
  },
];

const FORBIDDEN_DIAGNOSIS_PATTERNS: Array<{ regex: RegExp; explanation: string }> = [
  {
    regex: /\b(?:diagnos(?:e|is|ing)|what\s+(?:disease|illness|condition|pathology)|confirm\s+(?:diagnosis|that\s+patient\s+has))\b/i,
    explanation: 'AegisPulse AI Copilot is strictly advisory and legally prohibited from diagnosing disease or issuing medical diagnoses.',
  },
  {
    regex: /\b(?:is\s+(?:it|this|the\s+patient))\b[\s\w]*(?:sepsis|pneumonia|covid|myocardial\s+infarction|stemi|ards|heart\s+failure|stroke|pulmonary\s+embolism|septic\s+shock)\b/i,
    explanation: 'AegisPulse AI Copilot is strictly advisory and legally prohibited from diagnosing disease or confirming specific pathologies.',
  },
  {
    regex: /\bseptic\s+shock\b/i,
    explanation: 'AegisPulse AI Copilot is strictly advisory and legally prohibited from diagnosing disease or confirming septic shock.',
  },
];

const FORBIDDEN_TREATMENT_EXPLANATION =
  'AegisPulse AI Copilot is strictly prohibited from prescribing, ordering medications, administering treatments, or independently recommending medical interventions.';

const FORBIDDEN_TREATMENT_PATTERNS: Array<{ regex: RegExp; explanation: string }> = [
  {
    regex: /\b(?:prescribe|administer|order)\b/i,
    explanation: FORBIDDEN_TREATMENT_EXPLANATION,
  },
  {
    regex: /\bgive\b[\s\w]*(?:\d+\s*(?:mg|mcg|ml|g|units?)|iv|morphine|antibiotics?|fluids?|saline|epinephrine|norepinephrine|heparin|propofol)\b/i,
    explanation: FORBIDDEN_TREATMENT_EXPLANATION,
  },
  {
    regex: /\b(?:recommend|suggest)\b[\s\w]*(?:treatment|therapy|drug|medication|dosage?|dose)\b/i,
    explanation: FORBIDDEN_TREATMENT_EXPLANATION,
  },
  {
    regex: /\b(?:what|which)\s+(?:drug|medication|dose|dosage|treatment)\b/i,
    explanation: FORBIDDEN_TREATMENT_EXPLANATION,
  },
  {
    regex: /\b(?:dose|dosage)\s+of\b/i,
    explanation: FORBIDDEN_TREATMENT_EXPLANATION,
  },
];

/**
 * Detects prompt injection or jailbreak attempts.
 */
export function detectPromptInjection(query: string): GuardrailCheckResult {
  for (const { regex, label } of PROMPT_INJECTION_PATTERNS) {
    if (regex.test(query)) {
      return {
        passed: false,
        refusalReason: 'PROMPT_INJECTION_DETECTED',
        refusalExplanation: `Query was blocked by prompt-injection defense: detected "${label}".`,
        detectedPattern: label,
      };
    }
  }
  return { passed: true };
}

/**
 * Detects attempts to perform forbidden clinical actions.
 */
export function detectForbiddenIntent(
  query: string,
  _queryType: CopilotQueryType
): GuardrailCheckResult {
  // 1. Safety overrides
  for (const { regex, explanation } of FORBIDDEN_SAFETY_OVERRIDE_PATTERNS) {
    if (regex.test(query)) {
      return {
        passed: false,
        refusalReason: 'SAFETY_OVERRIDE_ATTEMPT',
        refusalExplanation: explanation,
      };
    }
  }

  // 2. APS Mutations
  for (const { regex, explanation } of FORBIDDEN_APS_MUTATION_PATTERNS) {
    if (regex.test(query)) {
      return {
        passed: false,
        refusalReason: 'ATTEMPTED_APS_MUTATION',
        refusalExplanation: explanation,
      };
    }
  }

  // 3. Data Overwrite
  for (const { regex, explanation } of FORBIDDEN_DATA_OVERWRITE_PATTERNS) {
    if (regex.test(query)) {
      return {
        passed: false,
        refusalReason: 'ATTEMPTED_DATA_OVERWRITE',
        refusalExplanation: explanation,
      };
    }
  }

  // 4. Diagnoses
  for (const { regex, explanation } of FORBIDDEN_DIAGNOSIS_PATTERNS) {
    if (regex.test(query)) {
      return {
        passed: false,
        refusalReason: 'ATTEMPTED_DIAGNOSIS',
        refusalExplanation: explanation,
      };
    }
  }

  // 5. Treatment recommendations
  for (const { regex, explanation } of FORBIDDEN_TREATMENT_PATTERNS) {
    if (regex.test(query)) {
      return {
        passed: false,
        refusalReason: 'ATTEMPTED_TREATMENT_RECOMMENDATION',
        refusalExplanation: explanation,
      };
    }
  }

  return { passed: true };
}

/**
 * Checks whether a question asks for clinical measurements or labs
 * that are absent from the provided StructuredEvidencePackage.
 */
export function validateEvidenceGrounding(
  query: string,
  evidence: StructuredEvidencePackage
): GuardrailCheckResult {
  const queryLower = query.toLowerCase();

  // Common clinical tests/modalities and their mapping to evidence
  const UNMEASURED_LAB_TERMS = [
    { term: 'troponin', code: 'TROPONIN' },
    { term: 'lactate', code: 'LACTATE' },
    { term: 'd-dimer', code: 'DDIMER' },
    { term: 'bnp', code: 'BNP' },
    { term: 'crp', code: 'CRP' },
    { term: 'blood culture', code: 'BLOOD_CULTURE' },
    { term: 'arterial blood gas', code: 'ABG' },
    { term: 'hemoglobin', code: 'HGB' },
    { term: 'white blood cell', code: 'WBC' },
    { term: 'creatinine', code: 'CREATININE' },
    { term: 'potassium', code: 'POTASSIUM' },
  ];

  for (const lab of UNMEASURED_LAB_TERMS) {
    if (queryLower.includes(lab.term)) {
      const existsInLabs = evidence.recentLabs.some(
        (l) =>
          l.testCode.toUpperCase().includes(lab.code) ||
          l.testName.toLowerCase().includes(lab.term)
      );
      if (!existsInLabs) {
        return {
          passed: false,
          refusalReason: 'UNSUPPORTED_OR_MISSING_DATA',
          refusalExplanation: `Refusal: No verified result for '${lab.term}' exists in the patient's evidence record. AegisPulse copilot will not invent or extrapolate unmeasured laboratory values.`,
        };
      }
    }
  }

  // Check unmeasured vitals
  const VITAL_TERMS: Array<{ term: string; vitalType: VitalType }> = [
    { term: 'heart rate', vitalType: 'HEART_RATE' },
    { term: 'pulse', vitalType: 'HEART_RATE' },
    { term: 'respiratory rate', vitalType: 'RESPIRATORY_RATE' },
    { term: 'breathing rate', vitalType: 'RESPIRATORY_RATE' },
    { term: 'oxygen saturation', vitalType: 'OXYGEN_SATURATION' },
    { term: 'spo2', vitalType: 'OXYGEN_SATURATION' },
    { term: 'blood pressure', vitalType: 'SYSTOLIC_BP' },
    { term: 'temperature', vitalType: 'BODY_TEMPERATURE' },
  ];

  for (const item of VITAL_TERMS) {
    // If the query specifically asks for the value of this vital, and it is in missingVitals
    if (queryLower.includes(item.term) && evidence.missingVitals.includes(item.vitalType)) {
      // Check if it's missing from verified vitals
      if (!evidence.verifiedVitals[item.vitalType]) {
        return {
          passed: false,
          refusalReason: 'UNSUPPORTED_OR_MISSING_DATA',
          refusalExplanation: `Refusal: ${item.vitalType} is not available in the verified telemetry record. The copilot refuses to fabricate unmeasured physiological vitals.`,
        };
      }
    }
  }

  return { passed: true };
}
