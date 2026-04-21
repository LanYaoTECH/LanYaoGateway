import { Router, type Request, type Response } from 'express';
import { getDatabase } from '../database.js';
import { deviceConnectionManager } from '../services/DeviceConnectionManager.js';
import { logService } from '../services/LogService.js';
import type { Device, DeviceCreateInput, DeviceUpdateInput } from '../types.js';

const router = Router();

// GET /api/devices - List all devices with connection status
router.get('/', (_req: Request, res: Response) => {
  const db = getDatabase();
  const devices = db.prepare('SELECT * FROM devices ORDER BY created_at DESC').all() as Device[];
  const statuses = deviceConnectionManager.getAllStatuses();

  const result = devices.map((d) => ({
    ...d,
    connected: statuses[d.id]?.connected ?? false,
    lastStatus: statuses[d.id]?.lastStatus ?? null,
  }));

  res.json(result);
});

// GET /api/devices/:id - Get single device
router.get('/:id', (req: Request, res: Response) => {
  const db = getDatabase();
  const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(req.params.id) as Device | undefined;

  if (!device) {
    res.status(404).json({ error: '设备不存在' });
    return;
  }

  const status = deviceConnectionManager.getDeviceStatus(device.id);
  res.json({ ...device, ...status });
});

// POST /api/devices - Add new device
router.post('/', (req: Request, res: Response) => {
  const { name, type = 'pump', ip, port = 80 } = req.body as DeviceCreateInput;

  if (!name || !ip) {
    res.status(400).json({ error: '设备名称和IP地址不能为空' });
    return;
  }
  if (type !== 'pump' && type !== 'treadmill') {
    res.status(400).json({ error: `不支持的设备类型: ${type}` });
    return;
  }

  const db = getDatabase();
  const id = crypto.randomUUID();

  db.prepare(`
    INSERT INTO devices (id, name, type, ip, port)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, name, type, ip, port);

  const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(id) as Device;

  // Start connection to the device
  deviceConnectionManager.addDevice(device);

  logService.addLog(id, name, 'device_added', { type, ip, port });
  res.status(201).json(device);
});

// PUT /api/devices/:id - Update device
router.put('/:id', (req: Request, res: Response) => {
  const db = getDatabase();
  const existing = db.prepare('SELECT * FROM devices WHERE id = ?').get(req.params.id) as Device | undefined;

  if (!existing) {
    res.status(404).json({ error: '设备不存在' });
    return;
  }

  const { name, ip, port } = req.body as DeviceUpdateInput;
  const updates: string[] = [];
  const values: unknown[] = [];

  if (name !== undefined) { updates.push('name = ?'); values.push(name); }
  if (ip !== undefined) { updates.push('ip = ?'); values.push(ip); }
  if (port !== undefined) { updates.push('port = ?'); values.push(port); }

  if (updates.length === 0) {
    res.status(400).json({ error: '没有提供更新字段' });
    return;
  }

  updates.push("updated_at = datetime('now', 'localtime')");
  values.push(req.params.id);

  db.prepare(`UPDATE devices SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  const updated = db.prepare('SELECT * FROM devices WHERE id = ?').get(req.params.id) as Device;

  // Update connection
  deviceConnectionManager.updateDevice(updated);

  logService.addLog(updated.id, updated.name, 'device_updated', { name, ip, port });
  res.json(updated);
});

// DELETE /api/devices/:id - Delete device
router.delete('/:id', (req: Request, res: Response) => {
  const db = getDatabase();
  const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(req.params.id) as Device | undefined;

  if (!device) {
    res.status(404).json({ error: '设备不存在' });
    return;
  }

  // Disconnect first
  deviceConnectionManager.removeDevice(device.id);

  // 先记日志 (此时 FK 仍有效), 再删设备
  logService.addLog(device.id, device.name, 'device_deleted');
  db.prepare('DELETE FROM devices WHERE id = ?').run(req.params.id);

  res.json({ message: '设备已删除', id: device.id });
});

// POST /api/devices/:id/command - Send command to device
router.post('/:id/command', (req: Request, res: Response) => {
  const db = getDatabase();
  const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(req.params.id) as Device | undefined;

  if (!device) {
    res.status(404).json({ error: '设备不存在' });
    return;
  }

  const payload = req.body;
  if (!payload || !payload.cmd) {
    res.status(400).json({ error: '命令不能为空' });
    return;
  }

  const success = deviceConnectionManager.sendCommand(device.id, payload);
  if (success) {
    res.json({ success: true, message: '命令已发送' });
  } else {
    res.status(503).json({ success: false, error: '设备未连接' });
  }
});

// GET /api/devices/:id/status - Get device connection status
router.get('/:id/status', (req: Request, res: Response) => {
  const status = deviceConnectionManager.getDeviceStatus(req.params.id as string);
  res.json(status);
});

export default router;
