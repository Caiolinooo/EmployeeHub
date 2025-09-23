'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FiSettings, FiGrid, FiUsers, FiFileText, FiMenu, FiX, FiLogOut, FiLayers, FiList, FiEdit, FiUser, FiUserCheck, FiDollarSign, FiCheck, FiTool, FiKey, FiUserX, FiChevronLeft, FiChevronRight, FiBell, FiAward, FiSmartphone, FiDatabase } from 'react-icons/fi';
import NotificationHUD from '@/components/notifications/NotificationHUD';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useI18n } from '@/contexts/I18nContext';
import Footer from '@/components/Footer';
import ProtectedRoute from '@/components/Auth/ProtectedRoute';
import LanguageSelector from '@/components/LanguageSelector';
import PerformanceMonitor from '@/components/Performance/PerformanceMonitor';
import { startMeasure, endMeasure, logPerformance } from '@/lib/performance';

// Itens do menu de administração
const adminMenuItems = [
  { id: 'dashboard', href: '/admin', label: 'admin.dashboard', icon: FiGrid },
  { id: 'setup', href: '/admin/setup', label: 'admin.systemSetup', icon: FiTool },
  { id: 'cards', href: '/admin/cards', label: 'admin.cards', icon: FiLayers },
  { id: 'menu', href: '/admin/menu', label: 'admin.menu', icon: FiList },
  { id: 'documents-pt', href: '/admin/documentos', label: 'admin.documentsSection', icon: FiFileText },
  { id: 'news-pt', href: '/admin/noticias', label: 'admin.news', icon: FiEdit },
  { id: 'editors', href: '/admin/editors', label: 'admin.editors', icon: FiEdit },
  { id: 'acl-management', href: '/admin/acl-management', label: 'admin.acl', icon: FiKey },
  { id: 'user-management', href: '/admin/user-management', label: 'admin.usersSection', icon: FiUsers },
  { id: 'authorized-users', href: '/admin/authorized-users', label: 'admin.authorizedUsers', icon: FiUserCheck },
  { id: 'role-permissions', href: '/admin/role-permissions', label: 'admin.rolePermissions', icon: FiKey },
  { id: 'user-approval-settings', href: '/admin/user-approval-settings', label: 'admin.userApprovalSettings', icon: FiUserCheck },
  { id: 'banned-users', href: '/admin/banned-users', label: 'admin.bannedUsers', icon: FiUserX },
  { id: 'notifications', href: '/admin/notifications', label: 'Notificações', icon: FiBell },
  { id: 'academy-certificates', href: '/admin/academy/certificates', label: 'Academy - Certificados', icon: FiAward },
  // Seção de Reembolsos
  { id: 'reimbursement-dashboard', href: '/reembolso?tab=dashboard', label: 'admin.myReimbursements', icon: FiDollarSign },
  { id: 'reimbursement-approval', href: '/reembolso?tab=approval', label: 'admin.approveReimbursements', icon: FiCheck },
  { id: 'reimbursement-settings', href: '/admin/reimbursement-settings', label: 'admin.reimbursementSettings', icon: FiSettings },
  { id: 'reimbursement-migration', href: '/admin/reimbursement-migration', label: 'admin.reimbursementMigration', icon: FiSettings },
  // Configurações gerais
  { id: 'settings', href: '/admin/settings', label: 'admin.settings', icon: FiSettings },
  { id: 'admin-fix', href: '/admin-fix', label: 'admin.fixPermissions', icon: FiUserCheck },
];

// Menu de administração organizado por categorias
const adminMenuGroups = [
  {
    id: 'overview',
    label: 'admin.dashboard',
    items: [
      { id: 'dashboard', href: '/admin', label: 'admin.dashboard', icon: FiGrid },
    ]
  },
  {
    id: 'content',
    label: 'admin.content',
    items: [
      { id: 'cards', href: '/admin/cards', label: 'admin.cards', icon: FiLayers },
      { id: 'menu', href: '/admin/menu', label: 'admin.menu', icon: FiList },
      { id: 'documents-pt', href: '/admin/documentos', label: 'admin.documentsSection', icon: FiFileText },
      { id: 'news-pt', href: '/admin/noticias', label: 'admin.news', icon: FiEdit },
      { id: 'editors', href: '/admin/editors', label: 'admin.editors', icon: FiEdit },
    ]
  },
  {
    id: 'users',
    label: 'admin.usersSection',
    items: [
      { id: 'user-management', href: '/admin/user-management', label: 'admin.usersSection', icon: FiUsers },
      { id: 'role-permissions', href: '/admin/role-permissions', label: 'admin.rolePermissions', icon: FiKey },
      { id: 'authorized-users', href: '/admin/authorized-users', label: 'admin.authorizedUsers', icon: FiUserCheck },
      { id: 'user-approval-settings', href: '/admin/user-approval-settings', label: 'admin.userApprovalSettings', icon: FiUserCheck },
      { id: 'banned-users', href: '/admin/banned-users', label: 'admin.bannedUsers', icon: FiUserX },
    ]
  },
  {
    id: 'academy',
    label: 'Academy',
    items: [
      { id: 'academy-certificates', href: '/admin/academy/certificates', label: 'Academy - Certificados', icon: FiAward },
    ]
  },
  {
    id: 'communications',
    label: 'admin.communications',
    items: [
      { id: 'notifications', href: '/admin/notifications', label: 'Notificações', icon: FiBell },
    ]
  },
  {
    id: 'reimbursements',
    label: 'admin.reimbursements',
    items: [
      { id: 'reimbursement-dashboard', href: '/reembolso?tab=dashboard', label: 'admin.myReimbursements', icon: FiDollarSign },
      { id: 'reimbursement-approval', href: '/reembolso?tab=approval', label: 'admin.approveReimbursements', icon: FiCheck },
      { id: 'reimbursement-settings', href: '/admin/reimbursement-settings', label: 'admin.reimbursementSettings', icon: FiSettings },
      { id: 'reimbursement-migration', href: '/admin/reimbursement-migration', label: 'admin.reimbursementMigration', icon: FiSettings },
    ]
  },
  {
    id: 'integrations',
    label: 'admin.integrations',
    items: [
      { id: 'api-mobile', href: '/admin/api-mobile', label: 'admin.apiMobile', icon: FiSmartphone },
      { id: 'integracao-erp', href: '/admin/integracao-erp', label: 'admin.erpIntegration', icon: FiDatabase },
    ]
  },
  {
    id: 'system',
    label: 'admin.system',
    items: [
      { id: 'setup', href: '/admin/setup', label: 'admin.systemSetup', icon: FiTool },
      { id: 'settings', href: '/admin/settings', label: 'admin.settings', icon: FiSettings },
      { id: 'acl-management', href: '/admin/acl-management', label: 'admin.acl', icon: FiKey },
      { id: 'admin-fix', href: '/admin-fix', label: 'admin.fixPermissions', icon: FiUserCheck },
    ]
  }
];


