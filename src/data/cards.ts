/**
 * Definição dos cards do dashboard
 * Estes dados podem ser editados pelo painel de administração
 */

import {
  FiBookOpen,
  FiClipboard,
  FiFileText,
  FiBriefcase,
  FiCalendar,
  FiRss,
  FiDollarSign,
  FiClock,
  FiUser,
  FiUsers,
  FiBarChart2,
  FiActivity,
  FiPlay,
  FiTrendingUp,
  FiPieChart,
  FiTarget,
  FiDownload,
  FiSmartphone,
  FiDatabase,
  FiBarChart,
  FiGitBranch,
  FiMessageSquare
} from 'react-icons/fi';
import { IconType } from 'react-icons';

// Mapa de nomes de ícones para componentes de ícones
export const iconMap: { [key: string]: IconType } = {
  FiBookOpen,
  FiClipboard,
  FiFileText,
  FiBriefcase,
  FiCalendar,
  FiRss,
  FiDollarSign,
  FiClock,
  FiUser,
  FiUsers,
  FiBarChart2,
  FiActivity,
  FiPlay,
  FiTrendingUp,
  FiPieChart,
  FiTarget,
  FiDownload,
  FiSmartphone,
  FiDatabase,
  FiBarChart,
  FiGitBranch,
  FiMessageSquare,
  // Adicione outros ícones do react-icons/fi aqui se necessário
  // Exemplo: FiAlertCircle: FiAlertCircle,
};

export interface DashboardCard {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: IconType; // Componente do ícone
  iconName: string; // Nome do ícone como string
  color: string;
  hoverColor: string;
  external: boolean;
  enabled: boolean;
  order: number;
  // Permissões de acesso
  adminOnly?: boolean;
  managerOnly?: boolean;
  allowedRoles?: string[];
  allowedUserIds?: string[];
  // Optional module key to drive fine-grained permission via hasAccess(moduleKey)
  moduleKey?: string;
}

// Função para obter cards hardcoded (usada como fallback na API)
export function getHardcodedCards(): DashboardCard[] {
  // Retorna cards com títulos em português (fallback)
  return [
    {
      id: 'manual',
      title: 'Manual do Colaborador',
      description: 'Acesse o manual completo do colaborador',
      href: '/manual',
      icon: FiBookOpen,
      iconName: 'FiBookOpen',
      color: 'bg-abz-blue',
      hoverColor: 'hover:bg-abz-blue-dark',
      external: false,
      enabled: true,
      order: 1,
      adminOnly: false,
      managerOnly: false,
    },
    {
      id: 'avaliacao',
      title: 'Avaliação de Desempenho',
      description: 'Visualize suas avaliações de desempenho',
      href: '/avaliacao',
      icon: FiBarChart2,
      iconName: 'FiBarChart2',
      color: 'bg-abz-blue',
      hoverColor: 'hover:bg-abz-blue-dark',
      external: false,
      enabled: true,
      order: 2,
      adminOnly: false,
      managerOnly: false,
      moduleKey: 'avaliacao',
    },
    {
      id: 'folhaPagamento',
      title: 'Folha de Pagamento',
      description: 'Gerencie a folha de pagamento dos colaboradores',
      href: '/folha-pagamento',
      icon: FiActivity,
      iconName: 'FiActivity',
      color: 'bg-green-500',
      hoverColor: 'hover:bg-green-600',
      external: false,
      enabled: true,
      order: 3,
      adminOnly: false,
      managerOnly: true,
      moduleKey: 'folha_pagamento',
    },
    {
      id: 'academy',
      title: 'ABZ Academy',
      description: 'Centro de treinamento e desenvolvimento profissional',
      href: '/academy',
      icon: FiPlay,
      iconName: 'FiPlay',
      color: 'bg-blue-600',
      hoverColor: 'hover:bg-blue-700',
      external: false,
      enabled: true,
      order: 4,
      adminOnly: false,
      managerOnly: false,
      moduleKey: 'academy',
    },
    {
      id: 'social',
      title: 'ABZ Social',
      description: 'Rede social interna da empresa',
      href: '/social',
      icon: FiUsers,
      iconName: 'FiUsers',
      color: 'bg-purple-600',
      hoverColor: 'hover:bg-purple-700',
      external: false,
      enabled: false, // disabled per request: keep ABZ News only
      order: 5,
      adminOnly: false,
      managerOnly: false,
      moduleKey: 'social',
    },
    // Adicionar outros cards aqui conforme necessário
  ];
}

