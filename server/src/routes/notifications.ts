import { Router, Response, NextFunction } from 'express';
import { query } from '../db/index.js';
import { getNotificationsQuerySchema, NotificationWithActor } from '../types/comments.js';
import { AppError } from '../middleware/errorHandler.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/notifications - Get user's notifications
router.get(
  '/',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId!;
      const { limit, offset, unread_only } = getNotificationsQuerySchema.parse(req.query);

      let whereClause = 'WHERE n.user_id = $1';
      if (unread_only) {
        whereClause += ' AND n.is_read = FALSE';
      }

      const result = await query<NotificationWithActor>(
        `
        SELECT
          n.id, n.user_id, n.type, n.title, n.message,
          n.related_post_id, n.related_comment_id, n.actor_id,
          n.is_read, n.read_at, n.created_at,
          CASE WHEN u.id IS NOT NULL THEN
            json_build_object(
              'id', u.id,
              'name', u.name,
              'avatar_url', u.avatar_url
            )
          ELSE NULL END as actor
        FROM notifications n
        LEFT JOIN users u ON n.actor_id = u.id
        ${whereClause}
        ORDER BY n.created_at DESC
        LIMIT $2 OFFSET $3
        `,
        [userId, limit, offset]
      );

      // Get total count
      const countResult = await query<{ count: string }>(
        `SELECT COUNT(*) as count FROM notifications n ${whereClause}`,
        [userId]
      );

      res.json({
        notifications: result.rows,
        total: parseInt(countResult.rows[0].count, 10),
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/notifications/unread-count - Get unread notification count
router.get(
  '/unread-count',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId!;

      const result = await query<{ count: string }>(
        'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = FALSE',
        [userId]
      );

      res.json({
        count: parseInt(result.rows[0].count, 10),
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/notifications/:id/read - Mark notification as read
router.post(
  '/:id/read',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const userId = req.userId!;

      // Verify ownership and update
      const result = await query(
        `
        UPDATE notifications
        SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND user_id = $2
        RETURNING id
        `,
        [id, userId]
      );

      if (result.rows.length === 0) {
        throw new AppError('Уведомление не найдено', 404);
      }

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/notifications/read-all - Mark all notifications as read
router.post(
  '/read-all',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId!;

      const result = await query(
        `
        UPDATE notifications
        SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
        WHERE user_id = $1 AND is_read = FALSE
        `,
        [userId]
      );

      res.json({
        success: true,
        updated: result.rowCount,
      });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/notifications/:id - Delete a notification
router.delete(
  '/:id',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const userId = req.userId!;

      const result = await query(
        'DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING id',
        [id, userId]
      );

      if (result.rows.length === 0) {
        throw new AppError('Уведомление не найдено', 404);
      }

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/notifications - Delete all notifications
router.delete(
  '/',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId!;

      await query('DELETE FROM notifications WHERE user_id = $1', [userId]);

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

export default router;
