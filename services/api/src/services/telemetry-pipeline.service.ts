import {
  AttentionPriorityEngine,
  ExplainabilityEngine,
  type PatientStateInput,
} from '@aegispulse/clinical';
import type {
  PhysiologicalObservation,
  UnifiedTimelineEvent,
  AttentionPriorityCategory,
  QualityStatus,
} from '@aegispulse/types';
import { eventBroadcaster, EventBroadcaster } from '../stream/event-broadcaster';
import { wardStateService, type AcknowledgementRecord } from './ward-state.service';
import { timelineService } from './timeline.service';

export interface PipelineOptions {
  broadcaster?: EventBroadcaster;
}

export class TelemetryPipelineService {
  private readonly broadcaster: EventBroadcaster;
  private readonly apsEngine: AttentionPriorityEngine;
  private readonly explainEngine: ExplainabilityEngine;
  private lastPatientSignalQuality: Map<string, QualityStatus> = new Map();
  private tickerInterval: NodeJS.Timeout | null = null;

  constructor(options: PipelineOptions = {}) {
    this.broadcaster = options.broadcaster ?? eventBroadcaster;
    this.apsEngine = new AttentionPriorityEngine();
    this.explainEngine = new ExplainabilityEngine();
  }

  /**
   * Core Ingestion Pipeline Step:
   * sensor/simulator -> observation ingestion -> clinical calculation -> APS recalculation -> event stream
   *
   * Invariant: Never transmit raw video/frames.
   */
  public processObservation(obs: PhysiologicalObservation): void {
    // 1. Strict invariant verification: No raw frame data allowed
    const obsKeys = Object.keys(obs);
    for (const key of obsKeys) {
      if (['frame', 'rawFrame', 'video', 'rawImage', 'pixelData'].includes(key)) {
        throw new Error(`Security Violation: Raw video frame field '${key}' is forbidden.`);
      }
    }

    const patient = wardStateService.getPatient(obs.patientId);
    const wardId = patient.wardId || 'WARD-A';

    // 2. Persist observation to SQLite
    wardStateService.addObservation(obs);

    // 3. Emit OBSERVATION_UPDATED
    const shockIndex =
      obs.heartRate && obs.systolicBP && obs.systolicBP > 0
        ? Number((obs.heartRate / obs.systolicBP).toFixed(2))
        : undefined;

    this.broadcaster.broadcast({
      eventId: `evt-obs-${obs.id}-${Date.now()}`,
      eventType: 'OBSERVATION_UPDATED',
      wardId,
      patientId: obs.patientId,
      timestamp: obs.timestamp,
      data: {
        patientId: obs.patientId,
        bedId: patient.bedId,
        wardId,
        timestamp: obs.timestamp,
        heartRate: obs.heartRate,
        respiratoryRate: obs.respiratoryRate,
        systolicBP: obs.systolicBP,
        diastolicBP: obs.diastolicBP,
        spo2: obs.spo2,
        temperature: obs.temperature,
        confidence: obs.confidence,
        qualityState: obs.qualityState,
        source: obs.source,
        shockIndex,
      },
    });

    // 4. Check for Signal Quality State Transition
    const prevQuality = this.lastPatientSignalQuality.get(obs.patientId);
    if (prevQuality && prevQuality !== obs.qualityState) {
      this.broadcaster.broadcast({
        eventId: `evt-sig-${obs.patientId}-${Date.now()}`,
        eventType: 'SIGNAL_STATUS_CHANGED',
        wardId,
        patientId: obs.patientId,
        timestamp: obs.timestamp,
        data: {
          patientId: obs.patientId,
          bedId: patient.bedId,
          wardId,
          timestamp: obs.timestamp,
          previousQualityState: prevQuality,
          newQualityState: obs.qualityState,
          confidence: obs.confidence,
          opticalLineOfSight: obs.qualityState !== 'LOST',
          ambientLightAdequate: obs.qualityState !== 'DEGRADED',
          reason: `Signal transitioned from ${prevQuality} to ${obs.qualityState}`,
        },
      });
    }
    this.lastPatientSignalQuality.set(obs.patientId, obs.qualityState);

    // 5. Clinical Calculations & APS Recalculation
    this.recalculatePatientAttention(patient.id, wardId, obs.timestamp);
  }

