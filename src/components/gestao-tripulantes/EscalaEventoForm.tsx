'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { fetchWithToken } from '@/lib/tokenStorage';
import {
    DEFAULT_TIPOS_EVENTO_ESCALA,
    type GTTipoEventoEscala,
} from '@/lib/gestao-tripulantes/escala-tipos';

/**
 * Formulário compartilhado de evento de escala (R7).
 * Usado pelo painel flutuante/bottom-sheet da grade (GTManScheduleTab)
 * e pela edição inline na ficha do colaborador (HistoricoEmbarquesTab).
 *
 * Payload final (contrato POST/PUT /api/gestao-tripulantes/embarques):
 *   tipo, data_embarque, data_desembarque,
 *   local_embarque, local_desembarque (= embarcacao/destino),
 *   observacoes, exibir_dia_inicio,
 *   apagar_anteriores?, apagar_posteriores? (recorte da substituição same-type).
 */

export interface EscalaEventoFormValues {
    tipo: string;
    dataInicio: string; // YYYY-MM-DD (storage ISO; exibição dd/mm/aa fica por conta do input date)
    dataFim: string; // YYYY-MM-DD
    embarcacao: string; // persiste em local_desembarque (contrato atual da grade)
    localEmbarque: string;
    observacoes: string;
    exibirDiaInicio: boolean;
    /** Recorte: descarta o que sobra do evento sobreposto ANTES do período salvo. */
    apagarAnteriores?: boolean;
    /** Recorte: descarta o que sobra do evento sobreposto DEPOIS do período salvo. */
    apagarPosteriores?: boolean;
}

export function emptyEscalaEventoForm(tipo = 'normal'): EscalaEventoFormValues {
    return {
        tipo,
        dataInicio: '',
        dataFim: '',
        embarcacao: '',
        localEmbarque: '',
        observacoes: '',
        exibirDiaInicio: true,
        apagarAnteriores: false,
        apagarPosteriores: false,
    };
}

/** Datas ISO YYYY-MM-DD comparam lexicograficamente de forma determinística. */
export function isValidEscalaEventoForm(v: EscalaEventoFormValues): boolean {
    return Boolean(v.tipo && v.dataInicio && v.dataFim && v.dataFim >= v.dataInicio);
}

interface EscalaEventoFormProps {
    value: EscalaEventoFormValues;
    onChange: (next: EscalaEventoFormValues) => void;
    /** Lista já carregada pela grade; quando ausente o form busca /tipos-evento. */
    tipos?: GTTipoEventoEscala[];
    idPrefix?: string;
    disabled?: boolean;
}

const FIELD_CLASS =
    'w-full px-2.5 py-2 min-h-[44px] lg:py-1.5 lg:min-h-[34px] border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white disabled:opacity-60';
const LABEL_CLASS = 'block text-[11px] font-bold text-slate-700 mb-1';

