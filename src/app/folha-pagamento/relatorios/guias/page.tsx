'use client';

/**
 * Guias de recolhimento: provisões de INSS, IRRF e FGTS da competência,
 * agregadas dos itens calculados da folha, via
 * GET /api/payroll/relatorios/operacional?type=guias.
 */
import React, { useState } from 'react';
import { FiArrowLeft, FiFileText, FiLoader } from 'react-icons/fi';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useI18n } from '@/contexts/I18nContext';
import { fetchWithToken } from '@/lib/tokenStorage';
import { FIN_CARD_CLASS, FinChip, formatarMoeda } from '@/components/financeiro/shared';
import RelatorioFiltros, { type FiltroRelatorio } from '@/components/financeiro/RelatorioFiltros';
import type { ResumoGuias, TributoGuia } from '@/lib/payroll/relatorios-agregacao';

interface RelatorioGuias extends ResumoGuias {
  competencia: { mes: number; ano: number };
}

const TONE_POR_TRIBUTO: Record<TributoGuia, 'blue' | 'amber' | 'green'> = {
  INSS: 'blue',
  IRRF: 'amber',
  FGTS: 'green',
};

export default function GuiasRecolhimentoPage() {
  const { t } = useI18n();
  const [carregando, setCarregando] = useState(false);
  const [resumo, setResumo] = useState<RelatorioGuias | null>(null);

  const gerar = async (filtro: FiltroRelatorio) => {
    setCarregando(true);
    setResumo(null);
    try {
      const params = new URLSearchParams({
        companyId: filtro.companyId,
        month: String(filtro.mes),
        year: String(filtro.ano),
        type: 'guias',
      });
      if (filtro.departmentId) params.set('departmentId', filtro.departmentId);
      const res = await fetchWithToken(`/api/payroll/relatorios/operacional?${params.toString()}`);
      const body = await res.json();
      if (!res.ok || body?.success === false) {
        throw new Error(body?.error || t('payroll.relatorioErroGerar', 'Erro ao gerar relatório'));
      }
      setResumo(body.data as RelatorioGuias);
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
            {t('payroll.paymentGuides', 'Guias de Recolhimento')}
          </h1>
          <p className="text-xs text-gray-500">
            {t('payroll.paymentGuidesDesc', 'Provisões de INSS, IRRF e FGTS da competência')}
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

      {resumo && (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {resumo.guias.map((guia) => (
              <div key={guia.tributo} className={`${FIN_CARD_CLASS} p-4`}>
                <div className="flex items-center justify-between">
                  <FinChip tone={TONE_POR_TRIBUTO[guia.tributo]}>{guia.tributo}</FinChip>
                  <span className="text-xs text-gray-500">
                    {String(resumo.competencia.mes).padStart(2, '0')}/{resumo.competencia.ano}
                  </span>
                </div>
                <p className="mt-2 text-sm text-gray-600">{guia.descricao}</p>
                <p className="mt-1 text-2xl font-black text-gray-900">{formatarMoeda(guia.valor)}</p>
              </div>
            ))}
          </div>

          <div className={`${FIN_CARD_CLASS} overflow-x-auto`}>
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-2">{t('payroll.tributo', 'Tributo')}</th>
                  <th className="px-4 py-2">{t('payroll.descricao', 'Descrição')}</th>
                  <th className="px-4 py-2 text-right">{t('payroll.valorRecolher', 'Valor a recolher')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {resumo.guias.map((guia) => (
                  <tr key={guia.tributo} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-semibold text-gray-900">{guia.tributo}</td>
                    <td className="px-4 py-2 text-gray-600">{guia.descricao}</td>
                    <td className="px-4 py-2 text-right font-semibold text-gray-900">{formatarMoeda(guia.valor)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 text-sm font-bold text-gray-900">
                <tr>
                  <td className="px-4 py-2" colSpan={2}>TOTAL</td>
                  <td className="px-4 py-2 text-right">{formatarMoeda(resumo.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <p className="text-xs text-gray-500">
            {t('payroll.guiasNota', 'Provisões calculadas sobre a folha bruta de')}{' '}
            {formatarMoeda(resumo.folhaBruta)} · {resumo.contribuintes}{' '}
            {t('payroll.colaboradores', 'Colaboradores').toLowerCase()}.{' '}
            {t('payroll.guiasNota2', 'Valores consolidados da competência; a emissão das guias oficiais (GPS/DARF/FGTS Digital) é feita fora do portal.')}
          </p>
        </>
      )}
    </div>
  );
}
