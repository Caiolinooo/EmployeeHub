'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { getToken } from '@/lib/tokenStorage';
import DataCard from './DataCard';
import MobileShell from './MobileShell';
import TouchButton from './TouchButton';

type EvaluationRow = {
  id: string;
  funcionario_id: string;
  avaliador_id: string | null;
  periodo_id?: string | null;
  periodo?: string | null;
  ciclo_nome?: string | null;
  ciclo_ano?: number | null;
  data_inicio?: string | null;
  data_fim?: string | null;
  status: string;
  media_geral?: number | string | null;
  nota_final?: number | string | null;
  funcionario_nome?: string | null;
  avaliador_nome?: string | null;
  deleted_at?: string | null;
  created_at?: string | null;
};

type EvaluationPeriodRow = {
  id: string;
  nome: string;
  data_inicio?: string | null;
  data_fim?: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em andamento',
  aguardando_aprovacao: 'Aguardando aprovação',
  aprovada_aguardando_comentario: 'Aguardando comentário',
  aguardando_finalizacao: 'Aguardando finalização',
  concluida: 'Concluída',
  devolvida: 'Devolvida para ajustes',
  cancelada: 'Cancelada',
};

function statusTone(status?: string | null): string {
  if (status === 'concluida') return 'bg-green-100 text-green-800';
  if (status === 'devolvida' || status === 'cancelada') return 'bg-red-100 text-red-800';
  if (status === 'aguardando_aprovacao' || status === 'aprovada_aguardando_comentario')
    return 'bg-blue-100 text-blue-800';
  return 'bg-amber-100 text-amber-800';
}

function formatDate(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('pt-BR');
}

function formatScore(value?: number | string | null): string | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (Number.isNaN(n) || n <= 0) return null;
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
}

export default function MobileAvaliacao() {
  const { user, isAuthenticated, isLoading: authLoading } = useSupabaseAuth();
  const [evaluations, setEvaluations] = useState<EvaluationRow[]>([]);
  const [periods, setPeriods] = useState<EvaluationPeriodRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      // Mesmas APIs do módulo de avaliação: lista da view vw_avaliacoes_desempenho
      // e períodos para resolver nomes quando a view não os traz.
      const [evalRes, periodRes] = await Promise.all([
        fetch('/api/avaliacao-desempenho/avaliacoes', { headers }),
        fetch('/api/avaliacao/periodos', { headers }),
      ]);
      if (!evalRes.ok) throw new Error(`HTTP ${evalRes.status}`);
      const evalData = await evalRes.json();
      const rows: EvaluationRow[] = Array.isArray(evalData?.data) ? evalData.data : [];
      setEvaluations(
        rows.filter(
          (ev) =>
            !ev.deleted_at &&
            (ev.funcionario_id === user.id || ev.avaliador_id === user.id),
        ),
      );
      if (periodRes.ok) {
        const periodData = await periodRes.json();
        setPeriods(Array.isArray(periodData?.periodos) ? periodData.periodos : []);
      }
    } catch {
      setError('Não foi possível carregar suas avaliações.');
      setEvaluations([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (isAuthenticated) load();
    else if (!authLoading) setLoading(false);
  }, [isAuthenticated, authLoading, load]);

  const periodNameById = useMemo(() => {
    const byId: Record<string, string> = {};
    periods.forEach((p) => {
      byId[p.id] = p.nome;
    });
    return byId;
  }, [periods]);

  const periodLabel = (ev: EvaluationRow): string => {
    if (ev.periodo && typeof ev.periodo === 'string') return ev.periodo;
    if (ev.periodo_id && periodNameById[ev.periodo_id]) return periodNameById[ev.periodo_id];
    if (ev.ciclo_nome) return ev.ciclo_ano ? `${ev.ciclo_nome} ${ev.ciclo_ano}` : ev.ciclo_nome;
    return 'Avaliação de desempenho';
  };

  const desktopHref = (ev: EvaluationRow): string => {
    const isSelfPending =
      ev.funcionario_id === user?.id && (ev.status === 'pendente' || ev.status === 'em_andamento');
    return isSelfPending ? `/avaliacao/preencher/${ev.id}` : `/avaliacao/ver/${ev.id}`;
  };

  return (
    <MobileShell title="Avaliação">
      <div className="flex flex-col gap-3" data-abz-mobile-avaliacao="">
        {!isAuthenticated && !authLoading ? (
          <p className="py-8 text-center text-sm text-gray-500">
            Entre para ver suas avaliações de desempenho.
          </p>
        ) : (
          <>
            {error ? (
              <div className="abz-m-alert-error rounded-xl p-3 text-sm" role="alert">
                {error}
                <TouchButton variant="ghost" className="mt-1" onClick={load}>
                  Tentar de novo
                </TouchButton>
              </div>
            ) : null}

            {loading ? (
              <p className="py-4 text-center text-sm text-gray-400">Carregando…</p>
            ) : null}

            {!loading && evaluations.length === 0 && !error ? (
              <p className="py-8 text-center text-sm text-gray-500">
                Nenhuma avaliação encontrada.
              </p>
            ) : null}

            {evaluations.map((ev) => {
              const isSelf = ev.funcionario_id === user?.id;
              const score = formatScore(ev.nota_final ?? ev.media_geral);
              const dates =
                ev.data_inicio && ev.data_fim
                  ? `${formatDate(ev.data_inicio)} → ${formatDate(ev.data_fim)}`
                  : undefined;
              return (
                <DataCard
                  key={ev.id}
                  title={periodLabel(ev)}
                  subtitle={
                    isSelf
                      ? `Avaliador: ${ev.avaliador_nome || 'não atribuído'}`
                      : `Avaliando: ${ev.funcionario_nome || 'colaborador'}`
                  }
                  meta={dates}
                >
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${statusTone(ev.status)}`}
                    >
                      {STATUS_LABEL[ev.status] || ev.status}
                    </span>
                    {score ? (
                      <span className="text-xs font-semibold text-gray-700">
                        Nota final: {score}
                      </span>
                    ) : null}
                  </div>
                  <a
                    href={desktopHref(ev)}
                    className="mt-3 inline-flex min-h-[44px] items-center text-sm font-semibold text-[#005B96]"
                  >
                    {ev.funcionario_id === user?.id &&
                    (ev.status === 'pendente' || ev.status === 'em_andamento')
                      ? 'Responder no painel completo'
                      : 'Abrir detalhes no painel completo'}
                  </a>
                </DataCard>
              );
            })}
          </>
        )}
      </div>
    </MobileShell>
  );
}
