'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { getToken } from '@/lib/tokenStorage';
import DataCard from './DataCard';
import MobileShell from './MobileShell';
import TouchButton from './TouchButton';

type Resumo = {
  total_eventos: number;
  pendentes_revisao: number;
  fila_envio: number;
  enviados: number;
  processados: number;
  com_erro: number;
};

type Evento = {
  id: string;
  evento_codigo: string;
  evento_nome?: string | null;
  colaborador_nome?: string | null;
  colaborador_cargo?: string | null;
  status: string;
  created_at?: string | null;
  data_envio?: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  rascunho: 'Rascunho',
  pendente_revisao: 'Pendente de revisão',
  revisao_aprovado: 'Revisão aprovada',
  revisao_rejeitado: 'Revisão rejeitada',
  fila_envio: 'Fila de envio',
  enviando: 'Enviando',
  enviado: 'Enviado',
  processado: 'Processado',
  erro: 'Com erro',
  devolvido: 'Devolvido',
};

function statusLabel(status?: string | null): string {
  if (!status) return '—';
  return STATUS_LABEL[status] || status;
}

function statusTone(status?: string | null): string {
  if (status === 'processado' || status === 'enviado') return 'text-green-700';
  if (status === 'erro' || status === 'devolvido' || status === 'revisao_rejeitado') return 'text-red-700';
  return 'text-amber-700';
}

function formatDate(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('pt-BR');
}

const PAGE_LIMIT = 20;

export default function MobileESocial() {
  const { isAuthenticated, isLoading: authLoading } = useSupabaseAuth();
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (pageToLoad: number) => {
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      const params = new URLSearchParams({ page: String(pageToLoad), limit: String(PAGE_LIMIT) });
      const res = await fetch(`/api/e-social/eventos?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const rows: Evento[] = Array.isArray(json.eventos) ? json.eventos : [];
      setEventos((prev) => (pageToLoad === 1 ? rows : [...prev, ...rows]));
      setTotal(typeof json.total === 'number' ? json.total : rows.length);
      setResumo(json.resumo || null);
      setPage(pageToLoad);
    } catch {
      setError('Não foi possível carregar os eventos do e-Social.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) load(1);
    else if (!authLoading) setLoading(false);
  }, [isAuthenticated, authLoading, load]);

  const hasMore = eventos.length < total;

  return (
    <MobileShell title="e-Social">
      <div className="flex flex-col gap-3" data-abz-mobile-e-social="">
        {!isAuthenticated && !authLoading ? (
          <p className="py-8 text-center text-sm text-gray-500">
            Entre para ver os eventos do e-Social.
          </p>
        ) : (
          <>
            {resumo ? (
              <div className="grid grid-cols-2 gap-2" data-abz-mobile-esocial-resumo="">
                <DataCard title={String(resumo.total_eventos)} subtitle="Total de eventos" />
                <DataCard title={String(resumo.pendentes_revisao)} subtitle="Pendentes de revisão" />
                <DataCard title={String(resumo.fila_envio)} subtitle="Fila de envio" />
                <DataCard title={String(resumo.enviados)} subtitle="Enviados" />
                <DataCard title={String(resumo.processados)} subtitle="Processados" />
                <DataCard title={String(resumo.com_erro)} subtitle="Com erro" />
              </div>
            ) : null}

            {error ? (
              <div className="abz-m-alert-error rounded-xl p-3 text-sm" role="alert">
                {error}
                <TouchButton variant="ghost" className="mt-1" onClick={() => load(1)}>
                  Tentar de novo
                </TouchButton>
              </div>
            ) : null}

            {eventos.map((e) => (
              <DataCard
                key={e.id}
                title={e.evento_nome ? `${e.evento_codigo} · ${e.evento_nome}` : e.evento_codigo}
                subtitle={
                  [e.colaborador_nome, e.colaborador_cargo].filter(Boolean).join(' • ') || undefined
                }
                meta={formatDate(e.data_envio || e.created_at)}
              >
                <span className={`mt-2 block text-xs font-semibold ${statusTone(e.status)}`}>
                  {statusLabel(e.status)}
                </span>
              </DataCard>
            ))}

            {loading ? (
              <p className="py-4 text-center text-sm text-gray-400">Carregando…</p>
            ) : null}
            {!loading && eventos.length === 0 && !error ? (
              <p className="py-8 text-center text-sm text-gray-500">
                Nenhum evento do e-Social.
              </p>
            ) : null}
            {!loading && hasMore ? (
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
