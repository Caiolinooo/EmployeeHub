'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  FiAlertCircle,
  FiArrowDown,
  FiArrowLeft,
  FiArrowRight,
  FiArrowUp,
  FiEdit2,
  FiFileText,
  FiLoader,
  FiPlus,
  FiSearch,
  FiTrash2,
  FiX,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { fetchWithToken } from '@/lib/tokenStorage';
import { useI18n } from '@/contexts/I18nContext';
import ConfirmacaoModal from './ConfirmacaoModal';
import {
  formatarCelula,
  valorParaInputData,
  type IndicadorColuna,
  type IndicadorEnvelope,
  type IndicadorTipoColuna,
  type LinhaItem,
  type LinhasData,
} from './types';

interface AbaWorkspace {
  id: string;
  nome: string;
  totalLinhas: number;
  colunas: IndicadorColuna[];
}

interface WorkspaceAbaModalProps {
  isOpen: boolean;
  onClose: () => void;
  planilhaNome: string;
  aba: AbaWorkspace;
  /** hasFeature('indicadores.edit') — o server reforça de fato. */
  podeEditar: boolean;
  /** Notifica o pai (contagens de abas podem mudar após inserir/excluir). */
  onDadosAlterados?: () => void;
}

const CELULA_TEXTO_CLASS = 'block max-w-[280px] whitespace-pre-wrap break-words text-gray-700';

function Celula({ valor, tipo }: { valor: unknown; tipo: IndicadorTipoColuna }) {
  const texto = formatarCelula(valor, tipo);
  if (tipo === 'texto') return <span className={CELULA_TEXTO_CLASS}>{texto}</span>;
  return <span className="whitespace-nowrap text-gray-700">{texto}</span>;
}

/**
 * Workspace fullscreen de uma ABA (padrão ModalAprovacaoFechamento):
 * grade dinâmica com colunas da aba, ordenação/busca/paginação SERVER-SIDE
 * e CRUD de linhas por tipo de coluna.
 */
