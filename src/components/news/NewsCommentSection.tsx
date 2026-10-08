"use client";

import React, { useEffect, useState } from 'react';
import { FiSend } from 'react-icons/fi';
import { useToast } from '@/hooks/useToast';
import { useI18n } from '@/contexts/I18nContext';
import CommentActions from './CommentActions';
import { useACLPermissions } from '@/hooks/useACLPermissions';
import { fetchWithToken } from '@/lib/tokenStorage';

interface UserInfo {
  id: string;
  first_name?: string;
  last_name?: string;
  avatar?: string;
  drive_photo_url?: string;
}

interface NewsComment {
  id: string;
  content: string;
  parent_id?: string | null;
  created_at: string;
  updated_at: string;
  edited?: boolean;
  user: UserInfo;
  replies?: NewsComment[];
}

interface Props {
  postId: string;
  userId: string;
}

const NewsCommentSection: React.FC<Props> = ({ postId, userId }) => {
  const { t } = useI18n();
  const { toast } = useToast();
  const { hasPermission } = useACLPermissions(userId);
  const [comments, setComments] = useState<NewsComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [newComment, setNewComment] = useState('');

  const loadComments = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/news/posts/${postId}/comments?limit=50`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('newsSystem.errorLoadingComments', 'Erro ao carregar comentários'));
      setComments(data.comments || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadComments();
  }, [postId]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = newComment.trim();
    if (!text) return;

    try {
      setSending(true);
      const res = await fetchWithToken(`/api/news/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('newsSystem.errorSendingComment', 'Erro ao enviar comentário'));
      setComments(prev => [...prev, data]);
      setNewComment('');
      toast.success(t('newsSystem.commentSent', 'Comentário enviado'));
    } catch (err) {
      console.error(err);
      toast.error(t('newsSystem.couldNotSendComment', 'Não foi possível enviar o comentário'));
    } finally {
      setSending(false);
    }
  };

  const formatTime = (d: string) => new Date(d).toLocaleString('pt-BR');

  // Autor OU moderadores (admins/gerentes via permissão comments.moderate)
  const canEditComment = (c: NewsComment) => {
    return c.user?.id === userId || hasPermission('comments.moderate' as any);
  };

  const canDeleteComment = (c: NewsComment) => {
    return c.user?.id === userId || hasPermission('comments.moderate' as any);
  };

  const handleEdit = async (commentId: string, newContent: string) => {
    const res = await fetchWithToken(`/api/news/posts/${postId}/comments/${commentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: newContent })
    });
    if (res.ok) {
      setComments(prev => prev.map(c => c.id === commentId ? { ...c, content: newContent, edited: true } : c));
    }
  };

  const handleDelete = async (commentId: string) => {
    const endpoint = `/api/news/posts/${postId}/comments/${commentId}`;
    const res = await fetchWithToken(endpoint, { method: 'DELETE' });
    if (res.ok) {
      setComments(prev => prev.filter(c => c.id !== commentId));
    }
  };

  return (
    <div className="border-t border-gray-100">
      <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
        {loading ? (
          <div className="text-sm text-gray-500">{t('newsSystem.loadingComments', 'Loading comments...')}</div>
        ) : comments.length === 0 ? (
          <div className="text-sm text-gray-500">{t('newsSystem.beFirstToComment', 'Be the first to comment')}</div>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="text-sm">
              <div className="flex space-x-3">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200">
                    {c.user?.avatar || c.user?.drive_photo_url ? (
                      <img
                        src={c.user.avatar || c.user.drive_photo_url}
                        alt={c.user.first_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-xs text-white uppercase">
                        {c.user?.first_name?.charAt(0) || '?'}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex-1 bg-gray-50 rounded-lg p-2">
                  <div className="font-medium text-gray-900 leading-tight mb-1">
                    {c.user?.first_name} {c.user?.last_name}
                  </div>
                  <div className="text-gray-700 leading-normal">{c.content}</div>
                  <div className="text-xs text-gray-500 mt-1">{formatTime(c.created_at)}</div>
                  <CommentActions
                    canEdit={canEditComment(c)}
                    canDelete={canDeleteComment(c)}
                    onEdit={(text) => handleEdit(c.id, text)}
                    onDelete={() => handleDelete(c.id)}
                    content={c.content}
                  />
                </div>
              </div>
              {c.replies && c.replies.length > 0 && (
                <div className="ml-4 mt-2 space-y-2">
                  {c.replies.map(r => (
                    <div key={r.id} className="flex space-x-3">
                      <div className="flex-shrink-0">
                        <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-200">
                          {r.user?.avatar || r.user?.drive_photo_url ? (
                            <img src={r.user.avatar || r.user.drive_photo_url} alt={r.user.first_name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-[10px] text-white uppercase">
                              {r.user?.first_name?.charAt(0) || '?'}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex-1 bg-gray-50 rounded-lg p-2">
                        <div className="font-medium text-gray-900 text-xs">
                          {r.user?.first_name} {r.user?.last_name}
                        </div>
                        <div className="text-gray-700 text-sm">{r.content}</div>
                        <div className="text-xs text-gray-500 mt-1">{formatTime(r.created_at)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <form onSubmit={onSubmit} className="p-3 border-t border-gray-100 flex items-center space-x-2">
        <input
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder={t('newsSystem.writeComment', 'Write a comment...')}
          className="flex-1 px-3 py-2 border rounded-full text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          maxLength={500}
        />
        <button
          type="submit"
          disabled={sending || !newComment.trim()}
          className="p-2 bg-blue-600 text-white rounded-full disabled:opacity-50"
        >
          <FiSend className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};

export default NewsCommentSection;

