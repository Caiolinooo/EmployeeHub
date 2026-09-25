'use client';

import React, { useState, useEffect } from 'react';
import { FiHeart, FiMessageCircle, FiShare2, FiBookmark, FiMoreHorizontal, FiEye, FiCalendar, FiUser, FiUsers, FiMapPin, FiClock, FiImage, FiStar, FiPlus } from 'react-icons/fi';
import { FaHeart } from 'react-icons/fa';
import { useACLPermissions } from '@/hooks/useACLPermissions';
import { useI18n } from '@/contexts/I18nContext';
import { useToast } from '@/hooks/useToast';
import { formatViewsWithText } from '@/lib/formatters';
import InstagramStylePostCreator from './InstagramStylePostCreator';
import PostTypeSelector from './PostTypeSelector';
import MediaUploadWithFilters from './MediaUploadWithFilters';
import EventCreator from './EventCreator';
import HighlightCreator from './HighlightCreator';
import TextPostCreator from './TextPostCreator';
import NewsCommentSection from './NewsCommentSection';
import NewsPostEditor from './NewsPostEditor';
import NewsPostEditorFullScreen from './NewsPostEditorFullScreen';
import useNewsRealtime from '@/hooks/useNewsRealtime';
import { fetchWithToken } from '@/lib/tokenStorage';
import NewsHighlights from './NewsHighlights';
import ViewTracker from './ViewTracker';
import { toSafeMediaUrl } from '@/lib/security/safe-media-url';

interface NewsCategory { id: string; name: string; color: string; }

interface NewsPost {
  id: string;
  title: string;
  content: string;
  excerpt: string;
  media_urls: string[];
  external_links: Array<{ url: string, title: string }>;
  author: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    role: string;
    avatar?: string;
    drive_photo_url?: string;
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
  metadata?: any;
  latest_likes?: Array<{
    userId: string;
    firstName: string;
    lastName: string;
    avatar?: string;
  }>;
}

interface NewsFeedProps {
  userId?: string;
  category?: string;
  featured?: boolean;
  limit?: number;
  searchQuery?: string;
  selectedPostId?: string;
}

function parseArrayValue<T = any>(value: any): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed as T[] : [];
    } catch {
      return [];
    }
  }
  return [];
}

function normalizeFetchedPost(post: any): NewsPost {
  return {
    ...post,
    media_urls: parseArrayValue<string>(post?.media_urls),
    external_links: parseArrayValue<{ url: string; title: string }>(post?.external_links),
    tags: parseArrayValue<string>(post?.tags),
  };
}

