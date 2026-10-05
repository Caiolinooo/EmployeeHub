'use client';

/**
 * Análise de custos da folha: agregação por centro de custo/departamento
 * (bruto, descontos, tributos e custo total empresa = bruto + FGTS) via
 * GET /api/payroll/relatorios/operacional?type=custos.
 */
import React, { useState } from 'react';
import { FiArrowLeft, FiLoader, FiTrendingUp } from 'react-icons/fi';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useI18n } from '@/contexts/I18nContext';
import { fetchWithToken } from '@/lib/tokenStorage';
import { FIN_CARD_CLASS, formatarMoeda } from '@/components/financeiro/shared';
import RelatorioFiltros, { type FiltroRelatorio } from '@/components/financeiro/RelatorioFiltros';
import type { CustoDepartamento } from '@/lib/payroll/relatorios-agregacao';

interface RelatorioCustos {
  competencia: { mes: number; ano: number };
  departamentos: CustoDepartamento[];
  totais: CustoDepartamento;
}

export default function AnaliseCustosPage() {
  const { t } = useI18n();
  const [carregando, setCarregando] = useState(false);
  const [relatorio, setRelatorio] = useState<RelatorioCustos | null>(null);

  const gerar = async (filtro: FiltroRelatorio) => {
    setCarregando(true);
    setRelatorio(null);
    try {
      const params = new URLSearchParams({
        companyId: filtro.companyId,
        month: String(filtro.mes),
        year: String(filtro.ano),
        type: 'custos',
      });
      if (filtro.departmentId) params.set('departmentId', filtro.departmentId);
      const res = await fetchWithToken(`/api/payroll/relatorios/operacional?${params.toString()}`);
      const body = await res.json();
      if (!res.ok || body?.success === false) {
        throw new Error(body?.error || t('payroll.relatorioErroGerar', 'Erro ao gerar relatório'));
      }
      setRelatorio(body.data as RelatorioCustos);
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : t('payroll.relatorioErroGerar', 'Erro ao gerar relatório'));
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex shrink-0 items-center gap-3">
        <Link
          href="/folha-pagamento"
          className="rounded-lg p-2 text-gray-400 transition-colors hover:text-abz-blue"
          title={t('common.back', 'Voltar')}
        >
          <FiArrowLeft className="h-5 w-5" />
        </Link>
        <span className="rounded-xl bg-blue-50 p-1.5 text-abz-blue">
          <FiTrendingUp className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-lg font-black text-gray-900">
            {t('payroll.costAnalysis', 'Análise de Custos')}
          </h1>
          <p className="text-xs text-gray-500">
            {t('payroll.costAnalysisDesc', 'Custos da folha por centro de custo/departamento')}
          </p>
        </div>
      </div>

      <RelatorioFiltros aoGerar={gerar} carregando={carregando} />

      {carregando && (
        <div className={`${FIN_CARD_CLASS} flex items-center justify-center gap-2 p-10 text-gray-500`}>
          <FiLoader className="h-5 w-5 animate-spin" />
          {t('payroll.relatorioCalculando', 'Calculando a competência...')}
        </div>
      )}

      {relatorio && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className={`${FIN_CARD_CLASS} p-4`}>
              <p className="text-xs font-bold uppercase text-gray-500">{t('payroll.colaboradores', 'Colaboradores')}</p>
              <p className="mt-1 text-xl font-black text-gray-900">{relatorio.totais.colaboradores}</p>
            </div>
            <div className={`${FIN_CARD_CLASS} p-4`}>
              <p className="text-xs font-bold uppercase text-gray-500">{t('payroll.totalBruto', 'Bruto')}</p>
              <p className="mt-1 text-xl font-black text-gray-900">{formatarMoeda(relatorio.totais.bruto)}</p>
            </div>
            <div className={`${FIN_CARD_CLASS} p-4`}>
              <p className="text-xs font-bold uppercase text-gray-500">FGTS</p>
              <p className="mt-1 text-xl font-black text-gray-900">{formatarMoeda(relatorio.totais.fgts)}</p>
            </div>
            <div className={`${FIN_CARD_CLASS} p-4`}>
              <p className="text-xs font-bold uppercase text-gray-500">{t('payroll.custoTotal', 'Custo total')}</p>
              <p className="mt-1 text-xl font-black text-abz-blue">{formatarMoeda(relatorio.totais.custoTotal)}</p>
            </div>
          </div>

          <div className={`${FIN_CARD_CLASS} overflow-x-auto`}>
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-2">{t('payroll.department', 'Departamento')}</th>
                  <th className="px-4 py-2 text-right">{t('payroll.colaboradores', 'Colaboradores')}</th>
                  <th className="px-4 py-2 text-right">{t('payroll.totalBruto', 'Bruto')}</th>
                  <th className="px-4 py-2 text-right">{t('payroll.totalDescontos', 'Descontos')}</th>
                  <th className="px-4 py-2 text-right">{t('payroll.totalLiquido', 'Líquido')}</th>
                  <th className="px-4 py-2 text-right">INSS</th>
                  <th className="px-4 py-2 text-right">IRRF</th>
                  <th className="px-4 py-2 text-right">FGTS</th>
                  <th className="px-4 py-2 text-right">{t('payroll.custoTotal', 'Custo total')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {relatorio.departamentos.map((dep) => (
                  <tr key={dep.departamento} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-semibold text-gray-900">{dep.departamento}</td>
                    <td className="px-4 py-2 text-right text-gray-600">{dep.colaboradores}</td>
                    <td className="px-4 py-2 text-right text-gray-900">{formatarMoeda(dep.bruto)}</td>
                    <td className="px-4 py-2 text-right text-gray-600">{formatarMoeda(dep.descontos)}</td>
                    <td className="px-4 py-2 text-right text-gray-600">{formatarMoeda(dep.liquido)}</td>
                    <td className="px-4 py-2 text-right text-gray-600">{formatarMoeda(dep.inss)}</td>
                    <td className="px-4 py-2 text-right text-gray-600">{formatarMoeda(dep.irrf)}</td>
                    <td className="px-4 py-2 text-right text-gray-600">{formatarMoeda(dep.fgts)}</td>
                    <td className="px-4 py-2 text-right font-semibold text-gray-900">{formatarMoeda(dep.custoTotal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 text-sm font-bold text-gray-900">
                <tr>
                  <td className="px-4 py-2">TOTAL</td>
                  <td className="px-4 py-2 text-right">{relatorio.totais.colaboradores}</td>
                  <td className="px-4 py-2 text-right">{formatarMoeda(relatorio.totais.bruto)}</td>
                  <td className="px-4 py-2 text-right">{formatarMoeda(relatorio.totais.descontos)}</td>
                  <td className="px-4 py-2 text-right">{formatarMoeda(relatorio.totais.liquido)}</td>
                  <td className="px-4 py-2 text-right">{formatarMoeda(relatorio.totais.inss)}</td>
                  <td className="px-4 py-2 text-right">{formatarMoeda(relatorio.totais.irrf)}</td>
                  <td className="px-4 py-2 text-right">{formatarMoeda(relatorio.totais.fgts)}</td>
                  <td className="px-4 py-2 text-right">{formatarMoeda(relatorio.totais.custoTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <p className="text-xs text-gray-500">
            {t('payroll.custoTotalNota', 'Custo total = bruto + provisão de FGTS (8%). INSS e IRRF são descontos do segurado, já incluídos no bruto.')}
          </p>
        </>
      )}
    </div>
  );
}
