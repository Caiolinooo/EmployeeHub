import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface LikeChangePayload { count?: number; delta?: number }
interface CommentChangePayload { count?: number; delta?: number }

interface Handlers {
  onLikesChange?: (postId: string, payload: LikeChangePayload) => void;
  onCommentsChange?: (postId: string, payload: CommentChangePayload) => void;
  onPostUpdate?: (postId: string, partial: { likes_count?: number; comments_count?: number; views_count?: number }) => void;
}

/**
 * Realtime para posts de notícias via Supabase Realtime com fallback para polling leve.
 * Não instala dependências e falha de forma silenciosa caso Realtime não esteja habilitado.
 */
export function useNewsRealtime(postIds: string[], handlers: Handlers = {}) {
  const idsKey = postIds.filter(Boolean).join(',');
  const [connected, setConnected] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pollingRef = useRef<number | null>(null);

  useEffect(() => {
    // Limpar assinaturas anteriores
    if (channelRef.current) {
      channelRef.current.unsubscribe();
      channelRef.current = null;
    }
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    if (!postIds || postIds.length === 0) return;

    try {
      const filter = `id=in.(${postIds.join(',')})`;
      const likeFilter = `post_id=in.(${postIds.join(',')})`;

      const channel = supabase.channel(`news-realtime-${idsKey}`);

      // Atualizações diretas do post (likes_count, comments_count, views_count)
      channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'news_posts', filter }, (payload: any) => {
        const np = payload?.new || {};
        handlers.onPostUpdate?.(np.id, {
          likes_count: np.likes_count,
          comments_count: np.comments_count,
          views_count: np.views_count,
        });
      });

      // Likes INSERT/DELETE
      channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'news_post_likes', filter: likeFilter }, (payload: any) => {
        const postId = payload?.new?.post_id;
        if (postId) handlers.onLikesChange?.(postId, { delta: 1 });
      });
      channel.on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'news_post_likes', filter: likeFilter }, (payload: any) => {
        const postId = payload?.old?.post_id;
        if (postId) handlers.onLikesChange?.(postId, { delta: -1 });
      });

      // Comentários INSERT (apenas principais incrementam contador)
      channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'news_post_comments', filter: likeFilter }, (payload: any) => {
        const postId = payload?.new?.post_id;
        const isReply = !!payload?.new?.parent_id;
        if (postId && !isReply) handlers.onCommentsChange?.(postId, { delta: 1 });
      });
      channel.on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'news_post_comments', filter: likeFilter }, (payload: any) => {
        const postId = payload?.old?.post_id;
        const isReply = !!payload?.old?.parent_id;
        if (postId && !isReply) handlers.onCommentsChange?.(postId, { delta: -1 });
      });

      channel.subscribe((status) => {
        setConnected(status === 'SUBSCRIBED');
      });

      channelRef.current = channel;
    } catch (err) {
      console.warn('Realtime indisponível, ativando polling leve...', err);
    }

    // Fallback: polling a cada 15s apenas dos contadores
    pollingRef.current = window.setInterval(async () => {
      try {
        await Promise.all(
          postIds.map(async (id) => {
            const res = await fetch(`/api/news/posts/${id}`);
            if (res.ok) {
              const data = await res.json();
              handlers.onPostUpdate?.(id, {
                likes_count: data.likes_count,
                comments_count: data.comments_count,
                views_count: data.views_count,
              });
            }
          })
        );
      } catch (e) {
        // silencioso
      }
    }, 15000);

    return () => {
      if (channelRef.current) channelRef.current.unsubscribe();
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  return { connected };
}

export default useNewsRealtime;

