/**
 * @aegispulse/signal - Face Tracker
 * Enforces temporal identity persistence, centroid stability, and timeout-based face loss invalidation.
 */

import type { DetectedFace, NormalizedRect } from './types';

export interface FaceTrackerOptions {
  faceLossTimeoutMs?: number;   // Default 500ms
  minIoUForMatch?: number;      // Default 0.30
  maxCentroidDisplacement?: number; // Normalized distance threshold for motion
}

interface TrackedFaceInternal {
  trackingId: string;
  firstSeenAt: number;
  lastSeenAt: number;
  boundingBox: NormalizedRect;
  centroidHistory: Array<{ x: number; y: number; time: number }>;
  stabilityScore: number;
  consecutiveFramesPresent: number;
  lastConfidence: number;
  lastPoseQuality: number;
  lastOcclusionQuality: number;
  lastSkinFraction: number;
}

export class FaceTracker {
  private readonly timeoutMs: number;
  private readonly minIoU: number;
  private readonly motionThreshold: number;
  private nextId = 1;
  private activeTracks: Map<string, TrackedFaceInternal> = new Map();

  constructor(options: FaceTrackerOptions = {}) {
    this.timeoutMs = options.faceLossTimeoutMs ?? 500;
    this.minIoU = options.minIoUForMatch ?? 0.30;
    this.motionThreshold = options.maxCentroidDisplacement ?? 0.06;
  }

  /**
   * Updates tracks with newly detected candidate faces in current frame.
   */
  public update(candidateFaces: DetectedFace[], timestampMs: number): {
    trackedFaces: DetectedFace[];
    lostTrackingIds: string[];
    isMotionDetected: boolean;
    primaryFace?: DetectedFace;
  } {
    // 1. Check for expired tracks first
    const lostTrackingIds: string[] = [];
    for (const [id, track] of this.activeTracks.entries()) {
      if (timestampMs - track.lastSeenAt > this.timeoutMs) {
        lostTrackingIds.push(id);
        this.activeTracks.delete(id);
      }
    }

    // 2. Match incoming candidates to active tracks via IoU & centroid proximity
    const matchedTrackIds = new Set<string>();
    const matchedCandidateIndices = new Set<number>();

    for (let cIdx = 0; cIdx < candidateFaces.length; cIdx++) {
      const cand = candidateFaces[cIdx];
      let bestMatchId: string | null = null;
      let highestIoU = 0;

      for (const [trackId, track] of this.activeTracks.entries()) {
        if (matchedTrackIds.has(trackId)) continue;
        const iou = this.calculateIoU(cand.boundingBox, track.boundingBox);
        if (iou > this.minIoU && iou > highestIoU) {
          highestIoU = iou;
          bestMatchId = trackId;
        }
      }

      if (bestMatchId) {
        matchedTrackIds.add(bestMatchId);
        matchedCandidateIndices.add(cIdx);
        this.updateExistingTrack(bestMatchId, cand, timestampMs);
      }
    }

    // 3. Register new tracks for unmatched candidates
    for (let cIdx = 0; cIdx < candidateFaces.length; cIdx++) {
      if (!matchedCandidateIndices.has(cIdx)) {
        const cand = candidateFaces[cIdx];
        const newId = `FACE-${this.nextId++}`;
        this.createNewTrack(newId, cand, timestampMs);
      }
    }

    // 4. Build output faces and detect motion
    const outputFaces: DetectedFace[] = [];
    let isMotionDetected = false;

    for (const track of this.activeTracks.values()) {
      const motionInTrack = this.evaluateMotion(track);
      if (motionInTrack) isMotionDetected = true;

      outputFaces.push({
        trackingId: track.trackingId,
        boundingBox: track.boundingBox,
        confidence: track.lastConfidence,
        lastSeenAt: track.lastSeenAt,
        stability: track.stabilityScore,
        poseQuality: track.lastPoseQuality,
        occlusionQuality: track.lastOcclusionQuality,
        skinFraction: track.lastSkinFraction,
      });
    }

    // Determine primary face (highest consecutive presence & confidence)
    let primaryFace: DetectedFace | undefined;
    if (outputFaces.length === 1) {
      primaryFace = outputFaces[0];
    } else if (outputFaces.length > 1) {
      primaryFace = outputFaces.reduce((prev, curr) =>
        curr.confidence * curr.stability > prev.confidence * prev.stability ? curr : prev
      );
    }

    return {
      trackedFaces: outputFaces,
      lostTrackingIds,
      isMotionDetected,
      primaryFace,
    };
  }

