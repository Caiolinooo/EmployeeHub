'use client';

import React, { useState, useEffect, useCallback } from 'react';
import DOMPurify from 'dompurify';
import {
  HeartIcon,
  ChatBubbleOvalLeftIcon,
  ShareIcon,
  EllipsisHorizontalIcon,
  PlusIcon
} from '@heroicons/react/24/outline';
import {
  HeartIcon as HeartSolidIcon
} from '@heroicons/react/24/solid';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import PostCreator from './PostCreator';
import CommentSection from './CommentSection';

interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  profile_photo_url?: string;
}

interface Post {
  id: string;
  content: string;
  image_url?: string;
  image_urls?: string[];
  hashtags?: string[];
  mentions?: string[];
  created_at: string;
  updated_at: string;
  user: User;
  likes_count: number;
  comments_count: number;
  user_liked: boolean;
}

interface SocialFeedProps {
  className?: string;
}

// Note: SocialFeed is disabled per client request and kept for reference only.
const SocialFeed: React.FC<SocialFeedProps> = ({ className = '' }) => {
  const { user, getToken } = useSupabaseAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [showPostCreator, setShowPostCreator] = useState(false);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());

  const loadPosts = useCallback(async (offset = 0, append = false) => {
    try {
      if (offset === 0) setLoading(true);
      else setLoadingMore(true);

      const token = await getToken();
      if (!token) return;

      const response = await fetch(`/api/social/posts?limit=10&offset=${offset}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (append) {
          setPosts(prev => [...prev, ...data.posts]);
        } else {
          setPosts(data.posts);
        }
        setHasMore(data.pagination.hasMore);
        setError(null);
      } else {
        setError('Erro ao carregar posts');
      }
    } catch (err) {
      console.error('Erro ao carregar posts:', err);
      setError('Erro ao carregar posts');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [getToken]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const handleLike = async (postId: string) => {
    try {
      const token = await getToken();
      if (!token) return;

      const response = await fetch('/api/social/likes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ post_id: postId })
      });

      if (response.ok) {
        const data = await response.json();
        setPosts(prev => prev.map(post => 
          post.id === postId 
            ? { 
                ...post, 
                user_liked: data.liked, 
                likes_count: data.likes_count 
              }
            : post
        ));
      }
    } catch (err) {
      console.error('Erro ao curtir post:', err);
    }
  };

  const handlePostCreated = (newPost: Post) => {
    setPosts(prev => [newPost, ...prev]);
    setShowPostCreator(false);
  };

  const toggleComments = (postId: string) => {
    setExpandedComments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(postId)) {
        newSet.delete(postId);
      } else {
        newSet.add(postId);
      }
      return newSet;
    });
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'agora';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d`;
    
    return date.toLocaleDateString('pt-BR', { 
      day: '2-digit', 
      month: 'short' 
    });
  };

  const renderHashtags = (content: string, hashtags?: string[]) => {
    if (!hashtags || hashtags.length === 0) return content;

    let processedContent = content;
    hashtags.forEach(tag => {
      const regex = new RegExp(`#${tag}`, 'gi');
      processedContent = processedContent.replace(
        regex,
        `<span class="text-blue-600 font-medium cursor-pointer hover:underline">#${tag}</span>`
      );
    });

    // Sanitizar o HTML para prevenir XSS
    const sanitizedContent = DOMPurify.sanitize(processedContent, {
      ALLOWED_TAGS: ['span'],
      ALLOWED_ATTR: ['class']
    });

    return <div dangerouslySetInnerHTML={{ __html: sanitizedContent }} />;
  };

  if (loading) {
    return (
      <div className={`space-y-6 ${className}`}>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow-sm border p-6 animate-pulse">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-gray-300 rounded-full"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-300 rounded w-1/4 mb-2"></div>
                <div className="h-3 bg-gray-300 rounded w-1/6"></div>
              </div>
            </div>
            <div className="space-y-2 mb-4">
              <div className="h-4 bg-gray-300 rounded"></div>
              <div className="h-4 bg-gray-300 rounded w-3/4"></div>
            </div>
            <div className="flex items-center space-x-6">
              <div className="h-8 bg-gray-300 rounded w-16"></div>
              <div className="h-8 bg-gray-300 rounded w-16"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => loadPosts()}
            className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Botão para criar post */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <button
          onClick={() => setShowPostCreator(true)}
          className="w-full flex items-center space-x-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
            <span className="text-white font-medium">
              {user?.first_name?.charAt(0) || 'U'}
            </span>
          </div>
          <span className="text-gray-500 flex-1 text-left">
            No que você está pensando, {user?.first_name}?
          </span>
          <PlusIcon className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {/* Modal de criação de post */}
      {showPostCreator && (
        <PostCreator
          onClose={() => setShowPostCreator(false)}
          onPostCreated={handlePostCreated}
        />
      )}

      {/* Feed de posts */}
      {posts.map((post) => (
        <div key={post.id} className="bg-white rounded-lg shadow-sm border">
          {/* Header do post */}
          <div className="p-6 pb-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                  {post.user.profile_photo_url ? (
                    <img
                      src={post.user.profile_photo_url}
                      alt={`${post.user.first_name} ${post.user.last_name}`}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-white font-medium">
                      {post.user.first_name.charAt(0)}
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">
                    {post.user.first_name} {post.user.last_name}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {formatTimeAgo(post.created_at)}
                  </p>
                </div>
              </div>
              <button className="text-gray-400 hover:text-gray-600">
                <EllipsisHorizontalIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Conteúdo do post */}
            <div className="mb-4">
              <div className="text-gray-900 whitespace-pre-wrap">
                {renderHashtags(post.content, post.hashtags)}
              </div>
            </div>

            {/* Imagem do post */}
            {post.image_url && (
              <div className="mb-4">
                <img
                  src={post.image_url}
                  alt="Post image"
                  className="w-full rounded-lg object-cover max-h-96"
                />
              </div>
            )}
          </div>

          {/* Ações do post */}
          <div className="px-6 py-3 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-6">
                <button
                  onClick={() => handleLike(post.id)}
                  className={`flex items-center space-x-2 transition-colors ${
                    post.user_liked 
                      ? 'text-red-600' 
                      : 'text-gray-500 hover:text-red-600'
                  }`}
                >
                  {post.user_liked ? (
                    <HeartSolidIcon className="w-5 h-5" />
                  ) : (
                    <HeartIcon className="w-5 h-5" />
                  )}
                  <span className="text-sm font-medium">{post.likes_count}</span>
                </button>

                <button
                  onClick={() => toggleComments(post.id)}
                  className="flex items-center space-x-2 text-gray-500 hover:text-blue-600 transition-colors"
                >
                  <ChatBubbleOvalLeftIcon className="w-5 h-5" />
                  <span className="text-sm font-medium">{post.comments_count}</span>
                </button>

                <button className="flex items-center space-x-2 text-gray-500 hover:text-green-600 transition-colors">
                  <ShareIcon className="w-5 h-5" />
                  <span className="text-sm font-medium">Compartilhar</span>
                </button>
              </div>
            </div>
          </div>

          {/* Seção de comentários */}
          {expandedComments.has(post.id) && (
            <CommentSection
              postId={post.id}
              onCommentAdded={() => {
                // Atualizar contador de comentários
                setPosts(prev => prev.map(p => 
                  p.id === post.id 
                    ? { ...p, comments_count: p.comments_count + 1 }
                    : p
                ));
              }}
            />
          )}
        </div>
      ))}

      {/* Botão carregar mais */}
      {hasMore && (
        <div className="text-center py-4">
          <button
            onClick={() => loadPosts(posts.length, true)}
            disabled={loadingMore}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loadingMore ? 'Carregando...' : 'Carregar mais'}
          </button>
        </div>
      )}

      {!hasMore && posts.length > 0 && (
        <div className="text-center py-4 text-gray-500">
          Você chegou ao fim do feed!
        </div>
      )}
    </div>
  );
};

export default SocialFeed;
