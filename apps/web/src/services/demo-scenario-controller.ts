import type { WardPatientRadarState } from '../types/radar';
import { INITIAL_WARD_PATIENTS } from '../data/ward-simulated-data';

export type FlagshipDemoStep =
  | 'STEP_0_BASELINE'
  | 'STEP_1_TRANSIENT_SPIKE'
  | 'STEP_2_SENSOR_UNRELIABLE'
  | 'STEP_3_OCCULT_SHOCK'
  | 'STEP_4_NURSE_INSPECTION'
  | 'STEP_5_BEDSIDE_REASSESSMENT'
  | 'STEP_6_CLINICAL_RECOVERY';

export interface DemoStepMetadata {
  stepId: FlagshipDemoStep;
  index: number;
  title: string;
  subtitle: string;
  targetBed: string;
  targetPatientId: string;
  beforeState: string;
  changeDescription: string;
  whyExplanation: string;
  priorityOutcome: string;
  recommendedAction: string;
}

export const DEMO_STEPS_METADATA: Record<FlagshipDemoStep, DemoStepMetadata> = {
  STEP_0_BASELINE: {
    stepId: 'STEP_0_BASELINE',
    index: 0,
    title: 'Baseline: All 6 Beds Stable',
    subtitle: 'Calm postoperative surgical ward during shift turnover.',
    targetBed: 'All Beds',
    targetPatientId: 'ALL',
    beforeState: 'Shift start 07:00. Prior nursing handoff complete.',
    changeDescription: 'All 6 patients within physiological baseline parameters.',
    whyExplanation: 'Vitals stable (HR 68-80, RR 14-18, SBP 118-132). Zero active clinical alerts.',
    priorityOutcome: 'All beds categorized LOW priority (APS < 25). Radar quiet.',
    recommendedAction: 'Routine hourly contactless optical vitals monitoring.',
  },
  STEP_1_TRANSIENT_SPIKE: {
    stepId: 'STEP_1_TRANSIENT_SPIKE',
    index: 1,
    title: 'Event 1: Transient Sympathetic Spike (Bed 405)',
    subtitle: 'Demonstrating False-Alarm Suppression & Persistence Gating.',
    targetBed: 'Bed 405',
    targetPatientId: 'P005',
    beforeState: 'Bed 405 stable (HR 74 BPM, RR 16).',
    changeDescription: 'Patient talks animatedly on telephone and has brief coughing fit: HR spikes to 106 BPM.',
    whyExplanation: 'Sympathetic spike lasts < 2 minutes. Persistence and velocity filters suppress false alarm.',
    priorityOutcome: 'Transient bump to APS 28 (WATCH), rapidly decaying back to LOW without alarming nurse.',
    recommendedAction: 'No bedside intervention required. False positive alarm prevented.',
  },
  STEP_2_SENSOR_UNRELIABLE: {
    stepId: 'STEP_2_SENSOR_UNRELIABLE',
    index: 2,
    title: 'Event 2: Sensor Degradation & Confidence Gating (Bed 402)',
    subtitle: 'Explicit Uncertainty: Never Fabricating Physiology.',
    targetBed: 'Bed 402',
    targetPatientId: 'P002',
    beforeState: 'Optical camera streaming at 94% signal quality.',
    changeDescription: 'Curtain drawn and overhead lights turned off. Ambient illumination drops to 15 lux.',
    whyExplanation: 'Optical SNR drops below 2.0 dB. Signal Quality Index degrades to 24%.',
    priorityOutcome: 'System explicitly flags SENSOR_UNRELIABLE. Zero vital signs fabricated.',
    recommendedAction: 'Visual inspection prompt: "Optical signal degraded — verify room lighting or reposition".',
  },
  STEP_3_OCCULT_SHOCK: {
    stepId: 'STEP_3_OCCULT_SHOCK',
    index: 3,
    title: 'Event 3: Occult Hemorrhagic Shock Trajectory (Bed 403)',
    subtitle: 'Gradual Decompensation Escalating Priority to Rank 1.',
    targetBed: 'Bed 403',
    targetPatientId: 'P003',
    beforeState: 'Bed 403 Eleanor Vance (79F post-op femur fracture) stable at APS 22.',
    changeDescription: 'Subtle occult postoperative bleeding begins: HR rises to 114 BPM, RR to 26, SBP drops to 88 mmHg.',
    whyExplanation: 'Tachycardia + Tachypnea + Narrow Pulse Pressure + Shock Index 1.30 + MEWS 5.',
    priorityOutcome: 'APS surges to 88/100 (CRITICAL_REVIEW). Patient immediately rises to Rank 1 on Ward Radar.',
    recommendedAction: 'Urgent bedside clinical verification and fluid resuscitation review required.',
  },
  STEP_4_NURSE_INSPECTION: {
    stepId: 'STEP_4_NURSE_INSPECTION',
    index: 4,
    title: 'Event 4: Nurse Opens Bed 403 Patient Detail & SBAR',
    subtitle: 'Transparent Explainability: Answering "Why Now?" in Seconds.',
    targetBed: 'Bed 403',
    targetPatientId: 'P003',
    beforeState: 'Nurse alerted by Ward Radar priority change.',
    changeDescription: 'Primary nurse taps Bed 403 on tablet to inspect trajectory.',
    whyExplanation: 'Explainability engine displays exact contributions: Abnormality (+35), Velocity (+22), Persistence (+18).',
    priorityOutcome: 'Confidence high (98%). SBAR generated with pre-filled vital trajectories.',
    recommendedAction: 'Execute Bedside Verification checklist: Palpate peripheral pulse, check surgical drain.',
  },
  STEP_5_BEDSIDE_REASSESSMENT: {
    stepId: 'STEP_5_BEDSIDE_REASSESSMENT',
    index: 5,
    title: 'Event 5: Bedside Nurse Reassessment & Intervention',
    subtitle: 'Human-in-the-Loop: New Trusted Clinical Observation Ingested.',
    targetBed: 'Bed 403',
    targetPatientId: 'P003',
    beforeState: 'Occult shock confirmed at bedside station.',
    changeDescription: 'Nurse logs bedside physical exam, initiates 500 mL IV normal saline bolus, and pages surgical resident.',
    whyExplanation: 'New trusted manual observation overrides optical estimates. Freshness reset to 0 minutes.',
    priorityOutcome: 'Alert marked ACKNOWLEDGED by Nurse Rachel Hayes. RRT escalation logged in timeline.',
    recommendedAction: 'Monitor response to fluid challenge over next 15 minutes.',
  },
  STEP_6_CLINICAL_RECOVERY: {
    stepId: 'STEP_6_CLINICAL_RECOVERY',
    index: 6,
    title: 'Event 6: Post-Intervention Stabilization & Recovery',
    subtitle: 'Closing the Feedback Loop: Priority Decreases as Patient Stabilizes.',
    targetBed: 'Bed 403',
    targetPatientId: 'P003',
    beforeState: 'Bed 403 receiving fluid resuscitation.',
    changeDescription: 'Bleeding arrested at bedside; fluids restore intravascular volume: HR recovers to 82 BPM, SBP to 114 mmHg.',
    whyExplanation: 'Abnormality score collapses; negative velocity points; shock index normalizes to 0.72.',
    priorityOutcome: 'APS decreases from 88 -> 26 (WATCH / LOW). Patient drops down attention queue.',
    recommendedAction: 'Shift goal achieved: Occult shock detected early, treated, and resolved without ICU transfer.',
  },
};

