'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  FiAlertCircle,
  FiCheck,
  FiChevronLeft,
  FiChevronRight,
  FiFileText,
  FiLayers,
  FiUploadCloud,
  FiX,
} from 'react-icons/fi';
import { fetchWithToken } from '@/lib/tokenStorage';
import { useI18n } from '@/contexts/I18nContext';
import {
  formatarCelula,
  type AbaAnalyze,
  type AnalyzeData,
  type ConfirmData,
  type IndicadorEnvelope,
} from './types';

export interface ImportadorPrefill {
  modo: 'criar' | 'substituir';
  planilhaId?: string;
  nome?: string;
}

interface ImportadorPlanilhasModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Chamado com o planilhaId criado/atualizado após confirm bem-sucedido. */
  onImportado: (planilhaId: string) => void;
  /** Catálogo existente para o modo "substituir". */
  planilhas: Array<{ id: string; nome: string }>;
  /** Reimportação: preenche passo 3 em modo substituir. */
  prefill?: ImportadorPrefill | null;
}

const EXTENSOES_ACEITAS = ['.xlsx', '.xls'];

function nomeSemExtensao(nome: string): string {
  return nome.replace(/\.(xlsx|xls)$/i, '');
}

/**
 * Wizard de importação (3 passos): arquivo → revisão das abas → confirmação.
 *
 * Upload: `fetchWithToken` SÓ define `Content-Type: application/json` quando a
 * requisição NÃO tem body (src/lib/tokenStorage.ts) — com FormData ele preserva
 * o multipart com boundary gerado pelo browser e adiciona o Bearer. Logo, o
 * upload usa fetchWithToken direto, sem Content-Type manual.
 */
