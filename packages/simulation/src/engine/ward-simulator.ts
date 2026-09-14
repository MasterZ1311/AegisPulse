import type {
  Patient,
  Bed,
  Observation,
  SignalQuality,
  ClinicalContext,
  LaboratoryResult,
} from '@aegispulse/types';
import { SeededRandom } from '../prng/seeded-random';
import { SimulationClock, type ClockSnapshot } from '../clock/simulation-clock';
import {
  SIX_WARD_PATIENT_PROFILES,
  type PatientProfile,
} from '../models/patient-profiles';
import type {
  GroundTruthVitals,
  EnvironmentalState,
  DeveloperGroundTruthSnapshot,
} from '../models/ground-truth';
import { simulateSensorAcquisition } from '../models/sensor-noise';
import { PhenomenonEngine } from '../phenomena/phenomenon-engine';
import {
  SCENARIO_CATALOG,
  type ScenarioId,
  type ShiftScenarioDefinition,
} from '../scenarios/scenario-catalog';

export interface WardSnapshot {
  virtualTimeMs: number;
  virtualIso: string;
  scenarioId: ScenarioId;
  patients: Patient[];
  beds: Bed[];
  clinicalContexts: Record<string, ClinicalContext>;
  labs: Record<string, LaboratoryResult[]>;
  latestObservations: Record<string, Observation[]>;
  latestSignalQuality: Record<string, SignalQuality>;
  informationAgeMinutes: Record<string, number>;
}

export interface WardSimulatorOptions {
  seed?: number;
  startVirtualTimeMs?: number;
  initialSpeedMultiplier?: number;
  scenarioId?: ScenarioId;
  observationIntervalMs?: number; // Virtual ms between optical rPPG frames (default 1000ms = 1s)
}

export class WardSimulator {
  private readonly clock: SimulationClock;
  private readonly prng: SeededRandom;
  private readonly observationIntervalMs: number;

  private currentScenario: ShiftScenarioDefinition;
  private patientProfiles: Map<string, PatientProfile> = new Map();
  private groundTruthState: Map<string, GroundTruthVitals> = new Map();
  private environmentalState: Map<string, EnvironmentalState> = new Map();
  private lastManualCheckTimestamps: Map<string, number> = new Map();
  private lastObservationTimestamps: Map<string, number> = new Map();
  private lastObservationEmissionMs: Map<string, number> = new Map();

  private latestObservations: Map<string, Observation[]> = new Map();
  private latestSignalQuality: Map<string, SignalQuality> = new Map();
  private observationHistory: Map<string, Observation[]> = new Map();

  constructor(options: WardSimulatorOptions = {}) {
    const {
      seed = 4242,
      startVirtualTimeMs = 1773471600000,
      initialSpeedMultiplier = 1.0,
      scenarioId = 'NORMAL_SHIFT',
      observationIntervalMs = 1000,
    } = options;

    this.prng = new SeededRandom(seed);
    this.clock = new SimulationClock(startVirtualTimeMs, initialSpeedMultiplier);
    this.currentScenario = SCENARIO_CATALOG[scenarioId] ?? SCENARIO_CATALOG.NORMAL_SHIFT;
    this.observationIntervalMs = observationIntervalMs;

    this.initializeWard();
  }

  /**
   * Initialize patients, baselines, and environmental telemetry.
   */
  private initializeWard(): void {
    const startMs = this.clock.getStartVirtualTimeMs();

    for (const profile of SIX_WARD_PATIENT_PROFILES) {
      const pid = profile.patient.id;
      this.patientProfiles.set(pid, profile);
      this.groundTruthState.set(pid, { ...profile.baselineVitals });

      // Default clean daytime environment
      this.environmentalState.set(pid, {
        illuminationLux: 350,
        opticalLineOfSight: true,
        motionMagnitude: 0.05,
        contactSensorAttached: false,
        roomTemperatureCelsius: 22.0,
      });

      this.lastManualCheckTimestamps.set(pid, startMs);
      this.lastObservationTimestamps.set(pid, startMs);
      this.lastObservationEmissionMs.set(pid, 0);
      this.latestObservations.set(pid, []);
      this.observationHistory.set(pid, []);

      // Initial sensor acquisition at shift start (including manual vitals verification)
      this.recordManualBedsideCheck(pid);
    }
  }

  /**
   * Set active scenario and re-evaluate phenomena schedule.
   */
  public setScenario(scenarioId: ScenarioId): void {
    const scenario = SCENARIO_CATALOG[scenarioId];
    if (!scenario) {
      throw new Error(`Scenario '${scenarioId}' is not defined in SCENARIO_CATALOG`);
    }
    this.currentScenario = scenario;
  }

  public getActiveScenario(): ShiftScenarioDefinition {
    return this.currentScenario;
  }

  public getClock(): SimulationClock {
    return this.clock;
  }

  public setSpeedMultiplier(multiplier: number): void {
    this.clock.setSpeedMultiplier(multiplier);
  }

