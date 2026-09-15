# AegisPulse: Camera Operations & Hardware Lifecycle Guide

**Document Status:** OPERATIONAL CAMERA SPECIFICATION  
**Governing Standard:** `docs/SOURCE_OF_TRUTH.md`  
**Core Invariant:** Clean teardown — no orphaned camera tracks, no persistent hardware locking.

---

## 1. Hardware Lifecycle State Flow

```
[IDLE / MODAL CLOSED]
         │
         │ Nurse clicks "Launch 15s Optical Spot-Check"
         ▼
[REQUESTING PERMISSION] ──(User Denies)──> [CAMERA_PERMISSION_DENIED]
         │                                       │
         │ (User Allows)                         ▼
         ▼                                [Actionable Help UI]
[STREAM INITIALIZING]
         │ (Configures 640x480 @ 30 FPS, FacingMode: user/environment)
         ▼
[ACTIVE STREAMING] ◄─────────────────────────┐
         │                                   │
         ├── User flips camera ──────────────┤
         ├── Tab hidden / App switch ──> [STREAM PAUSED]
         ├── Hardware unplugged ───────> [CAMERA_DISCONNECTED]
         │
         │ Spot-Check Finishes OR Nurse clicks "Cancel" / Closes Modal
         ▼
[TEARDOWN & RESOURCE CLEANUP]
         ├── track.stop() on all MediaStreamTracks
         ├── videoElement.srcObject = null
         ├── cancelAnimationFrame()
         ├── clearInterval()
         └── wakeLock.release()
```

---

## 2. Error Handling & Recovery Matrix

| Fault Condition | Browser Event / Error | AegisPulse Recovery Behavior | UI Instruction |
|-----------------|----------------------|------------------------------|----------------|
| **Permission Denied** | `NotAllowedError` or `PermissionDeniedError` | Transitions state machine to `CAMERA_PERMISSION_DENIED`. Does not retry in a loop. | "Camera permission was denied. Please allow camera permissions in your browser URL bar." |
| **No Camera Device** | `NotFoundError` | Transitions to `ERROR`. Stops pollers. | "No hardware camera device found. Please connect a USB webcam or use mobile access." |
| **Device Busy** | `NotReadableError` (Camera locked by Zoom/Teams) | Catches exception, releases pending stream, provides retry button. | "Camera is currently locked by another application. Please close other video apps and retry." |
| **Mid-Stream Disconnect** | `track.onended` event | Triggers `CAMERA_DISCONNECTED`. Purges active temporal signal buffer immediately. | "Camera was unplugged or disconnected. Reconnect device to resume spot-check." |
| **Tab Suspension / Minimization** | `visibilitychange` event | Pauses spot-check countdown timer and clears volatile canvas. Prevents runaway background calculations. | Resumes automatically when tab returns to foreground. |
| **Low Ambient Light** | Extracted frame lux $< 35\text{ Lux}$ | Transitions to `INSUFFICIENT_LIGHT`. Withholds vital calculation. | "Low ambient lighting detected. Please turn on room or reading light." |
| **Excessive Motion** | Centroid velocity $> 0.06$ | Transitions to `MOTION_CONTAMINATED`. Pauses timer. | "Excessive motion. Please hold still during acquisition." |

---

## 3. Camera Track Disposal Protocol

Leaving video streams active after a modal closes drains battery, heats mobile devices, and creates patient privacy anxiety (camera indicator light remains green).

AegisPulse implements the **Strict Disposal Protocol**:
```typescript
const stopStream = () => {
  if (streamRef.current) {
    streamRef.current.getTracks().forEach((track) => {
      track.stop(); // Releases hardware lock
    });
    streamRef.current = null;
  }
  if (videoRef.current) {
    videoRef.current.srcObject = null;
  }
  if (animFrameIdRef.current) {
    cancelAnimationFrame(animFrameIdRef.current);
    animFrameIdRef.current = null;
  }
};
```
This cleanup function is guaranteed to execute:
1. When the nurse clicks "Cancel" or "Commit".
2. When the user clicks outside the modal or presses Escape.
3. When the React component unmounts (`useEffect` cleanup return).
4. Before switching between front and back cameras.