export default function ImportadorPlanilhasModal({
  isOpen,
  onClose,
  onImportado,
  planilhas,
  prefill,
}: ImportadorPlanilhasModalProps) {
  const { t } = useI18n();

  const [passo, setPasso] = useState<1 | 2 | 3>(1);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [analyze, setAnalyze] = useState<AnalyzeData | null>(null);
  const [abasSelecionadas, setAbasSelecionadas] = useState<string[]>([]);
  const [headerRows, setHeaderRows] = useState<Record<string, number>>({});
  const [abaPreview, setAbaPreview] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [modo, setModo] = useState<'criar' | 'substituir'>('criar');
  const [planilhaDestino, setPlanilhaDestino] = useState('');
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const inputArquivoRef = useRef<HTMLInputElement>(null);

  // Reset a cada abertura, aplicando prefill de reimportação.
  useEffect(() => {
    if (!isOpen) return;
    setPasso(1);
    setArquivo(null);
    setAnalyze(null);
    setAbasSelecionadas([]);
    setHeaderRows({});
    setAbaPreview(null);
    setErro(null);
    setBusy(false);
    setNome(prefill?.nome ?? '');
    setModo(prefill?.modo ?? 'criar');
    setPlanilhaDestino(prefill?.planilhaId ?? '');
  }, [isOpen, prefill]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, busy, onClose]);

  if (!isOpen) return null;

  const passoLabels = [
    t('indicadores.wizard.passo1', 'Arquivo'),
    t('indicadores.wizard.passo2', 'Revisão das abas'),
    t('indicadores.wizard.passo3', 'Confirmação'),
  ];

  const selecionarArquivo = (file: File | null) => {
    setErro(null);
    if (!file) return;
    const ok = EXTENSOES_ACEITAS.some((ext) => file.name.toLowerCase().endsWith(ext));
    if (!ok) {
      setErro(t('indicadores.wizard.erroArquivo', 'Selecione um arquivo .xlsx ou .xls'));
      return;
    }
    setArquivo(file);
  };

  const analisar = async () => {
    if (!arquivo) {
      setErro(t('indicadores.wizard.erroArquivo', 'Selecione um arquivo .xlsx ou .xls'));
      return;
    }
    setBusy(true);
    setErro(null);
    try {
      const fd = new FormData();
      fd.append('arquivo', arquivo);
      const res = await fetchWithToken('/api/indicadores/import/analyze', {
        method: 'POST',
        body: fd,
      });
      const json = (await res.json()) as IndicadorEnvelope<AnalyzeData>;
      const abas = json.data?.abas ?? [];
      if (res.ok && json.success && json.data && abas.length > 0) {
        setAnalyze(json.data);
        setAbasSelecionadas(abas.map((a) => a.nome));
        setHeaderRows(Object.fromEntries(abas.map((a) => [a.nome, a.headerRow || 1] as const)));
        setAbaPreview(abas[0]?.nome ?? null);
        setPasso(2);
      } else {
        setErro(json.error || t('indicadores.wizard.erroAnalyze', 'Não foi possível analisar a planilha'));
      }
    } catch {
      setErro(t('indicadores.wizard.erroAnalyze', 'Não foi possível analisar a planilha'));
    } finally {
      setBusy(false);
    }
  };

  const avancarParaPasso3 = () => {
    if (abasSelecionadas.length === 0) {
      setErro(t('indicadores.wizard.erroNenhumaAbaSelecionada', 'Selecione ao menos uma aba'));
      return;
    }
    setErro(null);
    setPasso(3);
  };

  const confirmar = async () => {
    if (!analyze || !arquivo) return;
    if (!nome.trim()) {
      setErro(t('indicadores.wizard.erroNome', 'Informe o nome do dataset'));
      return;
    }
    if (modo === 'substituir' && !planilhaDestino) {
      setErro(t('indicadores.wizard.erroModo', 'Selecione a planilha a ser substituída'));
      return;
    }
    setBusy(true);
    setErro(null);
    try {
      const abasPayload = analyze.abas
        .filter((a) => abasSelecionadas.includes(a.nome))
        .map((a) => {
          const headerRow = headerRows[a.nome] ?? a.headerRow;
          // headerRow é opcional no contrato: só vai quando difere do detectado.
          return headerRow !== a.headerRow ? { nome: a.nome, headerRow } : { nome: a.nome };
        });
      const payload = {
        nome: nome.trim(),
        modo,
        ...(modo === 'substituir' ? { planilhaId: planilhaDestino } : {}),
        abas: abasPayload,
      };
      const fd = new FormData();
      fd.append('arquivo', arquivo);
      fd.append('payload', JSON.stringify(payload));
      const res = await fetchWithToken('/api/indicadores/import/confirm', {
        method: 'POST',
        body: fd,
      });
      const json = (await res.json()) as IndicadorEnvelope<ConfirmData>;
      if (res.ok && json.success && json.data?.planilhaId) {
        onImportado(json.data.planilhaId);
      } else {
        setErro(json.error || t('indicadores.wizard.erroConfirm', 'Não foi possível concluir a importação'));
      }
    } catch {
      setErro(t('indicadores.wizard.erroConfirm', 'Não foi possível concluir a importação'));
    } finally {
      setBusy(false);
    }
  };

  const abaPreviewObj: AbaAnalyze | null =
    analyze?.abas.find((a) => a.nome === abaPreview) ?? analyze?.abas[0] ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-0 sm:p-2">
      <div
        className="flex h-[100dvh] w-full max-w-none flex-col overflow-hidden rounded-none border-0 bg-white shadow-2xl sm:h-[min(92dvh,calc(100dvh-1rem))] sm:rounded-2xl sm:border sm:border-gray-200 animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-label={t('indicadores.wizard.titulo', 'Importar planilha')}
      >
        {/* Cabeçalho */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-abz-blue text-white shadow-sm">
              <FiUploadCloud className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold text-gray-900 sm:text-lg">
                {t('indicadores.wizard.titulo', 'Importar planilha')}
              </h2>
              <p className="hidden truncate text-xs text-gray-500 sm:block">
                {passoLabels[passo - 1]}
                {arquivo ? ` · ${arquivo.name}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="min-h-[44px] min-w-[44px] rounded-lg p-2 text-gray-400 transition hover:bg-gray-200 hover:text-gray-700 disabled:opacity-50"
            aria-label={t('indicadores.acoes.fechar', 'Fechar')}
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        {/* Barra de progresso dos passos */}
        <div className="shrink-0 border-b border-gray-200 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            {passoLabels.map((label, i) => {
              const numero = i + 1;
              const ativo = numero === passo;
              const completo = numero < passo;
              return (
                <React.Fragment key={label}>
                  {i > 0 && <div className={`h-0.5 flex-1 rounded ${completo ? 'bg-abz-blue' : 'bg-gray-200'}`} />}
                  <div className={`flex items-center gap-1.5 ${i > 0 ? '' : 'flex-1'}`}>
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        completo
                          ? 'bg-abz-blue text-white'
                          : ativo
                            ? 'border-2 border-abz-blue text-abz-blue'
                            : 'border border-gray-300 text-gray-400'
                      }`}
                    >
                      {completo ? <FiCheck className="h-4 w-4" /> : numero}
                    </span>
                    <span className={`hidden truncate text-xs font-semibold sm:block ${ativo ? 'text-gray-900' : 'text-gray-500'}`}>
                      {label}
                    </span>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-abz-blue transition-all duration-300"
              style={{ width: `${(passo / 3) * 100}%` }}
            />
          </div>
        </div>

        {/* Corpo */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4 text-sm sm:p-6">
          {erro && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
              <FiAlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="whitespace-pre-wrap break-words">{erro}</span>
            </div>
          )}

          {/* Passo 1 — seleção de arquivo */}
          {passo === 1 && (
            <div className="mx-auto flex max-w-xl flex-col items-center gap-4 py-6">
              <input
                ref={inputArquivoRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => selecionarArquivo(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                onClick={() => inputArquivoRef.current?.click()}
                disabled={busy}
                className="flex min-h-[160px] w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 px-6 py-8 text-gray-500 transition hover:border-abz-blue hover:bg-blue-50 hover:text-abz-blue disabled:opacity-50"
              >
                <FiUploadCloud className="h-10 w-10" />
                <span className="text-sm font-semibold">
                  {t('indicadores.wizard.escolherArquivo', 'Selecionar arquivo XLSX')}
                </span>
                <span className="text-xs">{t('indicadores.wizard.dicaFormato', 'Formatos aceitos: .xlsx e .xls')}</span>
              </button>
              {arquivo && (
                <div className="flex w-full items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                  <FiFileText className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate font-semibold">{arquivo.name}</span>
                  <button
                    type="button"
                    onClick={() => inputArquivoRef.current?.click()}
                    disabled={busy}
                    className="min-h-[44px] shrink-0 rounded-lg px-3 py-2 font-semibold underline-offset-2 hover:underline disabled:opacity-50"
                  >
                    {t('indicadores.wizard.trocarArquivo', 'Trocar arquivo')}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Passo 2 — revisão das abas */}
          {passo === 2 && analyze && (
            <div className="mx-auto flex max-w-4xl flex-col gap-4">
              <p className="text-xs text-gray-500">{t('indicadores.wizard.selecionarAbas', 'Selecione as abas que deseja importar')}</p>
              <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200">
                {analyze.abas.map((aba) => {
                  const selecionada = abasSelecionadas.includes(aba.nome);
                  return (
                    <div
                      key={aba.nome}
                      className={`flex flex-wrap items-center gap-2 px-3 py-2 ${selecionada ? 'bg-blue-50/50' : 'bg-white'}`}
                    >
                      <label className="flex min-h-[44px] flex-1 cursor-pointer items-center gap-2 py-1">
                        <input
                          type="checkbox"
                          className="h-4 w-4 shrink-0 accent-abz-blue"
                          checked={selecionada}
                          onChange={(e) =>
                            setAbasSelecionadas((atual) =>
                              e.target.checked ? [...atual, aba.nome] : atual.filter((n) => n !== aba.nome),
                            )
                          }
                        />
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-800">{aba.nome}</span>
                        <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-600">
                          {aba.colunas.length} {t('indicadores.wizard.colunas', 'colunas')}
                        </span>
                        <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-600">
                          {aba.totalLinhas.toLocaleString('pt-BR')} {t('indicadores.wizard.linhas', 'linhas')}
                        </span>
                      </label>
                      <label className="flex shrink-0 items-center gap-1.5 text-xs text-gray-600">
                        <span className="hidden md:inline">{t('indicadores.wizard.linhaCabecalho', 'Linha do cabeçalho')}</span>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={headerRows[aba.nome] ?? aba.headerRow}
                          onChange={(e) => {
                            const v = Math.max(1, Math.floor(e.target.valueAsNumber || 1));
                            setHeaderRows((atual) => ({ ...atual, [aba.nome]: v }));
                          }}
                          className="w-16 rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:border-abz-blue focus:outline-none focus:ring-1 focus:ring-abz-blue"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => setAbaPreview(aba.nome)}
                        className={`min-h-[44px] shrink-0 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                          abaPreviewObj?.nome === aba.nome
                            ? 'border-abz-blue bg-abz-blue text-white'
                            : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {t('indicadores.wizard.prever', 'Pré-visualizar')}
                      </button>
                    </div>
                  );
                })}
              </div>

              <p className="text-[11px] text-gray-500">
                {t(
                  'indicadores.wizard.linhaCabecalhoHint',
                  'Número (1-based) da linha onde está o cabeçalho. O valor ajustado é aplicado no momento da importação.',
                )}
              </p>

              {abaPreviewObj && (
                <div>
                  <h4 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-gray-500">
                    <FiLayers className="h-3.5 w-3.5" />
                    {t('indicadores.wizard.preview', 'Pré-visualização')} · {abaPreviewObj.nome}
                  </h4>
                  <div className="overflow-x-auto rounded-xl border border-gray-200">
                    <table className="w-full min-w-max text-left text-xs">
                      <thead className="bg-gray-50">
                        <tr>
                          {abaPreviewObj.colunas.map((col) => (
                            <th key={col.key} className="whitespace-nowrap border-b border-gray-200 px-3 py-2 font-bold text-gray-700">
                              {col.label}
                              <span className="ml-1 font-normal text-gray-400">
                                ({t(`indicadores.tipo.${col.tipo}`, col.tipo)})
                              </span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {abaPreviewObj.linhas.slice(0, 8).map((linha, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            {abaPreviewObj.colunas.map((col) => (
                              <td key={col.key} className="max-w-[220px] truncate px-3 py-2 text-gray-600" title={formatarCelula(linha[col.key], col.tipo)}>
                                {formatarCelula(linha[col.key], col.tipo)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Passo 3 — confirmação */}
          {passo === 3 && (
            <div className="mx-auto flex max-w-xl flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wide text-gray-500">
                  {t('indicadores.wizard.nomeDataset', 'Nome do dataset')}
                </span>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder={arquivo ? nomeSemExtensao(analyze?.arquivoNome ?? arquivo.name) : ''}
                  maxLength={120}
                  className="min-h-[44px] rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-abz-blue focus:outline-none focus:ring-1 focus:ring-abz-blue"
                />
              </label>

              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1.5 text-xs font-bold uppercase tracking-wide text-gray-500">
                  {t('indicadores.wizard.modo', 'Modo de importação')}
                </legend>
                <label className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm has-[:checked]:border-abz-blue has-[:checked]:bg-blue-50">
                  <input
                    type="radio"
                    name="indicadores-modo"
                    className="h-4 w-4 accent-abz-blue"
                    checked={modo === 'criar'}
                    onChange={() => setModo('criar')}
                  />
                  {t('indicadores.wizard.modoCriar', 'Criar nova planilha')}
                </label>
                <label className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm has-[:checked]:border-abz-blue has-[:checked]:bg-blue-50">
                  <input
                    type="radio"
                    name="indicadores-modo"
                    className="h-4 w-4 accent-abz-blue"
                    checked={modo === 'substituir'}
                    onChange={() => setModo('substituir')}
                  />
                  {t('indicadores.wizard.modoSubstituir', 'Substituir planilha existente')}
                </label>
              </fieldset>

              {modo === 'substituir' && (
                <div className="flex flex-col gap-1.5">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-bold uppercase tracking-wide text-gray-500">
                      {t('indicadores.wizard.planilhaDestino', 'Planilha a substituir')}
                    </span>
                    <select
                      value={planilhaDestino}
                      onChange={(e) => setPlanilhaDestino(e.target.value)}
                      className="min-h-[44px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-abz-blue focus:outline-none focus:ring-1 focus:ring-abz-blue"
                    >
                      <option value="">{t('indicadores.wizard.selecionePlanilha', 'Selecione a planilha')}</option>
                      {planilhas.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nome}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    {t(
                      'indicadores.wizard.avisoSubstituir',
                      'As abas existentes dessa planilha serão substituídas pelos dados importados.',
                    )}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-gray-200 bg-gray-50 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={passo === 1 ? onClose : () => { setErro(null); setPasso((p) => (p === 3 ? 2 : 1)); }}
            disabled={busy}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:opacity-50"
          >
            {passo === 1 ? (
              t('indicadores.acoes.cancelar', 'Cancelar')
            ) : (
              <>
                <FiChevronLeft className="h-4 w-4" />
                {t('indicadores.acoes.voltar', 'Voltar')}
              </>
            )}
          </button>

          <div className="flex items-center gap-2">
            {passo === 1 && (
              <button
                type="button"
                onClick={analisar}
                disabled={busy || !arquivo}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-abz-blue px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-blue-800 disabled:opacity-50"
              >
                <FiChevronRight className="h-4 w-4" />
                {busy
                  ? t('indicadores.wizard.analisando', 'Analisando planilha...')
                  : t('indicadores.acoes.analisar', 'Analisar arquivo')}
              </button>
            )}
            {passo === 2 && (
              <button
                type="button"
                onClick={avancarParaPasso3}
                disabled={busy}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-abz-blue px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-blue-800 disabled:opacity-50"
              >
                {t('indicadores.acoes.continuar', 'Continuar')}
                <FiChevronRight className="h-4 w-4" />
              </button>
            )}
            {passo === 3 && (
              <button
                type="button"
                onClick={confirmar}
                disabled={busy}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
              >
                <FiCheck className="h-4 w-4" />
                {busy ? t('indicadores.wizard.importando', 'Importando...') : t('indicadores.wizard.importar', 'Importar')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