  public pause(): void {
    this.clock.pause();
  }

  public resume(): void {
    this.clock.resume();
  }

  /**
   * Advance simulation deterministically by virtual delta milliseconds.
   */
  public step(deltaVirtualMs: number): ClockSnapshot {
    const snapshot = this.clock.step(deltaVirtualMs);
    this.updateState();
    return snapshot;
  }

  /**
   * Advance simulation by real-world delta milliseconds scaled by speedMultiplier.
   */
  public tick(deltaRealMs: number): ClockSnapshot {
    const snapshot = this.clock.tick(deltaRealMs);
    this.updateState();
    return snapshot;
  }

  /**
   * Core simulation state update loop.
   * Computes ground truth physiology and emits sensor observations.
   */
  private updateState(): void {
    const currentVirtualMs = this.clock.getVirtualTimeMs();
    const shiftStartMs = this.clock.getStartVirtualTimeMs();
    const phenomena = this.currentScenario.phenomenaSchedule(shiftStartMs);

    for (const [patientId, profile] of this.patientProfiles.entries()) {
      const baselineEnv: EnvironmentalState = {
        illuminationLux: 350,
        opticalLineOfSight: true,
        motionMagnitude: 0.05,
        contactSensorAttached: false,
        roomTemperatureCelsius: 22.0,
      };

      // 1. Update Ground Truth biological physiology via PhenomenonEngine
      const { vitals, environment, activeNames: _activeNames } = PhenomenonEngine.applyPhenomena(
        patientId,
        currentVirtualMs,
        profile.baselineVitals,
        baselineEnv,
        phenomena,
        this.prng
      );

      this.groundTruthState.set(patientId, vitals);
      this.environmentalState.set(patientId, environment);

      // 2. Check scheduled manual nurse rounds
      const elapsedMinutes = Math.floor(this.clock.getElapsedVirtualMinutes());
      if (
        this.currentScenario.manualObservationsScheduleMinutes.includes(elapsedMinutes) &&
        currentVirtualMs - (this.lastManualCheckTimestamps.get(patientId) ?? 0) >= 55 * 60 * 1000
      ) {
        this.recordManualBedsideCheck(patientId);
      }

      // 3. Emit optical rPPG observation frame if sampling interval elapsed
      const lastEmission = this.lastObservationEmissionMs.get(patientId) ?? 0;
      if (currentVirtualMs - lastEmission >= this.observationIntervalMs) {
        const emission = simulateSensorAcquisition(
          patientId,
          profile.bed.id,
          currentVirtualMs,
          vitals,
          environment,
          this.prng,
          false
        );

        this.latestSignalQuality.set(patientId, emission.signalQuality);
        this.lastObservationEmissionMs.set(patientId, currentVirtualMs);

        if (emission.isObservationEmitted && emission.observations.length > 0) {
          this.latestObservations.set(patientId, emission.observations);
          this.lastObservationTimestamps.set(patientId, currentVirtualMs);

          // Append to history buffer (cap at 200 most recent observations per patient)
          const history = this.observationHistory.get(patientId) ?? [];
          history.push(...emission.observations);
          if (history.length > 200) {
            history.splice(0, history.length - 200);
          }
          this.observationHistory.set(patientId, history);
        }
      }
    }
  }

  /**
   * Simulate a manual bedside nurse visit to record full vitals
   * (including BP, Temperature, and contact SpO2).
   */
  public recordManualBedsideCheck(patientId: string): void {
    const profile = this.patientProfiles.get(patientId);
    if (!profile) return;

    const currentVirtualMs = this.clock.getVirtualTimeMs();
    const vitals = this.groundTruthState.get(patientId) ?? profile.baselineVitals;
    const env = this.environmentalState.get(patientId)!;

    const emission = simulateSensorAcquisition(
      patientId,
      profile.bed.id,
      currentVirtualMs,
      vitals,
      env,
      this.prng,
      true // Nurse manual check
    );

    this.lastManualCheckTimestamps.set(patientId, currentVirtualMs);
    this.lastObservationTimestamps.set(patientId, currentVirtualMs);
    this.latestSignalQuality.set(patientId, emission.signalQuality);
    this.latestObservations.set(patientId, emission.observations);

    const history = this.observationHistory.get(patientId) ?? [];
    history.push(...emission.observations);
    if (history.length > 200) {
      history.splice(0, history.length - 200);
    }
    this.observationHistory.set(patientId, history);
  }

