'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { getToken } from '@/lib/tokenStorage';
import DataCard from './DataCard';
import MobileShell from './MobileShell';
import TouchButton from './TouchButton';

type FolhaStatus = 'draft' | 'calculated' | 'approved' | 'paid' | 'cancelled';

// Linha real de payroll_sheets (snake_case, como vem de GET /api/payroll/sheets).
type FolhaSheet = {
  id: string;
  reference_month: number;
  reference_year: number;
  status: FolhaStatus;
  total_employees?: number | null;
  total_gross?: number | null;
  total_deductions?: number | null;
  total_net?: number | null;
  company?: { name?: string | null } | null;
};

// Shape de GET /api/financeiro/visao-geral (FinVisaoGeral).
type FinVisaoGeral = {
  kpis: {
    faturasPorStatus: Record<string, number>;
    totalFaturas: number;
    nfsePorStatus: Record<string, number>;
    cobrancasAbertas: number;
    recebidoMes: number;
    folhasPorStatus: Record<string, number>;
  };
  competencias: { competencia: string; faturas: number; total: number }[];
};

const STATUS_LABEL: Record<FolhaStatus, string> = {
  draft: 'Rascunho',
  calculated: 'Calculada',
  approved: 'Aprovada',
  paid: 'Paga',
  cancelled: 'Cancelada',
};

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function statusTone(status: FolhaStatus): string {
  if (status === 'approved' || status === 'paid') return 'text-green-700';
  if (status === 'cancelled') return 'text-red-700';
  if (status === 'calculated') return 'text-blue-700';
  return 'text-amber-700';
}

function formatBRL(value?: number | null): string {
  if (value == null || Number.isNaN(value)) return '—';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function competenciaLabel(month: number, year: number): string {
  const nome = MESES[month - 1];
  return nome ? `${nome}/${year}` : `${String(month).padStart(2, '0')}/${year}`;
}

const PAGE_SIZE = 10;

export default function MobileFolhaPagamento() {
  const { isAuthenticated, isLoading: authLoading } = useSupabaseAuth();
  const [sheets, setSheets] = useState<FolhaSheet[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visao, setVisao] = useState<FinVisaoGeral | null>(null);

  const load = useCallback(async (targetPage: number, append: boolean) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError(null);
    try {
      const token = getToken();
      const res = await fetch(`/api/payroll/sheets?page=${targetPage}&limit=${PAGE_SIZE}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body?.success === false) {
        throw new Error(body?.error || `HTTP ${res.status}`);
      }
      const lista = Array.isArray(body?.data) ? (body.data as FolhaSheet[]) : [];
      setSheets((prev) => (append ? [...prev, ...lista] : lista));
      setPage(targetPage);
      setTotalPages(body?.pagination?.totalPages || 1);
    } catch {
      setError('Não foi possível carregar as folhas de pagamento.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  const loadVisao = useCallback(async () => {
    try {
      const token = getToken();
      const res = await fetch('/api/financeiro/visao-geral', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return; // sem nível financeiro: esconde o resumo
      const body = await res.json().catch(() => ({}));
      if (body?.success && body?.data?.kpis) setVisao(body.data as FinVisaoGeral);
    } catch {
      // resumo financeiro é opcional no recorte mobile
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      load(1, false);
      loadVisao();
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [isAuthenticated, authLoading, load, loadVisao]);

  return (
    <MobileShell title="Folha de Pagamento">
      <div className="flex flex-col gap-3" data-abz-mobile-folha-pagamento="">
        {!isAuthenticated && !authLoading ? (
          <p className="py-8 text-center text-sm text-gray-500">
            Entre para consultar as folhas de pagamento.
          </p>
        ) : (
          <>
            {error ? (
              <div className="abz-m-alert-error rounded-xl p-3 text-sm" role="alert">
                {error}
                <TouchButton variant="ghost" className="mt-1" onClick={() => load(1, false)}>
                  Tentar de novo
                </TouchButton>
              </div>
            ) : null}

            {visao ? (
              <DataCard title="Resumo financeiro" subtitle="Visão geral do módulo">
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="block font-semibold uppercase text-gray-500">Recebido no mês</span>
                    <span className="text-sm font-bold text-gray-900">{formatBRL(visao.kpis.recebidoMes)}</span>
                  </div>
                  <div>
                    <span className="block font-semibold uppercase text-gray-500">Cobranças abertas</span>
                    <span className="text-sm font-bold text-gray-900">{visao.kpis.cobrancasAbertas}</span>
                  </div>
                  <div>
                    <span className="block font-semibold uppercase text-gray-500">Faturas</span>
                    <span className="text-sm font-bold text-gray-900">{visao.kpis.totalFaturas}</span>
                  </div>
                  <div>
                    <span className="block font-semibold uppercase text-gray-500">Folhas aprovadas</span>
                    <span className="text-sm font-bold text-gray-900">
                      {visao.kpis.folhasPorStatus?.approved ?? 0}
                    </span>
                  </div>
                </div>
              </DataCard>
            ) : null}

            {sheets.map((sheet) => (
              <DataCard
                key={sheet.id}
                title={competenciaLabel(sheet.reference_month, sheet.reference_year)}
                subtitle={sheet.company?.name || undefined}
                meta={sheet.total_employees != null ? `${sheet.total_employees} colab.` : undefined}
              >
                <span className={`mt-2 block text-xs font-semibold ${statusTone(sheet.status)}`}>
                  {STATUS_LABEL[sheet.status] || sheet.status}
                </span>
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="block font-semibold uppercase text-gray-500">Bruto</span>
                    <span className="font-bold text-gray-900">{formatBRL(sheet.total_gross)}</span>
                  </div>
                  <div>
                    <span className="block font-semibold uppercase text-gray-500">Descontos</span>
                    <span className="font-bold text-gray-900">{formatBRL(sheet.total_deductions)}</span>
                  </div>
                  <div>
                    <span className="block font-semibold uppercase text-gray-500">Líquido</span>
                    <span className="font-bold text-gray-900">{formatBRL(sheet.total_net)}</span>
                  </div>
                </div>
              </DataCard>
            ))}

            {loading ? (
              <p className="py-4 text-center text-sm text-gray-400">Carregando…</p>
            ) : null}
            {!loading && sheets.length === 0 && !error ? (
              <p className="py-8 text-center text-sm text-gray-500">
                Nenhuma folha de pagamento encontrada.
              </p>
            ) : null}

            {!loading && page < totalPages ? (
              <TouchButton
                variant="ghost"
                className="w-full justify-center"
                disabled={loadingMore}
                onClick={() => load(page + 1, true)}
              >
                {loadingMore ? 'Carregando…' : 'Carregar mais'}
              </TouchButton>
            ) : null}

            <p className="py-2 text-center text-xs text-gray-400">
              Cálculo, itens e aprovação da folha estão na{' '}
              <Link href="/folha-pagamento" className="font-semibold text-[#005B96] underline">
                versão completa
              </Link>
              .
            </p>
          </>
        )}
      </div>
    </MobileShell>
  );
}
