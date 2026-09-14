import { createApp } from './app';
import { AegisPulseWebSocketServer } from './stream/websocket-server';

const PORT = process.env.PORT || 3001;

const app = createApp();

const server = app.listen(PORT, () => {
  console.log(`[AegisPulse API] Service active on http://localhost:${PORT}`);
  console.log(`[AegisPulse API] Health Check: http://localhost:${PORT}/health`);
  console.log(`[AegisPulse API] WebSocket Stream: ws://localhost:${PORT}/api/v1/stream/ws`);
  console.log(`[AegisPulse API] SSE Stream: http://localhost:${PORT}/api/v1/stream/sse`);
});

const wsServer = new AegisPulseWebSocketServer(server);

// Graceful Shutdown
function handleShutdown(signal: string) {
  console.log(`[AegisPulse API] Received ${signal}. Closing server gracefully...`);
  wsServer.close().finally(() => {
    server.close(() => {
      console.log('[AegisPulse API] HTTP & WS server closed. Exiting process.');
      process.exit(0);
    });
  });
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
