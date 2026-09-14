import type {
  PhysiologicalObservation,
  QualityStatus,
  ObservationSource,
} from '@aegispulse/types';
import { wardStateService } from './ward-state.service';
import { telemetryPipelineService } from './telemetry-pipeline.service';
import { timelineService } from './timeline.service';
import { eventBroadcaster } from '../stream/event-broadcaster';
import { createVitalTimelineEvent } from '@aegispulse/clinical';

export interface SyncItem {
  idempotencyKey: string;
  itemType: 'OBSERVATION' | 'ACKNOWLEDGEMENT' | 'CLINICAL_ACTION';
  timestamp: number;
  patientId: string;
  payload: Record<string, any>;
}

export interface SyncBatchRequest {
  clientSyncId: string;
  clientId: string;
  wardId?: string;
  lastServerSeq?: number;
  items: SyncItem[];
}

export interface ConflictResolution {
  idempotencyKey: string;
  patientId: string;
  reason: string;
  resolution: 'APPLIED' | 'SUPERSEDED' | 'MERGED' | 'REJECTED_STALE';
  details?: string;
}

export interface SyncBatchResponse {
  success: boolean;
  clientSyncId: string;
  processedCount: number;
  duplicateCount: number;
  rejectedCount: number;
  conflicts: ConflictResolution[];
  serverSeq: number;
  serverTimestamp: number;
  missedEvents?: any[];
}

export class SyncService {
  private readonly processedIdempotencyKeys = new Map<string, { timestamp: number; result: string }>();
  private readonly maxKeyHistory = 10000;

  /**
   * Process a batch of queued actions/observations from a reconnecting edge client
   */
  public processSyncBatch(batch: SyncBatchRequest): SyncBatchResponse {
    const now = Date.now();
    let processedCount = 0;
    let duplicateCount = 0;
    let rejectedCount = 0;
    const conflicts: ConflictResolution[] = [];

    // Sort items by client timestamp to guarantee deterministic chronological order
    const sortedItems = [...batch.items].sort((a, b) => a.timestamp - b.timestamp);

    for (const item of sortedItems) {
      // 1. Idempotency verification: Check if already processed
      if (this.processedIdempotencyKeys.has(item.idempotencyKey)) {
        duplicateCount++;
        continue;
      }

      // Check if patient exists safely
      let patient = null;
      try {
        patient = wardStateService.getPatient(item.patientId);
      } catch {
        patient = null;
      }

      if (!patient) {
        rejectedCount++;
        conflicts.push({
          idempotencyKey: item.idempotencyKey,
          patientId: item.patientId,
          reason: `Patient '${item.patientId}' does not exist in ward registry.`,
          resolution: 'REJECTED_STALE',
        });
        continue;
      }

      // Security Check 1: Future timestamp rejection (max allowable clock skew: 5 minutes)
      if (item.timestamp > now + 300000) {
        rejectedCount++;
        conflicts.push({
          idempotencyKey: item.idempotencyKey,
          patientId: item.patientId,
          reason: `Item timestamp (${item.timestamp}) is in the future. Maximum allowable clock skew is 5 minutes.`,
          resolution: 'REJECTED_STALE',
        });
        continue;
      }

      // Security Check 2: Raw video / frame buffer rejection
      const forbiddenVideoKeys = [
        'rawVideo',
        'raw_video',
        'video',
        'frameBuffer',
        'frame_buffer',
        'pixels',
        'pixelBuffer',
        'imageData',
        'frames',
        'cameraStream',
      ];
      const payloadKeys = Object.keys(item.payload || {});
      const hasForbiddenKey = payloadKeys.some((k) => forbiddenVideoKeys.includes(k));
      const hasExcessiveBinary = payloadKeys.some(
        (k) => typeof item.payload[k] === 'string' && item.payload[k].length > 50000
      );

      if (hasForbiddenKey || hasExcessiveBinary) {
        rejectedCount++;
        conflicts.push({
          idempotencyKey: item.idempotencyKey,
          patientId: item.patientId,
          reason:
            'Forbidden raw video/frame payload detected. AegisPulse privacy architecture strictly prohibits storing or transmitting raw video frames.',
          resolution: 'REJECTED_STALE',
        });
        continue;
      }

      // Stale data boundary check (> 24 hours in the past)
      const ageMs = now - item.timestamp;
      const isExtremelyStale = ageMs > 24 * 60 * 60 * 1000;

      switch (item.itemType) {
        case 'OBSERVATION': {
          const obsResult = this.processSyncObservation(item, isExtremelyStale);
          if (obsResult.conflict) conflicts.push(obsResult.conflict);
          if (obsResult.processed) processedCount++;
          else duplicateCount++;
          break;
        }

        case 'ACKNOWLEDGEMENT': {
          const ackPayload = item.payload;
          wardStateService.addAcknowledgement({
            id: ackPayload.id || `ack-${item.idempotencyKey}`,
            patientId: item.patientId,
            alertId: ackPayload.alertId || `alert-${item.patientId}-${item.timestamp}`,
            acknowledgedByUserId: ackPayload.acknowledgedByUserId || batch.clientId,
            acknowledgedAt: item.timestamp,
            reason: ackPayload.reason || 'Offline acknowledgement synced.',
          });
          processedCount++;
          break;
        }

        case 'CLINICAL_ACTION': {
          const actionPayload = item.payload;
          const timelineId = actionPayload.id || `tl-${item.idempotencyKey}`;
          timelineService.addEvent({
            id: timelineId,
            patientId: item.patientId,
            timestamp: item.timestamp,
            eventType: actionPayload.eventType || 'MANUAL_OBSERVATION',
            title: actionPayload.title || 'Bedside Clinical Action Logged Offline',
            description: actionPayload.description || 'Action recorded during network disconnection.',
            severity: actionPayload.severity || 'INFO',
            source: 'NURSE_MANUAL',
            isTrusted: true,
            data: actionPayload.data,
          });
          processedCount++;
          break;
        }

        default: {
          rejectedCount++;
          conflicts.push({
            idempotencyKey: item.idempotencyKey,
            patientId: item.patientId,
            reason: `Unknown itemType '${(item as any).itemType}'.`,
            resolution: 'REJECTED_STALE',
          });
          break;
        }
      }

      // Record idempotency key
      this.recordIdempotencyKey(item.idempotencyKey, 'SUCCESS');
    }

    // Collect missed events since lastServerSeq for client state catch-up
    let missedEvents: any[] | undefined;
    if (batch.lastServerSeq !== undefined && batch.lastServerSeq >= 0) {
      missedEvents = eventBroadcaster.getEventsSince(batch.lastServerSeq, {
        wardId: batch.wardId,
      });
    }

    return {
      success: true,
      clientSyncId: batch.clientSyncId,
      processedCount,
      duplicateCount,
      rejectedCount,
      conflicts,
      serverSeq: eventBroadcaster.getCurrentSequence(),
      serverTimestamp: now,
      missedEvents,
    };
  }

