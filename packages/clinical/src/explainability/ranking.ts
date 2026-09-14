import type { ExplainabilityOptions, Reason, ReasonSeverity } from './types';

const SEVERITY_BASE_SCORES: Record<ReasonSeverity, number> = {
  CRITICAL: 1000,
  HIGH: 500,
  MEDIUM: 200,
  LOW: 50,
};

/**
 * Deterministically ranks and selects the top 3 to 5 most meaningful clinical reasons.
 * Uses a clinical severity score combined with a cross-category diversity filter.
 */
export function rankAndCurateReasons(
  candidateReasons: Reason[],
  options: ExplainabilityOptions = {}
): Reason[] {
  const { maxReasons = 4, minSeverity, enableDiversityFilter = true } = options;

  // Filter by minimum severity if specified
  let filtered = candidateReasons;
  if (minSeverity) {
    const minVal = SEVERITY_BASE_SCORES[minSeverity];
    filtered = filtered.filter((r) => SEVERITY_BASE_SCORES[r.severity] >= minVal);
    // If filtering eliminated everything, fall back to original candidates
    if (filtered.length === 0) {
      filtered = candidateReasons;
    }
  }

  // Calculate raw clinical priority score for each reason
  const scored = filtered.map((r) => {
    const sevScore = SEVERITY_BASE_SCORES[r.severity];
    const impactScore = r.contribution.scoreImpact * 10;
    const weightScore = r.contribution.normalizedWeight * 100;
    const basePriority = sevScore + impactScore + weightScore;
    return {
      reason: r,
      basePriority,
    };
  });

  // Sort descending by raw priority
  scored.sort((a, b) => b.basePriority - a.basePriority);

  // Apply diversity filter if enabled
  const curated: Reason[] = [];
  const categoryCounts: Record<string, number> = {};

  // Selection loop prioritizing diverse clinical categories
  const remaining = [...scored];

  while (remaining.length > 0 && curated.length < maxReasons) {
    // Re-score candidates based on category saturation
    let bestIndex = 0;
    let bestAdjustedScore = -1;

    for (let i = 0; i < remaining.length; i++) {
      const item = remaining[i];
      const cat = item.reason.category;
      const count = categoryCounts[cat] ?? 0;

      let multiplier = 1.0;
      if (enableDiversityFilter && count > 0) {
        // First duplicate dampened to 0.45, second to 0.20
        multiplier = item.reason.severity === 'CRITICAL' ? 0.75 : 0.45 ** count;
      }

      const adjustedScore = item.basePriority * multiplier;
      if (adjustedScore > bestAdjustedScore) {
        bestAdjustedScore = adjustedScore;
        bestIndex = i;
      }
    }

    const selected = remaining.splice(bestIndex, 1)[0];
    const cat = selected.reason.category;
    categoryCounts[cat] = (categoryCounts[cat] ?? 0) + 1;

    curated.push({
      ...selected.reason,
      priorityRank: curated.length + 1,
    });
  }

  return curated;
}
