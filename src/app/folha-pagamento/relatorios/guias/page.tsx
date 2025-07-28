'use client';

import React from 'react';
import { ArrowLeft, FileText } from 'lucide-react';
import Link from 'next/link';
import { useI18n } from '@/contexts/I18nContext';

export default function GuiasRecolhimentoPage() {
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
              <FileText className="h-6 w-6 text-abz-blue" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-abz-text-dark">
                {t('payroll.paymentGuides', 'Guias de Recolhimento')}
              </h1>
              <p className="text-gray-600">
                Gere guias de recolhimento de impostos e contribuições
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-8 text-center">
          <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-600 mb-2">
            Guias de Recolhimento
          </h2>
          <p className="text-gray-500 mb-6">
            Esta funcionalidade está em desenvolvimento. Em breve você poderá gerar guias de recolhimento de INSS, FGTS, IRRF e outras contribuições.
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
