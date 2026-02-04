import { EventEmitter } from 'events';

import { CommentWithUser } from '../types/comments.js';

// Define event payload types
export interface AppEvents {
  // Comment events
  'comment.created': {
    comment: CommentWithUser;
    authorId: string;
    postOwnerId: string;
  };
  'comment.updated': {
    commentId: string;
    userId: string;
  };
  'comment.deleted': {
    commentId: string;
    userId: string;
    reason?: string;
  };
  'comment.approved': {
    commentId: string;
    authorId: string;
  };
  'comment.rejected': {
    commentId: string;
    authorId: string;
    reason?: string;
  };
  'comment.voted': {
    commentId: string;
    commentAuthorId: string;
    voterId: string;
    voteType: 'upvote' | 'downvote';
  };

  // Post events
  'post.created': {
    postId: string;
    userId: string;
  };
  'post.updated': {
    postId: string;
    userId: string;
  };
  'post.deleted': {
    postId: string;
    userId: string;
    reason?: string;
  };

  // Moderation events
  'moderation.failed': {
    commentId?: string;
    error: string;
    severity: 'ERROR' | 'WARN' | 'INFO';
    content: string;
  };
}

// Type-safe wrapper around EventEmitter
class TypedEventEmitter extends EventEmitter {
  emit<K extends keyof AppEvents>(event: K, payload: AppEvents[K]): boolean {
    return super.emit(event, payload);
  }

  on<K extends keyof AppEvents>(
    event: K,
    listener: (payload: AppEvents[K]) => void | Promise<void>
  ): this {
    return super.on(event, listener);
  }

  once<K extends keyof AppEvents>(
    event: K,
    listener: (payload: AppEvents[K]) => void | Promise<void>
  ): this {
    return super.once(event, listener);
  }
}

// Singleton event bus
export const eventBus = new TypedEventEmitter();

// Safe handler wrapper - prevents unhandled promise rejections
export function safeHandler<T>(
  handlerName: string,
  handler: (payload: T) => Promise<void>
): (payload: T) => void {
  return (payload: T) => {
    handler(payload).catch(error => {
      console.error(`[Event Handler] ${handlerName} error:`, error);
    });
  };
}

// Handler registration function - called on startup
export async function registerEventHandlers(): Promise<void> {
  // Import all handlers - they self-register when imported
  const handlers = await Promise.allSettled([
    import('./handlers/notificationHandler.js'),
    import('./handlers/auditHandler.js'),
  ]);

  // Log registration results
  handlers.forEach((result, index) => {
    const names = ['notificationHandler', 'auditHandler'];
    if (result.status === 'rejected') {
      console.error(`[Events] Failed to load ${names[index]}:`, result.reason);
    }
    // Success case logged silently
  });
}
