'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
    FiLogOut, FiLoader, FiUser
} from 'react-icons/fi';
import Footer from '@/components/Footer';
import { usePathname, useRouter } from 'next/navigation';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { useSiteConfig } from '@/contexts/SiteConfigContext';
import LanguageSelector from '@/components/LanguageSelector';
import PerformanceMonitor from '@/components/Performance/PerformanceMonitor';
import { getTranslatedMenu } from '@/data/menu';
import { startMeasure, endMeasure, logPerformance } from '@/lib/performance';
import { PasswordRequiredGuard } from '@/components/Auth/PasswordRequiredGuard';

// Os itens do menu agora são importados de src/data/menu.ts

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, isLoading, isAdmin, logout } = useSupabaseAuth();
  const { t } = useI18n();
  const { config } = useSiteConfig();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Obter os itens do menu traduzidos
  const translatedMenu = getTranslatedMenu(t);

  // Medir o tempo de renderização do layout
  useEffect(() => {
    startMeasure('mainLayout-render');
    return () => {
      const duration = endMeasure('mainLayout-render');
      logPerformance('MainLayout rendered', duration);
    };
  }, []);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-abz-background">
        <FiLoader className="animate-spin h-12 w-12 text-abz-blue" />
      </div>
    );
  }

  // Alternar menu mobile
  // const toggleMobileMenu = () => {
  //   setIsMobileMenuOpen(!isMobileMenuOpen);
  // };

  return (
    <PasswordRequiredGuard>
      <div className="min-h-screen flex bg-abz-background">
        {/* Sidebar Fixa (Desktop) */}
        <aside className="w-64 bg-white shadow-md hidden md:flex flex-col flex-shrink-0">
          {/* Logo no Sidebar */}
          <div className="flex items-center justify-center h-16 border-b">
              <Link href="/dashboard">
              <img
                  src={config.logo}
                  alt={config.companyName + " Logo"}
                  className="h-10 w-auto"
              />
              </Link>
          </div>

        {/* Menu do Sidebar */}
        <nav className="flex-grow overflow-y-auto py-4 space-y-1">
          {translatedMenu
            .filter(item => {
              // Verificar se o item está habilitado
              if (!item.enabled) return false;

              // Se o item tem forceShow, sempre mostrar
              if (item.forceShow) return true;

              // Verificar permissões de administrador
              if (item.adminOnly && !isAdmin) return false;

              // Verificar permissões de gerente
              if (item.managerOnly && !(isAdmin || user?.role === 'MANAGER')) return false;

              return true;
            })
            .sort((a, b) => a.order - b.order)
            .map((item) => {
              const isActive = pathname === item.href;
              const IconComponent = item.icon;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  target={item.external ? '_blank' : '_self'}
                  rel={item.external ? 'noopener noreferrer' : ''}
                  className={`flex items-center px-4 py-2.5 mx-2 rounded-md text-sm font-medium transition-colors duration-150 ${
                    isActive
                      ? 'bg-abz-blue text-white shadow-sm'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-abz-blue-dark'
                  }`}
                >
                  <IconComponent className={`mr-3 h-5 w-5 ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-500'}`} />
                  {item.title}
                </Link>
              );
            })}
        </nav>

        {/* Seletor de idioma, Perfil e Botão de Logout no Sidebar */}
        <div className="p-4 border-t space-y-3">
            <div className="flex items-center justify-center">
                <LanguageSelector variant="inline" />
            </div>
            <Link
                href="/profile"
                className="w-full px-4 py-2 rounded-md text-sm font-medium text-abz-blue bg-gray-100 hover:bg-gray-200 hover:text-abz-blue-dark flex items-center justify-center"
            >
                <FiUser className="mr-2" />
                {t('common.profile', 'Meu Perfil')}
            </Link>
            <button
                onClick={handleLogout}
                className="w-full px-4 py-2 rounded-md text-sm font-medium text-red-700 bg-red-100 hover:bg-red-200 hover:text-red-800 flex items-center justify-center"
            >
                <FiLogOut className="mr-2" />
                {t('common.logout')}
            </button>
        </div>
      </aside>

      {/* Conteúdo Principal e Header Mobile */}
      <div className="flex-1 flex flex-col">
        {/* Header Mobile (com logo e botão de menu) */}
        {/* Você pode optar por manter um header simples ou removê-lo se o sidebar mobile for suficiente */}
        <header className="md:hidden bg-white shadow-md sticky top-0 z-10">
             <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16">
                    {/* Logo */}
                    <div className="flex-shrink-0 flex items-center">
                    <Link href="/dashboard">
                        <img
                        src={config.logo}
                        alt={config.companyName + " Logo"}
                        className="h-10 w-auto"
                        />
                    </Link>
                    </div>
                    {/* TODO: Adicionar botão para abrir/fechar um *sidebar mobile* se necessário */}
                     <div className="flex items-center">
                         {/* Placeholder para botão de menu mobile se for diferente de um sidebar fixo */}
                         <LanguageSelector variant="dropdown" className="mr-2" />
                         <Link
                            href="/profile"
                            className="ml-2 px-3 py-1.5 rounded-md text-sm font-medium text-abz-blue bg-gray-100 hover:bg-gray-200"
                         >
                            <FiUser />
                         </Link>
                         <button
                            onClick={handleLogout}
                            className="ml-2 px-3 py-1.5 rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700"
                        >
                            {t('common.logout')}
                        </button>
                     </div>
                </div>
            </div>
        </header>

        {/* Conteúdo Principal */}
        <main className="flex-grow p-4 sm:p-6 lg:p-8 overflow-y-auto">
             {/* Removido max-w-7xl e mx-auto para permitir que o conteúdo use a largura total */}
            {children}
        </main>

        {/* Footer */}
        <Footer />

        {/* Performance Monitor (only visible in development) */}
        <PerformanceMonitor />
      </div>
    </div>
    </PasswordRequiredGuard>
  );
}
