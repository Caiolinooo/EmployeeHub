import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    console.log('🌱 Populando todos os cards no Supabase...');

    // Cards básicos do sistema
    const allCards = [
      {
        id: 'manual',
        title: 'Manual do Colaborador',
        description: 'Acesse o manual completo do colaborador',
        href: '/manual',
        icon_name: 'FiBookOpen',
        color: 'bg-abz-blue',
        hover_color: 'hover:bg-abz-blue-dark',
        external: false,
        enabled: false,
        order: 1,
        admin_only: false,
        manager_only: false,
        module_key: 'manual',
        title_en: 'Employee Manual',
        description_en: 'Access the complete employee manual',
        category: 'documentation',
        tags: ['manual', 'documentation', 'employee'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'procedimentos-logistica',
        title: 'Procedimentos de Logística',
        description: 'Consulte os procedimentos padrões da área',
        href: '/procedimentos-logistica',
        icon_name: 'FiTruck',
        color: 'bg-green-600',
        hover_color: 'hover:bg-green-700',
        external: false,
        enabled: true,
        order: 2,
        admin_only: false,
        manager_only: false,
        module_key: 'procedimentos-logistica',
        title_en: 'Logistics Procedures',
        description_en: 'Check standard area procedures',
        category: 'procedures',
        tags: ['logistics', 'procedures', 'operations'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'politicas-empresa',
        title: 'Políticas',
        description: 'Consulte as políticas da empresa',
        href: '/politicas-empresa',
        icon_name: 'FiShield',
        color: 'bg-yellow-600',
        hover_color: 'hover:bg-yellow-700',
        external: false,
        enabled: true,
        order: 3,
        admin_only: false,
        manager_only: false,
        module_key: 'politicas-empresa',
        title_en: 'Policies',
        description_en: 'Check company policies',
        category: 'policies',
        tags: ['policies', 'company', 'rules'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'calendario-eventos',
        title: 'Calendário',
        description: 'Visualize eventos e datas importantes',
        href: '/calendario-eventos',
        icon_name: 'FiCalendar',
        color: 'bg-purple-600',
        hover_color: 'hover:bg-purple-700',
        external: false,
        enabled: true,
        order: 4,
        admin_only: false,
        manager_only: false,
        module_key: 'calendario-eventos',
        title_en: 'Calendar',
        description_en: 'View events and important dates',
        category: 'calendar',
        tags: ['calendar', 'events', 'dates'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'noticias-empresa',
        title: 'ABZ News',
        description: 'Fique por dentro das novidades da empresa',
        href: '/noticias-empresa',
        icon_name: 'FiRss',
        color: 'bg-orange-600',
        hover_color: 'hover:bg-orange-700',
        external: false,
        enabled: true,
        order: 5,
        admin_only: false,
        manager_only: false,
        module_key: 'noticias-empresa',
        title_en: 'ABZ News',
        description_en: 'Stay updated with company news',
        category: 'news',
        tags: ['news', 'company', 'updates'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'reembolso',
        title: 'Reembolso',
        description: 'Solicite reembolsos de despesas',
        href: '/reembolso',
        icon_name: 'FiDollarSign',
        color: 'bg-green-600',
        hover_color: 'hover:bg-green-700',
        external: false,
        enabled: true,
        order: 6,
        admin_only: false,
        manager_only: false,
        module_key: 'reembolso',
        title_en: 'Reimbursement',
        description_en: 'Request expense reimbursements',
        category: 'finance',
        tags: ['reimbursement', 'expenses', 'finance'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'contracheque',
        title: 'Contracheque',
        description: 'Acesse seus contracheques',
        href: '/contracheque',
        icon_name: 'FiFileText',
        color: 'bg-blue-600',
        hover_color: 'hover:bg-blue-700',
        external: false,
        enabled: true,
        order: 7,
        admin_only: false,
        manager_only: false,
        module_key: 'contracheque',
        title_en: 'Payslip',
        description_en: 'Access your payslips',
        category: 'finance',
        tags: ['payslip', 'salary', 'finance'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'ponto-eletronico',
        title: 'Ponto',
        description: 'Registre seu ponto e consulte seu histórico',
        href: '/ponto-eletronico',
        icon_name: 'FiClock',
        color: 'bg-indigo-600',
        hover_color: 'hover:bg-indigo-700',
        external: false,
        enabled: true,
        order: 8,
        admin_only: false,
        manager_only: false,
        module_key: 'ponto-eletronico',
        title_en: 'Time Clock',
        description_en: 'Register your time and check your history',
        category: 'time',
        tags: ['time', 'clock', 'attendance'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'avaliacao',
        title: 'Avaliação de Desempenho',
        description: 'Gerencie avaliações de desempenho dos colaboradores',
        href: '/avaliacao',
        icon_name: 'FiBarChart2',
        color: 'bg-teal-600',
        hover_color: 'hover:bg-teal-700',
        external: false,
        enabled: true,
        order: 9,
        admin_only: false,
        manager_only: true,
        module_key: 'avaliacao',
        title_en: 'Performance Evaluation',
        description_en: 'Manage employee performance evaluations',
        category: 'hr',
        tags: ['evaluation', 'performance', 'hr'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'folha-pagamento',
        title: 'Folha de Pagamento',
        description: 'Gerencie a folha de pagamento dos colaboradores',
        href: '/folha-pagamento',
        icon_name: 'FiCreditCard',
        color: 'bg-pink-600',
        hover_color: 'hover:bg-pink-700',
        external: false,
        enabled: true,
        order: 10,
        admin_only: true,
        manager_only: false,
        module_key: 'folha-pagamento',
        title_en: 'Payroll',
        description_en: 'Manage employee payroll',
        category: 'finance',
        tags: ['payroll', 'salary', 'finance'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
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
        order: 12,
        admin_only: false,
        manager_only: false,
        module_key: 'academy',
        title_en: 'ABZ Academy',
        description_en: 'Professional training and development center',
        category: 'education',
        tags: ['academy', 'training', 'courses', 'education'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'social',
        title: 'ABZ Social',
        description: 'Rede social interna da empresa',
        href: '/social',
        icon_name: 'FiUsers',
        color: 'bg-purple-600',
        hover_color: 'hover:bg-purple-700',
        external: false,
        enabled: true,
        order: 13,
        admin_only: false,
        manager_only: false,
        module_key: 'social',
        title_en: 'ABZ Social',
        description_en: 'Internal company social network',
        category: 'communication',
        tags: ['social', 'communication', 'team', 'posts'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'admin',
        title: 'Administração',
        description: 'Painel de administração do sistema',
        href: '/admin',
        icon_name: 'FiSettings',
        color: 'bg-gray-600',
        hover_color: 'hover:bg-gray-700',
        external: false,
        enabled: true,
        order: 99,
        admin_only: true,
        manager_only: false,
        module_key: 'admin',
        title_en: 'Administration',
        description_en: 'System administration panel',
        category: 'admin',
        tags: ['admin', 'system', 'management'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];

    console.log(`📝 Inserindo ${allCards.length} cards...`);

    // Usar upsert para inserir ou atualizar cards
    const { data: insertedCards, error: insertError } = await supabaseAdmin
      .from('cards')
      .upsert(allCards, { onConflict: 'id' })
      .select();

    if (insertError) {
      console.error('Erro ao inserir cards:', insertError);
      return NextResponse.json({
        error: 'Erro ao inserir cards',
        details: insertError.message
      }, { status: 500 });
    }

    console.log(`✅ ${insertedCards?.length || 0} cards inseridos com sucesso!`);

    // Verificar se todos os cards foram inseridos
    const { data: finalCards, error: checkError } = await supabaseAdmin
      .from('cards')
      .select('*')
      .order('order', { ascending: true });

    if (checkError) {
      console.error('Erro ao verificar cards:', checkError);
    }

    return NextResponse.json({
      success: true,
      message: 'Todos os cards foram populados com sucesso',
      inserted_count: insertedCards?.length || 0,
      total_cards: finalCards?.length || 0,
      cards: finalCards?.map(card => ({
        id: card.id,
        title: card.title,
        order: card.order,
        enabled: card.enabled
      })) || []
    });

  } catch (error) {
    console.error('❌ Erro ao popular cards:', error);
    return NextResponse.json({
      error: 'Erro interno ao popular cards',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}
