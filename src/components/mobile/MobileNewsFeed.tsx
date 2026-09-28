'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DataCard from './DataCard';
import MobileShell from './MobileShell';
import TouchButton from './TouchButton';

type NewsPost = {
  id: string;
  title: string;
  excerpt?: string | null;
  content?: string | null;
  published_at?: string | null;
  created_at?: string | null;
  category?: { name?: string; color?: string | null } | null;
  author?: { first_name?: string; last_name?: string } | null;
};

function formatDate(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR');
}

function authorName(post: NewsPost): string {
  const a = post.author;
  if (!a) return '';
  return [a.first_name, a.last_name].filter(Boolean).join(' ');
}

export default function MobileNewsFeed() {
  const router = useRouter();
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (pageToLoad: number, append: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/news/posts?page=${pageToLoad}&limit=10`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const list: NewsPost[] = Array.isArray(data) ? data : data.posts || data.data || [];
      setPosts((prev) => (append ? [...prev, ...list] : list));
      const total = data?.pagination?.total ?? data?.total;
      setHasMore(
        typeof total === 'number' ? pageToLoad * 10 < total : list.length === 10,
      );
      setPage(pageToLoad);
    } catch {
      setError('Não foi possível carregar as notícias.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(1, false);
  }, [load]);

  return (
    <MobileShell title="Notícias">
      <div className="flex flex-col gap-3" data-abz-mobile-news="">
        {error ? (
          <div className="abz-m-alert-error rounded-xl p-3 text-sm" role="alert">
            {error}
            <TouchButton variant="ghost" className="mt-1" onClick={() => load(1, false)}>
              Tentar de novo
            </TouchButton>
          </div>
        ) : null}

        {posts.map((post) => (
          <DataCard
            key={post.id}
            title={post.title}
            subtitle={post.excerpt || undefined}
            meta={formatDate(post.published_at || post.created_at)}
            onClick={() => router.push(`/news/post/${post.id}`)}
          >
            <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
              {post.category?.name ? (
                <span
                  className="abz-m-chip rounded-full px-2 py-0.5 font-medium"
                  style={post.category.color ? { color: post.category.color } : undefined}
                >
                  {post.category.name}
                </span>
              ) : null}
              {authorName(post) ? <span>{authorName(post)}</span> : null}
            </div>
          </DataCard>
        ))}

        {!loading && posts.length === 0 && !error ? (
          <p className="py-8 text-center text-sm text-gray-500">Nenhuma notícia publicada.</p>
        ) : null}

        {loading ? (
          <p className="py-4 text-center text-sm text-gray-400">Carregando…</p>
        ) : null}

        {hasMore && !loading ? (
          <TouchButton variant="ghost" onClick={() => load(page + 1, true)}>
            Carregar mais
          </TouchButton>
        ) : null}
      </div>
    </MobileShell>
  );
}
