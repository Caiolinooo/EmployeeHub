'use client';

import React, { useCallback, useEffect, useState } from 'react';
import MainLayout from '@/components/Layout/MainLayout';
import GtPageShell, { GT_PAGE_SCROLLPORT_CLASS } from '@/components/gestao-tripulantes/GtPageShell';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { fetchWithToken } from '@/lib/tokenStorage';
import { toast } from 'react-hot-toast';
import { useEscapeToClose } from '@/hooks/useEscapeToClose';
import { useEscapeCapture } from '@/hooks/useEscapeCapture';
import { useRestoreFocus } from '@/hooks/useRestoreFocus';
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiClock,
  FiDownload,
  FiEye,
  FiFileText,
  FiRefreshCw,
  FiX,
} from 'react-icons/fi';

/**
 * /contracheque — viewer nativo do colaborador (design §4): lista as
 * competências de folhas approved/paid vinculadas ao usuário (CPF do perfil),
 * visualiza o holerite em modal (HTML da API), aceita/assina com carimbo
 * SHA-256 (confirmação explícita + toast) e baixa o PDF (?pdf=1).
 */

interface ContrachequeItem {
  sheet_id: string;
  mes: number;
  ano: number;
  competencia: string;
  empresa: { nome: string; cnpj: string };
  status: string;
  aceito_em: string | null;
}

