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
import { TimelineRepository } from '@aegispulse/persistence';
import { wardStateService } from './ward-state.service';

export class TimelineService {
  private readonly repo = new PatientTimelineRepository();
  private readonly persistentRepo: TimelineRepository;

  constructor() {
    this.persistentRepo = new TimelineRepository(wardStateService.getDatabase());
    this.seedFromWardState();
  }

  public seedFromWardState(): void {
    const patients = wardStateService.getPatients();
    for (const patient of patients) {
      // 1. Ingest already persisted events from SQLite
      const existingInDb = this.persistentRepo.getTimelineEvents(patient.id);
      for (const ev of existingInDb) {
        this.repo.addEvent(ev);
      }

      // 2. Ingest initial observations
      const observations = wardStateService.getObservations(patient.id);
      for (const obs of observations) {
        const ev = createVitalTimelineEvent(obs, { bedNumber: patient.bedNumber });
        this.repo.addEvent(ev);
        this.persistentRepo.insertTimelineEvent(ev);
      }

      // 3. Ingest initial labs
      const labs = wardStateService.getLabs(patient.id);
      for (const lab of labs) {
        const ev = createLabTimelineEvent(lab, { bedNumber: patient.bedNumber });
        this.repo.addEvent(ev);
        this.persistentRepo.insertTimelineEvent(ev);
      }

      // 4. Ingest initial actions
      const actions = wardStateService.getActions(patient.id);
      for (const action of actions) {
        const ev = createActionTimelineEvent(action, { bedNumber: patient.bedNumber });
        this.repo.addEvent(ev);
        this.persistentRepo.insertTimelineEvent(ev);
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
    this.persistentRepo.insertTimelineEvent(event);
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

  public getPersistentRepository(): TimelineRepository {
    return this.persistentRepo;
  }
}

export const timelineService = new TimelineService();
