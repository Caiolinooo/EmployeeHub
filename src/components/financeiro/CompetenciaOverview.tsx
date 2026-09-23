'use client';

/**
 * Aba Visão geral (§7.1): seletor de competência + empresa, 4 cards KPI
 * (/api/financeiro/visao-geral) e tabela de competências com drill para a aba
 * correspondente.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FiList, FiFileText, FiFilePlus, FiDollarSign, FiRefreshCw } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';
import { getVisaoGeral } from '@/lib/financeiro/api-client';
import { fetchWithToken } from '@/lib/tokenStorage';
import type { FinVisaoGeral } from '@/types/financeiro';
import {
  FIN_CARD_CLASS,
  FIN_BTN_SECONDARY_CLASS,
  FIN_INPUT_CLASS,
  formatarMoeda,
  useFolhaStatusLabel,
} from '@/components/financeiro/shared';

const MESES = Array.from({ length: 12 }, (_, i) => i + 1);

interface EmpresaOpcao {
  id: string;
  name: string;
}

export default function CompetenciaOverview({ onDrill }: { onDrill: (destino: 'faturas' | 'nfse' | 'bancos' | 'folhas') => void }) {
  const { t } = useI18n();
  const labelFolha = useFolhaStatusLabel();

  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [ano, setAno] = useState(hoje.getFullYear());
  const [empresaId, setEmpresaId] = useState('');
  const [empresas, setEmpresas] = useState<EmpresaOpcao[]>([]);
  const [dados, setDados] = useState<FinVisaoGeral | null>(null);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    let vivo = true;
    carregarEmpresas()
      .then((lista) => {
        if (vivo) setEmpresas(lista);
      })
      .catch(() => {
        /* sem empresas visíveis — filtro fica vazio */
      });
    return () => {
      vivo = false;
    };
  }, []);

  const competencia = useMemo(() => `${ano}-${String(mes).padStart(2, '0')}`, [mes, ano]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const resultado = await getVisaoGeral({ competencia, empresaId: empresaId || undefined });
      setDados(resultado);
    } catch (erro) {
      console.error('visao-geral:', erro);
      setDados(null);
    } finally {
      setCarregando(false);
    }
  }, [competencia, empresaId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const folhasKpi = dados?.kpis?.folhasPorStatus ?? {};
  const folhasLinhas = Object.entries(folhasKpi);
  const faturasPendentes = (dados?.kpis?.faturasPorStatus?.rascunho ?? 0) + (dados?.kpis?.faturasPorStatus?.emitida ?? 0);
  const nfsePendentes =
    (dados?.kpis?.nfsePorStatus?.rps_gerado ?? 0) + (dados?.kpis?.nfsePorStatus?.enviado ?? 0) + (dados?.kpis?.nfsePorStatus?.rejeitado ?? 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto">
      {/* Filtros */}
      <div className={`${FIN_CARD_CLASS} flex flex-wrap items-end gap-3 p-4`}>
        <div>
          <label className="mb-1 block text-xs font-bold uppercase text-gray-500">{t('financeiro.mes')}</label>
          <select value={mes} onChange={(e) => setMes(Number(e.target.value))} className={FIN_INPUT_CLASS}>
            {MESES.map((m) => (
              <option key={m} value={m}>
                {String(m).padStart(2, '0')}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold uppercase text-gray-500">{t('financeiro.ano')}</label>
          <input
            type="number"
            min={2000}
            max={2100}
            value={ano}
            onChange={(e) => setAno(Number(e.target.value) || hoje.getFullYear())}
            className={FIN_INPUT_CLASS}
          />
        </div>
        <div className="min-w-48">
          <label className="mb-1 block text-xs font-bold uppercase text-gray-500">{t('financeiro.empresa')}</label>
          <select value={empresaId} onChange={(e) => setEmpresaId(e.target.value)} className={FIN_INPUT_CLASS}>
            <option value="">{t('financeiro.todasEmpresas')}</option>
            {empresas.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name}
              </option>
            ))}
          </select>
        </div>
        <button type="button" onClick={carregar} className={FIN_BTN_SECONDARY_CLASS} disabled={carregando}>
          <FiRefreshCw className={`h-4 w-4 ${carregando ? 'animate-spin' : ''}`} />
          {t('financeiro.recarregar')}
        </button>
      </div>

      {/* 4 cards KPI */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <button type="button" onClick={() => onDrill('folhas')} className={`${FIN_CARD_CLASS} p-4 text-left transition hover:shadow-md`}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase text-gray-500">{t('financeiro.kpiFolhas')}</p>
            <FiList className="h-5 w-5 text-abz-blue" />
          </div>
          {carregando && !dados ? (
            <p className="mt-2 text-sm text-gray-400">{t('financeiro.carregando')}</p>
          ) : (
            <div className="mt-2 space-y-1">
              {folhasLinhas.length === 0 && <p className="text-sm text-gray-400">—</p>}
              {folhasLinhas.map(([status, qtd]) => (
                <div key={status} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-300">{labelFolha(status)}</span>
                  <span className="font-bold text-gray-900 dark:text-gray-100">{qtd}</span>
                </div>
              ))}
            </div>
          )}
        </button>

        <button type="button" onClick={() => onDrill('faturas')} className={`${FIN_CARD_CLASS} p-4 text-left transition hover:shadow-md`}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase text-gray-500">{t('financeiro.kpiFaturas')}</p>
            <FiFileText className="h-5 w-5 text-abz-blue" />
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">{dados?.kpis?.totalFaturas ?? 0}</p>
          <p className="text-xs text-gray-500">
            {t('financeiro.emAberto')}: {faturasPendentes}
          </p>
        </button>

        <button type="button" onClick={() => onDrill('nfse')} className={`${FIN_CARD_CLASS} p-4 text-left transition hover:shadow-md`}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase text-gray-500">{t('financeiro.kpiNfsePendentes')}</p>
            <FiFilePlus className="h-5 w-5 text-abz-blue" />
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">{nfsePendentes}</p>
          <p className="text-xs text-gray-500">
            {t('financeiro.nfseAutorizado')}: {dados?.kpis?.nfsePorStatus?.autorizado ?? 0}
          </p>
        </button>

        <button type="button" onClick={() => onDrill('bancos')} className={`${FIN_CARD_CLASS} p-4 text-left transition hover:shadow-md`}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase text-gray-500">{t('financeiro.kpiRecebidoMes')}</p>
            <FiDollarSign className="h-5 w-5 text-abz-blue" />
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {formatarMoeda(dados?.kpis?.recebidoMes ?? 0)}
          </p>
          <p className="text-xs text-gray-500">
            {t('financeiro.emAberto')}: {formatarMoeda(0)} · {t('financeiro.cobrancas')}: {dados?.kpis?.cobrancasAbertas ?? 0}
          </p>
        </button>
      </div>

      {/* Tabela de competências */}
      <div className={`${FIN_CARD_CLASS} flex min-h-0 flex-1 flex-col overflow-hidden`}>
        <div className="border-b border-gray-100 px-4 py-3">
          <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">{t('financeiro.competencias')}</h2>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-bold uppercase text-gray-500">{t('financeiro.competencia')}</th>
                <th className="px-4 py-2 text-right text-xs font-bold uppercase text-gray-500">{t('financeiro.tabFaturas')}</th>
                <th className="px-4 py-2 text-right text-xs font-bold uppercase text-gray-500">{t('financeiro.total')}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {(dados?.competencias ?? []).map((linha) => (
                <tr key={linha.competencia} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-2 text-sm font-semibold text-gray-900 dark:text-gray-100">{linha.competencia}</td>
                  <td className="px-4 py-2 text-right text-sm text-gray-600 dark:text-gray-300">{linha.faturas}</td>
                  <td className="px-4 py-2 text-right text-sm text-gray-600 dark:text-gray-300">{formatarMoeda(linha.total)}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        const [cAno, cMes] = linha.competencia.split('-');
                        if (cMes) setMes(Number(cMes));
                        if (cAno) setAno(Number(cAno));
                        onDrill('faturas');
                      }}
                      className="text-xs font-bold text-abz-blue hover:underline"
                    >
                      {t('financeiro.visualizar')}
                    </button>
                  </td>
                </tr>
              ))}
              {dados && (dados.competencias ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">
                    {t('financeiro.semCompetencias')}
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

/** Empresas emissoras (payroll_companies via API da folha) para o seletor. */
async function carregarEmpresas(): Promise<EmpresaOpcao[]> {
  const res = await fetchWithToken('/api/payroll/companies?limit=100');
  const body = await res.json();
  const items = (body?.data ?? []) as Array<{ id: string; name?: string; razao_social?: string }>;
  return items.map((e) => ({ id: e.id, name: e.name || e.razao_social || e.id }));
}
