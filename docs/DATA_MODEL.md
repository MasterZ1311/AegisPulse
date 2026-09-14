# AegisPulse: Domain Data Model & Entity Specification

**Document Status:** AUTHORITATIVE DATA MODEL SPECIFICATION  
**Governing Standard:** `docs/SOURCE_OF_TRUTH.md`  
**Package Reference:** [`@aegispulse/types`](file:///e:/My%20Development/AegisPulse/packages/types)

---

## 1. Entity Relationship Topology

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    AEGISPULSE DOMAIN ENTITIES                                    │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                  │
│   ┌──────────────┐ 1      * ┌──────────────┐ 1      1 ┌──────────────┐                           │
│   │     Ward     │─────────│     Bed      │─────────│   Patient    │                           │
│   └──────────────┘          └──────────────┘          └──────┬───────┘                           │
│                                                              │ 1                                 │
│         ┌──────────────────┬─────────────────┬───────────────┴─────────────────┐                 │
│         │ *                │ *               │ *                               │ *               │
│         ▼                  ▼                 ▼                                 ▼                 │
│  ┌──────────────┐   ┌──────────────┐  ┌──────────────┐                  ┌──────────────┐         │
│  │ Observation  │   │  LabResult   │  │  Attention-  │                  │   Clinical-  │         │
│  │ (Vitals/SQI) │   │ (Lactate...) │  │   Priority   │                  │    Action    │         │
│  └──────┬───────┘   └──────────────┘  └──────┬───────┘                  └──────────────┘         │
│         │ 1                                  │ 1                                                 │
│         │ *                                  │ *                                                 │
│         ▼                                    ▼                                                   │
│  ┌──────────────┐                     ┌──────────────┐                                           │
│  │VitalMeasure- │                     │   Attention- │                                           │
│  │     ment     │                     │    Reason    │                                           │
│  └──────────────┘                     └──────────────┘                                           │
│                                                                                                  │
│   ══════════════════════ CROSS-CUTTING CHRONOLOGY & COMPLIANCE ══════════════════════            │
│   ┌────────────────────────────────────────┐   ┌────────────────────────────────────────┐        │
│   │             TimelineEvent              │   │               AuditEvent               │        │
│   │ (Unified chronological log per patient)│   │ (Immutable security & governance trail)│        │
│   └────────────────────────────────────────┘   └────────────────────────────────────────┘        │
│                                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Domain Entities & Schemas

### 2.1 Ward (`packages/types/src/schemas/ward.ts`)

Represents an inpatient hospital department.

- `id: string` (Primary Key, e.g. `"ward-gen-01"`)
- `name: string` (e.g. `"Medical-Surgical Ward 4B"`)
- `unitCode: string` (e.g. `"MS-4B"`)
- `hospitalName: string`
- `capacity: number` (Total bed count, e.g. `40`)
- `activePatientsCount: number`
- `createdAt: number` (Epoch milliseconds)

### 2.2 Bed (`packages/types/src/schemas/ward.ts`)

A physical monitoring location in a ward.

- `id: string` (Primary Key, e.g. `"bed-403"`)
- `wardId: string` (Foreign Key $\to$ `Ward.id`)
- `bedNumber: string` (e.g. `"403"`)
- `currentPatientId?: string` (Nullable Foreign Key $\to$ `Patient.id`)
- `isOccupied: boolean`
- `sensorDeviceId?: string` (ID of bedside tablet or mounted unit)

### 2.3 Patient (`packages/types/src/schemas/ward.ts`)

Master patient demographic and admission record.

- `id: string` (Primary Key, e.g. `"patient-103"`)
- `mrn: string` (Medical Record Number, encrypted/pseudonymized)
- `name: string` (e.g. `"Eleanor Vance"`)
- `age: number` ($\ge 18$)
- `gender: 'M' | 'F' | 'Other'`
- `admissionTimestamp: number`
- `admissionReason: string`
- `baselineMEWS: number` (Pre-admission or baseline score, typically $0\text{--}1$)

### 2.4 ClinicalContext (`packages/types/src/schemas/clinical.ts`)

Acuity envelope and medical comorbidities.

- `id: string`
- `patientId: string` (Foreign Key $\to$ `Patient.id`)
- `comorbidities: string[]` (e.g. `["Hypertension", "Type 2 Diabetes"]`)
- `codeStatus: 'FULL_CODE' | 'DNR' | 'DNI' | 'COMFORT_CARE'`
- `oxygenDelivery: 'ROOM_AIR' | 'NASAL_CANNULA' | 'SIMPLE_MASK' | ...`
- `isolationStatus: 'NONE' | 'CONTACT' | 'DROPLET' | 'AIRBORNE'`

### 2.5 Observation (`packages/types/src/schemas/events.ts`)

A point-in-time bedside physiological evaluation.

- `id: string` (Primary Key)
- `patientId: string` (Foreign Key $\to$ `Patient.id`)
- `timestamp: number` (Epoch milliseconds; enforced $\le \text{now} + 5\text{ mins}$)
- `source: 'OPTICAL_RPPG' | 'CLINICIAN_MANUAL_ENTRY' | 'WEARABLE_SENSOR' | 'SIMULATED_DATASET'`
- `confidence: number` ($0.0\text{ to }1.0$)
- `qualityState: 'EXCELLENT' | 'GOOD' | 'DEGRADED' | 'POOR' | 'UNUSABLE'`
- `heartRate?: number` ($20\text{--}300\text{ BPM}$)
- `respiratoryRate?: number` ($4\text{--}80\text{ breaths/min}$)
- `systolicBP?: number` ($30\text{--}300\text{ mmHg}$)
- `diastolicBP?: number` ($20\text{--}200\text{ mmHg}$)
- `temperature?: number` ($25.0\text{--}45.0^\circ\text{C}$)
- `spo2?: number` ($50\text{--}100\%$)
- `avpu?: 'A' | 'V' | 'P' | 'U'`
- `shockIndex?: number` ($\text{HR}/\text{SBP}$)
- `provenance: ProvenanceEnvelope` (Device model, algorithm ID, operator notes)

### 2.6 SignalQuality (`packages/types/src/schemas/vitals.ts`)

Real-time reliability metrics for optical or hardware sensors.

- `id: string`
- `timestamp: number`
- `snrDb: number` (Signal-to-noise ratio in decibels)
- `motionArtifactIndex: number` ($0.0\text{ to }1.0$)
- `illuminanceLux?: number` (Ambient lighting estimate)
- `faceTrackingConfidence?: number`

### 2.7 LaboratoryResult (`packages/types/src/schemas/clinical.ts`)

Quantitative biochemical stress markers.

- `id: string`
- `patientId: string` (Foreign Key $\to$ `Patient.id`)
- `timestamp: number`
- `testCode: 'LACTATE' | 'WBC' | 'CREATININE' | 'PLATELETS' | 'CRP' | ...`
- `testName: string`
- `value: number` (Physiologically bounded by `LAB_LIMITS`)
- `unit: 'MMOL_PER_L' | 'X10_9_PER_L' | 'MG_PER_DL' | ...`
- `isCritical: boolean`
- `sourceLab: string`

### 2.8 AttentionPriority (`packages/types/src/schemas/clinical.ts`)

The master calculated output of AegisPulse.

- `id: string`
- `patientId: string` (Foreign Key $\to$ `Patient.id`)
- `bedNumber: string`
- `apsScore: number` ($0\text{--}100$)
- `wardRank: number` ($\ge 1$)
- `category: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL_REVIEW'`
- `velocityScore: number` ($0\text{--}100$)
- `decayScore: number` ($0\text{--}100$)
- `mewsComponent: number` ($0\text{--}100$)
- `biomarkerComponent: number` ($0\text{--}100$)
- `informationAgeMinutes: number`
- `signalConfidence: number` ($0\text{--}100$)
- `recommendedAction: string`
- `calculatedAt: number`
- `reasons: AttentionReason[]`

### 2.9 AttentionReason (`packages/types/src/schemas/clinical.ts`)

Individual auditable driver behind an APS calculation.

- `code: AttentionReasonCode` (e.g. `"HEART_RATE_VELOCITY_HIGH"`, `"SHOCK_INDEX_ELEVATED"`)
- `description: string`
- `contributionWeight: number` ($0.0\text{ to }1.0$)
- `triggerValue: number`
- `thresholdValue: number`
- `unit: string`
- `urgency: AttentionPriorityCategory`

### 2.10 ClinicalAction (`packages/types/src/schemas/clinical.ts`)

Prescribed bedside clinical workflow item.

- `id: string`
- `patientId: string`
- `bedId: string`
- `actionType: 'BEDSIDE_CHECK' | 'MEASURE_VITALS' | 'NOTIFY_PHYSICIAN' | 'DRAW_LABS' | ...`
- `title: string`
- `rationale: string`
- `status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'DISMISSED'`
- `urgency: AttentionPriorityCategory`
- `recommendedAt: number`
- `targetCompletionTimestamp: number`
- `completedAt?: number`
- `completedByUserId?: string`
- `outcomeNotes?: string`

### 2.11 TimelineEvent (`packages/types/src/schemas/timeline.ts`)

Unified chronological event stream combining vitals, labs, scores, and actions.

### 2.12 AuditEvent (`packages/types/src/schemas/events.ts`)

Immutable compliance log recording user actions, priority changes, acknowledgements, and cryptographic evidence hashes.
