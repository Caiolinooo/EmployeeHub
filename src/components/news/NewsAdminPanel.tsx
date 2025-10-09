'use client';

import React, { useState, useEffect } from 'react';
import { FiPlus, FiEdit, FiTrash2, FiEye, FiCalendar, FiHeart, FiMessageCircle, FiStar, FiBookmark, FiFilter, FiSearch, FiRefreshCw } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';
import { useACLPermissions } from '@/hooks/useACLPermissions';
import NewsPostEditor from './NewsPostEditor';
import { fetchWithToken } from '@/lib/tokenStorage';

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
                        <div className="flex items-center">
                          <FiEye className="w-4 h-4 mr-1" />
                          <span>{post.views_count}</span>
                        </div>
                        <div className="flex items-center">
                          <FiHeart className="w-4 h-4 mr-1" />
                          <span>{post.likes_count}</span>
                        </div>
                        <div className="flex items-center">
                          <FiMessageCircle className="w-4 h-4 mr-1" />
                          <span>{post.comments_count}</span>
                        </div>
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
                        className="p-2 text-gray-400 hover:text-blue-600 rounded"
                        title="Editar"
                      >
                        <FiEdit className="w-4 h-4" />
                      </button>
                    )}

                    {canPublishNews && (
                      <button
                        onClick={() => toggleFeatured(post.id, post.featured)}
                        className={`p-2 rounded ${
                          post.featured 
                            ? 'text-yellow-600 hover:text-yellow-700' 
                            : 'text-gray-400 hover:text-yellow-600'
                        }`}
                        title={post.featured ? 'Remover destaque' : 'Destacar'}
                      >
                        <FiStar className="w-4 h-4" />
                      </button>
                    )}

                    {hasPermission('news.delete') && (
                      <button
                        onClick={() => deletePost(post.id)}
                        className="p-2 text-gray-400 hover:text-red-600 rounded"
                        title="Excluir"
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
    </div>
  );
};

export default NewsAdminPanel;
