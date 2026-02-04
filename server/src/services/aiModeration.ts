import Anthropic from '@anthropic-ai/sdk';

import { query } from '../db/index.js';
import {
  AIModerationResult,
  CommentStatus,
  ModerationDecision,
  NotificationType,
} from '../types/comments.js';

// ============================================
// LOGGING INFRASTRUCTURE
// ============================================

export enum LogSeverity {
  ERROR = 'ERROR',
  WARN = 'WARN',
  INFO = 'INFO',
}

interface ModerationLogContext {
  commentId?: string;
  content: string;
  score?: number;
  error?: string;
}

function logModerationEvent(
  severity: LogSeverity,
  message: string,
  context: ModerationLogContext
): void {
  const prefix = `[AI_MOD_${severity}]`;
  const timestamp = new Date().toISOString();
  // Include full content for debugging - do NOT truncate
  process.stdout.write(`${prefix} ${timestamp} ${message} ${JSON.stringify(context, null, 2)}\n`);
}

// ============================================
// ADMIN NOTIFICATION
// ============================================

async function notifyAdminsOfModerationFailure(
  commentId: string | undefined,
  error: string,
  content: string
): Promise<void> {
  try {
    // Get all admin user IDs
    const admins = await query<{ user_id: string }>(
      `SELECT user_id FROM user_roles WHERE role = 'admin'`
    );

    // Create notification for each admin with full INSERT query
    for (const admin of admins.rows) {
      await query(
        `INSERT INTO notifications (
          id,
          user_id,
          type,
          title,
          message,
          related_comment_id,
          is_read,
          created_at
        ) VALUES (
          gen_random_uuid(),
          $1,
          $2::notification_type,
          $3,
          $4,
          $5,
          false,
          NOW()
        )`,
        [
          admin.user_id,
          NotificationType.MODERATION_ALERT,
          'AI Moderation Failure',
          `AI moderation failed: ${error}. Content requires manual review.`,
          commentId || null,
        ]
      );
    }

    logModerationEvent(
      LogSeverity.INFO,
      `Notified ${admins.rows.length} admins of moderation failure`,
      {
        commentId,
        content,
        error,
      }
    );
  } catch (notifyError) {
    // Log but don't fail if notification fails
    console.error('[AI_MOD_ERROR] Failed to notify admins:', notifyError);
  }
}

// ============================================
// ANTHROPIC CLIENT
// ============================================

// Initialize Anthropic client (uses ANTHROPIC_API_KEY env var by default)
let anthropic: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!anthropic) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.warn('ANTHROPIC_API_KEY not set - AI moderation will be disabled');
    }
    anthropic = new Anthropic({
      apiKey: apiKey || 'dummy-key-for-fallback',
    });
  }
  return anthropic;
}

// Moderation thresholds (configurable via env)
const AUTO_APPROVE_THRESHOLD = parseFloat(process.env.AI_AUTO_APPROVE_THRESHOLD || '0.9');
const AUTO_REJECT_THRESHOLD = parseFloat(process.env.AI_AUTO_REJECT_THRESHOLD || '0.3');

/**
 * Moderates content using Claude AI
 * Returns a score from 0.0 (harmful) to 1.0 (safe)
 */
