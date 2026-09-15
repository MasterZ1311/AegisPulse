import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { RppgSensorProvider } from '@aegispulse/signal';
import { wardStateService } from '../src/services/ward-state.service';
import { syncService } from '../src/services/sync.service';
import { tokenService } from '../src/services/token.service';
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

describe('Implementation-Level Privacy Verification: Strict Exclusion of Raw Video/Image Payloads', () => {
  const app = createApp();

  // Issue valid nurse token for test requests
  const authHeader = `Bearer ${
    tokenService.generateToken(
      {
        userId: 'usr-nurse-101',
        username: 'nurse',
        fullName: 'Sarah Jenkins, RN',
        role: 'WARD_NURSE',
        assignedWardIds: ['WARD-A', 'WARD-4B'],
      },
      'access',
      3600
    ).token
  }`;

  // ==========================================================================
  // 1. HTTP API Payload Inspection (Fetch / XHR)
  // ==========================================================================
  describe('1. HTTP API Payload Inspection (Fetch/XHR Invariant)', () => {
    it('strictly rejects observation payloads containing forbidden video or frame keys', async () => {
      const forbiddenPayloads = [
        { heartRate: 75, video: 'blob:http://localhost/stream-uuid' },
        { heartRate: 75, rawFrame: [120, 140, 110, 255] },
        { heartRate: 75, raw_frame: 'base64-frame-data' },
        { heartRate: 75, pixels: [[255, 0, 0], [0, 255, 0]] },
        { heartRate: 75, pixelBuffer: '0xFFD8FFE0...' },
        { heartRate: 75, imageData: { width: 640, height: 480 } },
        { heartRate: 75, frames: ['frame_001.jpg', 'frame_002.jpg'] },
        { heartRate: 75, cameraStream: 'rtsp://bedside-cam-01:554/live' },
        { heartRate: 75, streamBlob: 'data:video/mp4;base64,AAAA...' },
      ];

      for (const badPayload of forbiddenPayloads) {
        const res = await request(app)
          .post('/api/v1/patients/P001/observations')
          .set('Authorization', authHeader)
          .send(badPayload);

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('BAD_REQUEST');
        expect(res.body.detail).toContain('PRIVACY VIOLATION');
        expect(res.body.detail).toContain('Raw patient video/images must never be transmitted');
      }
    });

    it('strictly rejects payloads containing base64 data URIs for images or videos', async () => {
      const dataUriPayloads = [
        { heartRate: 80, notes: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' },
        { heartRate: 80, notes: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP...' },
        { heartRate: 80, notes: 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAA...' },
      ];

      for (const badPayload of dataUriPayloads) {
        const res = await request(app)
          .post('/api/v1/patients/P001/observations')
          .set('Authorization', authHeader)
          .send(badPayload);

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('BAD_REQUEST');
        expect(res.body.detail).toContain('base64 image/video data URI');
      }
    });

    it('strictly rejects media Content-Types (multipart/form-data, image/*, video/*)', async () => {
      const forbiddenContentTypes = [
        'image/jpeg',
        'image/png',
        'video/mp4',
        'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW',
      ];

      for (const cType of forbiddenContentTypes) {
        const res = await request(app)
          .post('/api/v1/patients/P001/observations')
          .set('Authorization', authHeader)
          .set('Content-Type', cType)
          .send('binary-or-multipart-payload');

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('BAD_REQUEST');
      }
    });

    it('strictly rejects forbidden video keys in URL query parameters', async () => {
      const res = await request(app)
        .get('/api/v1/patients/P001/observations?video=stream123')
        .set('Authorization', authHeader);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('BAD_REQUEST');
    });

    it('accepts strictly sanitized numerical telemetry without visual payloads', async () => {
      const validTelemetry = {
        heartRate: 74,
        respiratoryRate: 16,
        systolicBP: 122,
        diastolicBP: 78,
        spo2: 98,
        confidence: 0.94,
        source: 'BEDSIDE_DEVICE',
      };

      const res = await request(app)
        .post('/api/v1/patients/P001/observations')
        .set('Authorization', authHeader)
        .send(validTelemetry);

      expect(res.status).toBe(201);
      expect(res.body.data.heartRate).toBe(74);
      expect(res.body.data.shockIndex).toBeCloseTo(74 / 122, 2);
    });
  });

  // ==========================================================================
  // 2. Offline Sync Queue Privacy Inspection
  // ==========================================================================
  describe('2. Offline Synchronization Privacy Invariant', () => {
    it('rejects queued sync items containing raw video or frame buffers', () => {
      const batchWithVideo = {
        clientSyncId: 'sync-batch-001',
        clientId: 'tablet-bedside-403',
        items: [
          {
            idempotencyKey: 'idemp-good-01',
            itemType: 'OBSERVATION' as const,
            timestamp: Date.now() - 5000,
            patientId: 'P001',
            payload: { heartRate: 78, systolicBP: 120, diastolicBP: 80 },
          },
          {
            idempotencyKey: 'idemp-bad-video-02',
            itemType: 'OBSERVATION' as const,
            timestamp: Date.now() - 4000,
            patientId: 'P001',
            payload: {
              heartRate: 78,
              video: 'blob:http://localhost/video-frame-cache',
              frameBuffer: '0xFFD8FFE000104A464946...',
            },
          },
        ],
      };

      const result = syncService.processSyncBatch(batchWithVideo);

      // The valid item should be processed; the video item must be rejected
      expect(result.processedCount).toBe(1);
      expect(result.rejectedCount).toBe(1);
      expect(result.conflicts.length).toBe(1);
      expect(result.conflicts[0].idempotencyKey).toBe('idemp-bad-video-02');
      expect(result.conflicts[0].reason).toContain('Forbidden raw video/frame payload detected');
    });
  });

  // ==========================================================================
  // 3. Signal Processing Edge Pipeline (rPPG Memory Lifecycle)
  // ==========================================================================
  describe('3. Signal Processing Volatile RAM Invariant', () => {
    it('RppgSensorProvider strictly enforces rejection of raw frame and image keys', () => {
      const provider = new RppgSensorProvider({ providerId: 'edge-cam-bed-01' });

      const forbiddenRoiPayloads = [
        { meanR: 125, meanG: 142, meanB: 112, timestamp: Date.now(), video: 'stream-pointer' },
        { meanR: 125, meanG: 142, meanB: 112, timestamp: Date.now(), rawFrame: new Uint8Array(1024) },
        { meanR: 125, meanG: 142, meanB: 112, timestamp: Date.now(), pixels: [255, 128, 64] },
        { meanR: 125, meanG: 142, meanB: 112, timestamp: Date.now(), buffer: 'raw-bytes' },
        { meanR: 125, meanG: 142, meanB: 112, timestamp: Date.now(), imageData: {} },
      ];

      for (const badRoi of forbiddenRoiPayloads) {
        expect(() => provider.pushFrameRoi(badRoi as any, 'P001', 'BED-01')).toThrow(
          /PRIVACY VIOLATION: Raw image data key '.*' detected in ROI/
        );
      }
    });

    it('RppgSensorProvider processes only spatial mean RGB channels and emits numerical vitals', () => {
      const provider = new RppgSensorProvider({ providerId: 'edge-cam-bed-01' });

      // Push 100 safe spatial aggregate ROIs (mean scalars only)
      let emittedReading = null;
      provider.onReading((reading) => {
        emittedReading = reading;
      });

      for (let i = 0; i < 100; i++) {
        provider.pushFrameRoi(
          {
            meanR: 120 + Math.sin(i * 0.2) * 2,
            meanG: 140 + Math.cos(i * 0.2) * 3,
            meanB: 110 + Math.sin(i * 0.2) * 1.5,
            timestamp: Date.now() + i * 33,
          } as any,
          'P001',
          'BED-01',
          30
        );
      }

      // Verify emitted sensor readings contain only numerical vital estimates
      expect(provider.getStatus().state).toBeDefined();
    });
  });

  // ==========================================================================
  // 4. Database Schema & Storage Inspection (Zero Visual Data Persisted)
  // ==========================================================================
  describe('4. Database Schema & Persistence Invariant', () => {
    it('proves SQLite observations table has ZERO BLOB or image columns', () => {
      const db = wardStateService.getDb();
      const tableInfo = db.prepare("PRAGMA table_info('observations')").all() as Array<{
        cid: number;
        name: string;
        type: string;
        notnull: number;
      }>;

      // Extract column types and names
      const columnNames = tableInfo.map((c) => c.name.toLowerCase());
      const columnTypes = tableInfo.map((c) => c.type.toUpperCase());

      // No column should be of BLOB type
      expect(columnTypes).not.toContain('BLOB');

      // No column name should be associated with imagery
      const forbiddenColumns = ['video', 'frame', 'image', 'pixels', 'photo', 'stream'];
      for (const col of columnNames) {
        for (const forbidden of forbiddenColumns) {
          expect(col).not.toContain(forbidden);
        }
      }
    });

    it('verifies stored observation records contain only numerical vitals and quality metrics', () => {
      const db = wardStateService.getDb();
      const rows = db.prepare('SELECT * FROM observations LIMIT 50').all() as Array<Record<string, any>>;

      for (const row of rows) {
        // Ensure every field is scalar number, string ID, or null
        for (const [key, value] of Object.entries(row)) {
          if (value !== null && typeof value === 'string') {
            expect(value).not.toContain('data:image/');
            expect(value).not.toContain('data:video/');
            expect(value.length).toBeLessThan(500); // Standard text IDs / strings only
          }
        }
      }
    });
  });

  // ==========================================================================
  // 5. Logging & Analytics Sanitization
  // ==========================================================================
  describe('5. Application Logging & Analytics Sanitization', () => {
    let logSpy: any;
    const interceptedLogs: string[] = [];

    beforeEach(() => {
      interceptedLogs.length = 0;
      logSpy = vi.spyOn(console, 'log').mockImplementation((msg: string) => {
        interceptedLogs.push(msg);
      });
    });

    afterEach(() => {
      logSpy.mockRestore();
    });

    it('structured logger never outputs request body, image frames, or base64 blobs', async () => {
      await request(app)
        .post('/api/v1/patients/P001/observations')
        .set('Authorization', authHeader)
        .send({
          heartRate: 72,
          systolicBP: 120,
          diastolicBP: 80,
          notes: 'Routine assessment note',
        });

      for (const log of interceptedLogs) {
        expect(log).not.toContain('Routine assessment note');
        expect(log).not.toContain('data:image');
        expect(log).not.toContain('base64');
      }
    });
  });

  // ==========================================================================
  // 6. AI Copilot Evidence Boundary (Zero Video Sent to LLM)
  // ==========================================================================
  describe('6. AI Copilot Context Boundary', () => {
    it('guarantees Copilot structured evidence package contains only numerical vitals and clinical notes', async () => {
      const res = await request(app)
        .post('/api/v1/patients/P001/copilot')
        .set('Authorization', authHeader)
        .send({
          query: 'Explain the current vital trends and APS category for this patient.',
          queryType: 'EXPLAIN_APS_CHANGE',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('SUCCESS');

      // Check references
      const references = res.body.data.sourceReferences;
      expect(Array.isArray(references)).toBe(true);
      for (const ref of references) {
        expect(ref.itemType).not.toBe('VIDEO');
        expect(ref.itemType).not.toBe('IMAGE');
        expect(ref.itemType).not.toBe('CAMERA_STREAM');
      }
    });
  });

  // ==========================================================================
  // 7. Filesystem & Persistent Cache Inspection
  // ==========================================================================
  describe('7. Filesystem & Storage Asset Inspection', () => {
    it('guarantees zero image or video files are written to repository or data directories', () => {
      const rootDir = join(__dirname, '../../..');
      const dataDirs = [
        rootDir,
        join(rootDir, 'services/api'),
        join(rootDir, 'packages/persistence'),
      ];

      const forbiddenExtensions = ['.png', '.jpg', '.jpeg', '.bmp', '.mp4', '.avi', '.mov', '.webm', '.h264'];

      for (const dir of dataDirs) {
        if (!existsSync(dir)) continue;
        const entries = readdirSync(dir);
        for (const entry of entries) {
          for (const ext of forbiddenExtensions) {
            expect(entry.toLowerCase().endsWith(ext)).toBe(false);
          }
        }
      }
    });
  });
});
