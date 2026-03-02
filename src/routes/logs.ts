import { Router, type Request, type Response } from 'express';
import { logService } from '../services/LogService.js';

const router = Router();

// GET /api/logs - Query logs with pagination and filters
router.get('/', (req: Request, res: Response) => {
  const { device_id, action, page, limit } = req.query;

  const result = logService.queryLogs({
    device_id: device_id as string | undefined,
    action: action as string | undefined,
    page: page ? parseInt(page as string, 10) : 1,
    limit: limit ? parseInt(limit as string, 10) : 50,
  });

  res.json(result);
});

// GET /api/logs/actions - Get distinct action types
router.get('/actions', (_req: Request, res: Response) => {
  const actions = logService.getDistinctActions();
  res.json(actions);
});

// DELETE /api/logs - Clear all logs
router.delete('/', (_req: Request, res: Response) => {
  logService.clearLogs();
  res.json({ message: '日志已清除' });
});

export default router;
