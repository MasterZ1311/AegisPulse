# AegisPulse: Mobile Deployment Architecture & Protocol

**Document Status:** AUTHORITATIVE MOBILE DEPLOYMENT SPECIFICATION  
**Governing Standard:** `docs/SOURCE_OF_TRUTH.md`  
**Target Devices:** Android Chrome (v115+), iOS Safari (iOS 16+)

---

## 1. Executive Summary

AegisPulse enables bedside contactless physiological spot-checks directly on mobile phones carried by ward nurses. Modern smartphones provide high-grade front-facing cameras with native 30 FPS capability, enabling 15-second heart rate and respiratory rate estimations via skin chrominance (POS rPPG) without requiring specialized hardware carts.

This document details the three supported deployment topologies, camera permission behavior, HTTPS/TLS requirements, and operator workflows.

---

## 2. Supported Mobile Deployment Topologies

```
┌────────────────────────────────────────────────────────────────────────┐
│                   DEPLOYMENT OPTION COMPARISON                         │
├──────────────┬────────────────────────┬────────────────────────────────┤
│ Mode         │ Network Architecture   │ Clinical Use Case              │
├──────────────┼────────────────────────┼────────────────────────────────┤
│ OPTION A     │ Cloud/Edge HTTPS       │ Multi-ward hospital network,   │
│ (Production) │ Host (TLS 1.3)         │ remote tele-triage, WAN access │
├──────────────┼────────────────────────┼────────────────────────────────┤
│ OPTION B     │ Local Ward Machine     │ Isolated ward intranet, zero   │
│ (Intranet)   │ over Secure Ward WiFi  │ cloud exposure, edge-only      │
├──────────────┼────────────────────────┼────────────────────────────────┤
│ OPTION C     │ Progressive Web App    │ Bedside spot-checks with       │
│ (PWA/Sync)   │ with Offline Sync Queue│ intermittent WiFi connectivity │
└──────────────┴────────────────────────┴────────────────────────────────┘
```

### Option A: Cloud/Edge HTTPS Deployment (Production Standard)
- **Architecture**: Mobile phone navigates to an HTTPS domain (e.g. `https://aegispulse.hospital.internal`).
- **Network Requirements**: Secure hospital WiFi (WPA3-Enterprise) or dedicated clinical cellular APN.
- **Camera Security**: Modern mobile browsers (iOS Safari and Android Chrome) **require a secure HTTPS context** (`window.isSecureContext === true`) to expose `navigator.mediaDevices.getUserMedia`. Insecure HTTP will silently disable the camera API.
- **TLS Configuration**: Minimum TLS 1.2, recommended TLS 1.3 with forward secrecy.

### Option B: Local Ward Machine over Secure Ward Intranet
- **Architecture**: Ward workstation runs the AegisPulse edge server (`http://192.168.1.100:3000`).
- **HTTPS Handling on Intranet**:
  - Because mobile browsers enforce HTTPS for camera access on private IPs, ward servers must either:
    1. Bind a trusted internal CA certificate (`https://ward-a.internal:3000`).
    2. Or use `chrome://flags/#unsafely-treat-insecure-origin-as-secure` on Android test devices during pilot trials.
- **QR Code Fast Pairing**: The nurse clicks "Mobile Bedside QR" on the ward workstation screen, scans the QR code with their phone, and the mobile browser immediately launches the spot-check for that specific patient.

### Option C: PWA with Offline Sync Queue
- **Architecture**: AegisPulse is installable as a Home Screen PWA.
- **Offline Invariant**: If ward WiFi drops during a spot-check, the contactless rPPG calculation continues entirely in local mobile RAM. Once completed, the observation is committed to the local IndexedDB UUID-idempotent sync queue (`offline-sync-queue.ts`) and automatically flushed to the server when network connectivity resumes.

---

## 3. Browser Permissions & Hardware Handling

### 3.1 Android (Chrome)
1. **Permission Prompt**: On first launch, Android prompts: *"Allow AegisPulse to use your camera?"*
2. **Camera Selection**: Default is `facingMode: 'user'` (front camera). Nurses can click the camera flip button in the modal header to switch to the back camera (`environment`) if measuring a supine patient.
3. **Screen Sleep Prevention**: AegisPulse requests `navigator.wakeLock.request('screen')` while the spot-check modal is active, preventing the phone screen from dimming during the 15-second acquisition.

### 3.2 iOS (Safari)
1. **Permission Prompt**: Safari prompts on each new session or site visit: *"aegispulse.local would like to use your camera."*
2. **Audio Track Policy**: AegisPulse explicitly sets `audio: false` in `getUserMedia`. iOS Safari displays a microphone indicator if audio is requested; omitting audio preserves nurse and patient acoustic privacy.
3. **Tab Suspension**: If the nurse switches apps or receives an incoming call, iOS Safari suspends the video track (`track.onended` or visibility change). AegisPulse immediately catches this event, purges the temporal buffer, and transitions to `CAMERA_DISCONNECTED` without generating false vitals.

---

## 4. Mobile Troubleshooting & FAQ

| Symptom | Probable Cause | Corrective Action |
|---------|----------------|-------------------|
| "Camera access unavailable" | Accessed via insecure HTTP on mobile | Ensure URL begins with `https://` or `localhost` |
| "Camera permission denied" | User tapped "Block" on prompt | Tap the lock icon in the browser URL bar and change Camera to "Allow" |
| "Illumination < 35 Lux" | Dark patient room | Turn on bedside reading lamp; rPPG requires visible ambient light |
| "Multiple faces detected" | Nurse or family member in frame | Reposition phone so only the patient's face is visible in the reticle |
| "Excessive motion" | Nurse or patient hand tremor | Rest phone on a stable surface or bedside tray |
