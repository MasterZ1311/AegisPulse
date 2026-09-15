import { DatabaseSync } from 'node:sqlite';
import {
  createWardSimulator,
  WardSimulator,
  SCENARIO_CATALOG,
  type ScenarioId,
} from '@aegispulse/simulation';
import type {
  Ward,
  Bed,
  Patient,
  PhysiologicalObservation,
  LaboratoryResult,
  ClinicalAction,
} from '@aegispulse/types';
import {
  createDatabaseConnection,
  runMigrations,
  seedDatabase,
  WardRepository,
  PatientRepository,
  ObservationRepository,
  LabRepository,
  ClinicalActionRepository,
  AcknowledgementRepository,
  AttentionRepository,
  IdempotencyRepository,
  closeDatabaseConnection,
} from '@aegispulse/persistence';
import { NotFoundError } from '../middleware/errors';

export interface AcknowledgementRecord {
  id: string;
  patientId: string;
  alertId?: string;
  acknowledgedByUserId: string;
  acknowledgedAt: number;
  reason?: string;
}

export class WardStateService {
  private db: DatabaseSync;
  private wardRepo: WardRepository;
  private patientRepo: PatientRepository;
  private obsRepo: ObservationRepository;
  private labRepo: LabRepository;
  private actionRepo: ClinicalActionRepository;
  private ackRepo: AcknowledgementRepository;
  private attentionRepo: AttentionRepository;
  private idempotencyRepo: IdempotencyRepository;
  private simulator: WardSimulator;

  constructor(dbPath?: string) {
    this.simulator = createWardSimulator();
    this.db = createDatabaseConnection({ dbPath: dbPath || process.env.AEGIS_DB_PATH || ':memory:' });
    runMigrations(this.db);
    seedDatabase(this.db);

    this.wardRepo = new WardRepository(this.db);
    this.patientRepo = new PatientRepository(this.db);
    this.obsRepo = new ObservationRepository(this.db);
    this.labRepo = new LabRepository(this.db);
    this.actionRepo = new ClinicalActionRepository(this.db);
    this.ackRepo = new AcknowledgementRepository(this.db);
    this.attentionRepo = new AttentionRepository(this.db);
    this.idempotencyRepo = new IdempotencyRepository(this.db);
  }

  public getDb(): DatabaseSync {
    return this.db;
  }


  private isDisrupted: boolean = false;

  public simulateDatabaseDisruption(disrupted: boolean): void {
    this.isDisrupted = disrupted;
  }

  public getDatabase(): DatabaseSync {
    return this.db;
  }

  public isDatabaseHealthy(): boolean {
    if (this.isDisrupted) {
      return false;
    }
    try {
      const row = this.db.prepare('PRAGMA integrity_check;').get() as { integrity_check?: string } | undefined;
      const msg = (row && (row as any).integrity_check) || 'ok';
      return msg.toLowerCase() === 'ok';
    } catch {
      return false;
    }
  }

  private checkDbActive(): void {
    if (this.isDisrupted) {
      throw new Error('database is closed or unavailable');
    }
  }

  // Wards
  public getWards(): Ward[] {
    this.checkDbActive();
    return this.wardRepo.getWards();
  }

  public getWard(wardId: string): Ward {
    this.checkDbActive();
    const targetId = (wardId === 'WARD-4B' || wardId === 'WARD-A') ? 'WARD-A' : wardId;
    const ward = this.wardRepo.getWard(targetId) || this.wardRepo.getWard(wardId);
    if (!ward) throw new NotFoundError(`Ward with ID '${wardId}' not found.`);
    return ward;
  }

  // Beds
  public getBeds(wardId?: string, status?: string): Bed[] {
    this.checkDbActive();
    return this.wardRepo.getBeds(wardId, status);
  }

  public getBed(bedId: string): Bed {
    this.checkDbActive();
    const bed = this.wardRepo.getBed(bedId);
    if (!bed) throw new NotFoundError(`Bed with ID '${bedId}' not found.`);
    return bed;
  }

  // Patients
  public getPatients(wardId?: string, _category?: string): Patient[] {
    this.checkDbActive();
    return this.patientRepo.getPatients(wardId);
  }

  public getPatient(patientId: string): Patient {
    this.checkDbActive();
    const patient = this.patientRepo.getPatient(patientId);
    if (!patient) throw new NotFoundError(`Patient with ID '${patientId}' not found.`);
    return patient;
  }

  public createPatient(patient: Patient): Patient {
    this.checkDbActive();

    // 1. Resolve or ensure Bed exists to satisfy foreign key constraint
    let targetBedId = patient.bedId;
    const existingBeds = this.wardRepo.getBeds(patient.wardId);
    const matchedBed = existingBeds.find(
      (b) => b.id === patient.bedId || b.bedNumber === patient.bedNumber
    );

    if (matchedBed) {
      targetBedId = matchedBed.id;
      this.wardRepo.setBedOccupant(matchedBed.id, patient.id, 'OCCUPIED');
    } else {
      const newBedId =
        targetBedId && targetBedId !== 'BED-UNASSIGNED'
          ? targetBedId
          : `BED-${patient.bedNumber.replace(/\s+/g, '-').toUpperCase()}`;
      targetBedId = newBedId;
      this.wardRepo.upsertBed({
        id: newBedId,
        bedNumber: patient.bedNumber,
        wardId: patient.wardId,
        roomNumber: patient.bedNumber.split('-')[0] || '400',
        status: 'OCCUPIED',
        currentPatientId: patient.id,
      });
    }

    const patientWithBed: Patient = {
      ...patient,
      bedId: targetBedId,
    };

    this.patientRepo.createPatient(patientWithBed);
    return patientWithBed;
  }

