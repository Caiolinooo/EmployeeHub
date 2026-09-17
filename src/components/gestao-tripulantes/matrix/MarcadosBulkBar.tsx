'use client';

import React, { useState } from 'react';
import { FiCheck, FiLoader, FiX } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useI18n } from '@/contexts/I18nContext';
import { fetchWithToken } from '@/lib/tokenStorage';

interface MarcadosBulkBarProps {
  selectedIds: string[];
  onClear: () => void;
  /** Chamado após POST bem-sucedido (para refetch/listeners). */
  onMarcado?: (mesReferencia: string) => void;
}

/**
 * Mês default ancorado em BRT (-3h): mesReferencia é YYYY-MM civil do Brasil,
 * não o mês do browser do viajante.
 */
export function mesAtualBRT(): string {
  const brt = new Date(Date.now() - 3 * 60 * 60 * 1000);
  return `${brt.getUTCFullYear()}-${String(brt.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * R5 — MarcadosBulkBar: aparece quando há colaboradores selecionados na Matriz.
 * POST /api/gestao-tripulantes/fechamento/marcacoes (batch upsert, itens marcado=true).
 * A lista do mês NÃO é confirmada aqui (listaConfirmada fica a cargo do fluxo do
 * fechamento); enquanto não confirmada, o comportamento legado é mantido no server.
 */
export default function MarcadosBulkBar({ selectedIds, onClear, onMarcado }: MarcadosBulkBarProps) {
  const { t } = useI18n();
  const [mes, setMes] = useState<string>(() => mesAtualBRT());
  const [enviando, setEnviando] = useState(false);

  const marcar = async () => {
    if (enviando || !mes || selectedIds.length === 0) return;
    setEnviando(true);
    try {
      const res = await fetchWithToken('/api/gestao-tripulantes/fechamento/marcacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mesReferencia: mes,
          itens: selectedIds.map(colaboradorId => ({ colaboradorId, marcado: true })),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error || `HTTP ${res.status}`);
      }
      toast.success(t('gtMatrizV2.marcados.sucesso', { count: selectedIds.length, mes }));
      onMarcado?.(mes);
      onClear();
    } catch (err) {
      console.error('[MarcadosBulkBar] erro ao marcar:', err);
      toast.error(t('gtMatrizV2.marcados.erro'));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div
      data-testid="gt-marcados-bulk-bar"
      className="sticky top-0 z-20 shrink-0 flex flex-wrap items-center gap-2 sm:gap-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl px-3 sm:px-4 py-2.5 shadow-sm"
    >
      <span className="text-xs sm:text-sm font-bold whitespace-nowrap">
        {t('gtMatrizV2.marcados.selecionados', { count: selectedIds.length })}
      </span>

      <label className="flex items-center gap-1.5 text-xs sm:text-sm">
        <span className="font-medium hidden sm:inline">{t('gtMatrizV2.marcados.mesLabel')}</span>
        <input
          type="month"
          value={mes}
          onChange={e => setMes(e.target.value)}
          aria-label={t('gtMatrizV2.marcados.mesLabel')}
          className="px-2 py-1.5 border border-blue-200 rounded-lg text-xs sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[36px]"
        />
      </label>

      <button
        type="button"
        onClick={marcar}
        disabled={enviando || !mes}
        className="px-3 sm:px-4 py-2 bg-blue-600 text-white text-xs sm:text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1.5 min-h-[36px] transition-colors"
      >
        {enviando ? <FiLoader className="w-4 h-4 animate-spin" /> : <FiCheck className="w-4 h-4" />}
        {enviando ? t('gtMatrizV2.marcados.marcando') : t('gtMatrizV2.marcados.marcar')}
      </button>

      <button
        type="button"
        onClick={onClear}
        className="px-3 py-2 bg-white border border-gray-200 text-gray-600 text-xs sm:text-sm font-medium rounded-lg hover:bg-gray-50 flex items-center gap-1.5 min-h-[36px] transition-colors"
      >
        <FiX className="w-4 h-4" />
        {t('gtMatrizV2.marcados.limpar')}
      </button>
    </div>
  );
}
