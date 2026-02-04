import { Router, Response, NextFunction } from 'express';
import { query } from '../db/index.js';
import {
  CommentWithUser,
  CommentReportWithDetails,
  CommentStatus,
  ReportStatus,
  moderateCommentSchema,
  resolveReportSchema,
} from '../types/comments.js';
import { AppError } from '../middleware/errorHandler.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { requireModerator } from '../middleware/roles.js';
import {
  createModerationApprovedNotification,
  createModerationRejectedNotification,
} from '../services/notifications.js';

const router = Router();

// All moderation routes require moderator or admin role
router.use(requireAuth, requireModerator);

// GET /api/moderation/queue - Get pending comments for review
router.get('/queue', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await query<CommentWithUser>(
      `
        SELECT
          c.id, c.post_id, c.user_id, c.parent_id, c.content,
          c.status, c.upvotes, c.downvotes, c.score,
          c.depth, c.path, c.reply_count,
          c.ai_moderation_score, c.ai_moderation_reason,
          c.created_at, c.updated_at, c.deleted_at,
          json_build_object(
            'id', u.id,
            'name', u.name,
            'avatar_url', u.avatar_url
          ) as user,
          json_build_object(
            'id', p.id,
            'title', p.title
          ) as post
        FROM comments c
        JOIN users u ON c.user_id = u.id
        JOIN posts p ON c.post_id = p.id
        WHERE c.status = 'pending' AND c.deleted_at IS NULL
        ORDER BY c.created_at ASC
        LIMIT $1 OFFSET $2
        `,
      [limit, offset]
    );

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM comments WHERE status = 'pending' AND deleted_at IS NULL`
    );

    res.json({
      comments: result.rows,
      total: parseInt(countResult.rows[0].count, 10),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/moderation/flagged - Get flagged comments (reported by community)
router.get('/flagged', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await query<CommentWithUser & { report_count: number }>(
      `
        SELECT
          c.id, c.post_id, c.user_id, c.parent_id, c.content,
          c.status, c.upvotes, c.downvotes, c.score,
          c.depth, c.path, c.reply_count,
          c.ai_moderation_score, c.ai_moderation_reason,
          c.created_at, c.updated_at, c.deleted_at,
          json_build_object(
            'id', u.id,
            'name', u.name,
            'avatar_url', u.avatar_url
          ) as user,
          json_build_object(
            'id', p.id,
            'title', p.title
          ) as post,
          (SELECT COUNT(*) FROM comment_reports WHERE comment_id = c.id) as report_count
        FROM comments c
        JOIN users u ON c.user_id = u.id
        JOIN posts p ON c.post_id = p.id
        WHERE c.status = 'flagged' AND c.deleted_at IS NULL
        ORDER BY report_count DESC, c.created_at ASC
        LIMIT $1 OFFSET $2
        `,
      [limit, offset]
    );

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM comments WHERE status = 'flagged' AND deleted_at IS NULL`
    );

    res.json({
      comments: result.rows,
      total: parseInt(countResult.rows[0].count, 10),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/moderation/reports - Get pending reports
router.get('/reports', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await query<CommentReportWithDetails>(
      `
        SELECT
          r.id, r.comment_id, r.reporter_id, r.reason, r.description,
          r.status, r.reviewed_by, r.reviewed_at, r.resolution_note,
          r.created_at,
          json_build_object(
            'id', c.id,
            'post_id', c.post_id,
            'user_id', c.user_id,
            'content', c.content,
            'status', c.status,
            'created_at', c.created_at,
            'user', json_build_object(
              'id', cu.id,
              'name', cu.name,
              'avatar_url', cu.avatar_url
            )
          ) as comment,
          json_build_object(
            'id', ru.id,
            'name', ru.name,
            'avatar_url', ru.avatar_url
          ) as reporter
        FROM comment_reports r
        JOIN comments c ON r.comment_id = c.id
        JOIN users cu ON c.user_id = cu.id
        JOIN users ru ON r.reporter_id = ru.id
        WHERE r.status = 'pending'
        ORDER BY r.created_at ASC
        LIMIT $1 OFFSET $2
        `,
      [limit, offset]
    );

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM comment_reports WHERE status = 'pending'`
    );

    res.json({
      reports: result.rows,
      total: parseInt(countResult.rows[0].count, 10),
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/moderation/comments/:id/review - Approve or reject a comment
router.post(
  '/comments/:id/review',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const moderatorId = req.userId!;
      const data = moderateCommentSchema.parse(req.body);

      // Get comment info before updating
      const commentCheck = await query<{ user_id: string; status: string }>(
        'SELECT user_id, status FROM comments WHERE id = $1 AND deleted_at IS NULL',
        [id]
      );

      if (commentCheck.rows.length === 0) {
        throw new AppError('Комментарий не найден', 404);
      }

      const comment = commentCheck.rows[0];

      // Only moderate pending or flagged comments
      if (comment.status !== 'pending' && comment.status !== 'flagged') {
        throw new AppError('Комментарий уже прошёл модерацию', 400);
      }

      // Update comment status
      const newStatus =
        data.status === 'approved' ? CommentStatus.APPROVED : CommentStatus.REJECTED;

      await query(
        `
        UPDATE comments
        SET status = $1, moderated_by = $2, moderated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        `,
        [newStatus, moderatorId, id]
      );

      // Resolve any pending reports for this comment
      await query(
        `
        UPDATE comment_reports
        SET status = $1, reviewed_by = $2, reviewed_at = CURRENT_TIMESTAMP,
            resolution_note = $3
        WHERE comment_id = $4 AND status = 'pending'
        `,
        [
          data.status === 'approved' ? ReportStatus.DISMISSED : ReportStatus.RESOLVED,
          moderatorId,
          data.reason ||
            (data.status === 'approved'
              ? 'Комментарий одобрен модератором'
              : 'Комментарий отклонён'),
          id,
        ]
      );

      // Send notification to comment author
      if (data.status === 'approved') {
        await createModerationApprovedNotification(id, comment.user_id);
      } else {
        await createModerationRejectedNotification(id, comment.user_id, data.reason);
      }

      res.json({
        success: true,
        status: newStatus,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/moderation/reports/:id/resolve - Resolve a report
router.post(
  '/reports/:id/resolve',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const moderatorId = req.userId!;
      const data = resolveReportSchema.parse(req.body);

      // Get report info
      const reportCheck = await query<{ comment_id: string; status: string }>(
        'SELECT comment_id, status FROM comment_reports WHERE id = $1',
        [id]
      );

      if (reportCheck.rows.length === 0) {
        throw new AppError('Жалоба не найдена', 404);
      }

      if (reportCheck.rows[0].status !== 'pending') {
        throw new AppError('Жалоба уже рассмотрена', 400);
      }

      // Update report status
      const newStatus = data.status === 'resolved' ? ReportStatus.RESOLVED : ReportStatus.DISMISSED;

      await query(
        `
        UPDATE comment_reports
        SET status = $1, reviewed_by = $2, reviewed_at = CURRENT_TIMESTAMP,
            resolution_note = $3
        WHERE id = $4
        `,
        [newStatus, moderatorId, data.resolution_note || null, id]
      );

      // If resolved (validated), optionally flag/reject the comment
      if (data.status === 'resolved') {
        await query(
          `UPDATE comments SET status = 'flagged' WHERE id = $1 AND status = 'approved'`,
          [reportCheck.rows[0].comment_id]
        );
      }

      res.json({
        success: true,
        status: newStatus,
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/moderation/stats - Get moderation statistics
router.get('/stats', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const [pendingComments, flaggedComments, pendingReports, todayModerated] = await Promise.all([
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM comments WHERE status = 'pending' AND deleted_at IS NULL`
      ),
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM comments WHERE status = 'flagged' AND deleted_at IS NULL`
      ),
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM comment_reports WHERE status = 'pending'`
      ),
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM comments
           WHERE moderated_at >= CURRENT_DATE AND moderated_at < CURRENT_DATE + INTERVAL '1 day'`
      ),
    ]);

    res.json({
      pending_comments: parseInt(pendingComments.rows[0].count, 10),
      flagged_comments: parseInt(flaggedComments.rows[0].count, 10),
      pending_reports: parseInt(pendingReports.rows[0].count, 10),
      today_moderated: parseInt(todayModerated.rows[0].count, 10),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
