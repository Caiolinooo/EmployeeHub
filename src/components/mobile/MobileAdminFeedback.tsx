'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { getToken } from '@/lib/tokenStorage';
import DataCard from './DataCard';
import MobileShell from './MobileShell';
import TouchButton from './TouchButton';

type FeedbackItem = {
  id: string;
  user_id?: string | null;
  type: 'doubt' | 'bug' | 'suggestion' | 'other';
  message: string;
  status: 'open' | 'in_progress' | 'resolved' | 'dismissed';
  created_at: string;
  user_name?: string;
  user_email?: string;
};

const TYPE_LABEL: Record<string, string> = {
  doubt: 'Dúvida',
  bug: 'Erro/Bug',
  suggestion: 'Sugestão',
  other: 'Outro',
};

const STATUS_LABEL: Record<string, string> = {
  open: 'Aberto',
  in_progress: 'Em andamento',
  resolved: 'Resolvido',
  dismissed: 'Descartado',
};

function statusTone(status?: string | null): string {
  if (status === 'resolved') return 'text-green-700';
  if (status === 'dismissed') return 'text-gray-500';
  if (status === 'in_progress') return 'text-[#005B96]';
  return 'text-amber-700';
}

function formatDate(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('pt-BR');
}

function truncate(text?: string | null, max = 120): string {
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

export default function MobileAdminFeedback() {
  const { isAuthenticated, isLoading: authLoading } = useSupabaseAuth();
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      const res = await fetch('/api/admin/feedback', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(Array.isArray(data) ? data : data.feedbacks || []);
    } catch {
      setError('Não foi possível carregar os feedbacks.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) load();
    else if (!authLoading) setLoading(false);
  }, [isAuthenticated, authLoading, load]);

  return (
    <MobileShell title="Feedbacks">
      <div className="flex flex-col gap-3" data-abz-mobile-admin-feedback="">
        {!isAuthenticated && !authLoading ? (
          <p className="py-8 text-center text-sm text-gray-500">
            Entre para ver os feedbacks enviados pelos usuários.
          </p>
        ) : (
          <>
            <p className="text-xs text-gray-500">
              Detalhes, anexos e alteração de status continuam no painel desktop.
            </p>

            {error ? (
              <div className="abz-m-alert-error rounded-xl p-3 text-sm" role="alert">
                {error}
                <TouchButton variant="ghost" className="mt-1" onClick={load}>
                  Tentar de novo
                </TouchButton>
              </div>
            ) : null}

            {items.map((fb) => (
              <DataCard
                key={fb.id}
                title={fb.user_name || fb.user_email || 'Usuário não identificado'}
                subtitle={truncate(fb.message) || undefined}
                meta={formatDate(fb.created_at)}
              >
                <span className={`mt-2 block text-xs font-semibold ${statusTone(fb.status)}`}>
                  {TYPE_LABEL[fb.type] || fb.type} · {STATUS_LABEL[fb.status] || fb.status}
                </span>
              </DataCard>
            ))}

            {loading ? (
              <p className="py-4 text-center text-sm text-gray-400">Carregando…</p>
            ) : null}
            {!loading && items.length === 0 && !error ? (
              <p className="py-8 text-center text-sm text-gray-500">
                Nenhum feedback recebido.
              </p>
            ) : null}
          </>
        )}
      </div>
    </MobileShell>
  );
}
