# AegisPulse: Privacy Architecture & Data Governance

**Document Status:** AUTHORITATIVE PRIVACY SPECIFICATION  
**Governing Standard:** `docs/SOURCE_OF_TRUTH.md`  
**Regulatory Framework:** India Digital Personal Data Protection (DPDP) Act 2023, HIPAA Privacy Rule (45 CFR Part 164)

---

## 1. The Cardinal Privacy Law

> [!CAUTION]
> **RAW VIDEO MUST NOT BE STORED OR TRANSMITTED**  
> Under no circumstances shall an uncompressed video frame, compressed video stream, photographic still, or facial image capture be written to non-volatile storage (`localStorage`, `IndexedDB`, filesystem) or transmitted over any network connection (HTTP, WebSocket, WebRTC, MQTT).

---

## 2. Ephemeral Frame Lifecycle in Volatile RAM

AegisPulse enforces a zero-disk-storage lifecycle for all optical sensor data:

```
[1. OPTICAL ACQUISITION]
  navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, frameRate: 30 } })
         │
         │ Frame captured into volatile browser GPU/RAM
         ▼
[2. FOREHEAD REGION CROPPING]
  Off-screen HTML5 Canvas (30% W × 18% H of upper facial bounding box)
         │
         │ Spatial averaging: Sum(pixels) / N_pixels
         ▼
[3. CHROMINANCE EXTRACTION]
  Instantaneous mean color triplet extracted: [R_mean, G_mean, B_mean]
         │
         │ IMMEDIATE FRAME DESTRUCTION:
         │ Canvas buffer overwritten with next frame within 33.3 milliseconds.
         ▼
[4. TELEMETRY-ONLY EGRESS]
  Numerical payload constructed:
  {
    "timestamp": 1726300000,
    "heartRate": 76,
    "signalQuality": 0.88,
    "source": "OPTICAL_RPPG"
  }
         │
         │ Transmitted over TLS 1.3 to local hospital server.
         │ ZERO visual data leaves the browser memory enclave.
```

---

## 3. Data Flow & Network Minimization

AegisPulse practices aggressive **data minimization**:

1. **No Facial Geometries or Embeddings**: The optical pipeline computes mean color intensity across superficial skin. It never computes facial recognition landmarks, 3D facial meshes, or biometric identity embeddings.
2. **Telemetry-Only Wire Protocol**: Only low-frequency numerical vital measurements (1 Hz or 15-second spot checks), clinical scores, and timestamped action events traverse the hospital network.
3. **Local Edge Processing**: The entire optical rPPG pipeline executes client-side inside the browser or edge runtime. No cloud API receives video.

---

## 4. Patient Identity & Pseudonymization

- **Ward Display**: Beds are displayed by bed number (e.g. `Bed 403`) and clinical initials/name for immediate nurse identification during rounds.
- **Backend Logging**: All application logging and internal event pipelines use pseudonymous internal UUIDs (`patient_id: "p-403-uuid"`). Real names are never printed to plain-text server log streams.
- **Audit Trails**: Access to patient clinical records and priority scores is recorded in the immutable audit ledger with the authenticated user ID and timestamp.

---

## 5. Retention Policies

| Data Category                    | Volatile Storage (RAM)         | Persistent Storage (Disk)  | Retention Horizon                         |
| :------------------------------- | :----------------------------- | :------------------------- | :---------------------------------------- |
| **Raw Video Frames**             | $< 33\text{ ms}$ (Overwritten) | **NEVER STORED**           | $0\text{ seconds}$                        |
| **Forehead Pixel Arrays**        | $< 33\text{ ms}$ (Overwritten) | **NEVER STORED**           | $0\text{ seconds}$                        |
| **Numerical Vitals Time-Series** | Active session memory          | SQLite Database (WAL mode) | Configurable by hospital (e.g. 7–30 days) |
| **Clinical Actions & SBAR**      | Active session memory          | SQLite Database            | Permanent audit trail during admission    |
| **Audit Event Ledger**           | Active session memory          | SQLite Database            | Retained per hospital compliance mandate  |

---

## 6. Privacy Invariant Enforcement (Implemented vs. Planned)

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                               PRIVACY CAPABILITY STATUS                                          │
├──────────────────────────────────────┬───────────────────────────────────────────────────────────┤
│ CURRENTLY IMPLEMENTED                │ • Volatile RAM frame lifecycle (zero video on disk)       │
│                                      │ • Strict Zod rejection of video/image payload keys        │
│                                      │ • Red team automated test verifying video exclusion      │
│                                      │ • One-click software camera disconnect toggle             │
│                                      │ • Telemetry-only WebSocket / SSE data streams             │
│                                      │ • Pseudonymized log sanitization                          │
├──────────────────────────────────────┼───────────────────────────────────────────────────────────┤
│ PLANNED / FUTURE ENHANCEMENTS        │ • Hardware physical shutter switch integration            │
│                                      │ • End-to-end encrypted ward synchronization               │
│                                      │ • Patient privacy consent portal with electronic signature│
│                                      │ • Automated DB retention scrubber for discharged patients │
└──────────────────────────────────────┴───────────────────────────────────────────────────────────┘
```
