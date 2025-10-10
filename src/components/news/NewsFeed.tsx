'use client';

import React, { useState, useEffect } from 'react';
import { FiHeart, FiMessageCircle, FiShare2, FiBookmark, FiMoreHorizontal, FiEye, FiCalendar, FiUser, FiImage, FiStar, FiPlus } from 'react-icons/fi';
import { useACLPermissions } from '@/hooks/useACLPermissions';
import { useI18n } from '@/contexts/I18nContext';
import { useToast } from '@/hooks/useToast';
import InstagramStylePostCreator from './InstagramStylePostCreator';
import PostTypeSelector from './PostTypeSelector';
import MediaUploadWithFilters from './MediaUploadWithFilters';
import EventCreator from './EventCreator';
import HighlightCreator from './HighlightCreator';
import NewsCommentSection from './NewsCommentSection';
import NewsPostEditor from './NewsPostEditor';
import NewsPostEditorFullScreen from './NewsPostEditorFullScreen';
import useNewsRealtime from '@/hooks/useNewsRealtime';
import { fetchWithToken } from '@/lib/tokenStorage';

interface NewsCategory { id: string; name: string; color: string; }

interface NewsPost {
  id: string;
  title: string;
  content: string;
  excerpt: string;
  media_urls: string[];
  external_links: Array<{url: string, title: string}>;
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
    description: string;
    color: string;
    icon: string;
  } | null;
  tags: string[];
  published_at: string;
  likes_count: number;
  comments_count: number;
  views_count: number;
  featured: boolean;
  pinned: boolean;
  user_liked?: boolean;
}

interface NewsFeedProps {
  userId?: string;
  category?: string;
  featured?: boolean;
  limit?: number;
}

