import type { Server as HttpServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import {
  type TelemetryStreamEnvelope,
  type ClientStreamMessage,
  type ServerStreamMessage,
  ClientStreamMessageSchema,
} from '@aegispulse/types';
import { eventBroadcaster, EventBroadcaster } from './event-broadcaster';
import { wardStateService } from '../services/ward-state.service';
import { resolveUserFromToken, type AuthenticatedUser } from '../middleware/auth';

export interface WebSocketServerOptions {
  path?: string;
  heartbeatIntervalMs?: number;
  maxBufferedAmount?: number;
  maxClients?: number;
}

interface ClientSession {
  id: string;
  ws: WebSocket;
  isAlive: boolean;
  user?: AuthenticatedUser;
  wardId?: string;
  patientId?: string;
  lastAcknowledgedSeq: number;
}

export class AegisPulseWebSocketServer {
  private wss: WebSocketServer;
  private clients: Map<WebSocket, ClientSession> = new Map();
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private readonly heartbeatIntervalMs: number;
  private readonly maxBufferedAmount: number;
  private readonly maxClients: number;
  private readonly broadcaster: EventBroadcaster;
  public readonly serverBootTimestamp: number = Date.now();
  public readonly serverInstanceId: string = `srv-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

  constructor(server: HttpServer, options: WebSocketServerOptions = {}, broadcaster: EventBroadcaster = eventBroadcaster) {
    this.broadcaster = broadcaster;
    this.heartbeatIntervalMs = options.heartbeatIntervalMs ?? 15000;
    this.maxBufferedAmount = options.maxBufferedAmount ?? 65536; // 64 KB safety backpressure limit
    this.maxClients = options.maxClients ?? 500; // Bound concurrent connections

    this.wss = new WebSocketServer({
      server,
      path: options.path ?? '/api/v1/stream/ws',
      maxPayload: 65536, // Strict 64 KB max payload per frame to prevent DoS
    });

    this.initialize();
  }


  private initialize(): void {
    this.wss.on('connection', (ws: WebSocket, req) => {
      // 1. Connection limit check to prevent resource exhaustion
      if (this.clients.size >= this.maxClients) {
        ws.close(1013, 'Server connection capacity reached');
        return;
      }

      const clientId = `client-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const session: ClientSession = {
        id: clientId,
        ws,
        isAlive: true,
        lastAcknowledgedSeq: 0,
      };

      // 2. Parse token and query params from upgrade request
      let token: string | undefined;
      let wardIdFromUrl: string | undefined;
      let lastSeqFromUrl: string | undefined;

      if (req.url) {
        try {
          const urlObj = new URL(req.url, 'http://localhost');
          token = urlObj.searchParams.get('token') || undefined;
          wardIdFromUrl = urlObj.searchParams.get('wardId') || undefined;
          lastSeqFromUrl = urlObj.searchParams.get('lastSeq') || undefined;
        } catch {
          // Ignore URL parse errors
        }
      }

      if (!token && req.headers['authorization']?.startsWith('Bearer ')) {
        token = req.headers['authorization'].substring(7).trim();
      }

      if (token) {
        const resolved = resolveUserFromToken(token);
        if (resolved) {
          session.user = resolved;
        } else if (process.env.NODE_ENV === 'production') {
          ws.close(4401, 'Invalid authentication token');
          return;
        }
      } else if (process.env.NODE_ENV === 'production') {
        ws.close(4401, 'Authentication token required for streaming');
        return;
      }

      if (wardIdFromUrl) {
        // Enforce ward access if user is authenticated
        if (session.user && !session.user.assignedWardIds.includes('*') && !session.user.assignedWardIds.includes(wardIdFromUrl)) {
          ws.close(4403, 'Unauthorized ward access');
          return;
        }
        session.wardId = wardIdFromUrl;
      }

      this.clients.set(ws, session);

      // Handle socket RFC 6455 pong
      ws.on('pong', () => {
        session.isAlive = true;
      });

      // Send initial welcome / handshake envelope
      const welcome: ServerStreamMessage = {
        type: 'CONNECTED',
        clientId,
        serverTimestamp: Date.now(),
        serverBootTimestamp: this.serverBootTimestamp,
        serverInstanceId: this.serverInstanceId,
        currentSequenceNumber: this.broadcaster.getCurrentSequence(),
        heartbeatIntervalMs: this.heartbeatIntervalMs,
      };
      this.sendToSocket(ws, welcome);

      if (lastSeqFromUrl) {
        const parsedSeq = parseInt(lastSeqFromUrl, 10);
        if (!isNaN(parsedSeq)) {
          this.handleClientRecovery(session, parsedSeq);
        }
      }

      // Handle incoming client messages
      ws.on('message', (rawData: Buffer | string) => {
        try {
          const text = rawData.toString();
          const json = JSON.parse(text);
          const parsed = ClientStreamMessageSchema.safeParse(json);
          if (!parsed.success) {
            this.sendToSocket(ws, {
              type: 'ERROR',
              code: 'INVALID_PROTOCOL_MESSAGE',
              message: parsed.error.issues.map((i) => i.message).join('; '),
            });
            return;
          }
          this.handleClientMessage(session, parsed.data);
        } catch (err: any) {
          this.sendToSocket(ws, {
            type: 'ERROR',
            code: 'MALFORMED_JSON',
            message: err?.message || 'Message must be valid JSON',
          });
        }
      });


      // Cleanup on socket close or error
      ws.on('close', () => {
        this.clients.delete(ws);
      });

      ws.on('error', () => {
        this.clients.delete(ws);
      });
    });

    // Start heartbeat interval for stale connection detection
    this.heartbeatTimer = setInterval(() => {
      this.checkHeartbeats();
    }, this.heartbeatIntervalMs);

    // Subscribe to broadcaster events to fan out to clients
    this.broadcaster.on('event', (envelope: TelemetryStreamEnvelope) => {
      this.broadcastEnvelope(envelope);
    });
  }

  /**
   * Heartbeat cycle: terminates dead/stale sockets and pings active ones
   */
  public checkHeartbeats(): void {
    for (const [ws, session] of this.clients.entries()) {
      if (!session.isAlive) {
        // Client missed previous ping: terminate dead/unresponsive socket
        this.clients.delete(ws);
        ws.terminate();
        continue;
      }

      // Mark unverified and send next ping
      session.isAlive = false;
      try {
        ws.ping();
      } catch {
        this.clients.delete(ws);
        ws.terminate();
      }
    }
  }

  /**
   * Handle application-level protocol messages from clients
   */
  private handleClientMessage(session: ClientSession, msg: ClientStreamMessage): void {
    switch (msg.type) {
      case 'SUBSCRIBE': {
        // Enforce ward authorization check if user session is authenticated
        if (msg.wardId && session.user && !session.user.assignedWardIds.includes('*') && !session.user.assignedWardIds.includes(msg.wardId)) {
          this.sendToSocket(session.ws, {
            type: 'ERROR',
            code: 'FORBIDDEN',
            message: `Unauthorized ward subscription: Clinician does not have jurisdiction over ward '${msg.wardId}'.`,
          });
          return;
        }

        session.wardId = msg.wardId;
        session.patientId = msg.patientId;

        if (msg.lastSequenceNumber !== undefined) {
          this.handleClientRecovery(session, msg.lastSequenceNumber);
        } else {
          // Send current ward snapshot
          this.sendSnapshot(session);
        }
        break;
      }

      case 'UNSUBSCRIBE': {
        session.wardId = undefined;
        session.patientId = undefined;
        break;
      }

      case 'PING': {
        const pong: ServerStreamMessage = {
          type: 'PONG',
          clientTimestamp: msg.timestamp,
          serverTimestamp: Date.now(),
          currentSequenceNumber: this.broadcaster.getCurrentSequence(),
        };
        this.sendToSocket(session.ws, pong);
        break;
      }

      case 'REQUEST_SNAPSHOT': {
        if (msg.wardId) {
          if (session.user && !session.user.assignedWardIds.includes('*') && !session.user.assignedWardIds.includes(msg.wardId)) {
            this.sendToSocket(session.ws, {
              type: 'ERROR',
              code: 'FORBIDDEN',
              message: `Unauthorized ward snapshot request for ward '${msg.wardId}'.`,
            });
            return;
          }
          session.wardId = msg.wardId;
        }
        this.sendSnapshot(session);
        break;
      }

      case 'ACKNOWLEDGE_ALERT': {
        const actingUserId = session.user?.userId || msg.userId || 'anonymous-ws-user';
        wardStateService.addAcknowledgement({
          id: `ack-ws-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          patientId: msg.patientId,
          alertId: msg.alertId,
          acknowledgedByUserId: actingUserId,
          acknowledgedAt: Date.now(),
          reason: msg.reason,
        });
        break;
      }
    }

  }

  /**
   * Client recovery logic:
   * Replays missed events if within replay buffer, otherwise sends full snapshot.
   */
  public handleClientRecovery(session: ClientSession, lastSeq: number): void {
    if (this.broadcaster.isSequenceAvailable(lastSeq)) {
      const missedEvents = this.broadcaster.getEventsSince(lastSeq, {
        wardId: session.wardId,
        patientId: session.patientId,
      });

      if (missedEvents.length > 0) {
        const replayMsg: ServerStreamMessage = {
          type: 'REPLAY_BATCH',
          fromSequenceNumber: lastSeq + 1,
          toSequenceNumber: missedEvents[missedEvents.length - 1].seq,
          events: missedEvents,
        };
        this.sendToSocket(session.ws, replayMsg);
      }
    } else {
      // Buffer overrun or ancient sequence: send fresh full snapshot
      this.sendSnapshot(session);
    }
  }

  /**
   * Generate and send a comprehensive Ward Snapshot
   */
  public sendSnapshot(session: ClientSession): void {
    try {
      const wardId = session.wardId || 'WARD-A';
      const patients = wardStateService.getPatients(wardId);

      const radar = patients.map((p) => {
        let activeState;
        try {
          activeState = wardStateService.getAttentionRepo().getActiveAttentionState(p.id);
        } catch {
          activeState = undefined;
        }
        return {
          patientId: p.id,
          bedNumber: p.bedNumber,
          apsScore: activeState?.score ?? 0,
          category: activeState?.category ?? 'NORMAL',
          topReason: activeState?.topReason ?? 'Stable vitals',
        };
      });

      const snapshot: ServerStreamMessage = {
        type: 'SNAPSHOT',
        wardId,
        timestamp: Date.now(),
        sequenceNumber: this.broadcaster.getCurrentSequence(),
        radar,
        patients,
      };

      this.sendToSocket(session.ws, snapshot);
    } catch (err: any) {
      this.sendToSocket(session.ws, {
        type: 'ERROR',
        code: 'SNAPSHOT_FAILED',
        message: err?.message || 'Failed to assemble ward snapshot',
      });
    }
  }

  /**
   * Fan out a newly published event to all matching subscribed clients
   */
  private broadcastEnvelope(envelope: TelemetryStreamEnvelope): void {
    for (const [ws, session] of this.clients.entries()) {
      // 1. Channel filtering
      if (session.wardId && envelope.wardId && envelope.wardId !== session.wardId) {
        continue;
      }
      if (session.patientId && envelope.patientId && envelope.patientId !== session.patientId) {
        continue;
      }

      // 2. Backpressure handling
      if (ws.bufferedAmount > this.maxBufferedAmount) {
        // High backpressure on slow client
        if (envelope.eventType === 'OBSERVATION_UPDATED') {
          // Drop high-frequency lossy vitals frame to alleviate backpressure
          continue;
        }

        if (ws.bufferedAmount > this.maxBufferedAmount * 8) {
          // Extreme backlog: terminate unviable connection
          this.clients.delete(ws);
          ws.close(1008, 'Backpressure threshold exceeded');
          continue;
        }
      }

      const msg: ServerStreamMessage = {
        type: 'EVENT',
        envelope,
      };

      this.sendToSocket(ws, msg);
    }
  }

  private sendToSocket(ws: WebSocket, msg: ServerStreamMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  public getConnectedClientCount(): number {
    return this.clients.size;
  }

  public getClients(): ClientSession[] {
    return Array.from(this.clients.values());
  }

  public getWebSocketServer(): WebSocketServer {
    return this.wss;
  }

  public close(): Promise<void> {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    for (const ws of this.clients.keys()) {
      try {
        ws.close(1000, 'Server shutting down');
      } catch {
        // Ignore
      }
    }
    this.clients.clear();

    return new Promise((resolve, reject) => {
      this.wss.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}
