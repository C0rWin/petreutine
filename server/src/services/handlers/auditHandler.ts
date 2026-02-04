import { eventBus, safeHandler } from '../events.js';

// Log important events for debugging/audit using structured JSON logs
eventBus.on(
  'post.deleted',
  safeHandler('post.deleted.audit', async payload => {
    process.stdout.write(
      JSON.stringify({
        type: 'audit',
        event: 'post.deleted',
        postId: payload.postId,
        userId: payload.userId,
        reason: payload.reason || 'N/A',
        timestamp: new Date().toISOString(),
      }) + '\n'
    );
  })
);

eventBus.on(
  'comment.deleted',
  safeHandler('comment.deleted.audit', async payload => {
    process.stdout.write(
      JSON.stringify({
        type: 'audit',
        event: 'comment.deleted',
        commentId: payload.commentId,
        userId: payload.userId,
        reason: payload.reason || 'N/A',
        timestamp: new Date().toISOString(),
      }) + '\n'
    );
  })
);

eventBus.on(
  'moderation.failed',
  safeHandler('moderation.failed.audit', async payload => {
    process.stdout.write(
      JSON.stringify({
        type: 'audit',
        event: 'moderation.failed',
        commentId: payload.commentId || 'unknown',
        severity: payload.severity,
        error: payload.error,
        timestamp: new Date().toISOString(),
      }) + '\n'
    );
  })
);

// Handler registered silently
