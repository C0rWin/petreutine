import { Router, Response, NextFunction } from 'express';
import { query } from '../db/index.js';
import { AppError, asyncHandler } from '../middleware/errorHandler.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roles.js';
import {
  adminUsersQuerySchema,
  adminPostsQuerySchema,
  adminCommentsQuerySchema,
  banHistoryQuerySchema,
  auditLogQuerySchema,
  statsDateRangeSchema,
  banUserSchema,
  unbanUserSchema,
  toggleCommentsSchema,
  deletePostSchema,
  toggleAdminSchema,
  AdminUserWithStats,
  AdminPostWithStats,
  BanHistoryEntry,
  AdminAuditLogEntry,
  OverviewStats,
  UserStats,
  PostStats,
  CommentStats,
  PaginatedResponse,
  BanType,
  BanAction,
  AdminTargetType,
} from '../types/admin.js';
import { CommentWithUser } from '../types/comments.js';

const router = Router();

// All admin routes require authentication and admin role
router.use(requireAuth);
router.use(requireAdmin);

// ============================================
// AUDIT LOG HELPER
// ============================================

async function logAdminAction(
  adminId: string,
  action: string,
  targetType: AdminTargetType,
  targetId: string,
  details?: Record<string, unknown>
): Promise<void> {
  await query(
    `INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [adminId, action, targetType, targetId, details ? JSON.stringify(details) : null]
  );
}

// ============================================
// USER MANAGEMENT ENDPOINTS
// ============================================

/**
 * GET /api/admin/users
 * List users with pagination, search, and filters
 */
router.get(
  '/users',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const params = adminUsersQuerySchema.parse(req.query);

    let whereClause = 'WHERE 1=1';
    const queryParams: unknown[] = [];
    let paramIndex = 1;

    // Search filter
    if (params.search) {
      whereClause += ` AND (u.name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`;
      queryParams.push(`%${params.search}%`);
      paramIndex++;
    }

    // Ban status filter
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

    // Count query
    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM users u ${whereClause}`,
      queryParams
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Main query with stats
    const sortColumn = params.sort_by === 'name' ? 'u.name' :
                       params.sort_by === 'email' ? 'u.email' :
                       params.sort_by === 'last_login_at' ? 'u.last_login_at' : 'u.created_at';

    const usersResult = await query<AdminUserWithStats>(
      `SELECT
        u.id, u.yandex_id, u.name, u.email, u.avatar_url,
        u.created_at, u.updated_at, u.last_login_at,
        u.ban_type, u.ban_reason, u.banned_at, u.banned_by, u.ban_expires_at,
        COALESCE(p.posts_count, 0)::int as posts_count,
        COALESCE(c.comments_count, 0)::int as comments_count,
        COALESCE(c.flagged_comments_count, 0)::int as flagged_comments_count,
        COALESCE(c.rejected_comments_count, 0)::int as rejected_comments_count,
        banner.name as banned_by_name,
        EXISTS(SELECT 1 FROM user_roles WHERE user_id = u.id AND role = 'admin') as is_admin
       FROM users u
       LEFT JOIN (
         SELECT user_id, COUNT(*) as posts_count FROM posts GROUP BY user_id
       ) p ON p.user_id = u.id
       LEFT JOIN (
         SELECT user_id,
           COUNT(*) as comments_count,
           COUNT(*) FILTER (WHERE status = 'flagged') as flagged_comments_count,
           COUNT(*) FILTER (WHERE status = 'rejected') as rejected_comments_count
         FROM comments GROUP BY user_id
       ) c ON c.user_id = u.id
       LEFT JOIN users banner ON banner.id = u.banned_by
       ${whereClause}
       ORDER BY ${sortColumn} ${params.sort_order.toUpperCase()}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...queryParams, params.limit, params.offset]
    );

    const response: PaginatedResponse<AdminUserWithStats> = {
      data: usersResult.rows,
      total,
      limit: params.limit,
      offset: params.offset,
      has_more: params.offset + params.limit < total,
    };

    res.json(response);
  })
);

/**
 * GET /api/admin/users/:id
 * Get user details with stats
 */
router.get(
  '/users/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    const result = await query<AdminUserWithStats>(
      `SELECT
        u.id, u.yandex_id, u.name, u.email, u.avatar_url,
        u.created_at, u.updated_at, u.last_login_at,
        u.ban_type, u.ban_reason, u.banned_at, u.banned_by, u.ban_expires_at,
        COALESCE(p.posts_count, 0)::int as posts_count,
        COALESCE(c.comments_count, 0)::int as comments_count,
        COALESCE(c.flagged_comments_count, 0)::int as flagged_comments_count,
        COALESCE(c.rejected_comments_count, 0)::int as rejected_comments_count,
        banner.name as banned_by_name,
        EXISTS(SELECT 1 FROM user_roles WHERE user_id = u.id AND role = 'admin') as is_admin
       FROM users u
       LEFT JOIN (
         SELECT user_id, COUNT(*) as posts_count FROM posts GROUP BY user_id
       ) p ON p.user_id = u.id
       LEFT JOIN (
         SELECT user_id,
           COUNT(*) as comments_count,
           COUNT(*) FILTER (WHERE status = 'flagged') as flagged_comments_count,
           COUNT(*) FILTER (WHERE status = 'rejected') as rejected_comments_count
         FROM comments GROUP BY user_id
       ) c ON c.user_id = u.id
       LEFT JOIN users banner ON banner.id = u.banned_by
       WHERE u.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Пользователь не найден', 404);
    }

    res.json(result.rows[0]);
  })
);

