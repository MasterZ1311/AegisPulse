import React, { useEffect, useRef, useState, useCallback } from 'react';
import { RPPGEngine } from '../lib/rppgEngine';
import type { SimulationMode, TriageLevel } from '../lib/types';
import { Camera, Sparkles, Activity, AlertTriangle, ShieldCheck } from 'lucide-react';

interface WebcamBiometricScannerProps {
  engine: RPPGEngine;
  signalQuality: number;
  triageLevel?: TriageLevel;
  onModeChange: (mode: SimulationMode) => void;
}

export const WebcamBiometricScanner: React.FC<WebcamBiometricScannerProps> = ({
  engine,
  signalQuality,
  triageLevel: _triageLevel,
  onModeChange,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [currentMode, setCurrentMode] = useState<SimulationMode>('live_webcam');
  const [statusText, setStatusText] = useState<string>('Ready for optical scan');
  const animationFrameId = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  }, []);

  const startCamera = async () => {
    try {
      setCameraError(null);
      setStatusText('Requesting camera permissions...');

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch((e) => console.warn('Video play prevented:', e));
          setIsCameraActive(true);
          setStatusText('Camera active. Align forehead within the reticle.');
        };
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      setCameraError('Camera access denied or blocked by browser permissions. Clinical simulation active.');
      setIsCameraActive(false);
      handleModeSelect('normal_sinus');
    }
  };

  useEffect(() => {
    if (!isCameraActive) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const processLoop = () => {
      if (video.readyState >= 2 && video.videoWidth > 0) {
        engine.processFrame(video, canvas, ctx);
        setStatusText(engine.getStatusMessage());
      }
      animationFrameId.current = requestAnimationFrame(processLoop);
    };

    animationFrameId.current = requestAnimationFrame(processLoop);

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [isCameraActive, engine]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const handleModeSelect = (mode: SimulationMode) => {
    setCurrentMode(mode);
    engine.setMode(mode);
    onModeChange(mode);
    if (mode !== 'live_webcam') {
      stopCamera();
      setStatusText(engine.getStatusMessage());
    } else {
      startCamera();
    }
  };

  return (
    <div className="bg-slate-900/95 border border-slate-800 rounded-3xl p-6 shadow-2xl backdrop-blur-2xl relative overflow-hidden flex flex-col justify-between">
      <div>
        {/* Top Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 shadow-inner">
              <Camera className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-black text-white tracking-wider uppercase">
                  Optical rPPG Bio-Scanner
                </h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  Chrominance POS
                </span>
              </div>
              <p className="text-xs text-slate-400">Non-contact vascular hemodynamics extraction</p>
            </div>
          </div>

          {/* SNR Quality Gauge */}
          <div className="flex items-center space-x-2.5 bg-slate-950/80 px-3.5 py-1.5 rounded-xl border border-slate-800">
            <div className="flex flex-col text-right">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Optical SNR</span>
              <span className="text-xs font-mono font-bold text-white">{signalQuality}%</span>
            </div>
            <div className="w-12 h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  signalQuality > 75 ? 'bg-emerald-400' : signalQuality > 50 ? 'bg-amber-400' : 'bg-red-400'
                }`}
                style={{ width: `${signalQuality}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Video Viewport / Biometric Screen */}
        <div className="relative w-full aspect-[4/3] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-inner flex items-center justify-center">
          <canvas ref={canvasRef} className="hidden" />

          {isCameraActive ? (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform -scale-x-100"
              />

              {/* Medical Targeting Reticle Overlay */}
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                {/* Forehead Capillary ROI Box */}
                <div className="relative w-48 h-20 border-2 border-emerald-400/90 rounded-xl bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.35)] animate-pulse">
                  <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 whitespace-nowrap text-[10px] font-mono tracking-widest bg-emerald-950/90 text-emerald-300 border border-emerald-500/50 px-2.5 py-0.5 rounded-full flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                    <span>FOREHEAD CAPILLARY ROI (530nm)</span>
                  </div>
                  {/* Corner Target Markers */}
                  <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-emerald-300"></div>
                  <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-emerald-300"></div>
                  <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-emerald-300"></div>
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-emerald-300"></div>
                </div>

                {/* Face Alignment Contour Guide */}
                <div className="mt-3 w-64 h-80 border-2 border-dashed border-cyan-400/30 rounded-[48%] pointer-events-none flex items-center justify-center">
                  <span className="text-[10px] font-mono text-cyan-400/40 tracking-wider">ALIGN FACE</span>
                </div>
              </div>

              {/* Live Overlay Badge */}
              <div className="absolute bottom-3 left-3 flex items-center space-x-2 bg-black/75 backdrop-blur-md px-3 py-1.5 rounded-lg border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span className="text-[10px] font-mono text-emerald-300 tracking-wider">LIVE OPTICAL TELEMETRY</span>
              </div>

              <button
                onClick={stopCamera}
                className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-black/60 hover:bg-black/90 text-slate-300 border border-slate-700 text-xs font-mono cursor-pointer transition-colors"
              >
                Stop Camera
              </button>
            </>
          ) : (
            <div className="text-center p-8 flex flex-col items-center justify-center">
              <div className="w-20 h-20 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-center mb-4 text-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.15)]">
                <Activity className="w-10 h-10 animate-pulse" />
              </div>
              <h4 className="text-white font-bold text-base mb-1.5">
                {currentMode === 'live_webcam'
                  ? 'Optical Camera Ready'
                  : `Clinical Scenario: ${currentMode.replace('_', ' ').toUpperCase()}`}
              </h4>
              <p className="text-slate-400 text-xs max-w-sm mb-5 leading-relaxed">
                {currentMode === 'live_webcam'
                  ? 'Click Start Bio-Scanner to capture microscopic facial arterial pulse waves via standard laptop camera.'
                  : 'Streaming calibrated physiological vectors with zero external sensors required.'}
              </p>

              {currentMode === 'live_webcam' && (
                <button
                  onClick={startCamera}
                  className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/25 transition-all cursor-pointer transform hover:-translate-y-0.5"
                >
                  <Camera className="w-4 h-4" />
                  <span>Start Live Bio-Scanner</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Live Feedback Status Line */}
        <div className="mt-3 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2 truncate">
            <span className="w-2 h-2 rounded-full bg-cyan-400 flex-shrink-0 animate-pulse"></span>
            <span className="text-slate-300 font-mono text-[11px] truncate">{statusText}</span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono uppercase">30 FPS</span>
        </div>

        {cameraError && (
          <div className="mt-2.5 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{cameraError}</span>
          </div>
        )}
      </div>

      {/* Mode Switcher / Scenario Selector */}
      <div className="mt-5 pt-4 border-t border-slate-800/80">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Demonstration & Physiological Scenarios:</span>
          </span>
          <span className="text-[10px] text-slate-500 font-mono">ZERO HARDWARE REQUIRED</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            onClick={() => handleModeSelect('live_webcam')}
            className={`p-2.5 rounded-xl text-xs font-medium border transition-all text-left flex flex-col cursor-pointer ${
              currentMode === 'live_webcam'
                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-md shadow-cyan-500/20'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <span className="font-bold flex items-center space-x-1 text-white">
              <Camera className="w-3.5 h-3.5 inline text-cyan-400" />
              <span>Live Camera</span>
            </span>
            <span className="text-[10px] opacity-70 mt-0.5">Real rPPG</span>
          </button>

          <button
            onClick={() => handleModeSelect('normal_sinus')}
            className={`p-2.5 rounded-xl text-xs font-medium border transition-all text-left flex flex-col cursor-pointer ${
              currentMode === 'normal_sinus'
                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200 shadow-md shadow-emerald-500/20'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <span className="font-bold flex items-center space-x-1 text-white">
              <ShieldCheck className="w-3.5 h-3.5 inline text-emerald-400" />
              <span>Normal Sinus</span>
            </span>
            <span className="text-[10px] opacity-70 mt-0.5">72 BPM · Safe</span>
          </button>

          <button
            onClick={() => handleModeSelect('acute_tachycardia')}
            className={`p-2.5 rounded-xl text-xs font-medium border transition-all text-left flex flex-col cursor-pointer ${
              currentMode === 'acute_tachycardia'
                ? 'bg-amber-500/20 border-amber-400 text-amber-200 shadow-md shadow-amber-500/20'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <span className="font-bold flex items-center space-x-1 text-white">
              <AlertTriangle className="w-3.5 h-3.5 inline text-amber-400" />
              <span>Tachycardia</span>
            </span>
            <span className="text-[10px] opacity-70 mt-0.5">126 BPM · Alert</span>
          </button>

          <button
            onClick={() => handleModeSelect('sepsis_decompensation')}
            className={`p-2.5 rounded-xl text-xs font-medium border transition-all text-left flex flex-col cursor-pointer ${
              currentMode === 'sepsis_decompensation'
                ? 'bg-red-500/20 border-red-400 text-red-200 shadow-md shadow-red-500/20'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <span className="font-bold flex items-center space-x-1 text-red-400">
              <Activity className="w-3.5 h-3.5 inline text-red-400 animate-pulse" />
              <span>Septic Shock</span>
            </span>
            <span className="text-[10px] opacity-70 mt-0.5">142 BPM · MEWS 6</span>
          </button>
        </div>
      </div>
    </div>
  );
};
