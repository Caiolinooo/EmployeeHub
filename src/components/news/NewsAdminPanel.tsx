'use client';

import React, { useState, useEffect } from 'react';
import { FiPlus, FiEdit, FiTrash2, FiEye, FiCalendar, FiHeart, FiMessageCircle, FiStar, FiBookmark, FiFilter, FiSearch, FiRefreshCw, FiX, FiUsers } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';
import { useACLPermissions } from '@/hooks/useACLPermissions';
import NewsPostEditor from './NewsPostEditor';
import { fetchWithToken } from '@/lib/tokenStorage';
import NewsCommentSection from './NewsCommentSection';
import UserProfileModal from './UserProfileModal';

interface Viewer {
  user_id: string | null;
  session_id?: string;
  viewed_at: string;
  duration_seconds: number;
  user: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    role: string;
    avatar?: string;
  } | null;
  is_anonymous: boolean;
}

interface NewsPost {
  id: string;
  title: string;
  excerpt: string;
  status: 'draft' | 'scheduled' | 'published' | 'archived';
  featured: boolean;
  pinned: boolean;
  likes_count: number;
  comments_count: number;
  views_count: number;
  published_at: string;
  created_at: string;
  author: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    role: string;
  };
  category: {
    id: string;
    name: string;
    color: string;
  } | null;
}

interface NewsCategory {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
}

interface NewsAdminPanelProps {
  userId: string;
}

