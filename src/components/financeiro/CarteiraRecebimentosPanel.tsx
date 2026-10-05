'use client';

/**
 * CarteiraRecebimentosPanel: aging por faixas de 30/60/90 dias, percentual de
 * inadimplência e maiores devedores. Dados de GET /api/financeiro/carteira.
 * Paleta e cards do painel (FIN_CARD_CLASS) — sem layout novo.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { FiRefreshCw } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';
import { getCarteira } from '@/lib/financeiro/api-client';
import type { FinCarteira, FinFaixaAging } from '@/types/financeiro';
import {
  FIN_BTN_SECONDARY_CLASS,
  FIN_CARD_CLASS,
  FIN_INPUT_CLASS,
  FinChip,
  formatarMoeda,
} from '@/components/financeiro/shared';

const FAIXA_LABEL_KEY: Record<FinFaixaAging, string> = {
  a_vencer: 'financeiro.aVencer',
  '1_30': 'financeiro.faixa1a30',
  '31_60': 'financeiro.faixa31a60',
  '61_90': 'financeiro.faixa61a90',
  '90_mais': 'financeiro.faixa90mais',
};

const FAIXA_TONE: Record<FinFaixaAging, 'gray' | 'green' | 'amber' | 'red'> = {
  a_vencer: 'gray',
  '1_30': 'green',
  '31_60': 'amber',
  '61_90': 'red',
  '90_mais': 'red',
};

export default function CarteiraRecebimentosPanel() {
  const { t } = useI18n();
  const [ref, setRef] = useState(() => new Date().toISOString().slice(0, 10));
  const [dados, setDados] = useState<FinCarteira | null>(null);
  const [carregando, setCarregando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      setDados(await getCarteira({ ref }));
    } catch (e) {
      console.error('carteira:', e);
      setDados(null);
    } finally {
      setCarregando(false);
    }
  }, [ref]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500">{t('financeiro.carteira')}</h3>
        {dados && dados.titulos > 0 && (
          <FinChip tone={dados.vencido > 0 ? 'red' : 'green'}>
            {t('financeiro.inadimplencia')}: {dados.percentualVencido.toFixed(1)}%
          </FinChip>
        )}
      </div>

      <div className={`${FIN_CARD_CLASS} flex flex-wrap items-end gap-3 p-4`}>
        <div>
          <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
            {t('financeiro.dataReferencia')}
          </label>
          <input type="date" value={ref} onChange={(e) => setRef(e.target.value)} className={FIN_INPUT_CLASS} />
        </div>
        <button type="button" onClick={carregar} className={FIN_BTN_SECONDARY_CLASS} disabled={carregando}>
          <FiRefreshCw className={`h-4 w-4 ${carregando ? 'animate-spin' : ''}`} />
          {t('financeiro.recarregar')}
        </button>

        <div className="ml-auto flex flex-wrap gap-6">
          <div>
            <div className="text-xs font-bold uppercase text-gray-500">{t('financeiro.totalAReceber')}</div>
            <div className="text-lg font-bold text-abz-blue-dark">{formatarMoeda(dados?.total ?? 0)}</div>
          </div>
          <div>
            <div className="text-xs font-bold uppercase text-gray-500">{t('financeiro.totalVencido')}</div>
            <div className="text-lg font-bold text-red-600">{formatarMoeda(dados?.vencido ?? 0)}</div>
          </div>
          <div>
            <div className="text-xs font-bold uppercase text-gray-500">{t('financeiro.maiorAtraso')}</div>
            <div className="text-lg font-bold text-gray-700">
              {dados?.maiorAtraso ?? 0} {t('financeiro.dias')}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className={`${FIN_CARD_CLASS} overflow-hidden`}>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-bold uppercase text-gray-500">
                  {t('financeiro.faixaAging')}
                </th>
                <th className="px-4 py-2 text-right text-xs font-bold uppercase text-gray-500">
                  {t('financeiro.titulos')}
                </th>
                <th className="px-4 py-2 text-right text-xs font-bold uppercase text-gray-500">
                  {t('financeiro.valor')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(dados?.faixas ?? []).map((f) => (
                <tr key={f.faixa}>
                  <td className="px-4 py-2">
                    <FinChip tone={FAIXA_TONE[f.faixa]}>{t(FAIXA_LABEL_KEY[f.faixa])}</FinChip>
                  </td>
                  <td className="px-4 py-2 text-right text-sm text-gray-700">{f.quantidade}</td>
                  <td className="px-4 py-2 text-right text-sm font-semibold text-gray-900">
                    {formatarMoeda(f.valor)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={`${FIN_CARD_CLASS} overflow-hidden`}>
          <div className="border-b border-gray-200 bg-gray-50 px-4 py-2">
            <span className="text-xs font-bold uppercase text-gray-500">{t('financeiro.maioresDevedores')}</span>
          </div>
          <div className="divide-y divide-gray-100">
            {(dados?.clientes ?? []).length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-gray-500">{t('financeiro.semDevedores')}</p>
            ) : (
              dados?.clientes.slice(0, 10).map((c) => (
                <div key={c.clienteId ?? c.clienteNome} className="flex items-center justify-between gap-3 px-4 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-gray-900">{c.clienteNome}</div>
                    <div className="text-xs text-gray-500">
                      {c.titulos} · {c.maiorAtraso > 0 ? `${c.maiorAtraso} ${t('financeiro.dias')}` : t('financeiro.aVencer')}
                    </div>
                  </div>
                  <div className="shrink-0 text-sm font-bold text-gray-900">{formatarMoeda(c.valor)}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
