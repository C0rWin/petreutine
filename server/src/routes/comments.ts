import { Router, Response, NextFunction } from 'express';
import { query } from '../db/index.js';
import {
  createCommentSchema,
  updateCommentSchema,
  voteSchema,
  reportCommentSchema,
  getCommentsQuerySchema,
  CommentWithUser,
  CommentStatus,
  VoteType,
  CreateCommentInput,
} from '../types/comments.js';
import { AppError } from '../middleware/errorHandler.js';
import { requireAuth, optionalAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { moderateContent, getModerationDecision } from '../services/aiModeration.js';
import { createCommentNotification } from '../services/notifications.js';
import rateLimit from 'express-rate-limit';

const router = Router();

// Rate limiter for comment creation
const commentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 comments per hour
  message: { error: 'Превышен лимит комментариев. Попробуйте позже.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for voting
const voteLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 votes per minute
  message: { error: 'Слишком много голосов. Подождите немного.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Helper function to build comment tree from flat list
function buildCommentTree(comments: CommentWithUser[]): CommentWithUser[] {
  const commentMap = new Map<string, CommentWithUser>();
  const roots: CommentWithUser[] = [];

  // First pass: create map of all comments
  comments.forEach(comment => {
    commentMap.set(comment.id, { ...comment, replies: [] });
  });

  // Second pass: build tree structure
  comments.forEach(comment => {
    const node = commentMap.get(comment.id)!;
    if (comment.parent_id === null) {
      roots.push(node);
    } else {
      const parent = commentMap.get(comment.parent_id);
      if (parent) {
        parent.replies = parent.replies || [];
        parent.replies.push(node);
      }
    }
  });

  return roots;
}

// GET /api/posts/:postId/comments - Get threaded comments for a post
router.get(
  '/posts/:postId/comments',
  optionalAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { postId } = req.params;
      const userId = req.userId || null;
      const { sort, limit, offset } = getCommentsQuerySchema.parse(req.query);

      // Build ORDER BY based on sort
      let orderClause: string;
      switch (sort) {
        case 'new':
          orderClause = 'c.created_at DESC';
          break;
        case 'old':
          orderClause = 'c.created_at ASC';
          break;
        case 'controversial':
          orderClause = 'c.downvotes DESC, c.upvotes DESC';
          break;
        case 'best':
        default:
          orderClause = 'c.score DESC, c.created_at DESC';
      }

      const result = await query<CommentWithUser>(
        `
        SELECT
          c.id, c.post_id, c.user_id, c.parent_id, c.content,
          c.status, c.upvotes, c.downvotes, c.score,
          c.depth, c.path, c.reply_count,
          c.created_at, c.updated_at, c.deleted_at,
          json_build_object(
            'id', u.id,
            'name', u.name,
            'avatar_url', u.avatar_url
          ) as user,
          cv.vote_type as current_user_vote
        FROM comments c
        JOIN users u ON c.user_id = u.id
        LEFT JOIN comment_votes cv ON cv.comment_id = c.id AND cv.user_id = $2
        WHERE c.post_id = $1
          AND c.status = 'approved'
          AND c.deleted_at IS NULL
        ORDER BY c.path, ${orderClause}
        LIMIT $3 OFFSET $4
        `,
        [postId, userId, limit, offset]
      );

      // Build nested tree structure
      const comments = buildCommentTree(result.rows);

      // Get total count for pagination
      const countResult = await query<{ count: string }>(
        `SELECT COUNT(*) as count FROM comments
         WHERE post_id = $1 AND status = 'approved' AND deleted_at IS NULL`,
        [postId]
      );

      res.json({
        comments,
        total: parseInt(countResult.rows[0].count, 10),
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/comments - Create a new comment
router.post(
  '/',
  commentLimiter,
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId!;
      const data: CreateCommentInput = createCommentSchema.parse(req.body);

      // Check if user is banned from commenting (both 'full' and 'comment' ban types)
      if (req.userBanType) {
        throw new AppError('Вам запрещено оставлять комментарии', 403);
      }

      // Verify post exists and comments are enabled
      const postCheck = await query<{ id: string; user_id: string; comments_enabled: boolean }>(
        'SELECT id, user_id, comments_enabled FROM posts WHERE id = $1',
        [data.post_id]
      );
      if (postCheck.rows.length === 0) {
        throw new AppError('Объявление не найдено', 404);
      }

      // Check if comments are enabled on this post
      if (!postCheck.rows[0].comments_enabled) {
        throw new AppError('Комментарии отключены для этого объявления', 403);
      }

      // If replying, verify parent exists and belongs to same post
      if (data.parent_id) {
        const parentCheck = await query<{ post_id: string }>(
          'SELECT post_id FROM comments WHERE id = $1 AND deleted_at IS NULL',
          [data.parent_id]
        );
        if (parentCheck.rows.length === 0) {
          throw new AppError('Родительский комментарий не найден', 404);
        }
        if (parentCheck.rows[0].post_id !== data.post_id) {
          throw new AppError('Неверный родительский комментарий', 400);
        }
      }

      // AI moderation
      const moderationResult = await moderateContent(data.content);
      const decision = getModerationDecision(moderationResult);

      // Insert comment
      const result = await query<CommentWithUser>(
        `
        WITH inserted AS (
          INSERT INTO comments (
            post_id, user_id, parent_id, content, status,
            ai_moderation_score, ai_moderation_reason
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *
        )
        SELECT
          i.id, i.post_id, i.user_id, i.parent_id, i.content,
          i.status, i.upvotes, i.downvotes, i.score,
          i.depth, i.path, i.reply_count,
          i.created_at, i.updated_at, i.deleted_at,
          json_build_object(
            'id', u.id,
            'name', u.name,
            'avatar_url', u.avatar_url
          ) as user,
          NULL as current_user_vote
        FROM inserted i
        JOIN users u ON i.user_id = u.id
        `,
        [
          data.post_id,
          userId,
          data.parent_id || null,
          data.content,
          decision.status,
          moderationResult.score,
          moderationResult.reason,
        ]
      );

      const comment = result.rows[0];

      // Create notifications if comment is approved
      if (decision.status === CommentStatus.APPROVED) {
        const postOwnerId = postCheck.rows[0].user_id;
        await createCommentNotification(comment, userId, postOwnerId);
      }

      // Return different response based on moderation status
      if (decision.status === CommentStatus.REJECTED) {
        res.status(201).json({
          ...comment,
          _moderation: {
            status: 'rejected',
            message: 'Ваш комментарий был отклонён модерацией.',
            reason: moderationResult.reason,
          },
        });
      } else if (decision.status === CommentStatus.PENDING) {
        res.status(201).json({
          ...comment,
          _moderation: {
            status: 'pending',
            message: 'Ваш комментарий отправлен на проверку модератором.',
          },
        });
      } else {
        res.status(201).json(comment);
      }
    } catch (error) {
      next(error);
    }
  }
);

// PUT /api/comments/:id - Update own comment
router.put(
  '/:id',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const userId = req.userId!;
      const data = updateCommentSchema.parse(req.body);

      // Check if user is banned from commenting
      if (req.userBanType) {
        throw new AppError('Вам запрещено редактировать комментарии', 403);
      }

      // Check ownership
      const ownerCheck = await query<{ user_id: string; status: string }>(
        'SELECT user_id, status FROM comments WHERE id = $1 AND deleted_at IS NULL',
        [id]
      );
      if (ownerCheck.rows.length === 0) {
        throw new AppError('Комментарий не найден', 404);
      }
      if (ownerCheck.rows[0].user_id !== userId) {
        throw new AppError('Нет прав на редактирование этого комментария', 403);
      }

      // Re-moderate edited content
      const moderationResult = await moderateContent(data.content);
      const decision = getModerationDecision(moderationResult);

      const result = await query<CommentWithUser>(
        `
        WITH updated AS (
          UPDATE comments
          SET content = $1, status = $2, ai_moderation_score = $3, ai_moderation_reason = $4
          WHERE id = $5
          RETURNING *
        )
        SELECT
          u2.id, u2.post_id, u2.user_id, u2.parent_id, u2.content,
          u2.status, u2.upvotes, u2.downvotes, u2.score,
          u2.depth, u2.path, u2.reply_count,
          u2.created_at, u2.updated_at, u2.deleted_at,
          json_build_object(
            'id', u.id,
            'name', u.name,
            'avatar_url', u.avatar_url
          ) as user
        FROM updated u2
        JOIN users u ON u2.user_id = u.id
        `,
        [data.content, decision.status, moderationResult.score, moderationResult.reason, id]
      );

      res.json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/comments/:id - Soft delete own comment
router.delete(
  '/:id',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const userId = req.userId!;

      // Check ownership
      const ownerCheck = await query<{ user_id: string }>(
        'SELECT user_id FROM comments WHERE id = $1 AND deleted_at IS NULL',
        [id]
      );
      if (ownerCheck.rows.length === 0) {
        throw new AppError('Комментарий не найден', 404);
      }
      if (ownerCheck.rows[0].user_id !== userId) {
        throw new AppError('Нет прав на удаление этого комментария', 403);
      }

      // Soft delete
      await query(
        'UPDATE comments SET deleted_at = CURRENT_TIMESTAMP, content = \'[Комментарий удалён]\' WHERE id = $1',
        [id]
      );

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/comments/:id/vote - Vote on a comment
router.post(
  '/:id/vote',
  voteLimiter,
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const userId = req.userId!;
      const { vote_type } = voteSchema.parse(req.body);

      // Check comment exists and is approved
      const commentCheck = await query<{ status: string }>(
        'SELECT status FROM comments WHERE id = $1 AND deleted_at IS NULL',
        [id]
      );
      if (commentCheck.rows.length === 0) {
        throw new AppError('Комментарий не найден', 404);
      }
      if (commentCheck.rows[0].status !== 'approved') {
        throw new AppError('Нельзя голосовать за этот комментарий', 400);
      }

      // Upsert vote
      await query(
        `
        INSERT INTO comment_votes (comment_id, user_id, vote_type)
        VALUES ($1, $2, $3)
        ON CONFLICT (comment_id, user_id)
        DO UPDATE SET vote_type = $3
        `,
        [id, userId, vote_type]
      );

      // Get updated vote counts
      const result = await query<{ upvotes: number; downvotes: number; score: number }>(
        'SELECT upvotes, downvotes, score FROM comments WHERE id = $1',
        [id]
      );

      res.json({
        upvotes: result.rows[0].upvotes,
        downvotes: result.rows[0].downvotes,
        score: result.rows[0].score,
        current_user_vote: vote_type,
      });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/comments/:id/vote - Remove vote from a comment
router.delete(
  '/:id/vote',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const userId = req.userId!;

      await query(
        'DELETE FROM comment_votes WHERE comment_id = $1 AND user_id = $2',
        [id, userId]
      );

      // Get updated vote counts
      const result = await query<{ upvotes: number; downvotes: number; score: number }>(
        'SELECT upvotes, downvotes, score FROM comments WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        throw new AppError('Комментарий не найден', 404);
      }

      res.json({
        upvotes: result.rows[0].upvotes,
        downvotes: result.rows[0].downvotes,
        score: result.rows[0].score,
        current_user_vote: null,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/comments/:id/report - Report a comment
router.post(
  '/:id/report',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const userId = req.userId!;
      const data = reportCommentSchema.parse(req.body);

      // Check comment exists
      const commentCheck = await query<{ id: string; user_id: string }>(
        'SELECT id, user_id FROM comments WHERE id = $1 AND deleted_at IS NULL',
        [id]
      );
      if (commentCheck.rows.length === 0) {
        throw new AppError('Комментарий не найден', 404);
      }

      // Can't report own comment
      if (commentCheck.rows[0].user_id === userId) {
        throw new AppError('Нельзя пожаловаться на свой комментарий', 400);
      }

      // Check if already reported by this user
      const existingReport = await query(
        'SELECT id FROM comment_reports WHERE comment_id = $1 AND reporter_id = $2',
        [id, userId]
      );
      if (existingReport.rows.length > 0) {
        throw new AppError('Вы уже отправили жалобу на этот комментарий', 400);
      }

      // Create report
      await query(
        `
        INSERT INTO comment_reports (comment_id, reporter_id, reason, description)
        VALUES ($1, $2, $3, $4)
        `,
        [id, userId, data.reason, data.description || null]
      );

      // If comment gets 3+ reports, flag it for review
      const reportCount = await query<{ count: string }>(
        'SELECT COUNT(*) as count FROM comment_reports WHERE comment_id = $1',
        [id]
      );
      if (parseInt(reportCount.rows[0].count, 10) >= 3) {
        await query(
          'UPDATE comments SET status = $1 WHERE id = $2',
          [CommentStatus.FLAGGED, id]
        );
      }

      res.status(201).json({ message: 'Жалоба отправлена' });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