  private updateExistingTrack(trackId: string, cand: DetectedFace, timestampMs: number): void {
    const track = this.activeTracks.get(trackId);
    if (!track) return;

    const candCentroid = {
      x: cand.boundingBox.x + cand.boundingBox.width / 2,
      y: cand.boundingBox.y + cand.boundingBox.height / 2,
      time: timestampMs,
    };

    track.centroidHistory.push(candCentroid);
    if (track.centroidHistory.length > 15) track.centroidHistory.shift();

    track.boundingBox = cand.boundingBox;
    track.lastSeenAt = timestampMs;
    track.consecutiveFramesPresent++;
    track.lastConfidence = cand.confidence;
    track.lastPoseQuality = cand.poseQuality;
    track.lastOcclusionQuality = cand.occlusionQuality;
    track.lastSkinFraction = cand.skinFraction;

    // Calculate stability based on recent centroid variance
    if (track.centroidHistory.length >= 3) {
      let maxDelta = 0;
      for (let i = 1; i < track.centroidHistory.length; i++) {
        const dx = track.centroidHistory[i].x - track.centroidHistory[i - 1].x;
        const dy = track.centroidHistory[i].y - track.centroidHistory[i - 1].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > maxDelta) maxDelta = dist;
      }
      track.stabilityScore = Number(Math.max(0.1, 1.0 - (maxDelta / this.motionThreshold)).toFixed(2));
    }
  }

  private createNewTrack(newId: string, cand: DetectedFace, timestampMs: number): void {
    const centroid = {
      x: cand.boundingBox.x + cand.boundingBox.width / 2,
      y: cand.boundingBox.y + cand.boundingBox.height / 2,
      time: timestampMs,
    };

    this.activeTracks.set(newId, {
      trackingId: newId,
      firstSeenAt: timestampMs,
      lastSeenAt: timestampMs,
      boundingBox: cand.boundingBox,
      centroidHistory: [centroid],
      stabilityScore: 0.85,
      consecutiveFramesPresent: 1,
      lastConfidence: cand.confidence,
      lastPoseQuality: cand.poseQuality,
      lastOcclusionQuality: cand.occlusionQuality,
      lastSkinFraction: cand.skinFraction,
    });
  }

  private evaluateMotion(track: TrackedFaceInternal): boolean {
    if (track.centroidHistory.length < 2) return false;
    const len = track.centroidHistory.length;
    const p1 = track.centroidHistory[len - 2];
    const p2 = track.centroidHistory[len - 1];
    const dist = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
    return dist > this.motionThreshold;
  }

  private calculateIoU(a: NormalizedRect, b: NormalizedRect): number {
    const xA = Math.max(a.x, b.x);
    const yA = Math.max(a.y, b.y);
    const xB = Math.min(a.x + a.width, b.x + b.width);
    const yB = Math.min(a.y + a.height, b.y + b.height);

    const interArea = Math.max(0, xB - xA) * Math.max(0, yB - yA);
    const boxAArea = a.width * a.height;
    const boxBArea = b.width * b.height;

    const unionArea = boxAArea + boxBArea - interArea;
    return unionArea > 0 ? interArea / unionArea : 0;
  }

  public reset(): void {
    this.activeTracks.clear();
    this.nextId = 1;
  }
}
