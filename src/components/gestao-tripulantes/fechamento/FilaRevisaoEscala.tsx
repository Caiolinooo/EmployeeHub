'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FiAlertTriangle,
  FiArrowLeft,
  FiArrowRight,
  FiCheckSquare,
  FiRefreshCw,
  FiRotateCcw,
  FiXCircle,
} from 'react-icons/fi';
import { fetchWithToken } from '@/lib/tokenStorage';
import { useI18n } from '@/contexts/I18nContext';
import {
  EDICAO_DIFF_FIELDS,
  formatarDataBR,
  type EscalaEdicaoItem,
} from './fechamentoV2';

interface FilaRevisaoEscalaProps {
  /** Client pre-gate (isFechamentoRole) — o servidor reforça de novo. */
  podeRevisar: boolean;
  onEdicoesChanged?: () => void;
  refreshTick?: number;
}

interface FilaApiResponse {
  success?: boolean;
  /** Shape real de GET /escala-edicoes: `{ success, page, pageSize, total, rows }`. */
  rows?: EscalaEdicaoItem[];
  data?: EscalaEdicaoItem[];
  items?: EscalaEdicaoItem[];
  page?: number;
  pageSize?: number;
  totalPages?: number;
  total_pages?: number;
  total?: number;
  error?: string;
}

type ModoAcao = 'rejeitar' | 'reverter' | null;

const STATUS_FILTRO = ['aplicada', 'revertida', 'rejeitada'] as const;

/** Nome do tripulante da edição (API devolve `colaboradorNome`; fallback legado snake_case). */
function nomeColaborador(it: EscalaEdicaoItem): string {
  return it.colaboradorNome || it.colaborador_nome || '';
}

/**
 * R7 ("tudo imediato + fila de revisão"): toda edição de escala (POST/PUT/DELETE
 * /embarques) aplica na hora e grava uma linha de auditoria em gt_escala_edicoes.
 * Aqui o aprovador revisa a fila: REJEITAR → rollback automático; REVERTER → rollback
 * manual de qualquer edição aplicada. Ação exige motivo e é auditada.
 */
