'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { getToken } from '@/lib/tokenStorage';
import {
  ACTIVE_BOARD_STORAGE_KEY,
  type KpiBoardRow,
  type KpiBoardSpec,
  type KpiBoardWidget,
} from '@/lib/ia/kpi-board-shared';
import DataCard from './DataCard';
import MobileShell from './MobileShell';
import TouchButton from './TouchButton';

type MetricData = {
  value?: unknown;
  label?: string;
  unit?: unknown;
  change?: unknown;
  trend?: unknown;
};

type ListItem = { id: string | number; title: string; subtitle: string; status?: string };
type TableColumn = { key: string; label?: string };

function metricVariation(data: MetricData): string | undefined {
  const parts: string[] = [];
  if (data.change !== undefined && data.change !== null && data.change !== '') {
    const c = data.change;
    parts.push(
      typeof c === 'number'
        ? `Variação: ${c > 0 ? '+' : ''}${c}`
        : `Variação: ${String(c)}`,
    );
  }
  if (typeof data.trend === 'string' && data.trend) {
    parts.push(`Tendência: ${data.trend}`);
  }
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

function WidgetCard({ widget }: { widget: KpiBoardWidget }) {
  const raw =
    widget.data && typeof widget.data === 'object' && !Array.isArray(widget.data)
      ? (widget.data as Record<string, unknown>)
      : {};
  if (typeof raw.error === 'string') {
    return (
      <DataCard title={widget.title || 'Indicador'} subtitle={raw.error} meta="—" />
    );
  }

  switch (widget.type) {
    case 'metric': {
      const data = raw as MetricData;
      const value =
        data.value !== undefined && data.value !== null ? String(data.value) : '—';
      const unit = data.unit ? ` ${String(data.unit)}` : '';
      return (
        <DataCard
          title={widget.title || data.label || 'Indicador'}
          subtitle={metricVariation(data)}
          meta={`${value}${unit}`}
        >
          {data.label && widget.title ? (
            <span className="mt-1 block text-xs text-gray-400">{data.label}</span>
          ) : null}
        </DataCard>
      );
    }
    case 'list': {
      const items = Array.isArray(raw.items) ? (raw.items as ListItem[]).slice(0, 5) : [];
      const empty =
        typeof raw.emptyMessage === 'string' ? raw.emptyMessage : 'Nenhum item';
      return (
        <DataCard title={widget.title || 'Lista'}>
          {items.length > 0 ? (
            <ul className="mt-2 flex flex-col gap-1">
              {items.map((item) => (
                <li key={item.id} className="text-sm text-gray-700">
                  <span className="font-medium">{item.title}</span>
                  {item.subtitle ? (
                    <span className="text-gray-500"> — {item.subtitle}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-gray-500">{empty}</p>
          )}
        </DataCard>
      );
    }
    case 'table': {
      const columns = Array.isArray(raw.columns) ? (raw.columns as TableColumn[]) : [];
      const rows = Array.isArray(raw.rows)
        ? (raw.rows as Record<string, unknown>[]).slice(0, 5)
        : [];
      const empty =
        typeof raw.emptyMessage === 'string' ? raw.emptyMessage : 'Sem dados para exibir';
      return (
        <DataCard title={widget.title || 'Tabela'}>
          {rows.length > 0 ? (
            <ul className="mt-2 flex flex-col gap-1">
              {rows.map((row, i) => (
                <li key={i} className="text-sm text-gray-700">
                  {columns.slice(0, 3).map((col, j) => (
                    <span key={col.key}>
                      {j > 0 ? ' · ' : ''}
                      {String(row[col.key] ?? '—')}
                    </span>
                  ))}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-gray-500">{empty}</p>
          )}
        </DataCard>
      );
    }
    case 'chart': {
      const items = Array.isArray(raw.items)
        ? (raw.items as { name: string; value: number }[]).slice(0, 5)
        : [];
      const empty =
        typeof raw.emptyMessage === 'string'
          ? raw.emptyMessage
          : 'Sem dados para o gráfico';
      return (
        <DataCard title={widget.title || 'Gráfico'}>
          {items.length > 0 ? (
            <ul className="mt-2 flex flex-col gap-1">
              {items.map((item, i) => (
                <li key={`${item.name}-${i}`} className="flex justify-between text-sm">
                  <span className="text-gray-700">{item.name}</span>
                  <span className="font-semibold text-[#005B96]">{item.value}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-gray-500">{empty}</p>
          )}
        </DataCard>
      );
    }
    case 'markdown': {
      const content = typeof raw.content === 'string' ? raw.content : '';
      return content ? (
        <DataCard title={widget.title || 'Nota'}>
          <p className="mt-2 whitespace-pre-line text-sm text-gray-700">{content}</p>
        </DataCard>
      ) : null;
    }
    default:
      // html_sandbox e tipos desconhecidos ficam no desktop
      return null;
  }
}

export default function MobileKpi() {
  const { user, profile, isAuthenticated, isLoading: authLoading } = useSupabaseAuth();
  const userId = user?.id || profile?.id || '';
  const [boards, setBoards] = useState<KpiBoardRow[]>([]);
  const [activeBoard, setActiveBoard] = useState<KpiBoardRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBoard = useCallback(
    async (boardId: string) => {
      const token = getToken();
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(
        `/api/ia/kpi-boards?id=${encodeURIComponent(boardId)}&resolve=1`,
        { headers },
      );
      if (res.ok) {
        const data = await res.json();
        setActiveBoard(data.board || null);
        return;
      }
      // Preferência obsoleta — tenta o quadro ativo
      const activeRes = await fetch('/api/ia/kpi-boards?active=1&resolve=1', {
        headers,
      });
      if (activeRes.ok) {
        const data = await activeRes.json();
        setActiveBoard(data.board || null);
      } else {
        setActiveBoard(null);
      }
    },
    [],
  );

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const listRes = await fetch('/api/ia/kpi-boards', { headers });
      if (!listRes.ok) {
        const body = await listRes.json().catch(() => ({}));
        throw new Error(body.error || 'Falha ao listar quadros');
      }
      const listData = await listRes.json();
      const list: KpiBoardRow[] = listData.boards || [];
      setBoards(list);

      const preferredId =
        typeof window !== 'undefined'
          ? window.localStorage.getItem(ACTIVE_BOARD_STORAGE_KEY)
          : null;
      const targetId =
        preferredId || list.find((b) => b.is_active)?.id || list[0]?.id || null;

      if (!targetId) {
        setActiveBoard(null);
        return;
      }
      await fetchBoard(targetId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar quadro');
    } finally {
      setLoading(false);
    }
  }, [userId, fetchBoard]);

  useEffect(() => {
    if (isAuthenticated && userId) load();
    else if (!authLoading) setLoading(false);
  }, [isAuthenticated, authLoading, userId, load]);

  const selectBoard = (boardId: string) => {
    try {
      window.localStorage.setItem(ACTIVE_BOARD_STORAGE_KEY, boardId);
    } catch {
      /* ignore */
    }
    setLoading(true);
    setError(null);
    void fetchBoard(boardId)
      .catch(() => setError('Erro ao carregar quadro'))
      .finally(() => setLoading(false));
  };

  const spec = activeBoard?.spec as KpiBoardSpec | undefined;
  const widgets = (spec?.widgets || []).filter((w) => w.type !== 'html_sandbox');

  return (
    <MobileShell title="KPI">
      <div className="flex flex-col gap-4" data-abz-mobile-kpi="">
        {!isAuthenticated && !authLoading ? (
          <div className="flex flex-col gap-3">
            <p className="py-4 text-center text-sm text-gray-500">
              Entre para ver seus quadros de KPI.
            </p>
            <Link
              href="/login"
              className="touch-target inline-flex items-center justify-center rounded-xl bg-[#005B96] px-4 text-base font-semibold text-white"
            >
              Entrar
            </Link>
          </div>
        ) : (
          <>
            {boards.length > 1 ? (
              <div className="flex flex-wrap gap-2">
                {boards.map((b) => (
                  <TouchButton
                    key={b.id}
                    variant={activeBoard?.id === b.id ? 'primary' : 'ghost'}
                    className="px-3 text-sm"
                    onClick={() => selectBoard(b.id)}
                  >
                    {b.title}
                  </TouchButton>
                ))}
              </div>
            ) : null}

            {loading ? (
              <p className="py-8 text-center text-sm text-gray-400">
                Carregando quadro…
              </p>
            ) : error ? (
              <div className="abz-m-alert-error rounded-xl p-3 text-sm" role="alert">
                {error}
                <TouchButton variant="ghost" className="mt-1" onClick={load}>
                  Tentar de novo
                </TouchButton>
              </div>
            ) : activeBoard && widgets.length > 0 ? (
              <>
                {widgets.map((widget) => (
                  <WidgetCard key={widget.id} widget={widget} />
                ))}
                <p className="text-xs text-gray-400">
                  Quadro “{activeBoard.title}”. Gráficos completos e edição no layout
                  desktop.
                </p>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-6 text-center">
                <p className="text-sm font-semibold text-gray-800">
                  Nenhum quadro ainda
                </p>
                <p className="mt-2 text-sm text-gray-500">
                  Peça ao Companion: “monte um quadro KPI com minhas pendências e abra
                  no KPI”.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </MobileShell>
  );
}
