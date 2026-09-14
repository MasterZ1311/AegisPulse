import type { MEWSExplanation, MEWSResult } from './types';

export function explainMEWS(result: MEWSResult): MEWSExplanation {
  const details: string[] = [];

  for (const contrib of result.contributingVariables) {
    details.push(
      `${contrib.name}: ${contrib.value} ${contrib.unit} (+${contrib.points} pts - ${contrib.interpretation})`
    );
  }

  if (details.length === 0) {
    details.push('All recorded physiological parameters are within normal reference ranges (0 pts).');
  }

  let summary: string;
  let clinicalEscalation: string;

  switch (result.triageLevel) {
    case 'red':
      summary = `MEWS Score is ${result.totalScore}/14 (High Risk - Triage RED). Immediate clinical review indicated.`;
      clinicalEscalation =
        'Immediate notification of registrar/attending and Medical Emergency Team (MET) or Critical Care Outreach. Initiate continuous physiological monitoring.';
      break;
    case 'yellow':
      summary = `MEWS Score is ${result.totalScore}/14 (Moderate Risk - Triage YELLOW). Increased monitoring indicated.`;
      clinicalEscalation =
        'Notify charge nurse and ward medical team. Increase vital signs observation frequency to at least every 1-2 hours. Review care plan.';
      break;
    case 'green':
    default:
      summary = `MEWS Score is ${result.totalScore}/14 (Low Risk - Triage GREEN). Physiology stable.`;
      clinicalEscalation =
        'Continue standard ward routine vital signs monitoring (every 4-12 hours as per ward protocol).';
      break;
  }

  let missingDataWarning: string | undefined;
  if (result.missingValues.length > 0) {
    const missingNames = result.missingValues.map((v) => {
      switch (v) {
        case 'systolicBP':
          return 'Systolic BP';
        case 'heartRate':
          return 'Heart Rate';
        case 'respiratoryRate':
          return 'Respiratory Rate';
        case 'temperature':
          return 'Temperature';
        case 'avpu':
          return 'AVPU Consciousness';
        default:
          return v;
      }
    });

    const uncertaintyPct = Math.round(result.uncertainty * 100);
    missingDataWarning = `Incomplete data: ${missingNames.join(', ')} not recorded (${uncertaintyPct}% uncertainty). Score could reach up to ${result.maxPossibleScore} if unmeasured vitals are abnormal. Urgent measurement recommended.`;
  }

  return {
    summary,
    triageLevel: result.triageLevel,
    details,
    missingDataWarning,
    clinicalEscalation,
  };
}
