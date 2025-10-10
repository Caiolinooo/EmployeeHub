'use client';

import React, { useState, useEffect } from 'react';
import { 
  ChatBubbleLeftIcon,
  PaperAirplaneIcon,
  EllipsisVerticalIcon,
  PencilIcon,
  TrashIcon,
  FlagIcon,
  UserCircleIcon
} from '@heroicons/react/24/outline';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { canModerateContent } from '@/lib/permissions';
import { useI18n } from '@/contexts/I18nContext';

interface User {
  id: string;
  first_name: string;
  last_name: string;
  profile_data?: any;
}

interface Comment {
  id: string;
  course_id: string;
  user_id: string;
  content: string;
  parent_id?: string;
  is_active: boolean;
  is_edited: boolean;
  created_at: string;
  updated_at: string;
  user: User;
  replies?: Comment[];
}

interface CommentsProps {
  courseId: string;
  className?: string;
}

const Comments: React.FC<CommentsProps> = ({ courseId, className = '' }) => {
  const { user, getToken } = useSupabaseAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [showDropdown, setShowDropdown] = useState<string | null>(null);

  useEffect(() => {
    loadComments();
  }, [courseId]);

  const loadComments = async () => {
    try {
      const response = await fetch(`/api/academy/comments?course_id=${courseId}`);
      const data = await response.json();

      if (data.success) {
        setComments(data.comments);
      } else {
        console.error(t('components.erroAoCarregarComentarios'), data.error);
      }
    } catch (error) {
      console.error(t('components.erroAoCarregarComentarios'), error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !newComment.trim()) return;

    setSubmitting(true);
    try {
      const token = await getToken();
      if (!token) return;

      const response = await fetch('/api/academy/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          course_id: courseId,
          content: newComment.trim()
        })
      });

      const data = await response.json();

      if (data.success) {
        setNewComment('');
        await loadComments();
      } else {
        alert(data.error || 'Erro ao enviar comentário');
      }
    } catch (error) {
      console.error(t('components.erroAoEnviarComentario'), error);
      alert('Erro ao enviar comentário');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitReply = async (parentId: string) => {
    if (!user || !replyContent.trim()) return;

    setSubmitting(true);
    try {
      const token = await getToken();
      if (!token) return;

      const response = await fetch('/api/academy/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          course_id: courseId,
          content: replyContent.trim(),
          parent_id: parentId
        })
      });

      const data = await response.json();

      if (data.success) {
        setReplyContent('');
        setReplyingTo(null);
        await loadComments();
      } else {
        alert(data.error || 'Erro ao enviar resposta');
      }
    } catch (error) {
      console.error('Erro ao enviar resposta:', error);
      alert('Erro ao enviar resposta');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditComment = async (commentId: string) => {
    if (!user || !editContent.trim()) return;

    setSubmitting(true);
    try {
      const token = await getToken();
      if (!token) return;

      const response = await fetch('/api/academy/comments', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          comment_id: commentId,
          content: editContent.trim()
        })
      });

      const data = await response.json();

      if (data.success) {
        setEditContent('');
        setEditingComment(null);
        await loadComments();
      } else {
        alert(data.error || 'Erro ao editar comentário');
      }
    } catch (error) {
      console.error(t('components.erroAoEditarComentario'), error);
      alert('Erro ao editar comentário');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm(t('components.temCertezaQueDesejaExcluirEsteComentario'))) return;

    try {
      const token = await getToken();
      if (!token) return;

      const response = await fetch(`/api/academy/comments?comment_id=${commentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.success) {
        await loadComments();
      } else {
        alert(data.error || 'Erro ao excluir comentário');
      }
    } catch (error) {
      console.error(t('components.erroAoExcluirComentario'), error);
      alert('Erro ao excluir comentário');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return 'Hoje';
    if (diffDays === 2) return 'Ontem';
    if (diffDays <= 7) return t('components.diffdaysDiasAtras');
    
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getUserAvatar = (user: User) => {
    if (user.profile_data?.avatar_url) {
      return user.profile_data.avatar_url;
    }
    return null;
  };

  const canEditComment = (comment: Comment) => {
    return user && comment.user_id === user.id;
  };

  const canDeleteComment = (comment: Comment) => {
    return user && (comment.user_id === user.id || canModerateContent(user, 'comment'));
  };

  const renderComment = (comment: Comment, isReply = false) => (
    <div key={comment.id} className={`${isReply ? 'ml-12' : ''} mb-4`}>
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3 flex-1">
            <div className="flex-shrink-0">
              {getUserAvatar(comment.user) ? (
                <img
                  src={getUserAvatar(comment.user)}
                  alt={`${comment.user.first_name} ${comment.user.last_name}`}
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <UserCircleIcon className="w-8 h-8 text-gray-400" />
              )}
            </div>
            
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-1">
                <span className="font-medium text-gray-900">
                  {comment.user.first_name} {comment.user.last_name}
                </span>
                <span className="text-sm text-gray-500">{formatDate(comment.created_at)}</span>
                {comment.is_edited && (
                  <span className="text-xs text-gray-400">(editado)</span>
                )}
              </div>
              
              {editingComment === comment.id ? (
                <div className="mt-2">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                    maxLength={1000}
                    placeholder={t('components.editeSeuComentario')}
                  />
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-gray-500">
                      {editContent.length}/1000 caracteres
                    </span>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => {
                          setEditingComment(null);
                          setEditContent('');
                        }}
                        className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => handleEditComment(comment.id)}
                        disabled={submitting || !editContent.trim()}
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                      >
                        {submitting ? 'Salvando...' : 'Salvar'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-gray-700 whitespace-pre-wrap">{comment.content}</p>
                  
                  {!isReply && (
                    <div className="flex items-center space-x-4 mt-2">
                      <button
                        onClick={() => setReplyingTo(comment.id)}
                        className="text-sm text-blue-600 hover:text-blue-700 flex items-center"
                      >
                        <ChatBubbleLeftIcon className="w-4 h-4 mr-1" />
                        Responder
                      </button>
                      
                      {comment.replies && comment.replies.length > 0 && (
                        <span className="text-sm text-gray-500">
                          {comment.replies.length} resposta{comment.replies.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          
          {/* Menu de ações */}
          {user && (canEditComment(comment) || canDeleteComment(comment)) && (
            <div className="relative">
              <button
                onClick={() => setShowDropdown(showDropdown === comment.id ? null : comment.id)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <EllipsisVerticalIcon className="w-5 h-5" />
              </button>
              
              {showDropdown === comment.id && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-10">
                  <div className="py-1">
                    {canEditComment(comment) && (
                      <button
                        onClick={() => {
                          setEditingComment(comment.id);
                          setEditContent(comment.content);
                          setShowDropdown(null);
                        }}
                        className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        <PencilIcon className="w-4 h-4 mr-2" />
                        Editar
                      </button>
                    )}
                    
                    {canDeleteComment(comment) && (
                      <button
                        onClick={() => {
                          handleDeleteComment(comment.id);
                          setShowDropdown(null);
                        }}
                        className="flex items-center w-full px-4 py-2 text-sm text-red-700 hover:bg-red-50"
                      >
                        <TrashIcon className="w-4 h-4 mr-2" />
                        Excluir
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Formulário de resposta */}
      {replyingTo === comment.id && (
        <div className="ml-12 mt-3">
          <div className="bg-gray-50 rounded-lg p-3">
            <textarea
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
              maxLength={1000}
              placeholder="Escreva sua resposta..."
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-gray-500">
                {replyContent.length}/1000 caracteres
              </span>
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    setReplyingTo(null);
                    setReplyContent('');
                  }}
                  className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleSubmitReply(comment.id)}
                  disabled={submitting || !replyContent.trim()}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center"
                >
                  {submitting ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-1"></div>
                  ) : (
                    <PaperAirplaneIcon className="w-4 h-4 mr-1" />
                  )}
                  {submitting ? 'Enviando...' : 'Responder'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Respostas */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-3">
          {comment.replies.map(reply => renderComment(reply, true))}
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className={`${className}`}>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${className}`}>
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <ChatBubbleLeftIcon className="w-5 h-5 mr-2" />
          Comentários ({comments.length})
        </h3>
        
        {/* Formulário de novo comentário */}
        {user ? (
          <form onSubmit={handleSubmitComment} className="mb-6">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={4}
                maxLength={1000}
                placeholder={t('components.compartilheSuaOpiniaoSobreEsteCurso')}
              />
              <div className="flex items-center justify-between mt-3">
                <span className="text-sm text-gray-500">
                  {newComment.length}/1000 caracteres
                </span>
                <button
                  type="submit"
                  disabled={submitting || !newComment.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
                >
                  {submitting ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  ) : (
                    <PaperAirplaneIcon className="w-4 h-4 mr-2" />
                  )}
                  {submitting ? 'Enviando...' : 'Comentar'}
                </button>
              </div>
            </div>
          </form>
        ) : (
          <div className="bg-gray-50 rounded-lg p-4 mb-6 text-center">
            <p className="text-gray-600">Faça login para comentar neste curso.</p>
          </div>
        )}
        
        {/* Lista de comentários */}
        {comments.length === 0 ? (
          <div className="text-center py-8">
            <ChatBubbleLeftIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhum comentário ainda</h3>
            <p className="mt-1 text-sm text-gray-500">
              Seja o primeiro a comentar sobre este curso.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {comments.map(comment => renderComment(comment))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Comments;
