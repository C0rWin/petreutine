import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminApi } from '../services/api';
import { AdminPostWithStats } from '../types';
import { getPostTypeBadge, getPostStatusBadge, Badge } from '../components/common/Badge';
import { ConfirmModal } from '../components/common/ConfirmModal';

export function PostDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [post, setPost] = useState<AdminPostWithStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [showToggleCommentsModal, setShowToggleCommentsModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [disableReason, setDisableReason] = useState('');
  const [isActionLoading, setIsActionLoading] = useState(false);

  const fetchPost = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    const result = await adminApi.getPost(id);
    if (result.data) {
      setPost(result.data);
    }
    setIsLoading(false);
  }, [id]);

  useEffect(() => {
    fetchPost();
  }, [fetchPost]);

  const handleToggleComments = async () => {
    if (!id || !post) return;
    setIsActionLoading(true);
    const result = await adminApi.togglePostComments(id, {
      enabled: !post.comments_enabled,
      reason: !post.comments_enabled ? undefined : disableReason || undefined,
    });
    setIsActionLoading(false);
    if (!result.error) {
      fetchPost();
      setShowToggleCommentsModal(false);
      setDisableReason('');
    }
  };

  const handleDelete = async () => {
    if (!id || !deleteReason.trim()) return;
    setIsActionLoading(true);
    const result = await adminApi.deletePost(id, { reason: deleteReason.trim() });
    setIsActionLoading(false);
    if (!result.error) {
      navigate('/posts');
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 w-64 bg-gray-200 rounded mb-4" />
        <div className="h-64 bg-gray-200 rounded-xl" />
      </div>
    );
  }

  if (!post) {
    return <div className="text-center py-8 text-gray-500">Публикация не найдена</div>;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/posts')} className="p-2 hover:bg-gray-100 rounded-lg">
          <svg
            className="w-5 h-5 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Детали публикации</h1>
      </div>

      {/* Post card */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
        {/* Image */}
        {post.image_url && (
          <div className="aspect-video max-h-80 bg-gray-100">
            <img src={post.image_url} alt={post.title} className="w-full h-full object-cover" />
          </div>
        )}

        <div className="p-6">
          {/* Title and badges */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                {getPostTypeBadge(post.type)}
                {getPostStatusBadge(post.status)}
                {!post.comments_enabled && <Badge variant="warning">Комментарии отключены</Badge>}
              </div>
              <h2 className="text-xl font-bold text-gray-900">{post.title}</h2>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowToggleCommentsModal(true)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  post.comments_enabled
                    ? 'text-yellow-700 bg-yellow-100 hover:bg-yellow-200'
                    : 'text-green-700 bg-green-100 hover:bg-green-200'
                }`}
              >
                {post.comments_enabled ? 'Отключить комментарии' : 'Включить комментарии'}
              </button>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="px-4 py-2 text-sm font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-lg transition-colors"
              >
                Удалить
              </button>
            </div>
          </div>

          {/* Description */}
          <p className="text-gray-600 mb-6">{post.description}</p>

          {/* Meta info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 py-4 border-t border-gray-100">
            <div>
              <p className="text-sm text-gray-500">Местоположение</p>
              <p className="font-medium text-gray-900">{post.location}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Тип животного</p>
              <p className="font-medium text-gray-900">{post.animal_type}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Контакт</p>
              <p className="font-medium text-gray-900">{post.contact_info}</p>
            </div>
            {post.reward && (
              <div>
                <p className="text-sm text-gray-500">Награда</p>
                <p className="font-medium text-gray-900">{post.reward}</p>
              </div>
            )}
          </div>

          {/* Author and dates */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 py-4 border-t border-gray-100">
            <div>
              <p className="text-sm text-gray-500">Автор</p>
              <button
                onClick={() => navigate(`/users/${post.user_id}`)}
                className="font-medium text-coral-600 hover:text-coral-700"
              >
                {post.user_name}
              </button>
              <p className="text-xs text-gray-400">{post.user_email}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Создано</p>
              <p className="font-medium text-gray-900">{formatDate(post.created_at)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Обновлено</p>
              <p className="font-medium text-gray-900">{formatDate(post.updated_at)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Комментариев</p>
              <p className="font-medium text-gray-900">{post.comments_count}</p>
            </div>
          </div>

          {/* Comments disabled info */}
          {!post.comments_enabled && post.comments_disabled_reason && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>Комментарии отключены:</strong> {post.comments_disabled_reason}
              </p>
              <p className="text-xs text-yellow-600 mt-1">
                Отключено: {formatDate(post.comments_disabled_at)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Toggle Comments Modal */}
      {showToggleCommentsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 animate-fade-in"
            onClick={() => setShowToggleCommentsModal(false)}
          />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-slide-up">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {post.comments_enabled ? 'Отключить комментарии' : 'Включить комментарии'}
            </h3>
            {post.comments_enabled && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Причина отключения (опционально)
                </label>
                <textarea
                  value={disableReason}
                  onChange={e => setDisableReason(e.target.value)}
                  placeholder="Укажите причину..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-coral-500 resize-none"
                />
              </div>
            )}
            <p className="text-sm text-gray-600 mb-6">
              {post.comments_enabled
                ? 'Новые комментарии не будут приниматься для этой публикации.'
                : 'Пользователи снова смогут оставлять комментарии.'}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowToggleCommentsModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                Отмена
              </button>
              <button
                onClick={handleToggleComments}
                disabled={isActionLoading}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg ${
                  post.comments_enabled
                    ? 'bg-yellow-600 hover:bg-yellow-700'
                    : 'bg-green-600 hover:bg-green-700'
                } disabled:opacity-50`}
              >
                {isActionLoading ? 'Сохранение...' : 'Подтвердить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 animate-fade-in"
            onClick={() => setShowDeleteModal(false)}
          />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-slide-up">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Удалить публикацию</h3>
            <p className="text-sm text-gray-600 mb-4">
              Это действие необратимо. Все комментарии к публикации также будут удалены.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Причина удаления <span className="text-red-500">*</span>
              </label>
              <textarea
                value={deleteReason}
                onChange={e => setDeleteReason(e.target.value)}
                placeholder="Укажите причину..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-coral-500 resize-none"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                Отмена
              </button>
              <button
                onClick={handleDelete}
                disabled={isActionLoading || !deleteReason.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
              >
                {isActionLoading ? 'Удаление...' : 'Удалить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
