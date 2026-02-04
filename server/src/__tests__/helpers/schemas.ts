import { z } from 'zod';

// ============================================
// BASE SCHEMAS
// ============================================

/**
 * User object schema - represents a user in API responses
 */
export const UserSchema = z
  .object({
    id: z.string(),
    yandex_id: z.string().optional(),
    name: z.string(),
    email: z.string(),
    avatar_url: z.string().nullable().optional(),
    created_at: z.string().optional(),
  })
  .strict();

/**
 * Embedded user in post responses (subset of full user)
 */
export const PostUserSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    avatar_url: z.string().nullable().optional(),
  })
  .strict();

/**
 * Single post schema with user relation
 */
export const PostSchema = z
  .object({
    id: z.string(),
    user_id: z.string(),
    type: z.enum(['LOST', 'FOUND']),
    animal_type: z.enum(['Dog', 'Cat', 'Bird', 'Other']),
    status: z.enum(['OPEN', 'RESOLVED']),
    title: z.string(),
    description: z.string(),
    location: z.string(),
    latitude: z.number().nullable().optional(),
    longitude: z.number().nullable().optional(),
    contact_info: z.string(),
    reward: z.union([z.string(), z.number()]).nullable().optional(),
    image_url: z.string().nullable().optional(),
    created_at: z.string(),
    updated_at: z.string(),
    user: PostUserSchema,
  })
  .strict();

// ============================================
// LIST RESPONSES
// ============================================

/**
 * GET /api/posts response schema
 */
export const PostsListSchema = z
  .object({
    posts: z.array(PostSchema),
    total: z.number(),
  })
  .strict();

/**
 * GET /api/search response schema
 */
export const SearchResultSchema = z
  .object({
    posts: z.array(PostSchema),
    total: z.number(),
    limit: z.number(),
    offset: z.number(),
  })
  .strict();

// ============================================
// MATCH RESULTS
// ============================================

/**
 * Single match result from /api/search/matches/:postId
 */
export const MatchItemSchema = z
  .object({
    postId: z.string(),
    reason: z.string(),
    confidence: z.number().min(0).max(1),
  })
  .strict();

/**
 * Match item schema - post with confidence and reason
 * Note: Uses passthrough() because match_score from DB is included in spread
 */
const MatchPostSchema = PostSchema.omit({})
  .extend({
    confidence: z.number().min(0).max(1),
    reason: z.string(),
    match_score: z.number().optional(), // Included from DB query spread
  })
  .passthrough();

/**
 * GET /api/search/matches/:postId response schema
 */
export const MatchResultSchema = z
  .object({
    matches: z.array(MatchPostSchema),
  })
  .strict();

// ============================================
// AUTH RESPONSES
// ============================================

/**
 * GET /api/auth/me response schema
 */
export const AuthMeSchema = UserSchema;

/**
 * POST /api/auth/dev/create-user response schema
 */
export const DevCreateUserSchema = z
  .object({
    user: UserSchema,
    token: z.string(),
  })
  .strict();

/**
 * POST /api/auth/logout response schema
 */
export const LogoutSchema = z
  .object({
    success: z.literal(true),
  })
  .strict();

// ============================================
// ERROR RESPONSES
// ============================================

/**
 * Standard error response schema
 */
export const ErrorSchema = z
  .object({
    error: z.string(),
  })
  .strict();

/**
 * Validation error response (400) with details
 */
export const ValidationErrorSchema = z
  .object({
    error: z.string(),
    details: z.array(z.any()).optional(),
  })
  .strict();

// ============================================
// TYPE EXPORTS
// ============================================

export type UserResponse = z.infer<typeof UserSchema>;
export type PostResponse = z.infer<typeof PostSchema>;
export type PostsListResponse = z.infer<typeof PostsListSchema>;
export type SearchResultResponse = z.infer<typeof SearchResultSchema>;
export type MatchResultResponse = z.infer<typeof MatchResultSchema>;
export type AuthMeResponse = z.infer<typeof AuthMeSchema>;
export type ErrorResponse = z.infer<typeof ErrorSchema>;
