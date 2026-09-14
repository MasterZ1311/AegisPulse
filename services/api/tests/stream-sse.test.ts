import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { createApp } from '../src/app';
import { eventBroadcaster } from '../src/stream/event-broadcaster';

describe('Server-Sent Events (SSE) Fallback Stream', () => {
  let server: http.Server;
  let port: number;

  beforeAll(async () => {
    const app = createApp();
    server = http.createServer(app);

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address() as any;
        port = addr.port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    server.closeAllConnections?.();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('connects to /api/v1/stream/sse and receives event stream headers and initial comment', async () => {
    const req = http.get(`http://localhost:${port}/api/v1/stream/sse`);

    const headersPromise = new Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; firstChunk: string }>((resolve) => {
      req.on('response', (res) => {
        res.once('data', (chunk) => {
          resolve({
            statusCode: res.statusCode || 0,
            headers: res.headers,
            firstChunk: chunk.toString(),
          });
          req.destroy();
        });
      });
    });

    const result = await headersPromise;
    expect(result.statusCode).toBe(200);
    expect(result.headers['content-type']).toContain('text/event-stream');
    expect(result.headers['cache-control']).toContain('no-cache');
    expect(result.firstChunk).toContain(': AegisPulse SSE Stream connected');
  });

  it('streams newly broadcast events formatted with id, event, and data lines', async () => {
    const req = http.get(`http://localhost:${port}/api/v1/stream/sse`);

    let buffer = '';
    let onDataCallback: (() => void) | null = null;

    await new Promise<void>((resolve) => {
      req.on('response', (res) => {
        res.on('data', (chunk) => {
          buffer += chunk.toString();
          if (buffer.includes('AegisPulse SSE Stream connected')) {
            resolve();
          }
          if (onDataCallback) {
            onDataCallback();
          }
        });
      });
    });

    const receivedPromise = new Promise<string>((resolve) => {
      const check = () => {
        if (buffer.includes('event: OBSERVATION_UPDATED') && buffer.includes('id:') && buffer.includes('\n\n')) {
          req.destroy();
          resolve(buffer);
        }
      };
      onDataCallback = check;
      check();
    });

    eventBroadcaster.broadcast({
      eventId: `sse-test-${Date.now()}`,
      eventType: 'OBSERVATION_UPDATED',
      wardId: 'WARD-A',
      patientId: 'P001',
      data: { heartRate: 82 },
    });

    const sseChunk = await receivedPromise;
    expect(sseChunk).toContain('id:');
    expect(sseChunk).toContain('event: OBSERVATION_UPDATED');
    expect(sseChunk).toContain('"heartRate":82');
  });

  it('replays missed events upon reconnect with Last-Event-ID header', async () => {
    const seqBefore = eventBroadcaster.getCurrentSequence();

    // Broadcast 2 events while client is disconnected
    eventBroadcaster.broadcast({
      eventId: 'sse-replay-1',
      eventType: 'APS_UPDATED',
      wardId: 'WARD-A',
      data: { apsScore: 50 },
    });

    eventBroadcaster.broadcast({
      eventId: 'sse-replay-2',
      eventType: 'PRIORITY_CHANGED',
      wardId: 'WARD-A',
      data: { newCategory: 'WATCH' },
    });

    // Reconnecting client provides Last-Event-ID: seqBefore
    const req = http.request(`http://localhost:${port}/api/v1/stream/sse`, {
      headers: {
        'Last-Event-ID': String(seqBefore),
      },
    });

    const receivedChunks: string[] = [];
    const replayPromise = new Promise<string>((resolve) => {
      req.on('response', (res) => {
        res.on('data', (chunk) => {
          receivedChunks.push(chunk.toString());
          const joined = receivedChunks.join('');
          if (joined.includes('sse-replay-1') && joined.includes('sse-replay-2')) {
            resolve(joined);
            req.destroy();
          }
        });
      });
    });

    req.end();

    const allReplayText = await replayPromise;
    expect(allReplayText).toContain('event: APS_UPDATED');
    expect(allReplayText).toContain('event: PRIORITY_CHANGED');
    expect(allReplayText).toContain('sse-replay-1');
    expect(allReplayText).toContain('sse-replay-2');
  });
});