export default function WorkspaceAbaModal({
  isOpen,
  onClose,
  planilhaNome,
  aba,
  podeEditar,
  onDadosAlterados,
}: WorkspaceAbaModalProps) {
  const { t } = useI18n();

  const [data, setData] = useState<LinhasData | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(25);
  const [buscaInput, setBuscaInput] = useState('');
  const [busca, setBusca] = useState('');
  const [ordem, setOrdem] = useState<string | null>(null);
  const [dir, setDir] = useState<'asc' | 'desc'>('asc');

  /** Linha em edição, 'nova' para criação, null fechado. */
  const [formLinha, setFormLinha] = useState<LinhaItem | 'nova' | null>(null);
  const [confirmarExcluir, setConfirmarExcluir] = useState<LinhaItem | null>(null);
  const [busyExcluir, setBusyExcluir] = useState(false);

  // Reset ao abrir ou trocar de aba.
  useEffect(() => {
    if (!isOpen) return;
    setPagina(1);
    setPorPagina(25);
    setBuscaInput('');
    setBusca('');
    setOrdem(null);
    setDir('asc');
    setData(null);
    setErro(null);
    setFormLinha(null);
    setConfirmarExcluir(null);
  }, [isOpen, aba.id]);

  const carregarLinhas = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const params = new URLSearchParams({ pagina: String(pagina), porPagina: String(porPagina) });
      if (busca.trim()) params.set('busca', busca.trim());
      if (ordem) {
        params.set('ordem', ordem);
        params.set('dir', dir);
      }
      const res = await fetchWithToken(`/api/indicadores/abas/${aba.id}/linhas?${params.toString()}`);
      const json = (await res.json()) as IndicadorEnvelope<LinhasData>;
      if (res.ok && json.success && json.data) {
        const d = json.data;
        const totalPaginas = Math.max(1, Math.ceil((d.total || 0) / (d.porPagina || porPagina)));
        // Página encolheu após exclusões/filtro — volta para a última válida (refetch via efeito).
        if (pagina > totalPaginas) {
          setPagina(totalPaginas);
          return;
        }
        setData(d);
      } else {
        setData(null);
        setErro(json.error || t('indicadores.workspace.erroCarregar', 'Erro ao carregar linhas'));
      }
    } catch {
      setData(null);
      setErro(t('indicadores.workspace.erroCarregar', 'Erro ao carregar linhas'));
    } finally {
      setLoading(false);
    }
  }, [aba.id, pagina, porPagina, busca, ordem, dir, t]);

  useEffect(() => {
    if (isOpen) carregarLinhas();
  }, [isOpen, carregarLinhas]);

  // Busca com debounce de 400ms (server-side).
  useEffect(() => {
    if (!isOpen) return;
    const id = setTimeout(() => {
      setBusca(buscaInput.trim());
      setPagina(1);
    }, 400);
    return () => clearTimeout(id);
  }, [buscaInput, isOpen]);

  // Escape fecha na ordem: form de linha → confirmação → workspace.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (formLinha) {
        setFormLinha(null);
        return;
      }
      if (confirmarExcluir) {
        setConfirmarExcluir(null);
        return;
      }
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, formLinha, confirmarExcluir, onClose]);

  if (!isOpen) return null;

  const colunas = data?.aba.colunas ?? aba.colunas;
  const total = data?.total ?? aba.totalLinhas;
  const porPaginaEfetiva = data?.porPagina ?? porPagina;
  const totalPaginas = Math.max(1, Math.ceil(total / porPaginaEfetiva));

  const ordenarPor = (key: string) => {
    if (ordem === key) {
      setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setOrdem(key);
      setDir('asc');
    }
    setPagina(1);
  };

  const excluirLinha = async () => {
    if (!confirmarExcluir) return;
    setBusyExcluir(true);
    try {
      const res = await fetchWithToken(`/api/indicadores/linhas/${confirmarExcluir.id}`, { method: 'DELETE' });
      const json = (await res.json()) as IndicadorEnvelope<unknown>;
      if (res.ok && json.success) {
        toast.success(t('indicadores.workspace.linhaExcluida', 'Linha excluída'));
        setConfirmarExcluir(null);
        await carregarLinhas();
        onDadosAlterados?.();
      } else {
        setErro(json.error || t('indicadores.workspace.erroExcluir', 'Erro ao excluir linha'));
      }
    } catch {
      setErro(t('indicadores.workspace.erroExcluir', 'Erro ao excluir linha'));
    } finally {
      setBusyExcluir(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-0 sm:p-2">
      <div
        className="flex h-[100dvh] w-full max-w-none flex-col overflow-hidden rounded-none border-0 bg-white shadow-2xl sm:h-[min(98dvh,calc(100dvh-1rem))] sm:rounded-2xl sm:border sm:border-gray-200 animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-label={`${planilhaNome} › ${aba.nome}`}
      >
        {/* Cabeçalho */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-gray-50 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-abz-blue text-white shadow-sm">
              <FiFileText className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold text-gray-900 sm:text-lg">
                {planilhaNome} <span className="text-gray-400">›</span> {aba.nome}
              </h2>
              <p className="text-xs text-gray-500">
                {total.toLocaleString('pt-BR')} {t('indicadores.workspace.linhasContagem', 'linhas')}
              </p>
            </div>
          </div>

          <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:flex-none">
            <label className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
              <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={buscaInput}
                onChange={(e) => setBuscaInput(e.target.value)}
                placeholder={t('indicadores.workspace.buscar', 'Buscar linhas...')}
                className="min-h-[44px] w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm focus:border-abz-blue focus:outline-none focus:ring-1 focus:ring-abz-blue"
              />
            </label>
            {podeEditar && (
              <button
                type="button"
                onClick={() => setFormLinha('nova')}
                className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700"
              >
                <FiPlus className="h-4 w-4" />
                <span className="hidden sm:inline">{t('indicadores.workspace.novaLinha', 'Nova linha')}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] min-w-[44px] shrink-0 rounded-lg p-2 text-gray-400 transition hover:bg-gray-200 hover:text-gray-700"
              aria-label={t('indicadores.acoes.fechar', 'Fechar')}
            >
              <FiX className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Corpo — grade */}
        <div className="min-h-0 flex-1 overflow-auto">
          {erro && (
            <div className="m-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
              <FiAlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="whitespace-pre-wrap break-words">{erro}</span>
            </div>
          )}

          <table className="w-full min-w-max text-left text-xs">
            <thead className="sticky top-0 z-10 bg-gray-50">
              <tr>
                {colunas.map((col) => (
                  <th key={col.key} className="border-b border-gray-200 px-3 py-2 font-bold text-gray-700">
                    <button
                      type="button"
                      onClick={() => ordenarPor(col.key)}
                      className={`inline-flex min-h-[44px] items-center gap-1 py-1 text-xs font-bold transition hover:text-abz-blue ${
                        ordem === col.key ? 'text-abz-blue' : ''
                      } ${col.tipo === 'numero' || col.tipo === 'percentual' ? 'w-full justify-end text-right' : ''}`}
                      title={t('indicadores.workspace.ordenarPor', { coluna: col.label }, 'Ordenar por {coluna}')}
                    >
                      {col.label}
                      {ordem === col.key ? (
                        dir === 'asc' ? (
                          <FiArrowUp className="h-3.5 w-3.5 shrink-0" />
                        ) : (
                          <FiArrowDown className="h-3.5 w-3.5 shrink-0" />
                        )
                      ) : null}
                    </button>
                  </th>
                ))}
                {podeEditar && (
                  <th className="sticky right-0 border-b border-gray-200 bg-gray-50 px-3 py-2 text-right font-bold text-gray-700">
                    {t('indicadores.workspace.acoes', 'Ações')}
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={colunas.length + (podeEditar ? 1 : 0)} className="px-3 py-10 text-center text-gray-500">
                    <FiLoader className="mx-auto mb-2 h-5 w-5 animate-spin text-gray-400" />
                    {t('indicadores.workspace.carregando', 'Carregando linhas...')}
                  </td>
                </tr>
              ) : (data?.linhas ?? []).length === 0 ? (
                <tr>
                  <td colSpan={colunas.length + (podeEditar ? 1 : 0)} className="px-3 py-10 text-center text-gray-500">
                    {t('indicadores.workspace.semLinhas', 'Nenhuma linha encontrada')}
                  </td>
                </tr>
              ) : (
                (data?.linhas ?? []).map((linha) => (
                  <tr key={linha.id} className="hover:bg-blue-50/40">
                    {colunas.map((col) => (
                      <td
                        key={col.key}
                        className={`max-w-[320px] px-3 py-2 align-top ${
                          col.tipo === 'numero' || col.tipo === 'percentual' ? 'text-right tabular-nums' : ''
                        }`}
                      >
                        <Celula valor={linha.dados[col.key]} tipo={col.tipo} />
                      </td>
                    ))}
                    {podeEditar && (
                      <td className="sticky right-0 bg-white px-3 py-2 text-right shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.15)]">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setFormLinha(linha)}
                            className="min-h-[44px] min-w-[44px] rounded-lg p-2 text-gray-500 transition hover:bg-blue-100 hover:text-abz-blue"
                            aria-label={t('indicadores.workspace.editar', 'Editar')}
                            title={t('indicadores.workspace.editar', 'Editar')}
                          >
                            <FiEdit2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmarExcluir(linha)}
                            className="min-h-[44px] min-w-[44px] rounded-lg p-2 text-gray-500 transition hover:bg-red-100 hover:text-red-700"
                            aria-label={t('indicadores.workspace.excluir', 'Excluir')}
                            title={t('indicadores.workspace.excluir', 'Excluir')}
                          >
                            <FiTrash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Rodapé — paginação server-side */}
        <div className="flex shrink-0 flex-col gap-2 border-t border-gray-200 bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-xs text-gray-500">
            {loading
              ? t('indicadores.workspace.carregando', 'Carregando linhas...')
              : `${total.toLocaleString('pt-BR')} ${t('indicadores.workspace.linhasContagem', 'linhas')}`}
          </p>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <label className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="hidden md:inline">{t('indicadores.workspace.porPagina', 'por página')}</span>
              <select
                value={porPagina}
                onChange={(e) => {
                  setPorPagina(Number(e.target.value) || 25);
                  setPagina(1);
                }}
                className="min-h-[44px] rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs focus:border-abz-blue focus:outline-none focus:ring-1 focus:ring-abz-blue"
              >
                {[10, 25, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => setPagina((p) => Math.max(1, p - 1))}
              disabled={loading || pagina <= 1}
              className="inline-flex min-h-[44px] items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-100 disabled:opacity-40"
            >
              <FiArrowLeft className="h-3.5 w-3.5" />
              {t('indicadores.workspace.anterior', 'Anterior')}
            </button>
            <span className="min-h-[44px] inline-flex items-center text-xs font-semibold text-gray-600">
              {t('indicadores.workspace.pagina', { atual: pagina, total: totalPaginas }, 'pág {atual} de {total}')}
            </span>
            <button
              type="button"
              onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
              disabled={loading || pagina >= totalPaginas}
              className="inline-flex min-h-[44px] items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-100 disabled:opacity-40"
            >
              {t('indicadores.workspace.proxima', 'Próxima')}
              <FiArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Form de linha (nova/editar) */}
      {formLinha && (
        <LinhaFormModal
          abaId={aba.id}
          colunas={colunas}
          linha={formLinha === 'nova' ? null : formLinha}
          onFechado={() => setFormLinha(null)}
          onSalvo={async () => {
            setFormLinha(null);
            await carregarLinhas();
            onDadosAlterados?.();
          }}
        />
      )}

      {/* Confirmação de exclusão (soft delete no server) */}
      <ConfirmacaoModal
        isOpen={confirmarExcluir != null}
        titulo={t('indicadores.workspace.excluirLinha', 'Excluir linha')}
        descricao={t('indicadores.workspace.confirmarExcluir', 'Excluir esta linha? A exclusão é registrada (soft delete).')}
        confirmarLabel={t('indicadores.workspace.excluir', 'Excluir')}
        busy={busyExcluir}
        perigoso
        onConfirmar={excluirLinha}
        onCancelar={() => setConfirmarExcluir(null)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Form de linha — inputs por tipo de coluna
// ---------------------------------------------------------------------------

interface LinhaFormModalProps {
  abaId: string;
  colunas: IndicadorColuna[];
  /** null = nova linha */
  linha: LinhaItem | null;
  onFechado: () => void;
  onSalvo: () => void | Promise<void>;
}

function preencherCampos(colunas: IndicadorColuna[], linha: LinhaItem | null): Record<string, string> {
  const campos: Record<string, string> = {};
  for (const col of colunas) {
    const valor = linha?.dados[col.key];
    if (valor == null || valor === '') {
      campos[col.key] = '';
      continue;
    }
    if (col.tipo === 'percentual') {
      // Fração (0.1234) → exibe 12,34 no input 0-100.
      const n = Number(valor);
      campos[col.key] = Number.isFinite(n) ? String(Number((n * 100).toFixed(4))) : String(valor);
    } else if (col.tipo === 'data') {
      campos[col.key] = valorParaInputData(valor);
    } else {
      campos[col.key] = String(valor);
    }
  }
  return campos;
}

function LinhaFormModal({ abaId, colunas, linha, onFechado, onSalvo }: LinhaFormModalProps) {
  const { t } = useI18n();
  const [campos, setCampos] = useState<Record<string, string>>(() => preencherCampos(colunas, linha));
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const setCampo = (key: string, valor: string) => {
    setCampos((atual) => ({ ...atual, [key]: valor }));
  };

  const salvar = async () => {
    const dados: Record<string, unknown> = {};
    for (const col of colunas) {
      const raw = (campos[col.key] ?? '').trim();
      if (col.tipo === 'data') {
        dados[col.key] = raw === '' ? null : raw;
      } else if (col.tipo === 'numero' || col.tipo === 'percentual') {
        if (raw === '') {
          dados[col.key] = null;
          continue;
        }
        const n = Number(raw.replace(',', '.'));
        if (!Number.isFinite(n)) {
          setErro(t('indicadores.workspace.erroValorInvalido', { coluna: col.label }, 'Valor inválido em "{coluna}"'));
          return;
        }
        // percentual é gravado como fração (0-100 → 0-1).
        dados[col.key] = col.tipo === 'percentual' ? n / 100 : n;
      } else {
        dados[col.key] = raw;
      }
    }

    setBusy(true);
    setErro(null);
    try {
      const res = linha
        ? await fetchWithToken(`/api/indicadores/linhas/${linha.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dados }),
          })
        : await fetchWithToken(`/api/indicadores/abas/${abaId}/linhas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dados }),
          });
      const json = (await res.json()) as IndicadorEnvelope<unknown>;
      if (res.ok && json.success) {
        toast.success(t('indicadores.workspace.linhaSalva', 'Linha salva'));
        await onSalvo();
      } else {
        setErro(json.error || t('indicadores.workspace.erroSalvar', 'Erro ao salvar linha'));
      }
    } catch {
      setErro(t('indicadores.workspace.erroSalvar', 'Erro ao salvar linha'));
    } finally {
      setBusy(false);
    }
  };

  const inputBase =
    'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-abz-blue focus:outline-none focus:ring-1 focus:ring-abz-blue';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div
        className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-label={linha ? t('indicadores.workspace.formEditar', 'Editar linha') : t('indicadores.workspace.formNova', 'Nova linha')}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 bg-gray-50 px-5 py-3">
          <h3 className="truncate text-sm font-bold text-gray-900 sm:text-base">
            {linha ? t('indicadores.workspace.formEditar', 'Editar linha') : t('indicadores.workspace.formNova', 'Nova linha')}
          </h3>
          <button
            type="button"
            onClick={onFechado}
            disabled={busy}
            className="min-h-[44px] min-w-[44px] rounded-lg p-2 text-gray-400 transition hover:bg-gray-200 hover:text-gray-700 disabled:opacity-50"
            aria-label={t('indicadores.acoes.fechar', 'Fechar')}
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {erro && (
            <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
              <FiAlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="whitespace-pre-wrap break-words">{erro}</span>
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {colunas.map((col) => (
              <label key={col.key} className={`flex flex-col gap-1.5 ${col.tipo === 'texto' ? 'sm:col-span-2' : ''}`}>
                <span className="text-xs font-bold uppercase tracking-wide text-gray-500">{col.label}</span>
                {col.tipo === 'data' && (
                  <input
                    type="date"
                    value={campos[col.key] ?? ''}
                    onChange={(e) => setCampo(col.key, e.target.value)}
                    className={`${inputBase} min-h-[44px]`}
                  />
                )}
                {col.tipo === 'numero' && (
                  <input
                    type="number"
                    step="any"
                    value={campos[col.key] ?? ''}
                    onChange={(e) => setCampo(col.key, e.target.value)}
                    className={`${inputBase} min-h-[44px]`}
                  />
                )}
                {col.tipo === 'percentual' && (
                  <span className="relative block">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="0.1"
                      value={campos[col.key] ?? ''}
                      onChange={(e) => setCampo(col.key, e.target.value)}
                      placeholder="0–100"
                      className={`${inputBase} min-h-[44px] pr-9`}
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">%</span>
                  </span>
                )}
                {col.tipo === 'texto' && (
                  <textarea
                    rows={2}
                    value={campos[col.key] ?? ''}
                    onChange={(e) => setCampo(col.key, e.target.value)}
                    className={`${inputBase} resize-y`}
                  />
                )}
              </label>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-gray-200 bg-gray-50 px-5 py-3">
          <button
            type="button"
            onClick={onFechado}
            disabled={busy}
            className="min-h-[44px] rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:opacity-50"
          >
            {t('indicadores.acoes.cancelar', 'Cancelar')}
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={busy}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-abz-blue px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-blue-800 disabled:opacity-50"
          >
            {busy ? t('indicadores.workspace.salvando', 'Salvando...') : t('indicadores.acoes.salvar', 'Salvar')}
          </button>
        </div>
      </div>
    </div>
  );
}
