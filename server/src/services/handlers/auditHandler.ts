import { eventBus, safeHandler } from '../events.js';

// Log important events for debugging/audit
eventBus.on(
  'post.deleted',
  safeHandler('post.deleted.audit', async payload => {
    console.log(
      `[Audit] Post ${payload.postId} deleted by ${payload.userId}. Reason: ${payload.reason || 'N/A'}`
    );
  })
);

eventBus.on(
  'comment.deleted',
  safeHandler('comment.deleted.audit', async payload => {
    console.log(
      `[Audit] Comment ${payload.commentId} deleted by ${payload.userId}. Reason: ${payload.reason || 'N/A'}`
    );
  })
);

eventBus.on(
  'moderation.failed',
  safeHandler('moderation.failed.audit', async payload => {
    console.log(
      `[Audit] Moderation failed for comment ${payload.commentId || 'unknown'}. Severity: ${payload.severity}. Error: ${payload.error}`
    );
  })
);

console.log('[Handler] auditHandler registered');
