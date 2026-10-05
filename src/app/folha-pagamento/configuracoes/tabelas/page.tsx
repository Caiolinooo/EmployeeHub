'use client';

/**
 * Tabelas legais (INSS/IRRF/FGTS) — visão somente leitura da vigência
 * corrente (2026, Portaria Interministerial MPS/MF nº 13/2026). Os valores
 * são versionados em código (src/lib/payroll/legal-tables.ts para exibição e
 * src/lib/payroll/calculations.ts para o motor); CRUD via banco é uma
 * feature separada, fora do escopo desta tela.
 */
import React from 'react';
import { FiArrowLeft, FiInfo, FiTable } from 'react-icons/fi';
import Link from 'next/link';
import { useI18n } from '@/contexts/I18nContext';
import { FIN_CARD_CLASS, formatarMoeda } from '@/components/financeiro/shared';
import { FGTS_TABLE, INSS_TABLE_2025, IRRF_TABLE_2025 } from '@/lib/payroll/legal-tables';

interface Faixa {
  id: number;
  description: string;
  rate: number;
  deduction: number;
}

function TabelaFaixas({ titulo, faixas }: { titulo: string; faixas: Faixa[] }) {
  const { t } = useI18n();
  return (
    <div className={`${FIN_CARD_CLASS} overflow-x-auto`}>
      <h2 className="border-b border-gray-100 px-4 py-3 text-sm font-bold text-gray-900">{titulo}</h2>
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 text-xs uppercase text-gray-500">
          <tr>
            <th className="px-4 py-2">{t('payroll.tabelasFaixa', 'Faixa')}</th>
            <th className="px-4 py-2 text-right">{t('payroll.tabelasAliquota', 'Alíquota')}</th>
            <th className="px-4 py-2 text-right">{t('payroll.tabelasDeducao', 'Parcela a deduzir')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {faixas.map((faixa) => (
            <tr key={faixa.id} className="hover:bg-gray-50">
              <td className="px-4 py-2 text-gray-900">{faixa.description}</td>
              <td className="px-4 py-2 text-right text-gray-600">{faixa.rate.toLocaleString('pt-BR')}%</td>
              <td className="px-4 py-2 text-right text-gray-600">{formatarMoeda(faixa.deduction)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function TabelasLegaisPage() {
  const { t } = useI18n();

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
          <FiTable className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-lg font-black text-gray-900">
            {t('payroll.legalTables', 'Tabelas Legais')}
          </h1>
          <p className="text-xs text-gray-500">
            {t('payroll.legalTablesDesc', 'INSS, IRRF e FGTS usados pelo motor de cálculo')}
          </p>
        </div>
      </div>

      <div className={`${FIN_CARD_CLASS} flex items-start gap-2 border-blue-200 bg-blue-50 p-4 text-sm text-gray-700`}>
        <FiInfo className="mt-0.5 h-4 w-4 shrink-0 text-abz-blue" />
        <p>
          {t('payroll.tabelasVigencia', 'Vigência corrente: 2026 (Portaria Interministerial MPS/MF nº 13/2026). Competências de 2025 usam a tabela anterior automaticamente.')}{' '}
          {t('payroll.tabelasVersionadas', 'Os valores são versionados no código do portal; alterações seguem deploy. Não há edição via banco nesta tela.')}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className={`${FIN_CARD_CLASS} p-4`}>
          <p className="text-xs font-bold uppercase text-gray-500">{t('payroll.tabelasSalarioMinimo', 'Salário mínimo')}</p>
          <p className="mt-1 text-xl font-black text-gray-900">{formatarMoeda(INSS_TABLE_2025.salaryMin)}</p>
        </div>
        <div className={`${FIN_CARD_CLASS} p-4`}>
          <p className="text-xs font-bold uppercase text-gray-500">{t('payroll.tabelasTetoInss', 'Teto INSS')}</p>
          <p className="mt-1 text-xl font-black text-gray-900">{formatarMoeda(INSS_TABLE_2025.ceiling)}</p>
        </div>
        <div className={`${FIN_CARD_CLASS} p-4`}>
          <p className="text-xs font-bold uppercase text-gray-500">{t('payroll.tabelasDescontoMaxInss', 'Desconto máx. INSS')}</p>
          <p className="mt-1 text-xl font-black text-gray-900">{formatarMoeda(INSS_TABLE_2025.maxDiscount)}</p>
        </div>
        <div className={`${FIN_CARD_CLASS} p-4`}>
          <p className="text-xs font-bold uppercase text-gray-500">FGTS</p>
          <p className="mt-1 text-xl font-black text-gray-900">{FGTS_TABLE.rate.toLocaleString('pt-BR')}%</p>
        </div>
      </div>

      <TabelaFaixas titulo={t('payroll.tabelasInssTitulo', 'INSS — faixas progressivas')} faixas={INSS_TABLE_2025.brackets} />

      <div className={`${FIN_CARD_CLASS} grid grid-cols-2 gap-3 p-4 md:grid-cols-4`}>
        <div>
          <p className="text-xs font-bold uppercase text-gray-500">{t('payroll.tabelasIsencaoIrrf', 'Isenção IRRF até')}</p>
          <p className="mt-1 font-black text-gray-900">{formatarMoeda(IRRF_TABLE_2025.exemptionLimit)}</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase text-gray-500">{t('payroll.tabelasBaseIsencaoIrrf', 'Base de isenção')}</p>
          <p className="mt-1 font-black text-gray-900">{formatarMoeda(IRRF_TABLE_2025.exemptionBase)}</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase text-gray-500">{t('payroll.tabelasDeducaoSimplificada', 'Dedução simplificada')}</p>
          <p className="mt-1 font-black text-gray-900">{formatarMoeda(IRRF_TABLE_2025.simplifiedDeduction)}</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase text-gray-500">{t('payroll.tabelasDeducaoDependente', 'Dedução por dependente')}</p>
          <p className="mt-1 font-black text-gray-900">{formatarMoeda(IRRF_TABLE_2025.dependentDeduction)}</p>
        </div>
      </div>

      <TabelaFaixas titulo={t('payroll.tabelasIrrfTitulo', 'IRRF — faixas progressivas')} faixas={IRRF_TABLE_2025.brackets} />

      <div className={`${FIN_CARD_CLASS} p-4`}>
        <h2 className="text-sm font-bold text-gray-900">FGTS</h2>
        <p className="mt-1 text-sm text-gray-600">
          {FGTS_TABLE.description}: {FGTS_TABLE.rate.toLocaleString('pt-BR')}%{' '}
          {t('payroll.tabelasFgtsNota', 'do bruto, depositado pela empresa (não desconta do colaborador).')}
        </p>
      </div>
    </div>
  );
}
