'use client';

/**
 * NfseEmissoesList (§7.1): tabela de emissões (fatura, município, RPS, nº
 * NFS-e, protocolo, status, ambiente), emissão nova (fatura pré-selecionável
 * via ?faturaId=) e NfseDetailModal.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { FiFilePlus, FiRefreshCw, FiEye } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useI18n } from '@/contexts/I18nContext';
import {
  criarNfseEmissao, listFaturas, listNfseConfig, listNfseEmissoes,
} from '@/lib/financeiro/api-client';
import type { FinNfseConfig, FinNfseEmissao } from '@/types/financeiro';
import {
  FIN_BTN_PRIMARY_CLASS,
  FIN_BTN_SECONDARY_CLASS,
  FIN_CARD_CLASS,
  FIN_INPUT_CLASS,
  NfseStatusChip,
  mensagemErro,
} from '@/components/financeiro/shared';
import NfseDetailModal from '@/components/financeiro/NfseDetailModal';

export default function NfseEmissoesList() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const faturaParam = searchParams?.get('faturaId');

  const [emissoes, setEmissoes] = useState<FinNfseEmissao[]>([]);
  const [configs, setConfigs] = useState<FinNfseConfig[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [emissaoAberta, setEmissaoAberta] = useState<string | null>(null);
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [emitirModalAberto, setEmitirModalAberto] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [lista, cfgs] = await Promise.all([listNfseEmissoes({}), listNfseConfig({})]);
      setEmissoes(lista);
      setConfigs(cfgs);
    } catch (e) {
      toast.error(mensagemErro(e, t('financeiro.erroGeral')));
    } finally {
      setCarregando(false);
    }
  }, [t]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Deep-link da aba Faturas: ?faturaId= → abre o modal de emissão pré-selecionado
  useEffect(() => {
    if (faturaParam) {
      setEmissaoAberta(faturaParam);
      setEmitirModalAberto(true);
    }
  }, [faturaParam]);

  function municipioDe(emissao: FinNfseEmissao): string {
    const cfg = configs.find((c) => c.id === emissao.nfse_config_id);
    return cfg?.municipio ? `${cfg.municipio.nome}/${cfg.municipio.uf}` : (cfg?.municipio_id ?? '—');
  }

  function faturaLabel(emissao: FinNfseEmissao): string {
    const fatura = emissao.fatura;
    if (fatura?.numero) return `${fatura.numero}/${fatura.ano}`;
    return emissao.fatura_id.slice(0, 8);
  }

  return (
    <div className={`${FIN_CARD_CLASS} flex min-h-0 flex-1 flex-col overflow-hidden`}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 p-4">
        <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">{t('financeiro.tabNfse')}</h2>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={carregar} className={FIN_BTN_SECONDARY_CLASS} disabled={carregando}>
            <FiRefreshCw className={`h-4 w-4 ${carregando ? 'animate-spin' : ''}`} />
            {t('financeiro.recarregar')}
          </button>
          <button type="button" onClick={() => setEmitirModalAberto(true)} className={FIN_BTN_PRIMARY_CLASS}>
            <FiFilePlus className="h-4 w-4" /> {t('financeiro.nfseEmissaoNova')}
          </button>
        </div>
      </div>

      {/* Tabela */}
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-bold uppercase text-gray-500">{t('financeiro.tabFaturas')}</th>
              <th className="px-4 py-2 text-left text-xs font-bold uppercase text-gray-500">{t('financeiro.nfseMunicipio')}</th>
              <th className="px-4 py-2 text-left text-xs font-bold uppercase text-gray-500">{t('financeiro.nfseRpsNumero')}</th>
              <th className="px-4 py-2 text-left text-xs font-bold uppercase text-gray-500">{t('financeiro.nfseNumero')}</th>
              <th className="px-4 py-2 text-left text-xs font-bold uppercase text-gray-500">{t('financeiro.nfseProtocolo')}</th>
              <th className="px-4 py-2 text-left text-xs font-bold uppercase text-gray-500">{t('financeiro.nfseAmbiente')}</th>
              <th className="px-4 py-2 text-left text-xs font-bold uppercase text-gray-500">{t('financeiro.status')}</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {emissoes.map((emissao) => (
              <tr key={emissao.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-4 py-2 text-sm font-semibold text-gray-900 dark:text-gray-100">{faturaLabel(emissao)}</td>
                <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300">{municipioDe(emissao)}</td>
                <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300">
                  {emissao.rps_numero}/{emissao.rps_serie}
                </td>
                <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300">{emissao.numero_nfse ?? '—'}</td>
                <td className="max-w-40 truncate px-4 py-2 text-sm text-gray-600 dark:text-gray-300" title={emissao.protocolo ?? ''}>
                  {emissao.protocolo ?? '—'}
                </td>
                <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300">
                  {emissao.ambiente === 'producao' ? t('admin.producao') : t('financeiro.nfseHomologacao')}
                </td>
                <td className="px-4 py-2">
                  <NfseStatusChip status={emissao.status} />
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => setDetalheId(emissao.id)}
                    className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-abz-blue"
                    aria-label={t('financeiro.visualizar')}
                  >
                    <FiEye className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {!carregando && emissoes.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-400">
                  {t('financeiro.nenhumaEmissao')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de emissão nova */}
      {emitirModalAberto && (
        <EmitirNfseModal
          faturaInicial={emissaoAberta}
          onClose={() => {
            setEmitirModalAberto(false);
            setEmissaoAberta(null);
          }}
          onEmitida={() => {
            setEmitirModalAberto(false);
            setEmissaoAberta(null);
            carregar();
          }}
        />
      )}

      {detalheId && (
        <NfseDetailModal
          emissaoId={detalheId}
          onClose={() => setDetalheId(null)}
          onAtualizada={() => carregar()}
        />
      )}
    </div>
  );
}

/** Seleciona fatura (status emitida) e dispara POST /nfse/emissoes {faturaId}. */
function EmitirNfseModal({
  faturaInicial,
  onClose,
  onEmitida,
}: {
  faturaInicial: string | null;
  onClose: () => void;
  onEmitida: () => void;
}) {
  const { t } = useI18n();
  const [faturas, setFaturas] = useState<Array<{ id: string; label: string }>>([]);
  const [faturaId, setFaturaId] = useState(faturaInicial ?? '');
  const [emitindo, setEmitindo] = useState(false);

  useEffect(() => {
    listFaturas({ status: 'emitida' })
      .then((lista) =>
        setFaturas(lista.map((f) => ({ id: f.id, label: `${f.numero}/${f.ano}${f.cliente?.nome ? ` — ${f.cliente.nome}` : ''}` }))),
      )
      .catch(() => undefined);
  }, []);

  async function emitir() {
    if (!faturaId) return;
    if (!window.confirm(t('financeiro.nfseEmitirPara'))) return;
    setEmitindo(true);
    try {
      await criarNfseEmissao(faturaId);
      toast.success(t('financeiro.nfseEmissaoNova'));
      onEmitida();
    } catch (e) {
      toast.error(mensagemErro(e, t('financeiro.erroGeral')));
    } finally {
      setEmitindo(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <h3 className="mb-1 text-base font-bold text-gray-900">{t('financeiro.nfseEmissaoNova')}</h3>
        <p className="mb-4 text-xs text-gray-500">{t('financeiro.erroFaturaMoedaInvalida')}</p>
        <label className="mb-1 block text-xs font-bold uppercase text-gray-500">{t('financeiro.tabFaturas')}</label>
        <select value={faturaId} onChange={(e) => setFaturaId(e.target.value)} className={FIN_INPUT_CLASS}>
          <option value="">—</option>
          {faturas.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={FIN_BTN_SECONDARY_CLASS}>
            {t('financeiro.cancelar')}
          </button>
          <button type="button" onClick={emitir} disabled={emitindo || !faturaId} className={FIN_BTN_PRIMARY_CLASS}>
            <FiFilePlus className="h-4 w-4" /> {t('financeiro.emitir')}
          </button>
        </div>
      </div>
    </div>
  );
}
