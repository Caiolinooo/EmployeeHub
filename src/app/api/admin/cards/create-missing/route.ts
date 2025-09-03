import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST() {
  try {
    console.log('🔧 Criando cards faltantes...');

    const missingCards = [
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
        manager_only: false
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
        manager_only: false
      }
    ];

    const results = [];

    for (const card of missingCards) {
      try {
        // Verificar se já existe
        const { data: existing } = await supabaseAdmin
          .from('cards')
          .select('id')
          .eq('id', card.id)
          .single();

        if (existing) {
          results.push({
            id: card.id,
            status: 'EXISTS',
            message: `Card ${card.id} já existe`
          });
          continue;
        }

        // Tentar inserir
        const { data: inserted, error: insertError } = await supabaseAdmin
          .from('cards')
          .insert([card])
          .select();

        if (insertError) {
          results.push({
            id: card.id,
            status: 'ERROR',
            message: `Erro ao inserir card ${card.id}`,
            error: insertError.message
          });
        } else {
          results.push({
            id: card.id,
            status: 'CREATED',
            message: `Card ${card.id} criado com sucesso`
          });
        }

      } catch (err) {
        results.push({
          id: card.id,
          status: 'ERROR',
          message: `Erro inesperado ao processar card ${card.id}`,
          error: err instanceof Error ? err.message : 'Erro desconhecido'
        });
      }
    }

    // Verificar resultado final
    const { data: finalCards, error: finalError } = await supabaseAdmin
      .from('cards')
      .select('*')
      .order('order', { ascending: true });

    if (finalError) {
      return NextResponse.json({
        error: 'Erro ao verificar resultado final',
        details: finalError.message,
        results
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Processo de criação de cards faltantes concluído',
      results,
      final_count: finalCards?.length || 0,
      cards: finalCards?.map(card => ({
        id: card.id,
        title: card.title,
        enabled: card.enabled,
        order: card.order
      })) || []
    });

  } catch (error) {
    console.error('❌ Erro geral:', error);
    return NextResponse.json({
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}
