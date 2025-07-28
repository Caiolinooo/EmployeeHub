'use client';

import React from 'react';
import { ArrowLeft, Settings } from 'lucide-react';
import Link from 'next/link';
import { useI18n } from '@/contexts/I18nContext';

export default function TabelasLegaisPage() {
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center space-x-3">
            <Link
              href="/folha-pagamento"
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              title={t('common.back', 'Voltar')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="p-2 bg-abz-blue/10 rounded-lg">
              <Settings className="h-6 w-6 text-abz-blue" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-abz-text-dark">
                {t('payroll.legalTables', 'Tabelas Legais')}
              </h1>
              <p className="text-gray-600">
                Configure tabelas de INSS, IRRF e outras contribuições
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-8 text-center">
          <Settings className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-600 mb-2">
            Tabelas Legais
          </h2>
          <p className="text-gray-500 mb-6">
            Esta funcionalidade está em desenvolvimento. Em breve você poderá configurar tabelas de INSS, IRRF, salário família e outras contribuições legais.
          </p>
          <Link
            href="/folha-pagamento"
            className="bg-abz-blue text-white px-6 py-2 rounded-md hover:bg-abz-blue-dark transition-colors"
          >
            Voltar ao Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