// Função para obter os cards do dashboard com traduções
export function getTranslatedCards(t: (key: string) => string): DashboardCard[] {
  return [
    {
      id: 'manual',
      title: t('cards.manualColaborador'),
      description: t('cards.manualColaboradorDesc'),
      href: '/manual',
      icon: FiBookOpen,
      iconName: 'FiBookOpen',
      color: 'bg-abz-blue',
      hoverColor: 'hover:bg-abz-blue-dark',
      external: false,
      enabled: true,
      order: 1
    },
    {
      id: 'procedimentos-logistica',
      title: t('cards.procedimentosLogistica'),
      description: t('cards.procedimentosLogisticaDesc'),
      href: '/procedimentos-logistica',
      icon: FiClipboard,
      iconName: 'FiClipboard',
      color: 'bg-abz-green',
      hoverColor: 'hover:bg-abz-green-dark',
      external: false,
      enabled: true,
      order: 2
    },
    {
      id: 'politicas',
      title: t('cards.politicas'),
      description: t('cards.politicasDesc'),
      href: '/politicas',
      icon: FiFileText,
      iconName: 'FiFileText',
      color: 'bg-abz-purple',
      hoverColor: 'hover:bg-abz-purple-dark',
      external: false,
      enabled: true,
      order: 3
    },
    {
      id: 'procedimentos',
      title: t('cards.procedimentosGerais'),
      description: t('cards.procedimentosGeraisDesc'),
      href: '/procedimentos',
      icon: FiBriefcase,
      iconName: 'FiBriefcase',
      color: 'bg-abz-cyan',
      hoverColor: 'hover:bg-abz-cyan-dark',
      external: false,
      enabled: true,
      order: 4
    },
    {
      id: 'calendario',
      title: t('cards.calendario'),
      description: t('cards.calendarioDesc'),
      href: '/calendario',
      icon: FiCalendar,
      iconName: 'FiCalendar',
      color: 'bg-abz-red',
      hoverColor: 'hover:bg-abz-red-dark',
      external: false,
      enabled: true,
      order: 5
    },
    {
      id: 'noticias',
      title: t('cards.noticias'),
      description: t('cards.noticiasDesc'),
      href: '/noticias',
      icon: FiRss,
      iconName: 'FiRss',
      color: 'bg-abz-pink',
      hoverColor: 'hover:bg-abz-pink-dark',
      external: false,
      enabled: true,
      order: 6
    },
    {
      id: 'reembolso',
      title: t('cards.reembolso'),
      description: t('cards.reembolsoDesc'),
      href: '/reembolso',
      icon: FiDollarSign,
      iconName: 'FiDollarSign',
      color: 'bg-abz-yellow',
      hoverColor: 'hover:bg-abz-yellow-dark',
      external: false,
      enabled: true,
      order: 7
    },
    {
      id: 'contracheque',
      title: t('cards.contracheque'),
      description: t('cards.contrachequeDesc'),
      href: '/contracheque',
      icon: FiDollarSign,
      iconName: 'FiDollarSign',
      color: 'bg-abz-orange',
      hoverColor: 'hover:bg-abz-orange-dark',
      external: false,
      enabled: true,
      order: 8
    },
    {
      id: 'ponto',
      title: t('cards.ponto'),
      description: t('cards.pontoDesc'),
      href: '/ponto',
      icon: FiClock,
      iconName: 'FiClock',
      color: 'bg-abz-teal',
      hoverColor: 'hover:bg-abz-teal-dark',
      external: false,
      enabled: true,
      order: 9
    },
    {
      id: 'avaliacao',
      title: t('avaliacao.title'),
      description: t('avaliacao.description'),
      href: '/avaliacao',
      icon: FiBarChart2,
      iconName: 'FiBarChart2',
      color: 'bg-abz-blue',
      hoverColor: 'hover:bg-abz-blue-dark',
      external: false,
      enabled: true,
      order: 10,
      moduleKey: 'avaliacao' // Permite acesso baseado em permissões do módulo
    },
    {
      id: 'folha-pagamento',
      title: t('cards.folhaPagamento'),
      description: t('cards.folhaPagamentoDesc'),
      href: '/folha-pagamento',
      icon: FiActivity,
      iconName: 'FiActivity',
      color: 'bg-abz-blue',
      hoverColor: 'hover:bg-abz-blue-dark',
      external: false,
      enabled: true,
      order: 11,
      managerOnly: true,
      moduleKey: 'folha_pagamento'
    },
    {
      id: 'academy',
      title: 'ABZ Academy',
      description: 'Centro de treinamento e desenvolvimento profissional',
      href: '/academy',
      icon: FiPlay,
      iconName: 'FiPlay',
      color: 'bg-blue-600',
      hoverColor: 'hover:bg-blue-700',
      external: false,
      enabled: true,
      order: 12,
      adminOnly: false,
      managerOnly: false,
      moduleKey: 'academy'
    },
    {
      id: 'social',
      title: 'ABZ Social',
      description: 'Rede social interna da empresa',
      href: '/social',
      icon: FiUsers,
      iconName: 'FiUsers',
      color: 'bg-purple-600',
      hoverColor: 'hover:bg-purple-700',
      external: false,
      enabled: false, // disabled per request: keep ABZ News only
      order: 13,
      adminOnly: false,
      managerOnly: false,
      moduleKey: 'social'
    },
    {
      id: 'avaliacoes-avancadas',
      title: 'Avaliações Avançadas',
      description: 'Métricas, análises e relatórios detalhados de performance',
      href: '/avaliacoes-avancadas',
      icon: FiTrendingUp,
      iconName: 'FiTrendingUp',
      color: 'bg-blue-600',
      hoverColor: 'hover:bg-blue-700',
      external: false,
      enabled: true,
      order: 8,
      adminOnly: false,
      managerOnly: true,
      moduleKey: 'avaliacoes_avancadas'
    },
    {
      id: 'relatorios-pdf',
      title: 'Relatórios PDF',
      description: 'Gere relatórios personalizados com gráficos e visualizações',
      href: '/relatorios-pdf',
      icon: FiDownload,
      iconName: 'FiDownload',
      color: 'bg-purple-600',
      hoverColor: 'hover:bg-purple-700',
      external: false,
      enabled: true,
      order: 9,
      adminOnly: false,
      managerOnly: true,
      moduleKey: 'relatorios_pdf'
    },
    {
      id: 'api-mobile',
      title: 'API Mobile',
      description: 'Gerenciamento e monitoramento da API para aplicativos móveis',
      href: '/api-mobile',
      icon: FiSmartphone,
      iconName: 'FiSmartphone',
      color: 'bg-indigo-600',
      hoverColor: 'hover:bg-indigo-700',
      external: false,
      enabled: true,
      order: 10,
      adminOnly: true,
      moduleKey: 'api_mobile'
    },
    {
      id: 'integracao-erp',
      title: 'Integração ERP',
      description: 'Conectores e sincronização com sistemas ERP externos',
      href: '/integracao-erp',
      icon: FiDatabase,
      iconName: 'FiDatabase',
      color: 'bg-purple-600',
      hoverColor: 'hover:bg-purple-700',
      external: false,
      enabled: true,
      order: 11,
      adminOnly: true,
      moduleKey: 'integracao_erp'
    },
    {
      id: 'dashboard-bi',
      title: 'Dashboard de BI',
      description: 'Analytics avançados e visualizações interativas de dados',
      href: '/dashboard-bi',
      icon: FiBarChart,
      iconName: 'FiBarChart',
      color: 'bg-emerald-600',
      hoverColor: 'hover:bg-emerald-700',
      external: false,
      enabled: true,
      order: 12,
      adminOnly: false,
      moduleKey: 'dashboard_bi'
    },
    {
      id: 'workflows',
      title: 'Workflows Automatizados',
      description: 'Automatize processos empresariais com workflows inteligentes',
      href: '/workflows',
      icon: FiGitBranch,
      iconName: 'FiGitBranch',
      color: 'bg-indigo-600',
      hoverColor: 'hover:bg-indigo-700',
      external: false,
      enabled: true,
      order: 13,
      adminOnly: false,
      moduleKey: 'workflows'
    },
    {
      id: 'chat',
      title: 'Chat Interno',
      description: 'Comunicação em tempo real com canais e mensagens diretas',
      href: '/chat',
      icon: FiMessageSquare,
      iconName: 'FiMessageSquare',
      color: 'bg-green-600',
      hoverColor: 'hover:bg-green-700',
      external: false,
      enabled: true,
      order: 14,
      adminOnly: false,
      moduleKey: 'chat'
    },
    {
      id: 'admin',
      title: t('admin.title'),
      description: t('admin.dashboard'),
      href: '/admin',
      icon: FiUser,
      iconName: 'FiUser',
      color: 'bg-abz-indigo',
      hoverColor: 'hover:bg-abz-indigo-dark',
      external: false,
      enabled: true,
      order: 12,
      adminOnly: true
    }
  ];
}

// Lista de cards do dashboard (versão estática para compatibilidade)
const dashboardCards: DashboardCard[] = getTranslatedCards(key => key);

export default dashboardCards;
