'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FiAlertCircle,
  FiBarChart2,
  FiCalendar,
  FiExternalLink,
  FiFileText,
  FiFolder,
  FiLoader,
  FiPlus,
  FiRefreshCw,
  FiTrendingUp,
  FiTrash2,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { fetchWithToken } from '@/lib/tokenStorage';
import GtPageShell, { GT_PAGE_SCROLLPORT_CLASS } from '@/components/gestao-tripulantes/GtPageShell';
import ImportadorPlanilhasModal, { type ImportadorPrefill } from '@/components/indicadores/ImportadorPlanilhasModal';
import WorkspaceAbaModal from '@/components/indicadores/WorkspaceAbaModal';
import ConfirmacaoModal from '@/components/indicadores/ConfirmacaoModal';
import {
  formatarDataHoraBR,
  type IndicadorEnvelope,
  type PlanilhaAba,
  type PlanilhaItem,
  type PlanilhasData,
} from '@/components/indicadores/types';

interface WorkspaceAberto {
  planilha: PlanilhaItem;
  aba: PlanilhaAba;
}

/** Página /department/indicadores — datasets (planilhas) do Recrutamento & Seleção. */
export default function IndicadoresPage() {
  const { user, isLoading: authLoading, hasFeature } = useSupabaseAuth();
  const router = useRouter();
  const { t } = useI18n();

  const podeImportar = hasFeature('indicadores.import');

  const [planilhas, setPlanilhas] = useState<PlanilhaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [wizardAberto, setWizardAberto] = useState(false);
  const [wizardPrefill, setWizardPrefill] = useState<ImportadorPrefill | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceAberto | null>(null);
  const [excluirAlvo, setExcluirAlvo] = useState<PlanilhaItem | null>(null);
  const [busyExcluir, setBusyExcluir] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const carregarPlanilhas = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const res = await fetchWithToken('/api/indicadores/planilhas');
      const json = (await res.json()) as IndicadorEnvelope<PlanilhasData>;
      if (res.ok && json.success && json.data) {
        setPlanilhas(json.data.planilhas ?? []);
      } else {
        setPlanilhas([]);
        setErro(json.error || t('indicadores.erroCarregar', 'Erro ao carregar planilhas'));
      }
    } catch {
      setPlanilhas([]);
      setErro(t('indicadores.erroCarregar', 'Erro ao carregar planilhas'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (user) carregarPlanilhas();
  }, [user, carregarPlanilhas]);

  const abrirWizardNovo = () => {
    setWizardPrefill(null);
    setWizardAberto(true);
  };

  const abrirWizardReimportar = (planilha: PlanilhaItem) => {
    setWizardPrefill({ modo: 'substituir', planilhaId: planilha.id, nome: planilha.nome });
    setWizardAberto(true);
  };

  const excluirDataset = async () => {
    if (!excluirAlvo) return;
    setBusyExcluir(true);
    try {
      const res = await fetchWithToken(`/api/indicadores/planilhas/${excluirAlvo.id}`, { method: 'DELETE' });
      const json = (await res.json()) as IndicadorEnvelope<unknown>;
      if (res.ok && json.success) {
        toast.success(t('indicadores.datasetExcluido', 'Planilha excluída'));
        setExcluirAlvo(null);
        await carregarPlanilhas();
      } else {
        setErro(json.error || t('indicadores.erroExcluirDataset', 'Erro ao excluir planilha'));
      }
    } catch {
      setErro(t('indicadores.erroExcluirDataset', 'Erro ao excluir planilha'));
    } finally {
      setBusyExcluir(false);
    }
  };

  return (
    <GtPageShell className="gap-3 p-1">
      {/* Cabeçalho */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-abz-blue text-white shadow-sm">
            <FiBarChart2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold text-gray-900 sm:text-xl">
              {t('indicadores.titulo', 'Indicadores R&S')}
            </h1>
            <p className="hidden truncate text-xs text-gray-500 sm:block">
              {t('indicadores.subtitulo', 'Indicadores e controle de vagas do Recrutamento & Seleção')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/department/indicadores/kpi"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-50"
            title={t('indicadores.kpi.titulo', 'KPIs & Avaliação R&S')}
          >
            <FiTrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">{t('indicadores.kpi.titulo', 'KPIs & Avaliação R&S')}</span>
          </Link>
          <button
            type="button"
            onClick={carregarPlanilhas}
            disabled={loading}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
            title={t('indicadores.recarregar', 'Recarregar')}
          >
            <FiRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{t('indicadores.recarregar', 'Recarregar')}</span>
          </button>
          {podeImportar && (
            <button
              type="button"
              onClick={abrirWizardNovo}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-abz-blue px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-blue-800"
            >
              <FiPlus className="h-4 w-4" />
              {t('indicadores.importar', 'Importar planilha')}
            </button>
          )}
        </div>
      </div>

      {/* Conteúdo */}
      <div className={GT_PAGE_SCROLLPORT_CLASS}>
        {loading ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center gap-2 text-sm text-gray-500">
            <FiLoader className="h-6 w-6 animate-spin text-gray-400" />
            {t('indicadores.carregando', 'Carregando planilhas...')}
          </div>
        ) : erro ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center gap-3">
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <FiAlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="whitespace-pre-wrap break-words">{erro}</span>
            </div>
            <button
              type="button"
              onClick={carregarPlanilhas}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
            >
              <FiRefreshCw className="h-4 w-4" />
              {t('indicadores.tentarNovamente', 'Tentar novamente')}
            </button>
          </div>
        ) : planilhas.length === 0 ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 py-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-400">
              <FiFolder className="h-7 w-7" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-800">
                {t('indicadores.vazioTitulo', 'Nenhuma planilha importada')}
              </h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">
                {t(
                  'indicadores.vazioDescricao',
                  'Importe uma planilha XLSX para começar a acompanhar os indicadores do Recrutamento & Seleção.',
                )}
              </p>
            </div>
            {podeImportar && (
              <button
                type="button"
                onClick={abrirWizardNovo}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-abz-blue px-5 py-2 text-sm font-bold text-white shadow-md transition hover:bg-blue-800"
              >
                <FiPlus className="h-4 w-4" />
                {t('indicadores.importarPrimeira', 'Importar primeira planilha')}
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 pb-4 sm:grid-cols-2 xl:grid-cols-3">
            {planilhas.map((planilha) => (
              <article
                key={planilha.id}
                className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-abz-blue/40 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-bold text-gray-900" title={planilha.nome}>
                      {planilha.nome}
                    </h3>
                    <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-gray-500" title={planilha.arquivoNome}>
                      <FiFileText className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{planilha.arquivoNome}</span>
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] text-gray-400">
                      <FiCalendar className="h-3 w-3 shrink-0" />
                      {t('indicadores.criadoEm', 'Criado em')} {formatarDataHoraBR(planilha.criadoEm)}
                    </p>
                  </div>
                </div>

                {/* Chips das abas — abrem o workspace */}
                <div className="flex flex-wrap gap-1.5">
                  {planilha.abas.length === 0 ? (
                    <span className="text-xs italic text-gray-400">
                      {t('indicadores.semAbas', 'Nenhuma aba')}
                    </span>
                  ) : (
                    planilha.abas.map((aba) => (
                      <button
                        key={aba.id}
                        type="button"
                        onClick={() => setWorkspace({ planilha, aba })}
                        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-abz-blue transition hover:border-abz-blue hover:bg-blue-100"
                        title={t('indicadores.abrirAba', 'Abrir aba')}
                      >
                        <FiExternalLink className="h-3 w-3 shrink-0" />
                        <span className="max-w-[160px] truncate">{aba.nome}</span>
                        <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-bold text-gray-500">
                          {aba.totalLinhas.toLocaleString('pt-BR')}
                        </span>
                      </button>
                    ))
                  )}
                </div>

                {/* Ações do dataset */}
                <div className="mt-auto flex items-center justify-end gap-2 border-t border-gray-100 pt-3">
                  {podeImportar && (
                    <button
                      type="button"
                      onClick={() => abrirWizardReimportar(planilha)}
                      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-50"
                    >
                      <FiRefreshCw className="h-3.5 w-3.5" />
                      {t('indicadores.reimportar', 'Reimportar')}
                    </button>
                  )}
                  {podeImportar && (
                    <button
                      type="button"
                      onClick={() => setExcluirAlvo(planilha)}
                      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                    >
                      <FiTrash2 className="h-3.5 w-3.5" />
                      {t('indicadores.excluirDataset', 'Excluir dataset')}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {/* Wizard de importação */}
      <ImportadorPlanilhasModal
        isOpen={wizardAberto}
        onClose={() => setWizardAberto(false)}
        onImportado={async () => {
          setWizardAberto(false);
          toast.success(t('indicadores.wizard.sucesso', 'Importação concluída'));
          await carregarPlanilhas();
        }}
        planilhas={planilhas.map((p) => ({ id: p.id, nome: p.nome }))}
        prefill={wizardPrefill}
      />

      {/* Workspace da aba */}
      {workspace && (
        <WorkspaceAbaModal
          isOpen
          onClose={() => setWorkspace(null)}
          planilhaNome={workspace.planilha.nome}
          aba={workspace.aba}
          podeEditar={hasFeature('indicadores.edit')}
          onDadosAlterados={carregarPlanilhas}
        />
      )}

      {/* Confirmação de exclusão do dataset */}
      <ConfirmacaoModal
        isOpen={excluirAlvo != null}
        titulo={t('indicadores.excluirDataset', 'Excluir dataset')}
        descricao={t(
          'indicadores.confirmarExcluirDataset',
          { nome: excluirAlvo?.nome ?? '' },
          'Excluir a planilha "{nome}" e todas as suas abas? Esta ação não pode ser desfeita.',
        )}
        confirmarLabel={t('indicadores.excluirDataset', 'Excluir dataset')}
        busy={busyExcluir}
        perigoso
        onConfirmar={excluirDataset}
        onCancelar={() => setExcluirAlvo(null)}
      />
    </GtPageShell>
  );
}