export const ORDERED_DEMO_STEPS: FlagshipDemoStep[] = [
  'STEP_0_BASELINE',
  'STEP_1_TRANSIENT_SPIKE',
  'STEP_2_SENSOR_UNRELIABLE',
  'STEP_3_OCCULT_SHOCK',
  'STEP_4_NURSE_INSPECTION',
  'STEP_5_BEDSIDE_REASSESSMENT',
  'STEP_6_CLINICAL_RECOVERY',
];

export class DemoScenarioController {
  private currentStepIndex: number = 0;
  private readonly listeners = new Set<(step: DemoStepMetadata, patients: WardPatientRadarState[]) => void>();

  public getCurrentStep(): DemoStepMetadata {
    const stepKey = ORDERED_DEMO_STEPS[this.currentStepIndex];
    return DEMO_STEPS_METADATA[stepKey];
  }

  public getStepIndex(): number {
    return this.currentStepIndex;
  }

  public getTotalSteps(): number {
    return ORDERED_DEMO_STEPS.length;
  }

  public setStep(index: number): WardPatientRadarState[] {
    this.currentStepIndex = Math.max(0, Math.min(index, ORDERED_DEMO_STEPS.length - 1));
    const stepMetadata = this.getCurrentStep();
    const updatedPatients = this.generatePatientsForStep(stepMetadata.stepId);
    this.notify(stepMetadata, updatedPatients);
    return updatedPatients;
  }

  public nextStep(): WardPatientRadarState[] {
    return this.setStep(this.currentStepIndex + 1);
  }

  public prevStep(): WardPatientRadarState[] {
    return this.setStep(this.currentStepIndex - 1);
  }

  public reset(): WardPatientRadarState[] {
    return this.setStep(0);
  }

