import type {
  UnifiedTimelineEvent,
  UnifiedTimelineEventType,
  TimelineQueryFilter,
  TimelineWindowChangesResponse,
  PriorityRiseAttributionResponse,
  LastManualAssessmentResponse,
  TrustedMeasurementsResponse,
} from '@aegispulse/types';

export type {
  UnifiedTimelineEvent,
  UnifiedTimelineEventType,
  TimelineQueryFilter,
  TimelineWindowChangesResponse,
  PriorityRiseAttributionResponse,
  LastManualAssessmentResponse,
  TrustedMeasurementsResponse,
};

export interface TimelineStoreOptions {
  maxEvents?: number;
}
