'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FiGrid, FiList, FiClock, FiAward, FiSettings } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';

export default function ESocialNavigation() {
  const pathname = usePathname() || '';
  const { t } = useI18n();

  const navItems = [
    {
      id: 'dashboard',
      href: '/department/e-social',
      label: t('eSocial.tabs.dashboard', 'Painel Geral'),
      icon: FiGrid,
      exact: true,
    },
    {
      id: 'eventos',
      href: '/department/e-social/eventos',
      label: t('eSocial.tabs.eventos', 'Eventos & Envios'),
      icon: FiList,
    },
    {
      id: 'revisao',
      href: '/department/e-social/revisao',
      label: t('eSocial.tabs.revisao', 'Fila de Revisão'),
      icon: FiClock,
    },
    {
      id: 'certificados',
      href: '/department/e-social/certificados',
      label: t('eSocial.tabs.certificados', 'Certificados Digitais'),
      icon: FiAward,
    },
    {
      id: 'configuracoes',
      href: '/department/e-social/configuracoes',
      label: t('eSocial.tabs.configuracoes', 'Configurações'),
      icon: FiSettings,
    },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-1 mb-4 sm:mb-6 flex overflow-x-auto no-scrollbar gap-1 min-w-0">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = item.exact 
          ? pathname === item.href 
          : pathname.startsWith(item.href) && pathname !== '/department/e-social';

        return (
          <Link
            key={item.id}
            href={item.href}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 whitespace-nowrap shrink-0 ${
              isActive
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/10'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Icon size={16} className={isActive ? 'text-white' : 'text-slate-400'} />
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
