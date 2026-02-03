import { Router, Response } from 'express';
import { query } from '../../db/index.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import {
  statsDateRangeSchema,
  OverviewStats,
  UserStats,
  PostStats,
  CommentStats,
} from '../../types/admin.js';

const router = Router();

/**
 * GET /overview
 * Dashboard overview statistics
 */
router.get(
  '/overview',
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
 * GET /users
 * User statistics with date range
 */
router.get(
  '/users',
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
    const usersByDay = await query<{ date: string; count: number }>(
      `SELECT
        DATE(created_at)::text as date,
        COUNT(*)::int as count
      FROM users
      WHERE created_at >= CURRENT_DATE - INTERVAL '1 day' * $1
      GROUP BY DATE(created_at)
      ORDER BY date`,
      [params.days]
    );

    // Active users by day
    const activeUsersByDay = await query<{ date: string; count: number }>(
      `SELECT
        DATE(last_login_at)::text as date,
        COUNT(*)::int as count
      FROM users
      WHERE last_login_at >= CURRENT_DATE - INTERVAL '1 day' * $1
      GROUP BY DATE(last_login_at)
      ORDER BY date`,
      [params.days]
    );

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
 * GET /posts
 * Post statistics with date range
 */
router.get(
  '/posts',
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
    const postsByDay = await query<{ date: string; count: number }>(
      `SELECT
        DATE(created_at)::text as date,
        COUNT(*)::int as count
      FROM posts
      WHERE created_at >= CURRENT_DATE - INTERVAL '1 day' * $1
      GROUP BY DATE(created_at)
      ORDER BY date`,
      [params.days]
    );

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
 * GET /comments
 * Comment statistics with date range
 */
router.get(
  '/comments',
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
    const commentsByDay = await query<{ date: string; count: number }>(
      `SELECT
        DATE(created_at)::text as date,
        COUNT(*)::int as count
      FROM comments
      WHERE created_at >= CURRENT_DATE - INTERVAL '1 day' * $1
      GROUP BY DATE(created_at)
      ORDER BY date`,
      [params.days]
    );

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

export default router;
