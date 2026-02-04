import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../services/api';
import { AdminPostWithStats } from '../types';
import { DataTable, Column } from '../components/common/DataTable';
import { Pagination } from '../components/common/Pagination';
import { SearchInput } from '../components/common/SearchInput';
import { Badge, getPostTypeBadge, getPostStatusBadge } from '../components/common/Badge';
import { usePagination } from '../hooks/usePagination';
import { useDebounce } from '../hooks/useDebounce';

export function PostsPage() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<AdminPostWithStats[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [commentsFilter, setCommentsFilter] = useState<string>('all');
  const debouncedSearch = useDebounce(search, 300);
  const { limit, offset, goToPage, setLimit, reset } = usePagination();

  const fetchPosts = useCallback(async () => {
    setIsLoading(true);
    const result = await adminApi.getPosts({
      limit,
      offset,
      search: debouncedSearch || undefined,
      type: typeFilter as 'all' | 'LOST' | 'FOUND',
      status: statusFilter as 'all' | 'OPEN' | 'RESOLVED',
      comments_enabled: commentsFilter as 'all' | 'enabled' | 'disabled',
    });
    if (result.data) {
      setPosts(result.data.data);
      setTotal(result.data.total);
    }
    setIsLoading(false);
  }, [limit, offset, debouncedSearch, typeFilter, statusFilter, commentsFilter]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  useEffect(() => {
    reset();
  }, [debouncedSearch, typeFilter, statusFilter, commentsFilter, reset]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const columns: Column<AdminPostWithStats>[] = [
    {
      key: 'post',
      header: 'Публикация',
      render: post => (
        <div className="flex items-center gap-3">
          {post.image_url ? (
            <img
              src={post.image_url}
              alt={post.title}
              className="w-12 h-12 rounded-lg object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
          )}
          <div>
            <p className="font-medium text-gray-900 line-clamp-1">{post.title}</p>
            <p className="text-xs text-gray-500">{post.location}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Тип',
      width: '100px',
      render: post => getPostTypeBadge(post.type),
    },
    {
      key: 'status',
      header: 'Статус',
      width: '100px',
      render: post => getPostStatusBadge(post.status),
    },
    {
      key: 'comments',
      header: 'Комментарии',
      width: '130px',
      render: post => (
        <div className="flex items-center gap-2">
          <span className="text-gray-600">{post.comments_count}</span>
          {!post.comments_enabled && <Badge variant="warning">Отключены</Badge>}
        </div>
      ),
    },
    {
      key: 'user',
      header: 'Автор',
      render: post => <span className="text-gray-600">{post.user_name}</span>,
    },
    {
      key: 'created_at',
      header: 'Дата',
      width: '120px',
      render: post => <span className="text-gray-500 text-sm">{formatDate(post.created_at)}</span>,
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Публикации</h1>
        <p className="text-gray-500 mt-1">Управление публикациями и комментариями</p>
      </div>

      <div className="flex flex-wrap items-center gap-4 mb-6">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Поиск по названию..."
          className="w-80"
        />
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-coral-500"
        >
          <option value="all">Все типы</option>
          <option value="LOST">Потеряны</option>
          <option value="FOUND">Найдены</option>
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-coral-500"
        >
          <option value="all">Все статусы</option>
          <option value="OPEN">Открытые</option>
          <option value="RESOLVED">Завершенные</option>
        </select>
        <select
          value={commentsFilter}
          onChange={e => setCommentsFilter(e.target.value)}
          className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-coral-500"
        >
          <option value="all">Все публикации</option>
          <option value="enabled">С комментариями</option>
          <option value="disabled">Без комментариев</option>
        </select>
      </div>

      <DataTable
        columns={columns}
        data={posts}
        isLoading={isLoading}
        keyExtractor={post => post.id}
        onRowClick={post => navigate(`/posts/${post.id}`)}
        emptyMessage="Публикации не найдены"
      />

      <Pagination
        total={total}
        limit={limit}
        offset={offset}
        onPageChange={goToPage}
        onLimitChange={setLimit}
      />
    </div>
  );
}