export default function EscalaEventoForm({
    value,
    onChange,
    tipos,
    idPrefix = 'gt-escala-evento',
    disabled = false,
}: EscalaEventoFormProps) {
    const { t } = useI18n();
    const [tiposCarregados, setTiposCarregados] = useState<GTTipoEventoEscala[]>(
        () => DEFAULT_TIPOS_EVENTO_ESCALA.map((tipo, i) => ({ ...tipo, id: `default-${i}` }))
    );

    useEffect(() => {
        if (tipos && tipos.length > 0) return;
        let cancelled = false;
        (async () => {
            try {
                const res = await fetchWithToken('/api/gestao-tripulantes/tipos-evento');
                if (!res.ok) return;
                const result = await res.json();
                if (!cancelled && result?.success && Array.isArray(result.data) && result.data.length > 0) {
                    setTiposCarregados(result.data);
                }
            } catch {
                // fail-soft: mantém defaults
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [tipos]);

    const listaTipos = tipos && tipos.length > 0 ? tipos : tiposCarregados;
    const ativos = useMemo(() => listaTipos.filter((tipo) => tipo.ativo), [listaTipos]);

    const tipoSelecionado = useMemo(() => {
        const key = (value.tipo || '').toLowerCase();
        return ativos.find((tipo) => tipo.codigo.toLowerCase() === key);
    }, [ativos, value.tipo]);

    const diaInicioPreview = value.dataInicio
        ? `d.${parseInt(value.dataInicio.split('-')[2] || '0', 10)}`
        : 'd.X';

    const patch = (partial: Partial<EscalaEventoFormValues>) => onChange({ ...value, ...partial });

    return (
        <div className="flex flex-col gap-3">
            {/* Tipo + Embarcação/Destino */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                    <label htmlFor={`${idPrefix}-tipo`} className={LABEL_CLASS}>
                        {t('gtEscalaV2.tipoEvento', 'Tipo de Evento')}
                    </label>
                    <select
                        id={`${idPrefix}-tipo`}
                        value={value.tipo}
                        disabled={disabled}
                        onChange={(e) => patch({ tipo: e.target.value })}
                        className={FIELD_CLASS}
                    >
                        {ativos.map((tipo) => (
                            <option key={tipo.id} value={tipo.codigo}>
                                {tipo.label} ({tipo.display_code})
                            </option>
                        ))}
                    </select>
                    {tipoSelecionado && (
                        <div className="mt-1.5 flex items-center gap-1.5 min-w-0">
                            <span
                                className="inline-block min-w-[36px] text-center font-bold px-1.5 py-0.5 border border-black/80 rounded-sm text-[10px]"
                                style={{ backgroundColor: tipoSelecionado.bg_color, color: tipoSelecionado.text_color }}
                            >
                                {tipoSelecionado.display_code}
                            </span>
                            <span className="text-[10px] text-slate-500 truncate">{tipoSelecionado.label}</span>
                        </div>
                    )}
                </div>

                <div>
                    <label htmlFor={`${idPrefix}-embarcacao`} className={LABEL_CLASS}>
                        {t('gtEscalaV2.embarcacaoDestino', 'Embarcação / Destino')}
                    </label>
                    <input
                        id={`${idPrefix}-embarcacao`}
                        type="text"
                        value={value.embarcacao}
                        disabled={disabled}
                        onChange={(e) => patch({ embarcacao: e.target.value })}
                        placeholder={t('gtEscalaV2.embarcacaoPlaceholder', 'Ex: NORMAND...')}
                        className={FIELD_CLASS}
                    />
                </div>
            </div>

            {/* Datas */}
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label htmlFor={`${idPrefix}-inicio`} className={LABEL_CLASS}>
                        {t('gtEscalaV2.dataInicio', 'Data Início')}
                    </label>
                    <input
                        id={`${idPrefix}-inicio`}
                        type="date"
                        value={value.dataInicio}
                        disabled={disabled}
                        onChange={(e) => patch({ dataInicio: e.target.value })}
                        className={FIELD_CLASS}
                    />
                </div>
                <div>
                    <label htmlFor={`${idPrefix}-fim`} className={LABEL_CLASS}>
                        {t('gtEscalaV2.dataFim', 'Data Fim')}
                    </label>
                    <input
                        id={`${idPrefix}-fim`}
                        type="date"
                        value={value.dataFim}
                        disabled={disabled}
                        onChange={(e) => patch({ dataFim: e.target.value })}
                        className={FIELD_CLASS}
                    />
                </div>
            </div>

            {value.dataInicio && value.dataFim && value.dataFim < value.dataInicio && (
                <p className="text-[11px] font-semibold text-rose-600 -mt-1">
                    {t('gtEscalaV2.erroDataFim', 'Data de desembarque não pode ser anterior à data de embarque.')}
                </p>
            )}

            {/* Toggle Indicação do Dia de Início */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition-colors">
                <div className="pr-3 min-w-0">
                    <label htmlFor={`${idPrefix}-exibir-dia`} className="text-xs font-semibold text-slate-800 cursor-pointer block">
                        {t('gtEscalaV2.exibirDiaTitulo', 'Indicar dia de início na célula (d.X)')}
                    </label>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                        {t('gtEscalaV2.exibirDiaDescricao', { day: diaInicioPreview }, `Exibe o dia de início (${diaInicioPreview}) na célula da escala`)}
                    </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                    <input
                        id={`${idPrefix}-exibir-dia`}
                        type="checkbox"
                        checked={value.exibirDiaInicio}
                        disabled={disabled}
                        onChange={(e) => patch({ exibirDiaInicio: e.target.checked })}
                        className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
            </div>

            {/* Local de Embarque */}
            <div>
                <label htmlFor={`${idPrefix}-local`} className={LABEL_CLASS}>
                    {t('gtEscalaV2.localEmbarque', 'Local de Embarque (Origem)')}
                </label>
                <input
                    id={`${idPrefix}-local`}
                    type="text"
                    value={value.localEmbarque}
                    disabled={disabled}
                    onChange={(e) => patch({ localEmbarque: e.target.value })}
                    placeholder={t('gtEscalaV2.localEmbarquePlaceholder', 'Cidade, Aeroporto ou Base')}
                    className={FIELD_CLASS}
                />
            </div>

            {/* Observações */}
            <div>
                <label htmlFor={`${idPrefix}-obs`} className={LABEL_CLASS}>
                    {t('gtEscalaV2.observacoes', 'Observações / Comentários')}
                </label>
                <textarea
                    id={`${idPrefix}-obs`}
                    value={value.observacoes}
                    disabled={disabled}
                    onChange={(e) => patch({ observacoes: e.target.value })}
                    placeholder={t('gtEscalaV2.observacoesPlaceholder', 'Informações adicionais...')}
                    rows={2}
                    className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white resize-none disabled:opacity-60"
                />
            </div>
        </div>
    );
}

interface EscalaEventoFooterProps {
    editing: boolean;
    submitting?: boolean;
    disabled?: boolean;
    onDelete?: () => void;
    onCancel: () => void;
    onSave: () => void;
    saveLabel?: string;
}

/**
 * Rodapé de ações (Excluir / Cancelar / Salvar) com alvos de toque ≥44px
 * no mobile (`lg:` mantém o painel desktop compacto). O pai decide o sticky.
 */
export function EscalaEventoFooter({
    editing,
    submitting = false,
    disabled = false,
    onDelete,
    onCancel,
    onSave,
    saveLabel,
}: EscalaEventoFooterProps) {
    const { t } = useI18n();
    return (
        <div className="flex items-center justify-between gap-2 w-full">
            {editing && onDelete ? (
                <button
                    type="button"
                    onClick={onDelete}
                    disabled={submitting}
                    className="min-h-[44px] lg:min-h-0 px-3 py-2 lg:py-1.5 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 disabled:opacity-50 transition-colors shadow-sm"
                >
                    {t('gtEscalaV2.excluirEvento', 'Excluir Evento')}
                </button>
            ) : (
                <div />
            )}
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={submitting}
                    className="min-h-[44px] lg:min-h-0 px-3 py-2 lg:py-1.5 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-100 transition-colors"
                >
                    {t('gtEscalaV2.cancelar', 'Cancelar')}
                </button>
                <button
                    type="button"
                    onClick={onSave}
                    disabled={submitting || disabled}
                    className="min-h-[44px] lg:min-h-0 px-4 py-2 lg:py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm flex items-center gap-1.5"
                >
                    {submitting ? (
                        <>
                            <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            {t('gtEscalaV2.salvando', 'Salvando...')}
                        </>
                    ) : (
                        (saveLabel || t('gtEscalaV2.salvar', 'Salvar'))
                    )}
                </button>
            </div>
        </div>
    );
}

interface EscalaRecorteOptionsProps {
    value: EscalaEventoFormValues;
    onChange: (next: EscalaEventoFormValues) => void;
    disabled?: boolean;
    idPrefix?: string;
}

/** YYYY-MM-DD → dd/mm (hint curto do recorte; parse civil, sem fuso UTC). */
function formatYmdCurto(iso: string | undefined): string {
    if (!iso) return '';
    const parts = iso.slice(0, 10).split('-');
    if (parts.length !== 3) return iso;
    return `${parts[2]}/${parts[1]}`;
}

/**
 * Opções de recorte da substituição same-type (célula já marcada). Ambas vêm
 * DESMARCADAS a cada abertura do painel: por padrão o save preserva o que
 * sobra do evento sobreposto (head/tail); marcando, o que sobra é apagado.
 */
export function EscalaRecorteOptions({
    value,
    onChange,
    disabled = false,
    idPrefix = 'gt-escala-recorte',
}: EscalaRecorteOptionsProps) {
    const { t } = useI18n();
    const patch = (partial: Partial<EscalaEventoFormValues>) => onChange({ ...value, ...partial });

    const hintAnteriores = t(
        'gtEscalaV2.apagarAnterioresHint',
        { data: formatYmdCurto(value.dataInicio) || '—' },
        'Apaga marcações deste tripulante antes de {data}'
    );
    const hintPosteriores = t(
        'gtEscalaV2.apagarPosterioresHint',
        { data: formatYmdCurto(value.dataFim) || '—' },
        'Apaga marcações deste tripulante depois de {data}'
    );

    return (
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <p className="text-[11px] font-bold text-slate-700 mb-1.5">
                {t('gtEscalaV2.recorteTitulo', 'Apagar marcações ao salvar')}
            </p>
            <div className="space-y-1">
                <label
                    htmlFor={`${idPrefix}-anteriores`}
                    className="flex items-start gap-2 py-1.5 lg:py-0.5 cursor-pointer select-none"
                >
                    <input
                        id={`${idPrefix}-anteriores`}
                        type="checkbox"
                        checked={value.apagarAnteriores === true}
                        disabled={disabled}
                        onChange={(e) => patch({ apagarAnteriores: e.target.checked })}
                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-60"
                    />
                    <span className="min-w-0">
                        <span className="block text-xs font-semibold text-slate-800 leading-tight">
                            {t('gtEscalaV2.apagarAnteriores', 'Apagar marcações anteriores')}
                        </span>
                        <span className="block text-[11px] text-slate-500 mt-0.5">{hintAnteriores}</span>
                    </span>
                </label>
                <label
                    htmlFor={`${idPrefix}-posteriores`}
                    className="flex items-start gap-2 py-1.5 lg:py-0.5 cursor-pointer select-none"
                >
                    <input
                        id={`${idPrefix}-posteriores`}
                        type="checkbox"
                        checked={value.apagarPosteriores === true}
                        disabled={disabled}
                        onChange={(e) => patch({ apagarPosteriores: e.target.checked })}
                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-60"
                    />
                    <span className="min-w-0">
                        <span className="block text-xs font-semibold text-slate-800 leading-tight">
                            {t('gtEscalaV2.apagarPosteriores', 'Apagar marcações posteriores')}
                        </span>
                        <span className="block text-[11px] text-slate-500 mt-0.5">{hintPosteriores}</span>
                    </span>
                </label>
            </div>
        </div>
    );
}
