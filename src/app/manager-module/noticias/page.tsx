'use client';

import React from 'react';
import ProtectedRoute from '@/components/Auth/ProtectedRoute';
import MainLayout from '@/components/Layout/MainLayout';
import { useI18n } from '@/contexts/I18nContext';
import NewsAdminPage from '@/app/admin/noticias/page';

export default function ManagerNewsPage() {
  const { t } = useI18n();
  return (
    <ProtectedRoute managerOnly>
      <MainLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {t('admin.news', 'News')}
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                {t('admin.newsDesc', 'Add and edit news and announcements.')}
              </p>
            </div>
          </div>
          <NewsAdminPage />
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
}

