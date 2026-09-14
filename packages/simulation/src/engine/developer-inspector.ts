import type { DeveloperGroundTruthSnapshot } from '../models/ground-truth';

/**
 * Developer-only inspection and diagnostic utilities.
 * Used for bench testing, algorithmic verification, and sensor error analysis.
 */
export class DeveloperInspector {
  /**
   * Format developer ground truth snapshot into a structured ASCII report.
   */
  public static formatReport(snapshot: DeveloperGroundTruthSnapshot): string {
    const lines: string[] = [];
    lines.push('========================================================================================');
    lines.push(`AEGISPULSE DEVELOPER GROUND TRUTH DIAGNOSTIC REPORT`);
    lines.push(`Virtual Time: ${snapshot.simulationIso} | Active Scenario: ${snapshot.activeScenarioId}`);
    lines.push('========================================================================================');
    lines.push('BED   | ID    | PATIENT              | TRUE HR/RR/BP     | OBSERVED HR/RR/BP | SQI / STATE  | DELTA HR/RR | PHENOMENA');
    lines.push('------+-------+----------------------+-------------------+-------------------+--------------+-------------+----------');

    for (const p of snapshot.patients) {
      const trueVitals = `${p.trueVitals.heartRate}/${p.trueVitals.respiratoryRate} (${p.trueVitals.systolicBP}/${p.trueVitals.diastolicBP})`;
      const obsVitals = `${p.observedVitalsSummary.observedHR ?? '--'}/${p.observedVitalsSummary.observedRR ?? '--'} (${p.observedVitalsSummary.observedSysBP ?? '--'}/${p.observedVitalsSummary.observedDiaBP ?? '--'})`;
      const sqiState = `${p.observedVitalsSummary.sqiPercentage}% [${p.observedVitalsSummary.sensorQualityState}]`;
      const deltas = `HR: ${p.noiseDelta.hrDelta >= 0 ? '+' : ''}${p.noiseDelta.hrDelta} | RR: ${p.noiseDelta.rrDelta >= 0 ? '+' : ''}${p.noiseDelta.rrDelta}`;
      const phenomena = p.activePhenomena.length > 0 ? p.activePhenomena.join(', ') : 'None (Baseline)';

      lines.push(
        `${p.bedNumber.padEnd(6)}| ${p.patientId.padEnd(6)}| ${p.name.padEnd(21)}| ${trueVitals.padEnd(18)}| ${obsVitals.padEnd(18)}| ${sqiState.padEnd(13)}| ${deltas.padEnd(12)}| ${phenomena}`
      );
    }

    lines.push('========================================================================================');
    return lines.join('\n');
  }

  /**
   * Verify that sensor error deltas stay within expected bounds when sensor is TRUSTED.
   */
  public static verifySensorAccuracy(
    snapshot: DeveloperGroundTruthSnapshot,
    patientId: string,
    maxAllowedHrDelta: number = 3.0
  ): boolean {
    const patient = snapshot.patients.find((p) => p.patientId === patientId);
    if (!patient) {
      throw new Error(`Patient ${patientId} not found in snapshot`);
    }

    if (patient.observedVitalsSummary.sensorQualityState !== 'TRUSTED') {
      return true; // Not in trusted regime
    }

    return Math.abs(patient.noiseDelta.hrDelta) <= maxAllowedHrDelta;
  }
}
