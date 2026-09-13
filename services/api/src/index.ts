import { createApp } from './app';

const PORT = process.env.PORT || 3001;

const app = createApp();

const server = app.listen(PORT, () => {
  console.log(`[AegisPulse API] Service active on http://localhost:${PORT}`);
  console.log(`[AegisPulse API] Health Check: http://localhost:${PORT}/health`);
});

// Graceful Shutdown
function handleShutdown(signal: string) {
  console.log(`[AegisPulse API] Received ${signal}. Closing HTTP server gracefully...`);
  server.close(() => {
    console.log('[AegisPulse API] HTTP server closed. Exiting process.');
    process.exit(0);
  });
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
