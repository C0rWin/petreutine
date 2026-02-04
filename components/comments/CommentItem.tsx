import React, { useState } from 'react';
import { Comment, VoteType, ReportReason } from '../../types';
import { VoteButtons } from './VoteButtons';
import { CommentForm } from './CommentForm';
import { ReportModal } from './ReportModal';

interface CommentItemProps {
  comment: Comment;
  currentUserId?: string | null;
  isAuthenticated: boolean;
  onVote: (commentId: string, voteType: VoteType) => Promise<void>;
  onRemoveVote: (commentId: string) => Promise<void>;
  onReply: (parentId: string, content: string) => Promise<void>;
  onEdit: (commentId: string, content: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  onReport: (commentId: string, reason: ReportReason, description?: string) => Promise<void>;
  onLoginClick?: () => void;
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'только что';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    const mod = minutes % 10;
    const mod100 = minutes % 100;
    if (mod100 >= 11 && mod100 <= 19) return `${minutes} минут назад`;
    if (mod === 1) return `${minutes} минуту назад`;
    if (mod >= 2 && mod <= 4) return `${minutes} минуты назад`;
    return `${minutes} минут назад`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const mod = hours % 10;
    const mod100 = hours % 100;
    if (mod100 >= 11 && mod100 <= 19) return `${hours} часов назад`;
    if (mod === 1) return `${hours} час назад`;
    if (mod >= 2 && mod <= 4) return `${hours} часа назад`;
    return `${hours} часов назад`;
  }

  const days = Math.floor(hours / 24);
  if (days < 30) {
    const mod = days % 10;
    const mod100 = days % 100;
    if (mod100 >= 11 && mod100 <= 19) return `${days} дней назад`;
    if (mod === 1) return `${days} день назад`;
    if (mod >= 2 && mod <= 4) return `${days} дня назад`;
    return `${days} дней назад`;
  }

  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

export const CommentItem: React.FC<CommentItemProps> = ({
  comment,
  currentUserId,
  isAuthenticated,
  onVote,
  onRemoveVote,
  onReply,
  onEdit,
  onDelete,
  onReport,
  onLoginClick,
}) => {
  const [isReplying, setIsReplying] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [showReportModal, setShowReportModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isOwner = currentUserId === comment.user_id;
  const isDeleted = comment.content === '[Комментарий удалён]';
  const isPending = comment._moderation?.status === 'pending';
  const isRejected = comment._moderation?.status === 'rejected';

  const handleVote = async (voteType: VoteType) => {
    await onVote(comment.id, voteType);
  };

  const handleRemoveVote = async () => {
    await onRemoveVote(comment.id);
  };

  const handleReply = async (content: string) => {
    await onReply(comment.id, content);
    setIsReplying(false);
  };

  const handleEdit = async () => {
    if (!editContent.trim() || editContent === comment.content) {
      setIsEditing(false);
      return;
    }
    await onEdit(comment.id, editContent);
    setIsEditing(false);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(comment.id);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleReport = async (reason: ReportReason, description?: string) => {
    await onReport(comment.id, reason, description);
  };

  return (
    <div className={`${comment.depth > 0 ? 'ml-6 pl-4 border-l-2 border-gray-100' : ''}`}>
      <div className={`py-3 ${isPending || isRejected ? 'opacity-60' : ''}`}>
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          {comment.user.avatar_url ? (
            <img
              src={comment.user.avatar_url}
              alt={comment.user.name}
              className="w-6 h-6 rounded-full"
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-coral-400 to-teal-400 flex items-center justify-center text-white text-xs font-medium">
              {comment.user.name.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="font-medium text-sm text-gray-900">{comment.user.name}</span>
          <span className="text-xs text-gray-400">{formatTimeAgo(comment.created_at)}</span>
          {comment.created_at !== comment.updated_at && !isDeleted && (
            <span className="text-xs text-gray-400 italic">(изменён)</span>
          )}
          {isPending && (
            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
              На модерации
            </span>
          )}
          {isRejected && (
            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
              Отклонён
            </span>
          )}
        </div>

        {/* Content */}
        {isEditing ? (
          <div className="mb-2">
            <textarea
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-coral-500/50 focus:border-coral-500"
              rows={3}
            />
            <div className="mt-2 flex justify-end gap-2">
              <button
                onClick={() => {
                  setIsEditing(false);
                  setEditContent(comment.content);
                }}
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
              >
                Отмена
              </button>
              <button
                onClick={handleEdit}
                className="px-3 py-1.5 text-sm bg-coral-500 text-white rounded-lg hover:bg-coral-600"
              >
                Сохранить
              </button>
            </div>
          </div>
        ) : (
          <p
            className={`text-sm text-gray-700 whitespace-pre-wrap mb-2 ${isDeleted ? 'italic text-gray-400' : ''}`}
          >
            {comment.content}
          </p>
        )}

        {/* Moderation message */}
        {comment._moderation?.message && (
          <div
            className={`text-xs p-2 rounded mb-2 ${
              isRejected ? 'bg-red-50 text-red-600' : 'bg-yellow-50 text-yellow-700'
            }`}
          >
            {comment._moderation.message}
            {comment._moderation.reason && (
              <span className="block mt-1 font-medium">{comment._moderation.reason}</span>
            )}
          </div>
        )}

        {/* Actions */}
        {!isDeleted && !isEditing && (
          <div className="flex items-center gap-3 text-sm">
            <VoteButtons
              upvotes={comment.upvotes}
              downvotes={comment.downvotes}
              score={comment.score}
              currentVote={comment.current_user_vote}
              onVote={handleVote}
              onRemoveVote={handleRemoveVote}
              disabled={!isAuthenticated || isPending || isRejected}
              compact
            />

            {isAuthenticated && !isPending && !isRejected && (
              <>
                <button
                  onClick={() => setIsReplying(!isReplying)}
                  className="text-gray-500 hover:text-teal-600 transition-colors"
                >
                  Ответить
                </button>

                {isOwner && (
                  <>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      Изменить
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="text-gray-500 hover:text-red-500 transition-colors"
                    >
                      Удалить
                    </button>
                  </>
                )}

                {!isOwner && (
                  <button
                    onClick={() => setShowReportModal(true)}
                    className="text-gray-400 hover:text-coral-500 transition-colors"
                  >
                    Пожаловаться
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* Reply Form */}
        {isReplying && (
          <div className="mt-3">
            <CommentForm
              postId={comment.post_id}
              parentId={comment.id}
              onSubmit={handleReply}
              onCancel={() => setIsReplying(false)}
              placeholder={`Ответить ${comment.user.name}...`}
              submitLabel="Ответить"
              isReply
              isAuthenticated={isAuthenticated}
              onLoginClick={onLoginClick}
            />
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowDeleteConfirm(false)}
          />
          <div className="relative bg-white rounded-xl p-6 max-w-sm w-full animate-fade-in">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Удалить комментарий?</h3>
            <p className="text-gray-600 text-sm mb-4">Это действие нельзя отменить.</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
                disabled={isDeleting}
              >
                Отмена
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
              >
                {isDeleting ? 'Удаление...' : 'Удалить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Modal */}
      <ReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        onSubmit={handleReport}
      />
    </div>
  );
};

export default CommentItem;
