'use client';

import React from 'react';
import MainLayout from '@/components/Layout/MainLayout';
import { FiBriefcase, FiInfo } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';

export default function ProcedimentosPage() {
  const { t } = useI18n();

  return (
    <MainLayout>
      <h1 className="text-3xl font-bold text-abz-text-black mb-6">{t('menu.procedimentosGerais')}</h1>

      <div className="bg-white p-8 rounded-lg shadow-md">
        <div className="flex items-center justify-center text-center text-gray-500 py-12 px-6 border-2 border-dashed border-gray-300 rounded-lg">
          <div>
            <FiBriefcase className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h2 className="text-xl font-semibold text-abz-text-black mb-2">{t('procedimentos.comingSoon')}</h2>
            <p className="text-sm">
              {t('procedimentos.description')}
            </p>
            <p className="text-sm mt-1">
              {t('procedimentos.contentAvailable')}
            </p>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}