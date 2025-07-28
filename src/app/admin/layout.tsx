'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FiSettings, FiGrid, FiUsers, FiFileText, FiMenu, FiX, FiLogOut, FiLayers, FiList, FiEdit, FiImage, FiUser, FiUserCheck, FiDollarSign, FiCheck, FiTool } from 'react-icons/fi';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import Footer from '@/components/Footer';
import ProtectedRoute from '@/components/Auth/ProtectedRoute';
import LanguageSelector from '@/components/LanguageSelector';
import PerformanceMonitor from '@/components/Performance/PerformanceMonitor';
import { startMeasure, endMeasure, logPerformance } from '@/lib/performance';

// Itens do menu de administração
const adminMenuItems = [
  { id: 'dashboard', href: '/admin', label: 'admin.dashboard', icon: FiGrid },
  { id: 'setup', href: '/admin/setup', label: 'Setup do Sistema', icon: FiTool },
  { id: 'cards', href: '/admin/cards', label: 'admin.cards', icon: FiLayers },
  { id: 'menu', href: '/admin/menu', label: 'admin.menu', icon: FiList },
  { id: 'documents', href: '/admin/documents', label: 'admin.documentsSection', icon: FiFileText },
  { id: 'news', href: '/admin/news', label: 'admin.news', icon: FiEdit },
  { id: 'user-management', href: '/admin/user-management', label: 'admin.usersSection', icon: FiUsers },
  // Seção de Reembolsos
  { id: 'reimbursement-dashboard', href: '/reembolso?tab=dashboard', label: 'Meus Reembolsos', icon: FiDollarSign },
  { id: 'reimbursement-approval', href: '/reembolso?tab=approval', label: 'Aprovar Reembolsos', icon: FiCheck },
  { id: 'reimbursement-settings', href: '/admin/reimbursement-settings', label: 'Configurações de Reembolso', icon: FiSettings },
  // Configurações gerais
  { id: 'settings', href: '/admin/settings', label: 'admin.settings', icon: FiSettings },
  { id: 'admin-fix', href: '/admin-fix', label: 'Corrigir Permissões', icon: FiUserCheck },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout, isAdmin } = useAuth();
  const { t } = useI18n();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  // Medir o tempo de renderização do layout
  React.useEffect(() => {
    startMeasure('adminLayout-render');
    return () => {
      const duration = endMeasure('adminLayout-render');
      logPerformance('AdminLayout rendered', duration);
    };
  }, []);

  // Adicionar logs para depuração
  console.log('AdminLayout - isAdmin:', isAdmin);
  console.log('AdminLayout - pathname:', pathname);
  console.log('AdminLayout - user:', user);

  // Verificar se estamos em ambiente de desenvolvimento
  const isDevelopment = process.env.NODE_ENV === 'development';
  console.log('AdminLayout - Ambiente de desenvolvimento:', isDevelopment);

  return (
    <ProtectedRoute adminOnly>
      <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row">
        {/* Sidebar para desktop */}
        <aside className={`bg-white shadow-md w-64 fixed inset-y-0 left-0 transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 transition-transform duration-300 ease-in-out z-30 flex flex-col`}>
          {/* Logo e título */}
          <div className="p-4 border-b flex items-center justify-between">
            <Link href="/admin" className="flex items-center space-x-2">
              <FiSettings className="h-6 w-6 text-abz-blue" />
              <span className="text-lg font-semibold text-abz-blue-dark">Painel Admin</span>
            </Link>
            <button
              className="md:hidden text-gray-500 hover:text-gray-700"
              onClick={toggleMobileMenu}
            >
              <FiX className="h-6 w-6" />
            </button>
          </div>

          {/* Menu de navegação */}
          <nav className="flex-grow overflow-y-auto py-4 space-y-1 px-2">
            {adminMenuItems.map((item) => {
              const isActive = pathname === item.href;
              const IconComponent = item.icon;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`flex items-center px-4 py-2.5 rounded-md text-sm font-medium transition-colors duration-150 ${
                    isActive
                      ? 'bg-abz-blue text-white shadow-sm'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-abz-blue-dark'
                  }`}
                >
                  <IconComponent className={`mr-3 h-5 w-5 ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-500'}`} />
                  {t(item.label)}
                </Link>
              );
            })}
          </nav>

          {/* Rodapé com informações do usuário e botão de logout */}
          <div className="p-4 border-t">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 rounded-full bg-abz-light-blue flex items-center justify-center mr-3">
                {user?.avatar ? (
                  <img src={user.avatar} alt={user.name || 'User'} className="w-10 h-10 rounded-full" />
                ) : (
                  <FiUser className="h-5 w-5 text-abz-blue" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">{user?.name}</p>
                <p className="text-xs text-gray-500">{user?.email}</p>
              </div>
            </div>
            <div className="mb-3">
              <LanguageSelector variant="inline" className="justify-center" />
            </div>
            <div className="flex space-x-2">
              <Link
                href="/dashboard"
                className="flex-1 px-3 py-2 text-xs font-medium rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 flex items-center justify-center"
              >
                <FiGrid className="mr-1" />
                {t('common.dashboard')}
              </Link>
              <button
                onClick={() => logout()}
                className="flex-1 px-3 py-2 text-xs font-medium rounded-md bg-red-100 text-red-700 hover:bg-red-200 flex items-center justify-center"
              >
                <FiLogOut className="mr-1" />
                {t('common.logout')}
              </button>
            </div>
          </div>
        </aside>

        {/* Conteúdo principal */}
        <div className="flex-1 md:ml-64 flex flex-col min-h-screen">
          {/* Header mobile */}
          <header className="bg-white shadow-sm md:hidden">
            <div className="px-4 py-3 flex items-center justify-between">
              <div className="flex items-center">
                <button
                  onClick={toggleMobileMenu}
                  className="text-gray-500 hover:text-gray-700 focus:outline-none"
                >
                  <FiMenu className="h-6 w-6" />
                </button>
                <span className="ml-3 text-lg font-semibold text-abz-blue-dark">Painel Admin</span>
              </div>
              <Link href="/dashboard" className="text-gray-500 hover:text-gray-700">
                <FiGrid className="h-6 w-6" />
              </Link>
            </div>
          </header>

          {/* Conteúdo da página */}
          <main className="flex-1 p-4 md:p-6 overflow-auto">
            {children}
          </main>

          {/* Footer */}
          <Footer />

          {/* Performance Monitor (only visible in development) */}
          <PerformanceMonitor />
        </div>
      </div>
    </ProtectedRoute>
  );
}
