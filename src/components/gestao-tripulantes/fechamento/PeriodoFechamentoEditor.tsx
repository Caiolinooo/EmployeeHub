'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FiCalendar, FiCheck, FiSave, FiRefreshCw, FiAlertTriangle } from 'react-icons/fi';
import { fetchWithToken } from '@/lib/tokenStorage';
import { useI18n } from '@/contexts/I18nContext';
import ScheduleDateFilterInput from '@/components/gestao-tripulantes/ScheduleDateFilterInput';
import { formatarDataBR } from './fechamentoV2';

interface PeriodoFechamentoEditorProps {
  mesReferencia: string;
  /** isFechamentoRole — só quem pode editar vê os inputs habilitados. */
  podeEditar: boolean;
  onPeriodoChange?: (info: {
    dataInicio: string | null;
    dataFim: string | null;
    fonte: string;
  }) => void;
  /** Tick externo (live probe) — refetch quando muda (mantém a badge da lista sincronizada). */
  refreshTick?: number;
}

/** Shape real de GET/PUT /fechamento/periodo: `{ success, periodo: {...} }` (camelCase). */
interface PeriodoApiResponse {
  success?: boolean;
  periodo?: {
    mesReferencia?: string;
    dataInicio?: string | null;
    dataFim?: string | null;
    listaConfirmada?: boolean;
    definidoPorNome?: string | null;
  } | null;
  error?: string;
}

function sliceYmd(value: string | null | undefined): string {
  return String(value || '').slice(0, 10);
}

/**
 * R2: período manual por mês (dd/mm/aa), persistido em gt_fechamento_periodos.
 * GET/PUT /api/gestao-tripulantes/fechamento/periodo?mesReferencia=YYYY-MM.
 * Sem registro → fonte = mês civil. O commit de data é só com YYYY-MM-DD completo
 * (mesmo gate do ScheduleDateFilterInput da grade).
 */
