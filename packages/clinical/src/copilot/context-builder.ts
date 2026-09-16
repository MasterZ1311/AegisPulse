/// <reference types="node" />
import * as crypto from 'node:crypto';
import type {
  StructuredEvidencePackage,
  VitalType,
  VitalUnit,
  ObservationSource,
  QualityStatus,
  Gender,
  CodeStatus,
  AttentionPriorityCategory,
} from '@aegispulse/types';

export interface CopilotContextBuilderInput {
  patient: {
    id: string;
    bedNumber: string;
    name?: string;
    age?: number;
    gender?: Gender;
    codeStatus?: CodeStatus;
    admissionReason?: string;
    comorbidities?: string[];
  };
  currentAps: {
    score: number;
    category: AttentionPriorityCategory;
    wardRank?: number;
    dominantReasons?: string[];
    mewsScore?: number;
    shockIndex?: number;
  };
  verifiedObservations: Array<{
    id: string;
    vitalType: VitalType;
    value: number;
    unit: VitalUnit;
    timestamp: number;
    source?: ObservationSource;
    qualityStatus: QualityStatus;
  }>;
  missingVitals?: VitalType[];
  recentLabs?: Array<{
    testCode: string;
    testName: string;
    value: number;
    unit: string;
    timestamp: number;
    isCritical?: boolean;
  }>;
  timelineEvents?: Array<{
    eventId: string;
    timestamp: number;
    eventType: string;
    title: string;
    description: string;
  }>;
}

/**
 * Deterministically serializes objects by recursively sorting keys.
 */
export function canonicalJsonStringify(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalJsonStringify).join(',') + ']';
  }
  const sortedKeys = Object.keys(obj as Record<string, unknown>).sort();
  const entries = sortedKeys.map(
    (key) => JSON.stringify(key) + ':' + canonicalJsonStringify((obj as Record<string, unknown>)[key])
  );
  return '{' + entries.join(',') + '}';
}

/**
 * Deterministically computes a SHA-256 hash for the evidence package.
 * Guarantees cryptographic immutability and provenance tracking.
 */
export function computeContextHash(payload: Record<string, unknown>): string {
  const serialized = canonicalJsonStringify(payload);
  return crypto.createHash('sha256').update(serialized).digest('hex');
}

/**
 * Standard vital sign modalities tracked by AegisPulse.
 */
export const CORE_VITAL_MODALITIES: VitalType[] = [
  'HEART_RATE',
  'RESPIRATORY_RATE',
  'OXYGEN_SATURATION',
  'SYSTOLIC_BP',
  'DIASTOLIC_BP',
  'BODY_TEMPERATURE',
];

/**
 * Builds a strictly bounded, read-only StructuredEvidencePackage from clinical inputs.
 * Never passes raw unverified state to the copilot.
 */
export function buildStructuredEvidencePackage(
  input: CopilotContextBuilderInput
): StructuredEvidencePackage {
  const verifiedVitalsMap: StructuredEvidencePackage['verifiedVitals'] = {};
  const presentVitals = new Set<VitalType>();

  for (const obs of input.verifiedObservations) {
    verifiedVitalsMap[obs.vitalType] = {
      vitalType: obs.vitalType,
      value: obs.value,
      unit: obs.unit,
      timestamp: obs.timestamp,
      source: obs.source,
      observationId: obs.id,
      qualityStatus: obs.qualityStatus,
    };
    presentVitals.add(obs.vitalType);
  }

  // Determine missing vitals if not explicitly provided
  const missingVitals: VitalType[] =
    input.missingVitals ??
    CORE_VITAL_MODALITIES.filter((vital) => !presentVitals.has(vital));

  const labs = (input.recentLabs ?? []).map((lab) => ({
    testCode: lab.testCode,
    testName: lab.testName,
    value: lab.value,
    unit: lab.unit,
    timestamp: lab.timestamp,
    isCritical: lab.isCritical ?? false,
  }));

  const timeline = (input.timelineEvents ?? []).map((evt) => ({
    eventId: evt.eventId,
    timestamp: evt.timestamp,
    eventType: evt.eventType,
    title: evt.title,
    description: evt.description,
  }));

  const generatedAt = Date.now();

  // Construct hashable core content
  const hashPayload = {
    patientId: input.patient.id,
    bedNumber: input.patient.bedNumber,
    apsScore: input.currentAps.score,
    category: input.currentAps.category,
    vitals: verifiedVitalsMap,
    missing: missingVitals,
    labs,
    timeline,
  };

  const contextHash = computeContextHash(hashPayload);

  return {
    patientId: input.patient.id,
    bedNumber: input.patient.bedNumber,
    patientName: input.patient.name,
    age: input.patient.age,
    gender: input.patient.gender,
    codeStatus: input.patient.codeStatus,
    admissionReason: input.patient.admissionReason,
    comorbidities: input.patient.comorbidities ?? [],
    verifiedVitals: verifiedVitalsMap,
    missingVitals,
    apsScore: input.currentAps.score,
    priorityCategory: input.currentAps.category,
    wardRank: input.currentAps.wardRank ?? 1,
    dominantReasons: input.currentAps.dominantReasons ?? [],
    mewsScore: input.currentAps.mewsScore ?? 0,
    shockIndex: input.currentAps.shockIndex,
    recentLabs: labs,
    timelineSummary: timeline,
    contextHash,
    generatedAt,
  };
}
