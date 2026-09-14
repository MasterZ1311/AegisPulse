import type { QSOFAExplanation, QSOFAResult } from './types';

export function explainQSOFA(result: QSOFAResult): QSOFAExplanation {
  const details: string[] = [];

  for (const contrib of result.contributingVariables) {
    details.push(
      `${contrib.name}: ${contrib.value} ${contrib.unit} (+${contrib.points} pt - ${contrib.interpretation})`
    );
  }

  if (details.length === 0) {
    details.push('None of the three qSOFA criteria are met (0 pts).');
  }

  let summary: string;
  let clinicalEscalation: string;

  if (result.isPositive) {
    summary = `qSOFA Score is ${result.totalScore}/3 (POSITIVE Screen - High Risk). Strongly associated with in-hospital mortality and prolonged ICU stay.`;
    clinicalEscalation =
      'Immediately activate hospital sepsis pathway. Notify attending physician/critical care outreach, measure serum lactate, draw blood cultures prior to antibiotics, and initiate fluid resuscitation.';
  } else if (result.totalScore === 1) {
    summary = `qSOFA Score is 1/3 (Negative Screen - Intermediate Risk). 1 criteria met.`;
    clinicalEscalation =
      'Patient does not meet positive qSOFA cutoff (>=2), but possesses 1 physiological risk factor. Continue serial monitoring and assess for organ dysfunction if infection is suspected.';
  } else {
    summary = `qSOFA Score is 0/3 (Negative Screen - Low Risk). No criteria met.`;
    clinicalEscalation =
      'qSOFA negative. If infection is clinically suspected, continue routine vital signs surveillance and re-evaluate as indicated.';
  }

  let missingDataWarning: string | undefined;
  if (result.missingValues.length > 0) {
    const missingNames = result.missingValues.map((v) => {
      switch (v) {
        case 'respiratoryRate':
          return 'Respiratory Rate';
        case 'systolicBP':
          return 'Systolic BP';
        case 'alteredMentation':
          return 'Mental Status (GCS/AVPU)';
        default:
          return v;
      }
    });

    const uncertaintyPct = Math.round(result.uncertainty * 100);
    missingDataWarning = `Incomplete data: ${missingNames.join(', ')} not recorded (${uncertaintyPct}% uncertainty). Potential max score is ${result.maxPossibleScore}/3. Screen may become POSITIVE upon full assessment.`;
  }

  return {
    summary,
    isPositive: result.isPositive,
    details,
    missingDataWarning,
    clinicalEscalation,
  };
}
