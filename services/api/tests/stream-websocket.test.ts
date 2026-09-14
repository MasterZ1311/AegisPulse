import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { WebSocket } from 'ws';
import { createApp } from '../src/app';
import { AegisPulseWebSocketServer } from '../src/stream/websocket-server';
import { EventBroadcaster } from '../src/stream/event-broadcaster';

describe('Real-Time WebSocket Telemetry Stream Protocol', () => {
  let server: http.Server;
  let wsServer: AegisPulseWebSocketServer;
  let broadcaster: EventBroadcaster;
  let port: number;
  let wsUrl: string;

  beforeAll(async () => {
    broadcaster = new EventBroadcaster({ bufferCapacity: 100 });
    const app = createApp();
    server = http.createServer(app);

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address() as any;
        port = addr.port;
        wsUrl = `ws://localhost:${port}/api/v1/stream/ws`;
        wsServer = new AegisPulseWebSocketServer(server, {
          heartbeatIntervalMs: 200, // Fast heartbeat for test
        }, broadcaster);
        resolve();
      });
    });
  });

  afterAll(async () => {
    await wsServer.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('establishes WebSocket connection and receives CONNECTED handshake message', async () => {
    const ws = new WebSocket(wsUrl);

    const message = await new Promise<any>((resolve) => {
      ws.on('message', (raw) => {
        resolve(JSON.parse(raw.toString()));
      });
    });

    expect(message.type).toBe('CONNECTED');
    expect(message).toHaveProperty('clientId');
    expect(message).toHaveProperty('serverTimestamp');
    expect(message).toHaveProperty('currentSequenceNumber');
    expect(message.heartbeatIntervalMs).toBe(200);

    ws.close();
  });

  it('receives broadcast events in strict sequence ordering with monotonic sequence numbers', async () => {
    const ws = new WebSocket(wsUrl);

    await new Promise<void>((resolve) => {
      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'CONNECTED') resolve();
      });
    });

    const receivedEvents: any[] = [];
    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'EVENT') {
        receivedEvents.push(msg.envelope);
      }
    });

    // Broadcast 3 events
    broadcaster.broadcast({
      eventId: 'evt-test-1',
      eventType: 'OBSERVATION_UPDATED',
      wardId: 'WARD-A',
      patientId: 'P001',
      data: { heartRate: 75 },
    });

    broadcaster.broadcast({
      eventId: 'evt-test-2',
      eventType: 'APS_UPDATED',
      wardId: 'WARD-A',
      patientId: 'P001',
      data: { apsScore: 45 },
    });

    broadcaster.broadcast({
      eventId: 'evt-test-3',
      eventType: 'PRIORITY_CHANGED',
      wardId: 'WARD-A',
      patientId: 'P001',
      data: { previousCategory: 'NORMAL', newCategory: 'WATCH' },
    });

    await new Promise((r) => setTimeout(r, 100));

    expect(receivedEvents.length).toBe(3);
    expect(receivedEvents[0].eventType).toBe('OBSERVATION_UPDATED');
    expect(receivedEvents[1].eventType).toBe('APS_UPDATED');
    expect(receivedEvents[2].eventType).toBe('PRIORITY_CHANGED');

    // Verify monotonic sequence numbering
    expect(receivedEvents[1].seq).toBe(receivedEvents[0].seq + 1);
    expect(receivedEvents[2].seq).toBe(receivedEvents[1].seq + 1);

    ws.close();
  });

  it('suppresses duplicate events with identical eventId', async () => {
    const ws = new WebSocket(wsUrl);

    await new Promise<void>((resolve) => {
      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'CONNECTED') resolve();
      });
    });

    const events: any[] = [];
    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'EVENT') events.push(msg.envelope);
    });

    // Send event with same ID twice
    const first = broadcaster.broadcast({
      eventId: 'dup-id-001',
      eventType: 'OBSERVATION_UPDATED',
      data: { heartRate: 80 },
    });

    const second = broadcaster.broadcast({
      eventId: 'dup-id-001',
      eventType: 'OBSERVATION_UPDATED',
      data: { heartRate: 80 },
    });

    expect(first).not.toBeNull();
    expect(second).toBeNull(); // Deduplicated by broadcaster!

    await new Promise((r) => setTimeout(r, 100));
    const matching = events.filter((e) => e.eventId === 'dup-id-001');
    expect(matching.length).toBe(1);

    ws.close();
  });

  it('recovers missed events on reconnect using lastSequenceNumber (Replay Batch)', async () => {
    // Current sequence from previous tests
    const currentSeq = broadcaster.getCurrentSequence();

    // Broadcast 2 new events
    broadcaster.broadcast({
      eventId: 'evt-missed-1',
      eventType: 'OBSERVATION_UPDATED',
      wardId: 'WARD-A',
      data: { heartRate: 99 },
    });

    broadcaster.broadcast({
      eventId: 'evt-missed-2',
      eventType: 'APS_UPDATED',
      wardId: 'WARD-A',
      data: { apsScore: 88 },
    });

    // New client connects and requests recovery from currentSeq
    const ws = new WebSocket(wsUrl);

    const replayBatchPromise = new Promise<any>((resolve) => {
      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'CONNECTED') {
          // Subscribe with lastSequenceNumber
          ws.send(
            JSON.stringify({
              type: 'SUBSCRIBE',
              wardId: 'WARD-A',
              lastSequenceNumber: currentSeq,
            })
          );
        } else if (msg.type === 'REPLAY_BATCH') {
          resolve(msg);
        }
      });
    });

    const batch = await replayBatchPromise;
    expect(batch.type).toBe('REPLAY_BATCH');
    expect(batch.fromSequenceNumber).toBe(currentSeq + 1);
    expect(batch.events.length).toBe(2);
    expect(batch.events[0].eventId).toBe('evt-missed-1');
    expect(batch.events[1].eventId).toBe('evt-missed-2');

    ws.close();
  });

  it('sends SNAPSHOT when client connects without prior sequence or after buffer overrun', async () => {
    const ws = new WebSocket(wsUrl);

    const snapshotPromise = new Promise<any>((resolve) => {
      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'CONNECTED') {
          ws.send(
            JSON.stringify({
              type: 'REQUEST_SNAPSHOT',
              wardId: 'WARD-A',
            })
          );
        } else if (msg.type === 'SNAPSHOT') {
          resolve(msg);
        }
      });
    });

    const snapshot = await snapshotPromise;
    expect(snapshot.type).toBe('SNAPSHOT');
    expect(snapshot.wardId).toBe('WARD-A');
    expect(Array.isArray(snapshot.radar)).toBe(true);
    expect(snapshot.radar.length).toBe(6);
    expect(Array.isArray(snapshot.patients)).toBe(true);
    expect(snapshot.patients.length).toBe(6);

    ws.close();
  });

  it('detects and terminates stale connections missing heartbeats', async () => {
    const ws = new WebSocket(wsUrl);

    let clientId = '';
    await new Promise<void>((resolve) => {
      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'CONNECTED') {
          clientId = msg.clientId;
          resolve();
        }
      });
    });

    const sessions = wsServer.getClients();
    expect(sessions.length).toBeGreaterThan(0);
    const targetSession = sessions.find((s) => s.id === clientId);
    expect(targetSession).toBeDefined();

    // Simulate stale unresponsiveness: client missed previous heartbeat
    targetSession!.isAlive = false;

    const closePromise = new Promise<void>((resolve) => {
      ws.on('close', () => resolve());
    });

    // Run heartbeat check -> detects isAlive === false and terminates dead socket
    wsServer.checkHeartbeats();

    await closePromise;
    expect(ws.readyState).toBe(WebSocket.CLOSED);
  });
});
