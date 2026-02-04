import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../services/api';
import { AdminUserWithStats } from '../types';
import { DataTable, Column } from '../components/common/DataTable';
import { Pagination } from '../components/common/Pagination';
import { SearchInput } from '../components/common/SearchInput';
import { getUserStatusBadges } from '../components/common/Badge';
import { usePagination } from '../hooks/usePagination';
import { useDebounce } from '../hooks/useDebounce';

export function UsersPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUserWithStats[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [banFilter, setBanFilter] = useState<string>('all');
  const debouncedSearch = useDebounce(search, 300);
  const { limit, offset, goToPage, setLimit, reset } = usePagination();

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    const result = await adminApi.getUsers({
      limit,
      offset,
      search: debouncedSearch || undefined,
      ban_status: banFilter as 'all' | 'banned' | 'not_banned',
    });
    if (result.data) {
      setUsers(result.data.data);
      setTotal(result.data.total);
    }
    setIsLoading(false);
  }, [limit, offset, debouncedSearch, banFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    reset();
  }, [debouncedSearch, banFilter, reset]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const columns: Column<AdminUserWithStats>[] = [
    {
      key: 'user',
      header: 'Пользователь',
      render: user => (
        <div className="flex items-center gap-3">
          {user.avatar_url ? (
            <img
              src={user.avatar_url}
              alt={user.name}
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-coral-100 flex items-center justify-center">
              <span className="text-coral-700 font-medium">
                {user.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div>
            <p className="font-medium text-gray-900">{user.name}</p>
            <p className="text-xs text-gray-500">{user.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Статус',
      width: '180px',
      render: user => (
        <div className="flex items-center gap-1 flex-wrap">
          {getUserStatusBadges(user.is_admin, user.ban_type)}
        </div>
      ),
    },
    {
      key: 'posts_count',
      header: 'Публикации',
      width: '100px',
      render: user => <span className="text-gray-600">{user.posts_count}</span>,
    },
    {
      key: 'comments_count',
      header: 'Комментарии',
      width: '100px',
      render: user => (
        <div>
          <span className="text-gray-600">{user.comments_count}</span>
          {user.flagged_comments_count > 0 && (
            <span className="ml-1 text-xs text-red-500">({user.flagged_comments_count} жалоб)</span>
          )}
        </div>
      ),
    },
    {
      key: 'last_login_at',
      header: 'Последний вход',
      width: '140px',
      render: user => (
        <span className="text-gray-500 text-sm">{formatDate(user.last_login_at)}</span>
      ),
    },
    {
      key: 'created_at',
      header: 'Регистрация',
      width: '120px',
      render: user => <span className="text-gray-500 text-sm">{formatDate(user.created_at)}</span>,
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Пользователи</h1>
        <p className="text-gray-500 mt-1">Управление пользователями и банами</p>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Поиск по имени или email..."
          className="w-80"
        />
        <select
          value={banFilter}
          onChange={e => setBanFilter(e.target.value)}
          className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-coral-500"
        >
          <option value="all">Все пользователи</option>
          <option value="not_banned">Активные</option>
          <option value="banned">Заблокированные</option>
          <option value="full_banned">Полный бан</option>
          <option value="comment_banned">Бан комментариев</option>
        </select>
      </div>

      <DataTable
        columns={columns}
        data={users}
        isLoading={isLoading}
        keyExtractor={user => user.id}
        onRowClick={user => navigate(`/users/${user.id}`)}
        emptyMessage="Пользователи не найдены"
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
