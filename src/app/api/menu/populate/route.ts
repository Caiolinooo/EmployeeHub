import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST() {
  try {
    console.log('🔄 Populando itens do menu...');

    // Verificar se já existem itens
    const { data: existingItems, error: checkError } = await supabaseAdmin
      .from('menu_items')
      .select('id')
      .limit(1);

    if (checkError) {
      console.error('❌ Erro ao verificar itens existentes:', checkError);
      return NextResponse.json(
        { error: 'Erro ao verificar itens existentes', details: checkError.message },
        { status: 500 }
      );
    }

    if (existingItems && existingItems.length > 0) {
      console.log('⚠️ Itens já existem no banco');
      return NextResponse.json({
        message: 'Itens já existem no banco',
        count: existingItems.length
      });
    }

    // Itens padrão do menu
    const defaultItems = [
      {
        id: 'dashboard',
        href: '/dashboard',
        label: 'Dashboard',
        title_pt: 'Dashboard',
        title_en: 'Dashboard',
        icon: 'FiGrid',
        external: false,
        enabled: true,
        order: 1,
        admin_only: false
      },
      {
        id: 'manual',
        href: '/manual',
        label: 'Manual Logístico',
        title_pt: 'Manual Logístico',
        title_en: 'Logistics Manual',
        icon: 'FiBookOpen',
        external: false,
        enabled: true,
        order: 2,
        admin_only: false
      },
      {
        id: 'procedimentos-logistica',
        href: '/procedimentos-logistica',
        label: 'Procedimentos Logística',
        title_pt: 'Procedimentos Logística',
        title_en: 'Logistics Procedures',
        icon: 'FiClipboard',
        external: false,
        enabled: true,
        order: 3,
        admin_only: false
      },
      {
        id: 'politicas',
        href: '/politicas',
        label: 'Políticas',
        title_pt: 'Políticas',
        title_en: 'Policies',
        icon: 'FiFileText',
        external: false,
        enabled: true,
        order: 4,
        admin_only: false
      },
      {
        id: 'calendario',
        href: '/calendario',
        label: 'Calendário',
        title_pt: 'Calendário',
        title_en: 'Calendar',
        icon: 'FiCalendar',
        external: false,
        enabled: true,
        order: 5,
        admin_only: false
      },
      {
        id: 'noticias',
        href: '/noticias',
        label: 'Notícias',
        title_pt: 'Notícias',
        title_en: 'News',
        icon: 'FiRss',
        external: false,
        enabled: true,
        order: 6,
        admin_only: false
      },
      {
        id: 'reembolso',
        href: '/reembolso',
        label: 'Reembolso',
        title_pt: 'Reembolso',
        title_en: 'Reimbursement',
        icon: 'FiDollarSign',
        external: false,
        enabled: true,
        order: 7,
        admin_only: false
      },
      {
        id: 'contracheque',
        href: '/contracheque',
        label: 'Contracheque',
        title_pt: 'Contracheque',
        title_en: 'Payslip',
        icon: 'FiFileText',
        external: false,
        enabled: true,
        order: 8,
        admin_only: false
      },
      {
        id: 'ponto',
        href: '/ponto',
        label: 'Ponto',
        title_pt: 'Ponto',
        title_en: 'Timesheet',
        icon: 'FiClock',
        external: false,
        enabled: true,
        order: 9,
        admin_only: false
      },
      {
        id: 'avaliacao',
        href: '/avaliacao',
        label: 'Avaliação',
        title_pt: 'Avaliação',
        title_en: 'Evaluation',
        icon: 'FiBarChart2',
        external: false,
        enabled: true,
        order: 10,
        admin_only: false,
        manager_only: true
      },
      {
        id: 'academy',
        href: '/academy',
        label: 'ABZ Academy',
        title_pt: 'ABZ Academy',
        title_en: 'ABZ Academy',
        icon: 'FiBook',
        external: false,
        enabled: true,
        order: 11,
        admin_only: false
      },
      {
        id: 'chat',
        href: '/chat',
        label: 'Chat',
        title_pt: 'Chat',
        title_en: 'Chat',
        icon: 'FiMessageSquare',
        external: false,
        enabled: true,
        order: 12,
        admin_only: false
      },
      {
        id: 'social',
        href: '/social',
        label: 'ABZ Social',
        title_pt: 'ABZ Social',
        title_en: 'ABZ Social',
        icon: 'FiUsers',
        external: false,
        enabled: true,
        order: 13,
        admin_only: false
      },
      {
        id: 'admin',
        href: '/admin',
        label: 'Administração',
        title_pt: 'Administração',
        title_en: 'Administration',
        icon: 'FiSettings',
        external: false,
        enabled: true,
        order: 14,
        admin_only: true
      }
    ];

    // Inserir itens
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('menu_items')
      .insert(defaultItems)
      .select();

    if (insertError) {
      console.error('❌ Erro ao inserir itens:', insertError);
      return NextResponse.json(
        { error: 'Erro ao inserir itens', details: insertError.message },
        { status: 500 }
      );
    }

    console.log(`✅ ${inserted.length} itens inseridos com sucesso!`);

    return NextResponse.json({
      success: true,
      message: `${inserted.length} itens inseridos com sucesso`,
      items: inserted
    });

  } catch (error) {
    console.error('❌ Erro geral:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// GET - Verificar status dos itens
export async function GET() {
  try {
    const { data: menuItems, error } = await supabaseAdmin
      .from('menu_items')
      .select('*')
      .order('order', { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao buscar itens', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      count: menuItems?.length || 0,
      items: menuItems
    });

  } catch (error) {
    console.error('❌ Erro geral:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

