import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminApi } from '../services/api';
import {
  AdminUserWithStats,
  AdminPostWithStats,
  AdminComment,
  BanHistoryEntry,
  BanType,
} from '../types';
import {
  getUserStatusBadges,
  getPostTypeBadge,
  getCommentStatusBadge,
} from '../components/common/Badge';
import { DataTable, Column } from '../components/common/DataTable';
import { Pagination } from '../components/common/Pagination';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { BanModal } from '../components/users/BanModal';
import { usePagination } from '../hooks/usePagination';

type Tab = 'posts' | 'comments' | 'history';

export function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<AdminUserWithStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('posts');

  // Posts state
  const [posts, setPosts] = useState<AdminPostWithStats[]>([]);
  const [postsTotal, setPostsTotal] = useState(0);
  const [postsLoading, setPostsLoading] = useState(false);
  const postsPagination = usePagination({ initialLimit: 10 });

  // Comments state
  const [comments, setComments] = useState<AdminComment[]>([]);
  const [commentsTotal, setCommentsTotal] = useState(0);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const commentsPagination = usePagination({ initialLimit: 10 });

  // Ban history state
  const [banHistory, setBanHistory] = useState<BanHistoryEntry[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);
  const historyPagination = usePagination({ initialLimit: 10 });

  // Modals
  const [showBanModal, setShowBanModal] = useState(false);
  const [showUnbanModal, setShowUnbanModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [isBanLoading, setIsBanLoading] = useState(false);
  const [isAdminLoading, setIsAdminLoading] = useState(false);

  const fetchUser = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    const result = await adminApi.getUser(id);
    if (result.data) {
      setUser(result.data);
    }
    setIsLoading(false);
  }, [id]);

  const fetchPosts = useCallback(async () => {
    if (!id) return;
    setPostsLoading(true);
    const result = await adminApi.getUserPosts(id, {
      limit: postsPagination.limit,
      offset: postsPagination.offset,
    });
    if (result.data) {
      setPosts(result.data.data);
      setPostsTotal(result.data.total);
    }
    setPostsLoading(false);
  }, [id, postsPagination.limit, postsPagination.offset]);

  const fetchComments = useCallback(async () => {
    if (!id) return;
    setCommentsLoading(true);
    const result = await adminApi.getUserComments(id, {
      limit: commentsPagination.limit,
      offset: commentsPagination.offset,
    });
    if (result.data) {
      setComments(result.data.data);
      setCommentsTotal(result.data.total);
    }
    setCommentsLoading(false);
  }, [id, commentsPagination.limit, commentsPagination.offset]);

  const fetchBanHistory = useCallback(async () => {
    if (!id) return;
    setHistoryLoading(true);
    const result = await adminApi.getUserBanHistory(id, {
      limit: historyPagination.limit,
      offset: historyPagination.offset,
    });
    if (result.data) {
      setBanHistory(result.data.data);
      setHistoryTotal(result.data.total);
    }
    setHistoryLoading(false);
  }, [id, historyPagination.limit, historyPagination.offset]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  useEffect(() => {
    if (activeTab === 'posts') fetchPosts();
    if (activeTab === 'comments') fetchComments();
    if (activeTab === 'history') fetchBanHistory();
  }, [activeTab, fetchPosts, fetchComments, fetchBanHistory]);

  const handleBan = async (data: {
    ban_type: BanType;
    reason: string;
    duration_hours?: number;
  }) => {
    if (!id) return;
    setIsBanLoading(true);
    const result = await adminApi.banUser(id, data);
    setIsBanLoading(false);
    if (!result.error) {
      fetchUser();
      fetchBanHistory();
      setShowBanModal(false);
    }
  };

  const handleUnban = async () => {
    if (!id) return;
    setIsBanLoading(true);
    const result = await adminApi.unbanUser(id);
    setIsBanLoading(false);
    if (!result.error) {
      fetchUser();
      fetchBanHistory();
      setShowUnbanModal(false);
    }
  };

  const handleToggleAdmin = async () => {
    if (!id || !user) return;
    setIsAdminLoading(true);
    const result = await adminApi.toggleAdmin(id, !user.is_admin);
    setIsAdminLoading(false);
    if (!result.error) {
      fetchUser();
      setShowAdminModal(false);
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

  const postsColumns: Column<AdminPostWithStats>[] = [
    {
      key: 'title',
      header: 'Публикация',
      render: post => (
        <div>
          <p className="font-medium text-gray-900 line-clamp-1">{post.title}</p>
          <p className="text-xs text-gray-500">{post.location}</p>
        </div>
      ),
    },
    { key: 'type', header: 'Тип', width: '100px', render: post => getPostTypeBadge(post.type) },
    { key: 'comments_count', header: 'Комм.', width: '80px' },
    {
      key: 'created_at',
      header: 'Дата',
      width: '120px',
      render: post => formatDate(post.created_at).split(',')[0],
    },
  ];

  const commentsColumns: Column<AdminComment>[] = [
    {
      key: 'content',
      header: 'Комментарий',
      render: comment => (
        <div>
          <p className="text-gray-900 line-clamp-2">{comment.content}</p>
          <p className="text-xs text-gray-500 mt-1">{comment.post_title}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Статус',
      width: '120px',
      render: c => getCommentStatusBadge(c.status),
    },
    { key: 'score', header: 'Рейтинг', width: '80px' },
    {
      key: 'created_at',
      header: 'Дата',
      width: '120px',
      render: c => formatDate(c.created_at).split(',')[0],
    },
  ];

  const historyColumns: Column<BanHistoryEntry>[] = [
    {
      key: 'action',
      header: 'Действие',
      render: entry => (
        <span
          className={`font-medium ${entry.action === 'ban' ? 'text-red-600' : 'text-green-600'}`}
        >
          {entry.action === 'ban' ? 'Блокировка' : 'Разблокировка'}
        </span>
      ),
    },
    {
      key: 'ban_type',
      header: 'Тип',
      render: entry =>
        entry.ban_type === 'full' ? 'Полный' : entry.ban_type === 'comment' ? 'Комментарии' : '—',
    },
    { key: 'reason', header: 'Причина', render: entry => entry.reason || '—' },
    { key: 'admin_name', header: 'Админ' },
    { key: 'created_at', header: 'Дата', render: entry => formatDate(entry.created_at) },
  ];

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 w-64 bg-gray-200 rounded mb-4" />
        <div className="h-40 bg-gray-200 rounded-xl" />
      </div>
    );
  }

  if (!user) {
    return <div className="text-center py-8 text-gray-500">Пользователь не найден</div>;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/users')} className="p-2 hover:bg-gray-100 rounded-lg">
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
        <h1 className="text-2xl font-bold text-gray-900">Профиль пользователя</h1>
      </div>

      {/* User info card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.name}
                className="w-16 h-16 rounded-full object-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-coral-100 flex items-center justify-center">
                <span className="text-coral-700 font-bold text-xl">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-gray-900">{user.name}</h2>
                <div className="flex items-center gap-2">
                  {getUserStatusBadges(user.is_admin, user.ban_type)}
                </div>
              </div>
              <p className="text-gray-500">{user.email}</p>
              {user.ban_type && user.ban_reason && (
                <p className="text-sm text-red-600 mt-2">
                  Причина: {user.ban_reason}
                  {user.ban_expires_at && (
                    <span className="ml-2">(до {formatDate(user.ban_expires_at)})</span>
                  )}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowAdminModal(true)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                user.is_admin
                  ? 'text-gray-700 bg-gray-100 hover:bg-gray-200'
                  : 'text-blue-700 bg-blue-100 hover:bg-blue-200'
              }`}
            >
              {user.is_admin ? 'Снять админа' : 'Сделать админом'}
            </button>
            {user.ban_type ? (
              <button
                onClick={() => setShowUnbanModal(true)}
                className="px-4 py-2 text-sm font-medium text-green-700 bg-green-100 hover:bg-green-200 rounded-lg transition-colors"
              >
                Разблокировать
              </button>
            ) : (
              <button
                onClick={() => setShowBanModal(true)}
                className="px-4 py-2 text-sm font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-lg transition-colors"
              >
                Заблокировать
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-6 mt-6 pt-6 border-t border-gray-100">
          <div>
            <p className="text-sm text-gray-500">Публикации</p>
            <p className="text-2xl font-bold text-gray-900">{user.posts_count}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Комментарии</p>
            <p className="text-2xl font-bold text-gray-900">{user.comments_count}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Последний вход</p>
            <p className="text-sm font-medium text-gray-900">{formatDate(user.last_login_at)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Регистрация</p>
            <p className="text-sm font-medium text-gray-900">{formatDate(user.created_at)}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-6">
          {[
            { key: 'posts', label: 'Публикации', count: postsTotal },
            { key: 'comments', label: 'Комментарии', count: commentsTotal },
            { key: 'history', label: 'История банов' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as Tab)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-coral-500 text-coral-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'posts' && (
        <>
          <DataTable
            columns={postsColumns}
            data={posts}
            isLoading={postsLoading}
            keyExtractor={p => p.id}
            onRowClick={p => navigate(`/posts/${p.id}`)}
            emptyMessage="Нет публикаций"
          />
          <Pagination
            total={postsTotal}
            limit={postsPagination.limit}
            offset={postsPagination.offset}
            onPageChange={postsPagination.goToPage}
          />
        </>
      )}

      {activeTab === 'comments' && (
        <>
          <DataTable
            columns={commentsColumns}
            data={comments}
            isLoading={commentsLoading}
            keyExtractor={c => c.id}
            emptyMessage="Нет комментариев"
          />
          <Pagination
            total={commentsTotal}
            limit={commentsPagination.limit}
            offset={commentsPagination.offset}
            onPageChange={commentsPagination.goToPage}
          />
        </>
      )}

      {activeTab === 'history' && (
        <>
          <DataTable
            columns={historyColumns}
            data={banHistory}
            isLoading={historyLoading}
            keyExtractor={h => h.id}
            emptyMessage="Нет истории"
          />
          <Pagination
            total={historyTotal}
            limit={historyPagination.limit}
            offset={historyPagination.offset}
            onPageChange={historyPagination.goToPage}
          />
        </>
      )}

      {/* Modals */}
      <BanModal
        isOpen={showBanModal}
        onClose={() => setShowBanModal(false)}
        onSubmit={handleBan}
        userName={user.name}
        isLoading={isBanLoading}
      />

      <ConfirmModal
        isOpen={showUnbanModal}
        onClose={() => setShowUnbanModal(false)}
        onConfirm={handleUnban}
        title="Разблокировать пользователя"
        message={`Вы уверены, что хотите разблокировать пользователя ${user.name}?`}
        confirmText="Разблокировать"
        variant="info"
        isLoading={isBanLoading}
      />

      <ConfirmModal
        isOpen={showAdminModal}
        onClose={() => setShowAdminModal(false)}
        onConfirm={handleToggleAdmin}
        title={user.is_admin ? 'Снять права администратора' : 'Назначить администратором'}
        message={
          user.is_admin
            ? `Вы уверены, что хотите снять права администратора с пользователя ${user.name}?`
            : `Вы уверены, что хотите назначить пользователя ${user.name} администратором?`
        }
        confirmText={user.is_admin ? 'Снять права' : 'Назначить'}
        variant={user.is_admin ? 'danger' : 'info'}
        isLoading={isAdminLoading}
      />
    </div>
  );
}
