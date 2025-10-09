'use client';

import React from 'react';
import { useI18n } from '@/contexts/I18nContext';
import MainLayout from '@/components/Layout/MainLayout';
import ProtectedRoute from '@/components/Auth/ProtectedRoute';
import EvaluationDashboard from '@/components/evaluation/EvaluationDashboard';

export default function EvaluationDashboardPage() {
  const { t } = useI18n();

  return (
    <ProtectedRoute>
      <MainLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            {t('evaluation.dashboard.title', 'Dashboard de Avaliações')}
          </h1>
          
          <EvaluationDashboard />
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
}

