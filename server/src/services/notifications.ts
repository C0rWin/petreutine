import { query } from '../db/index.js';
import { CommentWithUser, NotificationType } from '../types/comments.js';

/**
 * Creates notifications when a new comment is posted
 */
export async function createCommentNotification(
  comment: CommentWithUser,
  authorId: string,
  postOwnerId: string
): Promise<void> {
  try {
    // Get author name for notification message
    const authorResult = await query<{ name: string }>('SELECT name FROM users WHERE id = $1', [
      authorId,
    ]);
    const authorName = authorResult.rows[0]?.name || 'Пользователь';

    // Get post title for context
    const postResult = await query<{ title: string }>('SELECT title FROM posts WHERE id = $1', [
      comment.post_id,
    ]);
    const postTitle = postResult.rows[0]?.title || 'объявление';

    // If this is a reply, notify the parent comment author
    if (comment.parent_id) {
      const parentResult = await query<{ user_id: string }>(
        'SELECT user_id FROM comments WHERE id = $1',
        [comment.parent_id]
      );

      if (parentResult.rows.length > 0) {
        const parentAuthorId = parentResult.rows[0].user_id;

        // Don't notify yourself
        if (parentAuthorId !== authorId) {
          await query(
            `
            INSERT INTO notifications (user_id, type, title, message, related_post_id, related_comment_id, actor_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            `,
            [
              parentAuthorId,
              NotificationType.COMMENT_REPLY,
              'Новый ответ на ваш комментарий',
              `${authorName} ответил на ваш комментарий к "${truncate(postTitle, 50)}"`,
              comment.post_id,
              comment.id,
              authorId,
            ]
          );
        }
      }
    }

    // Notify post owner about new comment (if not replying to their comment already and not their own comment)
    if (postOwnerId !== authorId) {
      // Check if we already notified them as parent comment author
      const isReplyToPostOwner =
        comment.parent_id && (await isCommentByUser(comment.parent_id, postOwnerId));

      if (!isReplyToPostOwner) {
        await query(
          `
          INSERT INTO notifications (user_id, type, title, message, related_post_id, related_comment_id, actor_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          `,
          [
            postOwnerId,
            NotificationType.POST_COMMENT,
            'Новый комментарий к вашему объявлению',
            `${authorName} оставил комментарий к "${truncate(postTitle, 50)}"`,
            comment.post_id,
            comment.id,
            authorId,
          ]
        );
      }
    }
  } catch (error) {
    // Log but don't fail the comment creation
    console.error('[Notifications] Error creating comment notification:', error);
  }
}

/**
 * Creates notification when a comment is upvoted
 */
export async function createUpvoteNotification(
  commentId: string,
  commentAuthorId: string,
  voterId: string
): Promise<void> {
  try {
    // Don't notify for self-votes
    if (commentAuthorId === voterId) {
      return;
    }

    // Get voter name
    const voterResult = await query<{ name: string }>('SELECT name FROM users WHERE id = $1', [
      voterId,
    ]);
    const voterName = voterResult.rows[0]?.name || 'Пользователь';

    // Get comment and post info
    const commentResult = await query<{ post_id: string; upvotes: number }>(
      'SELECT post_id, upvotes FROM comments WHERE id = $1',
      [commentId]
    );

    if (commentResult.rows.length === 0) {
      return;
    }

    const { post_id, upvotes } = commentResult.rows[0];

    // Only notify on milestone upvotes (1, 5, 10, 25, 50, 100...)
    const milestones = [1, 5, 10, 25, 50, 100, 250, 500, 1000];
    if (!milestones.includes(upvotes)) {
      return;
    }

    await query(
      `
      INSERT INTO notifications (user_id, type, title, message, related_post_id, related_comment_id, actor_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        commentAuthorId,
        NotificationType.COMMENT_UPVOTE,
        `Ваш комментарий получил ${upvotes} ${pluralizeVotes(upvotes)}`,
        `${voterName} и другие оценили ваш комментарий`,
        post_id,
        commentId,
        voterId,
      ]
    );
  } catch (error) {
    console.error('[Notifications] Error creating upvote notification:', error);
  }
}

/**
 * Creates notification when comment is approved by moderator
 */
export async function createModerationApprovedNotification(
  commentId: string,
  commentAuthorId: string
): Promise<void> {
  try {
    const commentResult = await query<{ post_id: string }>(
      'SELECT post_id FROM comments WHERE id = $1',
      [commentId]
    );

    if (commentResult.rows.length === 0) {
      return;
    }

    await query(
      `
      INSERT INTO notifications (user_id, type, title, message, related_post_id, related_comment_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [
        commentAuthorId,
        NotificationType.MODERATION_APPROVED,
        'Ваш комментарий опубликован',
        'Ваш комментарий прошёл модерацию и теперь виден всем',
        commentResult.rows[0].post_id,
        commentId,
      ]
    );
  } catch (error) {
    console.error('[Notifications] Error creating moderation approved notification:', error);
  }
}

/**
 * Creates notification when comment is rejected by moderator
 */
export async function createModerationRejectedNotification(
  commentId: string,
  commentAuthorId: string,
  reason?: string
): Promise<void> {
  try {
    const commentResult = await query<{ post_id: string }>(
      'SELECT post_id FROM comments WHERE id = $1',
      [commentId]
    );

    if (commentResult.rows.length === 0) {
      return;
    }

    await query(
      `
      INSERT INTO notifications (user_id, type, title, message, related_post_id, related_comment_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [
        commentAuthorId,
        NotificationType.MODERATION_REJECTED,
        'Ваш комментарий отклонён',
        reason || 'Ваш комментарий не прошёл модерацию',
        commentResult.rows[0].post_id,
        commentId,
      ]
    );
  } catch (error) {
    console.error('[Notifications] Error creating moderation rejected notification:', error);
  }
}

// Helper functions

async function isCommentByUser(commentId: string, userId: string): Promise<boolean> {
  const result = await query<{ user_id: string }>('SELECT user_id FROM comments WHERE id = $1', [
    commentId,
  ]);
  return result.rows.length > 0 && result.rows[0].user_id === userId;
}

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.substring(0, maxLength - 3) + '...';
}

function pluralizeVotes(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;

  if (mod100 >= 11 && mod100 <= 19) {
    return 'голосов';
  }
  if (mod10 === 1) {
    return 'голос';
  }
  if (mod10 >= 2 && mod10 <= 4) {
    return 'голоса';
  }
  return 'голосов';
}
