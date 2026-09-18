'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { FiEdit2, FiLoader, FiTrash2, FiX } from 'react-icons/fi';
import { fetchWithToken } from '@/lib/tokenStorage';
import { useI18n } from '@/contexts/I18nContext';
import {
  DEFAULT_TIPOS_EVENTO_ESCALA,
  mapDbTipoToCodigo,
} from '@/lib/gestao-tripulantes/escala-tipos';
import { formatarDataBR } from './fechamentoV2';

/** Linha do GET /api/gestao-tripulantes/embarques. */
interface EmbarqueLinha {
  id: string;
  colaborador_id?: string | null;
  tipo?: string | null;
  data_embarque?: string | null;
  data_desembarque?: string | null;
  data_prevista_desembarque?: string | null;
  local_embarque?: string | null;
  local_desembarque?: string | null;
  observacoes?: string | null;
  origem?: string | null;
  updated_at?: string | null;
}

interface FechamentoEmbarquesEditorProps {
  colaboradorId: string;
  nome?: string;
  /** Janela do fechamento (YYYY-MM-DD); ausentes = lista tudo. */
  dataInicio?: string | null;
  dataFim?: string | null;
  podeEditar: boolean;
  onSaved?: () => void;
}

interface EmbarquesApiResponse {
  success?: boolean;
  data?: { embarques?: EmbarqueLinha[] };
  error?: string;
}

/** display_code (ON, DBA, FI…) a partir do tipo persistido; custom cai no código. */
function labelTipo(tipo: string | null | undefined): { display: string; label: string } {
  const codigo = mapDbTipoToCodigo(tipo);
  const def = DEFAULT_TIPOS_EVENTO_ESCALA.find((t) => t.codigo === codigo);
  return { display: def?.display_code || codigo.toUpperCase(), label: def?.label || codigo };
}

/**
 * Editor inline dos embarques do colaborador no workspace do Fechamento Mensal.
 * Lista via GET /embarques (janela de/ate do fechamento); com `podeEditar`,
 * permite trocar as datas inline (PUT /embarques/[id]) e excluir o evento
 * (DELETE /embarques/[id], modo 'completo'). Sem probe — o pai já tem;
 * após salvar/excluir só refetcha a lista local e avisa onSaved.
 */