/**
 * GET /api/admin/users/:id/posts
 * Get user's posts
 */
router.get(
  '/users/:id/posts',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const params = adminPostsQuerySchema.parse({ ...req.query, user_id: id });

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM posts WHERE user_id = $1`,
      [id]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const postsResult = await query<AdminPostWithStats>(
      `SELECT
        p.*,
        u.name as user_name,
        u.email as user_email,
        COALESCE(c.comments_count, 0)::int as comments_count
       FROM posts p
       JOIN users u ON u.id = p.user_id
       LEFT JOIN (
         SELECT post_id, COUNT(*) as comments_count FROM comments GROUP BY post_id
       ) c ON c.post_id = p.id
       WHERE p.user_id = $1
       ORDER BY p.created_at DESC
       LIMIT $2 OFFSET $3`,
      [id, params.limit, params.offset]
    );

    const response: PaginatedResponse<AdminPostWithStats> = {
      data: postsResult.rows,
      total,
      limit: params.limit,
      offset: params.offset,
      has_more: params.offset + params.limit < total,
    };

    res.json(response);
  })
);

/**
 * GET /api/admin/users/:id/comments
 * Get user's comments
 */
router.get(
  '/users/:id/comments',
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
      `SELECT
        c.*,
        p.title as post_title,
        json_build_object('id', u.id, 'name', u.name, 'avatar_url', u.avatar_url) as user
       FROM comments c
       JOIN users u ON u.id = c.user_id
       JOIN posts p ON p.id = c.post_id
       ${whereClause}
       ORDER BY c.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...queryParams, params.limit, params.offset]
    );

    const response: PaginatedResponse<CommentWithUser & { post_title: string }> = {
      data: commentsResult.rows,
      total,
      limit: params.limit,
      offset: params.offset,
      has_more: params.offset + params.limit < total,
    };

    res.json(response);
  })
);

/**
 * GET /api/admin/users/:id/ban-history
 * Get user's ban history
 */
