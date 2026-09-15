/**
 * @aegispulse/signal - Browser/Edge Face Detector
 * Dual-tier deterministic face detection for contactless physiological monitoring.
 *
 * Tier 1: Hardware-accelerated native window.FaceDetector (when supported by browser).
 * Tier 2: Pure-TypeScript edge skin-locus & morphological geometry analyzer.
 *
 * Strict Guarantee: Zero video frame persistence or exfiltration.
 */

import type {
  FaceDetectionFrameResult,
  DetectedFace,
  FacePresenceStatus,
  NormalizedRect,
} from './types';

export interface FaceDetectorOptions {
  minFaceSizeFraction?: number;  // Default 0.15 of frame width
  maxFaceSizeFraction?: number;  // Default 0.85 of frame width
  minSkinFraction?: number;      // Default 0.35
  preferNativeDetector?: boolean;// Default true
}

export class BrowserEdgeFaceDetector {
  private readonly minFaceSize: number;
  private readonly maxFaceSize: number;
  private readonly minSkinFraction: number;
  private readonly preferNative: boolean;
  private nativeDetectorInstance: any = null;
  private nativeAvailableChecked = false;

  constructor(options: FaceDetectorOptions = {}) {
    this.minFaceSize = options.minFaceSizeFraction ?? 0.15;
    this.maxFaceSize = options.maxFaceSizeFraction ?? 0.85;
    this.minSkinFraction = options.minSkinFraction ?? 0.35;
    this.preferNative = options.preferNativeDetector ?? true;
  }

  /**
   * Initializes native detector if available in current browser environment.
   */
  private async initNativeDetector(): Promise<void> {
    if (this.nativeAvailableChecked) return;
    this.nativeAvailableChecked = true;

    if (
      this.preferNative &&
      typeof window !== 'undefined' &&
      'FaceDetector' in window
    ) {
      try {
        const NativeFaceDetector = (window as any).FaceDetector;
        this.nativeDetectorInstance = new NativeFaceDetector({
          maxDetectedFaces: 5,
          fastMode: true,
        });
      } catch (err) {
        console.warn('Native FaceDetector initialization failed, falling back to edge detector:', err);
        this.nativeDetectorInstance = null;
      }
    }
  }

  /**
   * Analyzes an HTMLCanvasElement, HTMLVideoElement, or ImageData for human faces.
   */
  public async detectFaces(
    source: HTMLCanvasElement | HTMLVideoElement | ImageData,
    width?: number,
    height?: number
  ): Promise<FaceDetectionFrameResult> {
    await this.initNativeDetector();

    const frameWidth = width ?? (source as any).videoWidth ?? (source as any).width ?? 640;
    const frameHeight = height ?? (source as any).videoHeight ?? (source as any).height ?? 480;
    const now = Date.now();

    // 1. Attempt Native FaceDetector if present
    if (this.nativeDetectorInstance) {
      try {
        const detected = await this.nativeDetectorInstance.detect(source);
        if (Array.isArray(detected) && detected.length > 0) {
          return this.processNativeDetections(detected, frameWidth, frameHeight, now);
        }
      } catch {
        // Fall back to software analyzer seamlessly
      }
    }

    // 2. Deterministic Edge Skin & Morphological Geometry Analysis
    let imageData: ImageData | null = null;
    if (source instanceof ImageData) {
      imageData = source;
    } else if (typeof document !== 'undefined') {
      // Sample down to a lightweight 160x120 analysis grid in volatile RAM
      const analysisWidth = 160;
      const analysisHeight = 120;
      const offscreen = document.createElement('canvas');
      offscreen.width = analysisWidth;
      offscreen.height = analysisHeight;
      const ctx = offscreen.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(source as CanvasImageSource, 0, 0, analysisWidth, analysisHeight);
        imageData = ctx.getImageData(0, 0, analysisWidth, analysisHeight);
        // Clean volatile canvas immediately
        ctx.clearRect(0, 0, analysisWidth, analysisHeight);
      }
    }

    if (!imageData) {
      return {
        timestampMs: now,
        status: 'NO_FACE',
        faces: [],
        totalFacesDetected: 0,
        illuminationLux: 0,
        frameWidth,
        frameHeight,
      };
    }

