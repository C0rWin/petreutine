import { Response, Router } from 'express';

import { query } from '../../db/index.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { AppError, asyncHandler } from '../../middleware/errorHandler.js';
import {
  adminPostsQuerySchema,
  AdminPostWithStats,
  AdminTargetType,
  deletePostSchema,
  PaginatedResponse,
  toggleCommentsSchema,
} from '../../types/admin.js';
import { logAdminAction } from './utils.js';

const router = Router();

/** GET / - List posts with pagination and filters */
router.get(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const params = adminPostsQuerySchema.parse(req.query);
    let whereClause = 'WHERE 1=1';
    const queryParams: unknown[] = [];
    let paramIndex = 1;

    if (params.search) {
      whereClause += ` AND (p.title ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex})`;
      queryParams.push(`%${params.search}%`);
      paramIndex++;
    }
    if (params.type !== 'all') {
      whereClause += ` AND p.type = $${paramIndex}`;
      queryParams.push(params.type);
      paramIndex++;
    }
    if (params.status !== 'all') {
      whereClause += ` AND p.status = $${paramIndex}`;
      queryParams.push(params.status);
      paramIndex++;
    }
    if (params.comments_enabled !== 'all') {
      whereClause += ` AND p.comments_enabled = $${paramIndex}`;
      queryParams.push(params.comments_enabled === 'enabled');
      paramIndex++;
    }
    if (params.user_id) {
      whereClause += ` AND p.user_id = $${paramIndex}`;
      queryParams.push(params.user_id);
      paramIndex++;
    }

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM posts p ${whereClause}`,
      queryParams
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const sortColumn =
      params.sort_by === 'title'
        ? 'p.title'
        : params.sort_by === 'updated_at'
          ? 'p.updated_at'
          : 'p.created_at';

    const postsResult = await query<AdminPostWithStats>(
      `SELECT p.*, u.name as user_name, u.email as user_email,
      COALESCE(c.comments_count, 0)::int as comments_count
     FROM posts p JOIN users u ON u.id = p.user_id
     LEFT JOIN (SELECT post_id, COUNT(*) as comments_count FROM comments GROUP BY post_id) c ON c.post_id = p.id
     ${whereClause}
     ORDER BY ${sortColumn} ${params.sort_order.toUpperCase()}
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...queryParams, params.limit, params.offset]
    );

    res.json({
      data: postsResult.rows,
      total,
      limit: params.limit,
      offset: params.offset,
      has_more: params.offset + params.limit < total,
    } as PaginatedResponse<AdminPostWithStats>);
  })
);

/** GET /:id - Get post details */
router.get(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    const result = await query<AdminPostWithStats>(
      `SELECT p.*, u.name as user_name, u.email as user_email,
      COALESCE(c.comments_count, 0)::int as comments_count
     FROM posts p JOIN users u ON u.id = p.user_id
     LEFT JOIN (SELECT post_id, COUNT(*) as comments_count FROM comments GROUP BY post_id) c ON c.post_id = p.id
     WHERE p.id = $1`,
      [id]
    );

    if (result.rows.length === 0) throw new AppError('Публикация не найдена', 404);
    res.json(result.rows[0]);
  })
);

/** POST /:id/toggle-comments - Enable/disable comments on a post */
router.post(
  '/:id/toggle-comments',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const input = toggleCommentsSchema.parse(req.body);
    const adminId = req.userId!;

    const postCheck = await query<{ id: string }>('SELECT id FROM posts WHERE id = $1', [id]);
    if (postCheck.rows.length === 0) throw new AppError('Публикация не найдена', 404);

    if (input.enabled) {
      await query(
        `UPDATE posts SET comments_enabled = TRUE, comments_disabled_by = NULL,
       comments_disabled_at = NULL, comments_disabled_reason = NULL WHERE id = $1`,
        [id]
      );
    } else {
      await query(
        `UPDATE posts SET comments_enabled = FALSE, comments_disabled_by = $1,
       comments_disabled_at = CURRENT_TIMESTAMP, comments_disabled_reason = $2 WHERE id = $3`,
        [adminId, input.reason || null, id]
      );
    }

    await logAdminAction(
      adminId,
      input.enabled ? 'enable_comments' : 'disable_comments',
      AdminTargetType.POST,
      id,
      { reason: input.reason }
    );

    res.json({
      success: true,
      message: input.enabled ? 'Комментарии включены' : 'Комментарии отключены',
    });
  })
);

/** DELETE /:id - Admin delete a post */
router.delete(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const input = deletePostSchema.parse(req.body);
    const adminId = req.userId!;

    const postCheck = await query<{ id: string; title: string; user_id: string }>(
      'SELECT id, title, user_id FROM posts WHERE id = $1',
      [id]
    );
    if (postCheck.rows.length === 0) throw new AppError('Публикация не найдена', 404);

    const post = postCheck.rows[0];
    await query('DELETE FROM posts WHERE id = $1', [id]);

    await logAdminAction(adminId, 'delete_post', AdminTargetType.POST, id, {
      title: post.title,
      user_id: post.user_id,
      reason: input.reason,
    });

    res.json({ success: true, message: 'Публикация удалена' });
  })
);

export default router;