  /**
   * CLINICAL WARD SNAPSHOT.
   * STRICT ISOLATION INVARIANT:
   * Returns ONLY clinical entities and sensor outputs that legitimate nurses and EHRs can see.
   * Contains ZERO ground truth biological state.
   */
  public getWardSnapshot(): WardSnapshot {
    const currentVirtualMs = this.clock.getVirtualTimeMs();
    const patients: Patient[] = [];
    const beds: Bed[] = [];
    const clinicalContexts: Record<string, ClinicalContext> = {};
    const labs: Record<string, LaboratoryResult[]> = {};
    const latestObservations: Record<string, Observation[]> = {};
    const latestSignalQuality: Record<string, SignalQuality> = {};
    const informationAgeMinutes: Record<string, number> = {};

    for (const [pid, profile] of this.patientProfiles.entries()) {
      patients.push(profile.patient);
      beds.push(profile.bed);
      clinicalContexts[pid] = profile.clinicalContext;
      labs[pid] = profile.initialLabs;
      latestObservations[pid] = this.latestObservations.get(pid) ?? [];
      latestSignalQuality[pid] = this.latestSignalQuality.get(pid)!;

      const lastObs = this.lastObservationTimestamps.get(pid) ?? this.clock.getStartVirtualTimeMs();
      const ageMinutes = Math.max(0, Number(((currentVirtualMs - lastObs) / (60 * 1000)).toFixed(1)));
      informationAgeMinutes[pid] = ageMinutes;
    }

    return {
      virtualTimeMs: currentVirtualMs,
      virtualIso: this.clock.getVirtualIso(),
      scenarioId: this.currentScenario.id,
      patients,
      beds,
      clinicalContexts,
      labs,
      latestObservations,
      latestSignalQuality,
      informationAgeMinutes,
    };
  }

  /**
   * DEVELOPER-ONLY GROUND TRUTH INSPECTION.
   * Exposes true underlying physiology, sensor noise deltas, and environmental states.
   * Strictly gated and used only for algorithm verification, bench tests, and diagnostics.
   */
  public getDeveloperGroundTruth(authKey: string = 'AEGIS_DEV_INSPECT'): DeveloperGroundTruthSnapshot {
    if (authKey !== 'AEGIS_DEV_INSPECT') {
      throw new Error('Unauthorized access: Developer inspection requires valid authentication key.');
    }

    const currentVirtualMs = this.clock.getVirtualTimeMs();
    const shiftStartMs = this.clock.getStartVirtualTimeMs();
    const phenomena = this.currentScenario.phenomenaSchedule(shiftStartMs);

    const patientsData = Array.from(this.patientProfiles.values()).map((profile) => {
      const pid = profile.patient.id;
      const trueVitals = this.groundTruthState.get(pid)!;
      const environment = this.environmentalState.get(pid)!;
      const observations = this.latestObservations.get(pid) ?? [];
      const sqi = this.latestSignalQuality.get(pid)!;

      const hrObs = observations.find((o) => o.vitalType === 'HEART_RATE');
      const rrObs = observations.find((o) => o.vitalType === 'RESPIRATORY_RATE');
      const sysObs = observations.find((o) => o.vitalType === 'SYSTOLIC_BP');
      const diaObs = observations.find((o) => o.vitalType === 'DIASTOLIC_BP');
      const spo2Obs = observations.find((o) => o.vitalType === 'OXYGEN_SATURATION');

      const observedHR = hrObs ? hrObs.value : null;
      const observedRR = rrObs ? rrObs.value : null;

      const activePhenomena = phenomena
        .filter(
          (p) =>
            (p.patientId === pid || p.params?.targetPatientIds?.includes(pid)) &&
            currentVirtualMs >= p.startVirtualMs &&
            currentVirtualMs <= p.startVirtualMs + p.durationMs
        )
        .map((p) => p.type);

      const lastManual = this.lastManualCheckTimestamps.get(pid) ?? shiftStartMs;
      const minutesSinceLastManualCheck = Number(((currentVirtualMs - lastManual) / (60 * 1000)).toFixed(1));

      return {
        patientId: pid,
        bedNumber: profile.bed.bedNumber,
        name: profile.patient.name,
        trueVitals: { ...trueVitals },
        observedVitalsSummary: {
          observedHR,
          observedRR,
          observedSysBP: sysObs ? sysObs.value : null,
          observedDiaBP: diaObs ? diaObs.value : null,
          observedSpO2: spo2Obs ? spo2Obs.value : null,
          sqiPercentage: sqi.sqiPercentage,
          sensorQualityState: sqi.state,
        },
        noiseDelta: {
          hrDelta: observedHR !== null ? Number((observedHR - trueVitals.heartRate).toFixed(1)) : 0,
          rrDelta: observedRR !== null ? Number((observedRR - trueVitals.respiratoryRate).toFixed(1)) : 0,
        },
        activity: 'RESTING_QUIET' as const,
        environment: { ...environment },
        activePhenomena,
        minutesSinceLastManualCheck,
      };
    });

    return {
      simulationTimestamp: currentVirtualMs,
      simulationIso: this.clock.getVirtualIso(),
      activeScenarioId: this.currentScenario.id,
      patients: patientsData,
    };
  }

  /**
   * Reset simulation state back to shift start.
   */
  public reset(): void {
    this.prng.reset();
    this.clock.reset();
    this.initializeWard();
  }
}
