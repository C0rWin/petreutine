import { eventBus, safeHandler } from '../events.js';
import {
  createCommentNotification,
  createUpvoteNotification,
  createModerationApprovedNotification,
  createModerationRejectedNotification,
} from '../notifications.js';

// Comment created -> notify post owner and parent comment author
eventBus.on(
  'comment.created',
  safeHandler('comment.created', async payload => {
    await createCommentNotification(payload.comment, payload.authorId, payload.postOwnerId);
  })
);

// Comment voted -> notify comment author on milestones
eventBus.on(
  'comment.voted',
  safeHandler('comment.voted', async payload => {
    if (payload.voteType === 'upvote') {
      await createUpvoteNotification(payload.commentId, payload.commentAuthorId, payload.voterId);
    }
  })
);

// Comment approved -> notify author
eventBus.on(
  'comment.approved',
  safeHandler('comment.approved', async payload => {
    await createModerationApprovedNotification(payload.commentId, payload.authorId);
  })
);

// Comment rejected -> notify author
eventBus.on(
  'comment.rejected',
  safeHandler('comment.rejected', async payload => {
    await createModerationRejectedNotification(payload.commentId, payload.authorId, payload.reason);
  })
);

console.log('[Handler] notificationHandler registered');
