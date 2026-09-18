'use client';

import React from 'react';
import { FiAlertTriangle, FiX } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';

/**
 * Confirmação de ação destrutiva (padrão do repo: modal dedicado, sem window.confirm).
 * Overlay `z-[60]` — acima dos modais fullscreen do módulo (z-50).
 */
interface ConfirmacaoModalProps {
  isOpen: boolean;
  titulo: string;
  descricao: string;
  confirmarLabel: string;
  busy?: boolean;
  perigoso?: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}

export default function ConfirmacaoModal({
  isOpen,
  titulo,
  descricao,
  confirmarLabel,
  busy = false,
  perigoso = false,
  onConfirmar,
  onCancelar,
}: ConfirmacaoModalProps) {
  const { t } = useI18n();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div
        className="w-full max-w-md rounded-2xl border border-gray-200 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-150"
        role="alertdialog"
        aria-modal="true"
        aria-label={titulo}
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-sm ${
                perigoso ? 'bg-red-600' : 'bg-amber-500'
              }`}
            >
              <FiAlertTriangle className="h-4 w-4" />
            </span>
            <h3 className="truncate text-sm font-bold text-gray-900 sm:text-base">{titulo}</h3>
          </div>
          <button
            type="button"
            onClick={onCancelar}
            disabled={busy}
            className="min-h-[44px] min-w-[44px] rounded-lg p-2 text-gray-400 transition hover:bg-gray-200 hover:text-gray-700 disabled:opacity-50"
            aria-label={t('indicadores.acoes.fechar', 'Fechar')}
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 py-4 text-sm text-gray-600">{descricao}</div>

        <div className="flex justify-end gap-2 border-t border-gray-200 bg-gray-50 px-5 py-3">
          <button
            type="button"
            onClick={onCancelar}
            disabled={busy}
            className="min-h-[44px] rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:opacity-50"
          >
            {t('indicadores.acoes.cancelar', 'Cancelar')}
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            disabled={busy}
            className={`inline-flex min-h-[44px] items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition disabled:opacity-50 ${
              perigoso ? 'bg-red-600 hover:bg-red-700' : 'bg-abz-blue hover:bg-blue-800'
            }`}
          >
            {confirmarLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
