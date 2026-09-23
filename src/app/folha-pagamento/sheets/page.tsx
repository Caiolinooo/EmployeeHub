'use client';

import React from 'react';
import Link from 'next/link';
import { FiArrowLeft, FiList } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';
import DpFolhaPanel from '@/components/dp/DpFolhaPanel';

/**
 * Lista operacional de folhas. Motor vivo é DpFolhaPanel (mesmo da aba
 * Rubricas & Folha em /department/dp). Sem redirect para o hub.
 */
export default function PayrollSheetsPage() {
  const { t } = useI18n();

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex shrink-0 items-center gap-3">
        <Link
          href="/folha-pagamento?tab=folhas"
          className="rounded-lg p-2 text-gray-400 transition-colors hover:text-abz-blue"
          title={t('common.back', 'Voltar')}
        >
          <FiArrowLeft className="h-5 w-5" />
        </Link>
        <span className="rounded-xl bg-blue-50 p-1.5 text-abz-blue">
          <FiList className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-lg font-black text-gray-900">
            {t('payroll.recentSheets', 'Folhas recentes')}
          </h1>
          <p className="text-xs text-gray-500">
            {t('financeiro.folhasDescricao', 'Competências, cálculo e aprovação da folha')}
          </p>
        </div>
      </div>
      <DpFolhaPanel />
    </div>
  );
}