router.get(
  '/users/:id/ban-history',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const params = banHistoryQuerySchema.parse(req.query);

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM ban_history WHERE user_id = $1`,
      [id]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const historyResult = await query<BanHistoryEntry>(
      `SELECT
        bh.*,
        u.name as admin_name
       FROM ban_history bh
       JOIN users u ON u.id = bh.admin_id
       WHERE bh.user_id = $1
       ORDER BY bh.created_at DESC
       LIMIT $2 OFFSET $3`,
      [id, params.limit, params.offset]
    );

    const response: PaginatedResponse<BanHistoryEntry> = {
      data: historyResult.rows,
      total,
      limit: params.limit,
      offset: params.offset,
      has_more: params.offset + params.limit < total,
    };

    res.json(response);
  })
);

/**
 * POST /api/admin/users/:id/ban
 * Ban a user
 */
router.post(
  '/users/:id/ban',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const input = banUserSchema.parse(req.body);
    const adminId = req.userId!;

    // Prevent self-ban
    if (id === adminId) {
      throw new AppError('Нельзя заблокировать самого себя', 400);
    }

    // Check if user exists
    const userCheck = await query<{ id: string }>(
      'SELECT id FROM users WHERE id = $1',
      [id]
    );
    if (userCheck.rows.length === 0) {
      throw new AppError('Пользователь не найден', 404);
    }

    // Calculate expiration if duration is provided
    let banExpiresAt: Date | null = null;
    if (input.duration_hours) {
      banExpiresAt = new Date(Date.now() + input.duration_hours * 60 * 60 * 1000);
    }

    // Update user ban status
    await query(
      `UPDATE users SET
        ban_type = $1,
        ban_reason = $2,
        banned_at = CURRENT_TIMESTAMP,
        banned_by = $3,
        ban_expires_at = $4
       WHERE id = $5`,
      [input.ban_type, input.reason, adminId, banExpiresAt, id]
    );

    // Record in ban history
    await query(
      `INSERT INTO ban_history (user_id, admin_id, action, ban_type, reason, duration_hours)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, adminId, BanAction.BAN, input.ban_type, input.reason, input.duration_hours || null]
    );

    // Audit log
    await logAdminAction(adminId, 'ban_user', AdminTargetType.USER, id, {
      ban_type: input.ban_type,
      reason: input.reason,
      duration_hours: input.duration_hours,
    });

    res.json({ success: true, message: 'Пользователь заблокирован' });
  })
);

/**
 * POST /api/admin/users/:id/unban
 * Unban a user
 */
router.post(
  '/users/:id/unban',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const input = unbanUserSchema.parse(req.body);
    const adminId = req.userId!;

    // Check if user exists and is banned
    const userCheck = await query<{ ban_type: BanType | null }>(
      'SELECT ban_type FROM users WHERE id = $1',
      [id]
    );
    if (userCheck.rows.length === 0) {
      throw new AppError('Пользователь не найден', 404);
    }
    if (!userCheck.rows[0].ban_type) {
      throw new AppError('Пользователь не заблокирован', 400);
    }

    // Clear ban
    await query(
      `UPDATE users SET
        ban_type = NULL,
        ban_reason = NULL,
        banned_at = NULL,
        banned_by = NULL,
        ban_expires_at = NULL
       WHERE id = $1`,
      [id]
    );

    // Record in ban history
    await query(
      `INSERT INTO ban_history (user_id, admin_id, action, reason)
       VALUES ($1, $2, $3, $4)`,
      [id, adminId, BanAction.UNBAN, input.reason || null]
    );

    // Audit log
    await logAdminAction(adminId, 'unban_user', AdminTargetType.USER, id, {
      reason: input.reason,
    });

    res.json({ success: true, message: 'Пользователь разблокирован' });
  })
);

/**
 * POST /api/admin/users/:id/toggle-admin
 * Grant or revoke admin role
 */
router.post(
  '/users/:id/toggle-admin',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const input = toggleAdminSchema.parse(req.body);
    const adminId = req.userId!;

    // Prevent self-demotion
    if (id === adminId && !input.is_admin) {
      throw new AppError('Нельзя снять права администратора с самого себя', 400);
    }

    // Check if user exists
    const userCheck = await query<{ id: string; name: string }>(
      'SELECT id, name FROM users WHERE id = $1',
      [id]
    );
    if (userCheck.rows.length === 0) {
      throw new AppError('Пользователь не найден', 404);
    }

    // Check current admin status
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
      // Grant admin role
      await query(
        "INSERT INTO user_roles (user_id, role) VALUES ($1, 'admin')",
        [id]
      );
    } else {
      // Revoke admin role
      await query(
        "DELETE FROM user_roles WHERE user_id = $1 AND role = 'admin'",
        [id]
      );
    }

    // Audit log
    await logAdminAction(
      adminId,
      input.is_admin ? 'grant_admin' : 'revoke_admin',
      AdminTargetType.USER,
      id,
      { user_name: userCheck.rows[0].name }
    );

    res.json({
      success: true,
      message: input.is_admin
        ? 'Права администратора выданы'
        : 'Права администратора отозваны',
      is_admin: input.is_admin,
    });
  })
);