  private processSyncObservation(
    item: SyncItem,
    isExtremelyStale: boolean
  ): { processed: boolean; conflict?: ConflictResolution } {
    const payload = item.payload;
    const obsSource: ObservationSource = payload.source || 'BEDSIDE_DEVICE';
    const qualityState: QualityStatus = payload.qualityState || (isExtremelyStale ? 'DEGRADED' : 'TRUSTED');

    // Rule: Source Priority Conflict Resolution
    // Bedside nurse observation overrides contactless optical observation
    const existingObs = wardStateService.getObservations(item.patientId, {
      since: item.timestamp - 5000,
      until: item.timestamp + 5000,
    });

    let conflict: ConflictResolution | undefined;
    if (existingObs.length > 0) {
      const collision = existingObs[0];
      const isIncomingManual = ['BEDSIDE_DEVICE', 'MANUAL_VERIFIED', 'NURSE_MANUAL'].includes(obsSource);
      const isExistingOptical = ['RPPG_CAMERA', 'ESTIMATED'].includes(collision.source);

      if (isIncomingManual && isExistingOptical) {
        // Incoming manual replaces optical reading
        conflict = {
          idempotencyKey: item.idempotencyKey,
          patientId: item.patientId,
          reason: 'Manual bedside observation superseded lower-priority optical estimate.',
          resolution: 'SUPERSEDED',
          details: `Manual reading (${obsSource}) took precedence over optical reading (${collision.source}).`,
        };
      } else if (!isIncomingManual && !isExistingOptical) {
        // Optical incoming collided with manual existing -> discard optical
        return {
          processed: false,
          conflict: {
            idempotencyKey: item.idempotencyKey,
            patientId: item.patientId,
            reason: 'Existing bedside manual vital preserved over offline optical reading.',
            resolution: 'SUPERSEDED',
          },
        };
      }
    }

    const observation: PhysiologicalObservation = {
      id: payload.id || `obs-sync-${item.patientId}-${item.timestamp}`,
      patientId: item.patientId,
      timestamp: item.timestamp,
      source: obsSource,
      confidence: payload.confidence ?? (isExtremelyStale ? 0.4 : 0.95),
      qualityState,
      heartRate: payload.heartRate,
      respiratoryRate: payload.respiratoryRate,
      systolicBP: payload.systolicBP,
      diastolicBP: payload.diastolicBP,
      temperature: payload.temperature,
      spo2: payload.spo2,
      shockIndex:
        payload.heartRate && payload.systolicBP && payload.systolicBP > 0
          ? Number((payload.heartRate / payload.systolicBP).toFixed(2))
          : undefined,
    };

    // Feed to telemetry pipeline (persists and recalculates APS)
    telemetryPipelineService.processObservation(observation);

    // If manual bedside source, also index into timeline
    if (['BEDSIDE_DEVICE', 'MANUAL_VERIFIED', 'NURSE_MANUAL'].includes(obsSource)) {
      const patient = wardStateService.getPatient(item.patientId);
      const timelineEvent = createVitalTimelineEvent(observation, {
        bedNumber: patient.bedNumber,
        notes: payload.notes || 'Offline observation synchronized from edge device.',
      });
      timelineService.addEvent(timelineEvent);
    }

    return { processed: true, conflict };
  }

  private recordIdempotencyKey(key: string, result: string): void {
    this.processedIdempotencyKeys.set(key, { timestamp: Date.now(), result });
    if (this.processedIdempotencyKeys.size > this.maxKeyHistory) {
      const first = this.processedIdempotencyKeys.keys().next().value;
      if (first) this.processedIdempotencyKeys.delete(first);
    }
  }

  public reset(): void {
    this.processedIdempotencyKeys.clear();
  }
}

export const syncService = new SyncService();
