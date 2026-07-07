import { Response, Router } from 'express';

import { query } from '../../db/index.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/errorHandler.js';

const router = Router();

interface FeedbackRow {
  id: string;
  name: string | null;
  email: string | null;
  message: string;
  is_read: boolean;
  created_at: string;
}

// List feedback messages (newest first) with unread count.
router.get(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

    const rows = await query<FeedbackRow>(
      'SELECT * FROM feedback ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    const counts = await query<{ total: string; unread: string }>(
      `SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE is_read = FALSE) AS unread FROM feedback`
    );

    res.json({
      feedback: rows.rows,
      total: parseInt(counts.rows[0]?.total || '0', 10),
      unread: parseInt(counts.rows[0]?.unread || '0', 10),
      limit,
      offset,
    });
  })
);

// Mark a message as read.
router.patch(
  '/:id/read',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await query('UPDATE feedback SET is_read = TRUE WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  })
);

// Delete a message.
router.delete(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await query('DELETE FROM feedback WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  })
);

export default router;
