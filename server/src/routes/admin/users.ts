import { Response, Router } from 'express';

import { query } from '../../db/index.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { AppError, asyncHandler } from '../../middleware/errorHandler.js';
import {
  adminCommentsQuerySchema,
  adminPostsQuerySchema,
  AdminPostWithStats,
  AdminTargetType,
  adminUsersQuerySchema,
  AdminUserWithStats,
  BanAction,
  BanHistoryEntry,
  banHistoryQuerySchema,
  BanType,
  banUserSchema,
  PaginatedResponse,
  toggleAdminSchema,
  unbanUserSchema,
} from '../../types/admin.js';
import { CommentWithUser } from '../../types/comments.js';
import { logAdminAction } from './utils.js';

const router = Router();

// Shared SQL for user details with stats
const USER_DETAILS_SQL = `
  SELECT u.id, u.yandex_id, u.name, u.email, u.avatar_url,
    u.created_at, u.updated_at, u.last_login_at,
    u.ban_type, u.ban_reason, u.banned_at, u.banned_by, u.ban_expires_at,
    COALESCE(p.posts_count, 0)::int as posts_count,
    COALESCE(c.comments_count, 0)::int as comments_count,
    COALESCE(c.flagged_comments_count, 0)::int as flagged_comments_count,
    COALESCE(c.rejected_comments_count, 0)::int as rejected_comments_count,
    banner.name as banned_by_name,
    EXISTS(SELECT 1 FROM user_roles WHERE user_id = u.id AND role = 'admin') as is_admin
  FROM users u
  LEFT JOIN (SELECT user_id, COUNT(*) as posts_count FROM posts GROUP BY user_id) p ON p.user_id = u.id
  LEFT JOIN (
    SELECT user_id, COUNT(*) as comments_count,
      COUNT(*) FILTER (WHERE status = 'flagged') as flagged_comments_count,
      COUNT(*) FILTER (WHERE status = 'rejected') as rejected_comments_count
    FROM comments GROUP BY user_id
  ) c ON c.user_id = u.id
  LEFT JOIN users banner ON banner.id = u.banned_by`;

/** GET / - List users with pagination, search, and filters */
router.get(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const params = adminUsersQuerySchema.parse(req.query);
    let whereClause = 'WHERE 1=1';
    const queryParams: unknown[] = [];
    let paramIndex = 1;

    if (params.search) {
      whereClause += ` AND (u.name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`;
      queryParams.push(`%${params.search}%`);
      paramIndex++;
    }
    if (params.ban_status !== 'all') {
      switch (params.ban_status) {
        case 'banned':
          whereClause += ` AND u.ban_type IS NOT NULL`;
          break;
        case 'not_banned':
          whereClause += ` AND u.ban_type IS NULL`;
          break;
        case 'comment_banned':
          whereClause += ` AND u.ban_type = 'comment'`;
          break;
        case 'full_banned':
          whereClause += ` AND u.ban_type = 'full'`;
          break;
      }
    }

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM users u ${whereClause}`,
      queryParams
    );
    const total = parseInt(countResult.rows[0].count, 10);
    const sortColumn =
      params.sort_by === 'name'
        ? 'u.name'
        : params.sort_by === 'email'
          ? 'u.email'
          : params.sort_by === 'last_login_at'
            ? 'u.last_login_at'
            : 'u.created_at';

    const usersResult = await query<AdminUserWithStats>(
      `${USER_DETAILS_SQL} ${whereClause}
     ORDER BY ${sortColumn} ${params.sort_order.toUpperCase()}
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...queryParams, params.limit, params.offset]
    );

    res.json({
      data: usersResult.rows,
      total,
      limit: params.limit,
      offset: params.offset,
      has_more: params.offset + params.limit < total,
    } as PaginatedResponse<AdminUserWithStats>);
  })
);

/** GET /:id - Get user details with stats */
router.get(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const result = await query<AdminUserWithStats>(`${USER_DETAILS_SQL} WHERE u.id = $1`, [id]);
    if (result.rows.length === 0) throw new AppError('Пользователь не найден', 404);
    res.json(result.rows[0]);
  })
);

/** GET /:id/posts - Get user's posts */
router.get(
  '/:id/posts',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const params = adminPostsQuerySchema.parse({ ...req.query, user_id: id });

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM posts WHERE user_id = $1`,
      [id]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const postsResult = await query<AdminPostWithStats>(
      `SELECT p.*, u.name as user_name, u.email as user_email,
      COALESCE(c.comments_count, 0)::int as comments_count
     FROM posts p JOIN users u ON u.id = p.user_id
     LEFT JOIN (SELECT post_id, COUNT(*) as comments_count FROM comments GROUP BY post_id) c ON c.post_id = p.id
     WHERE p.user_id = $1 ORDER BY p.created_at DESC LIMIT $2 OFFSET $3`,
      [id, params.limit, params.offset]
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

/** GET /:id/comments - Get user's comments */
router.get(
  '/:id/comments',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const params = adminCommentsQuerySchema.parse({ ...req.query, user_id: id });
    let whereClause = 'WHERE c.user_id = $1';
    const queryParams: unknown[] = [id];
    let paramIndex = 2;

    if (params.status !== 'all') {
      whereClause += ` AND c.status = $${paramIndex}`;
      queryParams.push(params.status);
      paramIndex++;
    }

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM comments c ${whereClause}`,
      queryParams
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const commentsResult = await query<CommentWithUser & { post_title: string }>(
      `SELECT c.*, p.title as post_title,
      json_build_object('id', u.id, 'name', u.name, 'avatar_url', u.avatar_url) as user
     FROM comments c JOIN users u ON u.id = c.user_id JOIN posts p ON p.id = c.post_id
     ${whereClause} ORDER BY c.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...queryParams, params.limit, params.offset]
    );

    res.json({
      data: commentsResult.rows,
      total,
      limit: params.limit,
      offset: params.offset,
      has_more: params.offset + params.limit < total,
    } as PaginatedResponse<CommentWithUser & { post_title: string }>);
  })
);

/** GET /:id/ban-history - Get user's ban history */
router.get(
  '/:id/ban-history',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const params = banHistoryQuerySchema.parse(req.query);

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM ban_history WHERE user_id = $1`,
      [id]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const historyResult = await query<BanHistoryEntry>(
      `SELECT bh.*, u.name as admin_name FROM ban_history bh
     JOIN users u ON u.id = bh.admin_id WHERE bh.user_id = $1
     ORDER BY bh.created_at DESC LIMIT $2 OFFSET $3`,
      [id, params.limit, params.offset]
    );

    res.json({
      data: historyResult.rows,
      total,
      limit: params.limit,
      offset: params.offset,
      has_more: params.offset + params.limit < total,
    } as PaginatedResponse<BanHistoryEntry>);
  })
);

