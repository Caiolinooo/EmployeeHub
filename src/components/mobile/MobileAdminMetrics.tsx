'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { getToken } from '@/lib/tokenStorage';
import DataCard from './DataCard';
import MobileShell from './MobileShell';
import TouchButton from './TouchButton';

type WAUData = {
  wau: number;
  totalUsers: number;
  percentage: number;
  period: string;
};

type SupportReport = {
  id: string;
  department: string;
  volume_estimated: number;
  top_doubts?: string[];
  period_start?: string | null;
  period_end?: string | null;
  created_at: string;
};

function formatDate(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('pt-BR');
}

export default function MobileAdminMetrics() {
  const { isAuthenticated, isLoading: authLoading } = useSupabaseAuth();
  const [wau, setWau] = useState<WAUData | null>(null);
  const [reports, setReports] = useState<SupportReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const [wauRes, supportRes] = await Promise.all([
        fetch('/api/metrics/wau', { headers }),
        fetch('/api/metrics/support', { headers }),
      ]);
      if (!wauRes.ok) throw new Error(`HTTP ${wauRes.status}`);
      const wauData = await wauRes.json();
      setWau(wauData);
      if (supportRes.ok) {
        const supportData = await supportRes.json();
        setReports(Array.isArray(supportData) ? supportData : []);
      }
    } catch {
      setError('Não foi possível carregar as métricas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) load();
    else if (!authLoading) setLoading(false);
  }, [isAuthenticated, authLoading, load]);

  return (
    <MobileShell title="Métricas">
      <div className="flex flex-col gap-3" data-abz-mobile-admin-metrics="">
        {!isAuthenticated && !authLoading ? (
          <p className="py-8 text-center text-sm text-gray-500">
            Entre para ver as métricas do painel.
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

            {wau ? (
              <>
                <DataCard
                  title="Usuários ativos (7 dias)"
                  subtitle={`${wau.percentage}% da base ativa`}
                  meta={String(wau.wau)}
                />
                <DataCard title="Usuários ativos no total" meta={String(wau.totalUsers)} />
              </>
            ) : null}

            {reports.length > 0 ? (
              <h2 className="mt-2 text-sm font-semibold text-gray-700">
                Relatórios de suporte
              </h2>
            ) : null}
            {reports.map((r) => (
              <DataCard
                key={r.id}
                title={r.department}
                subtitle={
                  r.top_doubts && r.top_doubts.length > 0
                    ? r.top_doubts.slice(0, 2).join(' · ')
                    : undefined
                }
                meta={formatDate(r.created_at)}
              >
                <span className="mt-2 block text-xs font-semibold text-[#005B96]">
                  Volume estimado: {r.volume_estimated}
                </span>
              </DataCard>
            ))}

            {loading ? (
              <p className="py-4 text-center text-sm text-gray-400">Carregando…</p>
            ) : null}
            {!loading && !wau && !error ? (
              <p className="py-8 text-center text-sm text-gray-500">
                Nenhuma métrica disponível.
              </p>
            ) : null}

            <p className="text-xs text-gray-500">
              Registro de dúvidas e relatórios detalhados continuam no painel desktop.
            </p>
          </>
        )}
      </div>
    </MobileShell>
  );
}
