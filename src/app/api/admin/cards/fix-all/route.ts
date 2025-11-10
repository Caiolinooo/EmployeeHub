import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    console.log('🔧 Corrigindo problemas com cards...');

    // 1. Verificar se a tabela existe
    const { data: tableCheck, error: tableError } = await supabaseAdmin
      .from('cards')
      .select('*', { count: 'exact', head: true });

    if (tableError) {
      return NextResponse.json({
        error: 'Tabela cards não existe ou não é acessível',
        details: tableError.message,
        sql_needed: `
CREATE TABLE IF NOT EXISTS cards (
  id VARCHAR(50) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  href VARCHAR(500) NOT NULL,
  icon_name VARCHAR(100),
  color VARCHAR(100),
  hover_color VARCHAR(100),
  external BOOLEAN DEFAULT false,
  enabled BOOLEAN DEFAULT true,
  "order" INTEGER DEFAULT 0,
  admin_only BOOLEAN DEFAULT false,
  manager_only BOOLEAN DEFAULT false,
  module_key VARCHAR(100),
  title_en VARCHAR(255),
  description_en TEXT,
  category VARCHAR(100),
  tags TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
        `
      }, { status: 500 });
    }

    console.log(`✅ Tabela cards acessível com ${tableCheck || 0} registros`);

    // 2. Inserir cards básicos um por um para identificar problemas
    const basicCards = [
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
        module_key: 'manual'
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
        module_key: 'academy'
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
        module_key: 'social'
      }
    ];

    const results = [];

    for (const card of basicCards) {
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
          .insert(card)
          .select()
          .single();

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

    // 3. Verificar resultado final
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
      message: 'Processo de correção concluído',
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

export async function GET() {
  try {
    // Verificar status atual
    const { data: cards, error } = await supabaseAdmin
      .from('cards')
      .select('*')
      .order('order', { ascending: true });

    if (error) {
      return NextResponse.json({
        error: 'Erro ao acessar tabela cards',
        details: error.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Status atual dos cards',
      count: cards?.length || 0,
      cards: cards?.map(card => ({
        id: card.id,
        title: card.title,
        enabled: card.enabled,
        order: card.order
      })) || []
    });

  } catch (error) {
    return NextResponse.json({
      error: 'Erro interno',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}
