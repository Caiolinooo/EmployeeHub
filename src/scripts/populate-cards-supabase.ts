/**
 * Script para popular a tabela cards do Supabase com todos os módulos do sistema
 * Este script garante que todos os cards estejam disponíveis no Supabase
 */

import { supabaseAdmin } from '@/lib/supabase';

// Definição completa de todos os cards do sistema
const allSystemCards = [
  {
    id: 'manual',
    title: 'Manual do Colaborador',
    description: 'Acesse o manual completo do colaborador',
    href: '/manual',
    icon_name: 'FiBookOpen',
    color: 'bg-blue-600',
    hover_color: 'hover:bg-blue-700',
    external: false,
    enabled: true,
    order: 1,
    admin_only: false,
    manager_only: false,
    module_key: 'manual',
    title_en: 'Employee Manual',
    description_en: 'Access the complete employee manual',
    category: 'Documentation'
  },
  {
    id: 'procedimentos-logistica',
    title: 'Procedimentos de Logística',
    description: 'Consulte os procedimentos de logística',
    href: '/procedimentos-logistica',
    icon_name: 'FiClipboard',
    color: 'bg-green-600',
    hover_color: 'hover:bg-green-700',
    external: false,
    enabled: true,
    order: 2,
    admin_only: false,
    manager_only: false,
    module_key: 'procedimentos',
    title_en: 'Logistics Procedures',
    description_en: 'Check logistics procedures',
    category: 'Procedures'
  },
  {
    id: 'politicas-empresa',
    title: 'Políticas da Empresa',
    description: 'Consulte as políticas da empresa',
    href: '/politicas-empresa',
    icon_name: 'FiFileText',
    color: 'bg-purple-600',
    hover_color: 'hover:bg-purple-700',
    external: false,
    enabled: true,
    order: 3,
    admin_only: false,
    manager_only: false,
    module_key: 'politicas',
    title_en: 'Company Policies',
    description_en: 'Check company policies',
    category: 'Policies'
  },
  {
    id: 'calendario-eventos',
    title: 'Calendário de Eventos',
    description: 'Veja o calendário de eventos',
    href: '/calendario-eventos',
    icon_name: 'FiCalendar',
    color: 'bg-orange-600',
    hover_color: 'hover:bg-orange-700',
    external: false,
    enabled: true,
    order: 4,
    admin_only: false,
    manager_only: false,
    module_key: 'calendario',
    title_en: 'Events Calendar',
    description_en: 'View the events calendar',
    category: 'Events'
  },
  {
    id: 'noticias-empresa',
    title: 'Notícias da Empresa',
    description: 'Fique por dentro das últimas notícias',
    href: '/noticias-empresa',
    icon_name: 'FiRss',
    color: 'bg-red-600',
    hover_color: 'hover:bg-red-700',
    external: false,
    enabled: true,
    order: 5,
    admin_only: false,
    manager_only: false,
    module_key: 'noticias',
    title_en: 'Company News',
    description_en: 'Stay up to date with the latest news',
    category: 'News'
  },
  {
    id: 'reembolso',
    title: 'Reembolso',
    description: 'Solicite reembolsos de despesas',
    href: '/reembolso',
    icon_name: 'FiDollarSign',
    color: 'bg-yellow-600',
    hover_color: 'hover:bg-yellow-700',
    external: false,
    enabled: true,
    order: 6,
    admin_only: false,
    manager_only: false,
    module_key: 'reembolso',
    title_en: 'Reimbursement',
    description_en: 'Request expense reimbursements',
    category: 'Finance'
  },
  {
    id: 'contracheque',
    title: 'Contracheque',
    description: 'Acesse seus contracheques',
    href: '/contracheque',
    icon_name: 'FiFileText',
    color: 'bg-indigo-600',
    hover_color: 'hover:bg-indigo-700',
    external: false,
    enabled: true,
    order: 7,
    admin_only: false,
    manager_only: false,
    module_key: 'contracheque',
    title_en: 'Payslip',
    description_en: 'Access your payslips',
    category: 'Finance'
  },
  {
    id: 'ponto-eletronico',
    title: 'Ponto Eletrônico',
    description: 'Registre seu ponto eletrônico',
    href: '/ponto-eletronico',
    icon_name: 'FiClock',
    color: 'bg-teal-600',
    hover_color: 'hover:bg-teal-700',
    external: false,
    enabled: true,
    order: 8,
    admin_only: false,
    manager_only: false,
    module_key: 'ponto',
    title_en: 'Time Clock',
    description_en: 'Register your time clock',
    category: 'Time'
  },
  {
    id: 'avaliacao',
    title: 'Avaliação',
    description: 'Sistema de avaliação de desempenho',
    href: '/avaliacao',
    icon_name: 'FiBarChart2',
    color: 'bg-pink-600',
    hover_color: 'hover:bg-pink-700',
    external: false,
    enabled: true,
    order: 9,
    admin_only: false,
    manager_only: false,
    module_key: 'avaliacao',
    title_en: 'Evaluation',
    description_en: 'Performance evaluation system',
    category: 'HR'
  },
  {
    id: 'academy',
    title: 'ABZ Academy',
    description: 'Centro de treinamento e desenvolvimento profissional',
    href: '/academy',
    icon_name: 'FiPlay',
    color: 'bg-blue-600',
    hover_color: 'hover:bg-blue-700',
    external: false,
    enabled: true,
    order: 10,
    admin_only: false,
    manager_only: false,
    module_key: 'academy',
    title_en: 'ABZ Academy',
    description_en: 'Professional training and development center',
    category: 'Education'
  },
  {
    id: 'folha-pagamento',
    title: 'Folha de Pagamento',
    description: 'Gerencie a folha de pagamento dos colaboradores',
    href: '/folha-pagamento',
    icon_name: 'FiActivity',
    color: 'bg-green-600',
    hover_color: 'hover:bg-green-700',
    external: false,
    enabled: true,
    order: 11,
    admin_only: false,
    manager_only: true,
    module_key: 'folha_pagamento',
    title_en: 'Payroll',
    description_en: 'Manage employee payroll',
    category: 'Finance'
  },
  {
    id: 'admin',
    title: 'Administração',
    description: 'Painel de administração do sistema',
    href: '/admin',
    icon_name: 'FiUser',
    color: 'bg-gray-600',
    hover_color: 'hover:bg-gray-700',
    external: false,
    enabled: true,
    order: 12,
    admin_only: true,
    manager_only: false,
    module_key: 'admin',
    title_en: 'Administration',
    description_en: 'System administration panel',
    category: 'Admin'
  }
];

