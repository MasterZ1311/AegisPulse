import { Router, Request, Response } from 'express';
import type { TelemetryStreamEnvelope } from '@aegispulse/types';
import { eventBroadcaster } from './event-broadcaster';

export const sseRouter = Router();

sseRouter.get('/stream/sse', (req: Request, res: Response) => {
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

  const wardId = req.query.wardId as string | undefined;
  const patientId = req.query.patientId as string | undefined;

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
