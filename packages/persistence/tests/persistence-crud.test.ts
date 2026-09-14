import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { runMigrations } from '../src/migrations/runner';
import { seedDatabase } from '../src/seeds/seed';
import { ObservationRepository } from '../src/repositories/observation.repository';
import { LabRepository } from '../src/repositories/lab.repository';
import { TimelineRepository } from '../src/repositories/timeline.repository';
import { AttentionRepository } from '../src/repositories/attention.repository';
import { AcknowledgementRepository } from '../src/repositories/acknowledgement.repository';
import { ClinicalActionRepository } from '../src/repositories/clinical-action.repository';
import { AuditRepository } from '../src/repositories/audit.repository';

describe('Persistence Layer CRUD & Clinical Invariants', () => {
  let db: DatabaseSync;
  let obsRepo: ObservationRepository;
  let labRepo: LabRepository;
  let timelineRepo: TimelineRepository;
  let attentionRepo: AttentionRepository;
  let ackRepo: AcknowledgementRepository;
  let actionRepo: ClinicalActionRepository;
  let auditRepo: AuditRepository;

  beforeEach(() => {
    db = new DatabaseSync(':memory:');
    runMigrations(db);
    seedDatabase(db);

    obsRepo = new ObservationRepository(db);
    labRepo = new LabRepository(db);
    timelineRepo = new TimelineRepository(db);
    attentionRepo = new AttentionRepository(db);
    ackRepo = new AcknowledgementRepository(db);
    actionRepo = new ClinicalActionRepository(db);
    auditRepo = new AuditRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('Observation Invariants & Zero Camera Frames', () => {
    it('stores continuous physiological vitals without raw camera frames', () => {
      const now = Date.now();
      obsRepo.insertObservation({
        id: 'obs-test-01',
        patientId: 'P001',
        timestamp: now,
        source: 'OPTICAL_RPPG',
        confidence: 0.98,
        qualityState: 'TRUSTED',
        heartRate: 74,
        respiratoryRate: 16,
        systolicBP: 120,
        diastolicBP: 80,
        spo2: 99,
        temperature: 36.7,
      });

      const latest = obsRepo.getLatestObservation('P001');
      expect(latest).toBeDefined();
      expect(latest?.id).toBe('obs-test-01');
      expect(latest?.heartRate).toBe(74);
      expect(latest?.respiratoryRate).toBe(16);

      // Verify schema has no frame or image columns
      const cols = db.prepare("PRAGMA table_info('observations');").all() as any[];
      const colNames = cols.map((c) => c.name);
      expect(colNames).not.toContain('frame');
      expect(colNames).not.toContain('image');
      expect(colNames).not.toContain('raw_frame');
      expect(colNames).not.toContain('pixels');
    });

    it('enforces foreign key integrity when inserting observation for invalid patient', () => {
      expect(() => {
        obsRepo.insertObservation({
          id: 'obs-invalid',
          patientId: 'NONEXISTENT_PATIENT',
          timestamp: Date.now(),
          source: 'OPTICAL_RPPG',
          confidence: 0.8,
          qualityState: 'TRUSTED',
        });
      }).toThrow(/FOREIGN KEY constraint failed/);
    });

    it('supports fast indexed time-window range queries', () => {
      const baseTime = 1700000000000;
      for (let i = 0; i < 5; i++) {
        obsRepo.insertObservation({
          id: `obs-window-${i}`,
          patientId: 'P001',
          timestamp: baseTime + i * 60000,
          source: 'OPTICAL_RPPG',
          confidence: 0.9,
          qualityState: 'TRUSTED',
          heartRate: 70 + i,
        });
      }

      const ranged = obsRepo.getObservations('P001', {
        since: baseTime + 60000,
        until: baseTime + 180000,
      });

      expect(ranged.length).toBe(3);
      expect(ranged[0].timestamp).toBe(baseTime + 60000);
      expect(ranged[2].timestamp).toBe(baseTime + 180000);
    });
  });

  describe('Attention State Transitions & Ward Radar', () => {
    it('atomically deactivates prior attention state when new state is persisted', () => {
      const now = Date.now();
      attentionRepo.setActiveAttentionState({
        id: 'aps-p1-v2',
        patientId: 'P001',
        timestamp: now,
        score: 85,
        category: 'CRITICAL',
        topReason: 'Severe acute desaturation below 88%',
        reasons: [],
        rankInputs: {},
        recommendedActions: ['Immediate bedside assessment'],
        confidence: 0.96,
      });

      const active = attentionRepo.getActiveAttentionState('P001');
      expect(active).toBeDefined();
      expect(active?.id).toBe('aps-p1-v2');
      expect(active?.score).toBe(85);
      expect(active?.category).toBe('CRITICAL');

      // Verify only one active state exists for P001
      const activeCount = db.prepare(
        'SELECT COUNT(*) as count FROM attention_states WHERE patient_id = ? AND is_active = 1;'
      ).get('P001') as any;
      expect(activeCount.count).toBe(1);

      // Verify history contains both
      const history = attentionRepo.getAttentionHistory('P001');
      expect(history.length).toBeGreaterThanOrEqual(2);
    });

    it('ranks ward radar patients by active attention score descending using index', () => {
      const radar = attentionRepo.getActiveAttentionStatesForWard('WARD-A');
      expect(radar.length).toBe(6);

      for (let i = 0; i < radar.length - 1; i++) {
        expect(radar[i].score).toBeGreaterThanOrEqual(radar[i + 1].score);
      }
    });
  });

  describe('Clinical Actions & Acknowledgements', () => {
    it('completes clinical action with clinician timestamp and notes', () => {
      const actions = actionRepo.getActions('P001');
      expect(actions.length).toBeGreaterThan(0);
      const actionId = actions[0].id;

      actionRepo.completeAction(actionId, 'usr-nurse-102', Date.now(), 'Assessed vitals; normal.');
      const updated = actionRepo.getActions('P001');
      const found = updated.find((a) => a.id === actionId);
      expect(found?.status).toBe('COMPLETED');
      expect(found?.completedByUserId).toBe('usr-nurse-102');
      expect(found?.outcomeNotes).toContain('Assessed vitals');
    });

    it('persists clinician alert acknowledgements', () => {
      const now = Date.now();
      ackRepo.insertAcknowledgement({
        id: 'ack-test-01',
        patientId: 'P002',
        alertId: 'alt-hr-99',
        acknowledgedByUserId: 'usr-nurse-102',
        acknowledgedAt: now,
        reason: 'Charge nurse verified telemetry; attending informed.',
      });

      const acks = ackRepo.getAcknowledgements('P002');
      expect(acks.length).toBe(1);
      expect(acks[0].acknowledgedByUserId).toBe('usr-nurse-102');
      expect(acks[0].reason).toContain('Charge nurse verified');
    });
  });

  describe('Audit Logging', () => {
    it('persists immutable regulatory audit trail', () => {
      const now = Date.now();
      auditRepo.insertAuditEvent({
        id: 'aud-01',
        timestamp: now,
        actorId: 'usr-phys-201',
        actorRole: 'ATTENDING_PHYSICIAN',
        action: 'OVERRIDE',
        targetEntity: 'ATTENTION_PRIORITY',
        targetEntityId: 'aps-p1-v2',
        patientId: 'P001',
        description: 'Attending physician lowered priority after visual bedside inspection',
        ipAddress: '192.168.1.101',
      });

      const events = auditRepo.getAuditEvents({ actorId: 'usr-phys-201' });
      expect(events.length).toBe(1);
      expect(events[0].action).toBe('OVERRIDE');
      expect(events[0].actorRole).toBe('ATTENDING_PHYSICIAN');
    });
  });
});