export default function FilaRevisaoEscala({
  podeRevisar,
  onEdicoesChanged,
  refreshTick = 0,
}: FilaRevisaoEscalaProps) {
  const { t } = useI18n();
  const [itens, setItens] = useState<EscalaEdicaoItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState<number | null>(null);
  const [statusFiltro, setStatusFiltro] = useState<string>('aplicada');
  const [busca, setBusca] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [acaoAberta, setAcaoAberta] = useState<{ id: string; modo: Exclude<ModoAcao, null> } | null>(null);
  const [motivo, setMotivo] = useState('');
  const [isProcessando, setIsProcessando] = useState(false);
  const seqRef = useRef(0);
  const lastTickRef = useRef(refreshTick);

  const carregar = useCallback(
    async (targetPage = page) => {
      const seq = ++seqRef.current;
      setIsLoading(true);
      setErrorMsg(null);
      try {
        const params = new URLSearchParams();
        if (statusFiltro) params.set('status', statusFiltro);
        params.set('page', String(targetPage));
        const res = await fetchWithToken(`/api/gestao-tripulantes/escala-edicoes?${params.toString()}`);
        const json = (await res.json().catch(() => ({}))) as FilaApiResponse;
        if (seq !== seqRef.current) return;
        if (!res.ok) {
          throw new Error(json.error || t('gtFechV2.fila.erroCarregar', 'Erro ao carregar fila de edições.'));
        }
        const rows = (
          Array.isArray(json.rows)
            ? json.rows
            : Array.isArray(json.data)
              ? json.data
              : Array.isArray(json.items)
                ? json.items
                : []
        ) as EscalaEdicaoItem[];
        setItens(rows);
        setPage(typeof json.page === 'number' ? json.page : targetPage);
        const totalNum = typeof json.total === 'number' ? json.total : null;
        setTotal(totalNum);
        const pageSize = typeof json.pageSize === 'number' && json.pageSize > 0 ? json.pageSize : null;
        let tp: number | null = null;
        if (typeof json.totalPages === 'number') tp = json.totalPages;
        else if (typeof json.total_pages === 'number') tp = json.total_pages;
        else if (totalNum !== null && pageSize) tp = Math.max(1, Math.ceil(totalNum / pageSize));
        setTotalPages(tp ?? 1);
      } catch (err) {
        if (seq !== seqRef.current) return;
        setItens([]);
        setErrorMsg(err instanceof Error ? err.message : String(err));
      } finally {
        if (seq === seqRef.current) setIsLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [statusFiltro, page],
  );

  useEffect(() => {
    carregar(1);
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFiltro]);

  useEffect(() => {
    if (refreshTick !== lastTickRef.current) {
      lastTickRef.current = refreshTick;
      carregar(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTick]);

  const itensFiltrados = (() => {
    const q = busca.trim().toLowerCase();
    if (!q) return itens;
    return itens.filter(
      (it) =>
        nomeColaborador(it).toLowerCase().includes(q) ||
        ((it.dados_novos?.nome as string) || '').toLowerCase().includes(q) ||
        ((it.dados_anteriores?.nome as string) || '').toLowerCase().includes(q) ||
        (it.ator_nome || '').toLowerCase().includes(q),
    );
  })();

  const executarAcao = async () => {
    if (!acaoAberta) return;
    const m = motivo.trim();
    if (!m) {
      setErrorMsg(t('gtFechV2.fila.motivoObrigatorio', 'Motivo é obrigatório.'));
      return;
    }
    setIsProcessando(true);
    setErrorMsg(null);
    setOkMsg(null);
    try {
      const endpoint =
        acaoAberta.modo === 'rejeitar'
          ? `/api/gestao-tripulantes/escala-edicoes/${acaoAberta.id}/rejeitar`
          : `/api/gestao-tripulantes/escala-edicoes/${acaoAberta.id}/reverter`;
      const res = await fetchWithToken(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo: m }),
      });
      const json = (await res.json().catch(() => ({}))) as FilaApiResponse;
      if (!res.ok) {
        throw new Error(
          json.error ||
            t('gtFechV2.fila.erroAcao', 'Erro ao processar a revisão.'),
        );
      }
      setOkMsg(
        acaoAberta.modo === 'rejeitar'
          ? t('gtFechV2.fila.rejeicaoOk', 'Edição rejeitada: estado anterior da escala restaurado.')
          : t('gtFechV2.fila.reversaoOk', 'Edição revertida: estado anterior da escala restaurado.'),
      );
      setAcaoAberta(null);
      setMotivo('');
      await carregar();
      onEdicoesChanged?.();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setIsProcessando(false);
    }
  };

  if (!podeRevisar) return null;

  const valorDiff = (obj: Record<string, unknown> | null | undefined, campo: string): string => {
    const raw = obj?.[campo];
    if (raw === undefined || raw === null || raw === '') return '—';
    if (campo.startsWith('data_')) return formatarDataBR(String(raw));
    return String(raw);
  };

  const operacaoLabel = (op: string): string => {
    switch (op) {
      case 'create': return t('gtFechV2.fila.opCreate', 'Criação');
      case 'update': return t('gtFechV2.fila.opUpdate', 'Alteração');
      case 'delete': return t('gtFechV2.fila.opDelete', 'Exclusão');
      case 'restore': return t('gtFechV2.fila.opRestore', 'Restauração');
      case 'rejeicao': return t('gtFechV2.fila.opRejeicao', 'Rejeição');
      case 'reversao': return t('gtFechV2.fila.opReversao', 'Reversão');
      default: return op;
    }
  };

  const statusLabel = (s: string): string => {
    switch (s) {
      case 'aplicada': return t('gtFechV2.fila.statusAplicada', 'Aplicada');
      case 'revertida': return t('gtFechV2.fila.statusRevertida', 'Revertida');
      case 'rejeitada': return t('gtFechV2.fila.statusRejeitada', 'Rejeitada');
      default: return s;
    }
  };

  const statusClass = (s: string): string => {
    switch (s) {
      case 'aplicada': return 'bg-blue-100 text-blue-800';
      case 'revertida': return 'bg-slate-200 text-slate-700';
      case 'rejeitada': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const operacaoClass = (op: string): string => {
    switch (op) {
      case 'create': return 'bg-emerald-100 text-emerald-800';
      case 'update': return 'bg-amber-100 text-amber-900';
      case 'delete': return 'bg-red-100 text-red-800';
      case 'restore': return 'bg-sky-100 text-sky-800';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const diffCampos = (it: EscalaEdicaoItem): string[] => {
    const chaves = new Set<string>(EDICAO_DIFF_FIELDS);
    // Campos extras presentes em qualquer um dos lados também entram.
    Object.keys(it.dados_anteriores || {}).forEach((k) => chaves.add(k));
    Object.keys(it.dados_novos || {}).forEach((k) => chaves.add(k));
    return Array.from(chaves).filter((k) => k !== 'id' && k !== 'deleted_at');
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3" data-testid="fila-revisao-escala">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-bold text-gray-900">
            <FiCheckSquare className="text-abz-blue" />
            {t('gtFechV2.fila.titulo', 'Fila de Revisão de Edições de Escala')}
            {total !== null && (
              <span className="rounded-full bg-abz-blue px-2 py-0.5 text-[10px] font-bold text-white">
                {total}
              </span>
            )}
          </h3>
          <p className="mt-0.5 text-[11px] text-gray-500">
            {t(
              'gtFechV2.fila.descricao',
              'Toda edição de escala aplica na hora e cai aqui para auditoria. Rejeitar/Reverter restaura o estado anterior (rollback auditado).',
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFiltro}
            onChange={(e) => setStatusFiltro(e.target.value)}
            className="min-h-[44px] rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-xs font-semibold text-gray-700"
          >
            {STATUS_FILTRO.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
            <option value="">{t('gtFechV2.fila.todosStatus', 'Todos os status')}</option>
          </select>
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={t('gtFechV2.fila.buscaPlaceholder', 'Filtrar por tripulante ou autor…')}
            className="min-h-[44px] w-48 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs focus:ring-2 focus:ring-abz-blue"
          />
          <button
            type="button"
            onClick={() => carregar()}
            disabled={isLoading}
            className="min-h-[44px] rounded-lg border border-gray-300 bg-white p-2 text-gray-500 hover:text-gray-900 disabled:opacity-50"
            title={t('gtFechV2.toolbar.recarregar', 'Recarregar')}
          >
            <FiRefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
          <FiAlertTriangle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {okMsg && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-800">
          {okMsg}
        </div>
      )}

      <div className="space-y-2">
        {isLoading && itens.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-xs text-gray-500">
            <FiRefreshCw className="mr-1 inline h-3.5 w-3.5 animate-spin text-abz-blue" />
            {t('gtFechV2.fila.carregando', 'Carregando edições…')}
          </div>
        ) : itensFiltrados.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-xs text-gray-500">
            {t('gtFechV2.fila.vazio', 'Nenhuma edição nesta fila.')}
          </div>
        ) : (
          itensFiltrados.map((it) => {
            const campos = diffCampos(it);
            const podeAgir = podeRevisar && it.status === 'aplicada';
            const acaoAtual = acaoAberta && acaoAberta.id === it.id ? acaoAberta : null;
            return (
              <div
                key={it.id}
                className={`rounded-lg border p-3 text-xs ${
                  it.status === 'aplicada' ? 'border-gray-200 bg-white' : 'border-slate-200 bg-slate-50/60'
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${operacaoClass(String(it.operacao))}`}>
                    {operacaoLabel(String(it.operacao))}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusClass(String(it.status))}`}>
                    {statusLabel(String(it.status))}
                  </span>
                  <span className="font-bold text-gray-900">
                    {nomeColaborador(it)
                      || (it.dados_novos?.nome as string)
                      || (it.dados_anteriores?.nome as string)
                      || t('gtFechV2.fila.semColaborador', '—')}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    {formatarDataBR(it.created_at, { comHora: true })}
                  </span>
                  <span className="ml-auto text-[11px] text-gray-500">
                    {t('gtFechV2.fila.ator', 'por')} <strong className="text-gray-700">{it.ator_nome || '—'}</strong>
                    {it.ator_role ? ` · ${it.ator_role}` : ''}
                  </span>
                </div>

                {campos.length > 0 && (
                  <div className="mt-2 overflow-x-auto rounded border border-gray-100 bg-gray-50/60 p-2">
                    <table className="w-full min-w-[420px] text-left text-[11px]">
                      <thead className="text-gray-500">
                        <tr>
                          <th className="py-0.5 pr-3 font-semibold">{t('gtFechV2.fila.campo', 'Campo')}</th>
                          <th className="py-0.5 pr-3 font-semibold">{t('gtFechV2.fila.anterior', 'Antes')}</th>
                          <th className="py-0.5 font-semibold">{t('gtFechV2.fila.depois', 'Depois')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {campos.map((campo) => {
                          const antes = valorDiff(it.dados_anteriores, campo);
                          const depois = valorDiff(it.dados_novos, campo);
                          if (antes === depois) return null;
                          return (
                            <tr key={campo} className="border-t border-gray-100">
                              <td className="py-1 pr-3 font-mono text-[10px] font-semibold text-gray-500">{campo}</td>
                              <td className="py-1 pr-3 text-gray-600 line-through decoration-red-300">{antes}</td>
                              <td className="py-1 font-semibold text-gray-900">{depois}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {it.motivo && (
                  <div className="mt-2 text-[11px] text-gray-600">
                    <strong>{t('gtFechV2.fila.motivo', 'Motivo')}:</strong> {it.motivo}
                  </div>
                )}
                {it.revisada_por_nome && (
                  <div className="mt-1 text-[11px] text-gray-500">
                    {t('gtFechV2.fila.revisadaPor', 'revisada por')}{' '}
                    <strong>{it.revisada_por_nome}</strong>
                    {it.revisada_em ? ` · ${formatarDataBR(it.revisada_em, { comHora: true })}` : ''}
                  </div>
                )}

                {podeAgir && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {!acaoAtual ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setAcaoAberta({ id: it.id, modo: 'rejeitar' });
                            setMotivo('');
                            setOkMsg(null);
                          }}
                          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-[11px] font-bold text-white hover:bg-red-700"
                        >
                          <FiXCircle className="h-3.5 w-3.5" />
                          {t('gtFechV2.fila.rejeitar', 'Rejeitar (rollback)')}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAcaoAberta({ id: it.id, modo: 'reverter' });
                            setMotivo('');
                            setOkMsg(null);
                          }}
                          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-amber-400 bg-white px-3 py-2 text-[11px] font-bold text-amber-800 hover:bg-amber-50"
                        >
                          <FiRotateCcw className="h-3.5 w-3.5" />
                          {t('gtFechV2.fila.reverter', 'Reverter')}
                        </button>
                      </>
                    ) : (
                      <div className="w-full space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-2">
                        <label className="block text-[11px] font-bold text-gray-700">
                          {t('gtFechV2.fila.motivo', 'Motivo')} *
                        </label>
                        <textarea
                          rows={2}
                          value={motivo}
                          onChange={(e) => setMotivo(e.target.value)}
                          placeholder={t('gtFechV2.fila.motivoPlaceholder', 'Ex.: data de desembarque errada — lançamento correto é 12/09.')}
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs focus:ring-2 focus:ring-abz-blue"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={executarAcao}
                            disabled={isProcessando}
                            className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-bold text-white disabled:opacity-50 ${
                              acaoAtual.modo === 'rejeitar' ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'
                            }`}
                          >
                            {isProcessando ? (
                              <FiRefreshCw className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <FiCheckSquare className="h-3.5 w-3.5" />
                            )}
                            {acaoAtual.modo === 'rejeitar'
                              ? t('gtFechV2.fila.confirmarRejeitar', 'Confirmar rejeição')
                              : t('gtFechV2.fila.confirmarReverter', 'Confirmar reversão')}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setAcaoAberta(null);
                              setMotivo('');
                            }}
                            className="min-h-[44px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-[11px] font-bold text-gray-600 hover:bg-gray-100"
                          >
                            {t('gtFechV2.fila.cancelar', 'Cancelar')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {(totalPages > 1 || page > 1) && (
        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={() => {
              const p = Math.max(1, page - 1);
              setPage(p);
              carregar(p);
            }}
            disabled={page <= 1 || isLoading}
            className="inline-flex min-h-[44px] items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 disabled:opacity-40"
          >
            <FiArrowLeft className="h-3.5 w-3.5" />
            {t('gtFechV2.fila.pagAnterior', 'Anterior')}
          </button>
          <span className="text-[11px] font-semibold text-gray-500">
            {t('gtFechV2.fila.paginaDe', { page, totalPages }, 'Página {page} de {totalPages}')}
          </span>
          <button
            type="button"
            onClick={() => {
              const p = Math.min(totalPages, page + 1);
              setPage(p);
              carregar(p);
            }}
            disabled={page >= totalPages || isLoading}
            className="inline-flex min-h-[44px] items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 disabled:opacity-40"
          >
            {t('gtFechV2.fila.pagProxima', 'Próxima')}
            <FiArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
