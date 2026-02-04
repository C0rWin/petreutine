import { z } from 'zod';

// ============================================
// ENUMS
// ============================================

export enum BanType {
  FULL = 'full',
  COMMENT = 'comment',
}

export enum BanAction {
  BAN = 'ban',
  UNBAN = 'unban',
  MODIFY = 'modify',
}

export enum AdminTargetType {
  USER = 'user',
  POST = 'post',
  COMMENT = 'comment',
}

// ============================================
// INTERFACES
// ============================================

export interface AdminUser {
  id: string;
  yandex_id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  created_at: Date;
  updated_at: Date;
  last_login_at: Date | null;
  ban_type: BanType | null;
  ban_reason: string | null;
  banned_at: Date | null;
  banned_by: string | null;
  ban_expires_at: Date | null;
}

export interface AdminUserWithStats extends AdminUser {
  posts_count: number;
  comments_count: number;
  flagged_comments_count: number;
  rejected_comments_count: number;
  banned_by_name?: string | null;
  is_admin: boolean;
}

export interface AdminPost {
  id: string;
  user_id: string;
  type: 'LOST' | 'FOUND';
  animal_type: string;
  status: 'OPEN' | 'RESOLVED';
  title: string;
  description: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  contact_info: string;
  reward: string | null;
  image_url: string | null;
  created_at: Date;
  updated_at: Date;
  comments_enabled: boolean;
  comments_disabled_by: string | null;
  comments_disabled_at: Date | null;
  comments_disabled_reason: string | null;
}

export interface AdminPostWithStats extends AdminPost {
  user_name: string;
  user_email: string;
  comments_count: number;
  views_count?: number;
}

export interface BanHistoryEntry {
  id: string;
  user_id: string;
  admin_id: string;
  action: BanAction;
  ban_type: BanType | null;
  reason: string | null;
  duration_hours: number | null;
  created_at: Date;
  admin_name?: string;
}

export interface AdminAuditLogEntry {
  id: string;
  admin_id: string;
  action: string;
  target_type: AdminTargetType;
  target_id: string;
  details: Record<string, unknown> | null;
  created_at: Date;
  admin_name?: string;
}

// Statistics interfaces
export interface OverviewStats {
  total_users: number;
  new_users_today: number;
  new_users_this_week: number;
  active_users_today: number;
  total_posts: number;
  open_posts: number;
  resolved_posts: number;
  new_posts_today: number;
  new_posts_this_week: number;
  total_comments: number;
  pending_comments: number;
  flagged_comments: number;
  new_comments_today: number;
  banned_users: number;
}

export interface UserStats {
  total_users: number;
  users_by_day: Array<{ date: string; count: number }>;
  active_users_by_day: Array<{ date: string; count: number }>;
  banned_users: number;
  comment_banned_users: number;
  top_posters: Array<{ id: string; name: string; avatar_url: string | null; posts_count: number }>;
  top_commenters: Array<{
    id: string;
    name: string;
    avatar_url: string | null;
    comments_count: number;
  }>;
}

export interface PostStats {
  total_posts: number;
  open_posts: number;
  resolved_posts: number;
  posts_by_day: Array<{ date: string; count: number }>;
  posts_by_type: { lost: number; found: number };
  posts_by_animal_type: Array<{ animal_type: string; count: number }>;
  resolution_rate: number;
  avg_time_to_resolve_hours: number | null;
}

export interface CommentStats {
  total_comments: number;
  comments_by_status: { pending: number; approved: number; rejected: number; flagged: number };
  comments_by_day: Array<{ date: string; count: number }>;
  pending_reports: number;
  avg_moderation_score: number | null;
  auto_approved_rate: number;
  manual_review_rate: number;
}

// Pagination response wrapper
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

// ============================================
// ZOD VALIDATION SCHEMAS
// ============================================

// Query schemas for list endpoints
export const adminUsersQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  search: z.string().optional(),
  sort_by: z.enum(['created_at', 'last_login_at', 'name', 'email']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
  ban_status: z
    .enum(['all', 'banned', 'not_banned', 'comment_banned', 'full_banned'])
    .default('all'),
});

export const adminPostsQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  search: z.string().optional(),
  sort_by: z.enum(['created_at', 'updated_at', 'title']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
  type: z.enum(['all', 'LOST', 'FOUND']).default('all'),
  status: z.enum(['all', 'OPEN', 'RESOLVED']).default('all'),
  comments_enabled: z.enum(['all', 'enabled', 'disabled']).default('all'),
  user_id: z.string().uuid().optional(),
});

export const adminCommentsQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  user_id: z.string().uuid().optional(),
  post_id: z.string().uuid().optional(),
  status: z.enum(['all', 'pending', 'approved', 'rejected', 'flagged']).default('all'),
  sort_by: z.enum(['created_at', 'score']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
});

export const banHistoryQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

export const auditLogQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
  admin_id: z.string().uuid().optional(),
  target_type: z.enum(['all', 'user', 'post', 'comment']).default('all'),
  action: z.string().optional(),
});

export const statsDateRangeSchema = z.object({
  days: z.coerce.number().min(1).max(365).default(30),
});

// Action schemas
export const banUserSchema = z.object({
  ban_type: z.nativeEnum(BanType),
  reason: z.string().min(1, 'Причина бана обязательна').max(500, 'Причина слишком длинная'),
  duration_hours: z.number().positive().optional(), // null/undefined = permanent
});

export const unbanUserSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const toggleCommentsSchema = z.object({
  enabled: z.boolean(),
  reason: z.string().max(500).optional(),
});

export const deletePostSchema = z.object({
  reason: z.string().min(1, 'Причина удаления обязательна').max(500),
});

export const toggleAdminSchema = z.object({
  is_admin: z.boolean(),
});

// ============================================
// TYPE INFERENCES
// ============================================

export type AdminUsersQuery = z.infer<typeof adminUsersQuerySchema>;
export type AdminPostsQuery = z.infer<typeof adminPostsQuerySchema>;
export type AdminCommentsQuery = z.infer<typeof adminCommentsQuerySchema>;
export type BanHistoryQuery = z.infer<typeof banHistoryQuerySchema>;
export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;
export type StatsDateRange = z.infer<typeof statsDateRangeSchema>;
export type BanUserInput = z.infer<typeof banUserSchema>;
export type UnbanUserInput = z.infer<typeof unbanUserSchema>;
export type ToggleCommentsInput = z.infer<typeof toggleCommentsSchema>;
export type DeletePostInput = z.infer<typeof deletePostSchema>;
export type ToggleAdminInput = z.infer<typeof toggleAdminSchema>;