// ============================================
// POST MANAGEMENT ENDPOINTS
// ============================================

/**
 * GET /api/admin/posts
 * List posts with pagination and filters
 */
router.get(
  '/posts',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const params = adminPostsQuerySchema.parse(req.query);

    let whereClause = 'WHERE 1=1';
    const queryParams: unknown[] = [];
    let paramIndex = 1;

    // Search filter
    if (params.search) {
      whereClause += ` AND (p.title ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex})`;
      queryParams.push(`%${params.search}%`);
      paramIndex++;
    }

    // Type filter
    if (params.type !== 'all') {
      whereClause += ` AND p.type = $${paramIndex}`;
      queryParams.push(params.type);
      paramIndex++;
    }

    // Status filter
    if (params.status !== 'all') {
      whereClause += ` AND p.status = $${paramIndex}`;
      queryParams.push(params.status);
      paramIndex++;
    }

    // Comments enabled filter
    if (params.comments_enabled !== 'all') {
      whereClause += ` AND p.comments_enabled = $${paramIndex}`;
      queryParams.push(params.comments_enabled === 'enabled');
      paramIndex++;
    }

    // User filter
    if (params.user_id) {
      whereClause += ` AND p.user_id = $${paramIndex}`;
      queryParams.push(params.user_id);
      paramIndex++;
    }

    // Count query
    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM posts p ${whereClause}`,
      queryParams
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Main query
    const sortColumn = params.sort_by === 'title' ? 'p.title' :
                       params.sort_by === 'updated_at' ? 'p.updated_at' : 'p.created_at';

    const postsResult = await query<AdminPostWithStats>(
      `SELECT
        p.*,
        u.name as user_name,
        u.email as user_email,
        COALESCE(c.comments_count, 0)::int as comments_count
       FROM posts p
       JOIN users u ON u.id = p.user_id
       LEFT JOIN (
         SELECT post_id, COUNT(*) as comments_count FROM comments GROUP BY post_id
       ) c ON c.post_id = p.id
       ${whereClause}
       ORDER BY ${sortColumn} ${params.sort_order.toUpperCase()}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...queryParams, params.limit, params.offset]
    );

    const response: PaginatedResponse<AdminPostWithStats> = {
      data: postsResult.rows,
      total,
      limit: params.limit,
      offset: params.offset,
      has_more: params.offset + params.limit < total,
    };

    res.json(response);
  })
);

/**
 * GET /api/admin/posts/:id
 * Get post details
 */
