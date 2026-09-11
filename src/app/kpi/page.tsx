'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  FiRefreshCw,
  FiBarChart2,
  FiLayout,
  FiAlertTriangle,
  FiTrash2,
} from 'react-icons/fi';
import MainLayout from '@/components/Layout/MainLayout';
import KpiBoardRenderer from '@/components/KPI/KpiBoardRenderer';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { portalActionBus, type AICommandPayload } from '@/lib/ia/portal-action-bus';
import {
  ACTIVE_BOARD_STORAGE_KEY,
  type KpiBoardRow,
  type KpiBoardSpec,
} from '@/lib/ia/kpi-board-shared';

export default function KPIDashboardPage() {
  const { user, profile, getToken, isLoading: authLoading } = useSupabaseAuth();
  const userId = user?.id || profile?.id || '';

  const [boards, setBoards] = useState<KpiBoardRow[]>([]);
  const [activeBoard, setActiveBoard] = useState<KpiBoardRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getAuthHeaders = useCallback(() => {
    const token = getToken?.() || (typeof window !== 'undefined'
      ? localStorage.getItem('abzToken') || localStorage.getItem('token')
      : null);
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }, [getToken]);

  const loadBoards = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const preferredId =
        typeof window !== 'undefined'
          ? localStorage.getItem(ACTIVE_BOARD_STORAGE_KEY)
          : null;

      const listRes = await fetch('/api/ia/kpi-boards', { headers: getAuthHeaders() });
      if (!listRes.ok) {
        const errBody = await listRes.json().catch(() => ({}));
        throw new Error(errBody.error || 'Falha ao listar quadros');
      }
      const listData = await listRes.json();
      const list: KpiBoardRow[] = listData.boards || [];
      setBoards(list);

      const targetId =
        preferredId ||
        list.find((b) => b.is_active)?.id ||
        list[0]?.id ||
        null;

      if (!targetId) {
        setActiveBoard(null);
        setLoading(false);
        return;
      }

      const boardRes = await fetch(
        `/api/ia/kpi-boards?id=${encodeURIComponent(targetId)}&resolve=1`,
        { headers: getAuthHeaders() }
      );
      if (!boardRes.ok) {
        // Preferred id stale — try active
        const activeRes = await fetch('/api/ia/kpi-boards?active=1&resolve=1', {
          headers: getAuthHeaders(),
        });
        if (activeRes.ok) {
          const activeData = await activeRes.json();
          setActiveBoard(activeData.board || null);
          if (activeData.board?.id) {
            try {
              localStorage.setItem(ACTIVE_BOARD_STORAGE_KEY, activeData.board.id);
            } catch { /* ignore */ }
          } else {
            try {
              localStorage.removeItem(ACTIVE_BOARD_STORAGE_KEY);
            } catch { /* ignore */ }
          }
        } else {
          setActiveBoard(null);
          try {
            localStorage.removeItem(ACTIVE_BOARD_STORAGE_KEY);
          } catch { /* ignore */ }
        }
      } else {
        const boardData = await boardRes.json();
        setActiveBoard(boardData.board || null);
      }
    } catch (err) {
      console.error('[KPI] load boards:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar quadro');
    }
    setLoading(false);
  }, [userId, getAuthHeaders]);

  useEffect(() => {
    if (!authLoading) loadBoards();
  }, [authLoading, loadBoards]);

  // Companion OPEN_KPI_BOARD + custom event
  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent).detail as { boardId?: string } | undefined;
      if (detail?.boardId) {
        try {
          localStorage.setItem(ACTIVE_BOARD_STORAGE_KEY, detail.boardId);
        } catch { /* ignore */ }
      }
      void loadBoards();
    };
    const onBus = (cmd: AICommandPayload) => {
      if (cmd.action === 'OPEN_KPI_BOARD') {
        void loadBoards();
      }
    };
    window.addEventListener('abz-kpi-board-open', onOpen);
    const unsub = portalActionBus.subscribe(onBus);
    return () => {
      window.removeEventListener('abz-kpi-board-open', onOpen);
      unsub();
    };
  }, [loadBoards]);

  const selectBoard = async (boardId: string) => {
    try {
      localStorage.setItem(ACTIVE_BOARD_STORAGE_KEY, boardId);
      await fetch('/api/ia/kpi-boards', {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id: boardId, setActive: true }),
      });
      await loadBoards();
    } catch (err) {
      console.error('[KPI] select board:', err);
    }
  };

  const deleteBoard = async (board: KpiBoardRow) => {
    const ok = window.confirm(
      `Excluir o quadro "${board.title}"?\nEsta ação não pode ser desfeita pelo Companion (soft-delete).`
    );
    if (!ok) return;

    setDeletingId(board.id);
    setError(null);
    try {
      const res = await fetch(
        `/api/ia/kpi-boards?id=${encodeURIComponent(board.id)}`,
        { method: 'DELETE', headers: getAuthHeaders() }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || 'Falha ao excluir quadro');
      }

      if (typeof window !== 'undefined') {
        const preferred = localStorage.getItem(ACTIVE_BOARD_STORAGE_KEY);
        if (preferred === board.id || activeBoard?.id === board.id) {
          try {
            localStorage.removeItem(ACTIVE_BOARD_STORAGE_KEY);
          } catch { /* ignore */ }
          setActiveBoard(null);
        }
      }

      await loadBoards();
    } catch (err) {
      console.error('[KPI] delete board:', err);
      setError(err instanceof Error ? err.message : 'Erro ao excluir quadro');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <MainLayout>
      <div className="flex flex-col min-h-0 flex-1 h-full bg-gradient-to-b from-slate-50 to-gray-100">
        <div className="shrink-0 border-b border-gray-200/80 bg-white/80 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#005B96]/10 flex items-center justify-center">
                <FiLayout className="w-5 h-5 text-[#005B96]" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900 tracking-tight">
                  KPI — Quadro Branco
                </h1>
                <p className="text-xs text-gray-500">
                  Widgets allowlisted montados pelo Companion · sem JS livre
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => loadBoards()}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-auto max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {boards.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {boards.map((b) => (
                <div
                  key={b.id}
                  className={`inline-flex items-center gap-1 rounded-lg border transition-colors ${
                    activeBoard?.id === b.id
                      ? 'bg-[#005B96] text-white border-[#005B96]'
                      : 'bg-white text-gray-600 border-gray-200'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => selectBoard(b.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-l-lg ${
                      activeBoard?.id === b.id
                        ? 'hover:bg-[#004a7a]'
                        : 'hover:border-[#005B96]/40 hover:text-[#005B96]'
                    }`}
                  >
                    {b.title}
                  </button>
                  <button
                    type="button"
                    title={`Excluir "${b.title}"`}
                    aria-label={`Excluir quadro ${b.title}`}
                    disabled={deletingId === b.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      void deleteBoard(b);
                    }}
                    className={`px-2 py-1.5 rounded-r-lg disabled:opacity-50 ${
                      activeBoard?.id === b.id
                        ? 'text-white/80 hover:bg-rose-600 hover:text-white'
                        : 'text-gray-400 hover:bg-rose-50 hover:text-rose-600'
                    }`}
                  >
                    <FiTrash2 className={`w-3.5 h-3.5 ${deletingId === b.id ? 'animate-pulse' : ''}`} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {authLoading || loading ? (
            <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-sm text-gray-500">
              Carregando quadro…
            </div>
          ) : error ? (
            <div className="bg-rose-50 border border-rose-100 rounded-xl p-6 flex items-start gap-3 text-rose-800">
              <FiAlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm">Não foi possível carregar o quadro</p>
                <p className="text-xs mt-1 opacity-80">{error}</p>
              </div>
            </div>
          ) : activeBoard ? (
            <KpiBoardRenderer
              boardId={activeBoard.id}
              title={activeBoard.title}
              spec={activeBoard.spec as KpiBoardSpec}
              revision={activeBoard.revision}
            />
          ) : (
            <div className="bg-white rounded-xl border border-dashed border-gray-200 p-10 text-center">
              <FiBarChart2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <h2 className="text-base font-semibold text-gray-800">Nenhum quadro ainda</h2>
              <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">
                Peça ao Companion: “monte um quadro KPI com minhas pendências e abra no KPI”
                ou “crie um quadro branco com métricas de férias e reembolso”.
              </p>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
