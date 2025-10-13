/**
 * Script para sincronizar cards hardcoded com o Supabase
 * Execute com: npx tsx scripts/sync-cards-to-supabase.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Carregar variáveis de ambiente do .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente do Supabase não encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Todos os cards hardcoded com traduções
const cardsToSync = [
  {
    id: 'manual',
    title: 'Manual do Colaborador',
    titleEn: 'Employee Manual',
    description: 'Acesse o manual completo do colaborador',
    descriptionEn: 'Access the complete employee manual',
    href: '/manual',
    icon: 'book',
    iconName: 'FiBookOpen',
    color: 'bg-abz-blue',
    hoverColor: 'hover:bg-abz-blue-dark',
    external: false,
    enabled: false,
    order: 1,
    adminOnly: false,
    managerOnly: false,
  },
  {
    id: 'procedimentos-logistica',
    title: 'Procedimentos de Logística',
    titleEn: 'Logistics Procedures',
    description: 'Consulte os procedimentos padrões da área',
    descriptionEn: 'Check the standard procedures for the area',
    href: '/procedimentos-logistica',
    icon: 'description',
    iconName: 'FiClipboard',
    color: 'bg-abz-green',
    hoverColor: 'hover:bg-abz-green-dark',
    external: false,
    enabled: true,
    order: 2,
    adminOnly: false,
    managerOnly: false,
  },
  {
    id: 'politicas',
    title: 'Políticas',
    titleEn: 'Policies',
    description: 'Consulte as políticas da empresa',
    descriptionEn: 'Check company policies',
    href: '/politicas',
    icon: 'policy',
    iconName: 'FiFileText',
    color: 'bg-abz-purple',
    hoverColor: 'hover:bg-abz-purple-dark',
    external: false,
    enabled: true,
    order: 3,
    adminOnly: false,
    managerOnly: false,
  },
  {
    id: 'procedimentos',
    title: 'Procedimentos Gerais',
    titleEn: 'General Procedures',
    description: 'Consulte os procedimentos gerais da empresa',
    descriptionEn: 'Check the company general procedures',
    href: '/procedimentos',
    icon: 'description',
    iconName: 'FiBriefcase',
    color: 'bg-abz-cyan',
    hoverColor: 'hover:bg-abz-cyan-dark',
    external: false,
    enabled: true,
    order: 4,
    adminOnly: false,
    managerOnly: false,
  },
  {
    id: 'calendario',
    title: 'Calendário',
    titleEn: 'Calendar',
    description: 'Visualize eventos e datas importantes',
    descriptionEn: 'View important events and dates',
    href: '/calendario',
    icon: 'calendar_today',
    iconName: 'FiCalendar',
    color: 'bg-abz-red',
    hoverColor: 'hover:bg-abz-red-dark',
    external: false,
    enabled: true,
    order: 5,
    adminOnly: false,
    managerOnly: false,
  },
  {
    id: 'noticias',
    title: 'Notícias',
    titleEn: 'News',
    description: 'Fique por dentro das novidades da empresa',
    descriptionEn: 'Stay up to date with company news',
    href: '/noticias',
    icon: 'newspaper',
    iconName: 'FiRss',
    color: 'bg-abz-pink',
    hoverColor: 'hover:bg-abz-pink-dark',
    external: false,
    enabled: true,
    order: 6,
    adminOnly: false,
    managerOnly: false,
  },
  {
    id: 'reembolso',
    title: 'Reembolso',
    titleEn: 'Reimbursement',
    description: 'Solicite reembolso de despesas',
    descriptionEn: 'Request expense reimbursement',
    href: '/reembolso',
    icon: 'receipt',
    iconName: 'FiDollarSign',
    color: 'bg-abz-yellow',
    hoverColor: 'hover:bg-abz-yellow-dark',
    external: false,
    enabled: true,
    order: 7,
    adminOnly: false,
    managerOnly: false,
  },
  {
    id: 'contracheque',
    title: 'Contracheque',
    titleEn: 'Payslip',
    description: 'Acesse seus contracheques',
    descriptionEn: 'Access your payslips',
    href: '/contracheque',
    icon: 'payments',
    iconName: 'FiDollarSign',
    color: 'bg-abz-orange',
    hoverColor: 'hover:bg-abz-orange-dark',
    external: false,
    enabled: true,
    order: 8,
    adminOnly: false,
    managerOnly: false,
  },
  {
    id: 'ponto',
    title: 'Ponto',
    titleEn: 'Time Clock',
    description: 'Registre seu ponto e consulte seu histórico',
    descriptionEn: 'Register your time clock and check your history',
    href: '/ponto',
    icon: 'schedule',
    iconName: 'FiClock',
    color: 'bg-abz-teal',
    hoverColor: 'hover:bg-abz-teal-dark',
    external: false,
    enabled: true,
    order: 9,
    adminOnly: false,
    managerOnly: false,
  },
  {
    id: 'avaliacao',
    title: 'Avaliação de Desempenho',
    titleEn: 'Performance Evaluation',
    description: 'Gerencie avaliações de desempenho dos colaboradores',
    descriptionEn: 'Manage employee performance evaluations',
    href: '/avaliacao',
    icon: 'assessment',
    iconName: 'FiBarChart2',
    color: 'bg-abz-blue',
    hoverColor: 'hover:bg-abz-blue-dark',
    external: false,
    enabled: true,
    order: 10,
    adminOnly: false,
    managerOnly: false,
    moduleKey: 'avaliacao',
  },
  {
    id: 'folha-pagamento',
    title: 'Folha de Pagamento',
    titleEn: 'Payroll',
    description: 'Gestão completa de folha de pagamento e cálculos trabalhistas',
    descriptionEn: 'Complete payroll management and labor calculations',
    href: '/folha-pagamento',
    icon: 'payments',
    iconName: 'FiActivity',
    color: 'bg-abz-blue',
    hoverColor: 'hover:bg-abz-blue-dark',
    external: false,
    enabled: true,
    order: 11,
    adminOnly: false,
    managerOnly: true,
    moduleKey: 'folha_pagamento',
  },
  {
    id: 'academy',
    title: 'ABZ Academy',
    titleEn: 'ABZ Academy',
    description: 'Centro de treinamento e desenvolvimento profissional',
    descriptionEn: 'Training and professional development center',
    href: '/academy',
    icon: 'play_circle',
    iconName: 'FiPlay',
    color: 'bg-blue-600',
    hoverColor: 'hover:bg-blue-700',
    external: false,
    enabled: true,
    order: 12,
    adminOnly: false,
    managerOnly: false,
    moduleKey: 'academy',
  },
  {
    id: 'avaliacoes-avancadas',
    title: 'Avaliações Avançadas',
    titleEn: 'Advanced Evaluations',
    description: 'Métricas, análises e relatórios detalhados de performance',
    descriptionEn: 'Metrics, analysis and detailed performance reports',
    href: '/avaliacoes-avancadas',
    icon: 'trending_up',
    iconName: 'FiTrendingUp',
    color: 'bg-blue-600',
    hoverColor: 'hover:bg-blue-700',
    external: false,
    enabled: true,
    order: 13,
    adminOnly: false,
    managerOnly: true,
    moduleKey: 'avaliacoes_avancadas',
  },
  {
    id: 'relatorios-pdf',
    title: 'Relatórios PDF',
    titleEn: 'PDF Reports',
    description: 'Gere relatórios personalizados com gráficos e visualizações',
    descriptionEn: 'Generate custom reports with charts and visualizations',
    href: '/relatorios-pdf',
    icon: 'download',
    iconName: 'FiDownload',
    color: 'bg-purple-600',
    hoverColor: 'hover:bg-purple-700',
    external: false,
    enabled: true,
    order: 14,
    adminOnly: false,
    managerOnly: true,
    moduleKey: 'relatorios_pdf',
  },
  {
    id: 'api-mobile',
    title: 'API Mobile',
    titleEn: 'Mobile API',
    description: 'Gerenciamento e monitoramento da API para aplicativos móveis',
    descriptionEn: 'Management and monitoring of API for mobile applications',
    href: '/api-mobile',
    icon: 'smartphone',
    iconName: 'FiSmartphone',
    color: 'bg-indigo-600',
    hoverColor: 'hover:bg-indigo-700',
    external: false,
    enabled: true,
    order: 15,
    adminOnly: true,
    managerOnly: false,
    moduleKey: 'api_mobile',
  },
  {
    id: 'integracao-erp',
    title: 'Integração ERP',
    titleEn: 'ERP Integration',
    description: 'Conectores e sincronização com sistemas ERP externos',
    descriptionEn: 'Connectors and synchronization with external ERP systems',
    href: '/integracao-erp',
    icon: 'storage',
    iconName: 'FiDatabase',
    color: 'bg-purple-600',
    hoverColor: 'hover:bg-purple-700',
    external: false,
    enabled: true,
    order: 16,
    adminOnly: true,
    managerOnly: false,
    moduleKey: 'integracao_erp',
  },
  {
    id: 'dashboard-bi',
    title: 'Dashboard de BI',
    titleEn: 'BI Dashboard',
    description: 'Analytics avançados e visualizações interativas de dados',
    descriptionEn: 'Advanced analytics and interactive data visualizations',
    href: '/dashboard-bi',
    icon: 'bar_chart',
    iconName: 'FiBarChart',
    color: 'bg-emerald-600',
    hoverColor: 'hover:bg-emerald-700',
    external: false,
    enabled: true,
    order: 17,
    adminOnly: false,
    managerOnly: false,
    moduleKey: 'dashboard_bi',
  },
  {
    id: 'workflows',
    title: 'Workflows Automatizados',
    titleEn: 'Automated Workflows',
    description: 'Automatize processos empresariais com workflows inteligentes',
    descriptionEn: 'Automate business processes with intelligent workflows',
    href: '/workflows',
    icon: 'layers',
    iconName: 'FiGitBranch',
    color: 'bg-indigo-600',
    hoverColor: 'hover:bg-indigo-700',
    external: false,
    enabled: true,
    order: 18,
    adminOnly: false,
    managerOnly: false,
    moduleKey: 'workflows',
  },
  {
    id: 'chat',
    title: 'Chat Interno',
    titleEn: 'Internal Chat',
    description: 'Comunicação em tempo real com canais e mensagens diretas',
    descriptionEn: 'Real-time communication with channels and direct messages',
    href: '/chat',
    icon: 'chat',
    iconName: 'FiMessageSquare',
    color: 'bg-green-600',
    hoverColor: 'hover:bg-green-700',
    external: false,
    enabled: true,
    order: 19,
    adminOnly: false,
    managerOnly: false,
    moduleKey: 'chat',
  },
];

async function syncCards() {
  console.log('🔄 Iniciando sincronização de cards...\n');

  const now = new Date().toISOString();

  for (const card of cardsToSync) {
    try {
      // Verificar se o card já existe
      const { data: existing } = await supabase
        .from('Card')
        .select('id')
        .eq('id', card.id)
        .single();

      if (existing) {
        // Atualizar card existente
        const { error } = await supabase
          .from('Card')
          .update({
            ...card,
            updatedAt: now,
          })
          .eq('id', card.id);

        if (error) {
          console.error(`❌ Erro ao atualizar ${card.id}:`, error.message);
        } else {
          console.log(`✅ Atualizado: ${card.title}`);
        }
      } else {
        // Inserir novo card
        const { error } = await supabase
          .from('Card')
          .insert({
            ...card,
            createdAt: now,
            updatedAt: now,
          });

        if (error) {
          console.error(`❌ Erro ao inserir ${card.id}:`, error.message);
        } else {
          console.log(`✅ Inserido: ${card.title}`);
        }
      }
    } catch (error) {
      console.error(`❌ Erro ao processar ${card.id}:`, error);
    }
  }

  console.log('\n✅ Sincronização concluída!');
}

syncCards();

