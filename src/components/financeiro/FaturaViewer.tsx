'use client';

/**
 * FaturaViewer (§7.1): iframe do render HTML A4 autenticado (fetch → blob URL,
 * pois /render e /pdf exigem Bearer) com botões PDF / XLSX / Emitir.
 */
import React, { useEffect, useState } from 'react';
import { FiX, FiFileText, FiGrid, FiCheckCircle } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useI18n } from '@/contexts/I18nContext';
import { emitirFatura, faturaRenderUrl, faturaPdfUrl, faturaXlsxUrl } from '@/lib/financeiro/api-client';
import { fetchWithToken } from '@/lib/tokenStorage';
import type { FinFatura } from '@/types/financeiro';
import { FIN_BTN_PRIMARY_CLASS, FIN_BTN_SECONDARY_CLASS, mensagemErro } from '@/components/financeiro/shared';

async function baixarBlob(url: string): Promise<Blob> {
  const res = await fetchWithToken(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.blob();
}

export default function FaturaViewer({
  fatura,
  onClose,
  onEmitida,
}: {
  fatura: FinFatura;
  onClose: () => void;
  onEmitida?: (fatura: FinFatura) => void;
}) {
  const { t } = useI18n();
  const [htmlUrl, setHtmlUrl] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [emitindo, setEmitindo] = useState(false);

  useEffect(() => {
    let url: string | null = null;
    let vivo = true;
    baixarBlob(faturaRenderUrl(fatura.id))
      .then((blob) => {
        if (!vivo) return;
        url = URL.createObjectURL(blob);
        setHtmlUrl(url);
      })
      .catch((e) => {
        if (vivo) setErro(mensagemErro(e, t('financeiro.erroGeral')));
      });
    return () => {
      vivo = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [fatura.id, t]);

  async function baixarArquivo(url: string, nomeArquivo: string) {
    try {
      const blob = await baixarBlob(url);
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = nomeArquivo;
      a.click();
      URL.revokeObjectURL(objUrl);
    } catch (e) {
      toast.error(mensagemErro(e, t('financeiro.erroGeral')));
    }
  }

  async function emitir() {
    if (!window.confirm(t('financeiro.emitirConfirmar'))) return;
    setEmitindo(true);
    try {
      const emitida = await emitirFatura(fatura.id);
      toast.success(t('financeiro.faturaEmitida'));
      onEmitida?.(emitida);
      onClose();
    } catch (e) {
      toast.error(mensagemErro(e, t('financeiro.erroGeral')));
    } finally {
      setEmitindo(false);
    }
  }

  const prefixo = `Fatura-${fatura.numero}-${fatura.ano}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-0 sm:p-2">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('financeiro.renderTitulo')}
        className="flex h-[100dvh] w-full max-w-none flex-col overflow-hidden rounded-none border-0 bg-white shadow-2xl sm:h-[min(98dvh,calc(100dvh-1rem))] sm:rounded-2xl sm:border sm:border-gray-200 animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-abz-blue text-white shadow-sm">
              <FiFileText className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold text-gray-900 sm:text-lg">
                {t('financeiro.renderTitulo')} · {fatura.numero}/{fatura.ano}
              </h2>
              <p className="text-xs text-gray-500">
                {t('financeiro.moeda')}: {fatura.moeda} · {t('financeiro.total')}: {fatura.valor_total.toFixed(2)}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => baixarArquivo(faturaPdfUrl(fatura.id), `${prefixo}.pdf`)}
              className={FIN_BTN_SECONDARY_CLASS}
            >
              <FiFileText className="h-4 w-4" /> PDF
            </button>
            <button
              type="button"
              onClick={() => baixarArquivo(faturaXlsxUrl(fatura.id), `${prefixo}.xlsx`)}
              className={FIN_BTN_SECONDARY_CLASS}
            >
              <FiGrid className="h-4 w-4" /> XLSX
            </button>
            {fatura.status === 'rascunho' && (
              <button type="button" onClick={emitir} disabled={emitindo} className={FIN_BTN_PRIMARY_CLASS}>
                <FiCheckCircle className="h-4 w-4" /> {t('financeiro.emitir')}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-200 hover:text-gray-700"
              aria-label={t('financeiro.fechar')}
            >
              <FiX className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Corpo */}
        <div className="min-h-0 flex-1 bg-gray-100 p-2 sm:p-4">
          {erro && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{erro}</div>
          )}
          {!erro && !htmlUrl && <p className="p-4 text-sm text-gray-500">{t('financeiro.carregando')}</p>}
          {htmlUrl && (
            <iframe title={t('financeiro.renderTitulo')} src={htmlUrl} className="h-full w-full rounded-lg border border-gray-200 bg-white shadow-inner" />
          )}
        </div>
      </div>
    </div>
  );
}
