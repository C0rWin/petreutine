import { Response, Router } from 'express';

import { AuthenticatedRequest, requireAuth } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { requireAdmin } from '../../middleware/roles.js';
import { adminStatsCache } from '../../services/cache.js';
import auditRouter from './audit.js';
import postsRouter from './posts.js';
import statsRouter from './stats.js';
import usersRouter from './users.js';

const router = Router();

// Apply shared middleware BEFORE mounting sub-routers
router.use(requireAuth);
router.use(requireAdmin);

// Mount sub-routers
router.use('/users', usersRouter);
router.use('/posts', postsRouter);
router.use('/stats', statsRouter);
router.use('/audit-log', auditRouter);

// Cache refresh endpoint
router.post(
  '/cache/refresh',
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    adminStatsCache.invalidate();

    res.json({
      success: true,
      message: 'Admin stats cache cleared',
      timestamp: new Date().toISOString(),
    });
  })
);

// Cache stats endpoint
router.get(
  '/cache/stats',
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    const stats = adminStatsCache.getStats();

    res.json({
      ...stats,
      ttl_seconds: 60,
      timestamp: new Date().toISOString(),
    });
  })
);

export default router;