  /**
   * Recalculates Attention Priority Score & Explainability for a patient
   */
  public recalculatePatientAttention(
    patientId: string,
    wardId?: string,
    eventTimestamp?: number
  ): void {
    const patient = wardStateService.getPatient(patientId);
    const resolvedWardId = wardId || patient.wardId || 'WARD-A';
    const rawObs = wardStateService.getObservations(patient.id);
    const labs = wardStateService.getLabs(patient.id);
    const attentionRepo = wardStateService.getAttentionRepo();
    const previousState = attentionRepo.getActiveAttentionState(patient.id);

    // Adapt to PatientStateInput format expanding all individual vitals
    const observations: any[] = [];
    for (const ro of rawObs) {
      const base = {
        patientId: patient.id,
        bedId: patient.bedId,
        timestamp: ro.timestamp,
        source: ro.source,
        confidence: ro.confidence,
        qualityStatus: ro.qualityState,
      };

      if (ro.heartRate !== undefined) {
        observations.push({ ...base, id: `${ro.id}-hr`, vitalType: 'HEART_RATE', value: ro.heartRate, unit: 'BPM' });
      }
      if (ro.respiratoryRate !== undefined) {
        observations.push({ ...base, id: `${ro.id}-rr`, vitalType: 'RESPIRATORY_RATE', value: ro.respiratoryRate, unit: 'BREATHS_PER_MINUTE' });
      }
      if (ro.systolicBP !== undefined) {
        observations.push({ ...base, id: `${ro.id}-sbp`, vitalType: 'SYSTOLIC_BP', value: ro.systolicBP, unit: 'MMHG' });
      }
      if (ro.diastolicBP !== undefined) {
        observations.push({ ...base, id: `${ro.id}-dbp`, vitalType: 'DIASTOLIC_BP', value: ro.diastolicBP, unit: 'MMHG' });
      }
      if (ro.spo2 !== undefined) {
        observations.push({ ...base, id: `${ro.id}-spo2`, vitalType: 'OXYGEN_SATURATION', value: ro.spo2, unit: 'PERCENT' });
      }
      if (ro.temperature !== undefined) {
        observations.push({ ...base, id: `${ro.id}-temp`, vitalType: 'BODY_TEMPERATURE', value: ro.temperature, unit: 'CELSIUS' });
      }
      if (ro.heartRate !== undefined && ro.systolicBP !== undefined && ro.systolicBP > 0) {
        observations.push({ ...base, id: `${ro.id}-si`, vitalType: 'SHOCK_INDEX', value: Number((ro.heartRate / ro.systolicBP).toFixed(2)), unit: 'RATIO' });
      }
    }

    const state: PatientStateInput = {
      patientId: patient.id,
      bedNumber: patient.bedNumber,
      currentTimestamp: eventTimestamp ?? Date.now(),
      observations,
      labs,
    };

    const evaluationResult = this.apsEngine.evaluate(state);
    const explanationResult = this.explainEngine.explainPatient(state, evaluationResult);

    const now = Date.now();
    const topReason = explanationResult.primaryExplanation;
    const reasons = explanationResult.reasons.map((r) => ({
      id: r.id,
      category: r.category,
      humanReadableExplanation: r.humanReadableExplanation,
      severity: r.severity,
      contribution: r.contribution,
      timestamp: r.timestamp,
    }));
    const recommendedActions = evaluationResult.recommendedActions.map(
      (a) => a.title || a.actionType
    );

    // 6. Persist updated active attention state to SQLite
    attentionRepo.setActiveAttentionState({
      id: `aps-${patient.id}-${now}`,
      patientId: patient.id,
      timestamp: now,
      score: evaluationResult.score,
      category: evaluationResult.category,
      topReason,
      reasons,
      rankInputs: evaluationResult.rankInputs,
      recommendedActions,
      confidence: evaluationResult.confidence,
    });

    // 7. Emit APS_UPDATED
    this.broadcaster.broadcast({
      eventId: `evt-aps-${patient.id}-${now}`,
      eventType: 'APS_UPDATED',
      wardId: resolvedWardId,
      patientId: patient.id,
      timestamp: now,
      data: {
        patientId: patient.id,
        wardId: resolvedWardId,
        apsScore: evaluationResult.score,
        category: evaluationResult.category,
        previousScore: previousState?.score,
        previousCategory: previousState?.category,
        confidence: evaluationResult.confidence,
        topReason,
        reasons,
        recommendedActions,
        timestamp: evaluationResult.timestamp,
      },
    });

    // 8. If Priority Category Changed, emit PRIORITY_CHANGED
    const prevCategory = previousState?.category as AttentionPriorityCategory | undefined;
    if (prevCategory && prevCategory !== evaluationResult.category) {
      this.broadcaster.broadcast({
        eventId: `evt-prio-${patient.id}-${now}`,
        eventType: 'PRIORITY_CHANGED',
        wardId: resolvedWardId,
        patientId: patient.id,
        timestamp: now,
        data: {
          patientId: patient.id,
          wardId: resolvedWardId,
          previousCategory: prevCategory,
          newCategory: evaluationResult.category,
          apsScore: evaluationResult.score,
          topReason,
          timestamp: now,
        },
      });

      // Also record in unified timeline
      timelineService.addEvent({
        id: `tl-prio-${patient.id}-${now}`,
        patientId: patient.id,
        timestamp: now,
        eventType: 'APS_CHANGE',
        title: `Priority Category Changed: ${prevCategory} -> ${evaluationResult.category}`,
        description: `Attention Priority Score adjusted to ${evaluationResult.score}/100. ${topReason}`,
        severity: evaluationResult.category === 'CRITICAL_REVIEW' ? 'CRITICAL' : 'WARNING',
        source: 'CLINICAL_ENGINE',
        isTrusted: true,
        data: {
          previousCategory: prevCategory,
          newCategory: evaluationResult.category,
          apsScore: evaluationResult.score,
        },
      });
    }
  }

