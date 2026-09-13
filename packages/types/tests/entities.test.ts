import { describe, it, expect } from 'vitest';
import {
  PatientSchema,
  BedSchema,
  WardSchema,
  ObservationSchema,
  ObservationEventSchema,
  TimelineEventSchema,
  AlertSchema,
  UserSchema,
  AuditEventSchema,
  TrendVectorSchema,
  SBARReportSchema,
  validatePatient,
  validateBed,
  validateWard,
  validateObservation,
  validateTimelineEvent,
  validateAlert,
  validateUser,
  validateAuditEvent,
  validateTrendVector,
  validateSBARReport,
} from '../src/index';

describe('AegisPulse Core Entities Validation Suite', () => {
  const validTimestamp = Date.now();
  const validProvenance = {
    derivedAt: validTimestamp,
    algorithm: 'AEGIS_TEST_RUNNER',
    algorithmVersion: '1.0.0',
    sourceObservationIds: ['obs-root-01'],
    confidence: 1.0,
  };

  describe('1. Patient Entity Validation', () => {
    it('accepts fully populated valid patient', () => {
      const patient = {
        id: 'pat-999',
        mrn: 'MRN-88231',
        name: 'John Doe',
        age: 64,
        gender: 'MALE',
        wardId: 'ward-surg-4b',
        bedId: 'bed-401a',
        bedNumber: '401-A',
        admissionDiagnosis: 'Post-Op Laparoscopic Hemicolectomy',
        admissionTimestamp: validTimestamp - 86400000,
        attendingPhysician: 'Dr. Sarah Lin, MD',
        primaryNurse: 'Nurse Alex Smith, RN',
        codeStatus: 'FULL_CODE',
        baselineMEWS: 1,
        allergies: ['Penicillin'],
        isolationStatus: 'NONE',
        isActive: true,
      };
      const res = validatePatient(patient);
      expect(res.success).toBe(true);
    });

    it('rejects patient with invalid age (< 0 or > 125)', () => {
      const negativeAge = PatientSchema.safeParse({
        id: 'pat-bad',
        name: 'Invalid Age Patient',
        age: -2,
        gender: 'MALE',
        bedNumber: '101',
        admissionDiagnosis: 'Check',
        admissionTimestamp: validTimestamp,
        baselineMEWS: 0,
      });
      const ancientAge = PatientSchema.safeParse({
        id: 'pat-bad-2',
        name: 'Invalid Age Patient',
        age: 130,
        gender: 'FEMALE',
        bedNumber: '101',
        admissionDiagnosis: 'Check',
        admissionTimestamp: validTimestamp,
        baselineMEWS: 0,
      });
      expect(negativeAge.success).toBe(false);
      expect(ancientAge.success).toBe(false);
    });

    it('rejects patient with invalid gender enum', () => {
      const badGender = PatientSchema.safeParse({
        id: 'pat-gender',
        name: 'Bad Gender',
        age: 40,
        gender: 'ALIEN',
        bedNumber: '101',
        admissionDiagnosis: 'Check',
        admissionTimestamp: validTimestamp,
        baselineMEWS: 0,
      });
      expect(badGender.success).toBe(false);
    });

    it('applies sensible defaults for non-critical patient metadata', () => {
      const parsed = PatientSchema.parse({
        id: 'pat-defaults',
        name: 'Minimal Patient',
        age: 45,
        gender: 'M',
        bedNumber: '402-B',
        admissionDiagnosis: 'Post-Op Observation',
        admissionTimestamp: validTimestamp,
        baselineMEWS: 0,
      });
      expect(parsed.mrn).toBe('MRN-AUTO');
      expect(parsed.wardId).toBe('WARD-GENERAL');
      expect(parsed.codeStatus).toBe('FULL_CODE');
      expect(parsed.attendingPhysician).toBe('Staff Attending');
      expect(parsed.allergies).toEqual([]);
    });
  });

  describe('2. Bed Entity Validation', () => {
    it('accepts compliant bed entity', () => {
      const bed = {
        id: 'bed-401a',
        bedNumber: '401-A',
        wardId: 'ward-surg-4b',
        roomNumber: '401',
        status: 'OCCUPIED',
        currentPatientId: 'pat-999',
        cameraDeviceId: 'cam-rppg-401a',
      };
      const res = validateBed(bed);
      expect(res.success).toBe(true);
    });

    it('rejects invalid bed status', () => {
      const badBed = BedSchema.safeParse({
        id: 'bed-bad',
        bedNumber: '401-A',
        wardId: 'ward-surg-4b',
        roomNumber: '401',
        status: 'DESTROYED',
      });
      expect(badBed.success).toBe(false);
    });
  });

  describe('3. Ward Entity Validation', () => {
    it('accepts valid hospital ward with strict nurse ratio format', () => {
      const ward = {
        id: 'ward-surg-4b',
        name: 'Surgical Step-Down Ward 4B',
        code: 'SURG-4B',
        department: 'General Surgery',
        totalBeds: 24,
        nurseRatio: '1:6',
        activeNursesCount: 4,
        hospitalName: 'Metro General Hospital',
        isActive: true,
      };
      const res = validateWard(ward);
      expect(res.success).toBe(true);
    });

    it('rejects malformed nurse ratio strings', () => {
      const badRatio = WardSchema.safeParse({
        id: 'ward-1',
        name: 'Ward One',
        code: 'W1',
        department: 'Medicine',
        totalBeds: 20,
        nurseRatio: 'one-to-six', // Must match /^1:[0-9]+$/
        activeNursesCount: 3,
        hospitalName: 'Hospital',
      });
      expect(badRatio.success).toBe(false);
    });

    it('rejects zero or excessive ward bed capacity', () => {
      const zeroBeds = WardSchema.safeParse({
        id: 'ward-0',
        name: 'Empty Ward',
        code: 'W0',
        department: 'Medicine',
        totalBeds: 0,
        nurseRatio: '1:4',
        activeNursesCount: 1,
        hospitalName: 'Hospital',
      });
      const excessiveBeds = WardSchema.safeParse({
        id: 'ward-max',
        name: 'Mega Ward',
        code: 'WMAX',
        department: 'Medicine',
        totalBeds: 101,
        nurseRatio: '1:4',
        activeNursesCount: 1,
        hospitalName: 'Hospital',
      });
      expect(zeroBeds.success).toBe(false);
      expect(excessiveBeds.success).toBe(false);
    });
  });

  describe('4. Observation Entity Validation & Safety Invariants', () => {
    it('accepts valid heart rate observation with explicit unit matching', () => {
      const obs = {
        id: 'obs-01',
        patientId: 'pat-999',
        bedId: 'bed-401a',
        timestamp: validTimestamp,
        source: 'BEDSIDE_DEVICE',
        vitalType: 'HEART_RATE',
        value: 78,
        unit: 'BPM',
        confidence: 0.96,
        qualityStatus: 'TRUSTED',
      };
      const res = validateObservation(obs);
      expect(res.success).toBe(true);
    });

    it('rejects mismatched units for vitalType (e.g. Heart Rate in MMHG)', () => {
      const badUnit = ObservationSchema.safeParse({
        id: 'obs-bad-unit',
        patientId: 'pat-999',
        bedId: 'bed-401a',
        timestamp: validTimestamp,
        source: 'BEDSIDE_DEVICE',
        vitalType: 'HEART_RATE',
        value: 78,
        unit: 'MMHG',
        confidence: 0.96,
        qualityStatus: 'TRUSTED',
      });
      expect(badUnit.success).toBe(false);
      if (!badUnit.success) {
        expect(badUnit.error.issues[0].message).toContain("Invalid unit 'MMHG' for vital type 'HEART_RATE'");
      }
    });

    it('rejects out of boundary physiological values', () => {
      const impossibleRR = ObservationSchema.safeParse({
        id: 'obs-bad-rr',
        patientId: 'pat-999',
        bedId: 'bed-401a',
        timestamp: validTimestamp,
        source: 'OPTICAL_RPPG',
        vitalType: 'RESPIRATORY_RATE',
        value: 95, // Max limit is 80
        unit: 'BREATHS_PER_MINUTE',
        confidence: 0.85,
        qualityStatus: 'TRUSTED',
      });
      expect(impossibleRR.success).toBe(false);
    });

    it('STRICT SAFETY ENFORCEMENT: Rejects SpO2 observation originating from OPTICAL_RPPG', () => {
      const rppgSpO2 = ObservationSchema.safeParse({
        id: 'obs-illegal-spo2',
        patientId: 'pat-999',
        bedId: 'bed-401a',
        timestamp: validTimestamp,
        source: 'OPTICAL_RPPG',
        vitalType: 'OXYGEN_SATURATION',
        value: 98,
        unit: 'PERCENT',
        confidence: 0.9,
        qualityStatus: 'TRUSTED',
      });
      expect(rppgSpO2.success).toBe(false);
      if (!rppgSpO2.success) {
        expect(rppgSpO2.error.issues[0].message).toContain('SAFETY VIOLATION: SpO2 cannot originate from OPTICAL_RPPG');
      }
    });

    it('MANDATORY PROVENANCE: Rejects derived observation without Provenance', () => {
      const derivedWithoutProv = ObservationSchema.safeParse({
        id: 'obs-derived-no-prov',
        patientId: 'pat-999',
        bedId: 'bed-401a',
        timestamp: validTimestamp,
        source: 'DERIVED',
        vitalType: 'SHOCK_INDEX',
        value: 0.8,
        unit: 'RATIO',
        confidence: 0.95,
        qualityStatus: 'TRUSTED',
      });
      expect(derivedWithoutProv.success).toBe(false);
      if (!derivedWithoutProv.success) {
        expect(derivedWithoutProv.error.issues[0].message).toContain('PROVENANCE REQUIRED');
      }
    });
  });

  describe('5. Stream ObservationEvent Schema', () => {
    it('accepts valid ingested observation event', () => {
      const event = {
        id: 'evt-01',
        patientId: 'pat-999',
        timestamp: validTimestamp,
        eventType: 'OBSERVATION_INGESTED',
        observation: {
          id: 'obs-01',
          patientId: 'pat-999',
          bedId: 'bed-401a',
          timestamp: validTimestamp,
          source: 'BEDSIDE_DEVICE',
          vitalType: 'HEART_RATE',
          value: 78,
          unit: 'BPM',
          confidence: 0.96,
          qualityStatus: 'TRUSTED',
        },
      };
      const res = ObservationEventSchema.safeParse(event);
      expect(res.success).toBe(true);
    });
  });

  describe('6. TimelineEvent, Alert, User, and AuditEvent Entities', () => {
    it('accepts valid TimelineEvent', () => {
      const timeline = {
        id: 'time-01',
        patientId: 'pat-999',
        bedNumber: '401-A',
        timestamp: validTimestamp,
        eventType: 'ATTENTION_ESCALATION',
        title: 'Priority Escalated to CRITICAL_REVIEW',
        description: 'Tachycardia velocity spike coupled with 3.5 hours since last manual observation',
        severity: 'CRITICAL',
      };
      const res = validateTimelineEvent(timeline);
      expect(res.success).toBe(true);
      expect(TimelineEventSchema.safeParse(timeline).success).toBe(true);
    });

    it('accepts valid Alert', () => {
      const alert = {
        id: 'alt-01',
        patientId: 'pat-999',
        bedNumber: '401-A',
        timestamp: validTimestamp,
        severity: 'WARNING',
        status: 'ACTIVE',
        code: 'VELOCITY_HR_SPIKE',
        title: 'Rapid Heart Rate Acceleration',
        message: 'Heart rate +22% over 35 minutes; assess for hypovolemia or developing sepsis',
        isAcknowledged: false,
      };
      const res = validateAlert(alert);
      expect(res.success).toBe(true);
      expect(AlertSchema.safeParse(alert).success).toBe(true);
    });

    it('validates User entity and rejects malformed email', () => {
      const validUser = {
        id: 'usr-1',
        username: 'nurse.sarah',
        fullName: 'Sarah Jenkins, RN',
        email: 'sjenkins@hospital.org',
        role: 'WARD_NURSE',
        assignedWardIds: ['ward-surg-4b'],
        badgeNumber: 'RN-9021',
        isActive: true,
        createdAt: validTimestamp,
      };
      const res = validateUser(validUser);
      expect(res.success).toBe(true);

      const badEmailUser = UserSchema.safeParse({
        ...validUser,
        email: 'not-an-email',
      });
      expect(badEmailUser.success).toBe(false);
    });

    it('accepts compliant AuditEvent for regulatory compliance', () => {
      const audit = {
        id: 'audit-001',
        timestamp: validTimestamp,
        actorId: 'usr-1',
        actorRole: 'WARD_NURSE',
        action: 'UPDATE',
        targetEntity: 'CLINICAL_ACTION',
        targetEntityId: 'act-001',
        patientId: 'pat-999',
        description: 'Nurse acknowledged manual vitals recheck order',
      };
      const res = validateAuditEvent(audit);
      expect(res.success).toBe(true);
      expect(AuditEventSchema.safeParse(audit).success).toBe(true);
    });
  });

  describe('7. TrendVector and SBARReport Schemas', () => {
    it('validates TrendVector calculation record', () => {
      const trend = {
        patientId: 'pat-999',
        timestamp: validTimestamp,
        hrVelocityPerHour: 18.5,
        rrVelocityPerHour: 22.0,
        shockIndexCurrent: 0.88,
        shockIndexTrend: 'RISING',
        mewsDelta2Hour: 2,
        trajectoryDirection: 'DECOMPENSATING',
        provenance: validProvenance,
      };
      const res = validateTrendVector(trend);
      expect(res.success).toBe(true);
      expect(TrendVectorSchema.safeParse(trend).success).toBe(true);
    });

    it('validates SBARReport handoff document', () => {
      const sbar = {
        id: 'sbar-001',
        patientId: 'pat-999',
        bedNumber: '401-A',
        patientName: 'John Doe',
        situation: 'Bed 401-A has escalating Attention Priority Score (84/100) due to tachycardia velocity.',
        background: 'Post-op Day 1 laparoscopic hemicolectomy; history of hypertension.',
        assessment: 'Heart rate rose +24% in 30 mins; shock index elevated to 0.95; no manual vitals recorded for 3h 40m.',
        recommendation: 'Recommend immediate bedside reassessment, manual BP check, and stat venous lactate.',
        generatedAt: validTimestamp,
        apsScore: 84,
        priorityCategory: 'CRITICAL_REVIEW',
        provenance: validProvenance,
      };
      const res = validateSBARReport(sbar);
      expect(res.success).toBe(true);
      expect(SBARReportSchema.safeParse(sbar).success).toBe(true);
    });
  });
});
