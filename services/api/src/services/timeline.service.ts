import {
  PatientTimelineRepository,
  createVitalTimelineEvent,
  createLabTimelineEvent,
  createActionTimelineEvent,
} from '@aegispulse/clinical';
import type {
  UnifiedTimelineEvent,
  TimelineQueryFilter,
  TimelineWindowChangesResponse,
  PriorityRiseAttributionResponse,
  LastManualAssessmentResponse,
  TrustedMeasurementsResponse,
} from '@aegispulse/types';
import { wardStateService } from './ward-state.service';

export class TimelineService {
  private readonly repo = new PatientTimelineRepository();

  constructor() {
    this.seedFromWardState();
  }

  public seedFromWardState(): void {
    const patients = wardStateService.getPatients();
    for (const patient of patients) {
      // Ingest initial observations
      const observations = wardStateService.getObservations(patient.id);
      for (const obs of observations) {
        this.repo.addEvent(
          createVitalTimelineEvent(obs, { bedNumber: patient.bedNumber })
        );
      }

      // Ingest initial labs
      const labs = wardStateService.getLabs(patient.id);
      for (const lab of labs) {
        this.repo.addEvent(createLabTimelineEvent(lab, { bedNumber: patient.bedNumber }));
      }

      // Ingest initial actions
      const actions = wardStateService.getActions(patient.id);
      for (const action of actions) {
        this.repo.addEvent(createActionTimelineEvent(action, { bedNumber: patient.bedNumber }));
      }
    }
  }

  public query(patientId: string, filter?: Partial<TimelineQueryFilter>): UnifiedTimelineEvent[] {
    wardStateService.getPatient(patientId); // Ensure patient exists
    return this.repo.query(patientId, filter);
  }

  public addEvent(event: UnifiedTimelineEvent): void {
    wardStateService.getPatient(event.patientId); // Ensure patient exists
    this.repo.addEvent(event);
  }

  public getChangesInWindow(
    patientId: string,
    windowHours: number = 4
  ): TimelineWindowChangesResponse {
    wardStateService.getPatient(patientId);
    return this.repo.getChangesInWindow(patientId, windowHours);
  }

  public getPriorityRiseAttribution(
    patientId: string,
    windowHours: number = 4
  ): PriorityRiseAttributionResponse {
    wardStateService.getPatient(patientId);
    return this.repo.getPriorityRiseAttribution(patientId, windowHours);
  }

  public getLastManualAssessment(patientId: string): LastManualAssessmentResponse {
    wardStateService.getPatient(patientId);
    return this.repo.getLastManualAssessment(patientId);
  }

  public getTrustedMeasurements(
    patientId: string,
    filter?: { since?: number; until?: number; vitalType?: string }
  ): TrustedMeasurementsResponse {
    wardStateService.getPatient(patientId);
    return this.repo.getTrustedMeasurements(patientId, filter);
  }

  public getRepository(): PatientTimelineRepository {
    return this.repo;
  }
}

export const timelineService = new TimelineService();
