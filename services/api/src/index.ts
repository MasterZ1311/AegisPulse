import dotenv from 'dotenv';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { createApp } from './app';
import { AegisPulseWebSocketServer } from './stream/websocket-server';
import { wardStateService } from './services/ward-state.service';
import { getConfig, ConfigurationError } from './config/env';

// Load .env from current working directory or repository root if present
if (process.env.SKIP_DOTENV !== 'true') {
  dotenv.config();
  const rootEnv = resolve(process.cwd(), '.env');
  if (existsSync(rootEnv)) {
    dotenv.config({ path: rootEnv });
  }
  const parentEnv = resolve(process.cwd(), '../../.env');
  if (existsSync(parentEnv)) {
    dotenv.config({ path: parentEnv });
  }
}

let config;
try {
  config = getConfig();
} catch (err) {
  if (err instanceof ConfigurationError) {
    console.error('\n================================================================================');
    console.error('FATAL: AegisPulse Configuration Validation Failed');
    console.error('================================================================================');
    console.error(err.message);
    console.error('================================================================================\n');
    process.exit(1);
  }
  throw err;
}

const PORT = config.port;
const HOST = config.host;

const app = createApp();

const server = app.listen(PORT, HOST, () => {
  console.log(`[AegisPulse API] Service active on http://${HOST}:${PORT}`);
  console.log(`[AegisPulse API] Health Check: http://${HOST}:${PORT}/health`);
  console.log(`[AegisPulse API] Readiness Check: http://${HOST}:${PORT}/ready`);
  console.log(`[AegisPulse API] WebSocket Stream: ws://${HOST}:${PORT}/api/v1/stream/ws`);
  console.log(`[AegisPulse API] SSE Stream: http://${HOST}:${PORT}/api/v1/stream/sse`);
});

const wsServer = new AegisPulseWebSocketServer(server);

let isShuttingDown = false;

// Graceful Shutdown with Force Exit Timeout
async function handleShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`[AegisPulse API] Received ${signal}. Initiating graceful shutdown...`);

  // Force termination fallback after 10s
  const forceTimer = setTimeout(() => {
    console.error('[AegisPulse API] Graceful shutdown timed out after 10s. Forcing exit.');
    process.exit(1);
  }, 10000);

  if (forceTimer.unref) {
    forceTimer.unref();
  }

  try {
    // 1. Close active WebSocket connections
    await wsServer.close();
    console.log('[AegisPulse API] WebSocket server closed.');

    // 2. Stop accepting new HTTP requests and finish in-flight
    await new Promise<void>((resolve) => server.close(() => resolve()));
    console.log('[AegisPulse API] HTTP server closed.');

    // 3. Cleanly checkpoint and close SQLite database connection
    wardStateService.close();
    console.log('[AegisPulse API] SQLite database cleanly checkpointed and closed.');

    clearTimeout(forceTimer);
    console.log('[AegisPulse API] Graceful shutdown complete. Exiting process.');
    process.exit(0);
  } catch (err) {
    console.error('[AegisPulse API] Error during shutdown:', err);
    process.exit(1);
  }
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

process.on('uncaughtException', (err) => {
  console.error('[AegisPulse API FATAL] Uncaught Exception:', err);
  handleShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason) => {
  console.error('[AegisPulse API FATAL] Unhandled Rejection:', reason);
});

