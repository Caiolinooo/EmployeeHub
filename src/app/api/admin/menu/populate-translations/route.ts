import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * API para popular traduções na tabela menu_items
 */
export async function POST() {
  try {
    console.log('🔄 Populando traduções na tabela menu_items...');

    // Definir todos os itens do menu com traduções
    const menuItemsWithTranslations = [
      {
        id: 'dashboard',
        href: '/dashboard',
        label: 'Dashboard',
        title_pt: 'Painel',
        title_en: 'Dashboard',
        icon: 'FiGrid',
        external: false,
        enabled: true,
        order: 1,
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
        order: 2,
        admin_only: false
      },
      {
        id: 'avaliacao',
        href: '/avaliacao',
        label: 'Avaliação',
        title_pt: 'Avaliação',
        title_en: 'Evaluation',
        icon: 'FiTrendingUp',
        external: false,
        enabled: true,
        order: 3,
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
        order: 4,
        admin_only: false
      },
      {
        id: 'contatos',
        href: '/contatos',
        label: 'Contatos',
        title_pt: 'Contatos',
        title_en: 'Contacts',
        icon: 'FiPhone',
        external: false,
        enabled: true,
        order: 5,
        admin_only: false
      },
      {
        id: 'ponto',
        href: '/ponto',
        label: 'Ponto',
        title_pt: 'Ponto',
        title_en: 'Time Clock',
        icon: 'FiClock',
        external: false,
        enabled: true,
        order: 6,
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
        order: 7,
        admin_only: false
      },
      {
        id: 'academy',
        href: '/academy',
        label: 'Academy',
        title_pt: 'Academy',
        title_en: 'Academy',
        icon: 'FiBook',
        external: false,
        enabled: true,
        order: 8,
        admin_only: false
      },
      {
        id: 'noticias',
        href: '/noticias',
        label: 'Notícias',
        title_pt: 'Notícias',
        title_en: 'News',
        icon: 'FiMessageSquare',
        external: false,
        enabled: true,
        order: 9,
        admin_only: false
      }
    ];

    // Fazer upsert de cada item
    let updatedCount = 0;
    let createdCount = 0;

    for (const item of menuItemsWithTranslations) {
      // Verificar se o item já existe
      const { data: existing } = await supabaseAdmin
        .from('menu_items')
        .select('id')
        .eq('id', item.id)
        .single();

      if (existing) {
        // Atualizar item existente
        const { error } = await supabaseAdmin
          .from('menu_items')
          .update({
            label: item.label,
            title_pt: item.title_pt,
            title_en: item.title_en,
            href: item.href,
            icon: item.icon,
            external: item.external,
            enabled: item.enabled,
            order: item.order,
            admin_only: item.admin_only
          })
          .eq('id', item.id);

        if (error) {
          console.error(`❌ Erro ao atualizar item ${item.id}:`, error);
        } else {
          console.log(`✅ Atualizado: ${item.label}`);
          updatedCount++;
        }
      } else {
        // Criar novo item
        const { error } = await supabaseAdmin
          .from('menu_items')
          .insert({
            id: item.id,
            label: item.label,
            title_pt: item.title_pt,
            title_en: item.title_en,
            href: item.href,
            icon: item.icon,
            external: item.external,
            enabled: item.enabled,
            order: item.order,
            admin_only: item.admin_only
          });

        if (error) {
          console.error(`❌ Erro ao criar item ${item.id}:`, error);
        } else {
          console.log(`✅ Criado: ${item.label}`);
          createdCount++;
        }
      }
    }

    console.log(`✅ Traduções populadas: ${createdCount} criados, ${updatedCount} atualizados`);

    return NextResponse.json({
      success: true,
      message: 'Traduções populadas com sucesso',
      created: createdCount,
      updated: updatedCount,
      total: menuItemsWithTranslations.length
    });

  } catch (error) {
    console.error('❌ Erro ao popular traduções:', error);
    return NextResponse.json(
      { 
        error: 'Erro ao popular traduções',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

