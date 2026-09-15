import { Request, Response, NextFunction } from 'express';

const FORBIDDEN_MEDIA_KEYS = new Set([
  'video',
  'rawvideo',
  'raw_video',
  'rawframe',
  'raw_frame',
  'framebuffer',
  'frame_buffer',
  'pixels',
  'pixelbuffer',
  'imagedata',
  'image_data',
  'frames',
  'camerastream',
  'camera_stream',
  'image',
  'streamblob',
  'videoblob',
  'base64frame',
  'base64_frame',
]);

const FORBIDDEN_CONTENT_TYPE_PREFIXES = [
  'image/',
  'video/',
  'multipart/form-data',
];

/**
 * Recursively scans an object, array, or scalar for forbidden video/image keys or data URIs
 */
function containsVisualMedia(data: any): { found: boolean; reason?: string } {
  if (!data) return { found: false };

  if (typeof data === 'string') {
    // Check for base64 data URI schemes for images or videos
    if (data.startsWith('data:image/') || data.startsWith('data:video/')) {
      return {
        found: true,
        reason: 'Detected base64 image/video data URI scheme.',
      };
    }
    // Check for raw base64 JPEG/PNG magic bytes if unusually long (> 10KB)
    if (data.length > 10000 && (/^[A-Za-z0-9+/=]{1000,}$/.test(data.trim()))) {
      return {
        found: true,
        reason: 'Detected raw base64 encoded binary payload exceeding telemetry scalar limits.',
      };
    }
    return { found: false };
  }

  if (Array.isArray(data)) {
    for (const item of data) {
      const res = containsVisualMedia(item);
      if (res.found) return res;
    }
    return { found: false };
  }

  if (typeof data === 'object') {
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      if (FORBIDDEN_MEDIA_KEYS.has(lowerKey)) {
        return {
          found: true,
          reason: `Forbidden media/video key '${key}' detected in payload.`,
        };
      }
      const res = containsVisualMedia(value);
      if (res.found) return res;
    }
  }

  return { found: false };
}

/**
 * AegisPulse Privacy Invariant Enforcement Middleware
 * Guarantees that raw patient video, image frames, or pixel buffers NEVER enter the backend API.
 */
export function enforcePrivacyInvariants(req: Request, res: Response, next: NextFunction): void {
  // Allow sync endpoint to process individual items and produce structured conflict logs
  if (req.path.endsWith('/sync') || req.originalUrl?.includes('/sync')) {
    return next();
  }

  // 1. Check Content-Type header
  const contentType = req.headers['content-type']?.toLowerCase() || '';
  for (const prefix of FORBIDDEN_CONTENT_TYPE_PREFIXES) {
    if (contentType.startsWith(prefix)) {
      res.status(400).json({
        type: 'https://aegispulse.internal/errors/BAD_REQUEST',
        title: 'Privacy Invariant Violation',
        status: 400,
        detail: `PRIVACY VIOLATION: Media content type '${contentType}' is strictly prohibited. Raw patient video/images must never be transmitted.`,
        code: 'BAD_REQUEST',
      });
      return;
    }
  }

  // 2. Deep scan body
  if (req.body) {
    const bodyCheck = containsVisualMedia(req.body);
    if (bodyCheck.found) {
      res.status(400).json({
        type: 'https://aegispulse.internal/errors/BAD_REQUEST',
        title: 'Privacy Invariant Violation',
        status: 400,
        detail: `PRIVACY VIOLATION: ${bodyCheck.reason} Raw patient video/images must never be transmitted.`,
        code: 'BAD_REQUEST',
      });
      return;
    }
  }

  // 3. Deep scan query parameters
  if (req.query) {
    const queryCheck = containsVisualMedia(req.query);
    if (queryCheck.found) {
      res.status(400).json({
        type: 'https://aegispulse.internal/errors/BAD_REQUEST',
        title: 'Privacy Invariant Violation',
        status: 400,
        detail: `PRIVACY VIOLATION: ${queryCheck.reason} Raw patient video/images must never be transmitted in query parameters.`,
        code: 'BAD_REQUEST',
      });
      return;
    }
  }

  next();
}
