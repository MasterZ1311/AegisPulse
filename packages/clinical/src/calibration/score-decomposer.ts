/**
 * @aegispulse/clinical - APS Score Decomposer
 * Deconstructs the composite Attention Priority Score (APS) into traceable mathematical components.
 * Quantifies relative percentage contribution, override floor activations, and epistemic vs physiological balance.
 */

import type { AttentionPriorityResult, ComponentScore } from '../attentionPriority/types';

export interface ComponentContributionBreakdown {
  componentName: string;
  rawScore: number;
  normalizedContribution: number;
  weight: number;
  weightedContribution: number;
  percentageOfComposite: number;
  explanation: string;
}

export interface ScoreDecompositionReport {
  patientId: string;
  finalScore: number;
  category: string;
  compositeRawScore: number;
  appliedOverrideFloor?: {
    floorName: string;
    floorScore: number;
    rationale: string;
  };
  components: ComponentContributionBreakdown[];
  epistemicVsPhysiological: {
    physiologicalScore: number;
    uncertaintyScore: number;
    uncertaintyIndex: number;
    couplingMultiplier: number;
    freshnessScore: number;
    epistemicCategory: string;
    decouplingExplanation: string;
  };
  dominantClinicalDriver: {
    componentName: string;
    contributionPercentage: number;
    description: string;
  };
  topReasons: string[];
}

/**
 * Decomposes an AttentionPriorityResult into an audit-ready mathematical and clinical report
 */
export function decomposeApsScore(result: AttentionPriorityResult): ScoreDecompositionReport {
  const { rankInputs, score, category, informationFreshness } = result;

  const componentList: { name: string; score: ComponentScore }[] = [
    { name: 'abnormality', score: rankInputs.abnormality },
    { name: 'baselineDeviation', score: rankInputs.baselineDeviation },
    { name: 'velocity', score: rankInputs.velocity },
    { name: 'informationDecay', score: rankInputs.informationDecay },
    { name: 'signalConfidence', score: rankInputs.signalConfidence },
    { name: 'mews', score: rankInputs.mews },
    { name: 'qsofa', score: rankInputs.qsofa },
    { name: 'biomarkers', score: rankInputs.biomarkers },
    { name: 'missingInfo', score: rankInputs.missingInfo },
  ];

  const compositeRaw = componentList.reduce(
    (sum, item) => sum + item.score.weightedContribution,
    0
  );

  // Breakdown of each component
  const components: ComponentContributionBreakdown[] = componentList.map((item) => {
    const weighted = item.score.weightedContribution;
    const percentage = compositeRaw > 0 ? Number(((weighted / compositeRaw) * 100).toFixed(1)) : 0;

    return {
      componentName: item.name,
      rawScore: item.score.rawScore,
      normalizedContribution: item.score.normalizedContribution,
      weight: item.score.weight,
      weightedContribution: weighted,
      percentageOfComposite: percentage,
      explanation: item.score.explanation,
    };
  });

  // Identify dominant driver
  let maxComponent = components[0];
  for (const c of components) {
    if (c.weightedContribution > maxComponent.weightedContribution) {
      maxComponent = c;
    }
  }

  // Check for floor overrides
  let appliedOverrideFloor: ScoreDecompositionReport['appliedOverrideFloor'] = undefined;
  if (score > Math.round(compositeRaw)) {
    if (rankInputs.qsofa.rawScore >= 2) {
      appliedOverrideFloor = {
        floorName: 'QSOFA_SEPSIS_SAFETY_FLOOR',
        floorScore: score,
        rationale: 'Positive qSOFA (>=2) mandates minimum critical floor.',
      };
    } else if (rankInputs.mews.rawScore >= 5) {
      appliedOverrideFloor = {
        floorName: 'MEWS_SEVERE_SAFETY_FLOOR',
        floorScore: score,
        rationale: 'Severe Subbe MEWS (>=5) mandates minimum critical review floor.',
      };
    } else if (rankInputs.biomarkers.rawScore >= 65) {
      appliedOverrideFloor = {
        floorName: 'ELEVATED_LACTATE_FLOOR',
        floorScore: score,
        rationale: 'Elevated serum lactate (>=2.0 mmol/L) flags occult hypoperfusion, establishing minimum WATCH floor.',
      };
    } else if (informationFreshness?.isIntervalExceeded && maxComponent.weightedContribution < 25) {
      appliedOverrideFloor = {
        floorName: 'EPISTEMIC_TIMEOUT_FLOOR',
        floorScore: score,
        rationale: 'Observation interval exceeded; elevated to WATCH status for bedside check.',
      };
    }
  }

  const epistemic = informationFreshness?.physiologicalRiskVsUncertainty;

  return {
    patientId: result.patientId,
    finalScore: score,
    category,
    compositeRawScore: Number(compositeRaw.toFixed(2)),
    appliedOverrideFloor,
    components,
    epistemicVsPhysiological: {
      physiologicalScore: epistemic?.physiologicalScore ?? 0,
      uncertaintyScore: epistemic?.uncertaintyScore ?? 0,
      uncertaintyIndex: informationFreshness?.uncertaintyIndex ?? 0,
      couplingMultiplier: epistemic?.couplingMultiplier ?? 1.0,
      freshnessScore: informationFreshness?.freshnessScore ?? 100,
      epistemicCategory: informationFreshness?.epistemicRiskCategory ?? 'FRESH',
      decouplingExplanation: epistemic?.explanation ?? 'Fully verified telemetry.',
    },
    dominantClinicalDriver: {
      componentName: maxComponent.componentName,
      contributionPercentage: maxComponent.percentageOfComposite,
      description: maxComponent.explanation,
    },
    topReasons: result.reasons.slice(0, 3).map((r) => r.description),
  };
}
