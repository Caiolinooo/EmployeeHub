'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  FiHome, 
  FiUser, 
  FiSettings, 
  FiLogOut, 
  FiMenu, 
  FiX, 
  FiGrid,
  FiFileText,
  FiDollarSign,
  FiCalendar,
  FiPhone,
  FiClock,
  FiTrendingUp,
  FiBook,
  FiMessageSquare,
  FiUsers,
  FiChevronLeft,
  FiChevronRight
} from 'react-icons/fi';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { useMenuItems } from '@/hooks/useUnifiedData';
import NotificationHUD from '@/components/notifications/NotificationHUD';
import LanguageSelector from '@/components/LanguageSelector';
import Footer from '@/components/Footer';
import ProtectedRoute from '@/components/Auth/ProtectedRoute';

interface MainLayoutProps {
  children: React.ReactNode;
}

// Menu principal do sistema
const mainMenuItems = [
  { id: 'dashboard', href: '/dashboard', label: 'common.dashboard', icon: FiHome },
  { id: 'reembolso', href: '/reembolso', label: 'common.reimbursement', icon: FiDollarSign },
  { id: 'avaliacao', href: '/avaliacao', label: 'common.evaluation', icon: FiTrendingUp },
  { id: 'calendario', href: '/calendario', label: 'common.calendar', icon: FiCalendar },
  { id: 'contatos', href: '/contatos', label: 'common.contacts', icon: FiPhone },
  { id: 'ponto', href: '/ponto', label: 'common.timesheet', icon: FiClock },
  { id: 'contracheque', href: '/contracheque', label: 'common.payroll', icon: FiFileText },
  { id: 'academy', href: '/academy', label: 'common.academy', icon: FiBook },
  { id: 'noticias', href: '/noticias', label: 'common.news', icon: FiMessageSquare },
  { id: 'profile', href: '/profile', label: 'common.profile', icon: FiUser },
];

