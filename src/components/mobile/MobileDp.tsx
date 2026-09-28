'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { getToken } from '@/lib/tokenStorage';
import DataCard from './DataCard';
import MobileShell from './MobileShell';
import TouchButton from './TouchButton';

type Colaborador = {
  id: string;
  matricula?: string | null;
  nome_completo: string;
  status_embarque?: string | null;
  cargo_nome?: string | null;
  empresa_nome?: string | null;
  embarcacao_nome?: string | null;
  regime_trabalho?: string | null;
  escala_embarque?: number | null;
  escala_folga?: number | null;
};

type AsoItem = {
  id: string;
  titulo: string;
  data_validade: string;
  alerta: 'vencido' | 'vencendo';
  colaborador?: {
    id: string;
    nome_completo: string;
    cargo_nome?: string | null;
    embarcacao_nome?: string | null;
  } | null;
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

function formatRegime(c: Colaborador): string {
  if (!c.regime_trabalho) return '';
  if (c.regime_trabalho === 'escala' && c.escala_embarque && c.escala_folga) {
    return `Escala ${c.escala_embarque}x${c.escala_folga}`;
  }
  return c.regime_trabalho;
}

function formatDate(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('pt-BR');
}

const PAGE_LIMIT = 20;

export default function MobileDp() {
  const { isAuthenticated, isLoading: authLoading } = useSupabaseAuth();
  const [tab, setTab] = useState<'colaboradores' | 'asos'>('colaboradores');

  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loadingColab, setLoadingColab] = useState(true);
  const [errorColab, setErrorColab] = useState<string | null>(null);

  const [asos, setAsos] = useState<AsoItem[]>([]);
  const [loadingAsos, setLoadingAsos] = useState(false);
  const [errorAsos, setErrorAsos] = useState<string | null>(null);

  const loadColaboradores = useCallback(async (pageToLoad: number, term: string) => {
    setLoadingColab(true);
    setErrorColab(null);
    try {
      const token = getToken();
      const params = new URLSearchParams({
        page: String(pageToLoad),
        limit: String(PAGE_LIMIT),
        ativo: 'true',
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
      setErrorColab('Não foi possível carregar os colaboradores.');
    } finally {
      setLoadingColab(false);
    }
  }, []);

  const loadAsos = useCallback(async () => {
    setLoadingAsos(true);
    setErrorAsos(null);
    try {
      const token = getToken();
      const res = await fetch('/api/gestao-tripulantes/aso/notificar-vencimentos', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const vencidos: AsoItem[] = Array.isArray(json.data?.vencidos) ? json.data.vencidos : [];
      const vencendo: AsoItem[] = Array.isArray(json.data?.vencendo) ? json.data.vencendo : [];
      setAsos([...vencidos, ...vencendo]);
    } catch {
      setErrorAsos('Não foi possível carregar os vencimentos de ASO.');
    } finally {
      setLoadingAsos(false);
    }
  }, []);

  // Debounce da busca (300ms), mesmo padrão do desktop.
  useEffect(() => {
    if (!isAuthenticated) return;
    const handle = setTimeout(() => loadColaboradores(1, search), search ? 300 : 0);
    return () => clearTimeout(handle);
  }, [isAuthenticated, search, loadColaboradores]);

  useEffect(() => {
    if (isAuthenticated && tab === 'asos') loadAsos();
    else if (!isAuthenticated && !authLoading) setLoadingColab(false);
  }, [isAuthenticated, authLoading, tab, loadAsos]);

  const hasMore = colaboradores.length < total;

  return (
    <MobileShell title="Departamento Pessoal">
      <div className="flex flex-col gap-3" data-abz-mobile-dp="">
        {!isAuthenticated && !authLoading ? (
          <p className="py-8 text-center text-sm text-gray-500">
            Entre para ver o Departamento Pessoal.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2" data-abz-mobile-dp-tabs="">
              <TouchButton
                variant={tab === 'colaboradores' ? 'primary' : 'ghost'}
                className="justify-center"
                onClick={() => setTab('colaboradores')}
              >
                Colaboradores
              </TouchButton>
              <TouchButton
                variant={tab === 'asos' ? 'primary' : 'ghost'}
                className="justify-center"
                onClick={() => setTab('asos')}
              >
                ASOs a vencer
              </TouchButton>
            </div>

            {tab === 'colaboradores' ? (
              <>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nome, CPF ou matrícula…"
                  className="touch-target w-full rounded-xl border border-gray-200 px-3 py-2 text-base"
                  data-abz-mobile-dp-search=""
                />

                {errorColab ? (
                  <div className="abz-m-alert-error rounded-xl p-3 text-sm" role="alert">
                    {errorColab}
                    <TouchButton
                      variant="ghost"
                      className="mt-1"
                      onClick={() => loadColaboradores(1, search)}
                    >
                      Tentar de novo
                    </TouchButton>
                  </div>
                ) : null}

                {colaboradores.map((c) => (
                  <DataCard
                    key={c.id}
                    title={c.nome_completo}
                    subtitle={
                      [c.cargo_nome, c.embarcacao_nome, formatRegime(c)]
                        .filter(Boolean)
                        .join(' • ') || undefined
                    }
                    meta={c.matricula ? `Mat. ${c.matricula}` : undefined}
                  >
                    <span className={`mt-2 block text-xs font-semibold ${statusTone(c.status_embarque)}`}>
                      {statusLabel(c.status_embarque)}
                    </span>
                  </DataCard>
                ))}

                {loadingColab ? (
                  <p className="py-4 text-center text-sm text-gray-400">Carregando…</p>
                ) : null}
                {!loadingColab && colaboradores.length === 0 && !errorColab ? (
                  <p className="py-8 text-center text-sm text-gray-500">
                    Nenhum colaborador encontrado.
                  </p>
                ) : null}
                {!loadingColab && hasMore ? (
                  <TouchButton
                    variant="ghost"
                    className="w-full justify-center"
                    onClick={() => loadColaboradores(page + 1, search)}
                  >
                    Carregar mais
                  </TouchButton>
                ) : null}
              </>
            ) : (
              <>
                {errorAsos ? (
                  <div className="abz-m-alert-error rounded-xl p-3 text-sm" role="alert">
                    {errorAsos}
                    <TouchButton variant="ghost" className="mt-1" onClick={loadAsos}>
                      Tentar de novo
                    </TouchButton>
                  </div>
                ) : null}

                {asos.map((a) => (
                  <DataCard
                    key={a.id}
                    title={a.colaborador?.nome_completo || a.titulo}
                    subtitle={
                      [
                        a.titulo,
                        [a.colaborador?.cargo_nome, a.colaborador?.embarcacao_nome]
                          .filter(Boolean)
                          .join(' • ') || null,
                      ]
                        .filter(Boolean)
                        .join(' — ') || undefined
                    }
                    meta={formatDate(a.data_validade)}
                  >
                    <span
                      className={`mt-2 block text-xs font-semibold ${
                        a.alerta === 'vencido' ? 'text-red-700' : 'text-amber-700'
                      }`}
                    >
                      {a.alerta === 'vencido' ? 'ASO vencido' : 'ASO vencendo'}
                    </span>
                  </DataCard>
                ))}

                {loadingAsos ? (
                  <p className="py-4 text-center text-sm text-gray-400">Carregando…</p>
                ) : null}
                {!loadingAsos && asos.length === 0 && !errorAsos ? (
                  <p className="py-8 text-center text-sm text-gray-500">
                    Nenhum ASO vencido ou a vencer.
                  </p>
                ) : null}
              </>
            )}
          </>
        )}
      </div>
    </MobileShell>
  );
}
