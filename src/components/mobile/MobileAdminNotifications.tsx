'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { getToken } from '@/lib/tokenStorage';
import DataCard from './DataCard';
import MobileShell from './MobileShell';
import TouchButton from './TouchButton';

type NotificationItem = {
  id: string;
  type?: string | null;
  title: string;
  message?: string | null;
  priority?: string | null;
  read_at?: string | null;
  created_at?: string | null;
};

const TYPE_LABEL: Record<string, string> = {
  broadcast: 'Aviso geral',
  news: 'Notícia',
  news_post: 'Notícia',
  purchase_order: 'Compras',
  leave: 'Férias',
  reimbursement: 'Reembolso',
  system: 'Sistema',
  mention: 'Menção',
  comment: 'Comentário',
};

function typeLabel(type?: string | null): string {
  if (!type) return 'Sistema';
  return TYPE_LABEL[type] || type;
}

function formatDate(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('pt-BR');
}

function truncate(text?: string | null, max = 90): string {
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

export default function MobileAdminNotifications() {
  const { user, isAuthenticated, isLoading: authLoading } = useSupabaseAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (targetPage: number) => {
      if (!user?.id) return;
      setLoading(true);
      setError(null);
      try {
        const token = getToken();
        const res = await fetch(
          `/api/notifications?user_id=${user.id}&page=${targetPage}&limit=20`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const list: NotificationItem[] = Array.isArray(data)
          ? data
          : data.notifications || [];
        setItems((prev) => (targetPage === 1 ? list : [...prev, ...list]));
        setHasNext(Boolean(data.pagination?.hasNext));
        setUnreadCount(Number(data.unreadCount) || 0);
        setPage(targetPage);
      } catch {
        setError('Não foi possível carregar as notificações.');
      } finally {
        setLoading(false);
      }
    },
    [user?.id],
  );

  useEffect(() => {
    if (isAuthenticated) load(1);
    else if (!authLoading) setLoading(false);
  }, [isAuthenticated, authLoading, load]);

  return (
    <MobileShell title="Notificações">
      <div className="flex flex-col gap-3" data-abz-mobile-admin-notifications="">
        {!isAuthenticated && !authLoading ? (
          <p className="py-8 text-center text-sm text-gray-500">
            Entre para ver o histórico de notificações.
          </p>
        ) : (
          <>
            <p className="text-xs text-gray-500">
              {unreadCount > 0
                ? `${unreadCount} não lida${unreadCount > 1 ? 's' : ''}. `
                : ''}
              Criação e envio de avisos continuam no painel desktop.
            </p>

            {error ? (
              <div className="abz-m-alert-error rounded-xl p-3 text-sm" role="alert">
                {error}
                <TouchButton variant="ghost" className="mt-1" onClick={() => load(1)}>
                  Tentar de novo
                </TouchButton>
              </div>
            ) : null}

            {items.map((n) => (
              <DataCard
                key={n.id}
                title={n.title}
                subtitle={truncate(n.message) || undefined}
                meta={formatDate(n.created_at)}
              >
                <span
                  className={`mt-2 block text-xs font-semibold ${
                    n.read_at ? 'text-gray-500' : 'text-[#005B96]'
                  }`}
                >
                  {typeLabel(n.type)} · {n.read_at ? 'Lida' : 'Não lida'}
                </span>
              </DataCard>
            ))}

            {loading ? (
              <p className="py-4 text-center text-sm text-gray-400">Carregando…</p>
            ) : null}
            {!loading && items.length === 0 && !error ? (
              <p className="py-8 text-center text-sm text-gray-500">
                Nenhuma notificação encontrada.
              </p>
            ) : null}

            {hasNext && !loading ? (
              <TouchButton
                variant="ghost"
                className="w-full justify-center"
                onClick={() => load(page + 1)}
              >
                Carregar mais
              </TouchButton>
            ) : null}
          </>
        )}
      </div>
    </MobileShell>
  );
}
