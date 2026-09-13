import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { WebSocketServer, WebSocket } from 'ws';
import { patientsRouter } from './routes/patients.js';
import { vitalsRouter } from './routes/vitals.js';
import { labsRouter } from './routes/labs.js';
import { alertsRouter } from './routes/alerts.js';
import { copilotRouter } from './routes/copilot.js';
import { settingsRouter } from './routes/settings.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: '*' }));
app.use(express.json());

// API Routes
app.use('/api/patients', patientsRouter);
app.use('/api/vitals', vitalsRouter);
app.use('/api/labs', labsRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/copilot', copilotRouter);
app.use('/api/settings', settingsRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    system: 'AegisPulse Clinical Telemetry Backend',
    timestamp: new Date().toISOString(),
  });
});

// Create HTTP Server & WebSocket Server
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws: WebSocket) => {
  console.log('[WebSocket] Clinical Terminal Connected');

  ws.on('message', (message: string) => {
    try {
      const data = JSON.parse(message.toString());
      // Broadcast live vitals or triage alerts to all connected nurse stations
      wss.clients.forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(data));
        }
      });
    } catch (e) {
      // ignore malformed packets
    }
  });

  ws.on('close', () => {
    console.log('[WebSocket] Clinical Terminal Disconnected');
  });
});

server.listen(PORT, () => {
  console.log(`[AegisPulse] Production Backend Server running on http://localhost:${PORT}`);
  console.log(`[AegisPulse] WebSocket Telemetry Stream active on ws://localhost:${PORT}`);
});
