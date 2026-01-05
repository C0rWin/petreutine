import Anthropic from '@anthropic-ai/sdk';
import {
  AIModerationResult,
  ModerationDecision,
  CommentStatus,
} from '../types/comments.js';

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
    console.log('[AI Moderation] Skipped - no API key configured');
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
    const responseText = response.content[0].type === 'text'
      ? response.content[0].text.trim()
      : '';

    // Parse JSON response
    try {
      const result = JSON.parse(responseText) as AIModerationResult;

      // Validate score is within range
      result.score = Math.max(0, Math.min(1, result.score));

      console.log('[AI Moderation]', {
        content: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
        score: result.score,
        categories: result.categories,
      });

      return result;
    } catch (parseError) {
      console.error('[AI Moderation] Failed to parse response:', responseText);
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
    console.error('[AI Moderation] API error:', error);

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
