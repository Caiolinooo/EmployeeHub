"use client";

import React, { useEffect, useState } from 'react';
import { FiSend } from 'react-icons/fi';
import { useToast } from '@/hooks/useToast';
import CommentActions from './CommentActions';
import { useACLPermissions } from '@/hooks/useACLPermissions';

interface UserInfo {
  id: string;
  first_name?: string;
  last_name?: string;
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
  const { hasPermission } = useACLPermissions(userId);


interface Props {
  postId: string;
  userId: string;
}

const NewsCommentSection: React.FC<Props> = ({ postId, userId }) => {
  const { toast } = useToast();
  const [comments, setComments] = useState<NewsComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [newComment, setNewComment] = useState('');

  const loadComments = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/news/${postId}/comments?limit=50`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao carregar comentários');
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
      const res = await fetch(`/api/news/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, content: text })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar comentário');
      setComments(prev => [...prev, data]);
      setNewComment('');
      toast.success('Comentário enviado');
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível enviar o comentário');
    } finally {
      setSending(false);
    }
  };

  const formatTime = (d: string) => new Date(d).toLocaleString('pt-BR');

  // Autor OU moderadores (admins/gerentes via permissão comments.moderate)
  const canEditComment = (c: NewsComment) => c.user?.id === userId || hasPermission('comments.moderate');
  const canDeleteComment = (c: NewsComment) => c.user?.id === userId || hasPermission('comments.moderate');

  const handleEdit = async (commentId: string, newContent: string) => {
    const res = await fetch(`/api/news/${postId}/comments/${commentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: newContent })
    });
    if (res.ok) {
      setComments(prev => prev.map(c => c.id === commentId ? { ...c, content: newContent, edited: true } : c));
    }
  };

  const handleDelete = async (commentId: string) => {
    const endpoint = canDeleteComment({ id: commentId } as any) && hasPermission('comments.moderate')
      ? `/api/news/${postId}/comments/${commentId}/moderate`
      : `/api/news/${postId}/comments/${commentId}`;
    const res = await fetch(endpoint, { method: 'DELETE' });
    if (res.ok) {
      setComments(prev => prev.filter(c => c.id !== commentId));
    }
  };

  return (
    <div className="border-t border-gray-100">
      <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
        {loading ? (
          <div className="text-sm text-gray-500">Carregando comentários...</div>
        ) : comments.length === 0 ? (
          <div className="text-sm text-gray-500">Seja o primeiro a comentar</div>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="text-sm">
              <div className="bg-gray-50 rounded-lg p-2">
                <div className="font-medium text-gray-900">
                  {c.user?.first_name} {c.user?.last_name}
                </div>
                <div className="text-gray-700">{c.content}</div>
                <div className="text-xs text-gray-500 mt-1">{formatTime(c.created_at)}</div>
                <CommentActions
                  canEdit={canEditComment(c)}
                  canDelete={canDeleteComment(c)}
                  onEdit={(text) => handleEdit(c.id, text)}
                  onDelete={() => handleDelete(c.id)}
                  content={c.content}
                />
              </div>
              {c.replies && c.replies.length > 0 && (
                <div className="ml-4 mt-2 space-y-2">
                  {c.replies.map(r => (
                    <div key={r.id} className="bg-gray-50 rounded-lg p-2">
                      <div className="font-medium text-gray-900">
                        {r.user?.first_name} {r.user?.last_name}
                      </div>
                      <div className="text-gray-700">{r.content}</div>
                      <div className="text-xs text-gray-500 mt-1">{formatTime(r.created_at)}</div>
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
          placeholder="Escreva um comentário..."
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

