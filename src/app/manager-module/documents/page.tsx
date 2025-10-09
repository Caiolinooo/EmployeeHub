'use client';

import React from 'react';
import ProtectedRoute from '@/components/Auth/ProtectedRoute';
import MainLayout from '@/components/Layout/MainLayout';
import { useI18n } from '@/contexts/I18nContext';
import DocumentsPage from '@/app/admin/documents/page';

export default function ManagerDocumentsPage() {
  const { t } = useI18n();
  return (
    <ProtectedRoute managerOnly>
      <MainLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {t('admin.documents.section', 'Documents')}
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                {t('admin.documents.description', 'Manage documents, policies, and manuals.')}
              </p>
            </div>
          </div>
          {/* Reuse the same admin documents manager */}
          <DocumentsPage />
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
}


