'use client';

import React, { useState, useEffect } from 'react';
import { FiSave, FiEye, FiCalendar, FiImage, FiLink, FiTag, FiUsers, FiStar, FiX, FiPlus } from 'react-icons/fi';
import { useACLPermissions } from '@/hooks/useACLPermissions';
import ReminderManager from '../reminders/ReminderManager';
import { fetchWithToken } from '@/lib/tokenStorage';
import { useI18n } from '@/contexts/I18nContext';

interface NewsCategory {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
}

interface NewsPost {
  id?: string;
  title: string;
  content: string;
  excerpt: string;
  media_urls: string[];
  external_links: Array<{url: string, title: string}>;
  author_id: string;
  category_id: string;
  tags: string[];
  visibility_settings: {
    public: boolean;
    roles: string[];
    users: string[];
  };
  scheduled_for?: string;
  featured: boolean;
  pinned: boolean;
  status: 'draft' | 'scheduled' | 'published' | 'archived';
}

interface NewsPostEditorProps {
  userId: string;
  postId?: string;
  onSave?: (post: NewsPost) => void;
  onCancel?: () => void;
  // Opcional: reportar rascunho atual para preview em tempo real
  onDraftChange?: (draft: NewsPost) => void;
  // Opcional: sobrescrever classes do container externo (para layouts fullscreen)
  containerClassName?: string;
}