export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, profile, logout, isAdmin } = useSupabaseAuth();
  const { t } = useI18n();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isCollapsed, setIsCollapsed] = React.useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  // Estado persistente para recolher/expandir sidebar
  React.useEffect(() => {
    const saved = localStorage.getItem('admin-sidebar-collapsed');
    if (saved) setIsCollapsed(JSON.parse(saved));
  }, []);
  const toggleSidebar = () => {
    const v = !isCollapsed;
    setIsCollapsed(v);
    localStorage.setItem('admin-sidebar-collapsed', JSON.stringify(v));
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
        <aside className={`${isCollapsed ? 'w-16' : 'w-64'} bg-white shadow-md fixed inset-y-0 left-0 transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 transition-all duration-300 ease-in-out z-30 flex flex-col`}>
          {/* Logo / título e botão de recolher */}
          <div className="p-4 border-b flex items-center justify-between">
            <Link href="/admin" className={`flex items-center ${isCollapsed ? 'justify-center w-full' : 'space-x-2'}`}
              title={t('admin.title') as string}
            >
              <FiSettings className="h-6 w-6 text-abz-blue" />
              {!isCollapsed && (
                <span className="text-lg font-semibold text-abz-blue-dark">{t('admin.title')}</span>
              )}
            </Link>
            <div className="flex items-center gap-2">
              <button
                className="hidden md:inline-flex rounded p-1 text-gray-600 hover:bg-gray-100"
                onClick={toggleSidebar}
                title={isCollapsed ? t('common.expandMenu', 'Expandir menu') as string : t('common.collapseMenu', 'Recolher menu') as string}
              >
                {isCollapsed ? <FiChevronRight className="h-5 w-5"/> : <FiChevronLeft className="h-5 w-5"/>}
              </button>
              <button
                className="md:hidden text-gray-500 hover:text-gray-700"
                onClick={toggleMobileMenu}
              >
                <FiX className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Menu de navegação */}
          <nav className="flex-grow overflow-y-auto py-4 space-y-3 px-2">
            {adminMenuGroups.map((group) => (
              <div key={group.id}>
                {!isCollapsed && (
                  <div className="px-4 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    {t(group.label)}
                  </div>
                )}
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const isActive = pathname === item.href;
                    const IconComponent = item.icon;
                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        title={t(item.label) as string}
                        className={`flex items-center ${isCollapsed ? 'px-2 justify-center' : 'px-4'} py-2.5 rounded-md text-sm font-medium transition-colors duration-150 ${
                          isActive
                            ? 'bg-abz-blue text-white shadow-sm'
                            : 'text-gray-600 hover:bg-gray-100 hover:text-abz-blue-dark'
                        }`}
                      >
                        <IconComponent className={`${isCollapsed ? '' : 'mr-3'} h-5 w-5 ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-500'}`} />
                        {!isCollapsed && t(item.label)}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* Rodapé com informações do usuário e botão de logout */}
          <div className="p-4 border-t">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 rounded-full bg-abz-light-blue flex items-center justify-center mr-3">
                {/* user?.avatar não existe no tipo User */}
                <FiUser className="h-5 w-5 text-abz-blue" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">{user?.email}</p>
                <p className="text-xs text-gray-500">
                  {profile?.first_name ? `${profile.first_name} ${profile.last_name || ''}`.trim() : 'Usuário'}
                </p>
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
        <div className="flex-1 flex flex-col min-h-screen" style={{marginLeft: typeof window === 'undefined' ? undefined : (window.innerWidth >= 768 ? (isCollapsed ? 64 : 256) : 0)}}>
          {/* Notificações globais fixas (desktop) */}
          <div className="hidden md:block fixed top-4 right-4 z-50">
            {user && <NotificationHUD userId={user.id} position="top-right" />}
          </div>

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
                <span className="ml-3 text-lg font-semibold text-abz-blue-dark">{t('admin.title')}</span>
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
