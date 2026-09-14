import type {
  UnifiedTimelineEvent,
  TimelineQueryFilter,
  TimelineWindowChangesResponse,
  PriorityRiseAttributionResponse,
  LastManualAssessmentResponse,
  TrustedMeasurementsResponse,
} from '@aegispulse/types';
import { TimelineStore } from './store';
import { analyzeWindowChanges } from './analytics/window-changes';
import { analyzePriorityRise } from './analytics/priority-attribution';
import { analyzeLastManualAssessment } from './analytics/manual-assessment';
import { analyzeTrustedMeasurements } from './analytics/trusted-measurements';

/**
 * Multi-Patient Chronological Timeline Repository
 * Manages per-patient TimelineStore instances and answers high-level clinical questions.
 */
export class PatientTimelineRepository {
  private readonly stores = new Map<string, TimelineStore>();

  public getStore(patientId: string): TimelineStore {
    let store = this.stores.get(patientId);
    if (!store) {
      store = new TimelineStore();
      this.stores.set(patientId, store);
    }
    return store;
  }

  public addEvent(event: UnifiedTimelineEvent): void {
    this.getStore(event.patientId).add(event);
  }

  public addEvents(events: UnifiedTimelineEvent[]): void {
    for (const ev of events) {
      this.addEvent(ev);
    }
  }

  public query(patientId: string, filter?: Partial<TimelineQueryFilter>): UnifiedTimelineEvent[] {
    return this.getStore(patientId).query(filter);
  }

  /**
   * Question 1: "What changed during the last 4 hours?"
   */
  public getChangesInWindow(
    patientId: string,
    windowHours: number = 4,
    referenceTimestamp: number = Date.now()
  ): TimelineWindowChangesResponse {
    const events = this.getStore(patientId).query();
    return analyzeWindowChanges(events, patientId, windowHours, referenceTimestamp);
  }

  /**
   * Question 2: "What caused the patient's priority to rise?"
   */
  public getPriorityRiseAttribution(
    patientId: string,
    evaluationWindowHours: number = 4,
    referenceTimestamp: number = Date.now()
  ): PriorityRiseAttributionResponse {
    const events = this.getStore(patientId).query();
    return analyzePriorityRise(events, patientId, evaluationWindowHours, referenceTimestamp);
  }

  /**
   * Question 3: "When was the patient last manually assessed?"
   */
  public getLastManualAssessment(
    patientId: string,
    referenceTimestamp: number = Date.now(),
    overdueThresholdMinutes: number = 240
  ): LastManualAssessmentResponse {
    const events = this.getStore(patientId).query();
    return analyzeLastManualAssessment(events, patientId, referenceTimestamp, overdueThresholdMinutes);
  }

  /**
   * Question 4: "Which measurements were trusted?"
   */
  public getTrustedMeasurements(
    patientId: string,
    filter?: { since?: number; until?: number; vitalType?: string }
  ): TrustedMeasurementsResponse {
    const events = this.getStore(patientId).query();
    return analyzeTrustedMeasurements(events, patientId, filter);
  }

  public getAllPatientIds(): string[] {
    return Array.from(this.stores.keys());
  }

  public clear(patientId?: string): void {
    if (patientId) {
      this.stores.get(patientId)?.clear();
    } else {
      this.stores.clear();
    }
  }
}