export default function ContrachequePage() {
  const { user, isLoading: authLoading } = useSupabaseAuth();
  const { t, locale } = useI18n();

  const [lista, setLista] = useState<ContrachequeItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modal, setModal] = useState<{ item: ContrachequeItem; html: string } | null>(null);
  const [confirmando, setConfirmando] = useState<ContrachequeItem | null>(null);
  const [busyAceite, setBusyAceite] = useState(false);
  const [busyPdf, setBusyPdf] = useState<string | null>(null);

  const closeModal = () => setModal(null);
  const closeConfirm = () => {
    if (!busyAceite) setConfirmando(null);
  };
  useEscapeToClose(!!modal && !confirmando, closeModal);
  useEscapeCapture(!!modal && !confirmando, closeModal);
  useRestoreFocus(!!modal && !confirmando);
  useEscapeToClose(!!confirmando, closeConfirm);
  useEscapeCapture(!!confirmando, closeConfirm);
  useRestoreFocus(!!confirmando);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const res = await fetchWithToken('/api/contracheque');
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`);
      setLista(json.data || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('contracheque.erroCarregar', 'Não foi possível carregar seus contracheques.'));
    } finally {
      setCarregando(false);
    }
  }, [t]);

  useEffect(() => {
    if (user) carregar();
  }, [user, carregar]);

  const abrir = async (item: ContrachequeItem) => {
    try {
      const res = await fetchWithToken(`/api/contracheque/${item.sheet_id}`);
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || `HTTP ${res.status}`);
      }
      const html = await res.text();
      setModal({ item, html });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('contracheque.erroCarregar', 'Não foi possível carregar o contracheque.'));
    }
  };

  const baixarPdf = async (item: ContrachequeItem) => {
    setBusyPdf(item.sheet_id);
    try {
      const res = await fetchWithToken(`/api/contracheque/${item.sheet_id}?pdf=1`);
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contracheque-${item.competencia.replace('/', '-')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('contracheque.erroPdf', 'Não foi possível gerar o PDF.'));
    } finally {
      setBusyPdf(null);
    }
  };

  const aceitar = async (item: ContrachequeItem) => {
    setBusyAceite(true);
    try {
      const res = await fetchWithToken(`/api/contracheque/${item.sheet_id}/aceite`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`);
      const aceitoEm = json.data?.aceito_em as string;
      setLista((atual) => atual.map((c) => (c.sheet_id === item.sheet_id ? { ...c, aceito_em: aceitoEm } : c)));
      setModal((atual) =>
        atual && atual.item.sheet_id === item.sheet_id
          ? { ...atual, item: { ...atual.item, aceito_em: aceitoEm } }
          : atual,
      );
      toast.success(t('contracheque.aceitoSucesso', 'Contracheque aceito e assinado com sucesso.'));
      setConfirmando(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('contracheque.erroAceite', 'Não foi possível registrar o aceite.'));
    } finally {
      setBusyAceite(false);
    }
  };

  const formatarData = (iso: string) => new Date(iso).toLocaleString(locale === 'en-US' ? 'en-US' : 'pt-BR');

  if (authLoading || !user) return null;

  return (
    <MainLayout>
      <GtPageShell className="gap-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xs shrink-0">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-blue-50 dark:bg-blue-900/40 text-abz-blue rounded-xl">
              <FiFileText className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-lg font-black text-gray-900 dark:text-gray-100">{t('contracheque.pageTitle', 'Contracheques')}</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">
                {t('contracheque.description', 'Acesse seus contracheques e informações salariais')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={carregar}
            disabled={carregando}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 transition hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            <FiRefreshCw className={`h-4 w-4 ${carregando ? 'animate-spin' : ''}`} />
            {t('contracheque.atualizar', 'Atualizar')}
          </button>
        </div>

        {/* Lista de competências */}
        <div className={GT_PAGE_SCROLLPORT_CLASS}>
          {carregando ? (
            <div className="flex items-center justify-center py-16 text-sm text-gray-500 dark:text-gray-400">
              <FiRefreshCw className="mr-2 h-4 w-4 animate-spin" />
              {t('contracheque.loading', 'Carregando contracheques...')}
            </div>
          ) : lista.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <FiFileText className="h-8 w-8 text-gray-300 dark:text-gray-600" />
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                {t('contracheque.empty', 'Nenhum contracheque disponível no momento.')}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 max-w-md">
                {t('contracheque.emptyHint', 'Contracheques aparecem aqui após a aprovação da folha de pagamento pelo DP.')}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 pb-4">
              {lista.map((item) => (
                <div
                  key={item.sheet_id}
                  className="flex flex-col gap-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">{item.empresa.nome}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {t('contracheque.competencia', 'Competência')}: <span className="font-semibold">{item.competencia}</span>
                      </p>
                    </div>
                    {item.aceito_em ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-green-100 dark:bg-green-900/40 px-2.5 py-1 text-[11px] font-semibold text-green-700 dark:text-green-300">
                        <FiCheckCircle className="h-3.5 w-3.5" />
                        {t('contracheque.badgeAceito', 'Aceito')}
                      </span>
                    ) : (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/40 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                        <FiClock className="h-3.5 w-3.5" />
                        {t('contracheque.badgePendente', 'Pendente')}
                      </span>
                    )}
                  </div>
                  {item.aceito_em && (
                    <p className="text-[11px] text-gray-400 dark:text-gray-500">
                      {t('contracheque.assinadoEm', 'Assinado em')} {formatarData(item.aceito_em)}
                    </p>
                  )}
                  <div className="mt-auto flex gap-2">
                    <button
                      type="button"
                      onClick={() => abrir(item)}
                      className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-2 rounded-lg bg-abz-blue px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-800"
                    >
                      <FiEye className="h-4 w-4" />
                      {t('contracheque.ver', 'Ver')}
                    </button>
                    <button
                      type="button"
                      onClick={() => baixarPdf(item)}
                      disabled={busyPdf === item.sheet_id}
                      className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 transition hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                    >
                      {busyPdf === item.sheet_id ? (
                        <FiRefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <FiDownload className="h-4 w-4" />
                      )}
                      {t('contracheque.baixarPdf', 'PDF')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal de visualização */}
        {modal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4">
            <div
              data-modal-panel=""
              className="flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-2xl max-lg:max-h-[100dvh]"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 dark:border-gray-700 px-4 py-3 shrink-0">
                <div className="flex min-w-0 items-center gap-2">
                  <FiFileText className="h-5 w-5 shrink-0 text-abz-blue" />
                  <h3 className="truncate text-sm font-bold text-gray-900 dark:text-gray-100 sm:text-base">
                    {t('contracheque.pageTitle', 'Contracheque')} — {modal.item.competencia}
                  </h3>
                  {modal.item.aceito_em ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-green-100 dark:bg-green-900/40 px-2 py-0.5 text-[11px] font-semibold text-green-700 dark:text-green-300">
                      <FiCheckCircle className="h-3 w-3" />
                      {t('contracheque.badgeAceito', 'Aceito')}
                    </span>
                  ) : (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                      <FiClock className="h-3 w-3" />
                      {t('contracheque.badgePendente', 'Pendente')}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!modal.item.aceito_em && (
                    <button
                      type="button"
                      onClick={() => setConfirmando(modal.item)}
                      className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-green-700"
                    >
                      <FiCheckCircle className="h-4 w-4" />
                      {t('contracheque.aceitarAssinar', 'Aceitar e assinar')}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => baixarPdf(modal.item)}
                    disabled={busyPdf === modal.item.sheet_id}
                    className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 transition hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                  >
                    {busyPdf === modal.item.sheet_id ? (
                      <FiRefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <FiDownload className="h-4 w-4" />
                    )}
                    {t('contracheque.baixarPdf', 'Baixar PDF')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setModal(null)}
                    data-modal-close=""
                    className="min-h-[40px] min-w-[40px] rounded-lg p-2 text-gray-400 transition hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200"
                    aria-label={t('contracheque.fechar', 'Fechar')}
                  >
                    <FiX className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <iframe
                title={`${t('contracheque.pageTitle', 'Contracheque')} ${modal.item.competencia}`}
                srcDoc={modal.html}
                className="min-h-0 w-full flex-1 bg-white"
              />
            </div>
          </div>
        )}

        {/* Confirmação de aceite (padrão ConfirmacaoModal: sem window.confirm) */}
        {confirmando && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
            <div
              data-modal-panel=""
              className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-2xl"
              role="alertdialog"
              aria-modal="true"
              aria-label={t('contracheque.confirmarAceiteTitulo', 'Aceitar e assinar contracheque')}
            >
              <div className="flex items-start justify-between gap-3 border-b border-gray-200 dark:border-gray-700 px-5 py-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-green-600 text-white shadow-sm">
                    <FiCheckCircle className="h-4 w-4" />
                  </span>
                  <h3 className="truncate text-sm font-bold text-gray-900 dark:text-gray-100 sm:text-base">
                    {t('contracheque.confirmarAceiteTitulo', 'Aceitar e assinar contracheque')}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmando(null)}
                  disabled={busyAceite}
                  data-modal-close=""
                  className="min-h-[44px] min-w-[44px] rounded-lg p-2 text-gray-400 transition hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-50"
                  aria-label={t('contracheque.fechar', 'Fechar')}
                >
                  <FiX className="h-5 w-5" />
                </button>
              </div>
              <div className="px-5 py-4 text-sm text-gray-600 dark:text-gray-300">
                <p>
                  {t(
                    'contracheque.confirmarAceiteTexto',
                    'Declaro que recebi e conferi o contracheque da competência {{competencia}}. Ao confirmar, registro minha assinatura eletrônica com data, hora e hash de verificação.',
                    ).replace('{{competencia}}', confirmando.competencia)}
                </p>
                <p className="mt-2 flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
                  <FiAlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  {t('contracheque.confirmarAceiteAviso', 'Esta ação é registrada em auditoria e não pode ser desfeita.')}
                </p>
              </div>
              <div className="flex justify-end gap-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-5 py-3 rounded-b-2xl">
                <button
                  type="button"
                  onClick={() => setConfirmando(null)}
                  disabled={busyAceite}
                  className="min-h-[44px] rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 transition hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                >
                  {t('contracheque.cancelar', 'Cancelar')}
                </button>
                <button
                  type="button"
                  onClick={() => aceitar(confirmando)}
                  disabled={busyAceite}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700 disabled:opacity-50"
                >
                  {busyAceite && <FiRefreshCw className="h-4 w-4 animate-spin" />}
                  {t('contracheque.confirmar', 'Confirmar aceite')}
                </button>
              </div>
            </div>
          </div>
        )}
      </GtPageShell>
    </MainLayout>
  );
}
