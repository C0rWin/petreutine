import React, { useState } from 'react';
import { Comment, VoteType, ReportReason } from '../../types';
import { CommentItem } from './CommentItem';

interface CommentThreadProps {
  comments: Comment[];
  currentUserId?: string | null;
  isAuthenticated: boolean;
  onVote: (commentId: string, voteType: VoteType) => Promise<void>;
  onRemoveVote: (commentId: string) => Promise<void>;
  onReply: (parentId: string, content: string) => Promise<void>;
  onEdit: (commentId: string, content: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  onReport: (commentId: string, reason: ReportReason, description?: string) => Promise<void>;
  onLoginClick?: () => void;
  maxDepth?: number;
}

interface CollapsibleThreadProps extends CommentThreadProps {
  comment: Comment;
  depth: number;
}

const CollapsibleThread: React.FC<CollapsibleThreadProps> = ({
  comment,
  depth,
  maxDepth = 10,
  ...props
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const hasReplies = comment.replies && comment.replies.length > 0;
  const shouldCollapse = depth >= maxDepth;

  return (
    <div className="relative">
      {/* Collapse button for deep threads */}
      {hasReplies && (
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute left-0 top-3 -translate-x-full pr-2 text-gray-400 hover:text-gray-600 transition-colors"
          title={isCollapsed ? 'Развернуть' : 'Свернуть'}
        >
          <svg
            className={`w-4 h-4 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      <CommentItem comment={comment} {...props} />

      {/* Replies */}
      {hasReplies && !isCollapsed && (
        <div className="mt-1">
          {shouldCollapse ? (
            <button
              onClick={() => setIsCollapsed(false)}
              className="ml-6 pl-4 text-sm text-teal-600 hover:text-teal-700 py-2"
            >
              Показать {comment.replies!.length} ответов...
            </button>
          ) : (
            comment.replies!.map(reply => (
              <CollapsibleThread
                key={reply.id}
                comment={reply}
                depth={depth + 1}
                maxDepth={maxDepth}
                {...props}
              />
            ))
          )}
        </div>
      )}

      {/* Collapsed indicator */}
      {hasReplies && isCollapsed && (
        <button
          onClick={() => setIsCollapsed(false)}
          className="ml-6 pl-4 text-sm text-gray-500 hover:text-teal-600 py-2 flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          {comment.reply_count} {pluralizeReplies(comment.reply_count)} скрыто
        </button>
      )}
    </div>
  );
};

function pluralizeReplies(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;

  if (mod100 >= 11 && mod100 <= 19) return 'ответов';
  if (mod10 === 1) return 'ответ';
  if (mod10 >= 2 && mod10 <= 4) return 'ответа';
  return 'ответов';
}

export const CommentThread: React.FC<CommentThreadProps> = ({
  comments,
  maxDepth = 10,
  ...props
}) => {
  if (!comments || comments.length === 0) {
    return null;
  }

  return (
    <div className="space-y-1">
      {comments.map(comment => (
        <CollapsibleThread
          key={comment.id}
          comment={comment}
          depth={0}
          maxDepth={maxDepth}
          comments={comments}
          {...props}
        />
      ))}
    </div>
  );
};

export default CommentThread;
