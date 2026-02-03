import { z } from 'zod';

// ============================================
// ENUMS
// ============================================

export enum CommentStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  FLAGGED = 'flagged',
}

export enum VoteType {
  UPVOTE = 'upvote',
  DOWNVOTE = 'downvote',
}

export enum ReportReason {
  SPAM = 'spam',
  HARASSMENT = 'harassment',
  OFF_TOPIC = 'off_topic',
  MISINFORMATION = 'misinformation',
  OTHER = 'other',
}

export enum ReportStatus {
  PENDING = 'pending',
  REVIEWED = 'reviewed',
  RESOLVED = 'resolved',
  DISMISSED = 'dismissed',
}

export enum NotificationType {
  COMMENT_REPLY = 'comment_reply',
  POST_COMMENT = 'post_comment',
  COMMENT_UPVOTE = 'comment_upvote',
  MODERATION_APPROVED = 'moderation_approved',
  MODERATION_REJECTED = 'moderation_rejected',
  MODERATION_ALERT = 'moderation_alert',  // AI moderation failure alerts for admins
}

// ============================================
// INTERFACES
// ============================================

export interface CommentUser {
  id: string;
  name: string;
  avatar_url: string | null;
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  status: CommentStatus;
  ai_moderation_score: number | null;
  ai_moderation_reason: string | null;
  upvotes: number;
  downvotes: number;
  score: number;
  depth: number;
  path: string;
  reply_count: number;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface CommentWithUser extends Comment {
  user: CommentUser;
  current_user_vote?: VoteType | null;
  replies?: CommentWithUser[];
}

export interface CommentVote {
  id: string;
  comment_id: string;
  user_id: string;
  vote_type: VoteType;
  created_at: Date;
}

export interface CommentReport {
  id: string;
  comment_id: string;
  reporter_id: string;
  reason: ReportReason;
  description: string | null;
  status: ReportStatus;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  resolution_note: string | null;
  created_at: Date;
}

export interface CommentReportWithDetails extends CommentReport {
  comment: CommentWithUser;
  reporter: CommentUser;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  related_post_id: string | null;
  related_comment_id: string | null;
  actor_id: string | null;
  is_read: boolean;
  read_at: Date | null;
  created_at: Date;
}

export interface NotificationWithActor extends Notification {
  actor?: CommentUser | null;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: 'admin' | 'moderator';
  granted_by: string | null;
  created_at: Date;
}

// ============================================
// ZOD VALIDATION SCHEMAS
// ============================================

export const createCommentSchema = z.object({
  post_id: z.string().uuid(),
  parent_id: z.string().uuid().nullable().optional(),
  content: z.string().min(1, 'Комментарий не может быть пустым').max(2000, 'Комментарий слишком длинный'),
});

export const updateCommentSchema = z.object({
  content: z.string().min(1, 'Комментарий не может быть пустым').max(2000, 'Комментарий слишком длинный'),
});

export const voteSchema = z.object({
  vote_type: z.nativeEnum(VoteType),
});

export const reportCommentSchema = z.object({
  reason: z.nativeEnum(ReportReason),
  description: z.string().max(500).optional(),
});

export const moderateCommentSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  reason: z.string().max(500).optional(),
});

export const resolveReportSchema = z.object({
  status: z.enum(['resolved', 'dismissed']),
  resolution_note: z.string().max(500).optional(),
});

export const getCommentsQuerySchema = z.object({
  sort: z.enum(['best', 'new', 'old', 'controversial']).default('best'),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

export const getNotificationsQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(50).default(20),
  offset: z.coerce.number().min(0).default(0),
  unread_only: z.coerce.boolean().default(false),
});

// ============================================
// TYPE INFERENCES
// ============================================

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;
export type VoteInput = z.infer<typeof voteSchema>;
export type ReportCommentInput = z.infer<typeof reportCommentSchema>;
export type ModerateCommentInput = z.infer<typeof moderateCommentSchema>;
export type ResolveReportInput = z.infer<typeof resolveReportSchema>;
export type GetCommentsQuery = z.infer<typeof getCommentsQuerySchema>;
export type GetNotificationsQuery = z.infer<typeof getNotificationsQuerySchema>;

// ============================================
// AI MODERATION TYPES
// ============================================

export interface AIModerationResult {
  score: number; // 0.0 (harmful) to 1.0 (safe)
  reason: string;
  categories: {
    spam: boolean;
    toxicity: boolean;
    off_topic: boolean;
    misinformation: boolean;
  };
}

export interface ModerationDecision {
  status: CommentStatus;
  shouldAutoApprove: boolean;
  shouldAutoReject: boolean;
  requiresReview: boolean;
}