export default function PeriodoFechamentoEditor({
  mesReferencia,
  podeEditar,
  onPeriodoChange,
  refreshTick = 0,
}: PeriodoFechamentoEditorProps) {
  const { t } = useI18n();
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [listaConfirmada, setListaConfirmada] = useState(false);
  const [fonte, setFonte] = useState<'config' | 'mes'>('mes');
  const [definidoPorNome, setDefinidoPorNome] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const seqRef = useRef(0);
  const lastTickRef = useRef(refreshTick);

  const carregar = useCallback(async () => {
    if (!mesReferencia) return;
    const seq = ++seqRef.current;
    setIsLoading(true);
    setErrorMsg(null);
    setOkMsg(null);
    try {
      const res = await fetchWithToken(
        `/api/gestao-tripulantes/fechamento/periodo?mesReferencia=${encodeURIComponent(mesReferencia)}`,
      );
      const json = (await res.json().catch(() => ({}))) as PeriodoApiResponse;
      if (seq !== seqRef.current) return;
      if (!res.ok) {
        throw new Error(json.error || t('gtFechV2.periodo.erroCarregar', 'Erro ao carregar período.'));
      }
      const row = json?.periodo || null;
      const inicio = sliceYmd(row?.dataInicio);
      const fim = sliceYmd(row?.dataFim);
      setDataInicio(inicio);
      setDataFim(fim);
      setListaConfirmada(Boolean(row?.listaConfirmada));
      setFonte(inicio && fim ? 'config' : 'mes');
      setDefinidoPorNome(row?.definidoPorNome || null);
      onPeriodoChange?.({
        dataInicio: inicio || null,
        dataFim: fim || null,
        fonte: inicio && fim ? 'config' : 'mes',
      });
    } catch (err) {
      if (seq !== seqRef.current) return;
      setFonte('mes');
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      if (seq === seqRef.current) setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesReferencia]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // R3: refetch quando o probe de mudança disparar (ex.: outro aprovador
  // confirmou a lista de marcados — a badge do editor não pode ficar stale).
  useEffect(() => {
    if (refreshTick !== lastTickRef.current) {
      lastTickRef.current = refreshTick;
      carregar();
    }
  }, [refreshTick, carregar]);

  const handleSalvar = async () => {
    setErrorMsg(null);
    setOkMsg(null);
    if (!dataInicio || !dataFim) {
      setErrorMsg(t('gtFechV2.periodo.obrigatorio', 'Informe data início e data fim.'));
      return;
    }
    if (dataFim < dataInicio) {
      setErrorMsg(t('gtFechV2.periodo.erroRange', 'Data fim não pode ser anterior à data início.'));
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetchWithToken('/api/gestao-tripulantes/fechamento/periodo', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mesReferencia,
          dataInicio,
          dataFim,
          // listaConfirmada NÃO vai no body: flag ausente = server mantém o
          // valor atual (R5). Confirmar/reabrir é fluxo do MarcadosFechamentoPanel;
          // enviar o estado local aqui poderia desconfirmar uma lista confirmada
          // por outra sessão (stale state).
        }),
      });
      const json = (await res.json().catch(() => ({}))) as PeriodoApiResponse;
      if (!res.ok) {
        throw new Error(json.error || t('gtFechV2.periodo.erroSalvar', 'Erro ao salvar período.'));
      }
      setFonte('config');
      const salvo = json?.periodo || null;
      if (salvo?.definidoPorNome) setDefinidoPorNome(salvo.definidoPorNome);
      // Re-sincroniza a badge com a verdade do banco (resposta do upsert).
      if (salvo && typeof salvo.listaConfirmada === 'boolean') {
        setListaConfirmada(salvo.listaConfirmada);
      }
      setOkMsg(t('gtFechV2.periodo.salvo', 'Período salvo. Preview, aprovação e download já usam estas datas.'));
      onPeriodoChange?.({ dataInicio, dataFim, fonte: 'config' });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  };

  const fonteLabel =
    fonte === 'config'
      ? t('gtFechV2.periodo.fonteManual', 'Período manual')
      : t('gtFechV2.periodo.fonteMes', 'Mês civil');

  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-gray-900">
          <FiCalendar className="text-abz-blue" />
          {t('gtFechV2.periodo.titulo', 'Período de Apuração do Fechamento')}
          <span
            className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
              fonte === 'config' ? 'bg-abz-blue text-white' : 'bg-slate-200 text-slate-700'
            }`}
          >
            {fonteLabel}
          </span>
        </h4>
        <button
          type="button"
          onClick={carregar}
          disabled={isLoading || isSaving}
          className="p-2 text-gray-500 hover:text-gray-900 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-50"
          title={t('gtFechV2.toolbar.recarregar', 'Recarregar')}
        >
          <FiRefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <p className="text-[11px] text-gray-600">
        {t(
          'gtFechV2.periodo.dica',
          'O período definido aqui é usado por GET/aprovar/download do relatório do mês. Datas explícitas do filtro ainda têm prioridade.',
        )}
        {fonte === 'mes' && dataInicio === '' && (
          <>
            {' '}
            <strong className="font-semibold text-gray-800">
              {t('gtFechV2.periodo.padraoMes', 'Usando o mês civil completo como padrão.')}
            </strong>
          </>
        )}
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-[11px] font-bold text-gray-700">
            {t('gtFechV2.periodo.dataInicio', 'Data início (dd/mm/aaaa)')}
          </label>
          <ScheduleDateFilterInput
            value={dataInicio}
            onCommit={(v) => setDataInicio(v)}
            aria-label={t('gtFechV2.periodo.dataInicio', 'Data início')}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-900 focus:ring-2 focus:ring-abz-blue disabled:bg-gray-100 disabled:text-gray-400"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-bold text-gray-700">
            {t('gtFechV2.periodo.dataFim', 'Data fim (dd/mm/aaaa)')}
          </label>
          <ScheduleDateFilterInput
            value={dataFim}
            onCommit={(v) => setDataFim(v)}
            aria-label={t('gtFechV2.periodo.dataFim', 'Data fim')}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-900 focus:ring-2 focus:ring-abz-blue disabled:bg-gray-100 disabled:text-gray-400"
          />
        </div>
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={handleSalvar}
            disabled={!podeEditar || isSaving || isLoading}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-abz-blue px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-blue-800 disabled:opacity-50"
            title={
              podeEditar
                ? undefined
                : t('gtFechV2.marcados.semPermissao', 'Apenas gestores de fechamento podem editar.')
            }
          >
            {isSaving ? (
              <FiRefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FiSave className="w-3.5 h-3.5" />
            )}
            {t('gtFechV2.periodo.salvar', 'Salvar período')}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
        <span>
          {dataInicio && dataFim
            ? `${formatarDataBR(dataInicio)} → ${formatarDataBR(dataFim)}`
            : t('gtFechV2.periodo.semPeriodo', 'Sem período manual definido.')}
        </span>
        {definidoPorNome && (
          <span>
            · {t('gtFechV2.periodo.definidoPor', 'definido por')} <strong>{definidoPorNome}</strong>
          </span>
        )}
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${
            listaConfirmada ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
          }`}
        >
          <FiCheck className="w-3 h-3" />
          {listaConfirmada
            ? t('gtFechV2.marcados.confirmadaBadge', 'Lista de marcados confirmada')
            : t('gtFechV2.marcados.abertaBadge', 'Lista de marcados aberta')}
        </span>
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
          <FiAlertTriangle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {okMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-800">
          <FiCheck className="h-4 w-4 shrink-0" />
          <span>{okMsg}</span>
        </div>
      )}
    </div>
  );
}
