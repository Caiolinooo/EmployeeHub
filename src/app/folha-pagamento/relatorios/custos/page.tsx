'use client';

import React from 'react';
import { ArrowLeft, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { useI18n } from '@/contexts/I18nContext';

export default function AnaliseCustosPage() {
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
              <TrendingUp className="h-6 w-6 text-abz-blue" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-abz-text-dark">
                {t('payroll.costAnalysis', 'Análise de Custos')}
              </h1>
              <p className="text-gray-600">
                Análise detalhada dos custos da folha de pagamento
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-8 text-center">
          <TrendingUp className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-600 mb-2">
            Análise de Custos
          </h2>
          <p className="text-gray-500 mb-6">
            Esta funcionalidade está em desenvolvimento. Em breve você poderá visualizar análises detalhadas dos custos da folha de pagamento, incluindo gráficos e comparativos.
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
