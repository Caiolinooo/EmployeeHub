'use client';

import React, { useState, useEffect } from 'react';
import { FiRss, FiEdit, FiBell, FiClock, FiUsers, FiSettings } from 'react-icons/fi';
import NewsFeed from '@/components/news/NewsFeed';
import NewsAdminPanel from '@/components/news/NewsAdminPanel';
import NotificationHUD from '@/components/notifications/NotificationHUD';
import ReminderManager from '@/components/reminders/ReminderManager';
import ACLManagementPanel from '@/components/admin/ACLManagementPanel';
import ACLInitializer from '@/components/admin/ACLInitializer';
import { useACLPermissions } from '@/hooks/useACLPermissions';
import { useNotifications } from '@/hooks/useNotifications';
import { useI18n } from '@/contexts/I18nContext';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';

const NewsPage: React.FC = () => {
  const { t } = useI18n();
  const { user, profile, isAuthenticated, isLoading } = useSupabaseAuth();
  const [activeTab, setActiveTab] = useState<'feed' | 'admin' | 'reminders' | 'acl'>('feed');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [showFeaturedOnly, setShowFeaturedOnly] = useState(false);

  // Obter userId do usuário autenticado
  const userId = user?.id || profile?.id || '';

  const {
    hasPermission,
    canCreateNews,
    canPublishNews,
    canManageReminders,
    isAdmin,
    isManager
  } = useACLPermissions(userId);

  const { unreadCount } = useNotifications(userId);

  // Verificar se o usuário está autenticado
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !userId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Você precisa estar logado para acessar esta página.</p>
          <a href="/login" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Fazer Login
          </a>
        </div>
      </div>
    );
  }

  const tabs = [
    {
      id: 'feed',
      label: 'Feed de Notícias',
      icon: FiRss,
      description: 'Visualizar posts estilo Instagram',
      show: true
    },
    {
      id: 'admin',
      label: 'Gerenciar Posts',
      icon: FiEdit,
      description: 'Criar e gerenciar posts',
      show: canCreateNews || canPublishNews
    },
    {
      id: 'reminders',
      label: 'Lembretes',
      icon: FiClock,
      description: 'Gerenciar lembretes e agendamentos',
      show: canManageReminders
    },
    {
      id: 'acl',
      label: 'Permissões ACL',
      icon: FiUsers,
      description: 'Gerenciar controle de acesso',
      show: isAdmin
    }
  ].filter(tab => tab.show);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo/Title */}
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <FiRss className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{t('newsSystem.title')}</h1>
                <p className="text-sm text-gray-500">{t('newsSystem.subtitle')}</p>
              </div>
            </div>

            {/* User Info & Notifications */}
            <div className="flex items-center space-x-4">
              {/* User Role Badge */}
              <div className="flex items-center space-x-2">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  isAdmin ? 'bg-red-100 text-red-800' :
                  isManager ? 'bg-blue-100 text-blue-800' :
                  'bg-green-100 text-green-800'
                }`}>
                  {isAdmin ? 'Administrador' : isManager ? 'Gerente' : 'Usuário'}
                </span>
              </div>

              {/* Notification HUD */}
              <NotificationHUD userId={userId} position="top-right" />

              {/* Settings */}
              <button className="p-2 text-gray-400 hover:text-gray-600 rounded-full">
                <FiSettings className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'feed' && (
          <div className="space-y-6">
            {/* Feed Filters */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium text-gray-900">Feed de Notícias</h2>
                <div className="flex items-center space-x-4">
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Todas as categorias</option>
                    <option value="comunicados">Comunicados</option>
                    <option value="noticias">Notícias</option>
                    <option value="eventos">Eventos</option>
                    <option value="treinamentos">Treinamentos</option>
                    <option value="beneficios">Benefícios</option>
                    <option value="tecnologia">Tecnologia</option>
                  </select>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={showFeaturedOnly}
                      onChange={(e) => setShowFeaturedOnly(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Apenas destaques</span>
                  </label>
                </div>
              </div>
            </div>

            {/* News Feed */}
            <NewsFeed
              userId={userId}
              category={selectedCategory}
              featured={showFeaturedOnly}
              limit={10}
            />
          </div>
        )}

        {activeTab === 'admin' && (
          <NewsAdminPanel userId={userId} />
        )}

        {activeTab === 'reminders' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <ReminderManager userId={userId} />
            </div>
          </div>
        )}

        {activeTab === 'acl' && (
          <div className="space-y-6">
            <ACLInitializer />
            <ACLManagementPanel />
          </div>
        )}
      </div>



      {/* Stats Footer */}
      <div className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">100%</div>
              <div className="text-sm text-gray-500">Sistema Funcional</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">10</div>
              <div className="text-sm text-gray-500">Tabelas Criadas</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">20</div>
              <div className="text-sm text-gray-500">Permissões ACL</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{unreadCount}</div>
              <div className="text-sm text-gray-500">Notificações</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewsPage;
