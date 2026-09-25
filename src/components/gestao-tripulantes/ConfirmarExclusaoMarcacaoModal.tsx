'use client';

import React from 'react';
import { FiAlertTriangle } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';
import { useEscapeToClose } from '@/hooks/useEscapeToClose';

/**
 * Modal de confirmação de exclusão de marcação de escala (grade + ficha).
 * Substitui o window.confirm: corpo mostra tripulante + trecho a apagar e,
 * quando o evento extrapola o trecho selecionado (recorte parcial), checkbox
 * DESMARCADO para apagar o evento completo. Na ficha o escopo é sempre o
 * evento inteiro (sem checkbox).
 */

interface ConfirmarExclusaoMarcacaoModalProps {
    open: boolean;
    tripulanteNome?: string;
    /** Trecho selecionado já clipado ao evento — YYYY-MM-DD. */
    trechoInicio: string | null;
    trechoFim: string | null;
    /** Evento completo (label do checkbox) — fim null = linha aberta. */
    eventoInicio: string | null;
    eventoFim: string | null;
    escopo: 'dia' | 'semana' | 'evento';
    /** Evento extrapola o trecho → exibe o checkbox "Apagar evento completo". */
    podeApagarCompleto?: boolean;
    apagarCompleto?: boolean;
    onApagarCompletoChange?: (v: boolean) => void;
    submitting?: boolean;
    onConfirm: () => void;
    onCancelar: () => void;
}

/** YYYY-MM-DD → dd/mm/aa (parse civil, sem fuso UTC). */
function formatarDiaCurto(iso: string | null | undefined): string {
    if (!iso) return '—';
    const parts = iso.slice(0, 10).split('-');
    if (parts.length !== 3) return iso;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

/** Dias entre duas datas civis, inclusive (10/09–10/09 = 1 dia). */
function contarDias(inicio: string | null | undefined, fim: string | null | undefined): number | null {
    if (!inicio || !fim) return null;
    const [yi, mi, di] = inicio.slice(0, 10).split('-').map(Number);
    const [yf, mf, df] = fim.slice(0, 10).split('-').map(Number);
    if (!yi || !mi || !di || !yf || !mf || !df) return null;
    const a = Date.UTC(yi, mi - 1, di);
    const b = Date.UTC(yf, mf - 1, df);
    if (b < a) return null;
    return Math.round((b - a) / 86400000) + 1;
}

export default function ConfirmarExclusaoMarcacaoModal({
    open,
    tripulanteNome,
    trechoInicio,
    trechoFim,
    eventoInicio,
    eventoFim,
    escopo,
    podeApagarCompleto = false,
    apagarCompleto = false,
    onApagarCompletoChange,
    submitting = false,
    onConfirm,
    onCancelar,
}: ConfirmarExclusaoMarcacaoModalProps) {
    const { t } = useI18n();
    useEscapeToClose(open, onCancelar);

    if (!open) return null;

    const trechoUnicoDia = trechoInicio !== null && trechoInicio === trechoFim;
    const trechoLabel = trechoUnicoDia
        ? formatarDiaCurto(trechoInicio)
        : `${formatarDiaCurto(trechoInicio)} – ${formatarDiaCurto(trechoFim)}`;

    const diasEvento = contarDias(eventoInicio, eventoFim);
    const eventoLabel = diasEvento !== null
        ? t(
            'gtEscalaV2.apagarEventoCompleto',
            { periodo: `${formatarDiaCurto(eventoInicio)}–${formatarDiaCurto(eventoFim)}`, dias: diasEvento },
            'Apagar evento completo ({periodo}, {dias} dias)'
        )
        : t(
            'gtEscalaV2.apagarEventoCompletoAberto',
            { periodo: formatarDiaCurto(eventoInicio) },
            'Apagar evento completo (desde {periodo}, em aberto)'
        );

    const escopoLabel = (() => {
        switch (escopo) {
            case 'dia':
                return t('gtEscalaV2.excluirMarcacaoEscopoDia', 'Escopo: o dia clicado');
            case 'semana':
                return t('gtEscalaV2.excluirMarcacaoEscopoSemana', 'Escopo: semana (sáb–sex) da coluna clicada');
            default:
                return t('gtEscalaV2.excluirMarcacaoEscopoEvento', 'Escopo: evento completo');
        }
    })();

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/50"
                onClick={submitting ? undefined : onCancelar}
                aria-hidden="true"
            />
            <div
                role="dialog"
                aria-modal="true"
                aria-label={t('gtEscalaV2.excluirMarcacaoTitulo', 'Excluir marcação')}
                data-modal-panel=""
                className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
            >
                <div className="flex shrink-0 items-center justify-between border-b border-red-100 bg-red-50 px-5 py-3">
                    <div className="min-w-0">
                        <h3 className="text-base font-bold text-red-900">
                            {t('gtEscalaV2.excluirMarcacaoTitulo', 'Excluir marcação')}
                        </h3>
                        {tripulanteNome && (
                            <p className="text-xs text-red-700 truncate uppercase">{tripulanteNome}</p>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={onCancelar}
                        data-modal-close=""
                        disabled={submitting}
                        className="rounded-lg p-1.5 hover:bg-red-100 disabled:opacity-50"
                        aria-label={t('gtEscalaV2.fechar', 'Fechar')}
                    >
                        <span className="text-base font-bold text-red-800">&times;</span>
                    </button>
                </div>

                <div className="p-5 space-y-3">
                    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                        <FiAlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        <p>{t('gtEscalaV2.excluirReversivelNota', 'A exclusão fica registrada no histórico e pode ser revertida.')}</p>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-xs">
                        <p className="font-bold text-slate-700 uppercase text-[10px] tracking-wider mb-1">
                            {t('gtEscalaV2.excluirMarcacaoTrecho', 'Trecho a apagar')}
                        </p>
                        <p className="text-sm font-semibold text-slate-900">{trechoLabel}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{escopoLabel}</p>
                    </div>

                    {podeApagarCompleto && onApagarCompletoChange && (
                        <label
                            htmlFor="gt-confirmar-exclusao-completo"
                            className="flex items-start gap-2 py-1 cursor-pointer select-none"
                        >
                            <input
                                id="gt-confirmar-exclusao-completo"
                                type="checkbox"
                                checked={apagarCompleto}
                                disabled={submitting}
                                onChange={(e) => onApagarCompletoChange(e.target.checked)}
                                className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-rose-600 focus:ring-rose-500 disabled:opacity-60"
                            />
                            <span className="text-xs font-semibold text-slate-800 leading-snug">
                                {eventoLabel}
                            </span>
                        </label>
                    )}

                    {podeApagarCompleto && !apagarCompleto && (
                        <p className="text-[11px] text-slate-500">
                            {t('gtEscalaV2.excluirPreservarNota', 'As marcações fora do trecho selecionado são preservadas.')}
                        </p>
                    )}
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
                    <button
                        type="button"
                        onClick={onCancelar}
                        disabled={submitting}
                        className="min-h-[44px] px-3 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-100 disabled:opacity-50 transition-colors"
                    >
                        {t('gtEscalaV2.cancelar', 'Cancelar')}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={submitting}
                        className="min-h-[44px] px-4 py-2 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 disabled:opacity-50 transition-colors shadow-sm flex items-center gap-1.5"
                    >
                        {submitting && (
                            <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        )}
                        {t('gtEscalaV2.excluirCurto', 'Excluir')}
                    </button>
                </div>
            </div>
        </div>
    );
}
