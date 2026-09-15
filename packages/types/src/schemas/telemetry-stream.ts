import { z } from 'zod';
import { AttentionPriorityCategoryEnum, QualityStatusEnum } from '../enums';

// ============================================================================
// 1. Real-time Telemetry Event Type Enum
// ============================================================================
export const TelemetryStreamEventTypeEnum = z.enum([
  'OBSERVATION_UPDATED',
  'SIGNAL_STATUS_CHANGED',
  'APS_UPDATED',
  'PRIORITY_CHANGED',
  'TIMELINE_EVENT_CREATED',
  'ACTION_ACKNOWLEDGED',
]);
export type TelemetryStreamEventType = z.infer<typeof TelemetryStreamEventTypeEnum>;

// ============================================================================
// 2. Telemetry Stream Event Envelope
// ============================================================================
export const TelemetryStreamEnvelopeSchema = z.object({
  seq: z.number().int().min(1, 'Sequence number must be a positive integer'),
  eventId: z.string().min(1, 'Event ID is required'),
  eventType: TelemetryStreamEventTypeEnum,
  timestamp: z.number().int().min(0, 'Timestamp must be non-negative ms'),
  wardId: z.string().optional(),
  patientId: z.string().optional(),
  data: z.record(z.string(), z.any()),
});
export type TelemetryStreamEnvelope<T = Record<string, any>> = {
  seq: number;
  eventId: string;
  eventType: TelemetryStreamEventType;
  timestamp: number;
  wardId?: string;
  patientId?: string;
  data: T;
};

// ============================================================================
// 3. Client-to-Server Stream Protocol Messages
// ============================================================================
export const ClientStreamMessageSchema = z.discriminatedUnion('type', [
  // Subscription command with optional recovery sequence
  z.object({
    type: z.literal('SUBSCRIBE'),
    wardId: z.string().optional(),
    patientId: z.string().optional(),
    lastSequenceNumber: z.number().int().min(0).optional(),
  }),
  // Unsubscribe command
  z.object({
    type: z.literal('UNSUBSCRIBE'),
    wardId: z.string().optional(),
    patientId: z.string().optional(),
  }),
  // Application-level Heartbeat Ping
  z.object({
    type: z.literal('PING'),
    timestamp: z.number().int().min(0),
  }),
  // Explicit request for full ward snapshot
  z.object({
    type: z.literal('REQUEST_SNAPSHOT'),
    wardId: z.string().optional(),
  }),
  // Bedside Alert Acknowledgment over socket
  z.object({
    type: z.literal('ACKNOWLEDGE_ALERT'),
    patientId: z.string().min(1),
    alertId: z.string().optional(),
    userId: z.string().min(1),
    reason: z.string().max(1000).optional(),
  }),
]);
export type ClientStreamMessage = z.infer<typeof ClientStreamMessageSchema>;

// ============================================================================
// 4. Server-to-Client Stream Protocol Messages
// ============================================================================
export const ServerStreamMessageSchema = z.discriminatedUnion('type', [
  // Connected / Welcome handshake
  z.object({
    type: z.literal('CONNECTED'),
    clientId: z.string(),
    serverTimestamp: z.number().int(),
    serverBootTimestamp: z.number().int().optional(),
    serverInstanceId: z.string().optional(),
    currentSequenceNumber: z.number().int(),
    heartbeatIntervalMs: z.number().int(),
  }),
  // Standard Real-time Event Envelope
  z.object({
    type: z.literal('EVENT'),
    envelope: TelemetryStreamEnvelopeSchema,
  }),
  // Batch Replay for Client Recovery
  z.object({
    type: z.literal('REPLAY_BATCH'),
    fromSequenceNumber: z.number().int(),
    toSequenceNumber: z.number().int(),
    events: z.array(TelemetryStreamEnvelopeSchema),
  }),
  // Full State Snapshot (used on connect or after buffer overrun)
  z.object({
    type: z.literal('SNAPSHOT'),
    wardId: z.string().optional(),
    timestamp: z.number().int(),
    sequenceNumber: z.number().int(),
    radar: z.array(z.record(z.string(), z.any())),
    patients: z.array(z.record(z.string(), z.any())),
  }),
  // Application Heartbeat Pong
  z.object({
    type: z.literal('PONG'),
    clientTimestamp: z.number().int(),
    serverTimestamp: z.number().int(),
    currentSequenceNumber: z.number().int(),
  }),
  // Error Message
  z.object({
    type: z.literal('ERROR'),
    code: z.string(),
    message: z.string(),
  }),
]);
export type ServerStreamMessage = z.infer<typeof ServerStreamMessageSchema>;

// ============================================================================
// 5. Specific Event Payloads (Zero Raw Video Guarantee)
// ============================================================================
export interface ObservationUpdatedPayload {
  patientId: string;
  bedId?: string;
  wardId?: string;
  timestamp: number;
  heartRate?: number;
  respiratoryRate?: number;
  systolicBP?: number;
  diastolicBP?: number;
  spo2?: number;
  temperature?: number;
  confidence: number;
  qualityState: z.infer<typeof QualityStatusEnum>;
  source: string;
  shockIndex?: number;
}

export interface SignalStatusChangedPayload {
  patientId: string;
  bedId?: string;
  wardId?: string;
  timestamp: number;
  previousQualityState: z.infer<typeof QualityStatusEnum>;
  newQualityState: z.infer<typeof QualityStatusEnum>;
  confidence: number;
  reason?: string;
  opticalLineOfSight: boolean;
  ambientLightAdequate: boolean;
}

export interface ApsUpdatedPayload {
  patientId: string;
  wardId?: string;
  apsScore: number;
  category: z.infer<typeof AttentionPriorityCategoryEnum>;
  previousScore?: number;
  previousCategory?: z.infer<typeof AttentionPriorityCategoryEnum>;
  confidence: number;
  topReason?: string;
  reasons: Array<{
    id: string;
    category: string;
    humanReadableExplanation: string;
    severity: string;
    contribution: number;
    timestamp: number;
  }>;
  recommendedActions: string[];
  timestamp: number;
}

export interface PriorityChangedPayload {
  patientId: string;
  wardId?: string;
  previousCategory: z.infer<typeof AttentionPriorityCategoryEnum>;
  newCategory: z.infer<typeof AttentionPriorityCategoryEnum>;
  apsScore: number;
  topReason?: string;
  timestamp: number;
}

export interface TimelineEventCreatedPayload {
  eventId: string;
  patientId: string;
  wardId?: string;
  eventType: string;
  title: string;
  description: string;
  severity: string;
  timestamp: number;
}

export interface ActionAcknowledgedPayload {
  id: string;
  patientId: string;
  wardId?: string;
  alertId?: string;
  acknowledgedByUserId: string;
  acknowledgedAt: number;
  reason?: string;
}
