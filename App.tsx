import React, { useState, useEffect, useCallback } from 'react';
import { api } from './services/api';
import { PetPost, PostType, normalizePost } from './types';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import PetCard from './components/PetCard';
import CreatePost from './components/CreatePost';
import LocationMap from './components/LocationMap';

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
    const timestamp = post.createdAt || (post.created_at ? new Date(post.created_at).getTime() : Date.now());
    return new Date(timestamp).toLocaleDateString('ru-RU');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
                  Д
                </div>
                <span className="font-bold text-xl text-gray-900 tracking-tight">ДомойСкорей</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {authLoading ? (
                <div className="animate-pulse h-8 w-24 bg-gray-200 rounded-lg"></div>
              ) : user ? (
                <>
                  <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="hidden sm:flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Создать объявление
                  </button>
                  <div className="flex items-center gap-3 ml-2">
                    <img className="h-8 w-8 rounded-full border border-gray-200" src={user.avatarUrl || user.avatar_url || 'https://avatars.yandex.net/get-yapic/0/0-0/islands-200'} alt="" />
                    <span className="text-sm text-gray-700 hidden sm:block">{user.name}</span>
                    <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-900 font-medium">Выйти</button>
                  </div>
                </>
              ) : (
                <button
                    onClick={login}
                    className="flex items-center gap-2 bg-[#FC3F1D] hover:bg-[#E53510] text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M2 12C2 6.48 6.48 2 12 2s10 4.48 10 10-4.48 10-10 10S2 17.52 2 12zm10.5-5.5h-1.02c-1.87 0-2.94 1.01-2.94 2.47 0 1.19.54 1.94 1.69 2.74l.95.66-2.71 4.13h1.9l2.34-3.72.62.43c1.35.94 1.96 1.66 1.96 3.02 0 .09 0 .18-.01.27h1.72V6.5h-1.83v4.62c-.56-.72-1.33-1.29-2.28-1.94l-.39-.27V6.5z"/>
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
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">

        {/* Search & Stats Header */}
        <div className="mb-8 text-center sm:text-left">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Найдите своего пропавшего друга.</h1>
            <p className="text-gray-600 max-w-2xl">
                ДомойСкорей помогает мгновенно сопоставлять объявления о пропавших и найденных животных в вашем районе.
            </p>
        </div>

        {/* Action Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-8">
            {/* Tabs */}
            <div className="flex p-1 space-x-1 bg-gray-200 rounded-xl w-full sm:w-auto">
                {(['ALL', PostType.LOST, PostType.FOUND] as const).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`w-full sm:w-32 py-2.5 text-sm font-medium rounded-lg leading-5 transition-all
                            ${activeTab === tab
                                ? 'bg-white text-blue-700 shadow'
                                : 'text-gray-600 hover:text-gray-800 hover:bg-white/[0.12]'
                            }`}
                    >
                        {tab === 'ALL' ? 'Все объявления' : tab === PostType.LOST ? 'Пропавшие' : 'Найденные'}
                    </button>
                ))}
            </div>

            {/* Search */}
            <form onSubmit={handleSearch} className="relative w-full sm:w-96">
                <input
                    type="text"
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow shadow-sm"
                    placeholder="Поиск по породе, цвету или местоположению..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
                <div className="absolute left-3 top-2.5 text-gray-400">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
                {searchQuery && (
                    <button type="button" onClick={clearSearch} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                         <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                )}
            </form>
        </div>

        {/* Results Grid */}
        {isLoading || isSearching ? (
             <div className="flex justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
             </div>
        ) : (
            <>
                {displayPosts.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {displayPosts.map(post => (
                            <PetCard
                                key={post.id}
                                post={post}
                                onClick={() => setSelectedPost(post)}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
                        <div className="text-gray-400 mb-4 text-4xl">🐾</div>
                        <h3 className="text-lg font-medium text-gray-900">Питомцы не найдены</h3>
                        <p className="text-gray-500">Попробуйте изменить параметры поиска или фильтры.</p>
                    </div>
                )}
            </>
        )}
      </main>

      {/* Floating Action Button for Mobile */}
      {user && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="sm:hidden fixed bottom-6 right-6 bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 transition-colors z-40"
          >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          </button>
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
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedPost(null)}>
              <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                  <div className="relative h-64 sm:h-80 bg-gray-200">
                      <img src={selectedPost.imageUrl || selectedPost.image_url || 'https://via.placeholder.com/600'} alt={selectedPost.title} className="w-full h-full object-cover" />
                      <button onClick={() => setSelectedPost(null)} className="absolute top-4 right-4 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70">
                          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                  </div>
                  <div className="p-8">
                      <div className="flex justify-between items-start mb-4">
                          <div>
                              <div className="flex items-center gap-2 mb-1">
                                  <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase text-white ${selectedPost.type === PostType.LOST ? 'bg-red-500' : 'bg-green-500'}`}>
                                      {selectedPost.type === PostType.LOST ? 'ПРОПАЛ' : 'НАЙДЕН'}
                                  </span>
                                  <span className="text-sm text-gray-500">{formatDate(selectedPost)}</span>
                              </div>
                              <h2 className="text-3xl font-bold text-gray-900">{selectedPost.title}</h2>
                          </div>
                          {selectedPost.reward && (
                              <div className="bg-amber-100 text-amber-800 px-4 py-2 rounded-lg font-bold">
                                  Вознаграждение {selectedPost.reward}
                              </div>
                          )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                          <div>
                              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Описание</h3>
                              <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">{selectedPost.description}</p>
                          </div>
                          <div className="space-y-4">
                              <div>
                                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Местоположение</h3>
                                  <div className="flex items-center text-gray-800 mb-3">
                                      <svg className="w-5 h-5 mr-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                      {selectedPost.location}
                                  </div>
                                  {(selectedPost.latitude && selectedPost.longitude) && (
                                      <LocationMap
                                          latitude={selectedPost.latitude}
                                          longitude={selectedPost.longitude}
                                          location={selectedPost.location}
                                          type={selectedPost.type}
                                      />
                                  )}
                              </div>
                              <div>
                                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1">Контакты</h3>
                                  <div className="flex items-center text-gray-800 bg-gray-50 p-3 rounded-lg border border-gray-200">
                                      <svg className="w-5 h-5 mr-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                      {selectedPost.contactInfo || selectedPost.contact_info}
                                  </div>
                              </div>
                          </div>
                      </div>

                      <div className="border-t border-gray-100 pt-6">
                           <div className="flex items-center justify-between">
                               <div className="flex items-center gap-3">
                                   <img src={selectedPost.user.avatarUrl || selectedPost.user.avatar_url || 'https://avatars.yandex.net/get-yapic/0/0-0/islands-200'} alt="" className="w-10 h-10 rounded-full" />
                                   <div>
                                       <p className="text-sm font-medium text-gray-900">Автор: {selectedPost.user.name}</p>
                                       <p className="text-xs text-gray-500">Подтверждённый пользователь</p>
                                   </div>
                               </div>
                               {user && selectedPost.user.id === user.id && (
                                   <button
                                       onClick={() => setShowDeleteConfirm(true)}
                                       className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                                   >
                                       Удалить
                                   </button>
                               )}
                           </div>
                      </div>
                  </div>
              </div>

              {/* Delete Confirmation Dialog */}
              {showDeleteConfirm && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4" onClick={() => setShowDeleteConfirm(false)}>
                      <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl" onClick={e => e.stopPropagation()}>
                          <h3 className="text-lg font-bold text-gray-900 mb-2">Удалить объявление?</h3>
                          <p className="text-gray-600 mb-6">Это действие нельзя отменить. Объявление будет удалено навсегда.</p>
                          <div className="flex gap-3">
                              <button
                                  onClick={() => setShowDeleteConfirm(false)}
                                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
                              >
                                  Отмена
                              </button>
                              <button
                                  onClick={handleDeletePost}
                                  disabled={isDeleting}
                                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                  {isDeleting ? 'Удаление...' : 'Удалить'}
                              </button>
                          </div>
                      </div>
                  </div>
              )}
          </div>
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