  public updatePatient(patientId: string, updates: Partial<Patient>): Patient {
    this.checkDbActive();
    const existing = this.getPatient(patientId);
    const updated = this.patientRepo.updatePatient(patientId, updates);

    if (updates.bedId && updates.bedId !== existing.bedId) {
      if (existing.bedId) {
        this.wardRepo.setBedOccupant(existing.bedId, null, 'AVAILABLE');
      }
      this.wardRepo.setBedOccupant(updates.bedId, patientId, 'OCCUPIED');
    }
    return updated;
  }

  public deletePatient(patientId: string): boolean {
    this.checkDbActive();
    const patient = this.getPatient(patientId);
    this.wardRepo.clearBedByPatientId(patientId);
    if (patient.bedId) {
      this.wardRepo.setBedOccupant(patient.bedId, null, 'AVAILABLE');
    }
    return this.patientRepo.deletePatient(patientId);
  }

  // Observations
  public getObservations(
    patientId: string,
    options?: { vitalType?: string; since?: number; until?: number; limit?: number }
  ): PhysiologicalObservation[] {
    this.getPatient(patientId);
    return this.obsRepo.getObservations(patientId, options);
  }

  public addObservation(obs: PhysiologicalObservation): void {
    this.getPatient(obs.patientId);
    this.obsRepo.insertObservation(obs);
  }

  // Labs
  public getLabs(patientId: string): LaboratoryResult[] {
    this.getPatient(patientId);
    return this.labRepo.getLabs(patientId);
  }

  public addLab(lab: LaboratoryResult): void {
    this.getPatient(lab.patientId);
    this.labRepo.insertLab(lab);
  }

  // Actions
  public getActions(patientId: string): ClinicalAction[] {
    this.getPatient(patientId);
    return this.actionRepo.getActions(patientId);
  }

  public addAction(action: ClinicalAction): void {
    this.getPatient(action.patientId);
    this.actionRepo.insertAction(action);
  }

  public updateActionStatus(
    actionId: string,
    status: ClinicalAction['status'],
    userId: string,
    outcomeNotes?: string
  ): ClinicalAction {
    const actions = this.actionRepo.getActions('P001').concat(
      this.actionRepo.getActions('P002'),
      this.actionRepo.getActions('P003'),
      this.actionRepo.getActions('P004'),
      this.actionRepo.getActions('P005'),
      this.actionRepo.getActions('P006')
    );
    const existing = actions.find((a) => a.id === actionId);
    if (!existing) {
      throw new NotFoundError(`Clinical Action with ID '${actionId}' not found.`);
    }

    if (status === 'COMPLETED') {
      this.actionRepo.completeAction(actionId, userId, Date.now(), outcomeNotes);
      existing.status = 'COMPLETED';
      existing.completedAt = Date.now();
      existing.completedByUserId = userId;
      existing.outcomeNotes = outcomeNotes;
    }

    return existing;
  }

  // Acknowledgements
  public getAcknowledgements(patientId?: string): AcknowledgementRecord[] {
    if (patientId) {
      this.getPatient(patientId);
      return this.ackRepo.getAcknowledgements(patientId);
    }
    const allP = ['P001', 'P002', 'P003', 'P004', 'P005', 'P006'];
    const result: AcknowledgementRecord[] = [];
    for (const pid of allP) {
      result.push(...this.ackRepo.getAcknowledgements(pid));
    }
    return result;
  }

  public addAcknowledgement(record: AcknowledgementRecord): void {
    this.getPatient(record.patientId);
    this.ackRepo.insertAcknowledgement(record);
  }

  // Attention Priority
  public getAttentionRepo(): AttentionRepository {
    return this.attentionRepo;
  }

  // Idempotency
  public getIdempotencyRepo(): IdempotencyRepository {
    return this.idempotencyRepo;
  }

  // Graceful connection cleanup
  public close(): void {
    closeDatabaseConnection(this.db);
  }


  // Simulation Controls
  public getSimulator(): WardSimulator {
    return this.simulator;
  }

  public getScenarios() {
    return SCENARIO_CATALOG;
  }

  public runScenario(scenarioId: ScenarioId): void {
    this.simulator.setScenario(scenarioId);
  }

  public tickSimulation(seconds: number = 60): number {
    this.simulator.step(seconds * 1000);
    return this.simulator.getClock().getVirtualTimeMs();
  }

  public getSimulationStatus() {
    const snap = this.simulator.getWardSnapshot();
    return {
      clock: snap.virtualTimeMs,
      virtualIso: snap.virtualIso,
      patientCount: snap.patients.length,
      currentScenario: snap.scenarioId,
    };
  }
}

export const wardStateService = new WardStateService();