    return this.analyzeFrameImageData(imageData, frameWidth, frameHeight, now);
  }

  /**
   * Pure mathematical frame analyzer running on raw RGB pixel buffer.
   */
  public analyzeFrameImageData(
    imgData: ImageData,
    frameWidth: number,
    frameHeight: number,
    timestampMs: number
  ): FaceDetectionFrameResult {
    const data = imgData.data;
    const w = imgData.width;
    const h = imgData.height;
    const totalPixels = w * h;

    const skinMask = new Uint8Array(totalPixels);
    let skinPixelCount = 0;
    let rTotal = 0;
    let gTotal = 0;
    let bTotal = 0;

    // Horizontal and vertical skin projection histograms
    const hProj = new Int32Array(w);
    const vProj = new Int32Array(h);

    for (let y = 0; y < h; y++) {
      const rowOffset = y * w;
      for (let x = 0; x < w; x++) {
        const idx = (rowOffset + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        rTotal += r;
        gTotal += g;
        bTotal += b;

        // YCbCr skin locus classification
        // Y  =  0.299R + 0.587G + 0.114B
        // Cb = -0.1687R - 0.3313G + 0.500B + 128
        // Cr =  0.500R - 0.4187G - 0.0813B + 128
        const yLum = 0.299 * r + 0.587 * g + 0.114 * b;
        const cb = -0.1687 * r - 0.3313 * g + 0.5 * b + 128;
        const cr = 0.5 * r - 0.4187 * g - 0.0813 * b + 128;

        const isSkin =
          r > 45 &&
          g > 30 &&
          b > 15 &&
          r > g &&
          r > b &&
          Math.abs(r - g) > 10 &&
          cr >= 130 &&
          cr <= 175 &&
          cb >= 75 &&
          cb <= 130 &&
          yLum >= 35;

        if (isSkin) {
          skinMask[rowOffset + x] = 1;
          skinPixelCount++;
          hProj[x]++;
          vProj[y]++;
        }
      }
    }

    // Illumination estimation in Lux
    const meanR = rTotal / totalPixels;
    const meanG = gTotal / totalPixels;
    const meanB = bTotal / totalPixels;
    const estimatedLux = Math.round(0.2126 * meanR + 0.7152 * meanG + 0.0722 * meanB) * 3.2;

    const globalSkinFraction = skinPixelCount / totalPixels;

    // Reject immediately if negligible skin is detected in the frame
    if (globalSkinFraction < 0.04) {
      return {
        timestampMs,
        status: 'NO_FACE',
        faces: [],
        totalFacesDetected: 0,
        illuminationLux: estimatedLux,
        frameWidth,
        frameHeight,
      };
    }

    // Segment distinct skin clusters along horizontal axis
    const clusters = this.findSkinClusters(hProj, vProj, skinMask, w, h);

    if (clusters.length === 0) {
      return {
        timestampMs,
        status: 'NO_FACE',
        faces: [],
        totalFacesDetected: 0,
        illuminationLux: estimatedLux,
        frameWidth,
        frameHeight,
      };
    }

    // Validate face candidates against biological constraints
    const validFaces: DetectedFace[] = [];
    for (let i = 0; i < clusters.length; i++) {
      const cluster = clusters[i];
      const normWidth = cluster.width / w;
      const normHeight = cluster.height / h;
      const aspectRatio = cluster.height / cluster.width; // Typical human face: 1.1 to 1.6

      // Face size bounds
      if (normWidth < this.minFaceSize || normWidth > this.maxFaceSize) continue;
      if (normHeight < 0.18 || normHeight > 0.90) continue;
      // Aspect ratio check
      if (aspectRatio < 0.95 || aspectRatio > 1.95) continue;

      // Skin density within candidate bounding box
      let clusterSkinCount = 0;
      const totalBoxPixels = cluster.width * cluster.height;
      for (let cy = cluster.y; cy < cluster.y + cluster.height; cy++) {
        const row = cy * w;
        for (let cx = cluster.x; cx < cluster.x + cluster.width; cx++) {
          if (skinMask[row + cx] === 1) clusterSkinCount++;
        }
      }

      const boxSkinFraction = clusterSkinCount / totalBoxPixels;
      if (boxSkinFraction < this.minSkinFraction) continue;

      // Calculate confidence & pose quality
      const sizeQuality = 1.0 - Math.abs(normWidth - 0.40) * 1.5;
      const aspectQuality = 1.0 - Math.abs(aspectRatio - 1.35) * 1.2;
      const confidence = Math.max(
        0.3,
        Math.min(0.98, boxSkinFraction * 0.5 + sizeQuality * 0.3 + aspectQuality * 0.2)
      );

      validFaces.push({
        trackingId: `face-cand-${i}`,
        boundingBox: {
          x: cluster.x / w,
          y: cluster.y / h,
          width: normWidth,
          height: normHeight,
        },
        confidence: Number(confidence.toFixed(2)),
        lastSeenAt: timestampMs,
        stability: 1.0,
        poseQuality: Number(Math.max(0.4, Math.min(1.0, aspectQuality)).toFixed(2)),
        occlusionQuality: Number(boxSkinFraction.toFixed(2)),
        skinFraction: Number(boxSkinFraction.toFixed(2)),
      });
    }

    let status: FacePresenceStatus = 'NO_FACE';
    if (validFaces.length === 1) {
      status = 'ONE_VALID_FACE';
    } else if (validFaces.length > 1) {
      status = 'MULTIPLE_FACES';
    }

    return {
      timestampMs,
      status,
      faces: validFaces,
      primaryFace: validFaces.length === 1 ? validFaces[0] : undefined,
      totalFacesDetected: validFaces.length,
      illuminationLux: estimatedLux,
      frameWidth,
      frameHeight,
    };
  }

  /**
   * Helper: Identifies 1D bounding intervals from projection histogram
   */
  private findSkinClusters(
    hProj: Int32Array,
    vProj: Int32Array,
    _skinMask: Uint8Array,
    w: number,
    h: number
  ): Array<{ x: number; y: number; width: number; height: number }> {
    const hThreshold = Math.max(3, Math.max(...hProj) * 0.25);
    const vThreshold = Math.max(3, Math.max(...vProj) * 0.25);

    // Find horizontal contiguous bands
    const xIntervals: Array<{ start: number; end: number }> = [];
    let inBand = false;
    let bandStart = 0;

    for (let x = 0; x < w; x++) {
      if (hProj[x] >= hThreshold) {
        if (!inBand) {
          inBand = true;
          bandStart = x;
        }
      } else {
        if (inBand) {
          inBand = false;
          if (x - bandStart > w * 0.12) {
            xIntervals.push({ start: bandStart, end: x });
          }
        }
      }
    }
    if (inBand && w - bandStart > w * 0.12) {
      xIntervals.push({ start: bandStart, end: w - 1 });
    }

    // Find vertical bounds
    let minY = h;
    let maxY = 0;
    for (let y = 0; y < h; y++) {
      if (vProj[y] >= vThreshold) {
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }

    if (minY >= maxY) return [];

    const clusters: Array<{ x: number; y: number; width: number; height: number }> = [];
    for (const xInt of xIntervals) {
      clusters.push({
        x: xInt.start,
        y: minY,
        width: xInt.end - xInt.start,
        height: Math.max(20, maxY - minY),
      });
    }

    return clusters;
  }

  private processNativeDetections(
    nativeFaces: any[],
    width: number,
    height: number,
    now: number
  ): FaceDetectionFrameResult {
    const faces: DetectedFace[] = [];

    for (let i = 0; i < nativeFaces.length; i++) {
      const nf = nativeFaces[i];
      const box = nf.boundingBox;
      const normBox: NormalizedRect = {
        x: box.x / width,
        y: box.y / height,
        width: box.width / width,
        height: box.height / height,
      };

      faces.push({
        trackingId: `face-native-${i}`,
        boundingBox: normBox,
        confidence: 0.95,
        lastSeenAt: now,
        stability: 1.0,
        poseQuality: 0.90,
        occlusionQuality: 0.85,
        skinFraction: 0.80,
      });
    }

    let status: FacePresenceStatus = 'NO_FACE';
    if (faces.length === 1) status = 'ONE_VALID_FACE';
    else if (faces.length > 1) status = 'MULTIPLE_FACES';

    return {
      timestampMs: now,
      status,
      faces,
      primaryFace: faces.length === 1 ? faces[0] : undefined,
      totalFacesDetected: faces.length,
      illuminationLux: 300,
      frameWidth: width,
      frameHeight: height,
    };
  }
}
