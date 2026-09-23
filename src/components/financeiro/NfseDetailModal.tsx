'use client';

/**
 * NfseDetailModal (§7.1): resumo tributos, XMLs (copiar/download), ações
 * Consultar/Cancelar (motivo obrigatório) e banner de erro do provider.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { FiX, FiCopy, FiDownload, FiRefreshCw, FiXOctagon, FiAlertTriangle } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useI18n } from '@/contexts/I18nContext';
import { cancelarNfseEmissao, consultarNfseEmissao, getNfseEmissao } from '@/lib/financeiro/api-client';
import type { FinNfseEmissaoDetalhe } from '@/types/financeiro';
import {
  FIN_BTN_PRIMARY_CLASS,
  FIN_BTN_SECONDARY_CLASS,
  FIN_INPUT_CLASS,
  NfseStatusChip,
  baixarTexto,
  copiarTexto,
  formatarData,
  formatarMoeda,
  mensagemErro,
} from '@/components/financeiro/shared';

export default function NfseDetailModal({
  emissaoId,
  onClose,
  onAtualizada,
}: {
  emissaoId: string;
  onClose: () => void;
  onAtualizada?: (emissao: FinNfseEmissaoDetalhe) => void;
}) {
  const { t } = useI18n();
  const [detalhe, setDetalhe] = useState<FinNfseEmissaoDetalhe | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [xmlCarregado, setXmlCarregado] = useState(false);
  const [cancelarAberto, setCancelarAberto] = useState(false);
  const [motivo, setMotivo] = useState('');

  const carregar = useCallback(async () => {
    try {
      // XMLs só descem com ?xml=1 e nível edit (§6) — sob demanda, não no abrir.
      setDetalhe(await getNfseEmissao(emissaoId, { xml: xmlCarregado }));
      setErro(null);
    } catch (e) {
      setErro(mensagemErro(e, t('financeiro.erroGeral')));
    }
  }, [emissaoId, t, xmlCarregado]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function consultar() {
    setOcupado(true);
    try {
      const atualizada = await consultarNfseEmissao(emissaoId);
      toast.success(t('financeiro.nfseConsultaAtualizada'));
      await carregar();
      onAtualizada?.(atualizada as FinNfseEmissaoDetalhe);
    } catch (e) {
      toast.error(mensagemErro(e, t('financeiro.erroGeral')));
    } finally {
      setOcupado(false);
    }
  }

  async function cancelar() {
    if (!motivo.trim()) {
      toast.error(t('financeiro.nfseMotivoObrigatorio'));
      return;
    }
    setOcupado(true);
    try {
      const cancelada = await cancelarNfseEmissao(emissaoId, motivo.trim());
      toast.success(t('financeiro.nfseCanceladaSucesso'));
      setCancelarAberto(false);
      setMotivo('');
      await carregar();
      onAtualizada?.(cancelada as FinNfseEmissaoDetalhe);
    } catch (e) {
      toast.error(mensagemErro(e, t('financeiro.erroGeral')));
    } finally {
      setOcupado(false);
    }
  }

  function secaoXml(rotulo: string, xml?: string | null, indice = 0) {
    if (!xml) return null;
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
        <p className="mb-1 text-xs font-bold uppercase text-gray-500">{rotulo}</p>
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate text-xs text-gray-700">{xml.slice(0, 120)}…</code>
          <button type="button" onClick={() => copiarTexto(xml, t('financeiro.copiado'))} className={FIN_BTN_SECONDARY_CLASS}>
            <FiCopy className="h-4 w-4" /> {t('financeiro.copiar')}
          </button>
          <button
            type="button"
            onClick={() => baixarTexto(`nfse-${emissaoId}-${indice}.xml`, xml)}
            className={FIN_BTN_SECONDARY_CLASS}
          >
            <FiDownload className="h-4 w-4" /> {t('financeiro.baixar')}
          </button>
        </div>
      </div>
    );
  }

  const tributos = detalhe?.resumo_tributos;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-0 sm:p-2">
      <div
        role="dialog"
        aria-modal="true"
        className="flex h-[100dvh] w-full max-w-3xl flex-col overflow-hidden rounded-none border-0 bg-white shadow-2xl sm:h-[min(96dvh,calc(100dvh-1rem))] sm:rounded-2xl sm:border sm:border-gray-200 animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-abz-blue text-white shadow-sm">
              <span className="text-sm font-bold">NF</span>
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold text-gray-900 sm:text-lg">
                {t('financeiro.tabNfse')} · {t('financeiro.nfseRpsNumero')} {detalhe?.rps_numero ?? '…'}
                {detalhe?.numero_nfse ? ` · ${t('financeiro.nfseNumero')} ${detalhe.numero_nfse}` : ''}
              </h2>
              {detalhe && (
                <p className="text-xs text-gray-500">
                  {detalhe.provider_key} · {detalhe.ambiente === 'producao' ? t('admin.producao') : t('financeiro.nfseHomologacao')} ·{' '}
                  {formatarData(detalhe.created_at)}
                </p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {detalhe && <NfseStatusChip status={detalhe.status} />}
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
        <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4 sm:p-6">
          {erro && <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{erro}</p>}
          {!detalhe && !erro && <p className="text-sm text-gray-500">{t('financeiro.carregando')}</p>}

          {detalhe?.status === 'rejeitado' && detalhe.mensagem_erro && (
            <div className="flex items-start gap-3 rounded-lg border border-rose-300 bg-rose-50 p-4">
              <FiAlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
              <div className="text-sm text-rose-800">
                <p className="font-bold">{t('financeiro.nfseRejeitado')}</p>
                <p>
                  {detalhe.mensagem_erro.codigo ? `${detalhe.mensagem_erro.codigo} — ` : ''}
                  {detalhe.mensagem_erro.mensagem ?? '—'}
                </p>
              </div>
            </div>
          )}

          {detalhe && (
            <>
              {/* Identificação */}
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div>
                  <p className="text-xs font-bold uppercase text-gray-400">{t('financeiro.nfseRpsNumero')}</p>
                  <p className="font-semibold text-gray-900">{detalhe.rps_numero}/{detalhe.rps_serie}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-gray-400">{t('financeiro.nfseProtocolo')}</p>
                  <p className="truncate font-semibold text-gray-900" title={detalhe.protocolo ?? ''}>{detalhe.protocolo ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-gray-400">{t('financeiro.nfseNumero')}</p>
                  <p className="font-semibold text-gray-900">{detalhe.numero_nfse ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-gray-400">{t('financeiro.nfseCodigoVerificacao')}</p>
                  <p className="truncate font-semibold text-gray-900">{detalhe.codigo_verificacao ?? '—'}</p>
                </div>
              </div>

              {/* Tributos */}
              {tributos && (
                <div className="rounded-xl border border-gray-200 p-4">
                  <p className="mb-2 text-xs font-bold uppercase text-gray-400">{t('financeiro.nfseTributos')}</p>
                  <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                    <div>
                      <p className="text-gray-400">{t('financeiro.nfseValorServicos')}</p>
                      <p className="font-semibold text-gray-900">{formatarMoeda(tributos.valorServicos ?? 0)}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">{t('admin.aliquotaIss')}</p>
                      <p className="font-semibold text-gray-900">{tributos.aliquotaIss ?? 0}%</p>
                    </div>
                    <div>
                      <p className="text-gray-400">{t('financeiro.nfseValorIss')}</p>
                      <p className="font-semibold text-gray-900">{formatarMoeda(tributos.valorIss ?? 0)}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">{t('financeiro.nfseIssRetido')}</p>
                      <p className="font-semibold text-gray-900">{tributos.issRetido ? t('common.yes') : t('common.no')}</p>
                    </div>
                    {tributos.baseCalculo !== undefined && (
                      <div>
                        <p className="text-gray-400">{t('financeiro.nfseBaseCalculo')}</p>
                        <p className="font-semibold text-gray-900">{formatarMoeda(tributos.baseCalculo)}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* XMLs */}
              <div className="space-y-2">
                {xmlCarregado ? (
                  <>
                    {secaoXml(t('financeiro.nfseXmlRps'), detalhe.xml_rps, 1)}
                    {secaoXml(t('financeiro.nfseXmlNfse'), detalhe.xml_nfse, 2)}
                    {secaoXml(t('financeiro.nfseXmlCancelamento'), detalhe.xml_cancelamento, 3)}
                    {!detalhe.xml_rps && !detalhe.xml_nfse && !detalhe.xml_cancelamento && (
                      <p className="text-xs text-gray-400">—</p>
                    )}
                  </>
                ) : (
                  <button type="button" onClick={() => setXmlCarregado(true)} className={FIN_BTN_SECONDARY_CLASS}>
                    <FiDownload className="h-4 w-4" /> {t('financeiro.nfseCarregarXmls')}
                  </button>
                )}
              </div>

              {/* Ações */}
              <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
                <button type="button" onClick={consultar} disabled={ocupado} className={FIN_BTN_SECONDARY_CLASS}>
                  <FiRefreshCw className={`h-4 w-4 ${ocupado ? 'animate-spin' : ''}`} /> {t('financeiro.nfseConsultar')}
                </button>
                {detalhe.status === 'autorizado' && (
                  <button
                    type="button"
                    onClick={() => setCancelarAberto((v) => !v)}
                    className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50"
                  >
                    <FiXOctagon className="h-4 w-4" /> {t('financeiro.nfseCancelar')}
                  </button>
                )}
              </div>
              {cancelarAberto && (
                <div className="space-y-2 rounded-xl border border-rose-200 bg-rose-50/50 p-4">
                  <label className="block text-xs font-bold uppercase text-gray-500">{t('financeiro.nfseMotivo')} *</label>
                  <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} className={FIN_INPUT_CLASS} />
                  <div className="flex justify-end">
                    <button type="button" onClick={cancelar} disabled={ocupado} className={FIN_BTN_PRIMARY_CLASS}>
                      <FiXOctagon className="h-4 w-4" /> {t('financeiro.confirmar')}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
