'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { getToken } from '@/lib/tokenStorage';
import DataCard from './DataCard';
import MobileShell from './MobileShell';
import TouchButton from './TouchButton';

type NewsMetric = {
  id: string;
  title: string;
  category: string;
  published_at: string;
  views_total: number;
  views_unique: number;
  avg_time_seconds: number;
  likes: number;
  comments: number;
};

type ModuleMetric = {
  module_id: string;
  module_name: string;
  total_accesses: number;
  unique_users: number;
  avg_duration: number;
  last_accessed: string;
};

type ModuleData = {
  modules: ModuleMetric[];
  summary: {
    total_accesses: number;
    unique_users: number;
    unique_modules: number;
  };
};

const RANGES = [
  { value: '7', label: '7 dias' },
  { value: '30', label: '30 dias' },
  { value: '90', label: '90 dias' },
];

function formatDate(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('pt-BR');
}

function formatTime(seconds: number): string {
  if (!seconds) return '0s';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}

export default function MobileAdminEngagement() {
  const { isAuthenticated, isLoading: authLoading } = useSupabaseAuth();
  const [tab, setTab] = useState<'news' | 'modules'>('news');
  const [days, setDays] = useState('30');
  const [news, setNews] = useState<NewsMetric[]>([]);
  const [moduleData, setModuleData] = useState<ModuleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const url =
        tab === 'news' ? `/api/metrics/news?days=${days}` : `/api/metrics/modules?days=${days}`;
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (tab === 'news') {
        setNews(Array.isArray(data) ? data : []);
      } else {
        setModuleData(data);
      }
    } catch {
      setError('Não foi possível carregar o engajamento.');
    } finally {
      setLoading(false);
    }
  }, [tab, days]);

  useEffect(() => {
    if (isAuthenticated) load();
    else if (!authLoading) setLoading(false);
  }, [isAuthenticated, authLoading, load]);

  const newsSummary = {
    totalViews: news.reduce((sum, m) => sum + (m.views_total || 0), 0),
    uniqueViews: news.reduce((sum, m) => sum + (m.views_unique || 0), 0),
    totalLikes: news.reduce((sum, m) => sum + (m.likes || 0), 0),
    avgTime:
      news.length > 0
        ? news.reduce((sum, m) => sum + (m.avg_time_seconds || 0), 0) / news.length
        : 0,
  };

  return (
    <MobileShell title="Engajamento">
      <div className="flex flex-col gap-3" data-abz-mobile-admin-engagement="">
        {!isAuthenticated && !authLoading ? (
          <p className="py-8 text-center text-sm text-gray-500">
            Entre para ver as métricas de engajamento.
          </p>
        ) : (
          <>
            <div className="flex gap-2">
              <TouchButton
                variant={tab === 'news' ? 'primary' : 'ghost'}
                className="flex-1 justify-center"
                onClick={() => setTab('news')}
              >
                Notícias
              </TouchButton>
              <TouchButton
                variant={tab === 'modules' ? 'primary' : 'ghost'}
                className="flex-1 justify-center"
                onClick={() => setTab('modules')}
              >
                Módulos
              </TouchButton>
            </div>

            <div className="flex gap-2">
              {RANGES.map((r) => (
                <TouchButton
                  key={r.value}
                  variant={days === r.value ? 'primary' : 'ghost'}
                  className="flex-1 justify-center"
                  onClick={() => setDays(r.value)}
                >
                  {r.label}
                </TouchButton>
              ))}
            </div>

            {error ? (
              <div className="abz-m-alert-error rounded-xl p-3 text-sm" role="alert">
                {error}
                <TouchButton variant="ghost" className="mt-1" onClick={load}>
                  Tentar de novo
                </TouchButton>
              </div>
            ) : null}

            {tab === 'news' ? (
              <>
                {news.length > 0 ? (
                  <>
                    <DataCard
                      title="Visualizações totais"
                      subtitle={`${newsSummary.uniqueViews} únicas`}
                      meta={String(newsSummary.totalViews)}
                    />
                    <DataCard
                      title="Tempo médio de leitura"
                      subtitle={`${newsSummary.totalLikes} curtidas no período`}
                      meta={formatTime(newsSummary.avgTime)}
                    />
                  </>
                ) : null}
                {news.map((m) => (
                  <DataCard
                    key={m.id}
                    title={m.title}
                    subtitle={m.category || undefined}
                    meta={formatDate(m.published_at)}
                  >
                    <span className="mt-2 block text-xs font-semibold text-[#005B96]">
                      {m.views_unique} views únicas · {formatTime(m.avg_time_seconds)} ·{' '}
                      {m.likes} curtidas · {m.comments} comentários
                    </span>
                  </DataCard>
                ))}
                {!loading && news.length === 0 && !error ? (
                  <p className="py-8 text-center text-sm text-gray-500">
                    Nenhuma notícia com métricas no período.
                  </p>
                ) : null}
              </>
            ) : (
              <>
                {moduleData?.summary ? (
                  <DataCard
                    title="Acessos no período"
                    subtitle={`${moduleData.summary.unique_users} usuários únicos · ${moduleData.summary.unique_modules} módulos`}
                    meta={String(moduleData.summary.total_accesses)}
                  />
                ) : null}
                {(moduleData?.modules || []).map((m) => (
                  <DataCard
                    key={m.module_id}
                    title={m.module_name}
                    subtitle={`Último acesso: ${formatDate(m.last_accessed)}`}
                    meta={String(m.total_accesses)}
                  >
                    <span className="mt-2 block text-xs font-semibold text-[#005B96]">
                      {m.unique_users} usuários únicos · duração média{' '}
                      {formatTime(m.avg_duration)}
                    </span>
                  </DataCard>
                ))}
                {!loading && (moduleData?.modules || []).length === 0 && !error ? (
                  <p className="py-8 text-center text-sm text-gray-500">
                    Nenhum acesso registrado no período.
                  </p>
                ) : null}
              </>
            )}

            {loading ? (
              <p className="py-4 text-center text-sm text-gray-400">Carregando…</p>
            ) : null}

            <p className="text-xs text-gray-500">
              Gráficos, filtros e exportação CSV continuam no painel desktop.
            </p>
          </>
        )}
      </div>
    </MobileShell>
  );
}
