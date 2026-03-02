import WebSocket from 'ws';
import type { Device, PumpStatus } from '../types.js';
import { logService } from './LogService.js';

interface DeviceConnection {
  device: Device;
  ws: WebSocket | null;
  connected: boolean;
  lastStatus: PumpStatus | null;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  reconnectAttempts: number;
}

type StatusCallback = (deviceId: string, status: PumpStatus) => void;
type ConnectionCallback = (deviceId: string, connected: boolean) => void;

const RECONNECT_INTERVAL = 5000;
const MAX_RECONNECT_ATTEMPTS = 0; // 0 = unlimited

export class DeviceConnectionManager {
  private connections: Map<string, DeviceConnection> = new Map();
  private statusCallbacks: StatusCallback[] = [];
  private connectionCallbacks: ConnectionCallback[] = [];

  onStatus(callback: StatusCallback): void {
    this.statusCallbacks.push(callback);
  }

  onConnection(callback: ConnectionCallback): void {
    this.connectionCallbacks.push(callback);
  }

  private emitStatus(deviceId: string, status: PumpStatus): void {
    for (const cb of this.statusCallbacks) {
      cb(deviceId, status);
    }
  }

  private emitConnection(deviceId: string, connected: boolean): void {
    for (const cb of this.connectionCallbacks) {
      cb(deviceId, connected);
    }
  }

  addDevice(device: Device): void {
    if (this.connections.has(device.id)) {
      this.removeDevice(device.id);
    }
    const conn: DeviceConnection = {
      device,
      ws: null,
      connected: false,
      lastStatus: null,
      reconnectTimer: null,
      reconnectAttempts: 0,
    };
    this.connections.set(device.id, conn);
    this.connect(device.id);
  }

  removeDevice(deviceId: string): void {
    const conn = this.connections.get(deviceId);
    if (conn) {
      if (conn.reconnectTimer) {
        clearTimeout(conn.reconnectTimer);
      }
      if (conn.ws) {
        conn.ws.removeAllListeners();
        conn.ws.close();
      }
      this.connections.delete(deviceId);
    }
  }

  updateDevice(device: Device): void {
    const conn = this.connections.get(device.id);
    if (conn) {
      const ipChanged = conn.device.ip !== device.ip || conn.device.port !== device.port;
      conn.device = device;
      if (ipChanged) {
        // Reconnect if IP changed
        if (conn.ws) {
          conn.ws.removeAllListeners();
          conn.ws.close();
        }
        conn.connected = false;
        conn.reconnectAttempts = 0;
        this.connect(device.id);
      }
    } else {
      this.addDevice(device);
    }
  }

  private connect(deviceId: string): void {
    const conn = this.connections.get(deviceId);
    if (!conn) return;

    const url = `ws://${conn.device.ip}:${conn.device.port}/ws`;
    console.log(`[DeviceManager] Connecting to device ${conn.device.name} at ${url}`);

    try {
      const ws = new WebSocket(url, { handshakeTimeout: 5000 });
      conn.ws = ws;

      ws.on('open', () => {
        console.log(`[DeviceManager] Connected to device ${conn.device.name}`);
        conn.connected = true;
        conn.reconnectAttempts = 0;
        this.emitConnection(deviceId, true);
        logService.addLog(deviceId, conn.device.name, 'device_connected', {
          ip: conn.device.ip,
          port: conn.device.port,
        });
        // Request motor list on connect
        ws.send(JSON.stringify({ cmd: 'list' }));
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === 'status') {
            conn.lastStatus = message as PumpStatus;
            this.emitStatus(deviceId, message as PumpStatus);
          }
          // list responses are also forwarded via status callback (they have type: 'list')
          if (message.type === 'list') {
            // Forward list responses too
            this.emitStatus(deviceId, message);
          }
        } catch (e) {
          console.error(`[DeviceManager] Error parsing message from ${conn.device.name}:`, e);
        }
      });

      ws.on('close', () => {
        console.log(`[DeviceManager] Disconnected from device ${conn.device.name}`);
        const wasConnected = conn.connected;
        conn.connected = false;
        conn.ws = null;
        if (wasConnected) {
          this.emitConnection(deviceId, false);
          logService.addLog(deviceId, conn.device.name, 'device_disconnected');
        }
        this.scheduleReconnect(deviceId);
      });

      ws.on('error', (error) => {
        console.error(`[DeviceManager] WebSocket error for ${conn.device.name}:`, error.message);
        // close event will handle reconnection
      });
    } catch (error) {
      console.error(`[DeviceManager] Failed to create WebSocket for ${conn.device.name}:`, error);
      this.scheduleReconnect(deviceId);
    }
  }

  private scheduleReconnect(deviceId: string): void {
    const conn = this.connections.get(deviceId);
    if (!conn) return;

    if (conn.reconnectTimer) {
      clearTimeout(conn.reconnectTimer);
    }

    if (MAX_RECONNECT_ATTEMPTS > 0 && conn.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.log(`[DeviceManager] Max reconnect attempts reached for ${conn.device.name}`);
      return;
    }

    conn.reconnectAttempts++;
    conn.reconnectTimer = setTimeout(() => {
      if (this.connections.has(deviceId)) {
        this.connect(deviceId);
      }
    }, RECONNECT_INTERVAL);
  }

  sendCommand(deviceId: string, payload: Record<string, unknown>): boolean {
    const conn = this.connections.get(deviceId);
    if (!conn || !conn.ws || conn.ws.readyState !== WebSocket.OPEN) {
      return false;
    }
    try {
      conn.ws.send(JSON.stringify(payload));
      // Log the command
      logService.addLog(deviceId, conn.device.name, payload.cmd as string || 'unknown', payload);
      return true;
    } catch (error) {
      console.error(`[DeviceManager] Error sending command to ${conn.device.name}:`, error);
      logService.addLog(
        deviceId,
        conn.device.name,
        payload.cmd as string || 'unknown',
        payload,
        'error'
      );
      return false;
    }
  }

  getDeviceStatus(deviceId: string): { connected: boolean; lastStatus: PumpStatus | null } {
    const conn = this.connections.get(deviceId);
    if (!conn) {
      return { connected: false, lastStatus: null };
    }
    return { connected: conn.connected, lastStatus: conn.lastStatus };
  }

  getAllStatuses(): Record<string, { connected: boolean; lastStatus: PumpStatus | null }> {
    const result: Record<string, { connected: boolean; lastStatus: PumpStatus | null }> = {};
    for (const [deviceId, conn] of this.connections) {
      result[deviceId] = {
        connected: conn.connected,
        lastStatus: conn.lastStatus,
      };
    }
    return result;
  }

  disconnectAll(): void {
    for (const deviceId of this.connections.keys()) {
      this.removeDevice(deviceId);
    }
  }
}

export const deviceConnectionManager = new DeviceConnectionManager();