router.get(
  '/posts/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    const result = await query<AdminPostWithStats>(
      `SELECT
        p.*,
        u.name as user_name,
        u.email as user_email,
        COALESCE(c.comments_count, 0)::int as comments_count
       FROM posts p
       JOIN users u ON u.id = p.user_id
       LEFT JOIN (
         SELECT post_id, COUNT(*) as comments_count FROM comments GROUP BY post_id
       ) c ON c.post_id = p.id
       WHERE p.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Публикация не найдена', 404);
    }

    res.json(result.rows[0]);
  })
);

/**
 * POST /api/admin/posts/:id/toggle-comments
 * Enable/disable comments on a post
 */
router.post(
  '/posts/:id/toggle-comments',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const input = toggleCommentsSchema.parse(req.body);
    const adminId = req.userId!;

    // Check if post exists
    const postCheck = await query<{ id: string }>(
      'SELECT id FROM posts WHERE id = $1',
      [id]
    );
    if (postCheck.rows.length === 0) {
      throw new AppError('Публикация не найдена', 404);
    }

    // Update post
    if (input.enabled) {
      await query(
        `UPDATE posts SET
          comments_enabled = TRUE,
          comments_disabled_by = NULL,
          comments_disabled_at = NULL,
          comments_disabled_reason = NULL
         WHERE id = $1`,
        [id]
      );
    } else {
      await query(
        `UPDATE posts SET
          comments_enabled = FALSE,
          comments_disabled_by = $1,
          comments_disabled_at = CURRENT_TIMESTAMP,
          comments_disabled_reason = $2
         WHERE id = $3`,
        [adminId, input.reason || null, id]
      );
    }

    // Audit log
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

/**
 * DELETE /api/admin/posts/:id
 * Admin delete a post
 */
router.delete(
  '/posts/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const input = deletePostSchema.parse(req.body);
    const adminId = req.userId!;

    // Check if post exists and get details for audit
    const postCheck = await query<{ id: string; title: string; user_id: string }>(
      'SELECT id, title, user_id FROM posts WHERE id = $1',
      [id]
    );
    if (postCheck.rows.length === 0) {
      throw new AppError('Публикация не найдена', 404);
    }

    const post = postCheck.rows[0];

    // Delete post (cascades to comments)
    await query('DELETE FROM posts WHERE id = $1', [id]);

    // Audit log
    await logAdminAction(adminId, 'delete_post', AdminTargetType.POST, id, {
      title: post.title,
      user_id: post.user_id,
      reason: input.reason,
    });

    res.json({ success: true, message: 'Публикация удалена' });
  })
);

// ============================================
// STATISTICS ENDPOINTS
// ============================================

/**
 * GET /api/admin/stats/overview
 * Dashboard overview statistics
 */
router.get(
  '/stats/overview',
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    const stats = await query<OverviewStats>(`
      SELECT
        (SELECT COUNT(*) FROM users)::int as total_users,
        (SELECT COUNT(*) FROM users WHERE created_at >= CURRENT_DATE)::int as new_users_today,
        (SELECT COUNT(*) FROM users WHERE created_at >= CURRENT_DATE - INTERVAL '7 days')::int as new_users_this_week,
        (SELECT COUNT(*) FROM users WHERE last_login_at >= CURRENT_DATE)::int as active_users_today,
        (SELECT COUNT(*) FROM posts)::int as total_posts,
        (SELECT COUNT(*) FROM posts WHERE status = 'OPEN')::int as open_posts,
        (SELECT COUNT(*) FROM posts WHERE status = 'RESOLVED')::int as resolved_posts,
        (SELECT COUNT(*) FROM posts WHERE created_at >= CURRENT_DATE)::int as new_posts_today,
        (SELECT COUNT(*) FROM posts WHERE created_at >= CURRENT_DATE - INTERVAL '7 days')::int as new_posts_this_week,
        (SELECT COUNT(*) FROM comments)::int as total_comments,
        (SELECT COUNT(*) FROM comments WHERE status = 'pending')::int as pending_comments,
        (SELECT COUNT(*) FROM comments WHERE status = 'flagged')::int as flagged_comments,
        (SELECT COUNT(*) FROM comments WHERE created_at >= CURRENT_DATE)::int as new_comments_today,
        (SELECT COUNT(*) FROM users WHERE ban_type IS NOT NULL)::int as banned_users
    `);

    res.json(stats.rows[0]);
  })
);

/**
 * GET /api/admin/stats/users
 * User statistics
 */
router.get(
  '/stats/users',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const params = statsDateRangeSchema.parse(req.query);

    // Basic counts
    const basicStats = await query<{
      total_users: number;
      banned_users: number;
      comment_banned_users: number;
    }>(`
      SELECT
        COUNT(*)::int as total_users,
        COUNT(*) FILTER (WHERE ban_type IS NOT NULL)::int as banned_users,
        COUNT(*) FILTER (WHERE ban_type = 'comment')::int as comment_banned_users
      FROM users
    `);

    // Users by day
    const usersByDay = await query<{ date: string; count: number }>(`
      SELECT
        DATE(created_at)::text as date,
        COUNT(*)::int as count
      FROM users
      WHERE created_at >= CURRENT_DATE - INTERVAL '${params.days} days'
      GROUP BY DATE(created_at)
      ORDER BY date
    `);

    // Active users by day
    const activeUsersByDay = await query<{ date: string; count: number }>(`
      SELECT
        DATE(last_login_at)::text as date,
        COUNT(*)::int as count
      FROM users
      WHERE last_login_at >= CURRENT_DATE - INTERVAL '${params.days} days'
      GROUP BY DATE(last_login_at)
      ORDER BY date
    `);

    // Top posters
    const topPosters = await query<{
      id: string;
      name: string;
      avatar_url: string | null;
      posts_count: number;
    }>(`
      SELECT
        u.id, u.name, u.avatar_url,
        COUNT(p.id)::int as posts_count
      FROM users u
      JOIN posts p ON p.user_id = u.id
      GROUP BY u.id, u.name, u.avatar_url
      ORDER BY posts_count DESC
      LIMIT 10
    `);

    // Top commenters
    const topCommenters = await query<{
      id: string;
      name: string;
      avatar_url: string | null;
      comments_count: number;
    }>(`
      SELECT
        u.id, u.name, u.avatar_url,
        COUNT(c.id)::int as comments_count
      FROM users u
      JOIN comments c ON c.user_id = u.id
      GROUP BY u.id, u.name, u.avatar_url
      ORDER BY comments_count DESC
      LIMIT 10
    `);

    const response: UserStats = {
      ...basicStats.rows[0],
      users_by_day: usersByDay.rows,
      active_users_by_day: activeUsersByDay.rows,
      top_posters: topPosters.rows,
      top_commenters: topCommenters.rows,
    };

    res.json(response);
  })
);

/**
 * GET /api/admin/stats/posts
 * Post statistics
 */
router.get(
  '/stats/posts',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const params = statsDateRangeSchema.parse(req.query);

    // Basic counts
    const basicStats = await query<{
      total_posts: number;
      open_posts: number;
      resolved_posts: number;
      lost_posts: number;
      found_posts: number;
    }>(`
      SELECT
        COUNT(*)::int as total_posts,
        COUNT(*) FILTER (WHERE status = 'OPEN')::int as open_posts,
        COUNT(*) FILTER (WHERE status = 'RESOLVED')::int as resolved_posts,
        COUNT(*) FILTER (WHERE type = 'LOST')::int as lost_posts,
        COUNT(*) FILTER (WHERE type = 'FOUND')::int as found_posts
      FROM posts
    `);

    // Posts by day
    const postsByDay = await query<{ date: string; count: number }>(`
      SELECT
        DATE(created_at)::text as date,
        COUNT(*)::int as count
      FROM posts
      WHERE created_at >= CURRENT_DATE - INTERVAL '${params.days} days'
      GROUP BY DATE(created_at)
      ORDER BY date
    `);

    // Posts by animal type
    const postsByAnimalType = await query<{ animal_type: string; count: number }>(`
      SELECT
        animal_type::text,
        COUNT(*)::int as count
      FROM posts
      GROUP BY animal_type
      ORDER BY count DESC
    `);

    // Resolution rate and avg time to resolve
    const resolutionStats = await query<{
      resolution_rate: number;
      avg_time_to_resolve_hours: number | null;
    }>(`
      SELECT
        COALESCE(
          (COUNT(*) FILTER (WHERE status = 'RESOLVED')::float / NULLIF(COUNT(*), 0)) * 100,
          0
        )::float as resolution_rate,
        EXTRACT(EPOCH FROM AVG(updated_at - created_at) FILTER (WHERE status = 'RESOLVED')) / 3600 as avg_time_to_resolve_hours
      FROM posts
    `);

    const response: PostStats = {
      total_posts: basicStats.rows[0].total_posts,
      open_posts: basicStats.rows[0].open_posts,
      resolved_posts: basicStats.rows[0].resolved_posts,
      posts_by_day: postsByDay.rows,
      posts_by_type: {
        lost: basicStats.rows[0].lost_posts,
        found: basicStats.rows[0].found_posts,
      },
      posts_by_animal_type: postsByAnimalType.rows,
      resolution_rate: resolutionStats.rows[0].resolution_rate,
      avg_time_to_resolve_hours: resolutionStats.rows[0].avg_time_to_resolve_hours,
    };

    res.json(response);
  })
);

/**
 * GET /api/admin/stats/comments
 * Comment statistics
 */
router.get(
  '/stats/comments',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const params = statsDateRangeSchema.parse(req.query);

    // Basic counts
    const basicStats = await query<{
      total_comments: number;
      pending: number;
      approved: number;
      rejected: number;
      flagged: number;
      pending_reports: number;
      avg_moderation_score: number | null;
    }>(`
      SELECT
        (SELECT COUNT(*) FROM comments)::int as total_comments,
        (SELECT COUNT(*) FROM comments WHERE status = 'pending')::int as pending,
        (SELECT COUNT(*) FROM comments WHERE status = 'approved')::int as approved,
        (SELECT COUNT(*) FROM comments WHERE status = 'rejected')::int as rejected,
        (SELECT COUNT(*) FROM comments WHERE status = 'flagged')::int as flagged,
        (SELECT COUNT(*) FROM comment_reports WHERE status = 'pending')::int as pending_reports,
        (SELECT AVG(ai_moderation_score) FROM comments WHERE ai_moderation_score IS NOT NULL)::float as avg_moderation_score
    `);

    // Comments by day
    const commentsByDay = await query<{ date: string; count: number }>(`
      SELECT
        DATE(created_at)::text as date,
        COUNT(*)::int as count
      FROM comments
      WHERE created_at >= CURRENT_DATE - INTERVAL '${params.days} days'
      GROUP BY DATE(created_at)
      ORDER BY date
    `);

    // Auto-approval and manual review rates
    const moderationRates = await query<{
      auto_approved_count: number;
      manual_review_count: number;
      total: number;
    }>(`
      SELECT
        COUNT(*) FILTER (WHERE ai_moderation_score >= 0.7 AND status = 'approved')::int as auto_approved_count,
        COUNT(*) FILTER (WHERE ai_moderation_score < 0.7 OR ai_moderation_score IS NULL)::int as manual_review_count,
        COUNT(*)::int as total
      FROM comments
    `);

    const rates = moderationRates.rows[0];
    const autoApprovedRate = rates.total > 0 ? (rates.auto_approved_count / rates.total) * 100 : 0;
    const manualReviewRate = rates.total > 0 ? (rates.manual_review_count / rates.total) * 100 : 0;

    const response: CommentStats = {
      total_comments: basicStats.rows[0].total_comments,
      comments_by_status: {
        pending: basicStats.rows[0].pending,
        approved: basicStats.rows[0].approved,
        rejected: basicStats.rows[0].rejected,
        flagged: basicStats.rows[0].flagged,
      },
      comments_by_day: commentsByDay.rows,
      pending_reports: basicStats.rows[0].pending_reports,
      avg_moderation_score: basicStats.rows[0].avg_moderation_score,
      auto_approved_rate: autoApprovedRate,
      manual_review_rate: manualReviewRate,
    };

    res.json(response);
  })
);

/**
 * GET /api/admin/audit-log
 * Admin audit log
 */
router.get(
  '/audit-log',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const params = auditLogQuerySchema.parse(req.query);

    let whereClause = 'WHERE 1=1';
    const queryParams: unknown[] = [];
    let paramIndex = 1;

    if (params.admin_id) {
      whereClause += ` AND al.admin_id = $${paramIndex}`;
      queryParams.push(params.admin_id);
      paramIndex++;
    }

    if (params.target_type !== 'all') {
      whereClause += ` AND al.target_type = $${paramIndex}`;
      queryParams.push(params.target_type);
      paramIndex++;
    }

    if (params.action) {
      whereClause += ` AND al.action = $${paramIndex}`;
      queryParams.push(params.action);
      paramIndex++;
    }

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM admin_audit_log al ${whereClause}`,
      queryParams
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const logResult = await query<AdminAuditLogEntry>(
      `SELECT
        al.*,
        u.name as admin_name
       FROM admin_audit_log al
       JOIN users u ON u.id = al.admin_id
       ${whereClause}
       ORDER BY al.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...queryParams, params.limit, params.offset]
    );

    const response: PaginatedResponse<AdminAuditLogEntry> = {
      data: logResult.rows,
      total,
      limit: params.limit,
      offset: params.offset,
      has_more: params.offset + params.limit < total,
    };

    res.json(response);
  })
);

export default router;
