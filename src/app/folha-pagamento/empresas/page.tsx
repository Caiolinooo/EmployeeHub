'use client';

import React from 'react';
import Link from 'next/link';
import { FiArrowLeft, FiBriefcase } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';
import EmpresasTab from '@/components/financeiro/EmpresasTab';

/**
 * CRUD de empresas emissoras (`payroll_companies`). Mesmo painel da aba
 * Empresas do hub. Sem redirect de volta ao hub.
 */
export default function EmpresasPage() {
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
          <FiBriefcase className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-lg font-black text-gray-900">
            {t('payroll.manageCompanies', 'Empresas')}
          </h1>
          <p className="text-xs text-gray-500">
            {t('fin.tabEmpresas', 'Empresas emissoras da folha e da fatura')}
          </p>
        </div>
      </div>
      <EmpresasTab />
    </div>
  );
}