  /**
   * Dispatches TIMELINE_EVENT_CREATED event
   */
  public processTimelineEvent(event: UnifiedTimelineEvent, wardId?: string): void {
    const patient = wardStateService.getPatient(event.patientId);
    const resolvedWardId = wardId || patient.wardId || 'WARD-A';

    this.broadcaster.broadcast({
      eventId: `evt-tl-${event.id}-${Date.now()}`,
      eventType: 'TIMELINE_EVENT_CREATED',
      wardId: resolvedWardId,
      patientId: event.patientId,
      timestamp: event.timestamp,
      data: {
        eventId: event.id,
        patientId: event.patientId,
        wardId: resolvedWardId,
        eventType: event.eventType,
        title: event.title,
        description: event.description,
        severity: event.severity,
        timestamp: event.timestamp,
      },
    });
  }

  /**
   * Dispatches ACTION_ACKNOWLEDGED event
   */
  public processAcknowledgement(ack: AcknowledgementRecord, wardId?: string): void {
    const patient = wardStateService.getPatient(ack.patientId);
    const resolvedWardId = wardId || patient.wardId || 'WARD-A';

    this.broadcaster.broadcast({
      eventId: `evt-ack-${ack.id}-${Date.now()}`,
      eventType: 'ACTION_ACKNOWLEDGED',
      wardId: resolvedWardId,
      patientId: ack.patientId,
      timestamp: ack.acknowledgedAt,
      data: {
        id: ack.id,
        patientId: ack.patientId,
        wardId: resolvedWardId,
        alertId: ack.alertId,
        acknowledgedByUserId: ack.acknowledgedByUserId,
        acknowledgedAt: ack.acknowledgedAt,
        reason: ack.reason,
      },
    });
  }

  /**
   * Advance the deterministic simulator and push all newly acquired observations
   * through the telemetry pipeline.
   */
  public stepSimulator(deltaSeconds: number = 10): void {
    const sim = wardStateService.getSimulator();
    sim.step(deltaSeconds * 1000);

    const snapshot = sim.getWardSnapshot();

    for (const p of snapshot.patients) {
      const latestObsList = snapshot.latestObservations[p.id];
      if (latestObsList && latestObsList.length > 0) {
        // Aggregate observations into a single PhysiologicalObservation
        const heartRate = latestObsList.find((o) => o.vitalType === 'HEART_RATE')?.value;
        const respRate = latestObsList.find((o) => o.vitalType === 'RESPIRATORY_RATE')?.value;
        const spo2 = latestObsList.find((o) => o.vitalType === 'OXYGEN_SATURATION')?.value;
        const sbp = latestObsList.find((o) => o.vitalType === 'SYSTOLIC_BP')?.value;
        const dbp = latestObsList.find((o) => o.vitalType === 'DIASTOLIC_BP')?.value;
        const temp = latestObsList.find((o) => o.vitalType === 'BODY_TEMPERATURE')?.value;
        const primaryObs = latestObsList[0];

        const obs: PhysiologicalObservation = {
          id: `obs-sim-${p.id}-${primaryObs.timestamp}`,
          patientId: p.id,
          timestamp: primaryObs.timestamp,
          source: primaryObs.source,
          confidence: primaryObs.confidence,
          qualityState: primaryObs.qualityStatus,
          heartRate,
          respiratoryRate: respRate,
          spo2,
          systolicBP: sbp,
          diastolicBP: dbp,
          temperature: temp,
        };

        this.processObservation(obs);
      }
    }
  }

  /**
   * Start periodic live background simulator updates
   */
  public startLiveSimulation(intervalMs: number = 2000, simStepSeconds: number = 2): void {
    if (this.tickerInterval) return;
    this.tickerInterval = setInterval(() => {
      this.stepSimulator(simStepSeconds);
    }, intervalMs);
  }

  public stopLiveSimulation(): void {
    if (this.tickerInterval) {
      clearInterval(this.tickerInterval);
      this.tickerInterval = null;
    }
  }
}

export const telemetryPipelineService = new TelemetryPipelineService();