/** POST /:id/ban - Ban a user */
router.post(
  '/:id/ban',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const input = banUserSchema.parse(req.body);
    const adminId = req.userId!;

    if (id === adminId) throw new AppError('Нельзя заблокировать самого себя', 400);

    const userCheck = await query<{ id: string }>('SELECT id FROM users WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) throw new AppError('Пользователь не найден', 404);

    const banExpiresAt = input.duration_hours
      ? new Date(Date.now() + input.duration_hours * 60 * 60 * 1000)
      : null;

    await query(
      `UPDATE users SET ban_type = $1, ban_reason = $2, banned_at = CURRENT_TIMESTAMP,
     banned_by = $3, ban_expires_at = $4 WHERE id = $5`,
      [input.ban_type, input.reason, adminId, banExpiresAt, id]
    );
    await query(
      `INSERT INTO ban_history (user_id, admin_id, action, ban_type, reason, duration_hours)
     VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, adminId, BanAction.BAN, input.ban_type, input.reason, input.duration_hours || null]
    );
    await logAdminAction(adminId, 'ban_user', AdminTargetType.USER, id, {
      ban_type: input.ban_type,
      reason: input.reason,
      duration_hours: input.duration_hours,
    });

    res.json({ success: true, message: 'Пользователь заблокирован' });
  })
);

/** POST /:id/unban - Unban a user */
router.post(
  '/:id/unban',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const input = unbanUserSchema.parse(req.body);
    const adminId = req.userId!;

    const userCheck = await query<{ ban_type: BanType | null }>(
      'SELECT ban_type FROM users WHERE id = $1',
      [id]
    );
    if (userCheck.rows.length === 0) throw new AppError('Пользователь не найден', 404);
    if (!userCheck.rows[0].ban_type) throw new AppError('Пользователь не заблокирован', 400);

    await query(
      `UPDATE users SET ban_type = NULL, ban_reason = NULL, banned_at = NULL,
     banned_by = NULL, ban_expires_at = NULL WHERE id = $1`,
      [id]
    );
    await query(
      `INSERT INTO ban_history (user_id, admin_id, action, reason) VALUES ($1, $2, $3, $4)`,
      [id, adminId, BanAction.UNBAN, input.reason || null]
    );
    await logAdminAction(adminId, 'unban_user', AdminTargetType.USER, id, { reason: input.reason });

    res.json({ success: true, message: 'Пользователь разблокирован' });
  })
);

/** POST /:id/toggle-admin - Grant or revoke admin role */
router.post(
  '/:id/toggle-admin',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const input = toggleAdminSchema.parse(req.body);
    const adminId = req.userId!;

    if (id === adminId && !input.is_admin) {
      throw new AppError('Нельзя снять права администратора с самого себя', 400);
    }

    const userCheck = await query<{ id: string; name: string }>(
      'SELECT id, name FROM users WHERE id = $1',
      [id]
    );
    if (userCheck.rows.length === 0) throw new AppError('Пользователь не найден', 404);

    const adminCheck = await query<{ role: string }>(
      "SELECT role FROM user_roles WHERE user_id = $1 AND role = 'admin'",
      [id]
    );
    const isCurrentlyAdmin = adminCheck.rows.length > 0;

    if (input.is_admin && isCurrentlyAdmin) {
      throw new AppError('Пользователь уже является администратором', 400);
    }
    if (!input.is_admin && !isCurrentlyAdmin) {
      throw new AppError('Пользователь не является администратором', 400);
    }

    if (input.is_admin) {
      await query("INSERT INTO user_roles (user_id, role) VALUES ($1, 'admin')", [id]);
    } else {
      await query("DELETE FROM user_roles WHERE user_id = $1 AND role = 'admin'", [id]);
    }

    await logAdminAction(
      adminId,
      input.is_admin ? 'grant_admin' : 'revoke_admin',
      AdminTargetType.USER,
      id,
      { user_name: userCheck.rows[0].name }
    );

    res.json({
      success: true,
      message: input.is_admin ? 'Права администратора выданы' : 'Права администратора отозваны',
      is_admin: input.is_admin,
    });
  })
);

export default router;