const NewsPostEditor: React.FC<NewsPostEditorProps> = ({
  userId,
  postId,
  onSave,
  onCancel,
  onDraftChange,
  containerClassName
}) => {
  const [post, setPost] = useState<NewsPost>({
    title: '',
    content: '',
    excerpt: '',
    media_urls: [],
    external_links: [],
    author_id: userId,
    category_id: '',
    tags: [],
    visibility_settings: {
      public: true,
      roles: [],
      users: []
    },
    featured: false,
    pinned: false,
    status: 'draft'
  });

  const [categories, setCategories] = useState<NewsCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'content' | 'media' | 'settings' | 'reminders'>('content');
  const [newTag, setNewTag] = useState('');
  const [newLink, setNewLink] = useState({ url: '', title: '' });

  const { hasPermission } = useACLPermissions(userId);

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

  // Atualiza o consumidor do editor sobre alterações do rascunho
  useEffect(() => {
    onDraftChange?.(post);
  }, [post]);

  // Carregar post existente
  const loadPost = async () => {
    if (!postId) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/news/posts/${postId}`);
      const data = await response.json();
      
      if (response.ok) {
        const hydrated = {
          ...data,
          media_urls: JSON.parse(data.media_urls || '[]'),
          external_links: JSON.parse(data.external_links || '[]'),
          tags: JSON.parse(data.tags || '[]'),
          visibility_settings: JSON.parse(data.visibility_settings || '{"public": true, "roles": [], "users": []}')
        };
        setPost(hydrated);
        onDraftChange?.(hydrated);
      } else {
        setError(data.error || 'Erro ao carregar post');
      }
    } catch (err) {
      setError('Erro ao carregar post');
    } finally {
      setLoading(false);
    }
  };

  // Ouvir atalhos vindos do container fullscreen
  useEffect(() => {
    const listener = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;
      if (detail.action === 'save') savePost('draft');
      if (detail.action === 'publish') savePost('published');
    };
    window.addEventListener('news-editor:shortcut', listener as EventListener);
    return () => window.removeEventListener('news-editor:shortcut', listener as EventListener);
  }, []);

  // Salvar post
  const savePost = async (status?: string) => {
    try {
      setSaving(true);
      setError(null);

      const postData = {
        ...post,
        status: status || post.status
      };

      const url = postId ? `/api/news/posts/${postId}` : '/api/news/posts';
      const method = postId ? 'PUT' : 'POST';

      const response = await fetchWithToken(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postData)
      });

      const result = await response.json();

      if (response.ok) {
        if (onSave) {
          onSave(result);
        }
      } else {
        setError(result.error || 'Erro ao salvar post');
      }
    } catch (err) {
      setError('Erro ao salvar post');
    } finally {
      setSaving(false);
    }
  };

  // Adicionar tag
  const addTag = () => {
    if (newTag.trim() && !post.tags.includes(newTag.trim())) {
      setPost({
        ...post,
        tags: [...post.tags, newTag.trim()]
      });
      setNewTag('');
    }
  };

  // Remover tag
  const removeTag = (tagToRemove: string) => {
    setPost({
      ...post,
      tags: post.tags.filter(tag => tag !== tagToRemove)
    });
  };

  // Adicionar link externo
  const addExternalLink = () => {
    if (newLink.url.trim() && newLink.title.trim()) {
      setPost({
        ...post,
        external_links: [...post.external_links, { ...newLink }]
      });
      setNewLink({ url: '', title: '' });
    }
  };

  // Remover link externo
  const removeExternalLink = (index: number) => {
    setPost({
      ...post,
      external_links: post.external_links.filter((_, i) => i !== index)
    });
  };

  useEffect(() => {
    loadCategories();
    if (postId) {
      loadPost();
    }
  }, [postId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-2 text-gray-600">Carregando...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-200">
        <h1 className="text-xl font-semibold text-gray-900">
          {postId ? 'Editar Post' : 'Novo Post'}
        </h1>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => savePost('draft')}
            disabled={saving}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50"
            title="Ctrl/Cmd+S"
          >
            Salvar Rascunho
          </button>
          {hasPermission('news.publish') && (
            <button
              onClick={() => savePost('published')}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              title="Ctrl/Cmd+Enter"
            >
              {saving ? 'Salvando...' : 'Publicar'}
            </button>
          )}
          {onCancel && (
            <button
              onClick={onCancel}
              className="p-2 text-gray-400 hover:text-gray-600"
            >
              <FiX className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border-b border-red-200">
          <div className="text-red-700">{error}</div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {[
          { id: 'content', label: {t('components.conteudo')}, icon: FiEye },
          { id: 'media', label: {t('components.midiaLinks')}, icon: FiImage },
          { id: 'settings', label: {t('components.configuracoes')}, icon: FiUsers },
          { id: 'reminders', label: 'Lembretes', icon: FiCalendar }
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 px-6 py-3 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'content' && (
          <div className="space-y-6">
            {/* Título */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Título
              </label>
              <input
                type="text"
                value={post.title}
                onChange={(e) => setPost({ ...post, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder={t('components.tituloDoPost')}
              />
            </div>

            {/* Resumo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Resumo
              </label>
              <textarea
                value={post.excerpt}
                onChange={(e) => setPost({ ...post, excerpt: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={3}
                placeholder="Resumo do post (aparece no feed)"
              />
            </div>

            {/* Conteúdo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Conteúdo
              </label>
              <textarea
                value={post.content}
                onChange={(e) => setPost({ ...post, content: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={12}
                placeholder={t('components.conteudoCompletoDoPost')}
              />
            </div>

            {/* Categoria */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Categoria
              </label>
              <select
                value={post.category_id}
                onChange={(e) => setPost({ ...post, category_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Selecione uma categoria</option>
                {categories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tags
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {post.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                  >
                    #{tag}
                    <button
                      onClick={() => removeTag(tag)}
                      className="ml-2 text-blue-600 hover:text-blue-800"
                    >
                      <FiX className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addTag()}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Nova tag"
                />
                <button
                  onClick={addTag}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <FiPlus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'media' && (
          <div className="space-y-6">
            {/* URLs de Mídia */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                URLs de Imagens/Vídeos
              </label>
              <div className="space-y-2">
                {post.media_urls.map((url, index) => (
                  <div key={index} className="flex space-x-2">
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => {
                        const newUrls = [...post.media_urls];
                        newUrls[index] = e.target.value;
                        setPost({ ...post, media_urls: newUrls });
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder={t('components.urlDaMidia')}
                    />
                    <button
                      onClick={() => {
                        const newUrls = post.media_urls.filter((_, i) => i !== index);
                        setPost({ ...post, media_urls: newUrls });
                      }}
                      className="px-3 py-2 text-red-600 hover:text-red-800"
                    >
                      <FiX className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => setPost({ ...post, media_urls: [...post.media_urls, ''] })}
                  className="flex items-center space-x-2 px-4 py-2 text-blue-600 hover:text-blue-800"
                >
                  <FiPlus className="w-4 h-4" />
                  <span>Adicionar Mídia</span>
                </button>
              </div>
            </div>

            {/* Links Externos */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Links Externos
              </label>
              <div className="space-y-3">
                {post.external_links.map((link, index) => (
                  <div key={index} className="flex space-x-2">
                    <input
                      type="text"
                      value={link.title}
                      onChange={(e) => {
                        const newLinks = [...post.external_links];
                        newLinks[index].title = e.target.value;
                        setPost({ ...post, external_links: newLinks });
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder={t('components.tituloDoLink')}
                    />
                    <input
                      type="url"
                      value={link.url}
                      onChange={(e) => {
                        const newLinks = [...post.external_links];
                        newLinks[index].url = e.target.value;
                        setPost({ ...post, external_links: newLinks });
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="URL do link"
                    />
                    <button
                      onClick={() => removeExternalLink(index)}
                      className="px-3 py-2 text-red-600 hover:text-red-800"
                    >
                      <FiX className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                
                {/* Novo Link */}
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newLink.title}
                    onChange={(e) => setNewLink({ ...newLink, title: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder={t('components.tituloDoLink')}
                  />
                  <input
                    type="url"
                    value={newLink.url}
                    onChange={(e) => setNewLink({ ...newLink, url: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="URL do link"
                  />
                  <button
                    onClick={addExternalLink}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <FiPlus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6">
            {/* Opções de Destaque */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Opções de Destaque</h3>
              
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={post.featured}
                  onChange={(e) => setPost({ ...post, featured: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">Post em destaque</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={post.pinned}
                  onChange={(e) => setPost({ ...post, pinned: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">Fixar no topo</span>
              </label>
            </div>

            {/* Agendamento */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Agendamento</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Agendar para
                </label>
                <input
                  type="datetime-local"
                  value={post.scheduled_for || ''}
                  onChange={(e) => setPost({ ...post, scheduled_for: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Visibilidade */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Visibilidade</h3>
              
              <label className="flex items-center mb-4">
                <input
                  type="checkbox"
                  checked={post.visibility_settings.public}
                  onChange={(e) => setPost({
                    ...post,
                    visibility_settings: {
                      ...post.visibility_settings,
                      public: e.target.checked
                    }
                  })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">Público (visível para todos)</span>
              </label>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Roles com acesso
                </label>
                <div className="space-y-2">
                  {['ADMIN', 'MANAGER', 'USER'].map(role => (
                    <label key={role} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={post.visibility_settings.roles.includes(role)}
                        onChange={(e) => {
                          const roles = e.target.checked
                            ? [...post.visibility_settings.roles, role]
                            : post.visibility_settings.roles.filter(r => r !== role);
                          setPost({
                            ...post,
                            visibility_settings: {
                              ...post.visibility_settings,
                              roles
                            }
                          });
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">{role}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'reminders' && (
          <ReminderManager userId={userId} postId={postId} />
        )}
      </div>
    </div>
  );
};

export default NewsPostEditor;
