'use client';

import React from 'react';
import { useI18n } from '@/contexts/I18nContext';
import MainLayout from '@/components/Layout/MainLayout';
import ProtectedRoute from '@/components/Auth/ProtectedRoute';

export default function ManagerModulePage() {
  const { t } = useI18n();

  return (
    <ProtectedRoute managerOnly>
      <MainLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{t('manager.moduleTitle')}</h1>
              <p className="mt-1 text-sm text-gray-500">
                {t('manager.moduleDescription')}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('manager.welcome')}</h2>
            <p className="text-gray-600">
              {t('manager.moduleIntro')}
            </p>
            
            {/* Conteúdo do módulo será implementado aqui */}
            <div className="mt-6 p-4 bg-blue-50 rounded-md">
              <p className="text-blue-700">
                {t('common.comingSoon')}
              </p>
            </div>
          </div>
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
}

