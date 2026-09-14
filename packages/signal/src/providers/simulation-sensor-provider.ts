import type {
  SensorProvider,
  SensorReading,
  SensorStatus,
  SensorSource,
  Unsubscribe,
  SignalQuality,
  Patient,
} from '@aegispulse/types';
import { WardSimulator, type ScenarioId, type WardSnapshot } from '@aegispulse/simulation';


export interface SimulationSensorProviderOptions {
  providerId?: string;
  simulator?: WardSimulator;
  minConfidenceThreshold?: number; // Minimum confidence to declare VALID status (default 0.60)
  streamingIntervalMs?: number;
  scenarioId?: ScenarioId;
}

/**
 * SimulationSensorProvider
 * Adapts deterministic ward simulation engine into the agnostic SensorProvider contract.
 * Strictly guarantees that when confidence is insufficient, NO vitals are fabricated.
 */
export class SimulationSensorProvider implements SensorProvider {
  private readonly providerId: string;
  private readonly simulator: WardSimulator;
  private readonly minConfidenceThreshold: number;
  private readonly streamingIntervalMs: number;

  private isStreaming = false;
  private timer: NodeJS.Timeout | null = null;
  private lastReadingTimestamp?: number;
  private statusMessage = 'Initialized';

  private readingListeners: Set<(reading: SensorReading) => void> = new Set();
  private statusListeners: Set<(status: SensorStatus) => void> = new Set();

  constructor(options: SimulationSensorProviderOptions = {}) {
    this.providerId = options.providerId ?? 'simulation-sensor-provider';
    this.simulator =
      options.simulator ??
      new WardSimulator({
        scenarioId: options.scenarioId ?? 'NORMAL_SHIFT',
        observationIntervalMs: options.streamingIntervalMs ?? 1000,
      });
    this.minConfidenceThreshold = options.minConfidenceThreshold ?? 0.60;
    this.streamingIntervalMs = options.streamingIntervalMs ?? 1000;
  }

  public getProviderId(): string {
    return this.providerId;
  }

  public getSource(): SensorSource {
    return 'SIMULATION';
  }

  public getSimulator(): WardSimulator {
    return this.simulator;
  }

  public getStatus(): SensorStatus {
    return {
      providerId: this.providerId,
      source: 'SIMULATION',
      state: this.isStreaming ? 'STREAMING' : 'IDLE',
      connected: true,
      isStreaming: this.isStreaming,
      lastReadingTimestamp: this.lastReadingTimestamp,
      message: this.statusMessage,
      metadata: {
        activeScenario: this.simulator.getActiveScenario().id,
        streamingIntervalMs: this.streamingIntervalMs,
        minConfidenceThreshold: this.minConfidenceThreshold,
      },
    };
  }

  public onReading(callback: (reading: SensorReading) => void): Unsubscribe {
    this.readingListeners.add(callback);
    return () => this.readingListeners.delete(callback);
  }

  public onStatusChange(callback: (status: SensorStatus) => void): Unsubscribe {
    this.statusListeners.add(callback);
    return () => this.statusListeners.delete(callback);
  }

  private notifyStatus(message?: string): void {
    if (message) this.statusMessage = message;
    const status = this.getStatus();
    for (const listener of this.statusListeners) {
      try {
        listener(status);
      } catch (err) {
        console.error('Error in status listener:', err);
      }
    }
  }

  private notifyReading(reading: SensorReading): void {
    this.lastReadingTimestamp = reading.timestamp;
    for (const listener of this.readingListeners) {
      try {
        listener(reading);
      } catch (err) {
        console.error('Error in reading listener:', err);
      }
    }
  }

  public start(): void {
    if (this.isStreaming) return;
    this.isStreaming = true;
    this.notifyStatus('Simulation streaming started');

    this.timer = setInterval(() => {
      this.stepAndEmit();
    }, this.streamingIntervalMs);
  }

  public stop(): void {
    if (!this.isStreaming) return;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isStreaming = false;
    this.notifyStatus('Simulation streaming stopped');
  }

  /**
   * Advances simulation deterministically and emits readings for all ward patients.
   */
  public stepAndEmit(stepVirtualMs = 1000): SensorReading[] {
    this.simulator.step(stepVirtualMs);
    const snapshot = this.simulator.getWardSnapshot();
    const readings: SensorReading[] = [];

    for (const patient of snapshot.patients) {
      const reading = this.buildReadingForPatient(patient.id, snapshot);
      if (reading) {
        readings.push(reading);
        this.notifyReading(reading);
      }
    }

    return readings;
  }

