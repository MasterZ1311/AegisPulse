import { DatabaseSync } from 'node:sqlite';
import { SIX_WARD_PATIENT_PROFILES } from '@aegispulse/simulation';
import type { Ward, User, PhysiologicalObservation } from '@aegispulse/types';
import { WardRepository } from '../repositories/ward.repository';
import { PatientRepository } from '../repositories/patient.repository';
import { ObservationRepository } from '../repositories/observation.repository';
import { LabRepository } from '../repositories/lab.repository';
import { TimelineRepository } from '../repositories/timeline.repository';
import { AttentionRepository } from '../repositories/attention.repository';
import { ClinicalActionRepository } from '../repositories/clinical-action.repository';
import { UserRepository } from '../repositories/user.repository';

export interface SeedResult {
  wardsCount: number;
  bedsCount: number;
  patientsCount: number;
  labsCount: number;
  observationsCount: number;
  timelineEventsCount: number;
  usersCount: number;
}

export function seedDatabase(db: DatabaseSync): SeedResult {
  const wardRepo = new WardRepository(db);
  const patientRepo = new PatientRepository(db);
  const obsRepo = new ObservationRepository(db);
  const labRepo = new LabRepository(db);
  const timelineRepo = new TimelineRepository(db);
  const attentionRepo = new AttentionRepository(db);
  const actionRepo = new ClinicalActionRepository(db);
  const userRepo = new UserRepository(db);

  const now = Date.now();

  // 1. Seed Wards
  const wards: Ward[] = [
    {
      id: 'WARD-A',
      name: 'Step-Down & Acute Telemetry Ward 4A',
      code: 'STEP-4A',
      department: 'INTERNAL_MEDICINE',
      totalBeds: 6,
      nurseRatio: '1:6',
      activeNursesCount: 2,
      hospitalName: 'St. Jude General Hospital',
      isActive: true,
    },
    {
      id: 'WARD-4B',
      name: 'Acute Medical Ward 4B',
      code: 'MED-4B',
      department: 'INTERNAL_MEDICINE',
      totalBeds: 6,
      nurseRatio: '1:6',
      activeNursesCount: 2,
      hospitalName: 'St. Jude General Hospital',
      isActive: true,
    },
  ];

  for (const ward of wards) {
    wardRepo.upsertWard(ward);
  }

  // 2. Seed Users
  const users: User[] = [
    {
      id: 'usr-nurse-101',
      username: 'nurse_rachel',
      fullName: 'Rachel Hayes, RN',
      email: 'rachel.hayes@aegispulse.hospital.org',
      role: 'WARD_NURSE',
      assignedWardIds: ['WARD-A', 'WARD-4B'],
      badgeNumber: 'RN-4011',
      isActive: true,
      createdAt: now - 86400000 * 30,
    },
    {
      id: 'usr-nurse-102',
      username: 'charge_david',
      fullName: 'David Kim, BSN, RN',
      email: 'david.kim@aegispulse.hospital.org',
      role: 'CHARGE_NURSE',
      assignedWardIds: ['WARD-A', 'WARD-4B'],
      badgeNumber: 'RN-4012',
      isActive: true,
      createdAt: now - 86400000 * 60,
    },
    {
      id: 'usr-phys-201',
      username: 'dr_sarah',
      fullName: 'Dr. Sarah Lin, MD',
      email: 'sarah.lin@aegispulse.hospital.org',
      role: 'ATTENDING_PHYSICIAN',
      assignedWardIds: ['WARD-A', 'WARD-4B'],
      badgeNumber: 'MD-9201',
      isActive: true,
      createdAt: now - 86400000 * 90,
    },
    {
      id: 'usr-phys-202',
      username: 'dr_marcus',
      fullName: 'Dr. Marcus Vance, MD',
      email: 'marcus.vance@aegispulse.hospital.org',
      role: 'RESIDENT_PHYSICIAN',
      assignedWardIds: ['WARD-A', 'WARD-4B'],
      badgeNumber: 'MD-9202',
      isActive: true,
      createdAt: now - 86400000 * 45,
    },
    {
      id: 'usr-admin-001',
      username: 'admin',
      fullName: 'Hospital Systems Administrator',
      email: 'admin@aegispulse.hospital.org',
      role: 'ADMIN',
      assignedWardIds: ['WARD-A', 'WARD-4B'],
      badgeNumber: 'ADM-0001',
      isActive: true,
      createdAt: now - 86400000 * 180,
    },
  ];

  for (const u of users) {
    userRepo.upsertUser(u);
  }

  // 3. Seed Patients, Beds, Contexts, Labs & Observations from Simulator Profiles
  let totalLabs = 0;
  let totalObs = 0;
  let totalTimeline = 0;

  for (const profile of SIX_WARD_PATIENT_PROFILES) {
    const bed = { ...profile.bed, wardId: 'WARD-A' };
    const patient = { ...profile.patient, wardId: 'WARD-A' };

    wardRepo.upsertBed(bed);
    patientRepo.upsertPatient(patient);
    patientRepo.upsertClinicalContext(profile.clinicalContext);

    // Initial Labs
    for (const lab of profile.initialLabs) {
      labRepo.insertLab(lab);
      totalLabs++;

      timelineRepo.insertTimelineEvent({
        id: `tl-lab-${lab.id}`,
        patientId: patient.id,
        timestamp: lab.timestamp,
        eventType: 'LAB_RESULT',
        title: `Laboratory: ${lab.testName} (${lab.testCode})`,
        description: `${lab.testName} resulted: ${lab.value} ${lab.unit} (${lab.isCritical ? 'CRITICAL' : 'Normal Reference Range'}).`,
        severity: lab.isCritical ? 'CRITICAL' : 'INFO',
        source: 'LAB_LIS',
        isTrusted: true,
        data: { labId: lab.id, testCode: lab.testCode, value: lab.value, unit: lab.unit, isCritical: lab.isCritical },
      });
      totalTimeline++;
    }

    // Initial Baseline Observation
    const baselineObs: PhysiologicalObservation = {
      id: `obs-init-${patient.id}`,
      patientId: patient.id,
      timestamp: patient.admissionTimestamp + 3600000,
      source: 'OPTICAL_RPPG',
      confidence: 0.95,
      qualityState: 'TRUSTED',
      heartRate: profile.baselineVitals.heartRate,
      respiratoryRate: profile.baselineVitals.respiratoryRate,
      systolicBP: profile.baselineVitals.systolicBP,
      diastolicBP: profile.baselineVitals.diastolicBP,
      spo2: profile.baselineVitals.oxygenSaturation,
      temperature: profile.baselineVitals.bodyTemperature,
      hrv: 42,
    };
    obsRepo.insertObservation(baselineObs);
    totalObs++;

    // Initial Admission Timeline Event
    timelineRepo.insertTimelineEvent({
      id: `tl-adm-${patient.id}`,
      patientId: patient.id,
      timestamp: patient.admissionTimestamp,
      eventType: 'MANUAL_OBSERVATION',
      title: 'Ward Admission & Baseline Registration',
      description: `Admitted under ${patient.attendingPhysician}. Primary Diagnosis: ${patient.admissionDiagnosis}.`,
      severity: 'INFO',
      source: 'MANUAL_ENTRY',
      isTrusted: true,
      data: { mrn: patient.mrn, codeStatus: patient.codeStatus },
    });
    totalTimeline++;

    // Initial Bedside Action
    actionRepo.insertAction({
      id: `act-init-${patient.id}`,
      patientId: patient.id,
      bedId: patient.bedId,
      actionType: 'BEDSIDE_VISIT',
      title: 'Baseline Nursing Assessment',
      rationale: 'Initial admission vital signs and physical assessment.',
      status: 'COMPLETED',
      urgency: 'LOW',
      recommendedAt: patient.admissionTimestamp,
      targetCompletionTimestamp: patient.admissionTimestamp + 3600000,
      completedAt: patient.admissionTimestamp + 2400000,
      completedByUserId: 'usr-nurse-101',
      outcomeNotes: 'Patient resting comfortably. Vitals baseline recorded.',
    });

    // Initial Attention State
    const baseScore = patient.id === 'P002' ? 78 : patient.id === 'P003' ? 65 : 15;
    const category = baseScore >= 75 ? 'CRITICAL' : baseScore >= 50 ? 'HIGH' : 'LOW';
    const topReason = baseScore >= 75
      ? 'Progressive tachycardia and tachypnea detected over 40 minutes'
      : baseScore >= 50
      ? 'Elevated respiratory rate with impending hypoxia'
      : 'Physiological vitals stable within baseline limits';

    attentionRepo.setActiveAttentionState({
      id: `aps-init-${patient.id}`,
      patientId: patient.id,
      timestamp: Date.now(),
      score: baseScore,
      category,
      topReason,
      reasons: [
        {
          id: `rsn-1-${patient.id}`,
          category: 'PHYSIOLOGICAL',
          humanReadableExplanation: topReason,
          severity: category === 'CRITICAL' ? 'CRITICAL' : 'INFO',
          contribution: baseScore * 0.5,
          timestamp: Date.now(),
        },
      ],
      rankInputs: { mewsScore: patient.baselineMEWS, hr: profile.baselineVitals.heartRate },
      recommendedActions: ['Perform bedside vital verification', 'Check oxygen delivery'],
      confidence: 0.92,
    });
  }

  return {
    wardsCount: wards.length,
    bedsCount: SIX_WARD_PATIENT_PROFILES.length,
    patientsCount: SIX_WARD_PATIENT_PROFILES.length,
    labsCount: totalLabs,
    observationsCount: totalObs,
    timelineEventsCount: totalTimeline,
    usersCount: users.length,
  };
}