const NewsFeed: React.FC<NewsFeedProps> = ({
  userId,
  category,
  featured,
  limit = 10
}) => {
  const { t } = useI18n();
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPost, setEditingPost] = useState<NewsPost | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [showMediaUpload, setShowMediaUpload] = useState(false);
  const [showEventCreator, setShowEventCreator] = useState(false);
  const [showHighlightCreator, setShowHighlightCreator] = useState(false);
  const [selectedMediaType, setSelectedMediaType] = useState<'photo' | 'video'>('photo');
  const [openMenuPostId, setOpenMenuPostId] = useState<string | null>(null);
  const { toast } = useToast();
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [editingCategory, setEditingCategory] = useState<string>('');
  const [editingTags, setEditingTags] = useState<string>(''); // CSV simples

  const [editingTitle, setEditingTitle] = useState('');
  const [editingExcerpt, setEditingExcerpt] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const handlePostTypeSelect = (type: 'photo' | 'video' | 'event' | 'highlight' | 'text') => {
    switch (type) {
      case 'photo':
      case 'video':
        setSelectedMediaType(type);
        setShowMediaUpload(true);
        break;
      case 'event':
        setShowEventCreator(true);
        break;
      case 'highlight':
        setShowHighlightCreator(true);
        break;
      case 'text':
        setShowCreateModal(true);
        break;
    }
  };

  const beginInlineEdit = (post: NewsPost) => {
    setEditingPostId(post.id);
    setEditingTitle(post.title);
    setEditingExcerpt(post.excerpt);
    setEditingContent(post.content || '');
    setEditingCategory(post.category?.id || '');
    setEditingTags(Array.isArray(post.tags) ? post.tags.join(', ') : '');
    setOpenMenuPostId(null);
  };

  const cancelInlineEdit = () => {
    setEditingPostId(null);
    setEditingTitle('');
    setEditingExcerpt('');
  };

  const saveInlineEdit = async (post: NewsPost) => {
    try {
      setSavingEdit(true);
      const payload: any = {
        title: editingTitle,
        excerpt: editingExcerpt,
        content: editingContent,
        category_id: editingCategory || null,
        tags: editingTags.split(',').map(t => t.trim()).filter(Boolean)
      };
      const res = await fetchWithToken(`/api/news/posts/${post.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar');
      setPosts(prev => prev.map(p => p.id === post.id ? {
        ...p,
        title: data.title,
        excerpt: data.excerpt,
        content: data.content,
        category: data.category,
        tags: Array.isArray(data.tags) ? data.tags : (typeof data.tags === 'string' ? JSON.parse(data.tags || '[]') : [])
      } : p));
      toast.success('Post atualizado');
      cancelInlineEdit();
    } catch (e) {
      console.error(e);
      toast.error('Falha ao salvar alterações');
    } finally {
      setSavingEdit(false);
    }
  };


  const handleDeletePost = async (postId: string) => {
    if (!confirm('Tem certeza que deseja excluir este post?')) return;
    try {
      const res = await fetchWithToken(`/api/news/posts/${postId}`, { method: 'DELETE' });
      if (res.ok) {
        setPosts(prev => prev.filter(p => p.id !== postId));
      }
    } catch (e) {
      console.error('Erro ao excluir post:', e);
    } finally {
      setOpenMenuPostId(null);
    }
  };

  const handleEditPost = (postId: string) => {
    window.location.href = `/news?tab=admin&edit=${postId}`;
  };

  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});

  const { hasPermission } = useACLPermissions(userId);

  // Carregar posts
  const loadPosts = async (pageNum: number = 1, reset: boolean = false) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: limit.toString(),
        status: 'published'
      });

      if (category) params.append('category', category);
      if (featured) params.append('featured', 'true');

      const response = await fetch(`/api/news/posts?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao carregar posts');
      }

      if (reset) {
        setPosts(data.posts);
      } else {
        setPosts(prev => [...prev, ...data.posts]);
      }

      setHasMore(data.pagination.hasNext);
      setPage(pageNum);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  // Carregar posts iniciais
  useEffect(() => {
    loadPosts(1, true);
  }, [category, featured, limit]);

  // Realtime: likes/comentrios atualizados em tempo real
  useNewsRealtime(
    posts.map(p => p.id),
    {
      onLikesChange: (postId, payload) => {
        setPosts(prev => prev.map(p => p.id === postId ? {
          ...p,
          likes_count: payload.count ?? (p.likes_count + (payload.delta || 0))
        } : p));
      },
      onCommentsChange: (postId, payload) => {
        setPosts(prev => prev.map(p => p.id === postId ? {
          ...p,
          comments_count: payload.count ?? (p.comments_count + (payload.delta || 0))
        } : p));
      },
      onPostUpdate: (postId, partial) => {
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, ...partial } : p));
      }
    }
  );

  // Função para curtir/descurtir post com animação
  const handleLike = async (postId: string) => {
    if (!userId) return;

    // Atualização otimista da UI
    setPosts(prev => prev.map(post =>
      post.id === postId
        ? {
            ...post,
            likes_count: post.user_liked ? post.likes_count - 1 : post.likes_count + 1,
            user_liked: !post.user_liked
          }
        : post
    ));

    try {
      const response = await fetch(`/api/news/posts/${postId}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId })
      });

      const result = await response.json();

      if (!response.ok) {
        // Reverter se houver erro
        setPosts(prev => prev.map(post =>
          post.id === postId
            ? {
                ...post,
                likes_count: post.user_liked ? post.likes_count - 1 : post.likes_count + 1,
                user_liked: !post.user_liked
              }
            : post
        ));
      }
    } catch (error) {
      console.error('Erro ao curtir post:', error);
      // Reverter em caso de erro
      setPosts(prev => prev.map(post =>
        post.id === postId
          ? {
              ...post,
              likes_count: post.user_liked ? post.likes_count - 1 : post.likes_count + 1,
              user_liked: !post.user_liked
            }
          : post
      ));
    }
  };

  // Duplo clique para curtir (como Instagram)
  const handleDoubleClick = (postId: string) => {
    if (!userId) return;

    const post = posts.find(p => p.id === postId);
    if (post && !post.user_liked) {
      handleLike(postId);

      // Animação de coração
      const heartElement = document.getElementById(`heart-animation-${postId}`);
      if (heartElement) {
        heartElement.classList.remove('hidden');
        heartElement.classList.add('animate-ping');
        setTimeout(() => {
          heartElement.classList.add('hidden');
          heartElement.classList.remove('animate-ping');
        }, 1000);
      }
    }
  };

  // Função para carregar mais posts
  const loadMore = () => {
    if (!loading && hasMore) {
      loadPosts(page + 1, false);
    }
  };

  // Função para formatar data
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 1) return 'Agora há pouco';
    if (diffInHours < 24) return `${diffInHours}h`;
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d`;
    return date.toLocaleDateString('pt-BR');
  };

  // Compartilhar post
  const handleShare = async (post: NewsPost) => {
    try {
      const shareData: ShareData = {
        title: post.title,
        text: post.excerpt || post.title,
        url: `${window.location.origin}/noticias?id=${post.id}`
      };
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareData.url || '');
        alert('Link copiado para a área de transferência');
      }
    } catch (e) {
      console.error('Falha ao compartilhar:', e);
    }
  };

  // Renderizar post individual
  const renderPost = (post: NewsPost) => {
    return (
    <div key={post.id} className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
      {/* Header do Post */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
            <FiUser className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-semibold text-gray-900">
                {post.author.first_name} {post.author.last_name}
              </h3>
              {post.category && (
                <span
                  className="px-2 py-1 text-xs rounded-full text-white"
                  style={{ backgroundColor: post.category.color }}
                >
                  {post.category.name}
                </span>
              )}
              {post.featured && (
                <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                  Destaque
                </span>
              )}
            </div>
            <div className="flex items-center text-sm text-gray-500 space-x-2">
              <FiCalendar className="w-4 h-4" />
              <span>{formatDate(post.published_at)}</span>
              <span>•</span>

              <FiEye className="w-4 h-4" />
              <span>{post.views_count} visualizações</span>
            </div>
          </div>
        </div>
        <div className="relative">
          <button
            onClick={() => setOpenMenuPostId(openMenuPostId === post.id ? null : post.id)}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <FiMoreHorizontal className="w-5 h-5 text-gray-500" />
          </button>
          {openMenuPostId === post.id && (
            <div className="absolute right-0 mt-2 w-44 bg-white border rounded shadow z-10">
              {/* Copiar link */}
              <button
                onClick={() => handleShare(post)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
              >Copiar link</button>

              {/* Editar post inline (somente autorizado) */}
              {(hasPermission('news.edit') || hasPermission('news.publish')) && (
                <button
                  onClick={() => { setEditingPost(post); setShowEditModal(true); setOpenMenuPostId(null); }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                >Editar</button>
              )}

              {/* Excluir post (somente autorizado) */}
              {(hasPermission('news.delete') || hasPermission('news.publish')) && (
                <button
                  onClick={() => handleDeletePost(post.id)}
                  className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                >Excluir</button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Conteúdo do Post */}
      <div className="px-4 pb-3">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">{post.title}</h2>
        <p className="text-gray-700 leading-relaxed">{post.excerpt}</p>

        {/* Tags */}
        {Array.isArray(post.tags) && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {post.tags.map((tag, index) => (
              <span
                key={index}
                className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Links Externos */}
        {Array.isArray(post.external_links) && post.external_links.length > 0 && (
          <div className="mt-3 space-y-2">
            {post.external_links.map((link, index) => (
              <a
                key={index}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="text-sm font-medium text-blue-600">{link.title}</div>
                <div className="text-xs text-gray-500">{link.url}</div>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Mídia */}
      {post.media_urls.length > 0 && (
        <div className="relative">
          <div className="grid grid-cols-1 gap-2">
            {post.media_urls.map((url, index) => (
              <div
                key={index}
                className="relative"
                onDoubleClick={() => handleDoubleClick(post.id)}
              >
                <img
                  src={url}
                  alt={`Mídia ${index + 1}`}
                  className="w-full h-auto cursor-pointer select-none"
                />
                {/* Animação de coração para duplo clique */}
                <div
                  id={`heart-animation-${post.id}`}
                  className="absolute inset-0 flex items-center justify-center hidden pointer-events-none"
                >
                  <FiHeart className="w-20 h-20 text-red-500 fill-current" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ações */}
      <div className="px-4 py-3 border-t border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <button
              onClick={() => handleLike(post.id)}
              className={`flex items-center space-x-2 group ${
                post.user_liked ? 'text-red-500' : 'text-gray-500 hover:text-red-500'
              } transition-all duration-200`}
              disabled={!userId}
            >
              <div className="relative">
                <FiHeart
                  className={`w-5 h-5 transition-all duration-200 ${
                    post.user_liked
                      ? 'fill-current scale-110'
                      : 'group-hover:scale-110'
                  }`}
                />
                {post.user_liked && (
                  <div className="absolute inset-0 animate-ping">
                    <FiHeart className="w-5 h-5 text-red-300 fill-current" />
                  </div>
                )}
              </div>
              <span className="text-sm font-medium">{post.likes_count}</span>
            </button>

            <button
              onClick={() => setExpandedComments(prev => ({ ...prev, [post.id]: !prev[post.id] }))}
              className="flex items-center space-x-2 text-gray-500 hover:text-blue-500 transition-colors"
            >
              <FiMessageCircle className="w-5 h-5" />
              <span className="text-sm font-medium">{post.comments_count}</span>
            </button>

            <button
              onClick={() => handleShare(post)}
              className="flex items-center space-x-2 text-gray-500 hover:text-green-500 transition-colors"
            >
              <FiShare2 className="w-5 h-5" />
              <span className="text-sm font-medium">Compartilhar</span>
            </button>
          </div>

          <button className="text-gray-500 hover:text-yellow-500 transition-colors">
            <FiBookmark className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Comentários */}
      {expandedComments[post.id] && (
        <div className="border-t border-gray-100">
          <NewsCommentSection postId={post.id} userId={userId || ''} />
        </div>
      )}

    </div>
  );
  };

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-red-500 mb-2">Erro ao carregar posts</div>
        <div className="text-gray-500 text-sm">{error}</div>
        <button
          onClick={() => loadPosts(1, true)}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          Tentar Novamente
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Create Post Card - Instagram Style */}
      {userId && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6 p-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <FiUser className="w-5 h-5 text-white" />
            </div>
            <button
              onClick={() => setShowTypeSelector(true)}
              className="flex-1 text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
            >
              {t('newsSystem.whatAreYouThinking')}
            </button>
          </div>
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
            <button
              onClick={() => handlePostTypeSelect('photo')}
              className="flex items-center space-x-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <FiImage className="w-4 h-4" />
              <span>Foto/Vídeo</span>
            </button>
            <button
              onClick={() => handlePostTypeSelect('event')}
              className="flex items-center space-x-2 px-4 py-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
            >
              <FiCalendar className="w-4 h-4" />
              <span>Evento</span>
            </button>
            <button
              onClick={() => handlePostTypeSelect('highlight')}
              className="flex items-center space-x-2 px-4 py-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
            >
              <FiStar className="w-4 h-4" />
              <span>Destaque</span>
            </button>
          </div>
        </div>
      )}

      {/* Posts */}
      {posts.map(renderPost)}

      {/* Loading */}
      {loading && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <div className="text-gray-500 mt-2">Carregando posts...</div>
        </div>
      )}

      {/* Load More */}
      {!loading && hasMore && (
        <div className="text-center py-4">
          <button
            onClick={loadMore}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Carregar Mais
          </button>
        </div>
      )}

      {/* No More Posts */}
      {!loading && !hasMore && posts.length > 0 && (
        <div className="text-center py-8 text-gray-500">
          Você viu todos os posts disponíveis
        </div>
      )}

      {/* Empty State */}
      {!loading && posts.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-500 mb-2">Nenhum post encontrado</div>
          {userId && (
            <button onClick={() => setShowCreateModal(true)} className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
              Criar Primeiro Post
            </button>
          )}
        </div>
      )}

      {/* Post Type Selector Modal */}
      <PostTypeSelector
        isOpen={showTypeSelector}
        onClose={() => setShowTypeSelector(false)}
        onSelectType={handlePostTypeSelect}
      />

      {/* Media Upload with Filters Modal */}
      <MediaUploadWithFilters
        isOpen={showMediaUpload}
        onClose={() => setShowMediaUpload(false)}
        userId={userId || ''}
        onPostCreated={(newPost) => {
          setPosts(prev => [newPost, ...prev]);
          setShowMediaUpload(false);
        }}
        mediaType={selectedMediaType}
      />

      {/* Event Creator Modal */}
      <EventCreator
        isOpen={showEventCreator}
        onClose={() => setShowEventCreator(false)}
        userId={userId || ''}
        onEventCreated={(newPost) => {
          setPosts(prev => [newPost, ...prev]);
          setShowEventCreator(false);
        }}
      />

      {/* Highlight Creator Modal */}
      <HighlightCreator
        isOpen={showHighlightCreator}
        onClose={() => setShowHighlightCreator(false)}
        userId={userId || ''}
        onHighlightCreated={(newPost) => {
          setPosts(prev => [newPost, ...prev]);
          setShowHighlightCreator(false);
        }}
      />

      {/* Instagram Style Post Creator Modal (for text posts) */}
      <InstagramStylePostCreator
        userId={userId || ''}
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onPostCreated={(newPost) => {
          setPosts(prev => [newPost, ...prev]);
          setShowCreateModal(false);
        }}
      />

      {/* Edit Post Modal */}
      {showEditModal && editingPost && (
        <NewsPostEditorFullScreen
          userId={userId || ''}
          postId={editingPost.id}
          onClose={() => { setShowEditModal(false); setEditingPost(null); }}
        />
      )}

    </div>
  );
};

export default NewsFeed;
