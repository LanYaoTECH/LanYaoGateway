const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

const port = process.env.PORT || 3000;

function requestId() {
  return crypto.randomBytes(8).toString('hex');
}

function success(res, data = {}, message = 'success') {
  res.json({ code: 0, message, data, requestId: requestId() });
}

function error(res, code = 9000, message = 'error') {
  res.json({ code, message, data: {}, requestId: requestId() });
}

// Health
app.get('/ping', (req, res) => {
  return success(res, { now: new Date().toISOString() }, 'pong');
});

// Auth
app.post('/api/v1/auth/login', (req, res) => {
  const { username } = req.body || {};
  const user = {
    id: 1,
    username: username || 'admin',
    role: 'ADMIN'
  };
  return success(res, {
    accessToken: 'mock-jwt-token',
    refreshToken: 'mock-refresh-token',
    expiresIn: 7200,
    user
  });
});

app.post('/api/v1/auth/logout', (req, res) => {
  res.json({ code: 0, message: 'logout success', data: {}, requestId: requestId() });
});

// Devices list
app.get('/api/v1/devices', (req, res) => {
  const list = [
    {
      id: 'dev-001',
      name: '设备01',
      type: 'SWITCH',
      status: 'ONLINE',
      ip: '192.168.1.1',
      lastHeartbeat: new Date().toISOString()
    }
  ];
  return success(res, { list, total: list.length });
});

// Device status
app.get('/api/v1/devices/:id/status', (req, res) => {
  const { id } = req.params;
  return success(res, {
    cpuUsage: 35.6,
    memoryUsage: 62.1,
    diskUsage: 48.9,
    online: true,
    deviceId: id
  });
});

// Device action: reboot
app.post('/api/v1/devices/:id/actions/reboot', (req, res) => {
  const { id } = req.params;
  const { reason } = req.body || {};
  // No real action, just return a mocked operation id
  return success(res, { operationId: `op-${Date.now()}`, deviceId: id, reason: reason || '' }, 'reboot scheduled');
});

// Logs
app.get('/api/v1/logs/operations', (req, res) => {
  const list = [
    {
      id: 1001,
      userId: 1,
      username: 'admin',
      action: 'LOGIN',
      target: 'SYSTEM',
      result: 'SUCCESS',
      ip: '192.168.1.100',
      createdAt: new Date().toISOString()
    }
  ];
  return success(res, { list, total: 1 });
});

app.listen(port, () => {
  console.log(`LanYao mock server listening at http://localhost:${port}`);
});
