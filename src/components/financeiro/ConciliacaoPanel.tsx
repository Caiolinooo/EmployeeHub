'use client';

/**
 * ConciliacaoPanel (§7.1): seleciona conta + período → Importar da API ou
 * Upload CSV; tabela de movimentos com status e ações Vincular/Ignorar;
 * badge de saldo conciliado.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FiDownloadCloud, FiUpload, FiLink2, FiEyeOff, FiRefreshCw } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useI18n } from '@/contexts/I18nContext';
import {
  ignorarConciliacao, importarConciliacoes, listCobrancas, listConciliacoes,
  listContasBancarias, uploadConciliacoesCsv, vincularConciliacao,
} from '@/lib/financeiro/api-client';
import type { FinCobranca, FinConciliacao, FinContaBancaria } from '@/types/financeiro';
import {
  FIN_BTN_PRIMARY_CLASS,
  FIN_BTN_SECONDARY_CLASS,
  FIN_CARD_CLASS,
  FIN_INPUT_CLASS,
  ConciliacaoStatusChip,
  formatarData,
  formatarMoeda,
  mensagemErro,
} from '@/components/financeiro/shared';

function periodoPadrao(): { de: string; ate: string } {
  const hoje = new Date();
  const primeiro = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { de: iso(primeiro), ate: iso(hoje) };
}

export default function ConciliacaoPanel() {
  const { t } = useI18n();
  const padrao = useMemo(periodoPadrao, []);
  const [contas, setContas] = useState<FinContaBancaria[]>([]);
  const [contaId, setContaId] = useState('');
  const [de, setDe] = useState(padrao.de);
  const [ate, setAte] = useState(padrao.ate);
  const [movimentos, setMovimentos] = useState<FinConciliacao[]>([]);
  const [cobrancasAbertas, setCobrancasAbertas] = useState<FinCobranca[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [vinculandoId, setVinculandoId] = useState<string | null>(null);

  useEffect(() => {
    listContasBancarias()
      .then((lista) => {
        setContas(lista);
        if (lista.length > 0) setContaId((atual) => atual || lista[0].id);
      })
      .catch((e) => toast.error(mensagemErro(e, t('financeiro.erroGeral'))));
    // Cobranças geradas candidatas a vinculação
    listCobrancas({ status: 'gerada' })
      .then(setCobrancasAbertas)
      .catch(() => undefined);
  }, [t]);

  const carregar = useCallback(async () => {
    if (!contaId) return;
    setCarregando(true);
    try {
      setMovimentos(await listConciliacoes({ contaBancariaId: contaId, de, ate }));
    } catch (e) {
      toast.error(mensagemErro(e, t('financeiro.erroGeral')));
    } finally {
      setCarregando(false);
    }
  }, [contaId, de, ate, t]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function importarApi() {
    if (!contaId) return;
    setImportando(true);
    try {
      const res = await importarConciliacoes({ contaBancariaId: contaId, de, ate });
      toast.success(`${t('financeiro.conciliacaoImportada')}: ${res.importados} · ${t('financeiro.statusConciliado')}: ${res.conciliadosAutomaticos}`);
      await carregar();
    } catch (e) {
      toast.error(mensagemErro(e, t('financeiro.erroGeral')));
    } finally {
      setImportando(false);
    }
  }

  async function enviarCsv(arquivo: File) {
    if (!contaId) return;
    setImportando(true);
    try {
      const res = await uploadConciliacoesCsv(contaId, arquivo);
      toast.success(`${t('financeiro.conciliacaoImportada')}: ${res.importados} · ${t('financeiro.statusConciliado')}: ${res.conciliadosAutomaticos}`);
      await carregar();
    } catch (e) {
      toast.error(mensagemErro(e, t('financeiro.erroGeral')));
    } finally {
      setImportando(false);
    }
  }

  async function vincular(movimento: FinConciliacao, cobrancaId: string) {
    setVinculandoId(movimento.id);
    try {
      await vincularConciliacao(movimento.id, cobrancaId);
      await carregar();
    } catch (e) {
      toast.error(mensagemErro(e, t('financeiro.erroGeral')));
    } finally {
      setVinculandoId(null);
    }
  }

  async function ignorar(movimento: FinConciliacao) {
    try {
      await ignorarConciliacao(movimento.id);
      await carregar();
    } catch (e) {
      toast.error(mensagemErro(e, t('financeiro.erroGeral')));
    }
  }

  const saldoConciliado = movimentos
    .filter((m) => m.status === 'conciliado')
    .reduce((soma, m) => soma + (m.tipo === 'credito' ? m.valor : -m.valor), 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500">{t('financeiro.conciliacao')}</h3>
        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
          {t('financeiro.saldoConciliado')}: {formatarMoeda(saldoConciliado)}
        </span>
      </div>

      <div className={`${FIN_CARD_CLASS} flex flex-wrap items-end gap-3 p-4`}>
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
          <label className="mb-1 block text-xs font-bold uppercase text-gray-500">{t('financeiro.de')}</label>
          <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className={FIN_INPUT_CLASS} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold uppercase text-gray-500">{t('financeiro.ate')}</label>
          <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className={FIN_INPUT_CLASS} />
        </div>
        <button type="button" onClick={importarApi} disabled={importando || !contaId} className={FIN_BTN_PRIMARY_CLASS}>
          <FiDownloadCloud className={`h-4 w-4 ${importando ? 'animate-pulse' : ''}`} /> {t('financeiro.importarApi')}
        </button>
        <label className={`${FIN_BTN_SECONDARY_CLASS} cursor-pointer`}>
          <FiUpload className="h-4 w-4" /> {t('financeiro.uploadCsv')}
          <input
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const arquivo = e.target.files?.[0];
              if (arquivo) enviarCsv(arquivo);
            }}
          />
        </label>
        <button type="button" onClick={carregar} className={FIN_BTN_SECONDARY_CLASS} disabled={carregando}>
          <FiRefreshCw className={`h-4 w-4 ${carregando ? 'animate-spin' : ''}`} />
          {t('financeiro.recarregar')}
        </button>
      </div>

      <div className={`${FIN_CARD_CLASS} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-bold uppercase text-gray-500">{t('financeiro.data')}</th>
                <th className="px-4 py-2 text-left text-xs font-bold uppercase text-gray-500">{t('financeiro.credito')}/{t('financeiro.debito')}</th>
                <th className="px-4 py-2 text-right text-xs font-bold uppercase text-gray-500">{t('financeiro.valor')}</th>
                <th className="px-4 py-2 text-left text-xs font-bold uppercase text-gray-500">{t('financeiro.descricao')}</th>
                <th className="px-4 py-2 text-left text-xs font-bold uppercase text-gray-500">{t('financeiro.status')}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {movimentos.map((mov) => (
                <tr key={mov.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200">{formatarData(mov.data_movimento)}</td>
                  <td className="px-4 py-2 text-sm">
                    <span className={mov.tipo === 'credito' ? 'font-semibold text-emerald-600' : 'font-semibold text-rose-600'}>
                      {mov.tipo === 'credito' ? t('financeiro.credito') : t('financeiro.debito')}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {formatarMoeda(mov.valor)}
                  </td>
                  <td className="max-w-56 truncate px-4 py-2 text-sm text-gray-600 dark:text-gray-300" title={mov.descricao ?? ''}>
                    {mov.descricao ?? '—'}
                  </td>
                  <td className="px-4 py-2">
                    <ConciliacaoStatusChip status={mov.status} />
                  </td>
                  <td className="px-4 py-2 text-right">
                    {mov.status === 'nao_conciliado' && (
                      <div className="flex items-center justify-end gap-2">
                        {vinculandoId === mov.id ? (
                          <select
                            autoFocus
                            defaultValue=""
                            onChange={(e) => {
                              if (e.target.value) vincular(mov, e.target.value);
                            }}
                            onBlur={() => setVinculandoId(null)}
                            className={`${FIN_INPUT_CLASS} w-auto`}
                          >
                            <option value="">{t('financeiro.selecionarCobranca')}</option>
                            {cobrancasAbertas.map((cob) => (
                              <option key={cob.id} value={cob.id}>
                                {formatarMoeda(cob.valor)} · {cob.tipo} · {cob.txid || cob.nosso_numero || cob.id_externo || cob.id.slice(0, 8)}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => setVinculandoId(mov.id)}
                              disabled={cobrancasAbertas.length === 0}
                              className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-abz-blue disabled:opacity-30"
                              aria-label={t('financeiro.vincular')}
                              title={t('financeiro.vincularCobranca')}
                            >
                              <FiLink2 className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => ignorar(mov)}
                              className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-rose-600"
                              aria-label={t('financeiro.ignorar')}
                            >
                              <FiEyeOff className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {!carregando && movimentos.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">
                    {t('financeiro.nenhumMovimento')}
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
