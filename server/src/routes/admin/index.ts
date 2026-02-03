import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/roles.js';
import usersRouter from './users.js';
import postsRouter from './posts.js';
import statsRouter from './stats.js';
import auditRouter from './audit.js';

const router = Router();

// Apply shared middleware BEFORE mounting sub-routers
router.use(requireAuth);
router.use(requireAdmin);

// Mount sub-routers
router.use('/users', usersRouter);
router.use('/posts', postsRouter);
router.use('/stats', statsRouter);
router.use('/audit-log', auditRouter);

export default router;