const NewsFeed: React.FC<NewsFeedProps> = ({
  userId,
  category,
  featured,
  limit = 10,
  searchQuery = '',
  selectedPostId
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
  const [showTextPostCreator, setShowTextPostCreator] = useState(false);
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [showMediaUpload, setShowMediaUpload] = useState(false);
  const [showEventCreator, setShowEventCreator] = useState(false);
  const [showHighlightCreator, setShowHighlightCreator] = useState(false);
  const [selectedMediaType, setSelectedMediaType] = useState<'photo' | 'video'>('photo');
  const [openMenuPostId, setOpenMenuPostId] = useState<string | null>(null);
  const [hoveredLikesPostId, setHoveredLikesPostId] = useState<string | null>(null);
  const [likesList, setLikesList] = useState<any[]>([]);
  const [loadingLikes, setLoadingLikes] = useState(false);
  const { toast } = useToast();
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [editingCategory, setEditingCategory] = useState<string>('');
  const [editingTags, setEditingTags] = useState<string>(''); // CSV simples

  const [editingTitle, setEditingTitle] = useState('');
  const [editingExcerpt, setEditingExcerpt] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [hasFocusedSelectedPost, setHasFocusedSelectedPost] = useState(false);

  const handlePostTypeSelect = (type: 'media' | 'event' | 'highlight' | 'text') => {
    switch (type) {
      case 'media':
        // Media aceita tanto foto quanto vídeo
        setSelectedMediaType('photo'); // Tipo padrão, usuário escolhe depois
        setShowMediaUpload(true);
        break;
      case 'event':
        setShowEventCreator(true);
        break;
      case 'highlight':
        setShowHighlightCreator(true);
        break;
      case 'text':
        setShowTextPostCreator(true);
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
      toast.success(t('newsSystem.post.postUpdated'));
      cancelInlineEdit();
    } catch (e) {
      console.error(e);
      toast.error(t('components.falhaAoSalvarAlteracoes'));
    } finally {
      setSavingEdit(false);
    }
  };


  const handleDeletePost = async (postId: string) => {
    if (!confirm(t('newsSystem.post.confirmDelete'))) return;
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

  const { hasPermission, canCreateNews } = useACLPermissions(userId);

  // Efeito para registrar view (apenas uma vez por sessão/load)
  // Em uma implementação ideal, usaria IntersectionObserver para contar apenas se visto na tela.
  // Como MVP, vamos contar quando o card é carregado e renderizado se o usuário passar um tempo na página (ex: scroll)
  // Ou simplesmente: Ao clicar para expandir/ver detalhes.
  // O usuário pediu: "Média de visualizações (ou cliques)". Vamos focar em interações ou 'Rendered View'
  // Vamos implementar uma função auxiliar para registrar
  const registerView = async (postId: string) => {
    if (!userId) return;
    try {
      // Verificar se já registramos nessa sessão para economizar requests
      const sessionKey = `viewed-${postId}`;
      if (sessionStorage.getItem(sessionKey)) return;

      await fetch(`/api/news/${postId}/view`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      sessionStorage.setItem(sessionKey, 'true');
    } catch (e) {
      console.warn('Falha ao registrar view', e);
    }
  };

  useEffect(() => {
    // Registrar views para os posts carregados (Impressões)
    // Para não flodar a API, faremos isso com debounce ou lazy
    // Por enquanto, vamos registrar apenas POSTS DESTAQUE ou quando CLICADOS.
    // Mas o pedido foi "Média de visualizações". Se for apenas clique, o número será baixo.
    // Vamos registrar visualização para todos os posts renderizados, mas com um delay.
    if (posts.length > 0 && userId) {
      const timeout = setTimeout(() => {
        posts.forEach(post => {
          registerView(post.id);
        });
      }, 5000); // Só conta se ficar 5s na página com os posts carregados
      return () => clearTimeout(timeout);
    }
  }, [posts, userId]);

  useEffect(() => {
    setHasFocusedSelectedPost(false);
  }, [selectedPostId]);

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

      if (category && category !== 'all') params.append('category', category);
      if (featured) params.append('featured', 'true');
      if (searchQuery) params.append('search', searchQuery);

      const response = await fetchWithToken(`/api/news/posts?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao carregar posts');
      }

      const fetchedPosts = (data.posts || []).map(normalizeFetchedPost);
      let postsToStore = fetchedPosts;

      if (reset && selectedPostId && !fetchedPosts.some((post: NewsPost) => post.id === selectedPostId)) {
        try {
          const selectedPostResponse = await fetchWithToken(`/api/news/posts/${selectedPostId}`);
          if (selectedPostResponse.ok) {
            const selectedPost = normalizeFetchedPost(await selectedPostResponse.json());
            postsToStore = [selectedPost, ...fetchedPosts.filter((post: NewsPost) => post.id !== selectedPost.id)];
          }
        } catch (selectedPostError) {
          console.warn('Não foi possível carregar o post destacado pelo link:', selectedPostError);
        }
      }

      if (reset) {
        setPosts(postsToStore);
      } else {
        setPosts(prev => {
          const nextPosts = [...prev];
          postsToStore.forEach((post: NewsPost) => {
            if (!nextPosts.some(existingPost => existingPost.id === post.id)) {
              nextPosts.push(post);
            }
          });
          return nextPosts;
        });
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
  }, [category, featured, limit, searchQuery, selectedPostId]);

  useEffect(() => {
    if (!selectedPostId || hasFocusedSelectedPost || !posts.some(post => post.id === selectedPostId)) {
      return;
    }

    const timeout = window.setTimeout(() => {
      const selectedElement = document.getElementById(`news-post-${selectedPostId}`);
      if (selectedElement) {
        selectedElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHasFocusedSelectedPost(true);
      }
    }, 200);

    return () => window.clearTimeout(timeout);
  }, [posts, selectedPostId, hasFocusedSelectedPost]);

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
    setPosts(prev => prev.map(post => {
      if (post.id === postId) {
        let newLatestLikes = post.latest_likes || [];
        if (!post.user_liked) {
          if (!newLatestLikes.find(l => l.userId === userId)) {
            newLatestLikes = [{ userId: userId, firstName: 'Você', lastName: '' }, ...newLatestLikes];
          }
        } else {
          newLatestLikes = newLatestLikes.filter(l => l.userId !== userId);
        }
        return {
          ...post,
          likes_count: post.user_liked ? post.likes_count - 1 : post.likes_count + 1,
          user_liked: !post.user_liked,
          latest_likes: newLatestLikes
        };
      }
      return post;
    }));

    try {
      const response = await fetch(`/api/news/posts/${postId}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId })
      });

      const result = await response.json();

      if (!response.ok) {
        // Reverter se houver erro
        setPosts(prev => prev.map(post => {
          if (post.id === postId) {
            let revertLatestLikes = post.latest_likes || [];
            if (post.user_liked) { // reverting back to liked
              if (!revertLatestLikes.find(l => l.userId === userId)) revertLatestLikes = [{ userId: userId, firstName: 'Você', lastName: '' }, ...revertLatestLikes];
            } else { // reverting back to unliked
              revertLatestLikes = revertLatestLikes.filter(l => l.userId !== userId);
            }
            return {
              ...post,
              likes_count: post.user_liked ? post.likes_count - 1 : post.likes_count + 1,
              user_liked: !post.user_liked,
              latest_likes: revertLatestLikes
            };
          }
          return post;
        }));
      }
    } catch (error) {
      console.error('Erro ao curtir post:', error);
      // Reverter em caso de erro
      setPosts(prev => prev.map(post => {
        if (post.id === postId) {
          let revertLatestLikes = post.latest_likes || [];
          if (post.user_liked) { // reverting back to liked
            if (!revertLatestLikes.find(l => l.userId === userId)) revertLatestLikes = [{ userId: userId, firstName: 'Você', lastName: '' }, ...revertLatestLikes];
          } else { // reverting back to unliked
            revertLatestLikes = revertLatestLikes.filter(l => l.userId !== userId);
          }
          return {
            ...post,
            likes_count: post.user_liked ? post.likes_count - 1 : post.likes_count + 1,
            user_liked: !post.user_liked,
            latest_likes: revertLatestLikes
          };
        }
        return post;
      }));
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

    if (diffInHours < 1) return t('newsSystem.post.justNow');
    if (diffInHours < 24) return `${diffInHours}h`;
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d`;
    return date.toLocaleDateString('pt-BR');
  };



  const fetchLikesList = async (postId: string) => {
    try {
      setLoadingLikes(true);
      setLikesList([]);
      const res = await fetchWithToken(`/api/news/posts/${postId}/likes_list`);
      if (res.ok) {
        const data = await res.json();
        setLikesList(data.likes || []);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingLikes(false);
    }
  };

  // Compartilhar post
  const handleShare = async (post: NewsPost) => {
    const url = `${window.location.origin}/noticias?id=${post.id}`;
    const shareData: ShareData = {
      title: post.title,
      text: post.excerpt || post.title,
      url: url
    };

    try {
      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(url);
        toast.success(t('newsSystem.post.linkCopied'));
      }
    } catch (e) {
      console.error('Falha ao compartilhar:', e);
      // Fallback manual se clipboard falhar
      prompt(t('newsSystem.post.copyLinkFallback'), url);
    }
  };



  // Renderizar post individual
  const renderPost = (post: NewsPost) => {
    const isSelectedPost = selectedPostId === post.id;

    return (
      <ViewTracker key={post.id} postId={post.id} userId={userId}>
        <div
          id={`news-post-${post.id}`}
          className={`bg-white rounded-lg shadow-sm border mb-6 scroll-mt-24 transition-all ${isSelectedPost
            ? 'border-blue-400 ring-2 ring-blue-100 shadow-lg shadow-blue-100/70'
            : 'border-gray-200'
            }`}
        >

          {/* Header do Post */}
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                {post.author.avatar || post.author.drive_photo_url ? (
                  <img
                    src={post.author.avatar || post.author.drive_photo_url}
                    alt={post.author.first_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white">
                    {post.author.first_name?.charAt(0).toUpperCase()}
                  </div>
                )}
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
                  <span>{post.views_count === 0 ? t('newsSystem.post.views_0') : post.views_count === 1 ? t('newsSystem.post.views_1') : t('newsSystem.post.views_other', { count: post.views_count })}</span>
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
                  >{t('newsSystem.post.copyLink')}</button>

                  {/* Editar post inline (somente autorizado) */}
                  {(hasPermission('news.edit') || hasPermission('news.publish')) && (
                    <button
                      onClick={() => { setEditingPost(post); setShowEditModal(true); setOpenMenuPostId(null); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                    > {t('newsSystem.post.edit')}</button>
                  )}

                  {/* Excluir post (somente autorizado) */}
                  {(hasPermission('news.delete') || hasPermission('news.publish')) && (
                    <button
                      onClick={() => handleDeletePost(post.id)}
                      className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                    > {t('newsSystem.post.delete')}</button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Conteúdo do Post */}
          <div className="px-4 pb-3">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">{post.title}</h2>
            {isSelectedPost && (
              <div className="mb-3 inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                Publicação aberta a partir da notificação
              </div>
            )}
            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{post.excerpt}</p>

            {/* Componente visual de evento */}
            {post.metadata?.type === 'event' && (
              <div className="mt-4 p-4 bg-green-50 border border-green-100 rounded-lg shadow-sm">
                <div className="flex items-center space-x-2 text-green-800 mb-2">
                  <FiCalendar className="w-5 h-5" />
                  <span className="font-semibold">Detalhes do Evento</span>
                </div>
                <div className="space-y-2 mt-3 text-sm text-gray-700">
                  {post.metadata.startDate && (
                    <div className="flex items-center space-x-2">
                      <FiClock className="w-4 h-4 text-green-600" />
                      <span>
                        <strong>Data/Hora:</strong>{' '}
                        {new Date(post.metadata.startDate).toLocaleString('pt-BR', {
                          dateStyle: 'medium',
                          timeStyle: 'short'
                        })}
                        {post.metadata.endDate && post.metadata.endDate !== post.metadata.startDate &&
                          ` até ${new Date(post.metadata.endDate).toLocaleString('pt-BR', {
                            dateStyle: 'medium',
                            timeStyle: 'short'
                          })}`
                        }
                      </span>
                    </div>
                  )}
                  {post.metadata.location && (
                    <div className="flex items-center space-x-2">
                      <FiMapPin className="w-4 h-4 text-green-600" />
                      <span><strong>Local:</strong> {post.metadata.location}</span>
                    </div>
                  )}
                  {post.metadata.attendees && post.metadata.attendees.length > 0 && (
                    <div className="flex items-start space-x-2">
                      <FiUsers className="w-4 h-4 text-green-600 mt-1" />
                      <span>
                        <strong>Convidados ({post.metadata.attendees.length}):</strong>{' '}
                        {post.metadata.attendees.join(', ')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

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
          {
            post.media_urls.length > 0 && (
              <div className="relative">
                <div className="grid grid-cols-1 gap-2">
                  {post.media_urls.map((url, index) => (
                    <div
                      key={index}
                      className="relative"
                      onDoubleClick={() => handleDoubleClick(post.id)}
                    >
                      {/* Detectar se é vídeo pela extensão ou tipo MIME */}
                      {url.match(/\.(mp4|webm|ogg|mov)$/i) ? (
                        <video
                          src={toSafeMediaUrl(url)}
                          className="w-full h-auto cursor-pointer select-none"
                          controls
                          playsInline
                          preload="metadata"
                        />
                      ) : (
                        <img
                          src={toSafeMediaUrl(url)}
                          alt={t('newsSystem.post.mediaAlt', { index: index + 1 })}
                          className="w-full h-auto cursor-pointer select-none"
                        />
                      )}
                      {/* Animação de coração para duplo clique */}
                      <div
                        id={`heart-animation-${post.id}`}
                        className="absolute inset-0 flex items-center justify-center hidden pointer-events-none"
                      >
                        <FaHeart className="w-20 h-20 text-white drop-shadow-lg" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          }

          {/* Ações */}
          <div className="px-4 py-3 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-6">
                <button
                  onClick={() => handleLike(post.id)}
                  className={`flex items-center space-x-2 group ${post.user_liked ? 'text-red-500' : 'text-gray-500 hover:text-red-500'
                    } transition-all duration-200`}
                  disabled={!userId}
                >
                  <div className="relative">
                    {post.user_liked ? (
                      <FaHeart
                        className={`w-5 h-5 transition-all duration-200 text-red-500 scale-110`}
                      />
                    ) : (
                      <FiHeart
                        className={`w-5 h-5 transition-all duration-200 group-hover:scale-110`}
                      />
                    )}
                    {post.user_liked && (
                      <div className="absolute inset-0 animate-ping">
                        <FaHeart className="w-5 h-5 text-red-300" />
                      </div>
                    )}
                  </div>
                  <span
                    className="text-sm font-medium cursor-pointer hover:underline relative"
                    onMouseEnter={() => {
                      setHoveredLikesPostId(post.id);
                      fetchLikesList(post.id);
                    }}
                    onMouseLeave={() => {
                      setHoveredLikesPostId(null);
                    }}
                  >
                    {post.likes_count}

                    {hoveredLikesPostId === post.id && (
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 bg-white rounded-lg shadow-xl border border-gray-100 z-50 overflow-hidden">
                        <div className="p-2 max-h-48 overflow-y-auto custom-scrollbar">
                          {loadingLikes ? (
                            <div className="text-center py-2 text-xs text-gray-500">Carregando...</div>
                          ) : likesList.length > 0 ? (
                            <div className="space-y-2">
                              {likesList.map((user: any) => (
                                <div key={user.userId} className="flex items-center space-x-2">
                                  <div className="w-6 h-6 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                                    {user.avatar ? (
                                      <img src={user.avatar} alt={user.firstName} className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="w-full h-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-[10px] text-white">
                                        {user.firstName[0]}
                                      </div>
                                    )}
                                  </div>
                                  <span className="text-xs text-gray-700 truncate font-medium">
                                    {user.firstName} {user.lastName}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-2 text-xs text-gray-500">Nenhuma curtida ainda</div>
                          )}
                        </div>
                      </div>
                    )}
                  </span>
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


            </div>

            {/* Liked By Section - Instagram Style */}
            {post.likes_count > 0 && (
              <div className="mt-3 flex items-center space-x-2">
                {post.latest_likes && post.latest_likes.length > 0 && (
                  <div className="flex -space-x-2 overflow-hidden">
                    {post.latest_likes.slice(0, 3).map((user) => (
                      <div key={user.userId} className="inline-block h-5 w-5 rounded-full ring-2 ring-white bg-gray-200 overflow-hidden">
                        {user.avatar ? (
                          <img src={user.avatar} alt={user.firstName} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-[8px] text-white">
                            {user.firstName[0]}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <div className="text-sm">
                  <span className="text-gray-900">Curtido por </span>
                  <span className="font-semibold text-gray-900">
                    {post.latest_likes?.[0]?.firstName || 'alguém'}
                  </span>
                  {post.likes_count > 1 && (
                    <>
                      <span className="text-gray-900"> e </span>
                      <button
                        className="font-semibold text-gray-900 cursor-pointer hover:underline"
                        onClick={() => {
                          setHoveredLikesPostId(post.id);
                          fetchLikesList(post.id);
                        }}
                      >
                        outras {post.likes_count - 1} pessoas
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Comentários */}
          {
            expandedComments[post.id] && (
              <div className="border-t border-gray-100">
                <NewsCommentSection postId={post.id} userId={userId || ''} />
              </div>
            )
          }

        </div>
      </ViewTracker>
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
      {/* Highlights / Stories */}
      <NewsHighlights userId={userId || ''} canCreate={canCreateNews} />

      {/* Create Post Card - Instagram Style - Only for certain roles */}
      {userId && canCreateNews && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6 p-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <FiUser className="w-5 h-5 text-white" />
            </div>
            <button
              onClick={() => setShowTypeSelector(true)}
              className="flex-1 text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
            >
              {t('newsSystem.whatAreYouThinkingLabel')}
            </button>
          </div>
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
            <button
              onClick={() => handlePostTypeSelect('media')}
              className="flex items-center space-x-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <FiImage className="w-4 h-4" />
              <span>{t('newsSystem.postType.media')}</span>
            </button>
            <button
              onClick={() => handlePostTypeSelect('event')}
              className="flex items-center space-x-2 px-4 py-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
            >
              <FiCalendar className="w-4 h-4" />
              <span>{t('newsSystem.postType.event')}</span>
            </button>
            <button
              onClick={() => handlePostTypeSelect('highlight')}
              className="flex items-center space-x-2 px-4 py-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
            >
              <FiStar className="w-4 h-4" />
              <span>{t('newsSystem.postType.highlight')}</span>
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
            <button onClick={() => setShowTypeSelector(true)} className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
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

      {/* Text Post Creator Modal */}
      <TextPostCreator
        isOpen={showTextPostCreator}
        onClose={() => setShowTextPostCreator(false)}
        userId={userId || ''}
        onPostCreated={(newPost) => {
          setPosts(prev => [newPost, ...prev]);
          setShowTextPostCreator(false);
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
