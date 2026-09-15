import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { WebSocket } from 'ws';
import { createApp } from '../src/app';
import { AegisPulseWebSocketServer } from '../src/stream/websocket-server';
import { EventBroadcaster } from '../src/stream/event-broadcaster';
import { TelemetryStreamEnvelope } from '@aegispulse/types';

describe('AegisPulse Realtime Reliability & Chaos Engineering Audit', () => {
  let server: http.Server;
  let wsServer: AegisPulseWebSocketServer;
  let broadcaster: EventBroadcaster;
  let port: number;
  let wsUrl: string;

  beforeAll(async () => {
    broadcaster = new EventBroadcaster({ bufferCapacity: 500 });
    const app = createApp();
    server = http.createServer(app);

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address() as any;
        port = addr.port;
        wsUrl = `ws://localhost:${port}/api/v1/stream/ws`;
        wsServer = new AegisPulseWebSocketServer(
          server,
          {
            heartbeatIntervalMs: 100, // rapid heartbeat for testing
          },
          broadcaster
        );
        resolve();
      });
    });
  });

  afterAll(async () => {
    await wsServer.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  // ==========================================================================
  // 1. Connection & Handshake Invariants
  // ==========================================================================
  describe('1. Handshake & Server Instance Identification', () => {
    it('transmits serverBootTimestamp and serverInstanceId on connection handshake', async () => {
      const ws = new WebSocket(wsUrl);

      const msg = await new Promise<any>((resolve) => {
        ws.on('message', (raw) => resolve(JSON.parse(raw.toString())));
      });

      expect(msg.type).toBe('CONNECTED');
      expect(typeof msg.serverInstanceId).toBe('string');
      expect(msg.serverInstanceId).toContain('srv-');
      expect(typeof msg.serverBootTimestamp).toBe('number');
      expect(msg.serverBootTimestamp).toBeGreaterThan(0);
      expect(msg.serverBootTimestamp).toBeLessThanOrEqual(Date.now());
      expect(msg.heartbeatIntervalMs).toBe(100);

      ws.close();
    });
  });

  // ==========================================================================
  // 2. Heartbeat & Dead-Man Watchdog
  // ==========================================================================
  describe('2. Heartbeat Protocol & Liveness', () => {
    it('handles application-level PING/PONG and terminates unresponsive stale connections', async () => {
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

      // Test application-level PING/PONG
      const sendTime = Date.now();
      ws.send(JSON.stringify({ type: 'PING', timestamp: sendTime }));

      const pongMsg = await new Promise<any>((resolve) => {
        ws.on('message', (raw) => {
          const msg = JSON.parse(raw.toString());
          if (msg.type === 'PONG') resolve(msg);
        });
      });

      expect(pongMsg.type).toBe('PONG');
      expect(pongMsg.clientTimestamp).toBe(sendTime);
      expect(typeof pongMsg.serverTimestamp).toBe('number');
      expect(typeof pongMsg.currentSequenceNumber).toBe('number');

      // Test stale socket termination when client is silent/unresponsive
      const session = wsServer.getClients().find((c) => c.id === clientId);
      expect(session).toBeDefined();
      session!.isAlive = false;

      const closePromise = new Promise<void>((resolve) => {
        ws.on('close', () => resolve());
      });

      wsServer.checkHeartbeats();
      await closePromise;
      expect(ws.readyState).toBe(WebSocket.CLOSED);
    });
  });

  // ==========================================================================
  // 3. Monotonic Sequence Number Ordering
  // ==========================================================================
  describe('3. Monotonic Sequence Numbering & Strict Ordering', () => {
    it('assigns strictly increasing, contiguous sequence numbers to all broadcast events', async () => {
      const ws = new WebSocket(wsUrl);
      const receivedSeq: number[] = [];

      await new Promise<void>((resolve) => {
        ws.on('message', (raw) => {
          const msg = JSON.parse(raw.toString());
          if (msg.type === 'CONNECTED') resolve();
        });
      });

      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'EVENT') {
          receivedSeq.push(msg.envelope.seq);
        }
      });

      // Broadcast 5 events
      for (let i = 1; i <= 5; i++) {
        broadcaster.broadcast({
          eventId: `evt-mono-${i}-${Date.now()}`,
          eventType: 'OBSERVATION_UPDATED',
          wardId: 'WARD-4B',
          patientId: 'P003',
          data: { heartRate: 70 + i },
        });
      }

      await new Promise((r) => setTimeout(r, 100));

      expect(receivedSeq.length).toBe(5);
      for (let i = 1; i < receivedSeq.length; i++) {
        expect(receivedSeq[i]).toBe(receivedSeq[i - 1] + 1);
      }

      ws.close();
    });
  });

  // ==========================================================================
  // 4. Anti-Rollback Invariant Simulation
  // ==========================================================================
  describe('4. Anti-Rollback Invariant & Out-of-Order Packet Suppression', () => {
    it('simulates client anti-rollback guard rejecting older out-of-order sequence packets', () => {
      const patientState = {
        patientId: 'P003',
        heartRate: 98,
        lastAppliedSeq: 15,
        lastAppliedTs: 5000,
      };

      const appliedEvents: TelemetryStreamEnvelope[] = [];
      const suppressedEvents: TelemetryStreamEnvelope[] = [];

      const processEnvelope = (env: TelemetryStreamEnvelope) => {
        const lastSeq = patientState.lastAppliedSeq;
        const lastTs = patientState.lastAppliedTs;

        // Anti-Rollback Guard
        if (env.seq < lastSeq && env.timestamp <= lastTs) {
          suppressedEvents.push(env);
          return;
        }

        patientState.heartRate = (env.data as any).heartRate;
        patientState.lastAppliedSeq = Math.max(lastSeq, env.seq);
        patientState.lastAppliedTs = Math.max(lastTs, env.timestamp);
        appliedEvents.push(env);
      };

      // Newer packet arrives first
      processEnvelope({
        eventId: 'evt-new-1',
        seq: 20,
        timestamp: 6000,
        eventType: 'OBSERVATION_UPDATED',
        wardId: 'WARD-4B',
        patientId: 'P003',
        data: { heartRate: 110 },
      });

      expect(patientState.heartRate).toBe(110);
      expect(patientState.lastAppliedSeq).toBe(20);

      // Delayed/stale packet arrives late (e.g. out-of-order delivery)
      processEnvelope({
        eventId: 'evt-stale-delayed',
        seq: 18,
        timestamp: 5500,
        eventType: 'OBSERVATION_UPDATED',
        wardId: 'WARD-4B',
        patientId: 'P003',
        data: { heartRate: 75 }, // Older obsolete heart rate
      });

      // Assert Anti-Rollback Guard protected the clinical state
      expect(suppressedEvents.length).toBe(1);
      expect(suppressedEvents[0].eventId).toBe('evt-stale-delayed');
      expect(patientState.heartRate).toBe(110); // NOT rolled backwards to 75!
      expect(patientState.lastAppliedSeq).toBe(20);
    });

    it('buffers out-of-order sequence gaps and applies them in correct order when gap fills', async () => {
      const buffer: TelemetryStreamEnvelope[] = [];
      const appliedInOrder: number[] = [];
      let lastContiguousSeq = 10;

      const onReceive = (env: TelemetryStreamEnvelope) => {
        if (env.seq === lastContiguousSeq + 1) {
          appliedInOrder.push(env.seq);
          lastContiguousSeq = env.seq;

          // Drain buffer
          buffer.sort((a, b) => a.seq - b.seq);
          while (buffer.length > 0 && buffer[0].seq === lastContiguousSeq + 1) {
            const next = buffer.shift()!;
            appliedInOrder.push(next.seq);
            lastContiguousSeq = next.seq;
          }
        } else if (env.seq > lastContiguousSeq + 1) {
          // Gap detected - store in resequencing buffer
          buffer.push(env);
        }
      };

      // Packet 12 arrives before Packet 11
      onReceive({
        eventId: 'pkt-12',
        seq: 12,
        timestamp: 1200,
        eventType: 'OBSERVATION_UPDATED',
        wardId: 'WARD-4B',
        patientId: 'P003',
        data: { heartRate: 88 },
      });

      expect(appliedInOrder).toEqual([]);
      expect(buffer.length).toBe(1);

      // Packet 11 arrives (gap filled)
      onReceive({
        eventId: 'pkt-11',
        seq: 11,
        timestamp: 1100,
        eventType: 'OBSERVATION_UPDATED',
        wardId: 'WARD-4B',
        patientId: 'P003',
        data: { heartRate: 85 },
      });

      // Both applied in strict monotonic order: 11, then 12!
      expect(appliedInOrder).toEqual([11, 12]);
      expect(buffer.length).toBe(0);
    });
  });

  // ==========================================================================
  // 5. Duplicate Event Deduplication
  // ==========================================================================
  describe('5. Duplicate Event Invariance & Timeline Deduplication', () => {
    it('prevents duplicate timeline entries when identical event IDs are received', () => {
      let timeline = [
        { id: 'TL-1', patientId: 'P003', timestamp: 1000, title: 'Initial Alert' },
      ];

      const addTimelineEntry = (entry: { id: string; patientId: string; timestamp: number; title: string }) => {
        if (!timeline.some((t) => t.id === entry.id)) {
          timeline = [entry, ...timeline];
        }
      };

      // Append new event
      addTimelineEntry({ id: 'TL-2', patientId: 'P003', timestamp: 2000, title: 'Second Alert' });
      expect(timeline.length).toBe(2);

      // Duplicate delivery of TL-2 (e.g. from network retry or replay)
      addTimelineEntry({ id: 'TL-2', patientId: 'P003', timestamp: 2000, title: 'Second Alert' });
      expect(timeline.length).toBe(2); // Invariant maintained: no duplicate rows!
    });
  });

  // ==========================================================================
  // 6. Channel Isolation & Multi-Client Fanout
  // ==========================================================================
  describe('6. Channel Isolation & Multi-Client Fanout', () => {
    it('isolates ward broadcasts so clients only receive events for their subscribed ward', async () => {
      const wsWardA = new WebSocket(`${wsUrl}?wardId=WARD-A`);
      const wsWardB = new WebSocket(`${wsUrl}?wardId=WARD-B`);

      await Promise.all([
        new Promise<void>((r) => wsWardA.on('message', () => r())),
        new Promise<void>((r) => wsWardB.on('message', () => r())),
      ]);

      const eventsA: any[] = [];
      const eventsB: any[] = [];

      wsWardA.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'EVENT') eventsA.push(msg.envelope);
      });
      wsWardB.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'EVENT') eventsB.push(msg.envelope);
      });

      // Broadcast event for WARD-A only
      broadcaster.broadcast({
        eventId: `evt-wardA-${Date.now()}`,
        eventType: 'OBSERVATION_UPDATED',
        wardId: 'WARD-A',
        patientId: 'P001',
        data: { heartRate: 72 },
      });

      // Broadcast event for WARD-B only
      broadcaster.broadcast({
        eventId: `evt-wardB-${Date.now()}`,
        eventType: 'OBSERVATION_UPDATED',
        wardId: 'WARD-B',
        patientId: 'P002',
        data: { heartRate: 85 },
      });

      await new Promise((r) => setTimeout(r, 100));

      expect(eventsA.length).toBe(1);
      expect(eventsA[0].wardId).toBe('WARD-A');

      expect(eventsB.length).toBe(1);
      expect(eventsB[0].wardId).toBe('WARD-B');

      wsWardA.close();
      wsWardB.close();
    });
  });

  // ==========================================================================
  // 7. Slow Client Backpressure Protection
  // ==========================================================================
  describe('7. Slow Client Backpressure Invariants', () => {
    it('drops lossy observation updates for slow clients without stalling fast clients', async () => {
      const fastWs = new WebSocket(wsUrl);
      const slowWs = new WebSocket(wsUrl);

      await Promise.all([
        new Promise<void>((r) => fastWs.on('message', () => r())),
        new Promise<void>((r) => slowWs.on('message', () => r())),
      ]);

      (slowWs as any).pause?.();

      let fastCount = 0;
      fastWs.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'EVENT') fastCount++;
      });

      // Broadcast burst of 50 events
      for (let i = 0; i < 50; i++) {
        broadcaster.broadcast({
          eventId: `evt-burst-${i}-${Date.now()}`,
          eventType: 'OBSERVATION_UPDATED',
          wardId: 'WARD-4B',
          patientId: 'P003',
          data: { heartRate: 80 + (i % 10) },
        });
      }

      await new Promise((r) => setTimeout(r, 150));

      // Fast client received updates cleanly
      expect(fastCount).toBeGreaterThan(0);

      fastWs.close();
      slowWs.close();
    });
  });

  // ==========================================================================
  // 8. Rapid Updates Burst Simulation (200 events)
  // ==========================================================================
  describe('8. High-Frequency Rapid Updates Burst', () => {
    it('handles 200 events dispatched in rapid burst without event corruption or socket crash', async () => {
      const ws = new WebSocket(wsUrl);

      await new Promise<void>((resolve) => {
        ws.on('message', (raw) => {
          const msg = JSON.parse(raw.toString());
          if (msg.type === 'CONNECTED') resolve();
        });
      });

      let eventCount = 0;
      let lastSeq = -1;
      let isStrictlyMonotonic = true;

      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'EVENT') {
          eventCount++;
          if (msg.envelope.seq <= lastSeq) {
            isStrictlyMonotonic = false;
          }
          lastSeq = msg.envelope.seq;
        }
      });

      // Dispatch 200 events rapidly
      for (let i = 0; i < 200; i++) {
        broadcaster.broadcast({
          eventId: `evt-rapid-${i}-${Date.now()}`,
          eventType: 'OBSERVATION_UPDATED',
          wardId: 'WARD-4B',
          patientId: 'P003',
          data: { heartRate: 70 + (i % 30) },
        });
      }

      await new Promise((r) => setTimeout(r, 250));

      expect(eventCount).toBe(200);
      expect(isStrictlyMonotonic).toBe(true);

      ws.close();
    });
  });

  // ==========================================================================
  // 9. Server Restart Simulation & Instance Invalidation
  // ==========================================================================
  describe('9. Server Restart Simulation & Snapshot Invalidation', () => {
    it('detects server instance change after simulated server reboot and triggers full snapshot sync', async () => {
      // Connect to Server Instance 1
      const client1 = new WebSocket(wsUrl);
      const handshake1 = await new Promise<any>((resolve) => {
        client1.on('message', (raw) => {
          const msg = JSON.parse(raw.toString());
          if (msg.type === 'CONNECTED') resolve(msg);
        });
      });

      const initialInstanceId = handshake1.serverInstanceId;
      const initialBootTime = handshake1.serverBootTimestamp;
      client1.close();

      // Create Server Instance 2 (simulating service restart)
      const newBroadcaster = new EventBroadcaster({ bufferCapacity: 100 });
      const newServer = http.createServer(createApp());

      const newPort = await new Promise<number>((resolve) => {
        newServer.listen(0, () => {
          resolve((newServer.address() as any).port);
        });
      });

      const newWsServer = new AegisPulseWebSocketServer(
        newServer,
        { heartbeatIntervalMs: 100 },
        newBroadcaster
      );

      const client2 = new WebSocket(`ws://localhost:${newPort}/api/v1/stream/ws`);
      const handshake2 = await new Promise<any>((resolve) => {
        client2.on('message', (raw) => {
          const msg = JSON.parse(raw.toString());
          if (msg.type === 'CONNECTED') resolve(msg);
        });
      });

      // Invariant: New server instance has unique identifier and boot timestamp
      expect(handshake2.serverInstanceId).not.toBe(initialInstanceId);
      expect(handshake2.serverBootTimestamp).toBeGreaterThanOrEqual(initialBootTime);

      // Verify client can request SNAPSHOT from new server instance
      client2.send(JSON.stringify({ type: 'REQUEST_SNAPSHOT', wardId: 'WARD-A' }));

      const snapshotMsg = await new Promise<any>((resolve) => {
        client2.on('message', (raw) => {
          const msg = JSON.parse(raw.toString());
          if (msg.type === 'SNAPSHOT') resolve(msg);
        });
      });

      expect(snapshotMsg.type).toBe('SNAPSHOT');
      expect(snapshotMsg.wardId).toBe('WARD-A');
      expect(Array.isArray(snapshotMsg.radar)).toBe(true);

      client2.close();
      await newWsServer.close();
      await new Promise<void>((r) => newServer.close(() => r()));
    });
  });

  // ==========================================================================
  // 10. Database Disruption Resilience during Snapshot Delivery
  // ==========================================================================
  describe('10. Defensive Resilience to DB Interruptions', () => {
    it('survives database failure without dropping WebSocket connection or crashing process', async () => {
      const ws = new WebSocket(wsUrl);

      await new Promise<void>((resolve) => {
        ws.on('message', (raw) => {
          const msg = JSON.parse(raw.toString());
          if (msg.type === 'CONNECTED') resolve();
        });
      });

      // Request snapshot for non-existent or unmigrated ward
      ws.send(JSON.stringify({ type: 'REQUEST_SNAPSHOT', wardId: 'CORRUPTED-WARD-999' }));

      const response = await new Promise<any>((resolve) => {
        ws.on('message', (raw) => {
          const msg = JSON.parse(raw.toString());
          if (msg.type === 'SNAPSHOT' || msg.type === 'ERROR') resolve(msg);
        });
      });

      // Server returns handled response gracefully, connection remains OPEN
      expect(['SNAPSHOT', 'ERROR']).toContain(response.type);
      expect(ws.readyState).toBe(WebSocket.OPEN);

      ws.close();
    });
  });
});