export async function moderateContent(content: string): Promise<AIModerationResult> {
  // Skip AI moderation if no API key is configured
  if (!process.env.ANTHROPIC_API_KEY) {
    logModerationEvent(LogSeverity.INFO, 'Skipped - no API key configured', {
      content: content,
    });
    return {
      score: 0.75, // Default to pending review
      reason: 'Автоматическая модерация отключена',
      categories: {
        spam: false,
        toxicity: false,
        off_topic: false,
        misinformation: false,
      },
    };
  }

  try {
    const client = getAnthropicClient();

    const response = await client.messages.create({
      model: 'claude-3-haiku-20240307', // Fast and cost-effective for moderation
      max_tokens: 500,
      system: `You are a content moderation assistant for a Russian-language pet lost-and-found application called "ДомойСкорей".

Users post about lost or found pets, and other users can comment to help locate pets or provide information.

EVALUATE THE COMMENT FOR:
1. **Spam** - Unrelated advertising, promotional links, repetitive content
2. **Toxicity** - Insults, harassment, hate speech, threats
3. **Off-topic** - Content completely unrelated to helping find pets (politics, unrelated discussions)
4. **Misinformation** - False claims about pets, owners, or misleading information

APPROPRIATE COMMENTS include:
- Sightings of the pet
- Questions about the pet's appearance or location
- Tips for finding lost pets
- Contact information sharing
- Words of support and encouragement
- Clarifying questions

RESPOND IN VALID JSON FORMAT ONLY (no markdown, no backticks):
{
  "score": <number from 0.0 to 1.0, where 1.0 is completely safe>,
  "reason": "<brief explanation in Russian, 1-2 sentences>",
  "categories": {
    "spam": <boolean>,
    "toxicity": <boolean>,
    "off_topic": <boolean>,
    "misinformation": <boolean>
  }
}`,
      messages: [
        {
          role: 'user',
          content: `Проанализируй этот комментарий: "${content}"`,
        },
      ],
    });

    // Extract text response
    const responseText = response.content[0].type === 'text' ? response.content[0].text.trim() : '';

    // Parse JSON response
    try {
      const result = JSON.parse(responseText) as AIModerationResult;

      // Validate score is within range
      result.score = Math.max(0, Math.min(1, result.score));

      logModerationEvent(LogSeverity.INFO, 'AI moderation succeeded', {
        content: content,
        score: result.score,
      });

      return result;
    } catch {
      logModerationEvent(LogSeverity.WARN, 'Failed to parse AI response', {
        content: content,
        error: responseText,
      });
      // Return moderate score on parse error
      return {
        score: 0.5,
        reason: 'Не удалось обработать результат модерации',
        categories: {
          spam: false,
          toxicity: false,
          off_topic: false,
          misinformation: false,
        },
      };
    }
  } catch (error) {
    logModerationEvent(LogSeverity.ERROR, 'AI moderation API error', {
      content: content,
      error: String(error),
    });

    // CRITICAL: Notify admins for ERROR severity
    await notifyAdminsOfModerationFailure(undefined, String(error), content);

    // On API error, default to pending review
    return {
      score: 0.5,
      reason: 'Ошибка при автоматической проверке',
      categories: {
        spam: false,
        toxicity: false,
        off_topic: false,
        misinformation: false,
      },
    };
  }
}

/**
 * Determines moderation decision based on AI score
 */
export function getModerationDecision(result: AIModerationResult): ModerationDecision {
  const { score, categories } = result;

  // Auto-reject if any serious category is flagged
  if (categories.toxicity || categories.spam) {
    return {
      status: CommentStatus.REJECTED,
      shouldAutoApprove: false,
      shouldAutoReject: true,
      requiresReview: false,
    };
  }

  // Auto-approve high-confidence safe content
  if (score >= AUTO_APPROVE_THRESHOLD) {
    return {
      status: CommentStatus.APPROVED,
      shouldAutoApprove: true,
      shouldAutoReject: false,
      requiresReview: false,
    };
  }

  // Auto-reject low-confidence content
  if (score <= AUTO_REJECT_THRESHOLD) {
    return {
      status: CommentStatus.REJECTED,
      shouldAutoApprove: false,
      shouldAutoReject: true,
      requiresReview: false,
    };
  }

  // Send to moderation queue
  return {
    status: CommentStatus.PENDING,
    shouldAutoApprove: false,
    shouldAutoReject: false,
    requiresReview: true,
  };
}

/**
 * Quick check for obviously safe content (simple heuristics)
 * Can be used to skip AI moderation for clearly benign content
 */
export function quickSafetyCheck(content: string): boolean {
  const trimmed = content.trim();

  // Too short to be harmful
  if (trimmed.length < 10) {
    return true;
  }

  // Contains only emojis and simple punctuation
  const emojiOnlyPattern = /^[\p{Emoji}\s.,!?]+$/u;
  if (emojiOnlyPattern.test(trimmed)) {
    return true;
  }

  // Simple supportive phrases
  const supportivePhrases = [
    'удачи',
    'надеюсь найдете',
    'надеюсь найдётся',
    'скорее домой',
    'держитесь',
    'желаю найти',
  ];
  const lowerContent = trimmed.toLowerCase();
  if (supportivePhrases.some(phrase => lowerContent.includes(phrase))) {
    return true;
  }

  return false;
}

/**
 * Moderates content with context (commentId) for traceability
 * Use this when you have a commentId available
 */
export async function moderateContentWithContext(
  content: string,
  commentId: string
): Promise<AIModerationResult> {
  const result = await moderateContent(content);

  // Log with commentId for traceability on low scores
  if (result.score < 0.5) {
    logModerationEvent(LogSeverity.WARN, 'Low moderation score', {
      commentId,
      content,
      score: result.score,
    });
  }

  return result;
}