const NewsAdminPanel: React.FC<NewsAdminPanelProps> = ({ userId }) => {
  const { t } = useI18n();
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [categories, setCategories] = useState<NewsCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    status: 'all',
    category: '',
    search: '',
    featured: false
  });
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Viewers modal state
  const [showViewersModal, setShowViewersModal] = useState(false);
  const [selectedPostForViewers, setSelectedPostForViewers] = useState<string | null>(null);
  const [viewers, setViewers] = useState<Viewer[]>([]);
  const [viewersLoading, setViewersLoading] = useState(false);
  const [viewersStats, setViewersStats] = useState<{ total_views: number; unique_viewers: number; anonymous_views: number } | null>(null);

  const { hasPermission, canCreateNews, canPublishNews } = useACLPermissions(userId);

  // Carregar posts
  const loadPosts = async (pageNum: number = 1, reset: boolean = false) => {
    try {
      setLoading(true);

      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: '20',
        status: filters.status === 'all' ? 'all' : filters.status,
        ...(filters.category && { category: filters.category }),
        ...(filters.search && { search: filters.search }),
        ...(filters.featured && { featured: 'true' })
      });

      const response = await fetch(`/api/news/posts?${params}`);
      const data = await response.json();

      if (response.ok) {
        if (reset) {
          setPosts(data.posts);
        } else {
          setPosts(prev => [...prev, ...data.posts]);
        }
        setHasMore(data.pagination.hasNext);
        setPage(pageNum);
      }
    } catch (error) {
      console.error('Erro ao carregar posts:', error);
    } finally {
      setLoading(false);
    }
  };

  // Carregar categorias
  const loadCategories = async () => {
    try {
      const response = await fetch('/api/news/categories');
      const data = await response.json();
      if (response.ok) {
        setCategories(data);
      }
    } catch (error) {
      console.error('Erro ao carregar categorias:', error);
    }
  };

  // Excluir post
  const deletePost = async (postId: string) => {
    if (!confirm('Tem certeza que deseja excluir este post?')) return;

    try {
      const response = await fetchWithToken(`/api/news/posts/${postId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setPosts(prev => prev.filter(post => post.id !== postId));
      }
    } catch (error) {
      console.error('Erro ao excluir post:', error);
    }
  };

  // Alternar status de destaque
  // Fetch viewers for a post
  const fetchViewers = async (postId: string) => {
    try {
      setViewersLoading(true);
      setSelectedPostForViewers(postId);
      setShowViewersModal(true);

      const response = await fetchWithToken(`/api/news/posts/${postId}/viewers`);
      const data = await response.json();

      if (response.ok && data.success) {
        setViewers(data.viewers || []);
        setViewersStats(data.stats || null);
      } else {
        console.error('Erro ao carregar visualizadores:', data.error);
        setViewers([]);
      }
    } catch (error) {
      console.error('Erro ao carregar visualizadores:', error);
      setViewers([]);
    } finally {
      setViewersLoading(false);
    }
  };

  const toggleFeatured = async (postId: string, featured: boolean) => {
    try {
      const response = await fetchWithToken(`/api/news/posts/${postId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ featured: !featured })
      });

      if (response.ok) {
        setPosts(prev => prev.map(post =>
          post.id === postId ? { ...post, featured: !featured } : post
        ));
      }
    } catch (error) {
      console.error('Erro ao alterar destaque:', error);
    }
  };

  // Formatar data
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  // Obter badge de status
  const getStatusBadge = (status: string) => {
    const badges = {
      draft: { color: 'bg-gray-100 text-gray-800', text: 'Rascunho' },
      scheduled: { color: 'bg-blue-100 text-blue-800', text: 'Agendado' },
      published: { color: 'bg-green-100 text-green-800', text: 'Publicado' },
      archived: { color: 'bg-red-100 text-red-800', text: 'Arquivado' }
    };

    const badge = badges[status as keyof typeof badges] || badges.draft;

    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        {badge.text}
      </span>
    );
  };

  // Aplicar filtros
  const applyFilters = () => {
    loadPosts(1, true);
  };

  useEffect(() => {
    loadCategories();
    loadPosts(1, true);
  }, []);

  useEffect(() => {
    applyFilters();
  }, [filters]);

  // Interactions modal state
  const [showInteractionsModal, setShowInteractionsModal] = useState(false);
  const [selectedPostForInteractions, setSelectedPostForInteractions] = useState<NewsPost | null>(null);

  // Profile modal state
  const [selectedUserForProfile, setSelectedUserForProfile] = useState<any | null>(null);

  const openInteractions = (post: NewsPost) => {
    setSelectedPostForInteractions(post);
    setShowInteractionsModal(true);
  };

  const openUserProfile = (user: any) => {
    if (!user) return;
    setSelectedUserForProfile(user);
  };

  if (showEditor) {
    return (
      <NewsPostEditor
        userId={userId}
        postId={editingPostId || undefined}
        onSave={() => {
          setShowEditor(false);
          setEditingPostId(null);
          loadPosts(1, true);
        }}
        onCancel={() => {
          setShowEditor(false);
          setEditingPostId(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('newsSystem.admin', 'Gerenciar Notícias')}</h1>
          <p className="text-gray-600">{t('newsSystem.adminDesc', 'Crie e gerencie posts de notícias estilo Instagram')}</p>
        </div>
        {canCreateNews && (
          <button
            onClick={() => setShowEditor(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <FiPlus className="w-4 h-4" />
            <span>{t('newsSystem.newPost', 'Novo Post')}</span>
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">Todos</option>
              <option value="draft">Rascunho</option>
              <option value="scheduled">Agendado</option>
              <option value="published">Publicado</option>
              <option value="archived">Arquivado</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Categoria
            </label>
            <select
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Todas</option>
              {categories.map(category => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Buscar
            </label>
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Buscar posts..."
              />
            </div>
          </div>

          <div className="flex items-end">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={filters.featured}
                onChange={(e) => setFilters({ ...filters, featured: e.target.checked })}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">Apenas destaques</span>
            </label>
          </div>
        </div>
      </div>

      {/* Lista de Posts */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading && posts.length === 0 ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
            <div className="text-gray-500 mt-2">Carregando posts...</div>
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-500 mb-2">Nenhum post encontrado</div>
            {canCreateNews && (
              <button
                onClick={() => setShowEditor(true)}
                className="text-blue-600 hover:text-blue-700"
              >
                Criar primeiro post
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {posts.map((post) => (
              <div key={post.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-medium text-gray-900">{post.title}</h3>
                      {getStatusBadge(post.status)}
                      {post.featured && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          <FiStar className="w-3 h-3 mr-1" />
                          Destaque
                        </span>
                      )}
                      {post.pinned && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          <FiBookmark className="w-3 h-3 mr-1" />
                          Fixado
                        </span>
                      )}
                    </div>

                    <p className="text-gray-600 text-sm mb-3 line-clamp-2">{post.excerpt}</p>

                    <div className="flex items-center space-x-6 text-sm text-gray-500">
                      <div className="flex items-center">
                        <span>Por {post.author.first_name} {post.author.last_name}</span>
                      </div>

                      {post.category && (
                        <div className="flex items-center">
                          <span
                            className="w-3 h-3 rounded-full mr-2"
                            style={{ backgroundColor: post.category.color }}
                          ></span>
                          <span>{post.category.name}</span>
                        </div>
                      )}

                      <div className="flex items-center">
                        <FiCalendar className="w-4 h-4 mr-1" />
                        <span>{formatDate(post.published_at || post.created_at)}</span>
                      </div>

                      <div className="flex items-center space-x-4">
                        <button
                          onClick={() => fetchViewers(post.id)}
                          className="flex items-center hover:text-blue-600 transition-colors group"
                          title="Ver quem visualizou"
                        >
                          <FiEye className="w-4 h-4 mr-1 group-hover:scale-110 transition-transform" />
                          <span className="group-hover:underline">{post.views_count}</span>
                        </button>
                        <div className="flex items-center">
                          <FiHeart className="w-4 h-4 mr-1" />
                          <span>{post.likes_count}</span>
                        </div>
                        <button
                          onClick={() => openInteractions(post)}
                          className="flex items-center hover:text-blue-600 transition-colors group"
                          title="Ver interações/comentários"
                        >
                          <FiMessageCircle className="w-4 h-4 mr-1 group-hover:scale-110 transition-transform" />
                          <span className="group-hover:underline">{post.comments_count}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    {hasPermission('news.update') && (
                      <button
                        onClick={() => {
                          setEditingPostId(post.id);
                          setShowEditor(true);
                        }}
                        className="p-2 text-gray-500 hover:text-blue-600 rounded"
                        title="Editar"
                        aria-label="Editar"
                      >
                        <FiEdit className="w-4 h-4" />
                      </button>
                    )}

                    {canPublishNews && (
                      <button
                        onClick={() => toggleFeatured(post.id, post.featured)}
                        className={`p-2 rounded ${post.featured
                          ? 'text-yellow-600 hover:text-yellow-700'
                          : 'text-gray-500 hover:text-yellow-600'
                          }`}
                        title={post.featured ? 'Remover destaque' : 'Destacar'}
                        aria-label={post.featured ? 'Remover destaque' : 'Destacar'}
                      >
                        <FiStar className="w-4 h-4" />
                      </button>
                    )}

                    {hasPermission('news.delete') && (
                      <button
                        onClick={() => deletePost(post.id)}
                        className="p-2 text-gray-500 hover:text-red-600 rounded"
                        title="Excluir"
                        aria-label="Excluir"
                      >
                        <FiTrash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Load More */}
        {!loading && hasMore && (
          <div className="p-4 text-center border-t border-gray-200">
            <button
              onClick={() => loadPosts(page + 1, false)}
              className="px-4 py-2 text-blue-600 hover:text-blue-700"
            >
              Carregar mais posts
            </button>
          </div>
        )}
      </div>

      {/* Viewers Modal */}
      {showViewersModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="flex items-center space-x-2">
                <FiUsers className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">Visualizadores</h3>
              </div>
              <button
                onClick={() => { setShowViewersModal(false); setSelectedPostForViewers(null); setViewers([]); }}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <FiX className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Stats */}
            {viewersStats && (
              <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 border-b border-gray-200">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{viewersStats.total_views}</div>
                  <div className="text-xs text-gray-500">Total de Views</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{viewersStats.unique_viewers}</div>
                  <div className="text-xs text-gray-500">Únicos</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-500">{viewersStats.anonymous_views}</div>
                  <div className="text-xs text-gray-500">Anônimos</div>
                </div>
              </div>
            )}

            {/* Viewers List */}
            <div className="overflow-y-auto max-h-[400px] p-4">
              {viewersLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                  <div className="text-gray-500 mt-2">Carregando visualizadores...</div>
                </div>
              ) : viewers.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Nenhum visualizador registrado ainda
                </div>
              ) : (
                <div className="space-y-3">
                  {viewers.map((viewer, index) => (
                    <div
                      key={index}
                      onClick={() => openUserProfile(viewer.user)}
                      className={`flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors ${viewer.user ? 'cursor-pointer' : ''}`}
                    >
                      <div className="flex items-center space-x-3">
                        {viewer.user ? (
                          <>
                            <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                              {viewer.user.avatar ? (
                                <img src={viewer.user.avatar} alt={viewer.user.first_name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white font-medium">
                                  {viewer.user.first_name?.charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">
                                {viewer.user.first_name} {viewer.user.last_name}
                              </div>
                              <div className="text-xs text-gray-500">{viewer.user.email}</div>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center">
                              <FiUsers className="w-5 h-5 text-gray-500" />
                            </div>
                            <div>
                              <div className="font-medium text-gray-600">
                                {viewer.user_id ? 'Usuário não identificado' : 'Visitante Anônimo'}
                              </div>
                              <div className="text-xs text-gray-500">
                                {viewer.user_id ? `ID: ${viewer.user_id}` : `Sessão: ${viewer.session_id?.substring(0, 8)}...`}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-500">
                          {new Date(viewer.viewed_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                        </div>
                        {viewer.duration_seconds > 0 && (
                          <div className="text-xs text-blue-500">
                            {Math.round(viewer.duration_seconds / 60)}min leitura
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Interactions Modal */}
      {showInteractionsModal && selectedPostForInteractions && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
              <h3 className="text-lg font-semibold text-gray-900">Interações: {selectedPostForInteractions.title}</h3>
              <button
                onClick={() => setShowInteractionsModal(false)}
                className="p-2 hover:bg-gray-200 rounded-full transition-colors"
              >
                <FiX className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-white">
              {/* Reuse NewsCommentSection for full commenting capability */}
              <NewsCommentSection postId={selectedPostForInteractions.id} userId={userId} />
            </div>
          </div>
        </div>
      )}

      {/* User Profile Modal */}
      {selectedUserForProfile && (
        <UserProfileModal
          user={selectedUserForProfile}
          onClose={() => setSelectedUserForProfile(null)}
        />
      )}
    </div>
  );
};

export default NewsAdminPanel;
