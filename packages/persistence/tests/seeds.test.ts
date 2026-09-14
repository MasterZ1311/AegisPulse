import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { runMigrations } from '../src/migrations/runner';
import { seedDatabase } from '../src/seeds/seed';
import { WardRepository } from '../src/repositories/ward.repository';
import { PatientRepository } from '../src/repositories/patient.repository';
import { ObservationRepository } from '../src/repositories/observation.repository';
import { AttentionRepository } from '../src/repositories/attention.repository';

describe('Simulator-Matched Seed Engine', () => {
  it('seeds database with complete six-patient ward environment', () => {
    const db = new DatabaseSync(':memory:');
    runMigrations(db);

    const result = seedDatabase(db);
    expect(result.wardsCount).toBe(2);
    expect(result.bedsCount).toBe(6);
    expect(result.patientsCount).toBe(6);
    expect(result.labsCount).toBeGreaterThanOrEqual(6);
    expect(result.observationsCount).toBe(6);
    expect(result.timelineEventsCount).toBeGreaterThanOrEqual(12);
    expect(result.usersCount).toBe(5);

    const wardRepo = new WardRepository(db);
    const patientRepo = new PatientRepository(db);
    const obsRepo = new ObservationRepository(db);
    const attentionRepo = new AttentionRepository(db);

    // Verify ward details
    const wardA = wardRepo.getWard('WARD-A');
    expect(wardA).toBeDefined();
    expect(wardA?.totalBeds).toBe(6);
    expect(wardA?.code).toBe('STEP-4A');

    // Verify beds and occupants
    const beds = wardRepo.getBeds('WARD-A');
    expect(beds.length).toBe(6);
    expect(beds[0].bedNumber).toBe('401-A');
    expect(beds[0].currentPatientId).toBe('P001');

    // Verify patient details
    const p1 = patientRepo.getPatient('P001');
    expect(p1).toBeDefined();
    expect(p1?.name).toBe('Ananya Ramanathan');
    expect(p1?.admissionDiagnosis).toContain('Cholecystectomy');

    // Verify clinical context
    const ctx1 = patientRepo.getClinicalContext('P001');
    expect(ctx1).toBeDefined();
    expect(ctx1?.patientId).toBe('P001');
    expect(ctx1?.baselineMEWS).toBe(0);

    // Verify baseline observations
    const obsList = obsRepo.getObservations('P001');
    expect(obsList.length).toBe(1);
    expect(obsList[0].source).toBe('OPTICAL_RPPG');
    expect(obsList[0].confidence).toBe(0.95);
    expect(obsList[0].heartRate).toBe(72);

    // Verify active attention priority state
    const aps = attentionRepo.getActiveAttentionState('P002');
    expect(aps).toBeDefined();
    expect(aps?.isActive).toBe(true);
    expect(aps?.category).toBe('CRITICAL');
    expect(aps?.score).toBe(78);
    expect(aps?.topReason).toContain('tachycardia');

    db.close();
  });
});
