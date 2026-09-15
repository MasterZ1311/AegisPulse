/**
 * @aegispulse/signal - Anatomical ROI Manager
 * Extracts forehead and cheek regions of interest from tracked face bounding boxes.
 * Computes spatial mean RGB while preserving privacy (never stores raw pixels).
 */

import type {
  NormalizedRect,
  DetectedFace,
  FaceRoiRegions,
  RoiSpatialAverages,
} from './types';

export class RoiManager {
  private currentRegions: FaceRoiRegions | null = null;

  /**
   * Derives anatomical sub-regions from a tracked face.
   */
  public computeRois(face: DetectedFace, timestampMs: number): FaceRoiRegions {
    const box = face.boundingBox;

    // Anatomical proportions based on anthropological facial landmarks:
    // Forehead: Upper 12% to 34% of face height, center 50% width (avoids hair and eyes)
    const forehead: NormalizedRect = {
      x: box.x + box.width * 0.25,
      y: box.y + box.height * 0.12,
      width: box.width * 0.50,
      height: box.height * 0.22,
    };

    // Left Cheek: Lateral mid-face quadrant (avoids nose and mouth)
    const leftCheek: NormalizedRect = {
      x: box.x + box.width * 0.12,
      y: box.y + box.height * 0.52,
      width: box.width * 0.24,
      height: box.height * 0.20,
    };

    // Right Cheek: Lateral mid-face quadrant
    const rightCheek: NormalizedRect = {
      x: box.x + box.width * 0.64,
      y: box.y + box.height * 0.52,
      width: box.width * 0.24,
      height: box.height * 0.20,
    };

    this.currentRegions = {
      forehead,
      leftCheek,
      rightCheek,
      isValid: true,
      skinFraction: face.skinFraction,
      lastCalculatedAt: timestampMs,
    };

    return this.currentRegions;
  }

  /**
   * Samples spatial mean RGB from volatile ImageData for given normalized rectangle.
   */
  public extractRegionRgb(
    imgData: ImageData,
    rect: NormalizedRect
  ): { meanR: number; meanG: number; meanB: number; pixelCount: number; skinFraction: number } {
    const data = imgData.data;
    const w = imgData.width;
    const h = imgData.height;

    const startX = Math.max(0, Math.floor(rect.x * w));
    const startY = Math.max(0, Math.floor(rect.y * h));
    const endX = Math.min(w, Math.ceil((rect.x + rect.width) * w));
    const endY = Math.min(h, Math.ceil((rect.y + rect.height) * h));

    let rSum = 0;
    let gSum = 0;
    let bSum = 0;
    let validSkinPixels = 0;
    const totalPixels = Math.max(1, (endX - startX) * (endY - startY));

    for (let y = startY; y < endY; y++) {
      const rowOffset = y * w;
      for (let x = startX; x < endX; x++) {
        const idx = (rowOffset + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        rSum += r;
        gSum += g;
        bSum += b;

        // Quick skin check
        if (r > g && r > b && r > 40 && Math.abs(r - g) > 8) {
          validSkinPixels++;
        }
      }
    }

    return {
      meanR: rSum / totalPixels,
      meanG: gSum / totalPixels,
      meanB: bSum / totalPixels,
      pixelCount: totalPixels,
      skinFraction: validSkinPixels / totalPixels,
    };
  }

  /**
   * Extracts multi-ROI spatial averages (Forehead + Cheeks) and computes composite.
   */
  public extractCompositeAverages(
    imgData: ImageData,
    regions: FaceRoiRegions
  ): RoiSpatialAverages {
    const fh = this.extractRegionRgb(imgData, regions.forehead);
    const lc = this.extractRegionRgb(imgData, regions.leftCheek);
    const rc = this.extractRegionRgb(imgData, regions.rightCheek);

    // Forehead has highest perfusion and capillary signal SNR; weight it 60%, cheeks 20% each
    const compR = fh.meanR * 0.60 + lc.meanR * 0.20 + rc.meanR * 0.20;
    const compG = fh.meanG * 0.60 + lc.meanG * 0.20 + rc.meanG * 0.20;
    const compB = fh.meanB * 0.60 + lc.meanB * 0.20 + rc.meanB * 0.20;

    const meanSkinFraction = (fh.skinFraction + lc.skinFraction + rc.skinFraction) / 3;

    return {
      foreheadRgb: [fh.meanR, fh.meanG, fh.meanB],
      leftCheekRgb: [lc.meanR, lc.meanG, lc.meanB],
      rightCheekRgb: [rc.meanR, rc.meanG, rc.meanB],
      compositeRgb: [compR, compG, compB],
      pixelCount: fh.pixelCount + lc.pixelCount + rc.pixelCount,
      skinFraction: Number(meanSkinFraction.toFixed(2)),
    };
  }

  public getRegions(): FaceRoiRegions | null {
    return this.currentRegions;
  }

  /**
   * Strict invalidation: purges active ROIs immediately when face is lost.
   */
  public invalidate(): void {
    this.currentRegions = null;
  }
}
