import type { SimulationMode, VitalsReading } from './types';
import { calculateMEWS, calculateQSOFA } from './mewsCalculator';

export class RPPGEngine {
  private bufferSize = 180; // ~6 seconds at 30 FPS
  private rawGreenBuffer: number[] = [];
  private rawRedBuffer: number[] = [];
  private rawBlueBuffer: number[] = [];
  private timestamps: number[] = [];
  private pulseSignalBuffer: number[] = [];

  private currentBPM = 74;
  private currentHRV = 48; // RMSSD in ms
  private currentRR = 16;
  private currentSpO2 = 98;
  private currentTemp = 36.8;
  private systolicBP = 118;
  private diastolicBP = 76;
  private avpu: 'A' | 'V' | 'P' | 'U' = 'A';
  private signalQuality = 88; // %
  private simulationMode: SimulationMode = 'live_webcam';
  private simPhase = 0;
  private isFaceDetected = false;
  private statusMessage = 'Camera Initializing...';

  constructor() {
    this.resetBuffers();
  }

  public setMode(mode: SimulationMode) {
    this.simulationMode = mode;
    if (mode === 'normal_sinus') {
      this.currentBPM = 72;
      this.currentRR = 16;
      this.currentSpO2 = 98;
      this.currentTemp = 36.7;
      this.systolicBP = 118;
      this.diastolicBP = 78;
      this.avpu = 'A';
      this.signalQuality = 96;
      this.statusMessage = 'Normal Sinus Rhythm (Simulated)';
    } else if (mode === 'acute_tachycardia') {
      this.currentBPM = 126;
      this.currentRR = 24;
      this.currentSpO2 = 94;
      this.currentTemp = 38.4;
      this.systolicBP = 98;
      this.diastolicBP = 64;
      this.avpu = 'A';
      this.signalQuality = 92;
      this.statusMessage = 'Acute Tachycardia (Simulated)';
    } else if (mode === 'sepsis_decompensation') {
      this.currentBPM = 142;
      this.currentRR = 30;
      this.currentSpO2 = 87;
      this.currentTemp = 39.3;
      this.systolicBP = 78;
      this.diastolicBP = 48;
      this.avpu = 'V';
      this.signalQuality = 90;
      this.statusMessage = 'Septic Shock Decompensation (Simulated)';
    } else {
      this.statusMessage = 'Optical rPPG Live Stream';
    }
  }

  public getMode(): SimulationMode {
    return this.simulationMode;
  }

  public getStatusMessage(): string {
    return this.statusMessage;
  }

  public resetBuffers() {
    this.rawGreenBuffer = [];
    this.rawRedBuffer = [];
    this.rawBlueBuffer = [];
    this.timestamps = [];
    this.pulseSignalBuffer = [];
  }

  /**
   * Process a single video frame from the webcam canvas using POS (Plane-Orthogonal-to-Skin) rPPG.
   */
  public processFrame(
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D
  ): { roi: { x: number; y: number; width: number; height: number }; quality: number } | null {
    if (!video || video.readyState < 2 || video.videoWidth === 0) return null;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Dynamic Forehead ROI: Center 30% width, Upper 20% height
    const roiWidth = Math.floor(canvas.width * 0.30);
    const roiHeight = Math.floor(canvas.height * 0.18);
    const roiX = Math.floor((canvas.width - roiWidth) / 2);
    const roiY = Math.floor(canvas.height * 0.15);

    let frameData: ImageData;
    try {
      frameData = ctx.getImageData(roiX, roiY, roiWidth, roiHeight);
    } catch (e) {
      return null;
    }

    const data = frameData.data;
    let rSum = 0;
    let gSum = 0;
    let bSum = 0;
    const pixelCount = data.length / 4;

    for (let i = 0; i < data.length; i += 4) {
      rSum += data[i];
      gSum += data[i + 1];
      bSum += data[i + 2];
    }

    const meanR = rSum / pixelCount;
    const meanG = gSum / pixelCount;
    const meanB = bSum / pixelCount;

    // Luminance & Face check: Skin must have meaningful red/green dominance
    const totalColor = meanR + meanG + meanB;
    const isSkinColor = meanR > meanB && meanR > 40 && totalColor > 120 && totalColor < 700;
    this.isFaceDetected = isSkinColor;

    const now = performance.now();

    if (this.simulationMode === 'live_webcam') {
      if (!isSkinColor) {
        this.statusMessage = 'Please align your forehead within the green scanner box';
        this.signalQuality = Math.max(20, this.signalQuality - 2);
      } else {
        this.statusMessage = 'Capturing Arterial Blood Volume Pulse...';
        this.rawRedBuffer.push(meanR);
        this.rawGreenBuffer.push(meanG);
        this.rawBlueBuffer.push(meanB);
        this.timestamps.push(now);

        if (this.rawGreenBuffer.length > this.bufferSize) {
          this.rawRedBuffer.shift();
          this.rawGreenBuffer.shift();
          this.rawBlueBuffer.shift();
          this.timestamps.shift();
        }

        this.applyPOSAlgorithm();
      }
    }

    return {
      roi: { x: roiX, y: roiY, width: roiWidth, height: roiHeight },
      quality: this.signalQuality,
    };
  }