export default function MainLayout({ children }: MainLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, logout, isAdmin } = useSupabaseAuth();
  const { t, locale } = useI18n();
  const [isI18nReady, setIsI18nReady] = useState(false);
  const [, forceUpdate] = useState({});

  // Forçar re-render quando o locale mudar
  useEffect(() => {
    console.log('🌐 Locale mudou para:', locale);
    forceUpdate({});
  }, [locale]);

  // Verificar se o I18n está pronto
  useEffect(() => {
    // Testar se a tradução está funcionando
    const testTranslation = t('common.dashboard');
    console.log('🔤 Teste de tradução - common.dashboard:', testTranslation);

    if (testTranslation && testTranslation !== 'common.dashboard') {
      console.log('✅ I18n está pronto!');
      setIsI18nReady(true);
    } else {
      console.warn('⚠️ I18n ainda não está pronto, aguardando...');
      // Tentar novamente após um pequeno delay
      const timer = setTimeout(() => {
        setIsI18nReady(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [locale, t]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  // FORÇAR SIDEBAR EXPANDIDA - NÃO PERMITIR COLAPSAR
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Debug: Verificar se isCollapsed está mudando
  useEffect(() => {
    console.log('🔍 DEBUG: isCollapsed mudou para:', isCollapsed);
    if (isCollapsed) {
      console.warn('⚠️ ATENÇÃO: Sidebar está colapsada! Forçando expansão...');
      setIsCollapsed(false);
    }
  }, [isCollapsed]);

  // Use unified data system for menu items
  const { items: menuItems, loading: menuLoading } = useMenuItems(true);

  // Debug: Log menu items
  useEffect(() => {
    console.log('🔍 Menu items loaded:', menuItems.length, 'items');
    console.log('📝 Menu items:', menuItems);
    console.log('🔄 Loading:', menuLoading);
    console.log('📏 isCollapsed:', isCollapsed);
  }, [menuItems, menuLoading, isCollapsed]);

  // Estado persistente para recolher/expandir sidebar
  useEffect(() => {
    // FORÇAR SIDEBAR SEMPRE EXPANDIDA
    console.log('🚀 Inicializando sidebar...');

    // Limpar qualquer valor antigo do localStorage
    localStorage.removeItem('main-sidebar-collapsed');

    // Forçar estado expandido
    setIsCollapsed(false);
    console.log('✅ Sidebar forçada para expandida (isCollapsed = false)');
  }, []);

  const toggleSidebar = () => {
    // TEMPORARIAMENTE DESABILITADO - Manter sidebar sempre expandida
    console.log('🔒 toggleSidebar chamado, mas está desabilitado para manter sidebar expandida');
    // const newState = !isCollapsed;
    // setIsCollapsed(newState);
    // localStorage.setItem('main-sidebar-collapsed', JSON.stringify(newState));
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row">
        {/* Sidebar para desktop */}
        <aside
          className={`bg-white shadow-md fixed inset-y-0 left-0 transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 transition-all duration-300 ease-in-out z-30 flex flex-col`}
          style={{ width: isCollapsed ? '64px' : '256px' }}
        >
          {/* Logo / título e botão de recolher */}
          <div className="p-4 border-b flex items-center justify-between">
            {!isCollapsed ? (
              <Link href="/dashboard" className="flex items-center space-x-2"
                title="Painel ABZ Group"
              >
                <FiGrid className="h-6 w-6 text-abz-blue" />
                <span className="text-lg font-semibold text-abz-blue-dark">Painel ABZ</span>
              </Link>
            ) : (
              <Link href="/dashboard" className="flex items-center justify-center w-full"
                title="Painel ABZ Group"
              >
                <FiGrid className="h-6 w-6 text-abz-blue" />
              </Link>
            )}
            {!isCollapsed && (
              <div className="flex items-center gap-2">
                <button
                  className="inline-flex rounded-md p-2 text-white bg-abz-blue hover:bg-abz-blue-dark transition-colors shadow-sm"
                  onClick={toggleSidebar}
                  title="Recolher menu"
                >
                  <FiChevronLeft className="h-5 w-5"/>
                </button>
              </div>
            )}
          </div>

          {/* Menu de navegação */}
          <nav className="flex-grow overflow-y-auto py-4 space-y-1 px-2">
            {isCollapsed && (
              <div className="mb-4 px-2">
                <button
                  onClick={toggleSidebar}
                  className="w-full p-2 bg-abz-blue text-white rounded-md hover:bg-abz-blue-dark transition-colors flex items-center justify-center"
                  title="Expandir menu"
                >
                  <FiChevronRight className="h-5 w-5"/>
                </button>
              </div>
            )}
            {(menuItems.length > 0 ? menuItems : mainMenuItems).map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              const IconComponent = item.icon;

              // Obter o texto a ser exibido
              // Se vier do banco (menuItems), usar 'title'
              // Se vier do hardcoded (mainMenuItems), usar 'label' e traduzir
              const displayLabel = menuItems.length > 0
                ? (item as any).title || item.id  // Dados do banco já vêm traduzidos
                : t((item as any).label) || item.id;  // Dados hardcoded precisam ser traduzidos

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  title={displayLabel}
                  className={`flex items-center ${isCollapsed ? 'px-2 justify-center' : 'px-4'} py-2.5 rounded-md text-sm font-medium transition-colors duration-150 ${
                    isActive
                      ? 'bg-abz-blue text-white shadow-sm'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-abz-blue-dark'
                  }`}
                >
                  <IconComponent className={`${isCollapsed ? '' : 'mr-3'} h-5 w-5 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                  {!isCollapsed && <span className="whitespace-nowrap">{displayLabel}</span>}
                </Link>
              );
            })}
          </nav>

          {/* Rodapé com informações do usuário */}
          <div className="p-4 border-t">
            {!isCollapsed && (
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 rounded-full bg-abz-light-blue flex items-center justify-center mr-3 overflow-hidden">
                  {(profile as any)?.drive_photo_url || (profile as any)?.avatar ? (
                    <img
                      src={(profile as any)?.drive_photo_url || (profile as any)?.avatar}
                      alt={profile?.first_name || 'Usuário'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <FiUser className="h-5 w-5 text-abz-blue" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">
                    {profile?.first_name ? `${profile.first_name} ${profile.last_name || ''}`.trim() : user?.email}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                </div>
              </div>
            )}
            
            <div className={`flex ${isCollapsed ? 'flex-col space-y-2' : 'space-x-2'}`}>
              {isAdmin && (
                <Link
                  href="/admin"
                  className={`${isCollapsed ? 'p-2' : 'px-3 py-2'} text-xs bg-abz-blue text-white rounded hover:bg-abz-blue-dark transition-colors flex items-center justify-center`}
                  title="Painel Admin"
                >
                  <FiSettings className={`h-4 w-4 ${!isCollapsed ? 'mr-1' : ''}`} />
                  {!isCollapsed && 'Admin'}
                </Link>
              )}
              
              <button
                onClick={handleLogout}
                className={`${isCollapsed ? 'p-2' : 'px-3 py-2'} text-xs bg-red-500 text-white rounded hover:bg-red-600 transition-colors flex items-center justify-center`}
                title="Sair"
              >
                <FiLogOut className={`h-4 w-4 ${!isCollapsed ? 'mr-1' : ''}`} />
                {!isCollapsed && 'Sair'}
              </button>
            </div>

            {!isCollapsed && (
              <div className="mt-3">
                <LanguageSelector variant="inline" className="justify-center" />
              </div>
            )}
          </div>
        </aside>

        {/* Overlay para mobile */}
        {isMobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden"
            onClick={toggleMobileMenu}
          />
        )}

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
                <span className="ml-3 text-lg font-semibold text-abz-blue-dark">Painel ABZ</span>
              </div>
              <div className="flex items-center space-x-2">
                {user && <NotificationHUD userId={user.id} position="top-right" />}
              </div>
            </div>
          </header>

          {/* Conteúdo da página */}
          <main className="flex-1 p-4 md:p-6 overflow-auto">
            {children}
          </main>

          {/* Footer */}
          <Footer />
        </div>
      </div>
    </ProtectedRoute>
  );
}