  /**
   * Reads the current sensor reading for a specific patient.
   */
  public async read(patientId?: string): Promise<SensorReading | null> {
    const snapshot = this.simulator.getWardSnapshot();
    const targetId = patientId ?? snapshot.patients[0]?.id;
    if (!targetId) return null;

    const reading = this.buildReadingForPatient(targetId, snapshot);
    if (reading) {
      this.lastReadingTimestamp = reading.timestamp;
    }
    return reading;
  }

  /**
   * Constructs a SensorReading enforcing the strict zero-fabrication contract.
   */
  private buildReadingForPatient(
    patientId: string,
    snapshot: WardSnapshot
  ): SensorReading | null {
    const patient = snapshot.patients.find((p: Patient) => p.id === patientId);
    if (!patient) return null;


    const obsList = snapshot.latestObservations[patientId] ?? [];
    const signalQualityRaw = snapshot.latestSignalQuality[patientId];
    const timestamp = snapshot.virtualTimeMs;

    // Signal quality extraction
    const signalQuality: SignalQuality = signalQualityRaw ?? {
      sqiPercentage: 85,
      snrDb: 5.0,
      illuminationLux: 350,
      motionArtifactIndex: 0.05,
      state: 'TRUSTED',
      isUsable: true,
      faceDetected: true,
    };

    // Calculate effective confidence
    const primaryObs = obsList[0];
    const baseConfidence = primaryObs ? primaryObs.confidence : 0.50;
    const confidence = Number(
      Math.max(0.0, Math.min(1.0, baseConfidence)).toFixed(2)
    );

    // Evaluate confidence and noise conditions
    const isConfidenceInsufficient =
      confidence < this.minConfidenceThreshold ||
      signalQuality.motionArtifactIndex > 0.40 ||
      signalQuality.illuminationLux < 20 ||
      signalQuality.state === 'UNRELIABLE' ||
      signalQuality.state === 'LOST' ||
      !signalQuality.isUsable;

    if (isConfidenceInsufficient) {
      // INVARIANT ENFORCED: Zero physiological fabrication
      return {
        id: `sr-sim-${patientId}-${timestamp}`,
        patientId,
        bedId: patient.bedId,
        source: 'SIMULATION',
        timestamp,
        confidence,
        signalQuality: {
          ...signalQuality,
          state: signalQuality.state === 'TRUSTED' ? 'DEGRADED' : signalQuality.state,
          isUsable: false,
          reason: signalQuality.reason ?? 'Confidence below clinical safety threshold',
        },
        measurementStatus: 'LOW_CONFIDENCE',
        measurement_status: 'LOW_CONFIDENCE',
        // DO NOT FABRICATE PHYSIOLOGICAL VITALS
        heartRate: undefined,
        respiratoryRate: undefined,
        spo2: undefined,
        systolicBP: undefined,
        diastolicBP: undefined,
        temperature: undefined,
        metadata: {
          reason: 'Measurement confidence degraded - vitals withheld for clinical safety',
        },
      };
    }

    // When confidence is sufficient, extract simulated vitals
    let heartRate: number | undefined;
    let respiratoryRate: number | undefined;
    let spo2: number | undefined;
    let systolicBP: number | undefined;
    let diastolicBP: number | undefined;
    let temperature: number | undefined;

    for (const obs of obsList) {
      switch (obs.vitalType) {
        case 'HEART_RATE':
          heartRate = obs.value;
          break;
        case 'RESPIRATORY_RATE':
          respiratoryRate = obs.value;
          break;
        case 'OXYGEN_SATURATION':
          // Only allow contact SpO2
          if (obs.source !== 'OPTICAL_RPPG') {
            spo2 = obs.value;
          }
          break;
        case 'SYSTOLIC_BP':
          systolicBP = obs.value;
          break;
        case 'DIASTOLIC_BP':
          diastolicBP = obs.value;
          break;
        case 'BODY_TEMPERATURE':
          temperature = obs.value;
          break;
      }
    }

    return {
      id: `sr-sim-${patientId}-${timestamp}`,
      patientId,
      bedId: patient.bedId,
      source: 'SIMULATION',
      timestamp,
      confidence,
      signalQuality,
      measurementStatus: 'VALID',
      measurement_status: 'VALID',
      heartRate,
      respiratoryRate,
      spo2,
      systolicBP,
      diastolicBP,
      temperature,
      metadata: {
        scenarioId: snapshot.scenarioId,
      },
    };
  }
}