export default function FechamentoEmbarquesEditor({
  colaboradorId,
  nome,
  dataInicio,
  dataFim,
  podeEditar,
  onSaved,
}: FechamentoEmbarquesEditorProps) {
  const { t } = useI18n();
  const [embarques, setEmbarques] = useState<EmbarqueLinha[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editEmb, setEditEmb] = useState('');
  const [editDesemb, setEditDesemb] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!colaboradorId) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const params = new URLSearchParams({ colaboradorId });
      if (dataInicio) params.set('de', dataInicio);
      if (dataFim) params.set('ate', dataFim);
      const res = await fetchWithToken(`/api/gestao-tripulantes/embarques?${params.toString()}`);
      const json = (await res.json().catch(() => ({}))) as EmbarquesApiResponse;
      if (!res.ok) {
        throw new Error(json.error || t('gtFechV2.editorEmb.erroCarregar', 'Erro ao carregar embarques.'));
      }
      setEmbarques(Array.isArray(json.data?.embarques) ? json.data.embarques : []);
    } catch (err) {
      setEmbarques([]);
      setErrorMsg(
        err instanceof Error ? err.message : t('gtFechV2.editorEmb.erroCarregar', 'Erro ao carregar embarques.')
      );
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colaboradorId, dataInicio, dataFim]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const cancelarEdicao = () => {
    setEditingId(null);
    setEditEmb('');
    setEditDesemb('');
  };

  const iniciarEdicao = (row: EmbarqueLinha) => {
    setEditingId(row.id);
    setEditEmb(String(row.data_embarque || '').slice(0, 10));
    setEditDesemb(String(row.data_desembarque || '').slice(0, 10));
    setErrorMsg(null);
  };

  const salvarEdicao = async (id: string) => {
    // Mínimo de validação no cliente — a route rejeita de novo.
    if (editDesemb && editDesemb < editEmb) {
      setErrorMsg(
        t(
          'gtFechV2.editorEmb.erroRange',
          'Data de desembarque não pode ser anterior à data de embarque.'
        )
      );
      return;
    }
    setBusyId(id);
    setErrorMsg(null);
    try {
      // Contrato do PUT: todos os campos opcionais, só o que muda vai no body
      // (desembarque vazio não é enviado — não abre a linha por acidente).
      const body: Record<string, string> = { data_embarque: editEmb };
      if (editDesemb) body.data_desembarque = editDesemb;
      const res = await fetchWithToken(`/api/gestao-tripulantes/embarques/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(json.error || t('gtFechV2.editorEmb.erroSalvar', 'Erro ao salvar embarque.'));
      }
      cancelarEdicao();
      await carregar();
      onSaved?.();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : t('gtFechV2.editorEmb.erroSalvar', 'Erro ao salvar embarque.')
      );
    } finally {
      setBusyId(null);
    }
  };

  const excluir = async (row: EmbarqueLinha) => {
    if (!window.confirm(t('gtFechV2.editorEmb.confirmarExcluir', 'Excluir este evento de escala?'))) return;
    setBusyId(row.id);
    setErrorMsg(null);
    try {
      // DELETE sem body = modo 'completo' (soft-delete da linha inteira);
      // modo 'periodo' não é usado neste editor.
      const res = await fetchWithToken(`/api/gestao-tripulantes/embarques/${row.id}`, {
        method: 'DELETE',
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(json.error || t('gtFechV2.editorEmb.erroExcluir', 'Erro ao excluir embarque.'));
      }
      await carregar();
      onSaved?.();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : t('gtFechV2.editorEmb.erroExcluir', 'Erro ao excluir embarque.')
      );
    } finally {
      setBusyId(null);
    }
  };

  const celularDesembarque = (row: EmbarqueLinha): string => {
    const dia = String(row.data_desembarque || '').slice(0, 10);
    if (dia) return formatarDataBR(dia);
    const prevista = String(row.data_prevista_desembarque || '').slice(0, 10);
    if (prevista) {
      return `— · ${t('gtFechV2.editorEmb.prevista', { data: formatarDataBR(prevista) }, 'previsto {{data}}')}`;
    }
    return '—';
  };

  if (!colaboradorId) return null;

  return (
    <div className="mt-3 rounded-lg border border-gray-200 bg-white p-3">
      <h4 className="text-sm font-semibold text-gray-800">
        {t('gtFechV2.editorEmb.titulo', 'Embarques do período')}
        {nome ? ` — ${nome}` : ''}
      </h4>

      {errorMsg && (
        <div className="mt-2 rounded border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-700">
          {errorMsg}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 py-4 text-xs text-gray-500">
          <FiLoader className="h-3.5 w-3.5 animate-spin" />
          {t('gtFechV2.editorEmb.carregando', 'Carregando embarques…')}
        </div>
      ) : embarques.length === 0 ? (
        <div className="py-4 text-xs text-gray-500">
          {t('gtFechV2.editorEmb.vazio', 'Sem embarques no período.')}
        </div>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="px-2 py-1.5 font-medium">{t('gtFechV2.editorEmb.colTipo', 'Tipo')}</th>
                <th className="px-2 py-1.5 font-medium">{t('gtFechV2.editorEmb.colEmbarque', 'Embarque')}</th>
                <th className="px-2 py-1.5 font-medium">{t('gtFechV2.editorEmb.colDesembarque', 'Desembarque')}</th>
                <th className="px-2 py-1.5 font-medium">{t('gtFechV2.editorEmb.colOrigem', 'Origem')}</th>
                {podeEditar && (
                  <th className="px-2 py-1.5 text-right font-medium">
                    {t('gtFechV2.editorEmb.colAcoes', 'Ações')}
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {embarques.map((row) => {
                const emEdicao = editingId === row.id;
                const ocupado = busyId === row.id;
                const tipo = labelTipo(row.tipo);
                return (
                  <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-2 py-1.5" title={tipo.label}>
                      {tipo.display}
                    </td>
                    <td className="px-2 py-1.5">
                      {emEdicao ? (
                        <input
                          type="date"
                          value={editEmb}
                          onChange={(e) => setEditEmb(e.target.value)}
                          className="rounded border border-gray-300 px-1 py-0.5 text-xs"
                          disabled={ocupado}
                        />
                      ) : (
                        formatarDataBR(String(row.data_embarque || '').slice(0, 10))
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      {emEdicao ? (
                        <input
                          type="date"
                          value={editDesemb}
                          onChange={(e) => setEditDesemb(e.target.value)}
                          className="rounded border border-gray-300 px-1 py-0.5 text-xs"
                          disabled={ocupado}
                        />
                      ) : (
                        celularDesembarque(row)
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-gray-500">{row.origem || '—'}</td>
                    {podeEditar && (
                      <td className="px-2 py-1.5 text-right">
                        {emEdicao ? (
                          <span className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => salvarEdicao(row.id)}
                              disabled={ocupado || !editEmb}
                              className="rounded border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                            >
                              {ocupado ? (
                                <FiLoader className="h-3 w-3 animate-spin" />
                              ) : (
                                t('gtFechV2.editorEmb.salvar', 'Salvar')
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={cancelarEdicao}
                              disabled={ocupado}
                              className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-xs text-gray-500 hover:text-gray-800 disabled:opacity-50"
                              title={t('gtFechV2.editorEmb.cancelar', 'Cancelar')}
                            >
                              <FiX className="h-3 w-3" />
                              {t('gtFechV2.editorEmb.cancelar', 'Cancelar')}
                            </button>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => iniciarEdicao(row)}
                              disabled={busyId !== null}
                              className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-gray-500 hover:text-gray-800 disabled:opacity-50"
                              title={t('gtFechV2.editorEmb.editar', 'Editar')}
                            >
                              <FiEdit2 className="h-3 w-3" />
                              {t('gtFechV2.editorEmb.editar', 'Editar')}
                            </button>
                            <button
                              type="button"
                              onClick={() => excluir(row)}
                              disabled={busyId !== null}
                              className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-gray-500 hover:text-red-600 disabled:opacity-50"
                              title={t('gtFechV2.editorEmb.excluir', 'Excluir')}
                            >
                              {ocupado ? (
                                <FiLoader className="h-3 w-3 animate-spin" />
                              ) : (
                                <FiTrash2 className="h-3 w-3" />
                              )}
                              {t('gtFechV2.editorEmb.excluir', 'Excluir')}
                            </button>
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
