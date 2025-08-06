'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FiLayers, FiList, FiFileText, FiEdit, FiUsers, FiSettings, FiUserCheck, FiRefreshCw, FiBarChart2, FiKey } from 'react-icons/fi';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useI18n } from '@/contexts/I18nContext';

// Componente de card para o dashboard de administração
interface AdminCardProps {
  title: string;
  description: string;
  icon: React.ElementType;
  href: string;
  color: string;
}

const AdminCard = ({ title, description, icon: Icon, href, color }: AdminCardProps) => {
  const { t } = useI18n();
  return (
  <Link
    href={href}
    className={`bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow flex flex-col h-full border-t-4 ${color}`}
  >
    <div className="flex items-start mb-4">
      <div className="p-3 rounded-full bg-gray-100 mr-4">
        <Icon className="h-6 w-6 text-gray-600" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
    </div>
    <p className="text-gray-600 text-sm flex-grow">{description}</p>
    <div className="mt-4 pt-4 border-t border-gray-100">
      <span className="text-sm font-medium text-abz-blue">{t('common.manage')} &rarr;</span>
    </div>
  </Link>
  );
};

export default function AdminDashboard() {
  const { user, profile, isAdmin } = useSupabaseAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [isFixingPermissions, setIsFixingPermissions] = useState(false);

  // Verificar se estamos em ambiente de desenvolvimento
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Adicionar logs para depuração
  console.log('AdminDashboard - isAdmin:', isAdmin);
  console.log('AdminDashboard - user:', user);
  console.log('AdminDashboard - Ambiente de desenvolvimento:', isDevelopment);

  // Função para corrigir permissões de administrador
  const fixAdminPermissions = () => {
    setIsFixingPermissions(true);
    router.push('/admin-fix');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('admin.dashboard')}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {t('admin.welcomeAdmin', `Bem-vindo, ${profile?.first_name || 'Admin'}`)}
          </p>
        </div>
        <div className="mt-4 md:mt-0">
          <button
            onClick={fixAdminPermissions}
            disabled={isFixingPermissions}
            className="flex items-center px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition-colors"
          >
            {isFixingPermissions ? (
              <>
                <FiRefreshCw className="animate-spin mr-2" />
                Corrigindo Permissões...
              </>
            ) : (
              <>
                <FiUserCheck className="mr-2" />
                Corrigir Permissões
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AdminCard
          title={t('admin.cards')}
          description={t('admin.cardsDesc')}
          icon={FiLayers}
          href="/admin/cards"
          color="border-blue-500"
        />
        <AdminCard
          title={t('admin.menu')}
          description={t('admin.menuDesc')}
          icon={FiList}
          href="/admin/menu"
          color="border-indigo-500"
        />
        <AdminCard
          title={t('admin.documentsSection')}
          description={t('admin.documentsDesc')}
          icon={FiFileText}
          href="/admin/documentos"
          color="border-purple-500"
        />
        <AdminCard
          title={t('admin.news')}
          description={t('admin.newsDesc')}
          icon={FiEdit}
          href="/admin/noticias"
          color="border-pink-500"
        />
        <AdminCard
          title={t('admin.usersSection')}
          description={t('admin.usersSectionDesc')}
          icon={FiUsers}
          href="/admin/user-management"
          color="border-yellow-500"
        />
        <AdminCard
          title={t('admin.settings')}
          description={t('admin.settingsDesc')}
          icon={FiSettings}
          href="/admin/settings"
          color="border-green-500"
        />
        <AdminCard
          title={t('admin.avaliacao.title', 'Avaliação de Desempenho')}
          description={t('admin.avaliacao.description', 'Gerencie o módulo de avaliação de desempenho')}
          icon={FiBarChart2}
          href="/admin/avaliacao"
          color="border-teal-500"
        />
        <AdminCard
          title="Permissões por Role"
          description="Configure permissões padrão para cada tipo de usuário"
          icon={FiKey}
          href="/admin/role-permissions"
          color="border-orange-500"
        />
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 mt-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('admin.systemInfo')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm font-medium text-gray-500">{t('admin.version')}</p>
            <p className="text-lg font-semibold text-gray-900">1.0.0</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm font-medium text-gray-500">{t('admin.lastLogin')}</p>
            <p className="text-lg font-semibold text-gray-900">{new Date().toLocaleDateString()}</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm font-medium text-gray-500">{t('admin.status')}</p>
            <p className="text-lg font-semibold text-green-600">{t('admin.active')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
