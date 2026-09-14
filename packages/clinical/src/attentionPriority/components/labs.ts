import type {
  AttentionReason,
  ClinicalActionType,
  ClinicalContext,
  LaboratoryResult,
  Provenance,
} from '@aegispulse/types';
import type { AttentionPriorityConfig } from '../config';
import type { ComponentScore } from '../types';

export function evaluateBiomarkersAndContext(
  labs: LaboratoryResult[] | undefined,
  context: ClinicalContext | undefined,
  config: AttentionPriorityConfig,
  evaluationTimestamp: number,
  sourceObservationIds: string[]
): ComponentScore {
  const labScores: number[] = [];
  const explanations: string[] = [];
  const reasons: AttentionReason[] = [];
  const recommendedActions: ClinicalActionType[] = [];

  const {
    lactateElevated,
    lactateCritical,
    wbcLow,
    wbcHigh,
    wbcCritical,
    creatinineElevated,
    plateletsLow,
  } = config.labThresholds;

  if (labs && labs.length > 0) {
    for (const lab of labs) {
      // 1. Serum Lactate
      if (lab.testCode === 'LACTATE') {
        if (lab.value >= lactateCritical) {
          labScores.push(100);
          explanations.push(`Critical lactate ${lab.value} mmol/L (>=${lactateCritical})`);
          reasons.push({
            code: 'LAB_HYPOXIA_LACTATE',
            description: `Critical serum lactate ${lab.value} mmol/L - severe tissue hypoperfusion/sepsis`,
            contributionWeight: 0.40,
            triggerValue: lab.value,
            thresholdValue: lactateCritical,
            unit: 'MMOL_PER_L',
            urgency: 'CRITICAL_REVIEW',
          });
          recommendedActions.push('RAPID_RESPONSE_TRIGGER', 'SBAR_PHYSICIAN_CONSULT');
        } else if (lab.value >= lactateElevated) {
          labScores.push(65);
          explanations.push(`Elevated lactate ${lab.value} mmol/L (>=${lactateElevated})`);
          reasons.push({
            code: 'LAB_HYPOXIA_LACTATE',
            description: `Serum lactate elevated at ${lab.value} mmol/L - occult cellular hypoxia`,
            contributionWeight: 0.25,
            triggerValue: lab.value,
            thresholdValue: lactateElevated,
            unit: 'MMOL_PER_L',
            urgency: 'EVALUATE',
          });
          recommendedActions.push('SBAR_PHYSICIAN_CONSULT');
        }
      }

      // 2. White Blood Cell Count
      if (lab.testCode === 'WBC') {
        if (lab.value >= wbcCritical || lab.value <= 2.0) {
          labScores.push(85);
          explanations.push(`Marked leukocytosis/leukopenia WBC ${lab.value} x10^9/L`);
          reasons.push({
            code: 'LAB_LEUKOCYTOSIS',
            description: `Severe white blood cell abnormality (${lab.value} x10^9/L) - active systemic infection/sepsis`,
            contributionWeight: 0.30,
            triggerValue: lab.value,
            thresholdValue: wbcCritical,
            unit: 'X10_9_PER_L',
            urgency: 'EVALUATE',
          });
        } else if (lab.value >= wbcHigh || lab.value <= wbcLow) {
          labScores.push(50);
          explanations.push(`Elevated WBC ${lab.value} x10^9/L`);
          reasons.push({
            code: 'LAB_LEUKOCYTOSIS',
            description: `Leukocytosis (${lab.value} x10^9/L) indicating systemic inflammatory response`,
            contributionWeight: 0.20,
            triggerValue: lab.value,
            thresholdValue: wbcHigh,
            unit: 'X10_9_PER_L',
            urgency: 'WATCH',
          });
        }
      }

      // 3. Creatinine
      if (lab.testCode === 'CREATININE') {
        if (lab.value >= 2.5) {
          labScores.push(70);
          explanations.push(`Elevated Creatinine ${lab.value} mg/dL (AKI)`);
        } else if (lab.value >= creatinineElevated) {
          labScores.push(40);
          explanations.push(`Borderline Creatinine ${lab.value} mg/dL`);
        }
      }

      // 4. Platelets
      if (lab.testCode === 'PLATELETS') {
        if (lab.value <= 50) {
          labScores.push(80);
          explanations.push(`Severe thrombocytopenia Platelets ${lab.value} x10^9/L`);
        } else if (lab.value <= plateletsLow) {
          labScores.push(45);
          explanations.push(`Low Platelets ${lab.value} x10^9/L`);
        }
      }
    }
  }

  // Clinical Context evaluation
  let contextBonus = 0;
  if (context) {
    // High acuity oxygen support
    if (
      context.oxygenDelivery === 'HIGH_FLOW_NASAL_CANNULA' ||
      context.oxygenDelivery === 'NON_INVASIVE_VENTILATION' ||
      context.oxygenDelivery === 'MECHANICAL_VENTILATION'
    ) {
      contextBonus += 25;
      explanations.push(`High-acuity oxygen support (${context.oxygenDelivery})`);
    } else if (
      context.oxygenDelivery === 'NON_REBREATHER' ||
      (context.o2FlowRateLpm ?? 0) >= 6
    ) {
      contextBonus += 15;
      explanations.push(`Supplementary oxygen (${context.o2FlowRateLpm} LPM)`);
    }

    // High risk post-op
    if (context.postOpDay !== undefined && context.postOpDay <= 2 && context.comorbidities.length >= 2) {
      contextBonus += 15;
      explanations.push(`Early Post-Op Day ${context.postOpDay} with multiple comorbidities`);
    }
  }

  const maxLabScore = labScores.length > 0 ? Math.max(...labScores) : 0;
  const normalizedContribution = Math.min(100, Math.round(maxLabScore * 0.80 + contextBonus));

  const weight = config.weights.biomarkers;
  const weightedContribution = Number((normalizedContribution * weight).toFixed(2));

  const explanation =
    normalizedContribution === 0
      ? 'Biomarkers and clinical context unrevealing'
      : `Biomarkers/context score ${normalizedContribution}/100: ${explanations.join(', ')}`;

  const provenance: Provenance = {
    derivedAt: evaluationTimestamp,
    algorithm: 'BIOMARKERS_CONTEXT_EVALUATOR',
    algorithmVersion: '1.0.0',
    sourceObservationIds:
      sourceObservationIds.length > 0 ? sourceObservationIds : ['OBS-DEFAULT'],
    confidence: 1.0,
    parameters: {
      maxLabScore,
      contextBonus,
      normalizedContribution,
    },
  };

  return {
    componentName: 'biomarkers',
    normalizedContribution,
    rawScore: maxLabScore,
    weight,
    weightedContribution,
    explanation,
    provenance,
    reasons,
    recommendedActions,
  };
}
