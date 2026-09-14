import type { WardPatientRadarState } from '../types/radar';

const NOW_ISO = new Date().toISOString();
const MINUTE_MS = 60 * 1000;

export const INITIAL_WARD_PATIENTS: WardPatientRadarState[] = [
  // ==========================================================================
  // BED 403-A: Eleanor Vance (CRITICAL REVIEW - Occult Shock)
  // ==========================================================================
  {
    patientId: 'P003',
    bedNumber: '403-A',
    roomNumber: '403',
    mrn: 'MRN-40303',
    name: 'Eleanor Vance',
    age: 79,
    gender: 'FEMALE',
    admissionDiagnosis: 'Post-Op Day 2: Right Femur Fracture ORIF',
    admissionDate: new Date(Date.now() - 48 * 60 * MINUTE_MS).toISOString(),
    attendingPhysician: 'Dr. Sarah Lin, MD (Orthopedic Surgery)',
    primaryNurse: 'Nurse Rachel Hayes, RN',
    codeStatus: 'FULL_CODE',
    allergies: ['Latex'],
    isolationStatus: 'NONE',

    apsScore: 88,
    category: 'CRITICAL_REVIEW',
    categoryRank: 1,
    trendDirection: 'RAPIDLY_RISING',
    trendVelocityPointsPerHour: 28.4,

    whyNowSummary:
      'Continuous physiological deterioration over the last 40 minutes: Heart rate has accelerated from 78 to 118 bpm (+51% over baseline), paired with tachypnea at 28 /min and narrowing pulse pressure (94/58 mmHg, MAP 70 mmHg). MEWS score has jumped from 1 to 6. Occult retroperitoneal bleeding or developing septic shock requires immediate bedside evaluation.',

    topContributingReasons: [
      {
        id: 'CR-P003-1',
        category: 'VELOCITY',
        severity: 'CRITICAL',
        title: 'Accelerating Tachycardia',
        explanation: 'Heart rate increased from 78 bpm to 118 bpm (+40 bpm) continuously over the last 40 minutes with positive acceleration (+0.8 bpm/min²).',
        contributionPercent: 38,
        evidence: {
          variable: 'Heart Rate',
          currentValue: '118 bpm',
          baselineValue: '78 bpm',
          delta: '+40 bpm (+51.3%)',
          durationMinutes: 40,
        },
        provenance: {
          sourceObservationIds: ['OBS-P003-HR-040', 'OBS-P003-HR-000'],
          calculationRule: 'PhysiologicalVelocityComponent: weighted rolling 40m slope > 0.6 bpm/min with baseline excursion > 30%',
          rawScore: 0.94,
          normalizedWeight: 0.38,
        },
      },
      {
        id: 'CR-P003-2',
        category: 'PHYSIOLOGICAL_ABNORMALITY',
        severity: 'CRITICAL',
        title: 'Narrowing Pulse Pressure & Elevated Shock Index',
        explanation: 'Blood pressure dropped to 94/58 mmHg (MAP 70 mmHg), pushing Shock Index to 1.25 (threshold 0.9). Indicates active vascular collapse or hypovolemia.',
        contributionPercent: 29,
        evidence: {
          variable: 'Blood Pressure / Shock Index',
          currentValue: '94/58 mmHg (SI: 1.25)',
          baselineValue: '114/68 mmHg (SI: 0.68)',
          delta: '-20 mmHg SBP / +0.57 Shock Index',
          durationMinutes: 30,
        },
        provenance: {
          sourceObservationIds: ['OBS-P003-BP-030', 'OBS-P003-BP-000'],
          calculationRule: 'PhysiologicalAbnormalityComponent: Shock Index (HR / SBP) > 1.0 flags high risk occult shock',
          rawScore: 0.88,
          normalizedWeight: 0.29,
        },
      },
      {
        id: 'CR-P003-3',
        category: 'PERSISTENCE',
        severity: 'WARNING',
        title: 'Sustained Tachypnea (28 /min)',
        explanation: 'Respiratory rate has exceeded 24 /min for 32 consecutive minutes, fulfilling qSOFA criterion 1 and indicating compensatory metabolic acidosis buffering.',
        contributionPercent: 21,
        evidence: {
          variable: 'Respiratory Rate',
          currentValue: '28 /min',
          baselineValue: '16 /min',
          delta: '+12 /min (+75%)',
          durationMinutes: 32,
        },
        provenance: {
          sourceObservationIds: ['OBS-P003-RR-032'],
          calculationRule: 'PersistenceComponent: duration above critical threshold (24 /min) for > 20 minutes',
          rawScore: 0.76,
          normalizedWeight: 0.21,
        },
      },
      {
        id: 'CR-P003-4',
        category: 'CLINICAL_CONTEXT',
        severity: 'WARNING',
        title: 'High Surgical Bleed & Frailty Context',
        explanation: 'Post-Op Day 2 femur repair in 79-year-old with pre-existing CKD Stage 2 and Atrial Fibrillation increases susceptibility to rapid decompensation.',
        contributionPercent: 12,
        evidence: {
          variable: 'Clinical Context / Age',
          currentValue: 'Age 79, Post-Op Day 2, CKD 2, AFib',
          baselineValue: 'Full Code',
          delta: 'Compounded Risk',
        },
        provenance: {
          sourceObservationIds: ['CTX-P003'],
          calculationRule: 'ClinicalContextComponent: High-risk surgery (ORIF Femur) + age > 75 + comorbidity multiplier 1.25',
          rawScore: 0.65,
          normalizedWeight: 0.12,
        },
      },
    ],

    mews: {
      totalScore: 6,
      thresholdRisk: 'CRITICAL',
      breakdown: [
        { parameter: 'Heart Rate', value: '118 bpm', points: 2, normalRange: '51 - 100 bpm' },
        { parameter: 'Respiratory Rate', value: '28 /min', points: 2, normalRange: '9 - 14 /min' },
        { parameter: 'Systolic BP', value: '94 mmHg', points: 1, normalRange: '101 - 199 mmHg' },
        { parameter: 'Temperature', value: '37.8 °C', points: 0, normalRange: '35.0 - 38.4 °C' },
        { parameter: 'AVPU / Mentation', value: 'Voice / Lethargic', points: 1, normalRange: 'Alert' },
      ],
    },

    qsofa: {
      totalScore: 2,
      criteriaMet: 2,
      sepsisRiskIndicated: true,
      breakdown: [
        { criterion: 'Respiratory Rate ≥ 22 /min', isMet: true, value: '28 /min', points: 1 },
        { criterion: 'Altered Mentation (GCS < 15)', isMet: true, value: 'Mild Delirium / Voice (GCS 13)', points: 1 },
        { criterion: 'Systolic BP ≤ 100 mmHg', isMet: true, value: '94 mmHg', points: 1 },
      ],
    },

    vitals: {
      heartRate: 118,
      heartRateBaseline: 78,
      respiratoryRate: 28,
      respiratoryRateBaseline: 16,
      spo2: 94,
      spo2Baseline: 96,
      systolicBP: 94,
      systolicBPBaseline: 114,
      diastolicBP: 58,
      meanArterialPressure: 70,
      bodyTemperature: 37.8,
      shockIndex: 1.25,
      avpu: 'VOICE',
      oxygenDelivery: 'Room Air (2L Nasal Cannula recommended)',
    },

    trajectory: [
      { timeOffsetMinutes: -60, timestampIso: new Date(Date.now() - 60 * MINUTE_MS).toISOString(), apsScore: 18, heartRate: 78, respiratoryRate: 16, spo2: 96, systolicBP: 114, diastolicBP: 68 },
      { timeOffsetMinutes: -50, timestampIso: new Date(Date.now() - 50 * MINUTE_MS).toISOString(), apsScore: 24, heartRate: 84, respiratoryRate: 18, spo2: 96, systolicBP: 112, diastolicBP: 66 },
      { timeOffsetMinutes: -40, timestampIso: new Date(Date.now() - 40 * MINUTE_MS).toISOString(), apsScore: 36, heartRate: 92, respiratoryRate: 20, spo2: 95, systolicBP: 108, diastolicBP: 64 },
      { timeOffsetMinutes: -30, timestampIso: new Date(Date.now() - 30 * MINUTE_MS).toISOString(), apsScore: 54, heartRate: 101, respiratoryRate: 23, spo2: 95, systolicBP: 104, diastolicBP: 62 },
      { timeOffsetMinutes: -20, timestampIso: new Date(Date.now() - 20 * MINUTE_MS).toISOString(), apsScore: 69, heartRate: 108, respiratoryRate: 25, spo2: 94, systolicBP: 98, diastolicBP: 60 },
      { timeOffsetMinutes: -10, timestampIso: new Date(Date.now() - 10 * MINUTE_MS).toISOString(), apsScore: 78, heartRate: 114, respiratoryRate: 27, spo2: 94, systolicBP: 96, diastolicBP: 58 },
      { timeOffsetMinutes: 0, timestampIso: NOW_ISO, apsScore: 88, heartRate: 118, respiratoryRate: 28, spo2: 94, systolicBP: 94, diastolicBP: 58 },
    ],

    signalQuality: {
      confidencePercent: 94,
      snrDb: 18.6,
      motionMagnitude: 0.04,
      motionDetected: false,
      illuminationLux: 360,
      opticalLineOfSight: true,
      cameraDeviceId: 'CAM-RPPG-403',
      lastFrameProcessedIso: NOW_ISO,
      privacyNotice: 'Zero video transmitted or stored. Real-time telemetry derived from bed-mounted optical rPPG sensor.',
    },

    lastTrustedObservationIso: NOW_ISO,
    lastTrustedElapsedMinutes: 1,
    isStale: false,

    clinicalContext: {
      id: 'CTX-P003',
      patientId: 'P003',
      admissionReason: 'Right Femur Neck Fracture s/p Mechanical Fall',
      postOpDay: 2,
      comorbidities: ['Osteoporosis', 'Atrial Fibrillation', 'CKD Stage 2'],
      codeStatus: 'FULL_CODE',
      oxygenDelivery: 'ROOM_AIR',
      isolationStatus: 'NONE',
      baselineMEWS: 1,
      updatedAt: Date.now() - 24 * 60 * MINUTE_MS,
    },

    labs: [
      {
        id: 'LAB-P003-LAC',
        patientId: 'P003',
        timestamp: Date.now() - 45 * MINUTE_MS,
        testCode: 'LACTATE',
        testName: 'Venous Lactate',
        value: 2.8,
        unit: 'MMOL_PER_L',
        referenceRange: { low: 0.5, high: 2.0 },
        isCritical: true,
        sourceLab: 'Stat Ward Blood Gas',
      },
      {
        id: 'LAB-P003-HGB',
        patientId: 'P003',
        timestamp: Date.now() - 90 * MINUTE_MS,
        testCode: 'HEMOGLOBIN',
        testName: 'Hemoglobin',
        value: 8.1,
        unit: 'G_PER_DL',
        referenceRange: { low: 12.0, high: 16.0 },
        isCritical: true,
        sourceLab: 'Central Hospital Hematology',
      },
      {
        id: 'LAB-P003-WBC',
        patientId: 'P003',
        timestamp: Date.now() - 90 * MINUTE_MS,
        testCode: 'WBC',
        testName: 'White Blood Cell Count',
        value: 13.4,
        unit: 'X10_9_PER_L',
        referenceRange: { low: 4.0, high: 11.0 },
        isCritical: true,
        sourceLab: 'Central Hospital Lab',
      },
    ],

    recommendedVerifications: [
      {
        id: 'CHK-P003-1',
        text: 'Perform immediate palpated radial pulse and manual auscultation check',
        rationale: 'Verify tachycardia of 118 bpm against irregular rhythm (AFib history)',
        completed: false,
      },
      {
        id: 'CHK-P003-2',
        text: 'Measure manual blood pressure with calibrated sphygmomanometer cuff',
        rationale: 'Confirm narrow pulse pressure (94/58 mmHg) and assess orthostatic signs',
        completed: false,
      },
      {
        id: 'CHK-P003-3',
        text: 'Inspect surgical dressing over right hip for occult hematoma / active strike-through',
        rationale: 'Exclude acute retroperitoneal or deep surgical site hemorrhage (Hgb 8.1 g/dL)',
        completed: false,
      },
      {
        id: 'CHK-P003-4',
        text: 'Administer supplemental O2 via nasal cannula (2L/min) and start 500 mL IV crystalloid bolus',
        rationale: 'Maintain organ perfusion and mitigate elevated shock index (1.25)',
        completed: false,
      },
    ],

    timeline: [
      {
        id: 'TL-P003-01',
        patientId: 'P003',
        timestamp: Date.now() - 40 * MINUTE_MS,
        eventType: 'VITAL_MEASUREMENT',
        title: 'Tachycardia Threshold Exceeded',
        description: 'Heart rate climbed from baseline 78 to 92 bpm (+18%). Signal quality verified at 96%.',
        severity: 'INFO',
        source: 'OPTICAL_RPPG',
        isTrusted: true,
      },
      {
        id: 'TL-P003-02',
        patientId: 'P003',
        timestamp: Date.now() - 30 * MINUTE_MS,
        eventType: 'APS_CHANGE',
        title: 'Attention Priority Escalated: WATCH -> EVALUATE',
        description: 'APS score increased to 54/100 due to persistent respiratory rise (23 /min) and tachycardic velocity.',
        severity: 'WARNING',
        source: 'CLINICAL_ENGINE',
        isTrusted: true,
      },
      {
        id: 'TL-P003-03',
        patientId: 'P003',
        timestamp: Date.now() - 20 * MINUTE_MS,
        eventType: 'MEWS_CHANGE',
        title: 'MEWS Score Jumped to 4',
        description: 'Parameters scored: HR (108 bpm, +2 pts), RR (25 /min, +2 pts). Clinical trigger alert.',
        severity: 'WARNING',
        source: 'CLINICAL_ENGINE',
        isTrusted: true,
      },
      {
        id: 'TL-P003-04',
        patientId: 'P003',
        timestamp: Date.now() - 10 * MINUTE_MS,
        eventType: 'LAB_RESULT',
        title: 'Critical Lactate Result: 2.8 mmol/L',
        description: 'Venous blood gas reveals lactic acidosis (reference high 2.0 mmol/L).',
        severity: 'CRITICAL',
        source: 'LAB_LIS',
        isTrusted: true,
      },
      {
        id: 'TL-P003-05',
        patientId: 'P003',
        timestamp: Date.now() - 2 * MINUTE_MS,
        eventType: 'APS_CHANGE',
        title: 'Priority Escalated: CRITICAL REVIEW (Score 88)',
        description: 'All 3 qSOFA criteria met. Top reason: Accelerating tachycardia and narrow pulse pressure indicate impending shock.',
        severity: 'CRITICAL',
        source: 'CLINICAL_ENGINE',
        isTrusted: true,
      },
    ],

    isAcknowledged: false,
  },

  // ==========================================================================
  // BED 406-B: James Wilson (EVALUATE - Severe CAP Respiratory Deterioration)
  // ==========================================================================
  {
    patientId: 'P006',
    bedNumber: '406-B',
    roomNumber: '406',
    mrn: 'MRN-40606',
    name: 'James Wilson',
    age: 73,
    gender: 'MALE',
    admissionDiagnosis: 'Severe Community-Acquired Pneumonia (Bilateral Infiltrates)',
    admissionDate: new Date(Date.now() - 72 * 60 * MINUTE_MS).toISOString(),
    attendingPhysician: 'Dr. Michael Sterling, MD (Pulmonology)',
    primaryNurse: 'Nurse Rachel Hayes, RN',
    codeStatus: 'FULL_CODE',
    allergies: ['Ciprofloxacin'],
    isolationStatus: 'DROPLET',

    apsScore: 68,
    category: 'EVALUATE',
    categoryRank: 2,
    trendDirection: 'RISING',
    trendVelocityPointsPerHour: 14.2,

    whyNowSummary:
      'Persistent respiratory decompensation: Respiratory rate has steadily climbed from 18 to 26 /min over the past 50 minutes, with SpO2 dropping to 91% despite 3L nasal cannula. MEWS score is 4. High risk of respiratory muscle fatigue and impending ventilatory failure.',

    topContributingReasons: [
      {
        id: 'CR-P006-1',
        category: 'PERSISTENCE',
        severity: 'WARNING',
        title: 'Sustained Tachypnea with Hypoxia',
        explanation: 'Respiratory rate remains above 24 /min for > 45 minutes; pulse oximetry trending downwards to 91%.',
        contributionPercent: 44,
        evidence: {
          variable: 'Respiratory Rate / SpO2',
          currentValue: '26 /min (SpO2 91%)',
          baselineValue: '18 /min (SpO2 95%)',
          delta: '+8 /min / -4% SpO2',
          durationMinutes: 45,
        },
        provenance: {
          sourceObservationIds: ['OBS-P006-RR-045'],
          calculationRule: 'PersistenceComponent: persistent tachypnea > 24 /min on supplemental oxygen',
          rawScore: 0.78,
          normalizedWeight: 0.44,
        },
      },
      {
        id: 'CR-P006-2',
        category: 'PHYSIOLOGICAL_ABNORMALITY',
        severity: 'WARNING',
        title: 'Elevated Work of Breathing',
        explanation: 'Heart rate compensatory elevation to 98 bpm to maintain tissue oxygen delivery during hypoxemia.',
        contributionPercent: 32,
        evidence: {
          variable: 'Heart Rate',
          currentValue: '98 bpm',
          baselineValue: '84 bpm',
          delta: '+14 bpm',
        },
        provenance: {
          sourceObservationIds: ['OBS-P006-HR-020'],
          calculationRule: 'PhysiologicalAbnormalityComponent: compensatory tachycardia during respiratory distress',
          rawScore: 0.68,
          normalizedWeight: 0.32,
        },
      },
      {
        id: 'CR-P006-3',
        category: 'CLINICAL_CONTEXT',
        severity: 'INFO',
        title: 'Severe Pneumonia with NYHA II Heart Failure',
        explanation: 'Pre-existing congestive heart failure impairs pulmonary reserve and accelerates fatigue.',
        contributionPercent: 24,
        evidence: {
          variable: 'Context Comorbidities',
          currentValue: 'Severe CAP, CHF NYHA II, Droplet Precautions',
        },
        provenance: {
          sourceObservationIds: ['CTX-P006'],
          calculationRule: 'ClinicalContextComponent: cardiopulmonary comorbidity multiplier',
          rawScore: 0.60,
          normalizedWeight: 0.24,
        },
      },
    ],

    mews: {
      totalScore: 4,
      thresholdRisk: 'HIGH',
      breakdown: [
        { parameter: 'Heart Rate', value: '98 bpm', points: 1, normalRange: '51 - 100 bpm' },
        { parameter: 'Respiratory Rate', value: '26 /min', points: 2, normalRange: '9 - 14 /min' },
        { parameter: 'Systolic BP', value: '136 mmHg', points: 0, normalRange: '101 - 199 mmHg' },
        { parameter: 'Temperature', value: '38.6 °C', points: 1, normalRange: '35.0 - 38.4 °C' },
        { parameter: 'AVPU / Mentation', value: 'Alert', points: 0, normalRange: 'Alert' },
      ],
    },

    qsofa: {
      totalScore: 1,
      criteriaMet: 1,
      sepsisRiskIndicated: false,
      breakdown: [
        { criterion: 'Respiratory Rate ≥ 22 /min', isMet: true, value: '26 /min', points: 1 },
        { criterion: 'Altered Mentation (GCS < 15)', isMet: false, value: 'Alert (GCS 15)', points: 0 },
        { criterion: 'Systolic BP ≤ 100 mmHg', isMet: false, value: '136 mmHg', points: 0 },
      ],
    },

    vitals: {
      heartRate: 98,
      heartRateBaseline: 84,
      respiratoryRate: 26,
      respiratoryRateBaseline: 18,
      spo2: 91,
      spo2Baseline: 95,
      systolicBP: 136,
      systolicBPBaseline: 132,
      diastolicBP: 84,
      meanArterialPressure: 101,
      bodyTemperature: 38.6,
      shockIndex: 0.72,
      avpu: 'ALERT',
      oxygenDelivery: 'Nasal Cannula 3.0 L/min',
    },

    trajectory: [
      { timeOffsetMinutes: -60, timestampIso: new Date(Date.now() - 60 * MINUTE_MS).toISOString(), apsScore: 32, heartRate: 84, respiratoryRate: 18, spo2: 95, systolicBP: 132, diastolicBP: 82 },
      { timeOffsetMinutes: -40, timestampIso: new Date(Date.now() - 40 * MINUTE_MS).toISOString(), apsScore: 42, heartRate: 88, respiratoryRate: 21, spo2: 94, systolicBP: 134, diastolicBP: 82 },
      { timeOffsetMinutes: -20, timestampIso: new Date(Date.now() - 20 * MINUTE_MS).toISOString(), apsScore: 56, heartRate: 94, respiratoryRate: 24, spo2: 92, systolicBP: 136, diastolicBP: 84 },
      { timeOffsetMinutes: 0, timestampIso: NOW_ISO, apsScore: 68, heartRate: 98, respiratoryRate: 26, spo2: 91, systolicBP: 136, diastolicBP: 84 },
    ],

    signalQuality: {
      confidencePercent: 91,
      snrDb: 16.4,
      motionMagnitude: 0.06,
      motionDetected: false,
      illuminationLux: 340,
      opticalLineOfSight: true,
      cameraDeviceId: 'CAM-RPPG-406',
      lastFrameProcessedIso: NOW_ISO,
      privacyNotice: 'Zero video transmitted or stored. Pure optical rPPG PPG telemetry.',
    },

    lastTrustedObservationIso: NOW_ISO,
    lastTrustedElapsedMinutes: 2,
    isStale: false,

    clinicalContext: {
      id: 'CTX-P006',
      patientId: 'P006',
      admissionReason: 'Severe CAP with bilateral infiltrates',
      postOpDay: 0,
      comorbidities: ['CHF NYHA II', 'Type 2 Diabetes'],
      codeStatus: 'FULL_CODE',
      oxygenDelivery: 'NASAL_CANNULA',
      isolationStatus: 'DROPLET',
      baselineMEWS: 3,
      updatedAt: Date.now() - 36 * 60 * MINUTE_MS,
    },

    labs: [
      {
        id: 'LAB-P006-WBC',
        patientId: 'P006',
        timestamp: Date.now() - 120 * MINUTE_MS,
        testCode: 'WBC',
        testName: 'White Blood Cell Count',
        value: 15.2,
        unit: 'X10_9_PER_L',
        referenceRange: { low: 4.0, high: 11.0 },
        isCritical: true,
        sourceLab: 'Central Lab',
      },
    ],

    recommendedVerifications: [
      {
        id: 'CHK-P006-1',
        text: 'Auscultate bilateral lung fields for crackles, wheezing, or bronchial sounds',
        rationale: 'Assess progression of pneumonia consolidation vs pulmonary edema',
        completed: false,
      },
      {
        id: 'CHK-P006-2',
        text: 'Titrate supplemental oxygen to maintain target SpO2 92-96%',
        rationale: 'Escalate from nasal cannula to Venturi mask or High-Flow Nasal Cannula',
        completed: false,
      },
      {
        id: 'CHK-P006-3',
        text: 'Obtain arterial blood gas (ABG) to evaluate PaO2 / FiO2 ratio and PaCO2',
        rationale: 'Detect impending hypercapnic respiratory failure and muscle exhaustion',
        completed: false,
      },
    ],

    timeline: [
      {
        id: 'TL-P006-01',
        patientId: 'P006',
        timestamp: Date.now() - 45 * MINUTE_MS,
        eventType: 'VITAL_MEASUREMENT',
        title: 'Respiratory Rate Reached 22 /min',
        description: 'First breach of qSOFA respiratory threshold.',
        severity: 'INFO',
        source: 'OPTICAL_RPPG',
        isTrusted: true,
      },
      {
        id: 'TL-P006-02',
        patientId: 'P006',
        timestamp: Date.now() - 15 * MINUTE_MS,
        eventType: 'APS_CHANGE',
        title: 'Priority Escalated: WATCH -> EVALUATE (Score 68)',
        description: 'Compounding hypoxia and persistent tachypnea.',
        severity: 'WARNING',
        source: 'CLINICAL_ENGINE',
        isTrusted: true,
      },
    ],

    isAcknowledged: false,
  },

  // ==========================================================================
  // BED 402-A: Robert Chen (WATCH - COPD Exacerbation on Baseline Oxygen)
  // ==========================================================================
  {
    patientId: 'P002',
    bedNumber: '402-A',
    roomNumber: '402',
    mrn: 'MRN-40202',
    name: 'Robert Chen',
    age: 68,
    gender: 'MALE',
    admissionDiagnosis: 'Acute Exacerbation of COPD (GOLD Stage III)',
    admissionDate: new Date(Date.now() - 96 * 60 * MINUTE_MS).toISOString(),
    attendingPhysician: 'Dr. Michael Sterling, MD',
    primaryNurse: 'Nurse Rachel Hayes, RN',
    codeStatus: 'FULL_CODE',
    allergies: ['Sulfa drugs'],
    isolationStatus: 'NONE',

    apsScore: 46,
    category: 'WATCH',
    categoryRank: 3,
    trendDirection: 'STEADY',
    trendVelocityPointsPerHour: 3.1,

    whyNowSummary:
      'Chronic baseline elevation: Patient maintains a baseline tachypnea of 20 /min and SpO2 of 93% on 2L nasal cannula. Mild elevation to 21 /min observed with stable heart rate (88 bpm) and normal blood pressure. Requires ongoing vigil to prevent acute carbon dioxide retention.',

    topContributingReasons: [
      {
        id: 'CR-P002-1',
        category: 'BASELINE_DEVIATION',
        severity: 'WARNING',
        title: 'Baseline Elevation with Narrow Safety Margin',
        explanation: 'COPD GOLD Stage III baseline vitals naturally sit close to clinical thresholds; small excursions have heightened clinical significance.',
        contributionPercent: 62,
        evidence: {
          variable: 'Respiratory Baseline',
          currentValue: '21 /min',
          baselineValue: '20 /min',
          delta: '+1 /min',
        },
        provenance: {
          sourceObservationIds: ['OBS-P002-RR'],
          calculationRule: 'BaselineDeviationComponent: baseline elevation adjusted for chronic COPD context',
          rawScore: 0.52,
          normalizedWeight: 0.62,
        },
      },
      {
        id: 'CR-P002-2',
        category: 'CLINICAL_CONTEXT',
        severity: 'INFO',
        title: 'Target SpO2 88-92% (Risk of CO2 Narcosis)',
        explanation: 'Avoid over-oxygenation in hypercapnic respiratory drive.',
        contributionPercent: 38,
        evidence: {
          variable: 'Target SpO2',
          currentValue: '93% on 2L NC',
        },
        provenance: {
          sourceObservationIds: ['CTX-P002'],
          calculationRule: 'ClinicalContextComponent: hypoxic drive cautionary envelope',
          rawScore: 0.40,
          normalizedWeight: 0.38,
        },
      },
    ],

    mews: {
      totalScore: 2,
      thresholdRisk: 'MEDIUM',
      breakdown: [
        { parameter: 'Heart Rate', value: '88 bpm', points: 0, normalRange: '51 - 100 bpm' },
        { parameter: 'Respiratory Rate', value: '21 /min', points: 1, normalRange: '9 - 14 /min' },
        { parameter: 'Systolic BP', value: '132 mmHg', points: 0, normalRange: '101 - 199 mmHg' },
        { parameter: 'Temperature', value: '37.1 °C', points: 0, normalRange: '35.0 - 38.4 °C' },
        { parameter: 'AVPU / Mentation', value: 'Alert', points: 0, normalRange: 'Alert' },
      ],
    },

    vitals: {
      heartRate: 88,
      heartRateBaseline: 86,
      respiratoryRate: 21,
      respiratoryRateBaseline: 20,
      spo2: 93,
      spo2Baseline: 93,
      systolicBP: 132,
      systolicBPBaseline: 132,
      diastolicBP: 82,
      meanArterialPressure: 98,
      bodyTemperature: 37.1,
      shockIndex: 0.67,
      avpu: 'ALERT',
      oxygenDelivery: 'Nasal Cannula 2.0 L/min',
    },

    trajectory: [
      { timeOffsetMinutes: -60, timestampIso: new Date(Date.now() - 60 * MINUTE_MS).toISOString(), apsScore: 44, heartRate: 86, respiratoryRate: 20, spo2: 93, systolicBP: 132, diastolicBP: 82 },
      { timeOffsetMinutes: -30, timestampIso: new Date(Date.now() - 30 * MINUTE_MS).toISOString(), apsScore: 45, heartRate: 87, respiratoryRate: 21, spo2: 93, systolicBP: 130, diastolicBP: 82 },
      { timeOffsetMinutes: 0, timestampIso: NOW_ISO, apsScore: 46, heartRate: 88, respiratoryRate: 21, spo2: 93, systolicBP: 132, diastolicBP: 82 },
    ],

    signalQuality: {
      confidencePercent: 88,
      snrDb: 15.2,
      motionMagnitude: 0.08,
      motionDetected: false,
      illuminationLux: 350,
      opticalLineOfSight: true,
      cameraDeviceId: 'CAM-RPPG-402',
      lastFrameProcessedIso: NOW_ISO,
      privacyNotice: 'Zero video transmitted or stored.',
    },

    lastTrustedObservationIso: NOW_ISO,
    lastTrustedElapsedMinutes: 3,
    isStale: false,

    clinicalContext: {
      id: 'CTX-P002',
      patientId: 'P002',
      admissionReason: 'COPD Exacerbation with Purulent Sputum',
      postOpDay: 0,
      comorbidities: ['COPD GOLD Stage III', 'CAD', 'Hypertension'],
      codeStatus: 'FULL_CODE',
      oxygenDelivery: 'NASAL_CANNULA',
      o2FlowRateLpm: 2.0,
      isolationStatus: 'NONE',
      baselineMEWS: 2,
      updatedAt: Date.now() - 60 * MINUTE_MS,
    },

    labs: [
      {
        id: 'LAB-P002-WBC',
        patientId: 'P002',
        timestamp: Date.now() - 180 * MINUTE_MS,
        testCode: 'WBC',
        testName: 'White Blood Cell Count',
        value: 11.4,
        unit: 'X10_9_PER_L',
        referenceRange: { low: 4.0, high: 11.0 },
        isCritical: true,
        sourceLab: 'Central Lab',
      },
    ],

    recommendedVerifications: [
      {
        id: 'CHK-P002-1',
        text: 'Verify oxygen flow rate is set exactly to 2.0 L/min via wall flowmeter',
        rationale: 'Ensure target saturation stays within 88-92% safe COPD window',
        completed: true,
        completedAt: new Date(Date.now() - 30 * MINUTE_MS).toISOString(),
        completedBy: 'RN Rachel Hayes',
      },
      {
        id: 'CHK-P002-2',
        text: 'Observe sputum production and assess work of breathing',
        rationale: 'Check for purulent changes or accessory muscle fatigue',
        completed: false,
      },
    ],

    timeline: [
      {
        id: 'TL-P002-01',
        patientId: 'P002',
        timestamp: Date.now() - 60 * MINUTE_MS,
        eventType: 'VITAL_MEASUREMENT',
        title: 'Routine Ward Observation',
        description: 'Vitals stable on 2L nasal cannula.',
        severity: 'INFO',
        source: 'OPTICAL_RPPG',
        isTrusted: true,
      },
    ],

    isAcknowledged: true,
    lastAcknowledgedAt: new Date(Date.now() - 25 * MINUTE_MS).toISOString(),
    lastAcknowledgedBy: 'RN Rachel Hayes',
  },

  // ==========================================================================
  // BED 405-A: Sunita Patel (WATCH - Post-CABG Step-Down Motion Artifact)
  // ==========================================================================
  {
    patientId: 'P005',
    bedNumber: '405-A',
    roomNumber: '405',
    mrn: 'MRN-40505',
    name: 'Sunita Patel',
    age: 61,
    gender: 'FEMALE',
    admissionDiagnosis: 'Post-CABG Step-Down Surveillance (Post-Op Day 4)',
    admissionDate: new Date(Date.now() - 120 * 60 * MINUTE_MS).toISOString(),
    attendingPhysician: 'Dr. Sarah Lin, MD (Cardiothoracic Surgery)',
    primaryNurse: 'Nurse Rachel Hayes, RN',
    codeStatus: 'FULL_CODE',
    allergies: ['Aspirin'],
    isolationStatus: 'NONE',

    apsScore: 38,
    category: 'WATCH',
    categoryRank: 4,
    trendDirection: 'STEADY',
    trendVelocityPointsPerHour: 1.5,

    whyNowSummary:
      'Sensor confidence degraded by motion: Patient is active in bed with telephone and visiting family; optical motion artifact has temporarily reduced rPPG confidence to 62%. Heart rate telemetry is filtered and suppressed where noise exceeds thresholds. No physiological deterioration evident.',

    topContributingReasons: [
      {
        id: 'CR-P005-1',
        category: 'SIGNAL_CONFIDENCE',
        severity: 'WARNING',
        title: 'Optical Signal Motion Artifact',
        explanation: 'Current signal confidence is 62%; high motion magnitude (0.42) from patient ambulation / bed movement. Unreliable readings are suppressed.',
        contributionPercent: 78,
        evidence: {
          variable: 'Optical Confidence',
          currentValue: '62% (Motion Index: 0.42)',
          baselineValue: '96% (Motion Index: 0.04)',
          delta: '-34% Confidence',
        },
        provenance: {
          sourceObservationIds: ['SIG-P005-001'],
          calculationRule: 'SignalConfidenceComponent: confidence penalty applied to prioritize sensor re-alignment or manual pulse check',
          rawScore: 0.62,
          normalizedWeight: 0.78,
        },
      },
      {
        id: 'CR-P005-2',
        category: 'CLINICAL_CONTEXT',
        severity: 'INFO',
        title: 'Post-CABG Day 4 Rhythm Surveillance',
        explanation: 'High risk window for post-operative atrial fibrillation or atrial flutter.',
        contributionPercent: 22,
        evidence: {
          variable: 'Post-Op Protocol',
          currentValue: 'Post-Op Day 4 CABG',
        },
        provenance: {
          sourceObservationIds: ['CTX-P005'],
          calculationRule: 'ClinicalContextComponent: post-cardiac surgical surveillance weighting',
          rawScore: 0.35,
          normalizedWeight: 0.22,
        },
      },
    ],

    mews: {
      totalScore: 0,
      thresholdRisk: 'LOW',
      breakdown: [
        { parameter: 'Heart Rate', value: '78 bpm', points: 0, normalRange: '51 - 100 bpm' },
        { parameter: 'Respiratory Rate', value: '18 /min', points: 0, normalRange: '9 - 14 /min' },
        { parameter: 'Systolic BP', value: '120 mmHg', points: 0, normalRange: '101 - 199 mmHg' },
        { parameter: 'Temperature', value: '36.9 °C', points: 0, normalRange: '35.0 - 38.4 °C' },
        { parameter: 'AVPU / Mentation', value: 'Alert', points: 0, normalRange: 'Alert' },
      ],
    },

    vitals: {
      heartRate: 78,
      heartRateBaseline: 74,
      respiratoryRate: 18,
      respiratoryRateBaseline: 16,
      spo2: 97,
      spo2Baseline: 98,
      systolicBP: 120,
      systolicBPBaseline: 120,
      diastolicBP: 74,
      meanArterialPressure: 89,
      bodyTemperature: 36.9,
      shockIndex: 0.65,
      avpu: 'ALERT',
      oxygenDelivery: 'Room Air',
    },

    trajectory: [
      { timeOffsetMinutes: -60, timestampIso: new Date(Date.now() - 60 * MINUTE_MS).toISOString(), apsScore: 16, heartRate: 74, respiratoryRate: 16, spo2: 98, systolicBP: 120, diastolicBP: 74 },
      { timeOffsetMinutes: -30, timestampIso: new Date(Date.now() - 30 * MINUTE_MS).toISOString(), apsScore: 28, heartRate: 76, respiratoryRate: 17, spo2: 97, systolicBP: 122, diastolicBP: 76 },
      { timeOffsetMinutes: 0, timestampIso: NOW_ISO, apsScore: 38, heartRate: 78, respiratoryRate: 18, spo2: 97, systolicBP: 120, diastolicBP: 74 },
    ],

    signalQuality: {
      confidencePercent: 62,
      snrDb: 9.4,
      motionMagnitude: 0.42,
      motionDetected: true,
      illuminationLux: 380,
      opticalLineOfSight: true,
      cameraDeviceId: 'CAM-RPPG-405',
      lastFrameProcessedIso: NOW_ISO,
      privacyNotice: 'Zero video transmitted or stored.',
    },

    lastTrustedObservationIso: new Date(Date.now() - 14 * MINUTE_MS).toISOString(),
    lastTrustedElapsedMinutes: 14,
    isStale: false,

    clinicalContext: {
      id: 'CTX-P005',
      patientId: 'P005',
      admissionReason: 'Cardiac Step-Down Ward Surveillance s/p CABG',
      postOpDay: 4,
      comorbidities: ['Ischemic Heart Disease', 'Hypertension'],
      codeStatus: 'FULL_CODE',
      oxygenDelivery: 'ROOM_AIR',
      isolationStatus: 'NONE',
      baselineMEWS: 0,
      updatedAt: Date.now() - 90 * MINUTE_MS,
    },

    labs: [
      {
        id: 'LAB-P005-LAC',
        patientId: 'P005',
        timestamp: Date.now() - 240 * MINUTE_MS,
        testCode: 'LACTATE',
        testName: 'Venous Lactate',
        value: 1.2,
        unit: 'MMOL_PER_L',
        referenceRange: { low: 0.5, high: 2.0 },
        isCritical: false,
        sourceLab: 'Central Lab',
      },
    ],

    recommendedVerifications: [
      {
        id: 'CHK-P005-1',
        text: 'Encourage patient to rest quietly for 2 minutes to re-acquire high-confidence optical lock',
        rationale: 'Allow sensor noise filter to stabilize baseline PPG waveform',
        completed: false,
      },
      {
        id: 'CHK-P005-2',
        text: 'Perform quick palpated radial pulse check to confirm sinus rhythm',
        rationale: 'Verify cardiac rhythm during motion artifact phase',
        completed: false,
      },
    ],

    timeline: [
      {
        id: 'TL-P005-01',
        patientId: 'P005',
        timestamp: Date.now() - 15 * MINUTE_MS,
        eventType: 'SIGNAL_QUALITY_CHANGE',
        title: 'Sensor Motion Artifact Detected',
        description: 'Motion magnitude jumped to 0.42. Confidence reduced to 62%.',
        severity: 'WARNING',
        source: 'OPTICAL_RPPG',
        isTrusted: false,
      },
    ],

    isAcknowledged: false,
  },

  // ==========================================================================
  // BED 404-B: Marcus Davies (LOW - Acute Pancreatitis Day 3 Recovery)
  // ==========================================================================
  {
    patientId: 'P004',
    bedNumber: '404-B',
    roomNumber: '404',
    mrn: 'MRN-40404',
    name: 'Marcus Davies',
    age: 55,
    gender: 'MALE',
    admissionDiagnosis: 'Acute Gallstone Pancreatitis (Day 3 Resolution)',
    admissionDate: new Date(Date.now() - 144 * 60 * MINUTE_MS).toISOString(),
    attendingPhysician: 'Dr. Michael Sterling, MD',
    primaryNurse: 'Nurse Rachel Hayes, RN',
    codeStatus: 'FULL_CODE',
    allergies: [],
    isolationStatus: 'NONE',

    apsScore: 22,
    category: 'LOW',
    categoryRank: 5,
    trendDirection: 'RECOVERING',
    trendVelocityPointsPerHour: -4.2,

    whyNowSummary:
      'Steady recovery: Abdominal pain significantly improved. Serum lipase downtrending. Vitals are stable within normal limits (HR 78, RR 16, BP 122/76, SpO2 98%). No immediate intervention indicated.',

    topContributingReasons: [
      {
        id: 'CR-P004-1',
        category: 'PHYSIOLOGICAL_ABNORMALITY',
        severity: 'INFO',
        title: 'Physiological Parameters Normalized',
        explanation: 'All primary vitals within normal expected physiological envelopes.',
        contributionPercent: 100,
        evidence: {
          variable: 'Vitals Profile',
          currentValue: 'HR 78, RR 16, BP 122/76',
          baselineValue: 'Normal',
        },
        provenance: {
          sourceObservationIds: ['OBS-P004-ALL'],
          calculationRule: 'PhysiologicalAbnormalityComponent: score < 0.25 (minimal deviance)',
          rawScore: 0.15,
          normalizedWeight: 1.0,
        },
      },
    ],

    mews: {
      totalScore: 0,
      thresholdRisk: 'LOW',
      breakdown: [
        { parameter: 'Heart Rate', value: '78 bpm', points: 0, normalRange: '51 - 100 bpm' },
        { parameter: 'Respiratory Rate', value: '16 /min', points: 0, normalRange: '9 - 14 /min' },
        { parameter: 'Systolic BP', value: '122 mmHg', points: 0, normalRange: '101 - 199 mmHg' },
        { parameter: 'Temperature', value: '37.0 °C', points: 0, normalRange: '35.0 - 38.4 °C' },
        { parameter: 'AVPU / Mentation', value: 'Alert', points: 0, normalRange: 'Alert' },
      ],
    },

    vitals: {
      heartRate: 78,
      heartRateBaseline: 82,
      respiratoryRate: 16,
      respiratoryRateBaseline: 17,
      spo2: 98,
      spo2Baseline: 97,
      systolicBP: 122,
      systolicBPBaseline: 124,
      diastolicBP: 76,
      meanArterialPressure: 91,
      bodyTemperature: 37.0,
      shockIndex: 0.64,
      avpu: 'ALERT',
      oxygenDelivery: 'Room Air',
    },

    trajectory: [
      { timeOffsetMinutes: -60, timestampIso: new Date(Date.now() - 60 * MINUTE_MS).toISOString(), apsScore: 28, heartRate: 82, respiratoryRate: 17, spo2: 97, systolicBP: 124, diastolicBP: 78 },
      { timeOffsetMinutes: -30, timestampIso: new Date(Date.now() - 30 * MINUTE_MS).toISOString(), apsScore: 24, heartRate: 80, respiratoryRate: 16, spo2: 98, systolicBP: 122, diastolicBP: 76 },
      { timeOffsetMinutes: 0, timestampIso: NOW_ISO, apsScore: 22, heartRate: 78, respiratoryRate: 16, spo2: 98, systolicBP: 122, diastolicBP: 76 },
    ],

    signalQuality: {
      confidencePercent: 96,
      snrDb: 19.8,
      motionMagnitude: 0.02,
      motionDetected: false,
      illuminationLux: 370,
      opticalLineOfSight: true,
      cameraDeviceId: 'CAM-RPPG-404',
      lastFrameProcessedIso: NOW_ISO,
      privacyNotice: 'Zero video transmitted or stored.',
    },

    lastTrustedObservationIso: NOW_ISO,
    lastTrustedElapsedMinutes: 1,
    isStale: false,

    clinicalContext: {
      id: 'CTX-P004',
      patientId: 'P004',
      admissionReason: 'Acute Epigastric Pain, Lipase 1800 U/L',
      postOpDay: 0,
      comorbidities: ['Type 2 Diabetes', 'Hypertriglyceridemia'],
      codeStatus: 'FULL_CODE',
      oxygenDelivery: 'ROOM_AIR',
      isolationStatus: 'NONE',
      baselineMEWS: 1,
      updatedAt: Date.now() - 120 * MINUTE_MS,
    },

    labs: [
      {
        id: 'LAB-P004-LAC',
        patientId: 'P004',
        timestamp: Date.now() - 300 * MINUTE_MS,
        testCode: 'LACTATE',
        testName: 'Venous Lactate',
        value: 1.1,
        unit: 'MMOL_PER_L',
        referenceRange: { low: 0.5, high: 2.0 },
        isCritical: false,
        sourceLab: 'Central Lab',
      },
    ],

    recommendedVerifications: [
      {
        id: 'CHK-P004-1',
        text: 'Routine scheduled nurse round at next standard interval (12:00)',
        rationale: 'Stable trajectory across all monitoring domains',
        completed: true,
        completedAt: new Date(Date.now() - 40 * MINUTE_MS).toISOString(),
        completedBy: 'RN Rachel Hayes',
      },
    ],

    timeline: [
      {
        id: 'TL-P004-01',
        patientId: 'P004',
        timestamp: Date.now() - 60 * MINUTE_MS,
        eventType: 'VITAL_MEASUREMENT',
        title: 'Vitals Normalizing',
        description: 'Heart rate down to 78 bpm. Resting comfortably.',
        severity: 'INFO',
        source: 'OPTICAL_RPPG',
        isTrusted: true,
      },
    ],

    isAcknowledged: true,
  },

  // ==========================================================================
  // BED 401-A: Ananya Ramanathan (LOW - Post-Op Day 1 Cholecystectomy Stable)
  // ==========================================================================
  {
    patientId: 'P001',
    bedNumber: '401-A',
    roomNumber: '401',
    mrn: 'MRN-40101',
    name: 'Ananya Ramanathan',
    age: 42,
    gender: 'FEMALE',
    admissionDiagnosis: 'Post-Op Day 1: Laparoscopic Cholecystectomy',
    admissionDate: new Date(Date.now() - 180 * 60 * MINUTE_MS).toISOString(),
    attendingPhysician: 'Dr. Sarah Lin, MD',
    primaryNurse: 'Nurse Rachel Hayes, RN',
    codeStatus: 'FULL_CODE',
    allergies: ['Penicillin'],
    isolationStatus: 'NONE',

    apsScore: 14,
    category: 'LOW',
    categoryRank: 6,
    trendDirection: 'STEADY',
    trendVelocityPointsPerHour: 0.2,

    whyNowSummary:
      'Unremarkable post-operative course: Patient is resting comfortably in bed with stable vitals (HR 72, RR 15, BP 118/76, SpO2 98%). Clear surgical recovery trajectory. Low monitoring priority.',

    topContributingReasons: [
      {
        id: 'CR-P001-1',
        category: 'PHYSIOLOGICAL_ABNORMALITY',
        severity: 'INFO',
        title: 'Optimal Post-Op Recovery Profile',
        explanation: 'All vitals within optimal post-laparoscopic recovery bounds.',
        contributionPercent: 100,
        evidence: {
          variable: 'Vitals Profile',
          currentValue: 'HR 72, RR 15, BP 118/76',
          baselineValue: 'Normal',
        },
        provenance: {
          sourceObservationIds: ['OBS-P001-ALL'],
          calculationRule: 'PhysiologicalAbnormalityComponent: pristine baseline concordance',
          rawScore: 0.10,
          normalizedWeight: 1.0,
        },
      },
    ],

    mews: {
      totalScore: 0,
      thresholdRisk: 'LOW',
      breakdown: [
        { parameter: 'Heart Rate', value: '72 bpm', points: 0, normalRange: '51 - 100 bpm' },
        { parameter: 'Respiratory Rate', value: '15 /min', points: 0, normalRange: '9 - 14 /min' },
        { parameter: 'Systolic BP', value: '118 mmHg', points: 0, normalRange: '101 - 199 mmHg' },
        { parameter: 'Temperature', value: '36.8 °C', points: 0, normalRange: '35.0 - 38.4 °C' },
        { parameter: 'AVPU / Mentation', value: 'Alert', points: 0, normalRange: 'Alert' },
      ],
    },

    vitals: {
      heartRate: 72,
      heartRateBaseline: 72,
      respiratoryRate: 15,
      respiratoryRateBaseline: 15,
      spo2: 98,
      spo2Baseline: 98,
      systolicBP: 118,
      systolicBPBaseline: 118,
      diastolicBP: 76,
      meanArterialPressure: 90,
      bodyTemperature: 36.8,
      shockIndex: 0.61,
      avpu: 'ALERT',
      oxygenDelivery: 'Room Air',
    },

    trajectory: [
      { timeOffsetMinutes: -60, timestampIso: new Date(Date.now() - 60 * MINUTE_MS).toISOString(), apsScore: 14, heartRate: 72, respiratoryRate: 15, spo2: 98, systolicBP: 118, diastolicBP: 76 },
      { timeOffsetMinutes: -30, timestampIso: new Date(Date.now() - 30 * MINUTE_MS).toISOString(), apsScore: 14, heartRate: 72, respiratoryRate: 15, spo2: 98, systolicBP: 118, diastolicBP: 76 },
      { timeOffsetMinutes: 0, timestampIso: NOW_ISO, apsScore: 14, heartRate: 72, respiratoryRate: 15, spo2: 98, systolicBP: 118, diastolicBP: 76 },
    ],

    signalQuality: {
      confidencePercent: 98,
      snrDb: 21.2,
      motionMagnitude: 0.01,
      motionDetected: false,
      illuminationLux: 390,
      opticalLineOfSight: true,
      cameraDeviceId: 'CAM-RPPG-401',
      lastFrameProcessedIso: NOW_ISO,
      privacyNotice: 'Zero video transmitted or stored.',
    },

    lastTrustedObservationIso: NOW_ISO,
    lastTrustedElapsedMinutes: 1,
    isStale: false,

    clinicalContext: {
      id: 'CTX-P001',
      patientId: 'P001',
      admissionReason: 'Elective Laparoscopic Cholecystectomy',
      postOpDay: 1,
      comorbidities: ['Mild Asthma'],
      codeStatus: 'FULL_CODE',
      oxygenDelivery: 'ROOM_AIR',
      isolationStatus: 'NONE',
      baselineMEWS: 0,
      updatedAt: Date.now() - 180 * MINUTE_MS,
    },

    labs: [
      {
        id: 'LAB-P001-LAC',
        patientId: 'P001',
        timestamp: Date.now() - 360 * MINUTE_MS,
        testCode: 'LACTATE',
        testName: 'Venous Lactate',
        value: 1.1,
        unit: 'MMOL_PER_L',
        referenceRange: { low: 0.5, high: 2.0 },
        isCritical: false,
        sourceLab: 'Central Lab',
      },
    ],

    recommendedVerifications: [
      {
        id: 'CHK-P001-1',
        text: 'Routine vital sign checks per ward post-op protocol',
        rationale: 'Standard surgical post-op trajectory',
        completed: true,
        completedAt: new Date(Date.now() - 60 * MINUTE_MS).toISOString(),
        completedBy: 'RN Rachel Hayes',
      },
    ],

    timeline: [
      {
        id: 'TL-P001-01',
        patientId: 'P001',
        timestamp: Date.now() - 90 * MINUTE_MS,
        eventType: 'VITAL_MEASUREMENT',
        title: 'Post-Op Stable Telemetry',
        description: 'Vitals stable on room air.',
        severity: 'INFO',
        source: 'OPTICAL_RPPG',
        isTrusted: true,
      },
    ],

    isAcknowledged: true,
  },
];
