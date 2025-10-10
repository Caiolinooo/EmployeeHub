'use client';

import React, { useState, useEffect } from 'react';
import { 
  PaperAirplaneIcon,
  EllipsisHorizontalIcon
} from '@heroicons/react/24/outline';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useI18n } from '@/contexts/I18nContext';

interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  profile_photo_url?: string;
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  updated_at: string;
  is_edited: boolean;
  user: User;
  replies?: Comment[];
}

interface CommentSectionProps {
  postId: string;
  onCommentAdded?: () => void;
}

const CommentSection: React.FC<CommentSectionProps> = ({ postId, onCommentAdded }) => {
  const { user, getToken } = useSupabaseAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadComments = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      if (!token) return;

      const response = await fetch(`/api/social/comments?post_id=${postId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setComments(data.comments);
        setError(null);
      } else {
        setError(t('components.erroAoCarregarComentarios'));
      }
    } catch (err) {
      console.error(t('components.erroAoCarregarComentarios'), err);
      setError(t('components.erroAoCarregarComentarios'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadComments();
  }, [postId]);

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newComment.trim()) return;

    setSubmitting(true);
    try {
      const token = await getToken();
      if (!token) return;

      const response = await fetch('/api/social/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          post_id: postId,
          content: newComment.trim()
        })
      });

      if (response.ok) {
        const data = await response.json();
        setComments(prev => [...prev, data.comment]);
        setNewComment('');
        onCommentAdded?.();
      } else {
        setError(t('components.erroAoEnviarComentario'));
      }
    } catch (err) {
      console.error(t('components.erroAoEnviarComentario'), err);
      setError(t('components.erroAoEnviarComentario'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitReply = async (e: React.FormEvent, parentId: string) => {
    e.preventDefault();
    
    if (!replyContent.trim()) return;

    setSubmitting(true);
    try {
      const token = await getToken();
      if (!token) return;

      const response = await fetch('/api/social/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          post_id: postId,
          content: replyContent.trim(),
          parent_id: parentId
        })
      });

      if (response.ok) {
        const data = await response.json();
        // Adicionar resposta ao comentário pai
        setComments(prev => prev.map(comment => 
          comment.id === parentId 
            ? { 
                ...comment, 
                replies: [...(comment.replies || []), data.comment] 
              }
            : comment
        ));
        setReplyContent('');
        setReplyingTo(null);
        onCommentAdded?.();
      } else {
        setError('Erro ao enviar resposta');
      }
    } catch (err) {
      console.error('Erro ao enviar resposta:', err);
      setError('Erro ao enviar resposta');
    } finally {
      setSubmitting(false);
    }
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

  if (loading) {
    return (
      <div className="border-t border-gray-100 p-4">
        <div className="animate-pulse space-y-3">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="flex space-x-3">
              <div className="w-8 h-8 bg-gray-300 rounded-full"></div>
              <div className="flex-1">
                <div className="h-3 bg-gray-300 rounded w-1/4 mb-2"></div>
                <div className="h-4 bg-gray-300 rounded w-3/4"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-gray-100">
      {/* Lista de comentários */}
      <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
        {comments.map((comment) => (
          <div key={comment.id} className="space-y-2">
            {/* Comentário principal */}
            <div className="flex space-x-3">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                {comment.user.profile_photo_url ? (
                  <img
                    src={comment.user.profile_photo_url}
                    alt={`${comment.user.first_name} ${comment.user.last_name}`}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <span className="text-white text-sm font-medium">
                    {comment.user.first_name.charAt(0)}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-sm font-medium text-gray-900">
                      {comment.user.first_name} {comment.user.last_name}
                    </h4>
                    <button className="text-gray-400 hover:text-gray-600">
                      <EllipsisHorizontalIcon className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-sm text-gray-700">{comment.content}</p>
                  {comment.is_edited && (
                    <span className="text-xs text-gray-500 italic">editado</span>
                  )}
                </div>
                <div className="flex items-center space-x-4 mt-2">
                  <span className="text-xs text-gray-500">
                    {formatTimeAgo(comment.created_at)}
                  </span>
                  <button
                    onClick={() => setReplyingTo(comment.id)}
                    className="text-xs text-gray-500 hover:text-blue-600 font-medium"
                  >
                    Responder
                  </button>
                </div>

                {/* Formulário de resposta */}
                {replyingTo === comment.id && (
                  <form 
                    onSubmit={(e) => handleSubmitReply(e, comment.id)}
                    className="mt-3 flex space-x-2"
                  >
                    <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs font-medium">
                        {user?.first_name?.charAt(0) || 'U'}
                      </span>
                    </div>
                    <div className="flex-1 flex space-x-2">
                      <input
                        type="text"
                        value={replyContent}
                        onChange={(e) => setReplyContent(e.target.value)}
                        placeholder={`Responder para ${comment.user.first_name}...`}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-full text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        maxLength={500}
                      />
                      <button
                        type="submit"
                        disabled={submitting || !replyContent.trim()}
                        className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <PaperAirplaneIcon className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setReplyingTo(null);
                          setReplyContent('');
                        }}
                        className="px-3 py-2 text-gray-500 hover:text-gray-700 text-sm"
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                )}

                {/* Respostas */}
                {comment.replies && comment.replies.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {comment.replies.map((reply) => (
                      <div key={reply.id} className="flex space-x-2">
                        <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-xs font-medium">
                            {reply.user.first_name.charAt(0)}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="bg-gray-50 rounded-lg p-2">
                            <h5 className="text-xs font-medium text-gray-900 mb-1">
                              {reply.user.first_name} {reply.user.last_name}
                            </h5>
                            <p className="text-xs text-gray-700">{reply.content}</p>
                          </div>
                          <span className="text-xs text-gray-500 mt-1">
                            {formatTimeAgo(reply.created_at)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {comments.length === 0 && (
          <div className="text-center py-4 text-gray-500">
            Seja o primeiro a comentar!
          </div>
        )}
      </div>

      {/* Formulário de novo comentário */}
      <div className="border-t border-gray-100 p-4">
        <form onSubmit={handleSubmitComment} className="flex space-x-3">
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-white text-sm font-medium">
              {user?.first_name?.charAt(0) || 'U'}
            </span>
          </div>
          <div className="flex-1 flex space-x-2">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder={t('components.escrevaUmComentario')}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              maxLength={500}
            />
            <button
              type="submit"
              disabled={submitting || !newComment.trim()}
              className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <PaperAirplaneIcon className="w-5 h-5" />
            </button>
          </div>
        </form>

        {error && (
          <div className="mt-2 text-sm text-red-600">
            {error}
          </div>
        )}
      </div>
    </div>
  );
};

export default CommentSection;
