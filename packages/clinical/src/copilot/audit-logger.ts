import type { CopilotAuditRecord } from '@aegispulse/types';

export class CopilotAuditLogger {
  private readonly records: CopilotAuditRecord[] = [];

  /**
   * Appends an immutable audit entry to the audit log.
   */
  public log(record: CopilotAuditRecord): void {
    // Store an immutable clone
    this.records.push(Object.freeze({ ...record }));
  }

  /**
   * Retrieves an audit record by ID.
   */
  public getById(id: string): CopilotAuditRecord | undefined {
    return this.records.find((r) => r.id === id);
  }

  /**
   * Retrieves all audit logs for a specific patient.
   */
  public getLogsForPatient(patientId: string): CopilotAuditRecord[] {
    return this.records.filter((r) => r.patientId === patientId);
  }

  /**
   * Retrieves all audit records in chronological order.
   */
  public getAllLogs(): CopilotAuditRecord[] {
    return [...this.records];
  }

  /**
   * Clears audit logs (primarily for testing fixtures).
   */
  public clear(): void {
    this.records.length = 0;
  }

  /**
   * Returns count of total audit events logged.
   */
  public get count(): number {
    return this.records.length;
  }
}

/**
 * Singleton instance for shared clinical copilot logging across the application.
 */
export const defaultCopilotAuditLogger = new CopilotAuditLogger();
