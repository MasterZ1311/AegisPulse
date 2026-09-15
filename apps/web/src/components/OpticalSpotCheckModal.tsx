import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Camera,
  CameraOff,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Activity,
  HeartPulse,
  Wind,
  Radio,
  SwitchCamera,
  Sliders,
  AlertOctagon,
  Eye,
  Info,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { WardPatientRadarState } from '../types/radar';

// Direct integration with the Face-First Sensing Subsystem
import {
  BrowserEdgeFaceDetector,
  FaceTracker,
  RoiManager,
  SensingStateMachine,
  SensingSessionManager,
  type SensingState,
  type FaceRoiRegions,
} from '@aegispulse/signal';
import { RppgPipeline, type RgbTimeSeries } from '@aegispulse/rppg';

interface OpticalSpotCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: WardPatientRadarState;
  onCommitVitals: (
    patientId: string,
    vitals: { heartRate: number; respiratoryRate?: number | null; confidence: number }
  ) => void;
}

export const OpticalSpotCheckModal: React.FC<OpticalSpotCheckModalProps> = ({
  isOpen,
  onClose,
  patient,
  onCommitVitals,
}) => {
  // Core Sensing State Machine
  const [sensingState, setSensingState] = useState<SensingState>('CAMERA_INITIALIZING');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [progressSeconds, setProgressSeconds] = useState<number>(0);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Live Validated Metrics (Strictly null when no face exists)
  const [liveHr, setLiveHr] = useState<number | null>(null);
  const [liveRr, setLiveRr] = useState<number | null>(null);
  const [sqiScore, setSqiScore] = useState<number>(0);
  const [snrDb, setSnrDb] = useState<number>(0);
  const [illuminationLux, setIlluminationLux] = useState<number>(0);
  const [faceCount, setFaceCount] = useState<number>(0);
  const [activeTrackingId, setActiveTrackingId] = useState<string>('NONE');
  const [faceStability, setFaceStability] = useState<number>(0);
  const [motionMagnitude, setMotionMagnitude] = useState<number>(0);

  // UX Toggles
  const [isDebugMode, setIsDebugMode] = useState<boolean>(false);
  const [isScienceExplained, setIsScienceExplained] = useState<boolean>(false);

  // Element & Pipeline Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const ppgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<any>(null);
  const wakeLockRef = useRef<any>(null);

  // Instantiate Subsystem Pipelines
  const faceDetectorRef = useRef<BrowserEdgeFaceDetector>(new BrowserEdgeFaceDetector());
  const faceTrackerRef = useRef<FaceTracker>(new FaceTracker({ faceLossTimeoutMs: 500 }));
  const roiManagerRef = useRef<RoiManager>(new RoiManager());
  const stateMachineRef = useRef<SensingStateMachine>(new SensingStateMachine('CAMERA_INITIALIZING'));
  const sessionManagerRef = useRef<SensingSessionManager>(new SensingSessionManager());
  const rppgPipelineRef = useRef<RppgPipeline>(new RppgPipeline({ fps: 30, windowDurationSeconds: 8.0 }));

  // Ring buffer of spatial RGB samples
  const temporalRgbBuffer = useRef<{
    timestampsMs: number[];
    r: number[];
    g: number[];
    b: number[];
  }>({ timestampsMs: [], r: [], g: [], b: [] });

  const ppgWaveformBuffer = useRef<number[]>(Array(120).fill(0));

  // Stop video stream and clear resources
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (wakeLockRef.current) {
      try {
        wakeLockRef.current.release();
      } catch {}
      wakeLockRef.current = null;
    }

    // Reset buffer & state
    temporalRgbBuffer.current = { timestampsMs: [], r: [], g: [], b: [] };
    roiManagerRef.current.invalidate();
    faceTrackerRef.current.reset();
    sessionManagerRef.current.abortSession('Spot-check stopped');
  }, []);

  // Screen Wake Lock API (keeps mobile screen awake during 15s check)
  const requestWakeLock = useCallback(async () => {
    if ('wakeLock' in navigator) {
      try {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      } catch {
        // Non-critical, ignore
      }
    }
  }, []);

  // Start Hardware Camera Stream
  const startCamera = useCallback(async (selectedFacingMode: 'user' | 'environment') => {
    stopStream();
    setErrorMessage('');
    setProgressSeconds(0);
    setIsCompleted(false);
    setLiveHr(null);
    setLiveRr(null);
    setSqiScore(0);
    setSensingState('CAMERA_INITIALIZING');

    // Initialize session bound to this patient
    sessionManagerRef.current.startSession({
      patientId: patient.patientId,
      bedId: `BED-${patient.bedNumber}`,
      deviceId: 'FRONT_WEBCAM_01',
    });

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access API is not supported in this browser environment.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: selectedFacingMode,
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      });

      streamRef.current = stream;

      // Handle unexpected hardware disconnect
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          stateMachineRef.current.forceState('CAMERA_DISCONNECTED', 'Hardware video track ended');
          setSensingState('CAMERA_DISCONNECTED');
          setErrorMessage('Camera was disconnected.');
        };
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      await requestWakeLock();
      stateMachineRef.current.forceState('SEARCHING_FOR_FACE', 'Camera stream active');
      setSensingState('SEARCHING_FOR_FACE');
    } catch (err: any) {
      console.warn('Camera stream error:', err);
      const isDenied = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError';
      const msg = isDenied
        ? 'Camera permission denied. Please allow camera access in your browser settings.'
        : err.name === 'NotFoundError'
        ? 'No hardware camera device found on this system.'
        : err.message || 'Unable to access camera hardware.';

      setErrorMessage(msg);
      stateMachineRef.current.forceState(
        isDenied ? 'CAMERA_PERMISSION_DENIED' : 'ERROR',
        msg
      );
      setSensingState(isDenied ? 'CAMERA_PERMISSION_DENIED' : 'ERROR');
    }
  }, [patient.patientId, patient.bedNumber, stopStream, requestWakeLock]);

  // Flip Camera handler (Mobile Front/Back switch)
  const handleFlipCamera = () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  // Modal Close
  const handleModalClose = () => {
    stopStream();
    onClose();
  };

  // Restart Spot-Check
  const handleRestart = () => {
    startCamera(facingMode);
  };

  // Commit Vitals to Bedside Record (STRICT: only genuine optical values, never fabricated)
  const handleCommit = () => {
    if (liveHr && liveHr > 0) {
      onCommitVitals(patient.patientId, {
        heartRate: liveHr,
        respiratoryRate: liveRr ?? null,
        confidence: sqiScore / 100,
      });
      sessionManagerRef.current.completeSession();
      handleModalClose();
    }
  };

  // 15-Second Spot-Check Timer Loop
  // STRICT INVARIANT: Only increments when valid signal is actively acquiring or valid!
  useEffect(() => {
    if (!isOpen || isCompleted) return;

    const interval = setInterval(() => {
      const currentState = stateMachineRef.current.getState();
      const isValidAcquisition =
        currentState === 'ACQUIRING_SIGNAL' || currentState === 'MEASUREMENT_VALID';

      if (isValidAcquisition) {
        setProgressSeconds((prev) => {
          const next = prev + 1;
          if (next >= 15) {
            setIsCompleted(true);
            clearInterval(interval);
            return 15;
          }
          return next;
        });
      }
    }, 1000);

    timerIntervalRef.current = interval;
    return () => clearInterval(interval);
  }, [isOpen, isCompleted]);

  // Main 30 FPS Frame Processing & Edge Computer-Vision Pipeline
  useEffect(() => {
    if (!isOpen) return;

    let frameCount = 0;

    const processingLoop = async () => {
      frameCount++;
      const now = Date.now();

      if (
        videoRef.current &&
        videoRef.current.readyState >= 2 &&
        streamRef.current
      ) {
        const video = videoRef.current;
        const vW = video.videoWidth || 640;
        const vH = video.videoHeight || 480;

        // 1. Detect faces in volatile RAM (Tier 1 Native / Tier 2 Edge Skin-Locus)
        const detectionResult = await faceDetectorRef.current.detectFaces(video, vW, vH);
        setIlluminationLux(detectionResult.illuminationLux);
        setFaceCount(detectionResult.totalFacesDetected);

        // 2. Track faces temporally (assign persistent tracking ID, compute motion & stability)
        const trackingResult = faceTrackerRef.current.update(
          detectionResult.faces,
          now
        );
        setMotionMagnitude(trackingResult.isMotionDetected ? 0.8 : 0.05);

        const primaryFace = trackingResult.primaryFace;
        if (primaryFace) {
          setActiveTrackingId(primaryFace.trackingId);
          setFaceStability(primaryFace.stability);
          // Lock face to patient measurement session
          sessionManagerRef.current.lockFace(primaryFace.trackingId);
        } else {
          setActiveTrackingId('NONE');
          setFaceStability(0);
        }

        // 3. Anatomical ROI Extraction (Forehead + Cheeks)
        let currentRois: FaceRoiRegions | null = null;
        if (primaryFace && detectionResult.status === 'ONE_VALID_FACE') {
          currentRois = roiManagerRef.current.computeRois(primaryFace, now);
        } else {
          roiManagerRef.current.invalidate();
        }

        // 4. Update Sensing State Machine
        const bufferSecs = temporalRgbBuffer.current.timestampsMs.length / 30;
        const nextState = stateMachineRef.current.stepFrame({
          isCameraActive: !!streamRef.current && streamRef.current.active,
          hasCameraPermission: sensingState !== 'CAMERA_PERMISSION_DENIED',
          faces: trackingResult.trackedFaces,
          primaryFace,
          isMotionDetected: trackingResult.isMotionDetected,
          rois: currentRois,
          illuminationLux: detectionResult.illuminationLux,
          bufferDurationSeconds: bufferSecs,
          snrDb,
          confidence: sqiScore / 100,
        });

        setSensingState(nextState);

        // 5. HARD INVARIANT: Zero Vitals when No Face or Multi-Face
        if (
          nextState === 'SEARCHING_FOR_FACE' ||
          nextState === 'FACE_LOST' ||
          nextState === 'MULTIPLE_FACES_DETECTED' ||
          nextState === 'CAMERA_DISCONNECTED' ||
          nextState === 'NO_CAMERA'
        ) {
          setLiveHr(null);
          setLiveRr(null);
          // Purge active buffer on face loss
          temporalRgbBuffer.current = { timestampsMs: [], r: [], g: [], b: [] };
        }

        // 6. Extract Spatial Mean RGB from Forehead ROI if Valid
        if (
          currentRois &&
          primaryFace &&
          (nextState === 'FACE_STABLE' ||
            nextState === 'ACQUIRING_SIGNAL' ||
            nextState === 'MEASUREMENT_VALID' ||
            nextState === 'LOW_SIGNAL_QUALITY')
        ) {
          // Downsample ROI to volatile offscreen canvas for skin chrominance extraction
          const offscreen = document.createElement('canvas');
          offscreen.width = 64;
          offscreen.height = 64;
          const oCtx = offscreen.getContext('2d', { willReadFrequently: true });
          if (oCtx) {
            const fh = currentRois.forehead;
            oCtx.drawImage(
              video,
              fh.x * vW,
              fh.y * vH,
              fh.width * vW,
              fh.height * vH,
              0,
              0,
              64,
              64
            );
            const imgData = oCtx.getImageData(0, 0, 64, 64);
            const d = imgData.data;
            let rS = 0, gS = 0, bS = 0;
            const pxCount = d.length / 4;
            for (let i = 0; i < d.length; i += 4) {
              rS += d[i];
              gS += d[i + 1];
              bS += d[i + 2];
            }
            const meanR = rS / pxCount;
            const meanG = gS / pxCount;
            const meanB = bS / pxCount;

            // Push to sliding temporal buffer (max 300 samples = 10s at 30 FPS)
            const buf = temporalRgbBuffer.current;
            buf.timestampsMs.push(now);
            buf.r.push(meanR);
            buf.g.push(meanG);
            buf.b.push(meanB);

            if (buf.timestampsMs.length > 300) {
              buf.timestampsMs.shift();
              buf.r.shift();
              buf.g.shift();
              buf.b.shift();
            }

            // Real-time pulse waveform curve (G - 0.5R - 0.5B chrominance)
            const pulseSample = meanG - 0.5 * meanR - 0.5 * meanB;
            ppgWaveformBuffer.current.push(pulseSample);
            if (ppgWaveformBuffer.current.length > 120) {
              ppgWaveformBuffer.current.shift();
            }

            // Clean volatile memory
            oCtx.clearRect(0, 0, 64, 64);
          }

          // 7. Run Real Mathematical POS rPPG Pipeline every 10 frames (~3 Hz)
          if (frameCount % 10 === 0 && temporalRgbBuffer.current.r.length >= 75) {
            const series: RgbTimeSeries = {
              fps: 30,
              timestampsMs: temporalRgbBuffer.current.timestampsMs,
              r: temporalRgbBuffer.current.r,
              g: temporalRgbBuffer.current.g,
              b: temporalRgbBuffer.current.b,
            };

            const measurement = rppgPipelineRef.current.processRgbSeries(
              series,
              'POS',
              trackingResult.isMotionDetected ? 0.7 : 0.05,
              Math.min(1.0, detectionResult.illuminationLux / 300)
            );

            setSnrDb(measurement.signalQuality.snrDb);
            setSqiScore(measurement.signalQuality.sqiScore);

            if (measurement.status === 'VALID' && measurement.confidence >= 0.60) {
              setLiveHr(Math.round(measurement.heartRate));
              if (measurement.respiratoryRate && measurement.respiratoryRate > 0) {
                setLiveRr(Math.round(measurement.respiratoryRate));
              } else {
                // Strictly DO NOT fabricate dummy value! Leave empty/null if unresolvable from spectrum
                setLiveRr(null);
              }
            } else if (measurement.status === 'UNUSABLE') {
              // Gated / unresolvable signal - suppress live vitals
              setLiveHr(null);
              setLiveRr(null);
            }
          }
        }

        // 8. Render Visual Feedback Overlays on Live Video
        if (overlayCanvasRef.current) {
          const canvas = overlayCanvasRef.current;
          if (canvas.width !== vW || canvas.height !== vH) {
            canvas.width = vW;
            canvas.height = vH;
          }
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, vW, vH);

            // Draw Face Reticles
            if (primaryFace && detectionResult.status === 'ONE_VALID_FACE') {
              const b = primaryFace.boundingBox;
              const bx = b.x * vW;
              const by = b.y * vH;
              const bw = b.width * vW;
              const bh = b.height * vH;

              // Face Boundary Box (Cyan / Emerald)
              ctx.strokeStyle = nextState === 'MEASUREMENT_VALID' ? '#10b981' : '#06b6d4';
              ctx.lineWidth = 2.5;
              ctx.strokeRect(bx, by, bw, bh);

              // Forehead ROI Box (Amber)
              if (currentRois) {
                const fh = currentRois.forehead;
                ctx.strokeStyle = '#f59e0b';
                ctx.lineWidth = 2;
                ctx.setLineDash([4, 3]);
                ctx.strokeRect(fh.x * vW, fh.y * vH, fh.width * vW, fh.height * vH);
                ctx.setLineDash([]);

                // Label
                ctx.fillStyle = '#f59e0b';
                ctx.font = 'bold 11px monospace';
                ctx.fillText('FOREHEAD rPPG ROI', fh.x * vW + 4, fh.y * vH - 5);
              }

              // Face ID Badge
              ctx.fillStyle = '#06b6d4';
              ctx.font = 'bold 12px monospace';
              ctx.fillText(
                `${primaryFace.trackingId} • ${(primaryFace.confidence * 100).toFixed(0)}% LOCK`,
                bx + 4,
                by + 16
              );
            } else if (detectionResult.status === 'MULTIPLE_FACES') {
              // Draw Red Boxes on all detected faces
              ctx.strokeStyle = '#ef4444';
              ctx.lineWidth = 3;
              for (const f of detectionResult.faces) {
                ctx.strokeRect(
                  f.boundingBox.x * vW,
                  f.boundingBox.y * vH,
                  f.boundingBox.width * vW,
                  f.boundingBox.height * vH
                );
              }
            } else {
              // Target reticle in center to guide user
              ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
              ctx.lineWidth = 2;
              ctx.setLineDash([6, 6]);
              const cx = vW / 2;
              const cy = vH / 2;
              ctx.beginPath();
              ctx.arc(cx, cy, 90, 0, Math.PI * 2);
              ctx.stroke();
              ctx.setLineDash([]);
            }
          }
        }

        // 9. Render Real-Time PPG Waveform
        if (ppgCanvasRef.current) {
          const pCanvas = ppgCanvasRef.current;
          const pCtx = pCanvas.getContext('2d');
          if (pCtx) {
            const w = pCanvas.width;
            const h = pCanvas.height;
            pCtx.clearRect(0, 0, w, h);

            pCtx.strokeStyle = '#334155';
            pCtx.lineWidth = 0.5;
            pCtx.beginPath();
            pCtx.moveTo(0, h / 2);
            pCtx.lineTo(w, h / 2);
            pCtx.stroke();

            const buf = ppgWaveformBuffer.current;
            pCtx.strokeStyle = '#06b6d4';
            pCtx.lineWidth = 2.0;
            pCtx.beginPath();

            const min = Math.min(...buf);
            const max = Math.max(...buf);
            const range = max - min || 1;

            for (let i = 0; i < buf.length; i++) {
              const x = (i / (buf.length - 1)) * w;
              const normY = (buf[i] - min) / range;
              const y = h - 6 - normY * (h - 12);
              if (i === 0) pCtx.moveTo(x, y);
              else pCtx.lineTo(x, y);
            }
            pCtx.stroke();
          }
        }
      }

      animFrameIdRef.current = requestAnimationFrame(processingLoop);
    };

    animFrameIdRef.current = requestAnimationFrame(processingLoop);
    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    };
  }, [isOpen, sensingState, snrDb, sqiScore]);

  // Auto-start camera when modal opens
  useEffect(() => {
    if (isOpen) {
      startCamera(facingMode);
    } else {
      stopStream();
    }
    return () => stopStream();
  }, [isOpen, startCamera, stopStream, facingMode]);

  // Guidance message helper
  const getGuidanceMessage = () => {
    switch (sensingState) {
      case 'SEARCHING_FOR_FACE':
        return { text: 'POSITION PATIENT FACE IN RETICLE', color: 'text-sky-400', icon: Eye };
      case 'FACE_LOST':
        return { text: 'FACE LOST — PLEASE FACE THE CAMERA', color: 'text-amber-400', icon: AlertTriangle };
      case 'MULTIPLE_FACES_DETECTED':
        return { text: 'MULTIPLE FACES — ENSURE ONLY PATIENT IS VISIBLE', color: 'text-rose-400', icon: AlertOctagon };
      case 'FACE_DETECTED_UNSTABLE':
        return { text: 'FACE DETECTED — HOLD STILL TO LOCK', color: 'text-sky-300', icon: Activity };
      case 'FACE_STABLE':
      case 'ACQUIRING_SIGNAL':
        return { text: 'LOCK ACQUIRED — BUFFERING SKIN PULSE', color: 'text-emerald-400', icon: Radio };
      case 'MEASUREMENT_VALID':
        return { text: 'TRUSTED OPTICAL PULSE LOCKED', color: 'text-emerald-400', icon: CheckCircle2 };
      case 'MOTION_CONTAMINATED':
        return { text: 'EXCESSIVE MOTION — PLEASE HOLD STILL', color: 'text-amber-400', icon: AlertTriangle };
      case 'INSUFFICIENT_LIGHT':
        return { text: 'LOW AMBIENT LIGHT — INCREASE ROOM LIGHTING', color: 'text-amber-400', icon: AlertTriangle };
      case 'CAMERA_PERMISSION_DENIED':
        return { text: 'CAMERA PERMISSION DENIED IN BROWSER', color: 'text-rose-400', icon: CameraOff };
      case 'CAMERA_DISCONNECTED':
        return { text: 'CAMERA DEVICE DISCONNECTED', color: 'text-rose-400', icon: CameraOff };
      default:
        return { text: 'INITIALIZING OPTICAL SENSING...', color: 'text-muted-foreground', icon: Camera };
    }
  };

  const guidance = getGuidanceMessage();
  const GuidanceIcon = guidance.icon;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleModalClose()}>
      <DialogContent onClose={handleModalClose} className="max-w-2xl p-5 font-sans">
        {/* HEADER */}
        <DialogHeader className="border-b border-border/40 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 text-primary">
                <Camera className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
                  15-Second Optical Spot-Check
                  <Badge variant="outline" className="font-mono text-[10px] text-primary border-primary/30">
                    Bed {patient.bedNumber}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Face-first optical rPPG with zero-tolerance no-face suppression.
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsDebugMode(!isDebugMode)}
                className={`h-7 px-2 text-xs font-mono gap-1 ${
                  isDebugMode ? 'text-amber-500 bg-amber-500/10' : 'text-muted-foreground'
                }`}
              >
                <Sliders className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Debug</span>
              </Button>

              <Badge variant="low" className="font-mono text-[10px] flex items-center gap-1 py-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                Zero Video Stored
              </Badge>
            </div>
          </div>
        </DialogHeader>

        {/* GUIDANCE ALERT BANNER */}
        <div className="pt-2 pb-1">
          <div className="px-3.5 py-2 rounded-xl flex items-center justify-between text-xs font-mono bg-muted/60 border border-border/50">
            <div className="flex items-center gap-2 font-bold tracking-wide">
              <GuidanceIcon className={`h-4 w-4 ${guidance.color} animate-pulse`} />
              <span className={guidance.color}>{guidance.text}</span>
            </div>
            <div className="text-[11px] text-muted-foreground hidden sm:block">
              State: <span className="font-bold text-foreground">{sensingState}</span>
            </div>
          </div>
        </div>

        {/* MAIN BODY */}
        <div className="space-y-4 py-1">
          {/* CAMERA FEED VIEWPORT WITH OVERLAYS */}
          <div className="relative w-full h-[270px] sm:h-[300px] rounded-xl border border-border/80 overflow-hidden flex items-center justify-center bg-black text-slate-100 shadow-inner">
            {/* Real Hardware Video Stream */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover mirror"
              style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
            />

            {/* Reticle / Face Tracking Canvas Overlay */}
            <canvas
              ref={overlayCanvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none mirror"
              style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
            />

            {/* FLIP CAMERA BUTTON (For Mobile Bedside Spot-Check) */}
            <div className="absolute top-3 right-3 z-10">
              <Button
                size="sm"
                variant="secondary"
                onClick={handleFlipCamera}
                className="h-8 w-8 p-0 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white backdrop-blur border border-white/10 shadow cursor-pointer"
                title="Switch between front and back camera"
              >
                <SwitchCamera className="h-4 w-4" />
              </Button>
            </div>

            {/* DEBUG OVERLAY PANEL */}
            {isDebugMode && (
              <div className="absolute bottom-2 left-2 z-10 bg-slate-950/85 backdrop-blur border border-slate-800 p-2.5 rounded-lg text-[10px] font-mono text-slate-300 space-y-1 max-w-[240px]">
                <div className="font-bold text-amber-400 border-b border-slate-800 pb-0.5">
                  CV / rPPG DIAGNOSTICS
                </div>
                <div className="flex justify-between">
                  <span>Track ID:</span> <span className="text-sky-400">{activeTrackingId}</span>
                </div>
                <div className="flex justify-between">
                  <span>Stability:</span> <span>{(faceStability * 100).toFixed(0)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Faces Seen:</span> <span>{faceCount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Illumination:</span> <span>{illuminationLux} Lux</span>
                </div>
                <div className="flex justify-between">
                  <span>SNR:</span> <span>{snrDb.toFixed(1)} dB</span>
                </div>
                <div className="flex justify-between">
                  <span>Motion:</span> <span>{(motionMagnitude * 100).toFixed(0)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Buffer:</span>{' '}
                  <span>{(temporalRgbBuffer.current.timestampsMs.length / 30).toFixed(1)}s</span>
                </div>
              </div>
            )}

            {/* ERROR STATE SCREEN */}
            {(sensingState === 'CAMERA_PERMISSION_DENIED' || sensingState === 'ERROR' || errorMessage) && (
              <div className="absolute inset-0 bg-slate-950/90 backdrop-blur flex flex-col items-center justify-center p-6 text-center">
                <CameraOff className="h-10 w-10 text-rose-500 mb-3 animate-pulse" />
                <p className="text-sm font-bold text-rose-400 max-w-md">{errorMessage || 'Camera access unavailable'}</p>
                <p className="text-xs text-muted-foreground mt-2 max-w-sm">
                  Please enable camera permissions in your browser URL bar or connect a supported USB camera.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRestart}
                  className="mt-4 gap-2 font-mono text-xs cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Retry Connection
                </Button>
              </div>
            )}
          </div>

          {/* LIVE EXTRACTED VITALS & PROGRESS STRIP */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* HEART RATE */}
            <div className="p-3 rounded-xl border border-border/60 bg-muted/40 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
                  <HeartPulse className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                  <span>Optical HR</span>
                </div>
                <div className="text-2xl font-black font-mono text-rose-700 dark:text-rose-300 mt-1">
                  {liveHr !== null ? `${liveHr} BPM` : '--'}
                </div>
                <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                  {liveHr !== null ? 'Valid optical pulse' : 'Requires locked face'}
                </div>
              </div>
              <Badge variant={liveHr !== null ? 'default' : 'outline'} className="text-[10px] font-mono">
                {liveHr !== null ? 'LIVE' : 'SUPPRESSED'}
              </Badge>
            </div>

            {/* RESPIRATORY RATE */}
            <div className="p-3 rounded-xl border border-border/60 bg-muted/40 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
                  <Wind className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Respiratory Rate</span>
                </div>
                <div className="text-2xl font-black font-mono text-emerald-800 dark:text-emerald-300 mt-1">
                  {liveRr !== null ? `${liveRr} /min` : '--'}
                </div>
                <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                  {liveRr !== null ? 'rPPG baseline wander' : 'Requires steady 6s signal'}
                </div>
              </div>
              <Badge variant={liveRr !== null ? 'default' : 'outline'} className="text-[10px] font-mono">
                {liveRr !== null ? 'MEASURED' : 'EMPTY'}
              </Badge>
            </div>

            {/* SIGNAL QUALITY (SQI) & PROGRESS */}
            <div className="p-3 rounded-xl border border-border/60 bg-muted/40 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Radio className="h-3.5 w-3.5 text-primary" />
                  Spot Progress
                </span>
                <span className="font-bold text-foreground">{progressSeconds}s / 15s</span>
              </div>

              {/* Countdown Progress Bar */}
              <div className="w-full bg-muted h-2 rounded-full overflow-hidden my-2">
                <div
                  className="bg-primary h-full transition-all duration-300"
                  style={{ width: `${(progressSeconds / 15) * 100}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                <span>SQI: {sqiScore}%</span>
                <span>Lux: {illuminationLux}</span>
              </div>
            </div>
          </div>

          {/* REAL-TIME PPG PULSE WAVEFORM CANVAS */}
          <div className="p-2.5 rounded-xl border border-border/60 bg-black flex flex-col justify-center shadow-inner">
            <div className="flex items-center justify-between px-2 pb-1 text-[10px] font-mono text-slate-400">
              <span className="flex items-center gap-1 text-primary">
                <Activity className="h-3 w-3" />
                POS Pulse Chrominance Waveform (Ephemeral Volatile Buffer)
              </span>
              <span>30 Hz Sampling</span>
            </div>
            <canvas ref={ppgCanvasRef} width={580} height={40} className="w-full h-10 rounded" />
          </div>

          {/* SCIENCE EXPLANATION ACCORDION */}
          <div className="border border-border/40 rounded-xl p-3 bg-muted/20">
            <button
              onClick={() => setIsScienceExplained(!isScienceExplained)}
              className="w-full flex items-center justify-between text-xs font-mono font-bold text-foreground cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                How contactless rPPG calculation works (Investigational)
              </span>
              <span className="text-[10px] text-muted-foreground">
                {isScienceExplained ? 'Collapse' : 'Explain'}
              </span>
            </button>

            {isScienceExplained && (
              <div className="mt-2.5 pt-2.5 border-t border-border/40 text-xs text-muted-foreground space-y-2">
                <p>
                  <strong>1. Face Lock & Forehead ROI:</strong> The camera detects facial skin locus in volatile RAM, extracts the forehead quadrant (highest capillary perfusion), and masks out ocular and hair regions.
                </p>
                <p>
                  <strong>2. Plane-Orthogonal-to-Skin (POS) rPPG:</strong> Capillary blood volume surges subtly dim reflected green light during systole. POS projects normalized RGB signals onto skin-orthogonal chrominance axes, cancelling illumination noise.
                </p>
                <p>
                  <strong>3. Gating & Genuineness:</strong> If the patient turns away, moves excessively, or if a second person enters the frame, the state machine halts and purges the buffer. No vital signs are ever fabricated.
                </p>
                <p className="text-[10px] italic text-muted-foreground/80">
                  Disclaimer: Optical rPPG is an investigational contactless sensing modality for clinical radar prioritization, not a substitute for diagnostic contact oximetry.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* FOOTER ACTIONS */}
        <div className="border-t border-border/40 pt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleRestart}
              className="font-mono text-xs gap-1.5 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Spot-Check
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleModalClose}
              className="font-mono text-xs cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="default"
              disabled={!isCompleted || liveHr === null}
              onClick={handleCommit}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold font-mono text-xs gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              {isCompleted && liveHr !== null
                ? `Commit Verified Vitals (${liveHr} BPM${liveRr ? `, ${liveRr} /min` : ''})`
                : isCompleted && liveHr === null
                ? 'No Signal Locked - Retry'
                : `Measuring (${progressSeconds}/15s)...`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
