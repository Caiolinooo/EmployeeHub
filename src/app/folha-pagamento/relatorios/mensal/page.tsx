'use client';

/**
 * Relatório mensal operacional da folha: competência calculada pelo portal
 * (embarques, dobras, folgas, férias) via GET /api/payroll/relatorios/operacional
 * (type=operacional). Tabela por colaborador + totais da competência.
 */
import React, { useState } from 'react';
import { FiArrowLeft, FiFileText, FiLoader } from 'react-icons/fi';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useI18n } from '@/contexts/I18nContext';
import { fetchWithToken } from '@/lib/tokenStorage';
import { FIN_CARD_CLASS, formatarMoeda } from '@/components/financeiro/shared';
import RelatorioFiltros, { type FiltroRelatorio } from '@/components/financeiro/RelatorioFiltros';
import type { RelatorioOperacional } from '@/lib/payroll/relatorio-operacional';

export default function RelatorioMensalPage() {
  const { t } = useI18n();
  const [carregando, setCarregando] = useState(false);
  const [relatorio, setRelatorio] = useState<RelatorioOperacional | null>(null);

  const gerar = async (filtro: FiltroRelatorio) => {
    setCarregando(true);
    setRelatorio(null);
    try {
      const params = new URLSearchParams({
        companyId: filtro.companyId,
        month: String(filtro.mes),
        year: String(filtro.ano),
        type: 'operacional',
      });
      if (filtro.departmentId) params.set('departmentId', filtro.departmentId);
      const res = await fetchWithToken(`/api/payroll/relatorios/operacional?${params.toString()}`);
      const body = await res.json();
      if (!res.ok || body?.success === false) {
        throw new Error(body?.error || t('payroll.relatorioErroGerar', 'Erro ao gerar relatório'));
      }
      setRelatorio(body.data as RelatorioOperacional);
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
          <FiFileText className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-lg font-black text-gray-900">
            {t('payroll.monthlyReport', 'Relatório Mensal')}
          </h1>
          <p className="text-xs text-gray-500">
            {t('payroll.monthlyReportDesc', 'Competência calculada: proventos, descontos e tributos por colaborador')}
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
              <p className="mt-1 text-xl font-black text-gray-900">{relatorio.colaboradores.length}</p>
            </div>
            <div className={`${FIN_CARD_CLASS} p-4`}>
              <p className="text-xs font-bold uppercase text-gray-500">{t('payroll.totalBruto', 'Bruto')}</p>
              <p className="mt-1 text-xl font-black text-gray-900">{formatarMoeda(relatorio.totais.bruto)}</p>
            </div>
            <div className={`${FIN_CARD_CLASS} p-4`}>
              <p className="text-xs font-bold uppercase text-gray-500">{t('payroll.totalDescontos', 'Descontos')}</p>
              <p className="mt-1 text-xl font-black text-gray-900">{formatarMoeda(relatorio.totais.descontos)}</p>
            </div>
            <div className={`${FIN_CARD_CLASS} p-4`}>
              <p className="text-xs font-bold uppercase text-gray-500">{t('payroll.totalLiquido', 'Líquido')}</p>
              <p className="mt-1 text-xl font-black text-abz-blue">{formatarMoeda(relatorio.totais.liquido)}</p>
            </div>
          </div>

          {relatorio.pendencias.length > 0 && (
            <div className={`${FIN_CARD_CLASS} border-amber-200 bg-amber-50 p-4 text-sm text-amber-800`}>
              {t('payroll.relatorioPendencias', 'CPFs sem cadastro na folha')}: {relatorio.pendencias.length}
            </div>
          )}

          <div className={`${FIN_CARD_CLASS} overflow-x-auto`}>
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-2">{t('payroll.employee', 'Colaborador')}</th>
                  <th className="px-4 py-2">{t('payroll.centroCusto', 'Centro de custo')}</th>
                  <th className="px-4 py-2 text-right">{t('payroll.totalBruto', 'Bruto')}</th>
                  <th className="px-4 py-2 text-right">{t('payroll.totalDescontos', 'Descontos')}</th>
                  <th className="px-4 py-2 text-right">{t('payroll.totalLiquido', 'Líquido')}</th>
                  <th className="px-4 py-2 text-right">INSS</th>
                  <th className="px-4 py-2 text-right">IRRF</th>
                  <th className="px-4 py-2 text-right">FGTS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {relatorio.colaboradores.map((c) => (
                  <tr key={c.employeeId} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-semibold text-gray-900">{c.nome}</td>
                    <td className="px-4 py-2 text-gray-600">{c.centroCusto || '—'}</td>
                    <td className="px-4 py-2 text-right text-gray-900">{formatarMoeda(c.bruto)}</td>
                    <td className="px-4 py-2 text-right text-gray-600">{formatarMoeda(c.descontos)}</td>
                    <td className="px-4 py-2 text-right font-semibold text-gray-900">{formatarMoeda(c.liquido)}</td>
                    <td className="px-4 py-2 text-right text-gray-600">{formatarMoeda(c.inss)}</td>
                    <td className="px-4 py-2 text-right text-gray-600">{formatarMoeda(c.irrf)}</td>
                    <td className="px-4 py-2 text-right text-gray-600">{formatarMoeda(c.fgts)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 text-sm font-bold text-gray-900">
                <tr>
                  <td className="px-4 py-2" colSpan={2}>TOTAL</td>
                  <td className="px-4 py-2 text-right">{formatarMoeda(relatorio.totais.bruto)}</td>
                  <td className="px-4 py-2 text-right">{formatarMoeda(relatorio.totais.descontos)}</td>
                  <td className="px-4 py-2 text-right">{formatarMoeda(relatorio.totais.liquido)}</td>
                  <td className="px-4 py-2 text-right">{formatarMoeda(relatorio.totais.inss)}</td>
                  <td className="px-4 py-2 text-right">{formatarMoeda(relatorio.totais.irrf)}</td>
                  <td className="px-4 py-2 text-right">{formatarMoeda(relatorio.totais.fgts)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
