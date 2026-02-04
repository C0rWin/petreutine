import React, { useState, useEffect, useCallback } from 'react';
import { api } from './services/api';
import { PetPost, PostType, normalizePost } from './types';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import PetCard from './components/PetCard';
import CreatePost from './components/CreatePost';
import EditPost from './components/EditPost';
import LocationMap from './components/LocationMap';
import MatchCard from './components/MatchCard';
import MyPosts from './components/MyPosts';
import { NotificationBadge } from './components/notifications';
import { CommentSection } from './components/comments';

const AppContent: React.FC = () => {
  const { user, isLoading: authLoading, login, logout } = useAuth();

  // Posts State
  const [posts, setPosts] = useState<PetPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'ALL' | PostType>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPost, setSelectedPost] = useState<PetPost | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [matches, setMatches] = useState<(PetPost & { confidence: number; reason: string })[]>([]);
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);
  const [isMyPostsOpen, setIsMyPostsOpen] = useState(false);

  // Load posts from API
  const loadPosts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.getPosts();
      if (response.error) {
        setError(response.error);
        return;
      }
      const normalizedPosts = (response.data?.posts || []).map(normalizePost);
      setPosts(normalizedPosts);
    } catch (err) {
      setError('Не удалось загрузить объявления');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Init - load posts
  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      loadPosts();
      return;
    }

    setIsSearching(true);
    setError(null);
    try {
      const response = await api.search(searchQuery, {
        type: activeTab === 'ALL' ? undefined : activeTab,
      });
      if (response.error) {
        setError(response.error);
        return;
      }
      const normalizedPosts = (response.data?.posts || []).map(normalizePost);
      setPosts(normalizedPosts);
    } catch (err) {
      setError('Ошибка поиска');
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    loadPosts();
  };

  const loadMatches = async (postId: string) => {
    setIsLoadingMatches(true);
    setMatches([]);
    try {
      const response = await api.findMatches(postId);
      if (response.data?.matches) {
        setMatches(
          response.data.matches.map((m: PetPost & { confidence: number; reason: string }) => ({
            ...normalizePost(m),
            confidence: m.confidence,
            reason: m.reason,
          }))
        );
      }
    } catch (err) {
      console.error('Failed to load matches:', err);
    } finally {
      setIsLoadingMatches(false);
    }
  };

  const handleSelectPost = (post: PetPost) => {
    setSelectedPost(post);
    setMatches([]);
    // Only load matches for OPEN posts
    if (post.status !== 'RESOLVED') {
      loadMatches(post.id);
    }
  };

  const handleDeletePost = async () => {
    if (!selectedPost) return;

    setIsDeleting(true);
    try {
      const response = await api.deletePost(selectedPost.id);
      if (response.error) {
        setError(response.error);
        return;
      }
      // Remove from local state and close modal
      setPosts(posts.filter(p => p.id !== selectedPost.id));
      setSelectedPost(null);
      setShowDeleteConfirm(false);
    } catch (err) {
      setError('Не удалось удалить объявление');
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter based on Tabs (client-side for cached posts)
  const displayPosts = posts.filter(p => {
    if (activeTab === 'ALL') return true;
    return p.type === activeTab;
  });

  const formatDate = (post: PetPost) => {
    const timestamp =
      post.createdAt || (post.created_at ? new Date(post.created_at).getTime() : Date.now());
    return new Date(timestamp).toLocaleDateString('ru-RU');
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navbar */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-coral-500 to-coral-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-coral-200">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                  </svg>
                </div>
                <div>
                  <span className="font-bold text-xl text-gray-900 tracking-tight">
                    ДомойСкорей
                  </span>
                  <span className="hidden sm:block text-xs text-gray-500">Возвращаем домой</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {authLoading ? (
                <div className="animate-pulse h-8 w-24 bg-gray-200 rounded-lg"></div>
              ) : user ? (
                <>
                  <button
                    onClick={() => setIsMyPostsOpen(true)}
                    className="hidden sm:flex items-center gap-2 text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg font-medium hover:bg-gray-100 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    Мои объявления
                  </button>
                  <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="hidden sm:flex items-center gap-2 bg-gradient-to-r from-coral-500 to-coral-600 text-white px-5 py-2.5 rounded-xl font-medium hover:from-coral-600 hover:to-coral-700 transition-all shadow-lg shadow-coral-200 hover:shadow-xl hover:shadow-coral-300"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                    Создать объявление
                  </button>
                  <div className="flex items-center gap-3 ml-2">
                    <div className="relative">
                      <NotificationBadge
                        onNotificationClick={notification => {
                          // Navigate to the related post if available
                          if (notification.related_post_id) {
                            const relatedPost = posts.find(
                              p => p.id === notification.related_post_id
                            );
                            if (relatedPost) {
                              handleSelectPost(relatedPost);
                            }
                          }
                        }}
                      />
                    </div>
                    <img
                      className="h-8 w-8 rounded-full border border-gray-200"
                      src={
                        user.avatarUrl ||
                        user.avatar_url ||
                        'https://avatars.yandex.net/get-yapic/0/0-0/islands-200'
                      }
                      alt=""
                    />
                    <span className="text-sm text-gray-700 hidden sm:block">{user.name}</span>
                    <button
                      onClick={logout}
                      className="text-sm text-gray-500 hover:text-gray-900 font-medium"
                    >
                      Выйти
                    </button>
                  </div>
                </>
              ) : (
                <button
                  onClick={login}
                  className="flex items-center gap-2 bg-[#FC3F1D] hover:bg-[#E53510] text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M2 12C2 6.48 6.48 2 12 2s10 4.48 10 10-4.48 10-10 10S2 17.52 2 12zm10.5-5.5h-1.02c-1.87 0-2.94 1.01-2.94 2.47 0 1.19.54 1.94 1.69 2.74l.95.66-2.71 4.13h1.9l2.34-3.72.62.43c1.35.94 1.96 1.66 1.96 3.02 0 .09 0 .18-.01.27h1.72V6.5h-1.83v4.62c-.56-.72-1.33-1.29-2.28-1.94l-.39-.27V6.5z" />
                  </svg>
                  Войти через Яндекс
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <p className="text-red-800 text-sm">{error}</p>
            <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {/* Hero Header */}
        <div className="mb-10 text-center sm:text-left">
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-teal-100 text-teal-800">
              <span className="w-2 h-2 bg-teal-500 rounded-full mr-2 animate-pulse"></span>
              {posts.length} объявлений активно
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4 leading-tight">
            Найдите своего{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-coral-500 to-coral-600">
              пропавшего друга
            </span>
          </h1>
          <p className="text-gray-600 text-lg max-w-2xl leading-relaxed">
            ДомойСкорей мгновенно сопоставляет объявления о пропавших и найденных животных в вашем
            районе. Каждый день питомцы возвращаются домой!
          </p>
        </div>

        {/* Action Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-8">
          {/* Tabs */}
          <div className="flex p-1.5 space-x-1 bg-gray-100 rounded-2xl w-full sm:w-auto shadow-inner">
            {(['ALL', PostType.LOST, PostType.FOUND] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`w-full sm:w-36 py-2.5 text-sm font-semibold rounded-xl leading-5 transition-all duration-200
                            ${
                              activeTab === tab
                                ? tab === PostType.LOST
                                  ? 'bg-coral-500 text-white shadow-lg shadow-coral-200'
                                  : tab === PostType.FOUND
                                    ? 'bg-teal-500 text-white shadow-lg shadow-teal-200'
                                    : 'bg-white text-gray-800 shadow-md'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
                            }`}
              >
                {tab === 'ALL' ? 'Все' : tab === PostType.LOST ? 'Пропавшие' : 'Найденные'}
              </button>
            ))}
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="relative w-full sm:w-96">
            <input
              type="text"
              className="w-full pl-11 pr-10 py-3 rounded-2xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-coral-500 focus:border-transparent transition-all shadow-sm hover:shadow-md"
              placeholder="Поиск по породе, цвету, местоположению..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            <div className="absolute left-4 top-3.5 text-gray-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            {searchQuery && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-3 top-3.5 text-gray-400 hover:text-coral-500 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </form>
        </div>

        {/* Results Grid */}
        {isLoading || isSearching ? (
          /* Skeleton Loaders */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl overflow-hidden border border-gray-100 animate-fade-in"
              >
                <div className="h-52 skeleton" />
                <div className="p-5 space-y-3">
                  <div className="h-6 skeleton rounded-lg w-3/4" />
                  <div className="h-4 skeleton rounded-lg w-full" />
                  <div className="h-4 skeleton rounded-lg w-2/3" />
                  <div className="pt-2 space-y-2">
                    <div className="h-4 skeleton rounded-lg w-1/2" />
                    <div className="h-3 skeleton rounded-lg w-1/3" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {displayPosts.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {displayPosts.map((post, index) => (
                  <div
                    key={post.id}
                    className="animate-slide-up"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <PetCard post={post} onClick={() => handleSelectPost(post)} />
                  </div>
                ))}
              </div>
            ) : (
              /* Improved Empty State */
              <div className="text-center py-16 px-8 bg-white rounded-3xl border-2 border-dashed border-gray-200 max-w-2xl mx-auto">
                <div className="mb-6">
                  <svg
                    className="w-24 h-24 mx-auto text-gray-300"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">Объявления не найдены</h3>
                <p className="text-gray-500 mb-6 max-w-md mx-auto">
                  Попробуйте изменить параметры поиска или создайте новое объявление, чтобы помочь
                  найти вашего питомца.
                </p>
                <div className="bg-gray-50 rounded-2xl p-5 text-left max-w-md mx-auto">
                  <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5 text-teal-500" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Советы по поиску:
                  </h4>
                  <ul className="text-sm text-gray-600 space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="text-coral-500 mt-0.5">•</span>
                      Попробуйте поиск по породе или цвету
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-coral-500 mt-0.5">•</span>
                      Укажите район или улицу
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-coral-500 mt-0.5">•</span>
                      Переключите фильтр "Пропавшие" / "Найденные"
                    </li>
                  </ul>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Floating Action Buttons for Mobile */}
      {user && (
        <div className="sm:hidden fixed bottom-6 right-6 flex flex-col gap-3 z-40">
          <button
            onClick={() => setIsMyPostsOpen(true)}
            className="bg-white text-gray-700 p-3.5 rounded-2xl shadow-lg hover:shadow-xl hover:bg-gray-50 transition-all border border-gray-100"
            title="Мои объявления"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </button>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-gradient-to-br from-coral-500 to-coral-600 text-white p-4 rounded-2xl shadow-lg shadow-coral-300 hover:shadow-xl hover:shadow-coral-400 transition-all"
            title="Создать объявление"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
          </button>
        </div>
      )}

      {/* Modals */}
      {isCreateModalOpen && (
        <CreatePost
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            setIsCreateModalOpen(false);
            loadPosts();
          }}
        />
      )}

      {selectedPost && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setSelectedPost(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            <div className="relative h-64 sm:h-80 bg-gradient-to-br from-gray-100 to-gray-200">
              <img
                src={
                  selectedPost.imageUrl ||
                  selectedPost.image_url ||
                  'https://via.placeholder.com/600'
                }
                alt={selectedPost.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
              <button
                onClick={() => setSelectedPost(null)}
                className="absolute top-4 right-4 bg-white/20 backdrop-blur-md text-white p-2.5 rounded-xl hover:bg-white/30 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="p-8">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold uppercase text-white shadow-sm ${selectedPost.type === PostType.LOST ? 'bg-coral-500' : 'bg-teal-500'}`}
                    >
                      {selectedPost.type === PostType.LOST ? 'ПРОПАЛ' : 'НАЙДЕН'}
                    </span>
                    {selectedPost.status === 'RESOLVED' && (
                      <span className="px-3 py-1 rounded-full text-xs font-bold uppercase text-white bg-teal-600 flex items-center gap-1 shadow-sm">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                        ДОМА!
                      </span>
                    )}
                    <span className="text-sm text-gray-400">{formatDate(selectedPost)}</span>
                  </div>
                  <h2 className="text-3xl font-bold text-gray-900">{selectedPost.title}</h2>
                </div>
                {selectedPost.reward && (
                  <div className="bg-warm-100 text-warm-500 px-4 py-2 rounded-xl font-bold flex items-center gap-2 shadow-sm border border-warm-200">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    {selectedPost.reward}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Описание
                  </h3>
                  <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">
                    {selectedPost.description}
                  </p>
                </div>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      Местоположение
                    </h3>
                    <div className="flex items-center text-gray-800 mb-3">
                      <svg
                        className="w-5 h-5 mr-2 text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                      {selectedPost.location}
                    </div>
                    {selectedPost.latitude && selectedPost.longitude && (
                      <LocationMap
                        latitude={selectedPost.latitude}
                        longitude={selectedPost.longitude}
                        location={selectedPost.location}
                        type={selectedPost.type}
                      />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1">
                      Контакты
                    </h3>
                    <div className="flex items-center text-gray-800 bg-gray-50 p-3 rounded-lg border border-gray-200">
                      <svg
                        className="w-5 h-5 mr-2 text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                        />
                      </svg>
                      {selectedPost.contactInfo || selectedPost.contact_info}
                    </div>
                  </div>
                </div>
              </div>

              {/* Match Suggestions */}
              {selectedPost.status !== 'RESOLVED' && (
                <div className="border-t border-gray-100 pt-6 mb-6">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                    Возможные совпадения
                  </h3>
                  {isLoadingMatches ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-coral-500"></div>
                    </div>
                  ) : matches.length > 0 ? (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {matches.map(match => (
                        <MatchCard
                          key={match.id}
                          match={match}
                          onClick={() => handleSelectPost(match)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 bg-gradient-to-br from-gray-50 to-teal-50/30 rounded-xl border border-gray-100">
                      <svg
                        className="w-10 h-10 mx-auto text-gray-300 mb-2"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                      </svg>
                      <p className="text-sm text-gray-500 font-medium">
                        Пока нет подходящих совпадений
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Совпадения появятся автоматически
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="border-t border-gray-100 pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src={
                        selectedPost.user.avatarUrl ||
                        selectedPost.user.avatar_url ||
                        'https://avatars.yandex.net/get-yapic/0/0-0/islands-200'
                      }
                      alt=""
                      className="w-10 h-10 rounded-full"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        Автор: {selectedPost.user.name}
                      </p>
                      <p className="text-xs text-gray-500">Подтверждённый пользователь</p>
                    </div>
                  </div>
                  {user && selectedPost.user.id === user.id && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setIsEditModalOpen(true)}
                        className="px-4 py-2 text-sm font-medium text-teal-600 hover:text-teal-700 hover:bg-teal-50 rounded-xl transition-colors border border-teal-200"
                      >
                        Редактировать
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="px-4 py-2 text-sm font-medium text-coral-600 hover:text-coral-700 hover:bg-coral-50 rounded-xl transition-colors border border-coral-200"
                      >
                        Удалить
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Comments Section */}
              <div className="border-t border-gray-100 pt-6 mt-6">
                <CommentSection
                  postId={selectedPost.id}
                  isAuthenticated={!!user}
                  currentUserId={user?.id}
                  onLoginClick={login}
                />
              </div>
            </div>
          </div>

          {/* Delete Confirmation Dialog */}
          {showDeleteConfirm && (
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-fade-in"
              onClick={() => setShowDeleteConfirm(false)}
            >
              <div
                className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-slide-up"
                onClick={e => e.stopPropagation()}
              >
                <div className="w-12 h-12 bg-coral-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-6 h-6 text-coral-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2 text-center">
                  Удалить объявление?
                </h3>
                <p className="text-gray-500 mb-6 text-center text-sm">
                  Это действие нельзя отменить. Объявление будет удалено навсегда.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 font-medium transition-colors"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={handleDeletePost}
                    disabled={isDeleting}
                    className="flex-1 px-4 py-2.5 bg-coral-600 text-white rounded-xl hover:bg-coral-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isDeleting ? 'Удаление...' : 'Удалить'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit Post Modal */}
      {isEditModalOpen && selectedPost && (
        <EditPost
          post={selectedPost}
          onClose={() => setIsEditModalOpen(false)}
          onSuccess={updatedPost => {
            // Update in posts list
            setPosts(posts.map(p => (p.id === updatedPost.id ? normalizePost(updatedPost) : p)));
            // Update selected post
            setSelectedPost(normalizePost(updatedPost));
            setIsEditModalOpen(false);
          }}
        />
      )}

      {/* My Posts Modal */}
      {isMyPostsOpen && (
        <MyPosts
          onClose={() => setIsMyPostsOpen(false)}
          onSelectPost={post => {
            setIsMyPostsOpen(false);
            handleSelectPost(post);
          }}
        />
      )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
