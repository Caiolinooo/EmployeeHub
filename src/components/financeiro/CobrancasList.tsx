'use client';

/**
 * CobrancasList (§7.1): boletos/pix por status com ação Atualizar
 * (POST /cobrancas/[id]/atualizar reconsulta o adapter).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { FiRefreshCw } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useI18n } from '@/contexts/I18nContext';
import { atualizarCobranca, listCobrancas } from '@/lib/financeiro/api-client';
import type { FinCobranca } from '@/types/financeiro';
import {
  CobrancaStatusChip,
  FIN_BTN_SECONDARY_CLASS,
  FIN_CARD_CLASS,
  FIN_INPUT_CLASS,
  copiarTexto,
  formatarData,
  formatarMoeda,
  mensagemErro,
} from '@/components/financeiro/shared';
import type { FinCobrancaStatus } from '@/types/financeiro';

const STATUS_OPTIONS: Array<FinCobrancaStatus | ''> = ['', 'pendente', 'gerada', 'liquidada', 'expirada', 'cancelada'];

/** Status → chave i18n (cobrancaPendente/cobrancaGerada/...). */
const COBRANCA_STATUS_LABEL_KEY: Record<FinCobrancaStatus, string> = {
  pendente: 'financeiro.cobrancaPendente',
  gerada: 'financeiro.cobrancaGerada',
  liquidada: 'financeiro.cobrancaLiquidada',
  expirada: 'financeiro.cobrancaExpirada',
  cancelada: 'financeiro.cobrancaCancelada',
};

export default function CobrancasList() {
  const { t } = useI18n();
  const [cobrancas, setCobrancas] = useState<FinCobranca[]>([]);
  const [statusFiltro, setStatusFiltro] = useState<FinCobrancaStatus | ''>('');
  const [carregando, setCarregando] = useState(true);
  const [atualizandoId, setAtualizandoId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      setCobrancas(await listCobrancas({ status: statusFiltro || undefined }));
    } catch (e) {
      toast.error(mensagemErro(e, t('financeiro.erroGeral')));
    } finally {
      setCarregando(false);
    }
  }, [statusFiltro, t]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function atualizar(cobranca: FinCobranca) {
    setAtualizandoId(cobranca.id);
    try {
      const atualizada = await atualizarCobranca(cobranca.id);
      setCobrancas((atual) => atual.map((c) => (c.id === atualizada.id ? atualizada : c)));
    } catch (e) {
      toast.error(mensagemErro(e, t('financeiro.erroGeral')));
    } finally {
      setAtualizandoId(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500">{t('financeiro.cobrancas')}</h3>
        <div className="ml-auto flex items-center gap-2">
          <select
            value={statusFiltro}
            onChange={(e) => setStatusFiltro(e.target.value as FinCobrancaStatus | '')}
            className={`${FIN_INPUT_CLASS} w-auto`}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s || 'todas'} value={s}>
                {s ? t(COBRANCA_STATUS_LABEL_KEY[s]) : t('financeiro.todosStatus')}
              </option>
            ))}
          </select>
          <button type="button" onClick={carregar} className={FIN_BTN_SECONDARY_CLASS} disabled={carregando}>
            <FiRefreshCw className={`h-4 w-4 ${carregando ? 'animate-spin' : ''}`} />
            {t('financeiro.recarregar')}
          </button>
        </div>
      </div>

      <div className={`${FIN_CARD_CLASS} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-bold uppercase text-gray-500">{t('financeiro.tipoCobranca')}</th>
                <th className="px-4 py-2 text-right text-xs font-bold uppercase text-gray-500">{t('financeiro.valor')}</th>
                <th className="px-4 py-2 text-left text-xs font-bold uppercase text-gray-500">{t('financeiro.vencimento')}</th>
                <th className="px-4 py-2 text-left text-xs font-bold uppercase text-gray-500">{t('financeiro.linhaDigitavel')}</th>
                <th className="px-4 py-2 text-left text-xs font-bold uppercase text-gray-500">{t('financeiro.status')}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {cobrancas.map((cobranca) => (
                <tr key={cobranca.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
                    {cobranca.tipo === 'boleto' ? t('financeiro.boleto') : cobranca.tipo === 'pix' ? t('financeiro.pix') : cobranca.tipo}
                  </td>
                  <td className="px-4 py-2 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {formatarMoeda(cobranca.valor)}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300">{formatarData(cobranca.vencimento)}</td>
                  <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300">
                    {cobranca.linha_digitavel || cobranca.txid ? (
                      <button
                        type="button"
                        onClick={() => copiarTexto(cobranca.linha_digitavel || cobranca.txid || '', t('financeiro.copiado'))}
                        className="max-w-48 truncate text-left font-mono text-xs text-abz-blue hover:underline"
                        title={cobranca.linha_digitavel || cobranca.txid || ''}
                      >
                        {cobranca.linha_digitavel || cobranca.txid}
                      </button>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <CobrancaStatusChip status={cobranca.status} />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => atualizar(cobranca)}
                      disabled={atualizandoId === cobranca.id}
                      className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-abz-blue disabled:opacity-40"
                      aria-label={t('financeiro.atualizar')}
                    >
                      <FiRefreshCw className={`h-4 w-4 ${atualizandoId === cobranca.id ? 'animate-spin' : ''}`} />
                    </button>
                  </td>
                </tr>
              ))}
              {!carregando && cobrancas.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">
                    {t('financeiro.nenhumaCobranca')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
