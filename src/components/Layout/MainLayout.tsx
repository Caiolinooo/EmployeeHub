'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  FiGrid,
  FiRss,
  FiUser,
  FiBriefcase,
  FiAward,
  FiBook,
  FiAlertCircle,
  FiChevronDown,
  FiChevronUp,
  FiMenu,
  FiBell,
  FiGlobe,
  FiSettings,
  FiLogOut,
  FiCreditCard,
  FiFileText,
  FiTrendingUp,
  FiClock,
  FiDollarSign,
  FiBarChart2,
  FiSidebar,
  FiShield,
  FiShoppingCart,
  FiEdit3 // New Icon for Edit
} from 'react-icons/fi';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useSiteConfig } from '@/contexts/SiteConfigContext';
import { useNotifications } from '@/hooks/useNotifications';
import { useI18n } from '@/contexts/I18nContext';
import { useMenuItems } from '@/hooks/useUnifiedData';
import NotificationHUD from '@/components/notifications/NotificationHUD';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import LanguageSelector from '@/components/LanguageSelector';
import ProtectedRoute from '@/components/Auth/ProtectedRoute';
import GlobalTimeTracker from '@/components/tracking/GlobalTimeTracker';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import UserAvatar from '@/components/UserAvatar';
import HelpWidget from '@/components/Help/HelpWidget';
import MenuCustomizer from '@/components/admin/MenuCustomizer'; // Import
import GlobalSearch from '@/components/GlobalSearch';
import { useEffectivePermissions } from '@/hooks/useEffectivePermissions';
import { SYSTEM_MODULES, MODULE_CATEGORIES, SystemModule } from '@/constants/modules';
import { getModuleIcon } from '@/constants/moduleIcons';

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const pathname = usePathname();
  const { user, profile, logout, isAdmin } = useSupabaseAuth();
  const { t } = useI18n();

  usePushNotifications();
  const { items: menuItems } = useMenuItems(true);

  const { config } = useSiteConfig();
  const { unreadCount, newsUnreadCount } = useNotifications(user?.id || '');

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMeuRHOpen, setIsMeuRHOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // O estado colapsado/aberto é restaurado do localStorage após o mount.
  // Até lá, as transições ficam desabilitadas para que a página abra direto
  // no estado final, sem animação de "esticar" do menu/conteúdo.
  const [isLayoutStateLoaded, setIsLayoutStateLoaded] = useState(false);
  const layoutTransition = (classes: string) => (isLayoutStateLoaded ? classes : '!transition-none');

  // Customizer State
  const [isMenuCustomizerOpen, setIsMenuCustomizerOpen] = useState(false);

  // Use shared permissions hook
  const { hasPermission, refresh } = useEffectivePermissions();

  // Load sidebar state
  useEffect(() => {
    const saved = localStorage.getItem('main-sidebar-collapsed');
    setIsCollapsed(saved ? JSON.parse(saved) : false);
    const savedMeuRH = localStorage.getItem('sidebar-meurh-open');
    if (savedMeuRH !== null) setIsMeuRHOpen(JSON.parse(savedMeuRH));
    // Só reabilita as transições depois que o estado restaurado foi pintado
    // (dois frames), evitando a animação de esticar ao abrir a página.
    let raf2: number | undefined;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setIsLayoutStateLoaded(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2 !== undefined) cancelAnimationFrame(raf2);
    };
  }, []);

  // Fechar menu mobile automaticamente ao navegar
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const toggleSidebar = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('main-sidebar-collapsed', JSON.stringify(newState));
  };

  const toggleMeuRH = () => {
    if (isCollapsed) {
      setIsCollapsed(false);
      localStorage.setItem('main-sidebar-collapsed', 'false');
      setIsMeuRHOpen(true);
      localStorage.setItem('sidebar-meurh-open', 'true');
      refresh(); // Force permission refresh on open
      return;
    }

    const newState = !isMeuRHOpen;
    setIsMeuRHOpen(newState);
    localStorage.setItem('sidebar-meurh-open', JSON.stringify(newState));
    if (newState) refresh(); // Force permission refresh on open
  };

  const toggleDepartment = () => {
    if (isCollapsed) {
      setIsCollapsed(false);
      localStorage.setItem('main-sidebar-collapsed', 'false');
      setIsDepartmentOpen(true);
      localStorage.setItem('sidebar-dept-open', 'true');
      refresh(); // Force permission refresh on open
      return;
    }
    const newState = !isDepartmentOpen;
    setIsDepartmentOpen(newState);
    localStorage.setItem('sidebar-dept-open', JSON.stringify(newState));
    if (newState) refresh(); // Force permission refresh on open
  };

  const [departmentTitle, setDepartmentTitle] = useState(MODULE_CATEGORIES.department);
  const [isDepartmentOpen, setIsDepartmentOpen] = useState(false);

  useEffect(() => {
    if (profile?.sector?.name) {
      setDepartmentTitle(profile.sector.name);
    } else if (profile?.department) {
      setDepartmentTitle(profile.department);
    }
  }, [profile]);

  // Re-map items to ensure they have the right properties for the render function
  const prepareItem = (item: any) => ({
    ...item,
    // Ensure icon is a component
    icon: item.icon,
    label: item.title, // Map title to label
    badge: item.badge
  });

  // Filter unified items by category
  // Fallback: If unified service returns empty (e.g. error), we might see nothing. 
  // But service has hardcoded fallback.

  // IDs de itens que não devem aparecer no menu lateral
  const hiddenFromSidebar = ['politicas'];

  const unifiedCore = menuItems.filter(i => (!i.category || i.category === 'core') && i.showInMenu && !hiddenFromSidebar.includes(i.id) && hasPermission(i.id)).map(prepareItem);
  const unifiedHr = menuItems.filter(i => i.category === 'hr' && i.showInMenu && !hiddenFromSidebar.includes(i.id) && hasPermission(i.id)).map(prepareItem);
  const unifiedDept = menuItems.filter(i => i.category === 'department' && i.showInMenu && !hiddenFromSidebar.includes(i.id) && hasPermission(i.id)).map(prepareItem);
  const unifiedContent = menuItems.filter(i => i.category === 'content' && i.showInMenu && !hiddenFromSidebar.includes(i.id) && hasPermission(i.id)).map(prepareItem);

  const renderItem = (item: any) => {
    const isActive = pathname === item.href;
    const Icon = item.icon;

    const handleItemClick = () => {
      if (isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
      }
    };

    return (
      <Link
        key={item.id}
        href={item.href}
        onClick={handleItemClick}
        className={`relative flex items-center px-4 py-3.5 my-1 mx-2 rounded-xl ${layoutTransition('transition-all duration-200')} group
          ${isActive
            ? 'bg-[#0066FF] text-white shadow-md shadow-blue-500/30'
            : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
          }`}
        title={isCollapsed ? item.label : ''}
        // Apply animation styles if config exists
        style={item.animation_config ? {
          // Basic implementation of entrance animation would go here or in a wrapper
          // For now, let's just stick to standard rendering to ensure stability
        } : {}}
      >
        <Icon className={`w-5 h-5 flex-shrink-0 ${!isCollapsed && 'mr-3'} ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-600'}`} />

        {!isCollapsed && (
          <span className={`font-medium text-sm ${isActive ? 'text-white' : 'text-gray-500 group-hover:text-gray-700'}`}>
            {t(`modules.${item.id}`, item.label)}
          </span>
        )}

        {/* Badge for News */}
        {item.badge && !isCollapsed && (
          <span className="ml-auto bg-red-50 text-red-600 text-xs font-bold px-2.5 py-0.5 rounded-lg min-w-[20px] text-center ml-2">
            {item.badge}
          </span>
        )}
        {item.badge && isCollapsed && (
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
        )}
      </Link>
    );
  };

  return (
    <ProtectedRoute>
      <GlobalTimeTracker />
      <div className="h-dvh bg-gray-50 flex font-sans overflow-hidden">

        {/* Mobile Overlay */}
        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 md:hidden transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`bg-white fixed z-40 inset-y-0 left-0 border-r border-gray-100 flex flex-col transition-transform duration-300 w-64 ${isCollapsed ? 'md:w-20' : 'md:w-64'} ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
        >
          {/* Logo */}
          <div className={`h-20 shrink-0 flex items-center ${isCollapsed ? 'md:justify-center px-6 md:px-0' : 'px-6'} justify-between`}>
            {(!isCollapsed || isMobileMenuOpen) && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 flex items-center justify-center shrink-0">
                  <img
                    src={config?.sidebar_logo || config?.logo || '/images/logo.png'}
                    alt="Logo"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      if (target.src !== '/images/LC1_Azul.png') {
                        target.src = '/images/LC1_Azul.png';
                      }
                    }}
                  />
                </div>
                <span className="text-xl font-bold text-gray-800 tracking-tight">{config?.sidebarTitle || 'Portal'}</span>
              </div>
            )}

            {/* Collapse toggle (Desktop only) */}
            <button
              onClick={toggleSidebar}
              className={`hidden md:block p-1.5 rounded-lg transition-colors duration-200 text-[#0066FF] hover:bg-blue-50 ${isCollapsed ? '' : 'ml-auto'}`}
              title={isCollapsed ? t('layout.expand', 'Expandir') : t('layout.collapse', 'Recolher')}
            >
              <FiSidebar className="w-6 h-6" />
            </button>

            {/* Close Mobile Menu Button (44px tap target) */}
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              aria-label={t('gtMobileV2.closeMenu', 'Fechar menu') as string}
              className="md:hidden tap-target flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors ml-auto"
            >
              <FiBriefcase className="w-6 h-6 opacity-0" /> {/* Just for spacing if needed, but we can use real close icon or let overlay handle it */}
              <span className="material-symbols-outlined w-6 h-6 flex items-center justify-center">close</span>
            </button>
          </div>

          {/* Menu */}
          {/* min-h-0: sem ele o flex item não encolhe abaixo do conteúdo e o menu
              empurra o rodapé da sidebar para fora da viewport (logo cortado, sem scroll) */}
          <nav className="flex-1 min-h-0 py-4 overflow-y-auto px-2 space-y-1">
            {/* Core Items - Using Unified Data */}
            {unifiedCore.map(renderItem)}

            {/* Meu RH Dropdown */}
            {unifiedHr.length > 0 && (
              <div className="mx-2 my-1">
                <button
                  onClick={toggleMeuRH}
                  className={`w-full flex items-center px-4 py-3 rounded-xl transition-all duration-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50 ${isMeuRHOpen ? 'bg-gray-50' : ''}`}
                >
                  <FiCreditCard className={`w-5 h-5 flex-shrink-0 ${!isCollapsed && 'mr-3'}`} />
                  {!isCollapsed && (
                    <>
                      <span className="font-medium text-sm text-gray-500 flex-1 text-left">{t('categories.hr', MODULE_CATEGORIES.hr)}</span>
                      <FiChevronDown className={`w-4 h-4 ${layoutTransition('transition-transform')} ${isMeuRHOpen ? 'rotate-180' : ''}`} />
                    </>
                  )}
                </button>

                {/* Submenu */}
                <div className={`overflow-hidden ${layoutTransition('transition-all duration-300')} ${isMeuRHOpen && !isCollapsed ? 'max-h-[1200px] mt-1' : 'max-h-0'}`}>
                  {unifiedHr.map(renderItem)}
                </div>
              </div>
            )}

            {/* Department Menu */}
            {unifiedDept.length > 0 && (
              <div className="mx-2 my-1">
                <button
                  onClick={toggleDepartment}
                  className={`w-full flex items-center px-4 py-3 rounded-xl transition-all duration-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50 ${isDepartmentOpen ? 'bg-gray-50' : ''}`}
                >
                  <FiShoppingCart className={`w-5 h-5 flex-shrink-0 ${!isCollapsed && 'mr-3'}`} />
                  {!isCollapsed && (
                    <>
                      <span className="font-medium text-sm text-gray-500 flex-1 text-left truncate">
                        {departmentTitle === MODULE_CATEGORIES.department ? t('categories.department', MODULE_CATEGORIES.department) : departmentTitle}
                      </span>
                      <FiChevronDown className={`w-4 h-4 ${layoutTransition('transition-transform')} ${isDepartmentOpen ? 'rotate-180' : ''}`} />
                    </>
                  )}
                </button>

                {/* Submenu */}
                <div className={`overflow-hidden ${layoutTransition('transition-all duration-300')} ${isDepartmentOpen && !isCollapsed ? 'max-h-[1200px] mt-1' : 'max-h-0'}`}>
                  {unifiedDept.map(renderItem)}
                </div>
              </div>
            )}

            {/* Content Items */}
            {unifiedContent.map(renderItem)}

          </nav>



          {/* Credits */}
          {!isCollapsed && (
            <div className="p-6 mt-auto shrink-0">
              <div className="pt-4 border-t border-gray-100 text-[11px] text-gray-500 font-medium leading-relaxed">
                {t('layout.developedBy', 'Desenvolvido por')} <a href="https://github.com/Caiolinooo" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-600 transition-colors">Caio Correia</a>.
                <br />
                2026 © All rights reserved.
              </div>
            </div>
          )}
        </aside>

        {/* Main Content Wrapper */}
        {/* min-w-0: row flex items default to min-width:auto (min-content of descendants).
            Without it, wide grids (Man Schedule `w-max` table) inflate this wrapper beyond
            the viewport and the outer `overflow-hidden` clips them — no scrollport ever overflows. */}
        <div className={`flex-1 min-w-0 flex flex-col min-h-0 h-dvh ${layoutTransition('transition-all duration-300')} ${isCollapsed ? 'md:ml-20' : 'md:ml-64'}`}>

          {/* Top Header */}
          <header className="h-16 shrink-0 px-4 md:px-8 flex items-center justify-between md:justify-end bg-gray-50/90 backdrop-blur-md border-b border-gray-200/50 z-20 sticky top-0 transition-colors">
            {/* Mobile Menu Toggle (Left Side) */}
            <div className="md:hidden flex items-center gap-2 min-w-0">
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                aria-label={t('gtMobileV2.openMenu', 'Abrir menu') as string}
                className="p-2 bg-white border border-gray-100 rounded-lg shadow-sm text-gray-600 hover:bg-gray-50 transition-colors flex items-center justify-center h-11 w-11"
              >
                <FiMenu className="w-5 h-5" />
              </button>
              <GlobalSearch />
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center bg-white rounded-full shadow-sm border border-gray-100 px-2 py-1 gap-1">
              {/* Notification Button (44px no touch, 36px no desktop) */}
              <NotificationHUD
                userId={user?.id || ''}
                showBanner={true}
                className="w-11 h-11 md:w-9 md:h-9 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-50 hover:text-gray-700 relative transition-colors"
              />

              {/* Language Button */}
              <div className="w-11 h-11 md:w-9 md:h-9 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors">
                <LanguageSelector variant="dropdown" className="!p-0 !bg-transparent text-gray-500 hover:text-gray-700" />
              </div>

              <div className="w-px h-5 bg-gray-200 mx-1"></div>

              {/* Profile Dropdown */}
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button className="w-11 h-11 md:w-9 md:h-9 rounded-full overflow-hidden border border-gray-200 outline-none hover:ring-2 hover:ring-blue-100 transition-all focus:ring-2 focus:ring-blue-100 flex-shrink-0 relative">
                    <div className="w-full h-full rounded-full overflow-hidden relative">
                      <UserAvatar user={user} profile={profile} className="w-full h-full" />
                    </div>
                  </button>
                </DropdownMenu.Trigger>

                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    className="z-50 min-w-[240px] bg-white rounded-xl shadow-xl border border-gray-100 p-2 animate-in fade-in zoom-in-95 duration-200 slide-in-from-top-2"
                    sideOffset={8}
                    align="end"
                  >
                    <div className="px-3 py-3 border-b border-gray-50 mb-1">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full overflow-hidden border border-gray-200 shrink-0 relative">
                          <UserAvatar user={user} profile={profile} className="w-full h-full" />
                        </div>
                        <div className="flex flex-col overflow-hidden">
                          <span className="text-sm font-semibold text-gray-800 truncate">
                            {profile?.first_name ? `${profile.first_name} ${profile.last_name || ''}` : (user?.email?.split('@')[0] || t('dashboard.usuario', 'User'))}
                          </span>
                          <span className="text-xs text-gray-500 truncate">{user?.email}</span>
                        </div>
                      </div>
                    </div>

                    {isAdmin && (
                      <>
                        <Link href="/admin" className="flex items-center gap-2 px-3 py-2.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg cursor-pointer outline-none transition-colors">
                          <FiShield className="w-4 h-4" />
                          <span>{t('layout.adminPanel', 'Painel Admin')}</span>
                        </Link>
                        <DropdownMenu.Item
                          onClick={() => setIsMenuCustomizerOpen(true)}
                          className="flex items-center gap-2 px-3 py-2.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg cursor-pointer outline-none transition-colors"
                        >
                          <FiEdit3 className="w-4 h-4" />
                          <span>{t('layout.editMenu', 'Editar Menu')}</span>
                        </DropdownMenu.Item>
                      </>
                    )}

                    <Link href="/profile" className="flex items-center gap-2 px-3 py-2.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg cursor-pointer outline-none transition-colors">
                      <FiUser className="w-4 h-4" />
                      <span>{t('layout.myProfile', 'Meu Perfil')}</span>
                    </Link>

                    <DropdownMenu.Item
                      className="flex items-center gap-2 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-lg cursor-pointer outline-none transition-colors mt-1"
                      onClick={logout}
                    >
                      <FiLogOut className="w-4 h-4" />
                      <span>Logout</span>
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </div>
          </header>

          <main className="flex-1 min-h-0 min-w-0 flex flex-col overflow-y-auto px-3 py-3 sm:px-4 sm:py-4 md:px-8 md:py-6 touch-scroll">
            {children}
          </main>
        </div>

      </div>
      {/* Widget flutuante é fixo z-50 — acima da gaveta (z-40). Escondido enquanto
          a gaveta mobile está aberta para não cobrir o menu/overlay. */}
      {!isMobileMenuOpen && <HelpWidget />}

      {/* Menu Customizer Drawer */}
      <MenuCustomizer
        isOpen={isMenuCustomizerOpen}
        onClose={() => setIsMenuCustomizerOpen(false)}
      />
    </ProtectedRoute>
  );
}
