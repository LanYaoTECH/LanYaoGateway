import { getDatabase } from '../database.js';
import type { LogEntry, LogQueryParams, PaginatedLogs } from '../types.js';

export class LogService {
  addLog(
    deviceId: string | null,
    deviceName: string | null,
    action: string,
    details?: Record<string, unknown>,
    result: 'success' | 'error' = 'success'
  ): LogEntry | null {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO logs (device_id, device_name, action, details, result)
      VALUES (?, ?, ?, ?, ?)
    `);
    // 设备已被删除时 device_id 仍是 UUID 字符串, 但 devices 表已无此行,
    // 会触发 FK 约束失败. 兜底: 把 device_id 置 null 重试一次.
    try {
      const info = stmt.run(
        deviceId,
        deviceName,
        action,
        details ? JSON.stringify(details) : null,
        result
      );
      return this.getLogById(info.lastInsertRowid as number) ?? null;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('FOREIGN KEY')) {
        try {
          const info = stmt.run(
            null,
            deviceName,
            action,
            details ? JSON.stringify(details) : null,
            result
          );
          return this.getLogById(info.lastInsertRowid as number) ?? null;
        } catch (e2) {
          console.warn('[LogService] addLog fallback failed:', e2);
          return null;
        }
      }
      console.warn('[LogService] addLog failed:', msg);
      return null;
    }
  }

  getLogById(id: number): LogEntry | undefined {
    const db = getDatabase();
    return db.prepare('SELECT * FROM logs WHERE id = ?').get(id) as LogEntry | undefined;
  }

  queryLogs(params: LogQueryParams = {}): PaginatedLogs {
    const db = getDatabase();
    const { device_id, action, page = 1, limit = 50 } = params;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const queryParams: unknown[] = [];

    if (device_id) {
      whereClause += ' AND device_id = ?';
      queryParams.push(device_id);
    }
    if (action) {
      whereClause += ' AND action = ?';
      queryParams.push(action);
    }

    const countRow = db
      .prepare(`SELECT COUNT(*) as count FROM logs ${whereClause}`)
      .get(...queryParams) as { count: number };
    const total = countRow.count;

    const logs = db
      .prepare(
        `SELECT * FROM logs ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
      )
      .all(...queryParams, limit, offset) as LogEntry[];

    return {
      logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  getDistinctActions(): string[] {
    const db = getDatabase();
    const rows = db
      .prepare('SELECT DISTINCT action FROM logs ORDER BY action')
      .all() as Array<{ action: string }>;
    return rows.map((r) => r.action);
  }

  clearLogs(): void {
    const db = getDatabase();
    db.prepare('DELETE FROM logs').run();
  }
}

export const logService = new LogService();