async function populateCardsSupabase() {
  console.log('🚀 Populando tabela cards do Supabase...');

  try {
    // 1. Verificar se a tabela existe
    const { data: existingCards, error: checkError } = await supabaseAdmin
      .from('cards')
      .select('id')
      .limit(1);

    if (checkError && (checkError.message.includes('does not exist') || checkError.code === '42P01')) {
      console.log('📝 Tabela cards não existe, criando...');
      
      // Criar tabela usando a API de upgrade
      const upgradeResponse = await fetch('/api/admin/cards/upgrade-table', {
        method: 'POST'
      });
      
      if (!upgradeResponse.ok) {
        throw new Error('Erro ao criar tabela cards');
      }
      
      console.log('✅ Tabela cards criada com sucesso!');
    }

    // 2. Inserir/atualizar todos os cards
    console.log(`📝 Inserindo/atualizando ${allSystemCards.length} cards...`);
    
    const cardsWithTimestamp = allSystemCards.map(card => ({
      ...card,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    const { error: upsertError } = await supabaseAdmin
      .from('cards')
      .upsert(cardsWithTimestamp, { 
        onConflict: 'id',
        ignoreDuplicates: false 
      });

    if (upsertError) {
      console.error('Erro ao inserir cards:', upsertError);
      throw upsertError;
    }

    console.log('✅ Cards inseridos/atualizados com sucesso!');

    // 3. Verificar resultado final
    const { data: finalCards, error: finalError } = await supabaseAdmin
      .from('cards')
      .select('id, title, module_key, enabled, order')
      .order('order', { ascending: true });

    if (finalError) {
      console.error('Erro ao verificar cards finais:', finalError);
    } else {
      console.log(`🎉 Processo concluído! ${finalCards?.length || 0} cards na tabela:`);
      finalCards?.forEach(card => {
        console.log(`  - ${card.title} (${card.id}) - Module: ${card.module_key} - Enabled: ${card.enabled}`);
      });
    }

    return {
      success: true,
      message: `${allSystemCards.length} cards processados com sucesso`,
      cards_count: finalCards?.length || 0
    };

  } catch (error) {
    console.error('❌ Erro durante população dos cards:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
}

// Executar apenas se chamado diretamente
if (require.main === module) {
  populateCardsSupabase()
    .then((result) => {
      if (result.success) {
        console.log('🎉 Script executado com sucesso!');
        process.exit(0);
      } else {
        console.error('❌ Script falhou:', result.error);
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('❌ Erro fatal:', error);
      process.exit(1);
    });
}

export { populateCardsSupabase, allSystemCards };
