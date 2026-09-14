import type { AttentionPriorityCategory, ClinicalActionType } from '@aegispulse/types';
import type { ClinicalActionRecommended } from './types';

export interface RecommendationContext {
  finalScore: number;
  category: AttentionPriorityCategory;
  isQSOFAPositive: boolean;
  isMEWSSevere: boolean;
  hasOccultShock: boolean;
  hasDegradedSignal: boolean;
  isCriticallyStale: boolean;
  actionCandidates: ClinicalActionType[];
}

export function buildRecommendations(ctx: RecommendationContext): {
  recommendedActions: ClinicalActionRecommended[];
  primaryRecommendedAction: string;
} {
  const actions: ClinicalActionRecommended[] = [];
  const actionTypesSeen = new Set<ClinicalActionType>();

  const addAction = (
    actionType: ClinicalActionType,
    title: string,
    rationale: string,
    urgency: AttentionPriorityCategory,
    windowMinutes: number
  ) => {
    if (!actionTypesSeen.has(actionType)) {
      actionTypesSeen.add(actionType);
      actions.push({
        actionType,
        title,
        rationale,
        urgency,
        targetCompletionWindowMinutes: windowMinutes,
      });
    }
  };

  // 1. Critical Emergency Triggers (qSOFA positive or Score >= 85)
  if (ctx.isQSOFAPositive || ctx.finalScore >= 85) {
    addAction(
      'RAPID_RESPONSE_TRIGGER',
      'Trigger Rapid Response / MET Activation',
      ctx.isQSOFAPositive
        ? 'qSOFA criteria met (>=2): High risk of septic shock and in-hospital mortality'
        : 'Critical multisystem physiological decompensation (APS >= 85)',
      'CRITICAL_REVIEW',
      5
    );
    addAction(
      'SBAR_PHYSICIAN_CONSULT',
      'Urgent SBAR Physician Handoff',
      'Notify covering resident/attending physician immediately with current trend vector',
      'CRITICAL_REVIEW',
      10
    );
    addAction(
      'ATTACH_CUFF',
      'Attach Automated Blood Pressure Cuff',
      'Cycle blood pressure every 5 minutes to monitor for septic vasodilation',
      'CRITICAL_REVIEW',
      10
    );
  } else if (ctx.finalScore >= 75 || ctx.isMEWSSevere || ctx.hasOccultShock) {
    // 2. Severe Review Tier (MEWS >= 5, Shock Index >= 1.1, or Score >= 75)
    addAction(
      'SBAR_PHYSICIAN_CONSULT',
      'Physician SBAR Clinical Review',
      ctx.hasOccultShock
        ? 'Critical Shock Index (HR/SBP >= 1.1) indicating occult hypoperfusion'
        : ctx.isMEWSSevere
          ? 'MEWS >= 5 acute physiological escalation threshold exceeded'
          : 'High priority deterioration trajectory detected',
      'CRITICAL_REVIEW',
      15
    );
    addAction(
      'MANUAL_VITALS_RECHECK',
      'Immediate Manual Vital Signs Verification',
      'Nurse bedside verification of heart rate, respiratory rate, and automated cuff pressure',
      'CRITICAL_REVIEW',
      10
    );
    addAction(
      'ATTACH_CUFF',
      'Attach Automated Blood Pressure Cuff',
      'Continuous interval hemodynamic monitoring',
      'CRITICAL_REVIEW',
      15
    );
  } else if (ctx.finalScore >= 55) {
    // 3. Evaluate Tier
    if (ctx.hasDegradedSignal) {
      addAction(
        'MANUAL_VITALS_RECHECK',
        'Bedside Vitals & Sensor Repositioning',
        'Optical telemetry degraded: verify sensor line-of-sight and record manual vitals',
        'EVALUATE',
        20
      );
      addAction(
        'ATTACH_CUFF',
        'Attach Automated Cuff',
        'Supplement optical sensors with automated cuff telemetry',
        'EVALUATE',
        20
      );
    } else {
      addAction(
        'MANUAL_VITALS_RECHECK',
        'Bedside Manual Vital Signs Check',
        'Physiological rate-of-change warrants direct bedside nursing evaluation',
        'EVALUATE',
        30
      );
      addAction(
        'BEDSIDE_VISIT',
        'Bedside Clinical Examination',
        'Assess patient work of breathing, skin perfusion, and mentation',
        'EVALUATE',
        30
      );
    }
  } else if (ctx.finalScore >= 30 || ctx.isCriticallyStale) {
    // 4. Watch Tier
    addAction(
      'BEDSIDE_VISIT',
      'Targeted Nursing Round',
      ctx.isCriticallyStale
        ? 'Information decay: record full bedside observation set'
        : 'Mild physiological trend: inspect patient at next scheduled round',
      'WATCH',
      60
    );
    if (ctx.actionCandidates.includes('MANUAL_VITALS_RECHECK')) {
      addAction(
        'MANUAL_VITALS_RECHECK',
        'Routine Vitals Verification',
        'Verify vital parameters during nursing round',
        'WATCH',
        60
      );
    }
  } else {
    // 5. Low / Routine Tier
    addAction(
      'BEDSIDE_VISIT',
      'Routine Surveillance Round',
      'Patient stable; maintain standard ward round frequency',
      'LOW',
      120
    );
  }

  // Include any extra candidates requested by specific components
  for (const candidate of ctx.actionCandidates) {
    if (!actionTypesSeen.has(candidate)) {
      if (candidate === 'ATTACH_CUFF') {
        addAction(
          'ATTACH_CUFF',
          'Attach Automated BP Cuff',
          'Ensure blood pressure telemetry is available',
          ctx.category,
          45
        );
      } else if (candidate === 'MANUAL_VITALS_RECHECK') {
        addAction(
          'MANUAL_VITALS_RECHECK',
          'Manual Vitals Check',
          'Recheck vital signs to refresh observation set',
          ctx.category,
          45
        );
      }
    }
  }

  // Primary action is the highest urgency action
  const primaryAction = actions[0]?.title ?? 'Routine nursing surveillance';

  return {
    recommendedActions: actions,
    primaryRecommendedAction: primaryAction,
  };
}
