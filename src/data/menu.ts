/**
 * Definição dos itens do menu lateral
 * Estes dados podem ser editados pelo painel de administração
 */

import {
  FiGrid,
  FiBookOpen,
  FiClipboard,
  FiFileText,
  FiBriefcase,
  FiCalendar,
  FiRss,
  FiDollarSign,
  FiClock,
  FiSettings,
  FiUsers,
  FiKey,
  FiBarChart2
} from 'react-icons/fi';
import { IconType } from 'react-icons';

export interface MenuItem {
  id: string;
  href: string;
  label: string;
  title?: string;
  icon: IconType;
  external: boolean;
  enabled: boolean;
  order: number;
  adminOnly: boolean;
  managerOnly?: boolean;
  forceShow?: boolean;
  // Optional module key to drive fine-grained permission via hasAccess(moduleKey)
  moduleKey?: string;
}

// Função para obter os itens do menu com traduções
export function getTranslatedMenu(t: (key: string, defaultValue?: string) => string) {
  return [
    {
      id: 'dashboard',
      title: t('menu.dashboard'),
      href: '/dashboard',
      icon: FiGrid,
      external: false,
      enabled: true,
      order: 1,
      adminOnly: false
    },
    {
      id: 'manual',
      title: t('menu.manualLogistico'),
      href: '/manual',
      icon: FiBookOpen,
      external: false,
      enabled: true,
      order: 2,
      adminOnly: false
    },
    {
      id: 'procedimentos-logistica',
      title: t('menu.procedimentoLogistica'),
      href: '/procedimentos-logistica',
      icon: FiClipboard,
      external: false,
      enabled: true,
      order: 3,
      adminOnly: false
    },
    {
      id: 'politicas',
      title: t('menu.politicas'),
      href: '/politicas',
      icon: FiFileText,
      external: false,
      enabled: true,
      order: 4,
      adminOnly: false
    },
    {
      id: 'procedimentos',
      title: t('menu.procedimentosGerais'),
      href: '/procedimentos',
      icon: FiBriefcase,
      external: false,
      enabled: true,
      order: 5,
      adminOnly: false
    },
    {
      id: 'calendario',
      title: t('menu.calendario'),
      href: '/calendario',
      icon: FiCalendar,
      external: false,
      enabled: true,
      order: 6,
      adminOnly: false
    },
    {
      id: 'noticias',
      title: t('menu.abzNews'),
      href: '/noticias',
      icon: FiRss,
      external: false,
      enabled: true,
      order: 7,
      adminOnly: false
    },
    {
      id: 'reembolso',
      title: t('menu.reembolso'),
      href: '/reembolso',
      icon: FiDollarSign,
      external: false,
      enabled: true,
      order: 8,
      adminOnly: false
    },
    {
      id: 'contracheque',
      title: t('menu.contracheque'),
      href: '/contracheque',
      icon: FiDollarSign,
      external: false,
      enabled: true,
      order: 9,
      adminOnly: false
    },
    {
      id: 'ponto',
      title: t('menu.ponto'),
      href: '/ponto',
      icon: FiClock,
      external: false,
      enabled: true,
      order: 10,
      adminOnly: false
    },
    {
      id: 'folha-pagamento',
      title: t('menu.folhaPagamento'),
      href: '/folha-pagamento',
      icon: FiDollarSign,
      external: false,
      enabled: true,
      order: 11,
      adminOnly: false,
      moduleKey: 'folha_pagamento'
    },
    {
      id: 'avaliacao',
      title: t('menu.avaliacao') || 'Avaliação',
      href: '/avaliacao',
      icon: FiBarChart2,
      external: false,
      enabled: true,
      order: 12,
      adminOnly: false,
      managerOnly: false, // Permitir acesso para todos os usuários
      moduleKey: 'avaliacao', // Usar verificação de módulo
      forceShow: false
    },
    {
      id: 'admin',
      title: t('menu.administracao') || 'Administração',
      href: '/admin',
      icon: FiSettings,
      external: false,
      enabled: true,
      order: 13,
      adminOnly: true
    },
    // Removido o item 'usuarios-autorizados' do menu principal
    // Esse item agora só aparece no menu de administração
  ] as MenuItem[];
}

// Lista de itens do menu (versão estática para compatibilidade)
const menuItems: MenuItem[] = [
  {
    id: 'dashboard',
    href: '/dashboard',
    label: 'Dashboard',
    icon: FiGrid,
    external: false,
    enabled: true,
    order: 1,
    adminOnly: false
  },
  {
    id: 'manual',
    href: '/manual',
    label: 'Manual Logístico',
    icon: FiBookOpen,
    external: false,
    enabled: true,
    order: 2,
    adminOnly: false
  },
  {
    id: 'procedimentos-logistica',
    href: '/procedimentos-logistica',
    label: 'Procedimento Logística',
    icon: FiClipboard,
    external: false,
    enabled: true,
    order: 3,
    adminOnly: false
  },
  {
    id: 'politicas',
    href: '/politicas',
    label: 'Políticas',
    icon: FiFileText,
    external: false,
    enabled: true,
    order: 4,
    adminOnly: false
  },
  {
    id: 'procedimentos',
    href: '/procedimentos',
    label: 'Procedimentos Gerais',
    icon: FiBriefcase,
    external: false,
    enabled: true,
    order: 5,
    adminOnly: false
  },
  {
    id: 'calendario',
    href: '/calendario',
    label: 'Calendário',
    icon: FiCalendar,
    external: false,
    enabled: true,
    order: 6,
    adminOnly: false
  },
  {
    id: 'noticias',
    href: '/noticias',
    label: 'ABZ News',
    icon: FiRss,
    external: false,
    enabled: true,
    order: 7,
    adminOnly: false
  },
  {
    id: 'reembolso',
    href: '/reembolso',
    label: 'Reembolso',
    icon: FiDollarSign,
    external: false,
    enabled: true,
    order: 8,
    adminOnly: false
  },
  {
    id: 'contracheque',
    href: '/contracheque',
    label: 'Contracheque',
    icon: FiDollarSign,
    external: false,
    enabled: true,
    order: 9,
    adminOnly: false
  },
  {
    id: 'ponto',
    href: '/ponto',
    label: 'Ponto',
    icon: FiClock,
    external: false,
    enabled: true,
    order: 10,
    adminOnly: false
  },
  {
    id: 'folha-pagamento',
    href: '/folha-pagamento',
    label: 'Folha de Pagamento',
    icon: FiDollarSign,
    external: false,
    enabled: true,
    order: 11,
    adminOnly: false,
    moduleKey: 'folha_pagamento'
  },
  {
    id: 'avaliacao',
    href: '/avaliacao',
    label: 'Avaliação',
    icon: FiBarChart2,
    external: false,
    enabled: true,
    order: 12,
    adminOnly: false,
    managerOnly: true, // Restringir acesso apenas para gerentes e administradores
    forceShow: false // Não forçar exibição do item de menu
  },
  {
    id: 'admin',
    href: '/admin',
    label: 'Administração',
    icon: FiSettings,
    external: false,
    enabled: true,
    order: 13,
    adminOnly: true
  },
  // Removido o item 'authorized-users' do menu principal
  // Esse item agora só aparece no menu de administração
];

export default menuItems;