  public onStepChange(
    callback: (step: DemoStepMetadata, patients: WardPatientRadarState[]) => void
  ): () => void {
    this.listeners.add(callback);
    callback(this.getCurrentStep(), this.generatePatientsForStep(this.getCurrentStep().stepId));
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notify(step: DemoStepMetadata, patients: WardPatientRadarState[]): void {
    for (const cb of this.listeners) {
      try {
        cb(step, patients);
      } catch (err) {
        console.error('[DemoScenarioController] Error notifying listener:', err);
      }
    }
  }

  public generatePatientsForStep(step: FlagshipDemoStep): WardPatientRadarState[] {
    const base = JSON.parse(JSON.stringify(INITIAL_WARD_PATIENTS)) as WardPatientRadarState[];

    switch (step) {
      case 'STEP_0_BASELINE': {
        return base.map((p) => ({
          ...p,
          apsScore: Math.min(p.apsScore, 24),
          category: 'LOW',
          trendDirection: 'STEADY',
          trendVelocityPointsPerHour: 0.1,
          whyNowSummary: 'Patient stable. Postoperative vitals within established baseline thresholds.',
        }));
      }

      case 'STEP_1_TRANSIENT_SPIKE': {
        return base.map((p) => {
          if (p.patientId === 'P005') {
            return {
              ...p,
              apsScore: 28,
              category: 'WATCH',
              vitals: { ...p.vitals, heartRate: 106, respiratoryRate: 20 },
              trendDirection: 'RISING',
              whyNowSummary: 'Transient sympathetic spike during phone conversation. False-alarm filter active.',
            };
          }
          return {
            ...p,
            apsScore: Math.min(p.apsScore, 24),
            category: 'LOW',
          };
        });
      }

      case 'STEP_2_SENSOR_UNRELIABLE': {
        return base.map((p) => {
          if (p.patientId === 'P002') {
            return {
              ...p,
              signalQuality: {
                ...p.signalQuality,
                confidencePercent: 24,
                motionDetected: true,
                motionMagnitude: 0.85,
              },
              isStale: true,
              whyNowSummary: 'Curtains drawn & low lux (15 lux). rPPG confidence low — zero vitals fabricated.',
            };
          }
          return p;
        });
      }

      case 'STEP_3_OCCULT_SHOCK': {
        return base.map((p) => {
          if (p.patientId === 'P003') {
            return {
              ...p,
              apsScore: 88,
              category: 'CRITICAL_REVIEW',
              trendDirection: 'RAPIDLY_RISING',
              trendVelocityPointsPerHour: 18.5,
              vitals: {
                ...p.vitals,
                heartRate: 114,
                respiratoryRate: 26,
                systolicBP: 88,
                diastolicBP: 54,
                spo2: 94,
              },
              whyNowSummary: 'Occult Shock Trajectory: Tachycardia paired with narrowing pulse pressure (Shock Index 1.30, MEWS 5).',
            };
          }
          return p;
        });
      }

      case 'STEP_4_NURSE_INSPECTION': {
        return base.map((p) => {
          if (p.patientId === 'P003') {
            return {
              ...p,
              apsScore: 88,
              category: 'CRITICAL_REVIEW',
              trendDirection: 'RAPIDLY_RISING',
              trendVelocityPointsPerHour: 18.5,
              vitals: {
                ...p.vitals,
                heartRate: 114,
                respiratoryRate: 26,
                systolicBP: 88,
                diastolicBP: 54,
              },
              whyNowSummary: 'Occult Shock Trajectory: Nurse review active at station. SBAR package ready for surgical lead.',
            };
          }
          return p;
        });
      }

      case 'STEP_5_BEDSIDE_REASSESSMENT': {
        return base.map((p) => {
          if (p.patientId === 'P003') {
            return {
              ...p,
              apsScore: 72,
              category: 'EVALUATE',
              isAcknowledged: true,
              lastAcknowledgedAt: new Date().toISOString(),
              lastAcknowledgedBy: 'RN Rachel Hayes',
              lastTrustedElapsedMinutes: 0,
              lastTrustedObservationIso: new Date().toISOString(),
              timeline: [
                {
                  id: `TL-ACK-DEMO`,
                  patientId: 'P003',
                  timestamp: Date.now(),
                  eventType: 'RECOMMENDED_ACTION',
                  title: 'Rapid Response Team & 500mL Saline Bolus Initiated',
                  description: 'Bedside nurse administered IV crystalloid bolus; surgeon notified of suspected occult bleed.',
                  severity: 'CRITICAL',
                  source: 'NURSE_MANUAL',
                  isTrusted: true,
                },
                ...p.timeline,
              ],
              whyNowSummary: 'Intervention underway: 500mL Saline bolus running. Bedside observations verified.',
            };
          }
          return p;
        });
      }

      case 'STEP_6_CLINICAL_RECOVERY': {
        return base.map((p) => {
          if (p.patientId === 'P003') {
            return {
              ...p,
              apsScore: 26,
              category: 'WATCH',
              trendDirection: 'STEADY',
              trendVelocityPointsPerHour: -14.2,
              vitals: {
                ...p.vitals,
                heartRate: 82,
                respiratoryRate: 18,
                systolicBP: 114,
                diastolicBP: 72,
                spo2: 98,
              },
              whyNowSummary: 'Post-intervention stabilization: Blood pressure restored, tachycardia resolved.',
            };
          }
          return p;
        });
      }
    }
  }
}

export const demoScenarioController = new DemoScenarioController();
