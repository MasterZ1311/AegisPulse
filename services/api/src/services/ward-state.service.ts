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
  private simulator: WardSimulator;
  private wards: Map<string, Ward> = new Map();
  private beds: Map<string, Bed> = new Map();
  private patients: Map<string, Patient> = new Map();
  private observations: Map<string, PhysiologicalObservation[]> = new Map();
  private labs: Map<string, LaboratoryResult[]> = new Map();
  private actions: Map<string, ClinicalAction[]> = new Map();
  private acknowledgements: AcknowledgementRecord[] = [];

  constructor() {
    this.simulator = createWardSimulator();
    this.initializeWardState();
  }

  private initializeWardState(): void {
    // 1. Initialize Wards
    const wardA: Ward = {
      id: 'WARD-A',
      name: 'Step-Down & Acute Telemetry Ward 4A',
      code: 'STEP-4A',
      department: 'INTERNAL_MEDICINE',
      totalBeds: 6,
      nurseRatio: '1:6',
      activeNursesCount: 2,
      hospitalName: 'St. Jude General Hospital',
      isActive: true,
    };
    this.wards.set(wardA.id, wardA);

    const ward4B: Ward = {
      id: 'WARD-4B',
      name: 'Acute Medical Ward 4B',
      code: 'MED-4B',
      department: 'INTERNAL_MEDICINE',
      totalBeds: 6,
      nurseRatio: '1:6',
      activeNursesCount: 2,
      hospitalName: 'St. Jude General Hospital',
      isActive: true,
    };
    this.wards.set(ward4B.id, ward4B);

    // 2. Initialize Beds & Patients from Simulator Snapshot
    const snapshot = this.simulator.getWardSnapshot();

    for (const bed of snapshot.beds) {
      this.beds.set(bed.id, { ...bed, wardId: 'WARD-A' });
    }

    for (const patient of snapshot.patients) {
      this.patients.set(patient.id, { ...patient, wardId: 'WARD-A' });

      // Seed initial observations from snapshot
      const rawObs = snapshot.latestObservations[patient.id] || [];
      const pObs: PhysiologicalObservation[] = rawObs.map((ro: any) => ({
        id: ro.id,
        patientId: patient.id,
        timestamp: ro.timestamp,
        source: ro.source,
        confidence: ro.confidence,
        qualityState: ro.qualityStatus === 'DEGRADED' || ro.qualityStatus === 'INVALID' ? 'DEGRADED' : 'TRUSTED',
        heartRate: ro.vitalType === 'HEART_RATE' ? ro.value : undefined,
        respiratoryRate: ro.vitalType === 'RESPIRATORY_RATE' ? ro.value : undefined,
        systolicBP: ro.vitalType === 'SYSTOLIC_BP' ? ro.value : undefined,
        diastolicBP: ro.vitalType === 'DIASTOLIC_BP' ? ro.value : undefined,
      }));
      this.observations.set(patient.id, pObs);

      // Seed initial labs
      const pLabs = snapshot.labs[patient.id] || [];
      this.labs.set(patient.id, [...pLabs]);

      // Seed initial action
      this.actions.set(patient.id, [
        {
          id: `act-init-${patient.id}`,
          patientId: patient.id,
          bedId: patient.bedId,
          actionType: 'BEDSIDE_VISIT',
          title: 'Initial Shift Nursing Assessment',
          rationale: 'Baseline admission vital check',
          status: 'COMPLETED',
          urgency: 'LOW',
          recommendedAt: Date.now() - 3 * 3600 * 1000,
          targetCompletionTimestamp: Date.now() - 2 * 3600 * 1000,
          completedAt: Date.now() - 2.5 * 3600 * 1000,
          completedByUserId: 'usr-nurse-101',
          outcomeNotes: 'Patient oriented x 4. Vitals stable.',
        },
      ]);
    }
  }

  // Wards
  public getWards(): Ward[] {
    return Array.from(this.wards.values());
  }

  public getWard(wardId: string): Ward {
    let ward = this.wards.get(wardId);
    if (!ward && (wardId === 'WARD-4B' || wardId === 'WARD-A')) {
      ward = this.wards.get('WARD-A') || this.wards.get('WARD-4B');
    }
    if (!ward) throw new NotFoundError(`Ward with ID '${wardId}' not found.`);
    return ward;
  }

  // Beds
  public getBeds(wardId?: string, status?: string): Bed[] {
    let result = Array.from(this.beds.values());
    if (wardId) {
      const targetWardId = (wardId === 'WARD-4B' || wardId === 'WARD-A') ? 'WARD-A' : wardId;
      result = result.filter((b) => b.wardId === targetWardId || b.wardId === wardId);
    }
    if (status) result = result.filter((b) => b.status === status);
    return result;
  }

  public getBed(bedId: string): Bed {
    const bed = this.beds.get(bedId);
    if (!bed) throw new NotFoundError(`Bed with ID '${bedId}' not found.`);
    return bed;
  }

  // Patients
  public getPatients(wardId?: string, _category?: string): Patient[] {
    let result = Array.from(this.patients.values());
    if (wardId) {
      const targetWardId = (wardId === 'WARD-4B' || wardId === 'WARD-A') ? 'WARD-A' : wardId;
      result = result.filter((p) => p.wardId === targetWardId || p.wardId === wardId);
    }
    return result;
  }

  public getPatient(patientId: string): Patient {
    const patient = this.patients.get(patientId);
    if (!patient) throw new NotFoundError(`Patient with ID '${patientId}' not found.`);
    return patient;
  }

  // Observations
  public getObservations(patientId: string, options?: { vitalType?: string; since?: number; until?: number }): PhysiologicalObservation[] {
    this.getPatient(patientId);
    let list = this.observations.get(patientId) || [];
    if (options?.since !== undefined) list = list.filter((o) => o.timestamp >= options.since!);
    if (options?.until !== undefined) list = list.filter((o) => o.timestamp <= options.until!);
    return list;
  }

  public addObservation(obs: PhysiologicalObservation): void {
    this.getPatient(obs.patientId);
    let list = this.observations.get(obs.patientId);
    if (!list) {
      list = [];
      this.observations.set(obs.patientId, list);
    }
    list.push(obs);
  }

  // Labs
  public getLabs(patientId: string): LaboratoryResult[] {
    this.getPatient(patientId);
    return this.labs.get(patientId) || [];
  }

  public addLab(lab: LaboratoryResult): void {
    this.getPatient(lab.patientId);
    let list = this.labs.get(lab.patientId);
    if (!list) {
      list = [];
      this.labs.set(lab.patientId, list);
    }
    list.push(lab);
  }

  // Actions
  public getActions(patientId: string): ClinicalAction[] {
    this.getPatient(patientId);
    return this.actions.get(patientId) || [];
  }

  public addAction(action: ClinicalAction): void {
    this.getPatient(action.patientId);
    let list = this.actions.get(action.patientId);
    if (!list) {
      list = [];
      this.actions.set(action.patientId, list);
    }
    list.push(action);
  }

  public updateActionStatus(
    actionId: string,
    status: ClinicalAction['status'],
    userId: string,
    outcomeNotes?: string
  ): ClinicalAction {
    for (const list of this.actions.values()) {
      const action = list.find((a) => a.id === actionId);
      if (action) {
        action.status = status;
        if (status === 'COMPLETED') {
          action.completedAt = Date.now();
          action.completedByUserId = userId;
          action.outcomeNotes = outcomeNotes;
        }
        return action;
      }
    }
    throw new NotFoundError(`Clinical Action with ID '${actionId}' not found.`);
  }

  // Acknowledgements
  public getAcknowledgements(patientId?: string): AcknowledgementRecord[] {
    if (patientId) {
      this.getPatient(patientId);
      return this.acknowledgements.filter((a) => a.patientId === patientId);
    }
    return this.acknowledgements;
  }

  public addAcknowledgement(record: AcknowledgementRecord): void {
    this.getPatient(record.patientId);
    this.acknowledgements.push(record);
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
