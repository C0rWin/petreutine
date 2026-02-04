import React, { useCallback, useEffect, useState } from 'react';

import { api } from '../services/api';
import { normalizePost, PetPost } from '../types';
import PetCard from './PetCard';

interface MyPostsProps {
  onClose: () => void;
  onSelectPost: (post: PetPost) => void;
}

const MyPosts: React.FC<MyPostsProps> = ({ onClose, onSelectPost }) => {
  const [posts, setPosts] = useState<PetPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'OPEN' | 'RESOLVED'>('ALL');

  const loadMyPosts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.getMyPosts();
      if (response.error) {
        setError(response.error);
        return;
      }
      const normalizedPosts = (response.data?.posts || []).map(normalizePost);
      setPosts(normalizedPosts);
    } catch {
      setError('Не удалось загрузить ваши объявления');
      // Error logged to UI state
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMyPosts();
  }, [loadMyPosts]);

  const filteredPosts = posts.filter(post => {
    if (filter === 'ALL') return true;
    return post.status === filter;
  });

  const openCount = posts.filter(p => p.status === 'OPEN').length;
  const resolvedCount = posts.filter(p => p.status === 'RESOLVED').length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex-shrink-0">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Мои объявления</h2>
              <p className="text-sm text-gray-500 mt-1">
                Всего: {posts.length} | Активных: {openCount} | Завершённых: {resolvedCount}
              </p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-2 mt-4">
            {(['ALL', 'OPEN', 'RESOLVED'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  filter === tab ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {tab === 'ALL' ? 'Все' : tab === 'OPEN' ? 'Активные' : 'Завершённые'}
                <span className="ml-1.5 text-xs bg-white/50 px-1.5 py-0.5 rounded">
                  {tab === 'ALL' ? posts.length : tab === 'OPEN' ? openCount : resolvedCount}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-grow">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredPosts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPosts.map(post => (
                <div key={post.id} className="relative group">
                  <PetCard
                    post={post}
                    onClick={() => {
                      onClose();
                      onSelectPost(post);
                    }}
                  />
                  {/* Quick status indicator */}
                  <div className="absolute top-2 left-2 flex gap-1">
                    {post.status === 'RESOLVED' && (
                      <span className="bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Завершено
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
              <div className="text-gray-400 mb-4">
                <svg
                  className="w-16 h-16 mx-auto"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              {filter === 'ALL' ? (
                <>
                  <h3 className="text-lg font-medium text-gray-900">У вас пока нет объявлений</h3>
                  <p className="text-gray-500 mt-1">
                    Создайте первое объявление о пропавшем или найденном питомце
                  </p>
                </>
              ) : filter === 'OPEN' ? (
                <>
                  <h3 className="text-lg font-medium text-gray-900">Нет активных объявлений</h3>
                  <p className="text-gray-500 mt-1">Все ваши объявления завершены</p>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-medium text-gray-900">Нет завершённых объявлений</h3>
                  <p className="text-gray-500 mt-1">
                    Отметьте объявление как завершённое, когда питомец найдётся
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex-shrink-0">
          <p className="text-xs text-gray-500 text-center">
            Нажмите на объявление, чтобы просмотреть, отредактировать или удалить
          </p>
        </div>
      </div>
    </div>
  );
};

export default MyPosts;
