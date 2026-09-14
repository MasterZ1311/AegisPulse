import type { PhenomenonConfig } from '../phenomena/types';

export type ScenarioId =
  | 'NORMAL_SHIFT'
  | 'SINGLE_PATIENT_DETERIORATION'
  | 'FALSE_ALARM_SCENARIO'
  | 'SIGNAL_FAILURE_SCENARIO'
  | 'MULTIPLE_PATIENT_SCENARIO';

export interface ShiftScenarioDefinition {
  id: ScenarioId;
  name: string;
  description: string;
  durationVirtualMinutes: number;
  phenomenaSchedule: (shiftStartMs: number) => PhenomenonConfig[];
  manualObservationsScheduleMinutes: number[];
}

export const SCENARIO_CATALOG: Record<ScenarioId, ShiftScenarioDefinition> = {
  // --------------------------------------------------------------------------
  // 1. NORMAL_SHIFT: Stable 6-Bed Ward Shift
  // --------------------------------------------------------------------------
  NORMAL_SHIFT: {
    id: 'NORMAL_SHIFT',
    name: 'Normal Ward Shift (All 6 Beds Stable)',
    description:
      'Demonstrates a calm general ward shift where all 6 patients remain stable. Minor natural movements occur without triggering alarm fatigue.',
    durationVirtualMinutes: 120,
    manualObservationsScheduleMinutes: [0, 60, 120],
    phenomenaSchedule: (shiftStartMs: number): PhenomenonConfig[] => [
      // Bed 401 turns in bed between min 15-18
      {
        type: 'SENSOR_MOTION_ARTIFACT',
        patientId: 'P001',
        startVirtualMs: shiftStartMs + 15 * 60 * 1000,
        durationMs: 3 * 60 * 1000,
        params: { motionPeak: 0.6 },
      },
      // Bed 404 mild transient cough between min 45-48
      {
        type: 'TRANSIENT_PHYSIOLOGICAL_SPIKE',
        patientId: 'P004',
        startVirtualMs: shiftStartMs + 45 * 60 * 1000,
        durationMs: 3 * 60 * 1000,
        params: { spikeMagnitudeHR: 14 },
      },
      // Bed 405 bathroom ambulation between min 80-90 (missing observations)
      {
        type: 'MISSING_OBSERVATIONS',
        patientId: 'P005',
        startVirtualMs: shiftStartMs + 80 * 60 * 1000,
        durationMs: 10 * 60 * 1000,
      },
    ],
  },

  // --------------------------------------------------------------------------
  // 2. SINGLE_PATIENT_DETERIORATION: Bed 403 Occult Shock
  // --------------------------------------------------------------------------
  SINGLE_PATIENT_DETERIORATION: {
    id: 'SINGLE_PATIENT_DETERIORATION',
    name: 'Single Patient Occult Shock Deterioration (Bed 403)',
    description:
      'Patient 3 (Eleanor Vance, 79F post-op femur fracture) experiences subtle occult deterioration with progressive tachycardia, tachypnea, and narrowing pulse pressure.',
    durationVirtualMinutes: 120,
    manualObservationsScheduleMinutes: [0, 90],
    phenomenaSchedule: (shiftStartMs: number): PhenomenonConfig[] => [
      // Gradual Tachycardia running across decompensation phase (min 10 to 90)
      {
        type: 'GRADUAL_TACHYCARDIA',
        patientId: 'P003',
        startVirtualMs: shiftStartMs + 10 * 60 * 1000,
        durationMs: 80 * 60 * 1000,
        params: { hrDeltaTarget: 30 }, // 78 -> 108 BPM
      },
      // Gradual Tachypnea starting min 20
      {
        type: 'GRADUAL_RESPIRATORY_DETERIORATION',
        patientId: 'P003',
        startVirtualMs: shiftStartMs + 20 * 60 * 1000,
        durationMs: 70 * 60 * 1000,
        params: { rrDeltaTarget: 10 }, // 16 -> 26 breaths/min
      },
      // Persistent Deterioration with Blood Pressure drop starting min 35
      {
        type: 'PERSISTENT_DETERIORATION',
        patientId: 'P003',
        startVirtualMs: shiftStartMs + 35 * 60 * 1000,
        durationMs: 55 * 60 * 1000,
        params: {
          hrDeltaTarget: 22,
          rrDeltaTarget: 4,
          sysBpDeltaTarget: -26, // 114 -> 88 mmHg
        },
      },
      // Clinical Recovery following resuscitation starting min 90
      {
        type: 'RECOVERY',
        patientId: 'P003',
        startVirtualMs: shiftStartMs + 90 * 60 * 1000,
        durationMs: 30 * 60 * 1000,
      },
    ],
  },

  // --------------------------------------------------------------------------
  // 3. FALSE_ALARM_SCENARIO: Bed 405 Transient Physiological Spike
  // --------------------------------------------------------------------------
  FALSE_ALARM_SCENARIO: {
    id: 'FALSE_ALARM_SCENARIO',
    name: 'False Alarm Mitigation (Bed 405 Transient Cough Spike)',
    description:
      'Patient 5 experiences a 2-minute sympathetic spike (+32 BPM) and motion artifact during an animated phone call, rapidly resolving. Tests false-alarm suppression.',
    durationVirtualMinutes: 120,
    manualObservationsScheduleMinutes: [0, 60, 120],
    phenomenaSchedule: (shiftStartMs: number): PhenomenonConfig[] => [
      // Transient spike at min 25 lasting 3 minutes
      {
        type: 'TRANSIENT_PHYSIOLOGICAL_SPIKE',
        patientId: 'P005',
        startVirtualMs: shiftStartMs + 25 * 60 * 1000,
        durationMs: 3 * 60 * 1000,
        params: { spikeMagnitudeHR: 32 },
      },
      // Simultaneous sensor motion artifact from phone call gestures
      {
        type: 'SENSOR_MOTION_ARTIFACT',
        patientId: 'P005',
        startVirtualMs: shiftStartMs + 25 * 60 * 1000,
        durationMs: 3 * 60 * 1000,
        params: { motionPeak: 0.8 },
      },
    ],
  },

  // --------------------------------------------------------------------------
  // 4. SIGNAL_FAILURE_SCENARIO: Bed 402 Low Lighting & Sensor Loss
  // --------------------------------------------------------------------------
  SIGNAL_FAILURE_SCENARIO: {
    id: 'SIGNAL_FAILURE_SCENARIO',
    name: 'Sensor Failure & Confidence Degradation (Bed 402)',
    description:
      'Patient 2 has lights turned off and curtain drawn, followed by camera occlusion. Demonstrates confidence gating and information decay without false arrest alerts.',
    durationVirtualMinutes: 120,
    manualObservationsScheduleMinutes: [0, 90],
    phenomenaSchedule: (shiftStartMs: number): PhenomenonConfig[] => [
      // Dim lighting from min 10 to 45
      {
        type: 'POOR_LIGHTING_LOW_CONFIDENCE',
        patientId: 'P002',
        startVirtualMs: shiftStartMs + 10 * 60 * 1000,
        durationMs: 35 * 60 * 1000,
        params: { luxLevel: 15 },
      },
      // Complete line-of-sight obstruction from min 45 to 90
      {
        type: 'MISSING_OBSERVATIONS',
        patientId: 'P002',
        startVirtualMs: shiftStartMs + 45 * 60 * 1000,
        durationMs: 45 * 60 * 1000,
      },
    ],
  },

  // --------------------------------------------------------------------------
  // 5. MULTIPLE_PATIENT_SCENARIO: Simultaneous Ward Decompensation
  // --------------------------------------------------------------------------
  MULTIPLE_PATIENT_SCENARIO: {
    id: 'MULTIPLE_PATIENT_SCENARIO',
    name: 'Simultaneous Ward Decompensation (Bed 403 & Bed 406)',
    description:
      'Tests radar ranking under high ward pressure: Bed 403 deteriorates with occult hemorrhagic shock while Bed 406 deteriorates with acute hypoxemic respiratory failure.',
    durationVirtualMinutes: 120,
    manualObservationsScheduleMinutes: [0, 80],
    phenomenaSchedule: (shiftStartMs: number): PhenomenonConfig[] => [
      // Simultaneous deterioration for P003 and P006 starting at min 15
      {
        type: 'SIMULTANEOUS_DETERIORATION',
        patientId: 'MULTI',
        startVirtualMs: shiftStartMs + 15 * 60 * 1000,
        durationMs: 65 * 60 * 1000,
        params: {
          targetPatientIds: ['P003', 'P006'],
        },
      },
      // Bed 406 severe respiratory tachypnea acceleration starting min 25
      {
        type: 'GRADUAL_RESPIRATORY_DETERIORATION',
        patientId: 'P006',
        startVirtualMs: shiftStartMs + 25 * 60 * 1000,
        durationMs: 45 * 60 * 1000,
        params: { rrDeltaTarget: 14 }, // 22 -> 36 breaths/min
      },
      // Bed 403 persistent shock crash starting min 25
      {
        type: 'PERSISTENT_DETERIORATION',
        patientId: 'P003',
        startVirtualMs: shiftStartMs + 25 * 60 * 1000,
        durationMs: 45 * 60 * 1000,
        params: {
          hrDeltaTarget: 25,
          rrDeltaTarget: 6,
          sysBpDeltaTarget: -26,
        },
      },
    ],
  },
};
