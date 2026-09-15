import { Router, Request, Response } from 'express';
import type { TelemetryStreamEnvelope } from '@aegispulse/types';
import { eventBroadcaster } from './event-broadcaster';
import { resolveUserFromToken } from '../middleware/auth';

export const sseRouter = Router();

let activeSseConnections = 0;
const MAX_SSE_CONNECTIONS = 500;

sseRouter.get('/stream/sse', (req: Request, res: Response) => {
  // Connection limit check
  if (activeSseConnections >= MAX_SSE_CONNECTIONS) {
    res.status(503).json({
      type: 'https://aegispulse.internal/errors/SERVICE_UNAVAILABLE',
      title: 'Stream Connection Limit Exceeded',
      status: 503,
      detail: 'Maximum concurrent SSE stream limit reached. Please retry later.',
    });
    return;
  }

  // Token resolution (query parameter or Authorization header)
  const authHeader = req.headers['authorization'];
  const token =
    (req.query.token as string) ||
    (authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : undefined);

  const user = token ? resolveUserFromToken(token) : undefined;

  if (process.env.NODE_ENV === 'production' && !user) {
    res.status(401).json({
      type: 'https://aegispulse.internal/errors/UNAUTHORIZED',
      title: 'Unauthorized',
      status: 401,
      detail: 'Authentication token required to connect to live telemetry stream.',
    });
    return;
  }

  const wardId = req.query.wardId as string | undefined;
  const patientId = req.query.patientId as string | undefined;

  // Ward authorization check
  if (wardId && user && !user.assignedWardIds.includes('*') && !user.assignedWardIds.includes(wardId)) {
    res.status(403).json({
      type: 'https://aegispulse.internal/errors/FORBIDDEN',
      title: 'Forbidden',
      status: 403,
      detail: `Unauthorized ward stream access: User '${user.username}' is not assigned to ward '${wardId}'.`,
    });
    return;
  }

  activeSseConnections++;

  // Set headers for SSE stream
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // Disable proxy buffering (Nginx)
  });

  res.flushHeaders?.();

  // Send initial connection comment
  res.write(`: AegisPulse SSE Stream connected at ${new Date().toISOString()}\n\n`);


  // Check for Last-Event-ID header (browser EventSource reconnection) or query param
  const rawLastId =
    (req.headers['last-event-id'] as string) ||
    (req.query.lastEventId as string) ||
    (req.query.lastSeq as string);

  if (rawLastId) {
    const lastSeq = parseInt(rawLastId, 10);
    if (!isNaN(lastSeq) && lastSeq > 0) {
      if (eventBroadcaster.isSequenceAvailable(lastSeq)) {
        const missed = eventBroadcaster.getEventsSince(lastSeq, { wardId, patientId });
        for (const ev of missed) {
          sendSseEvent(res, ev);
        }
      }
    }
  }

  // Event listener callback
  const onEvent = (envelope: TelemetryStreamEnvelope) => {
    // Channel filter
    if (wardId && envelope.wardId && envelope.wardId !== wardId) {
      return;
    }
    if (patientId && envelope.patientId && envelope.patientId !== patientId) {
      return;
    }

    sendSseEvent(res, envelope);
  };

  eventBroadcaster.on('event', onEvent);

  // Keep-alive heartbeat comment every 15s
  const keepAliveTimer = setInterval(() => {
    if (!res.writableEnded) {
      res.write(`:keepalive ${Date.now()}\n\n`);
    }
  }, 15000);

  // Cleanup on client disconnect
  req.on('close', () => {
    activeSseConnections = Math.max(0, activeSseConnections - 1);
    clearInterval(keepAliveTimer);
    eventBroadcaster.off('event', onEvent);
    if (!res.writableEnded) {
      res.end();
    }
  });
});


function sendSseEvent(res: Response, envelope: TelemetryStreamEnvelope): void {
  res.write(`id: ${envelope.seq}\nevent: ${envelope.eventType}\ndata: ${JSON.stringify(envelope)}\n\n`);
}
