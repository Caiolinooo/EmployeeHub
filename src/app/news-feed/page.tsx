'use client';

import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/Layout/MainLayout';
import { 
  HeartIcon, 
  ChatBubbleOvalLeftIcon, 
  ShareIcon,
  BookmarkIcon,
  EllipsisHorizontalIcon,
  PlusIcon
} from '@heroicons/react/24/outline';
import { 
  HeartIcon as HeartSolidIcon,
  BookmarkIcon as BookmarkSolidIcon
} from '@heroicons/react/24/solid';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';

interface NewsItem {
  id: string;
  title: string;
  description: string;
  content: string;
  date: string;
  author: string;
  category: string;
  thumbnail?: string;
  coverImage?: string;
  featured: boolean;
  likes_count?: number;
  comments_count?: number;
  tags?: string[];
}

interface NewsComment {
  id: string;
  content: string;
  parent_id?: string;
  created_at: string;
  user: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    role: string;
  };
  replies?: NewsComment[];
}

const NewsFeedPage: React.FC = () => {
  const { user } = useSupabaseAuth();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [savedPosts, setSavedPosts] = useState<Set<string>>(new Set());
  const [showComments, setShowComments] = useState<string | null>(null);
  const [comments, setComments] = useState<{ [key: string]: NewsComment[] }>({});
  const [newComment, setNewComment] = useState('');
  const [showCreatePost, setShowCreatePost] = useState(false);

  useEffect(() => {
    loadNews();
  }, []);

  const loadNews = async () => {
    try {
      const response = await fetch('/api/news');
      const data = await response.json();
      
      if (response.ok) {
        setNews(data);
      } else {
        console.error('Erro ao carregar notícias:', data.error);
      }
    } catch (error) {
      console.error('Erro ao carregar notícias:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (newsId: string) => {
    if (!user?.id) return;

    try {
      const isLiked = likedPosts.has(newsId);
      
      if (isLiked) {
        const response = await fetch(`/api/news/${newsId}/like?userId=${user.id}`, {
          method: 'DELETE'
        });
        
        if (response.ok) {
          setLikedPosts(prev => {
            const newSet = new Set(prev);
            newSet.delete(newsId);
            return newSet;
          });
        }
      } else {
        const response = await fetch(`/api/news/${newsId}/like`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ userId: user.id })
        });
        
        if (response.ok) {
          setLikedPosts(prev => new Set(prev).add(newsId));
        }
      }
    } catch (error) {
      console.error('Erro ao curtir/descurtir:', error);
    }
  };

  const handleSave = (newsId: string) => {
    setSavedPosts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(newsId)) {
        newSet.delete(newsId);
      } else {
        newSet.add(newsId);
      }
      return newSet;
    });
  };

  const loadComments = async (newsId: string) => {
    try {
      const response = await fetch(`/api/news/${newsId}/comments`);
      const data = await response.json();
      
      if (response.ok) {
        setComments(prev => ({
          ...prev,
          [newsId]: data.comments
        }));
      }
    } catch (error) {
      console.error('Erro ao carregar comentários:', error);
    }
  };

  const handleComment = async (newsId: string) => {
    if (!user?.id || !newComment.trim()) return;

    try {
      const response = await fetch(`/api/news/${newsId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user.id,
          content: newComment.trim()
        })
      });

      if (response.ok) {
        const comment = await response.json();
        setComments(prev => ({
          ...prev,
          [newsId]: [...(prev[newsId] || []), comment]
        }));
        setNewComment('');
      }
    } catch (error) {
      console.error('Erro ao comentar:', error);
    }
  };

  const toggleComments = (newsId: string) => {
    if (showComments === newsId) {
      setShowComments(null);
    } else {
      setShowComments(newsId);
      if (!comments[newsId]) {
        loadComments(newsId);
      }
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Agora há pouco';
    if (diffInHours < 24) return `${diffInHours}h`;
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d`;
    return date.toLocaleDateString('pt-BR');
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      'Geral': 'bg-blue-100 text-blue-800',
      'Tecnologia': 'bg-purple-100 text-purple-800',
      'Recursos Humanos': 'bg-green-100 text-green-800',
      'Logística': 'bg-orange-100 text-orange-800',
      'Segurança': 'bg-red-100 text-red-800',
      'Treinamento': 'bg-yellow-100 text-yellow-800'
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto py-6 px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">ABZ News Feed</h1>
            <p className="text-gray-600 mt-1">Fique por dentro das novidades da empresa</p>
          </div>
          
          {user && (
            <button
              onClick={() => setShowCreatePost(true)}
              className="flex items-center space-x-2 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
            >
              <PlusIcon className="w-5 h-5" />
              <span>Nova Publicação</span>
            </button>
          )}
        </div>

        {/* Stories/Destaques */}
        <div className="mb-8">
          <div className="flex space-x-4 overflow-x-auto pb-4">
            {news.filter(item => item.featured).slice(0, 5).map((item) => (
              <div key={`story-${item.id}`} className="flex-shrink-0">
                <div className="w-16 h-16 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 p-0.5">
                  <div className="w-full h-full rounded-full bg-white p-0.5">
                    <div className="w-full h-full rounded-full bg-blue-500 flex items-center justify-center">
                      <span className="text-white font-semibold text-sm">
                        {item.author.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-center mt-1 text-gray-600 truncate w-16">
                  {item.category}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Feed de Posts */}
        <div className="max-w-2xl mx-auto space-y-6">
          {news.map((item) => (
            <div key={item.id} className="bg-white rounded-lg shadow-sm border border-gray-200">
              {/* Header do Post */}
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-semibold text-sm">
                      {item.author.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{item.author}</p>
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-1 text-xs rounded-full ${getCategoryColor(item.category)}`}>
                        {item.category}
                      </span>
                      <span className="text-gray-500 text-sm">•</span>
                      <span className="text-gray-500 text-sm">{formatDate(item.date)}</span>
                    </div>
                  </div>
                </div>
                <button className="p-2 hover:bg-gray-100 rounded-full">
                  <EllipsisHorizontalIcon className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Imagem do Post */}
              {(item.coverImage || item.thumbnail) && (
                <div className="relative">
                  <img
                    src={item.coverImage || item.thumbnail}
                    alt={item.title}
                    className="w-full h-64 object-cover"
                  />
                  {item.featured && (
                    <div className="absolute top-4 left-4">
                      <span className="bg-yellow-500 text-white px-2 py-1 text-xs font-semibold rounded">
                        Destaque
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Ações do Post */}
              <div className="px-4 py-3">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-4">
                    <button
                      onClick={() => handleLike(item.id)}
                      className="flex items-center space-x-1 hover:text-red-500 transition-colors"
                    >
                      {likedPosts.has(item.id) ? (
                        <HeartSolidIcon className="w-6 h-6 text-red-500" />
                      ) : (
                        <HeartIcon className="w-6 h-6" />
                      )}
                    </button>
                    
                    <button
                      onClick={() => toggleComments(item.id)}
                      className="flex items-center space-x-1 hover:text-blue-500 transition-colors"
                    >
                      <ChatBubbleOvalLeftIcon className="w-6 h-6" />
                    </button>
                    
                    <button className="flex items-center space-x-1 hover:text-green-500 transition-colors">
                      <ShareIcon className="w-6 h-6" />
                    </button>
                  </div>
                  
                  <button
                    onClick={() => handleSave(item.id)}
                    className="hover:text-blue-500 transition-colors"
                  >
                    {savedPosts.has(item.id) ? (
                      <BookmarkSolidIcon className="w-6 h-6 text-blue-500" />
                    ) : (
                      <BookmarkIcon className="w-6 h-6" />
                    )}
                  </button>
                </div>

                {/* Contadores */}
                <div className="text-sm text-gray-600 mb-2">
                  {item.likes_count && item.likes_count > 0 && (
                    <span className="font-semibold">{item.likes_count} curtidas</span>
                  )}
                </div>

                {/* Conteúdo do Post */}
                <div className="mb-3">
                  <h3 className="font-semibold text-gray-900 mb-1">{item.title}</h3>
                  <p className="text-gray-700 text-sm">{item.description}</p>
                  {item.tags && item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {item.tags.map((tag, index) => (
                        <span key={index} className="text-blue-500 text-sm">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Comentários */}
                {showComments === item.id && (
                  <div className="border-t pt-3 mt-3">
                    {/* Lista de Comentários */}
                    <div className="space-y-3 mb-3">
                      {comments[item.id]?.map((comment) => (
                        <div key={comment.id} className="flex space-x-2">
                          <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                            <span className="text-gray-600 font-semibold text-xs">
                              {comment.user.first_name.charAt(0)}
                            </span>
                          </div>
                          <div className="flex-1">
                            <div className="bg-gray-100 rounded-lg px-3 py-2">
                              <p className="font-semibold text-sm text-gray-900">
                                {comment.user.first_name} {comment.user.last_name}
                              </p>
                              <p className="text-sm text-gray-700">{comment.content}</p>
                            </div>
                            <div className="flex items-center space-x-4 mt-1">
                              <span className="text-xs text-gray-500">
                                {formatDate(comment.created_at)}
                              </span>
                              <button className="text-xs text-gray-500 hover:text-gray-700">
                                Curtir
                              </button>
                              <button className="text-xs text-gray-500 hover:text-gray-700">
                                Responder
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Adicionar Comentário */}
                    {user && (
                      <div className="flex space-x-2">
                        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                          <span className="text-white font-semibold text-xs">
                            {user.first_name?.charAt(0) || user.email?.charAt(0)}
                          </span>
                        </div>
                        <div className="flex-1 flex space-x-2">
                          <input
                            type="text"
                            placeholder="Adicione um comentário..."
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                handleComment(item.id);
                              }
                            }}
                          />
                          <button
                            onClick={() => handleComment(item.id)}
                            disabled={!newComment.trim()}
                            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                          >
                            Enviar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {news.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-500 mb-4">
              <ChatBubbleOvalLeftIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma notícia encontrada</h3>
              <p>Aguarde novas publicações serem adicionadas.</p>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default NewsFeedPage;

