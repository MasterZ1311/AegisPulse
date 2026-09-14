import { describe, it, expect, beforeEach } from 'vitest';
import { EventBroadcaster } from '../src/stream/event-broadcaster';
import { TelemetryPipelineService } from '../src/services/telemetry-pipeline.service';
import { wardStateService } from '../src/services/ward-state.service';
import type { PhysiologicalObservation } from '@aegispulse/types';

describe('End-to-End Telemetry Pipeline & Attention Update System', () => {
  let broadcaster: EventBroadcaster;
  let pipeline: TelemetryPipelineService;

  beforeEach(() => {
    broadcaster = new EventBroadcaster({ bufferCapacity: 200 });
    pipeline = new TelemetryPipelineService({ broadcaster });
  });

  it('ingests observation, calculates APS, and emits OBSERVATION_UPDATED & APS_UPDATED', () => {
    const emittedEvents: any[] = [];
    broadcaster.on('event', (envelope) => emittedEvents.push(envelope));

    const obs: PhysiologicalObservation = {
      id: `obs-pipe-${Date.now()}`,
      patientId: 'P001',
      timestamp: Date.now(),
      source: 'OPTICAL_RPPG',
      confidence: 0.95,
      qualityState: 'TRUSTED',
      heartRate: 112, // Tachycardia
      respiratoryRate: 24, // Tachypnea
      systolicBP: 105,
      diastolicBP: 65,
      spo2: 94,
    };

    pipeline.processObservation(obs);

    expect(emittedEvents.length).toBeGreaterThanOrEqual(2);

    const obsEvent = emittedEvents.find((e) => e.eventType === 'OBSERVATION_UPDATED');
    expect(obsEvent).toBeDefined();
    expect(obsEvent.data.heartRate).toBe(112);
    expect(obsEvent.data.respiratoryRate).toBe(24);
    expect(obsEvent.data.shockIndex).toBeCloseTo(112 / 105, 2);

    const apsEvent = emittedEvents.find((e) => e.eventType === 'APS_UPDATED');
    expect(apsEvent).toBeDefined();
    expect(apsEvent.data.apsScore).toBeGreaterThanOrEqual(0);
    expect(apsEvent.data.apsScore).toBeLessThanOrEqual(100);
    expect(apsEvent.data).toHaveProperty('category');
    expect(apsEvent.data).toHaveProperty('topReason');
  });

  it('emits SIGNAL_STATUS_CHANGED when optical signal transitions', () => {
    const emittedEvents: any[] = [];
    broadcaster.on('event', (envelope) => emittedEvents.push(envelope));

    // First trusted reading
    pipeline.processObservation({
      id: `obs-sig-1`,
      patientId: 'P002',
      timestamp: Date.now() - 5000,
      source: 'OPTICAL_RPPG',
      confidence: 0.92,
      qualityState: 'TRUSTED',
      heartRate: 85,
    });

    // Next reading suffers lighting failure / optical motion artifact
    pipeline.processObservation({
      id: `obs-sig-2`,
      patientId: 'P002',
      timestamp: Date.now(),
      source: 'OPTICAL_RPPG',
      confidence: 0.35,
      qualityState: 'DEGRADED',
      heartRate: 88,
    });

    const sigEvent = emittedEvents.find((e) => e.eventType === 'SIGNAL_STATUS_CHANGED');
    expect(sigEvent).toBeDefined();
    expect(sigEvent.data.previousQualityState).toBe('TRUSTED');
    expect(sigEvent.data.newQualityState).toBe('DEGRADED');
    expect(sigEvent.data.opticalLineOfSight).toBe(true);
    expect(sigEvent.data.ambientLightAdequate).toBe(false);
  });

  it('emits PRIORITY_CHANGED when acute deterioration pushes patient into critical threshold', () => {
    const emittedEvents: any[] = [];
    broadcaster.on('event', (envelope) => emittedEvents.push(envelope));

    // Acute severe shock state
    const acuteObs: PhysiologicalObservation = {
      id: `obs-acute-${Date.now()}`,
      patientId: 'P005', // Started at WATCH
      timestamp: Date.now(),
      source: 'OPTICAL_RPPG',
      confidence: 0.98,
      qualityState: 'TRUSTED',
      heartRate: 155, // Extreme tachycardia
      respiratoryRate: 36, // Severe tachypnea
      systolicBP: 72, // Shock hypotension
      diastolicBP: 42,
      spo2: 87, // Severe hypoxia
      temperature: 39.4, // High fever
    };

    pipeline.processObservation(acuteObs);

    const prioEvent = emittedEvents.find((e) => e.eventType === 'PRIORITY_CHANGED');
    expect(prioEvent).toBeDefined();
    expect(['CRITICAL_REVIEW', 'EVALUATE']).toContain(prioEvent.data.newCategory);
    expect(prioEvent.data.apsScore).toBeGreaterThanOrEqual(50);
  });

  it('emits TIMELINE_EVENT_CREATED and ACTION_ACKNOWLEDGED events', () => {
    const emittedEvents: any[] = [];
    broadcaster.on('event', (envelope) => emittedEvents.push(envelope));

    // 1. Timeline event
    pipeline.processTimelineEvent({
      id: 'tl-evt-test-1',
      patientId: 'P003',
      timestamp: Date.now(),
      eventType: 'LAB_RESULT',
      title: 'Serum Lactate Resulted',
      description: 'Lactate 3.8 mmol/L (Elevated)',
      severity: 'CRITICAL',
      source: 'LAB_LIS',
      isTrusted: true,
    });

    // 2. Acknowledgement
    pipeline.processAcknowledgement({
      id: 'ack-test-1',
      patientId: 'P003',
      alertId: 'alt-resp-003',
      acknowledgedByUserId: 'usr-nurse-101',
      acknowledgedAt: Date.now(),
      reason: 'Rapid response team summoned to Bed 3',
    });

    const tlEvent = emittedEvents.find((e) => e.eventType === 'TIMELINE_EVENT_CREATED');
    expect(tlEvent).toBeDefined();
    expect(tlEvent.data.title).toContain('Lactate');

    const ackEvent = emittedEvents.find((e) => e.eventType === 'ACTION_ACKNOWLEDGED');
    expect(ackEvent).toBeDefined();
    expect(ackEvent.data.acknowledgedByUserId).toBe('usr-nurse-101');
    expect(ackEvent.data.reason).toContain('Rapid response');
  });

  it('STRICT INVARIANT: rejects raw camera video frames and ensures zero video is ever broadcast', () => {
    // 1. Attempting to ingest raw video frame must throw error
    const illegalObs: any = {
      id: 'obs-illegal',
      patientId: 'P001',
      timestamp: Date.now(),
      source: 'OPTICAL_RPPG',
      confidence: 0.9,
      qualityState: 'TRUSTED',
      heartRate: 72,
      rawFrame: 'data:image/jpeg;base64,...binary_camera_matrix...',
    };

    expect(() => pipeline.processObservation(illegalObs)).toThrow(/forbidden/i);

    // 2. Verify all buffered events contain zero video / image data
    const missed = broadcaster.getEventsSince(0);
    for (const env of missed) {
      const serialized = JSON.stringify(env).toLowerCase();
      expect(serialized).not.toContain('rawframe');
      expect(serialized).not.toContain('rawvideo');
      expect(serialized).not.toContain('pixeldata');
    }
  });

  it('steps deterministic ward simulator and streams newly emitted observations', () => {
    const emittedEvents: any[] = [];
    broadcaster.on('event', (envelope) => emittedEvents.push(envelope));

    // Step simulator by 5 virtual seconds
    pipeline.stepSimulator(5);

    expect(emittedEvents.length).toBeGreaterThan(0);
    const obsEvents = emittedEvents.filter((e) => e.eventType === 'OBSERVATION_UPDATED');
    expect(obsEvents.length).toBeGreaterThan(0);
  });
});