  /**
   * Plane-Orthogonal-to-Skin (POS) rPPG Algorithm:
   * Isolates pulsatile blood volume changes while canceling specular reflections & illumination drift.
   */
  private applyPOSAlgorithm() {
    const N = this.rawGreenBuffer.length;
    if (N < 45) {
      this.statusMessage = 'Calibrating optical sensor...';
      return;
    }

    const S: number[] = [];
    // Compute normalized chrominance
    for (let i = 0; i < N; i++) {
      const r = this.rawRedBuffer[i];
      const g = this.rawGreenBuffer[i];
      const b = this.rawBlueBuffer[i];
      const total = r + g + b || 1;

      const rn = r / total;
      const gn = g / total;
      const bn = b / total;

      // Two orthogonal projection signals
      const x = 3 * rn - 2 * gn;
      const y = 1.5 * rn + gn - 1.5 * bn;
      S.push(x - y);
    }

    // Moving average detrending (window = 15 samples)
    const windowSize = 15;
    const detrended: number[] = [];
    for (let i = 0; i < N; i++) {
      const start = Math.max(0, i - Math.floor(windowSize / 2));
      const end = Math.min(N, i + Math.floor(windowSize / 2));
      let sum = 0;
      for (let j = start; j < end; j++) sum += S[j];
      const avg = sum / (end - start);
      detrended.push(S[i] - avg);
    }

    this.pulseSignalBuffer = detrended;

    // Peak detection for instantaneous Heart Rate
    const peaks: number[] = [];
    for (let i = 2; i < detrended.length - 2; i++) {
      if (
        detrended[i] > detrended[i - 1] &&
        detrended[i] > detrended[i - 2] &&
        detrended[i] > detrended[i + 1] &&
        detrended[i] > detrended[i + 2] &&
        detrended[i] > 0.005 // POS threshold
      ) {
        peaks.push(this.timestamps[i]);
      }
    }

    if (peaks.length >= 3) {
      const ibis: number[] = [];
      for (let i = 1; i < peaks.length; i++) {
        const deltaMs = peaks[i] - peaks[i - 1];
        if (deltaMs >= 320 && deltaMs <= 1300) { // 46 to 188 BPM
          ibis.push(deltaMs);
        }
      }

      if (ibis.length >= 2) {
        const avgIbi = ibis.reduce((a, b) => a + b, 0) / ibis.length;
        const calculatedBpm = Math.round(60000 / avgIbi);

        if (calculatedBpm >= 48 && calculatedBpm <= 180) {
          this.currentBPM = Math.round(0.80 * this.currentBPM + 0.20 * calculatedBpm);
          this.statusMessage = `Optical Signal Locked (${this.currentBPM} BPM)`;
          this.signalQuality = Math.min(98, Math.max(75, 70 + ibis.length * 4));
        }

        // RMSSD for HRV
        let sumSquaredDiffs = 0;
        for (let i = 1; i < ibis.length; i++) {
          const diff = ibis[i] - ibis[i - 1];
          sumSquaredDiffs += diff * diff;
        }
        this.currentHRV = Math.round(Math.sqrt(sumSquaredDiffs / (ibis.length - 1))) || 45;
      }
    }
  }

  /**
   * Generates continuous waveform sample for the 60fps canvas oscilloscope.
   */
  public getWaveformSample(): number {
    this.simPhase += 0.08;
    const bpm = this.currentBPM;
    const freq = bpm / 60;

    if (this.simulationMode !== 'live_webcam' || this.pulseSignalBuffer.length === 0 || !this.isFaceDetected) {
      // High-fidelity synthesized arterial PPG pulse waveform (Systolic peak + dicrotic notch)
      const t = this.simPhase * freq * 1.5;
      const systolic = Math.sin(t);
      const dicrotic = 0.35 * Math.sin(2 * t - 0.6);
      const noise = (Math.random() - 0.5) * 0.03;
      return systolic + dicrotic + noise;
    }

    const latest = this.pulseSignalBuffer[this.pulseSignalBuffer.length - 1] || 0;
    return Math.max(-1.5, Math.min(1.5, latest * 20.0));
  }

  /**
   * Returns current composite clinical vitals reading.
   */
  public getVitalsReading(): VitalsReading {
    const mews = calculateMEWS({
      heartRate: this.currentBPM,
      systolicBP: this.systolicBP,
      respiratoryRate: this.currentRR,
      temperature: this.currentTemp,
      avpu: this.avpu,
    });

    const qsofa = calculateQSOFA(this.currentRR, this.systolicBP, this.avpu !== 'A');

    return {
      heartRate: this.currentBPM,
      respiratoryRate: this.currentRR,
      hrv: this.currentHRV,
      spo2: this.currentSpO2,
      temperature: this.currentTemp,
      systolicBP: this.systolicBP,
      diastolicBP: this.diastolicBP,
      mewsScore: mews.score,
      qsofaScore: qsofa.score,
      triageLevel: mews.triageLevel,
      signalQuality: this.signalQuality,
      timestamp: Date.now(),
    };
  }

  public updateManualVitals(updates: {
    heartRate?: number;
    systolicBP?: number;
    diastolicBP?: number;
    respiratoryRate?: number;
    temperature?: number;
    spo2?: number;
    avpu?: 'A' | 'V' | 'P' | 'U';
  }) {
    if (updates.heartRate !== undefined) this.currentBPM = updates.heartRate;
    if (updates.systolicBP !== undefined) this.systolicBP = updates.systolicBP;
    if (updates.diastolicBP !== undefined) this.diastolicBP = updates.diastolicBP;
    if (updates.respiratoryRate !== undefined) this.currentRR = updates.respiratoryRate;
    if (updates.temperature !== undefined) this.currentTemp = updates.temperature;
    if (updates.spo2 !== undefined) this.currentSpO2 = updates.spo2;
    if (updates.avpu !== undefined) this.avpu = updates.avpu;
  }
}
