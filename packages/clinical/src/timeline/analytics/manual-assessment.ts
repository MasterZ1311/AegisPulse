import type {
  UnifiedTimelineEvent,
  LastManualAssessmentResponse,
} from '@aegispulse/types';

export function analyzeLastManualAssessment(
  events: UnifiedTimelineEvent[],
  patientId: string,
  referenceTimestamp: number = Date.now(),
  overdueThresholdMinutes: number = 240 // Standard 4-hour medical ward check policy
): LastManualAssessmentResponse {
  // Sort events descending to find most recent assessment first
  const sorted = [...events].sort((a, b) => b.timestamp - a.timestamp);

  for (const ev of sorted) {
    if (ev.timestamp > referenceTimestamp) {
      continue; // Skip future events if any
    }

    let isManual = false;
    let assessmentType: 'MANUAL_OBSERVATION' | 'NURSE_VISIT' | 'CLINICAL_ACTION' = 'MANUAL_OBSERVATION';

    if (ev.eventType === 'MANUAL_OBSERVATION') {
      isManual = true;
      assessmentType = 'MANUAL_OBSERVATION';
    } else if (ev.eventType === 'NURSE_VISIT') {
      isManual = true;
      assessmentType = 'NURSE_VISIT';
    } else if (ev.eventType === 'COMPLETED_ACTION') {
      const actionType = ev.data?.actionType || ev.title;
      if (
        String(actionType).includes('VISIT') ||
        String(actionType).includes('MANUAL') ||
        String(actionType).includes('CHECK')
      ) {
        isManual = true;
        assessmentType = 'CLINICAL_ACTION';
      }
    }

    if (isManual) {
      const elapsedMinutes = Math.max(0, Math.floor((referenceTimestamp - ev.timestamp) / 60000));
      const hours = Math.floor(elapsedMinutes / 60);
      const minutes = elapsedMinutes % 60;
      const elapsedHuman = hours > 0 ? `${hours}h ${minutes}m ago` : `${minutes}m ago`;
      const isOverdue = elapsedMinutes > overdueThresholdMinutes;

      const assessedBy = ev.actorUserId ?? ev.data?.nurseName ?? ev.data?.performedBy ?? 'Staff Nurse';
      const assessorRole = ev.actorRole ?? ev.data?.role ?? 'WARD_NURSE';
      const findings = ev.description || ev.title || 'Bedside manual examination recorded.';

      return {
        patientId,
        lastAssessedTimestamp: ev.timestamp,
        referenceTimestamp,
        elapsedMinutes,
        elapsedHuman,
        assessedBy,
        assessorRole,
        assessmentType,
        findings,
        isOverdue,
        overdueThresholdMinutes,
      };
    }
  }

  // No manual assessment on record
  return {
    patientId,
    lastAssessedTimestamp: null,
    referenceTimestamp,
    elapsedMinutes: null,
    elapsedHuman: 'Never recorded',
    assessedBy: null,
    assessorRole: null,
    assessmentType: 'NONE',
    findings: 'No manual bedside assessment has been recorded for this patient in the active timeline.',
    isOverdue: true,
    overdueThresholdMinutes,
  };
}
