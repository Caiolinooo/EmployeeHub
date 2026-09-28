'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { getToken } from '@/lib/tokenStorage';
import DataCard from './DataCard';
import MobileShell from './MobileShell';
import TouchButton from './TouchButton';

type DashboardData = {
  total_colaboradores: number;
  total_embarcados: number;
  total_disponiveis: number;
  total_docs_vencidos: number;
  total_docs_vencendo: number;
  asos_pendentes_revisao: number;
};

type Colaborador = {
  id: string;
  nome_completo: string;
  matricula?: string | null;
  cargo_nome?: string | null;
  empresa_nome?: string | null;
  embarcacao_nome?: string | null;
  status_embarque?: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  embarcado: 'Embarcado',
  standby: 'StandBy',
  folga: 'Folga',
  desembarcado: 'Desembarcado',
  afastado: 'Afastado',
  ferias: 'Afastado',
  treinamento: 'Treinamento',
};

function statusLabel(status?: string | null): string {
  if (!status) return '—';
  return STATUS_LABEL[status] || status;
}

function statusTone(status?: string | null): string {
  if (status === 'embarcado') return 'text-green-700';
  if (status === 'afastado' || status === 'ferias') return 'text-red-700';
  if (status === 'treinamento' || status === 'standby') return 'text-amber-700';
  return 'text-gray-600';
}

const PAGE_LIMIT = 20;

export default function MobileGestaoTripulantes() {
  const { isAuthenticated, isLoading: authLoading } = useSupabaseAuth();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    try {
      const token = getToken();
      const res = await fetch('/api/gestao-tripulantes/dashboard', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return;
      const json = await res.json();
      setDashboard(json.data || null);
    } catch {
      // Dashboard é complementar — a lista continua utilizável.
    }
  }, []);

  const loadColaboradores = useCallback(async (pageToLoad: number, term: string) => {
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      const params = new URLSearchParams({
        page: String(pageToLoad),
        limit: String(PAGE_LIMIT),
        ativo: 'ativos',
      });
      if (term.trim()) params.set('search', term.trim());
      const res = await fetch(`/api/gestao-tripulantes/colaboradores?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const rows: Colaborador[] = Array.isArray(json.data) ? json.data : [];
      setColaboradores((prev) => (pageToLoad === 1 ? rows : [...prev, ...rows]));
      setTotal(typeof json.pagination?.total === 'number' ? json.pagination.total : rows.length);
      setPage(pageToLoad);
    } catch {
      setError('Não foi possível carregar os tripulantes.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounce da busca (300ms), mesmo padrão do desktop.
  useEffect(() => {
    if (!isAuthenticated) return;
    const handle = setTimeout(() => loadColaboradores(1, search), search ? 300 : 0);
    return () => clearTimeout(handle);
  }, [isAuthenticated, search, loadColaboradores]);

  useEffect(() => {
    if (isAuthenticated) loadDashboard();
    else if (!authLoading) setLoading(false);
  }, [isAuthenticated, authLoading, loadDashboard]);

  const hasMore = colaboradores.length < total;

  return (
    <MobileShell title="Gestão de Tripulantes">
      <div className="flex flex-col gap-3" data-abz-mobile-gestao-tripulantes="">
        {!isAuthenticated && !authLoading ? (
          <p className="py-8 text-center text-sm text-gray-500">
            Entre para ver os tripulantes.
          </p>
        ) : (
          <>
            {dashboard ? (
              <div className="grid grid-cols-2 gap-2" data-abz-mobile-gt-kpis="">
                <DataCard title={String(dashboard.total_colaboradores)} subtitle="Colaboradores" />
                <DataCard title={String(dashboard.total_embarcados)} subtitle="Embarcados" />
                <DataCard title={String(dashboard.total_disponiveis)} subtitle="Disponíveis (standby)" />
                <DataCard
                  title={String(dashboard.total_docs_vencidos + dashboard.total_docs_vencendo)}
                  subtitle="Docs vencidos/a vencer"
                />
              </div>
            ) : null}

            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, CPF ou matrícula…"
              className="touch-target w-full rounded-xl border border-gray-200 px-3 py-2 text-base"
              data-abz-mobile-gt-search=""
            />

            {error ? (
              <div className="abz-m-alert-error rounded-xl p-3 text-sm" role="alert">
                {error}
                <TouchButton variant="ghost" className="mt-1" onClick={() => loadColaboradores(1, search)}>
                  Tentar de novo
                </TouchButton>
              </div>
            ) : null}

            {colaboradores.map((c) => (
              <DataCard
                key={c.id}
                title={c.nome_completo}
                subtitle={[c.cargo_nome, c.embarcacao_nome].filter(Boolean).join(' • ') || undefined}
                meta={c.matricula ? `Mat. ${c.matricula}` : undefined}
              >
                <span className={`mt-2 block text-xs font-semibold ${statusTone(c.status_embarque)}`}>
                  {statusLabel(c.status_embarque)}
                </span>
              </DataCard>
            ))}

            {loading ? (
              <p className="py-4 text-center text-sm text-gray-400">Carregando…</p>
            ) : null}
            {!loading && colaboradores.length === 0 && !error ? (
              <p className="py-8 text-center text-sm text-gray-500">
                Nenhum tripulante encontrado.
              </p>
            ) : null}
            {!loading && hasMore ? (
              <TouchButton
                variant="ghost"
                className="w-full justify-center"
                onClick={() => loadColaboradores(page + 1, search)}
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
