import React, { useState, useEffect, useCallback } from 'react';
import { Comment, VoteType, ReportReason } from '../../types';
import { api } from '../../services/api';
import { CommentForm } from './CommentForm';
import { CommentThread } from './CommentThread';

interface CommentSectionProps {
  postId: string;
  isAuthenticated: boolean;
  currentUserId?: string | null;
  onLoginClick?: () => void;
}

type SortOption = 'best' | 'new' | 'old' | 'controversial';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'best', label: 'Лучшие' },
  { value: 'new', label: 'Новые' },
  { value: 'old', label: 'Старые' },
  { value: 'controversial', label: 'Обсуждаемые' },
];

export const CommentSection: React.FC<CommentSectionProps> = ({
  postId,
  isAuthenticated,
  currentUserId,
  onLoginClick,
}) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortOption>('best');

  const loadComments = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const result = await api.getComments(postId, { sort });

    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      setComments(result.data.comments);
      setTotal(result.data.total);
    }

    setIsLoading(false);
  }, [postId, sort]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const handleCreateComment = async (content: string) => {
    const result = await api.createComment({
      post_id: postId,
      content,
    });

    if (result.error) {
      throw new Error(result.error);
    }

    if (result.data) {
      // Add new comment to the list
      setComments(prev => [result.data!, ...prev]);
      setTotal(prev => prev + 1);
    }
  };

  const handleReply = async (parentId: string, content: string) => {
    const result = await api.createComment({
      post_id: postId,
      parent_id: parentId,
      content,
    });

    if (result.error) {
      throw new Error(result.error);
    }

    // Reload comments to get updated tree structure
    await loadComments();
  };

  const handleVote = async (commentId: string, voteType: VoteType) => {
    const result = await api.voteComment(commentId, voteType);

    if (result.error) {
      console.error('Vote failed:', result.error);
      return;
    }

    if (result.data) {
      // Update comment in the tree
      updateCommentInTree(commentId, {
        upvotes: result.data.upvotes,
        downvotes: result.data.downvotes,
        score: result.data.score,
        current_user_vote: result.data.current_user_vote,
      });
    }
  };

  const handleRemoveVote = async (commentId: string) => {
    const result = await api.removeVote(commentId);

    if (result.error) {
      console.error('Remove vote failed:', result.error);
      return;
    }

    if (result.data) {
      updateCommentInTree(commentId, {
        upvotes: result.data.upvotes,
        downvotes: result.data.downvotes,
        score: result.data.score,
        current_user_vote: null,
      });
    }
  };

  const handleEdit = async (commentId: string, content: string) => {
    const result = await api.updateComment(commentId, content);

    if (result.error) {
      throw new Error(result.error);
    }

    if (result.data) {
      updateCommentInTree(commentId, {
        content: result.data.content,
        updated_at: result.data.updated_at,
      });
    }
  };

  const handleDelete = async (commentId: string) => {
    const result = await api.deleteComment(commentId);

    if (result.error) {
      throw new Error(result.error);
    }

    updateCommentInTree(commentId, {
      content: '[Комментарий удалён]',
    });
  };

  const handleReport = async (commentId: string, reason: ReportReason, description?: string) => {
    const result = await api.reportComment(commentId, reason, description);

    if (result.error) {
      throw new Error(result.error);
    }
  };

  const updateCommentInTree = (commentId: string, updates: Partial<Comment>) => {
    setComments(prev => updateNestedComment(prev, commentId, updates));
  };

  const updateNestedComment = (
    comments: Comment[],
    targetId: string,
    updates: Partial<Comment>
  ): Comment[] => {
    return comments.map(comment => {
      if (comment.id === targetId) {
        return { ...comment, ...updates };
      }
      if (comment.replies && comment.replies.length > 0) {
        return {
          ...comment,
          replies: updateNestedComment(comment.replies, targetId, updates),
        };
      }
      return comment;
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">
          Комментарии
          {total > 0 && <span className="ml-2 text-sm font-normal text-gray-500">({total})</span>}
        </h3>

        {comments.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Сортировка:</span>
            <select
              value={sort}
              onChange={e => setSort(e.target.value as SortOption)}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-coral-500/50"
            >
              {SORT_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Comment Form */}
      <div className="px-6 py-4 border-b border-gray-100">
        <CommentForm
          postId={postId}
          onSubmit={handleCreateComment}
          placeholder="Поделитесь информацией о питомце или задайте вопрос..."
          submitLabel="Отправить комментарий"
          isAuthenticated={isAuthenticated}
          onLoginClick={onLoginClick}
        />
      </div>

      {/* Comments List */}
      <div className="px-6 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <svg className="animate-spin h-6 w-6 text-coral-500" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-red-500 mb-2">{error}</p>
            <button
              onClick={loadComments}
              className="text-coral-600 hover:text-coral-700 font-medium"
            >
              Попробовать снова
            </button>
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-8">
            <svg
              className="w-12 h-12 mx-auto text-gray-300 mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            <p className="text-gray-500">Пока нет комментариев. Будьте первым!</p>
          </div>
        ) : (
          <CommentThread
            comments={comments}
            currentUserId={currentUserId}
            isAuthenticated={isAuthenticated}
            onVote={handleVote}
            onRemoveVote={handleRemoveVote}
            onReply={handleReply}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onReport={handleReport}
            onLoginClick={onLoginClick}
          />
        )}
      </div>
    </div>
  );
};

export default CommentSection;
