'use client';

import React from 'react';
import UnifiedUserManager from '@/components/admin/UnifiedUserManager';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { FiUsers, FiUploadCloud, FiUserPlus } from 'react-icons/fi';
import Link from 'next/link';
import { useI18n } from '@/contexts/I18nContext';

export default function UserManagementPage() {
  const { isAdmin, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const { t } = useI18n();

  // Redirecionar se não for administrador
  React.useEffect(() => {
    if (!isLoading && !isAdmin) {
      router.push('/dashboard');
    }
  }, [isAdmin, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-abz-blue"></div>
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return null;
  }

  return (
    <div className="container mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div className="flex items-center">
          <FiUsers className="h-6 w-6 text-abz-blue mr-2" />
          <h1 className="text-2xl font-bold text-abz-blue">{t('admin.usersSection')}</h1>
        </div>

        <div className="flex space-x-3 mt-4 md:mt-0">
          <Link
            href="/admin/user-management/import"
            className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-abz-blue hover:bg-abz-blue-dark"
          >
            <FiUploadCloud className="mr-2" />
            {t('admin.importUsers')}
          </Link>

          <Link
            href="/admin/user-management/add"
            className="flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <FiUserPlus className="mr-2" />
            {t('admin.addUser')}
          </Link>
        </div>
      </div>

      <UnifiedUserManager />
    </div>
  );
}
