'use client';

/**
 * PagamentosPanel (§7.1): lotes enviados por folha com status
 * (GET /pagamentos + POST /pagamentos/lote para enviar a folha aprovada).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { FiSend } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useI18n } from '@/contexts/I18nContext';
import { criarLotePagamentos, listContasBancarias, listPagamentos } from '@/lib/financeiro/api-client';
import { fetchWithToken } from '@/lib/tokenStorage';
import type { FinContaBancaria, FinPagamento } from '@/types/financeiro';
import {
  FIN_BTN_PRIMARY_CLASS,
  FIN_CARD_CLASS,
  FIN_INPUT_CLASS,
  PagamentoStatusChip,
  formatarData,
  formatarMoeda,
  mensagemErro,
} from '@/components/financeiro/shared';

interface FolhaOpcao {
  id: string;
  referenceMonth: number;
  referenceYear: number;
  status: string;
  totalNet: number;
}

export default function PagamentosPanel() {
  const { t } = useI18n();
  const [pagamentos, setPagamentos] = useState<FinPagamento[]>([]);
  const [contas, setContas] = useState<FinContaBancaria[]>([]);
  const [folhas, setFolhas] = useState<FolhaOpcao[]>([]);
  const [contaId, setContaId] = useState('');
  const [folhaId, setFolhaId] = useState('');
  const [dataPrevista, setDataPrevista] = useState(new Date().toISOString().slice(0, 10));
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      setPagamentos(await listPagamentos({ origemTipo: 'payroll_sheet' }));
    } catch (e) {
      toast.error(mensagemErro(e, t('financeiro.erroGeral')));
    } finally {
      setCarregando(false);
    }
  }, [t]);

  useEffect(() => {
    carregar();
    listContasBancarias()
      .then((lista) => {
        setContas(lista);
        if (lista.length > 0) setContaId((atual) => atual || lista[0].id);
      })
      .catch(() => undefined);
    (async () => {
      try {
        const res = await fetchWithToken('/api/payroll/sheets?status=approved&limit=100');
        const body = await res.json();
        setFolhas((body?.data ?? []) as FolhaOpcao[]);
      } catch {
        /* sem folhas aprovadas para lote */
      }
    })();
  }, [carregar]);

  async function enviarLote() {
    if (!contaId || !folhaId) return;
    if (!window.confirm(t('financeiro.pagamentos'))) return;
    setEnviando(true);
    try {
      const res = await criarLotePagamentos({
        origemTipo: 'payroll_sheet',
        origemId: folhaId,
        contaBancariaId: contaId,
        dataPrevista: dataPrevista || undefined,
      });
      const aceitos = res.itens.filter((i) => i.aceito).length;
      toast.success(`${t('financeiro.pagamentos')}: ${aceitos}/${res.itens.length}`);
      await carregar();
    } catch (e) {
      toast.error(mensagemErro(e, t('financeiro.erroGeral')));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500">{t('financeiro.pagamentos')}</h3>

      {/* Enviar lote da folha aprovada */}
      <div className={`${FIN_CARD_CLASS} flex flex-wrap items-end gap-3 p-4`}>
        <div className="min-w-52">
          <label className="mb-1 block text-xs font-bold uppercase text-gray-500">{t('financeiro.selecionarFolha')}</label>
          <select value={folhaId} onChange={(e) => setFolhaId(e.target.value)} className={FIN_INPUT_CLASS}>
            <option value="">{folhas.length === 0 ? t('financeiro.nenhumaFolhaAprovada') : '—'}</option>
            {folhas.map((f) => (
              <option key={f.id} value={f.id}>
                {String(f.referenceMonth).padStart(2, '0')}/{f.referenceYear} · {formatarMoeda(f.totalNet)}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-52">
          <label className="mb-1 block text-xs font-bold uppercase text-gray-500">{t('financeiro.contaBancaria')}</label>
          <select value={contaId} onChange={(e) => setContaId(e.target.value)} className={FIN_INPUT_CLASS}>
            {contas.map((conta) => (
              <option key={conta.id} value={conta.id}>
                {conta.banco_nome || conta.banco_codigo} · {conta.agencia}/{conta.conta}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold uppercase text-gray-500">{t('financeiro.data')}</label>
          <input type="date" value={dataPrevista} onChange={(e) => setDataPrevista(e.target.value)} className={FIN_INPUT_CLASS} />
        </div>
        <button type="button" onClick={enviarLote} disabled={enviando || !folhaId || !contaId} className={FIN_BTN_PRIMARY_CLASS}>
          <FiSend className={`h-4 w-4 ${enviando ? 'animate-pulse' : ''}`} /> {t('financeiro.pagamentos')}
        </button>
      </div>

      {/* Lista de pagamentos */}
      <div className={`${FIN_CARD_CLASS} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-bold uppercase text-gray-500">{t('financeiro.favorecido')}</th>
                <th className="px-4 py-2 text-right text-xs font-bold uppercase text-gray-500">{t('financeiro.valor')}</th>
                <th className="px-4 py-2 text-left text-xs font-bold uppercase text-gray-500">{t('financeiro.data')}</th>
                <th className="px-4 py-2 text-left text-xs font-bold uppercase text-gray-500">{t('financeiro.origem')}</th>
                <th className="px-4 py-2 text-left text-xs font-bold uppercase text-gray-500">{t('financeiro.status')}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {pagamentos.map((pag) => (
                <tr key={pag.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200">
                    {pag.favorecido?.nome ?? '—'}
                    {pag.favorecido?.documento ? <span className="ml-2 text-xs text-gray-400">{pag.favorecido.documento}</span> : null}
                  </td>
                  <td className="px-4 py-2 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {formatarMoeda(pag.valor)}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300">{formatarData(pag.data_prevista)}</td>
                  <td className="px-4 py-2 text-xs text-gray-500">
                    {pag.origem_tipo === 'payroll_sheet' ? t('financeiro.origemFolha') : t('financeiro.origemManual')} ·{' '}
                    {pag.origem_id?.slice(0, 8) ?? '—'}
                  </td>
                  <td className="px-4 py-2">
                    <PagamentoStatusChip status={pag.status} />
                  </td>
                  <td className="px-4 py-2 text-right text-xs font-mono text-gray-400">{pag.id_externo ?? pag.lote_id_externo ?? '—'}</td>
                </tr>
              ))}
              {!carregando && pagamentos.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">
                    {t('financeiro.nenhumPagamento')}
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
