import express from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { getDatabase, closeDatabase } from './database.js';
import { deviceConnectionManager } from './services/DeviceConnectionManager.js';
import { logService } from './services/LogService.js';
import devicesRouter from './routes/devices.js';
import logsRouter from './routes/logs.js';
import type { Device, FrontendMessage } from './types.js';

const PORT = parseInt(process.env.PORT || '3210', 10);

// ===== Express App =====
const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// API Routes
app.use('/api/devices', devicesRouter);
app.use('/api/logs', logsRouter);

// ===== HTTP Server =====
const server = http.createServer(app);

// ===== WebSocket Server (for frontend clients) =====
const wss = new WebSocketServer({ server, path: '/ws' });

// Track subscriptions: clientWs -> Set of deviceIds
const clientSubscriptions = new Map<WebSocket, Set<string>>();

wss.on('connection', (clientWs) => {
  console.log('[Gateway] Frontend client connected');
  clientSubscriptions.set(clientWs, new Set());

  clientWs.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString()) as FrontendMessage;

      switch (message.type) {
        case 'subscribe': {
          const subs = clientSubscriptions.get(clientWs);
          if (subs) {
            subs.add(message.deviceId);
            // Send current status immediately
            const status = deviceConnectionManager.getDeviceStatus(message.deviceId);
            clientWs.send(JSON.stringify({
              type: 'device_connection',
              deviceId: message.deviceId,
              connected: status.connected,
            }));
            if (status.lastStatus) {
              clientWs.send(JSON.stringify({
                type: 'device_status',
                deviceId: message.deviceId,
                data: status.lastStatus,
              }));
            }
          }
          break;
        }

        case 'unsubscribe': {
          const subs = clientSubscriptions.get(clientWs);
          if (subs) {
            subs.delete(message.deviceId);
          }
          break;
        }

        case 'command': {
          const success = deviceConnectionManager.sendCommand(
            message.deviceId,
            message.payload
          );
          clientWs.send(JSON.stringify({
            type: 'command_result',
            deviceId: message.deviceId,
            success,
            error: success ? null : '设备未连接',
          }));
          break;
        }
      }
    } catch (e) {
      console.error('[Gateway] Error processing frontend message:', e);
    }
  });

  clientWs.on('close', () => {
    console.log('[Gateway] Frontend client disconnected');
    clientSubscriptions.delete(clientWs);
  });
});

// Forward device status updates to subscribed frontend clients
deviceConnectionManager.onStatus((deviceId, status) => {
  const message = JSON.stringify({
    type: 'device_status',
    deviceId,
    data: status,
  });

  for (const [clientWs, subs] of clientSubscriptions) {
    if (subs.has(deviceId) && clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(message);
    }
  }
});

// Forward connection state changes to all frontend clients
deviceConnectionManager.onConnection((deviceId, connected) => {
  const message = JSON.stringify({
    type: 'device_connection',
    deviceId,
    connected,
  });

  for (const [clientWs] of clientSubscriptions) {
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(message);
    }
  }
});

// ===== Startup =====
function loadDevicesOnStartup(): void {
  const db = getDatabase();
  const devices = db.prepare('SELECT * FROM devices').all() as Device[];
  console.log(`[Gateway] Loading ${devices.length} devices from database`);

  for (const device of devices) {
    deviceConnectionManager.addDevice(device);
  }
}

server.listen(PORT, () => {
  console.log(`[Gateway] LanYao Gateway running on port ${PORT}`);
  console.log(`[Gateway] REST API: http://localhost:${PORT}/api`);
  console.log(`[Gateway] WebSocket: ws://localhost:${PORT}/ws`);
  loadDevicesOnStartup();
  logService.addLog(null, null, 'gateway_started', { port: PORT });
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('[Gateway] Shutting down...');
  deviceConnectionManager.disconnectAll();
  closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('[Gateway] Shutting down...');
  deviceConnectionManager.disconnectAll();
  closeDatabase();
  process.exit(0);
});
