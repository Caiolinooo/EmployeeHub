import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST() {
  try {
    console.log('🎓 Inserindo card Academy diretamente...');

    // Primeiro, vamos verificar a estrutura da tabela
    const { data: tableInfo, error: tableError } = await supabaseAdmin
      .from('cards')
      .select('*')
      .limit(1);

    if (tableError) {
      console.error('Erro ao acessar tabela cards:', tableError);
      return NextResponse.json({
        error: 'Erro ao acessar tabela cards',
        details: tableError.message
      }, { status: 500 });
    }

    console.log('✅ Tabela cards acessível');

    // Verificar se já existe um card com id 'academy'
    const { data: existingCards, error: checkError } = await supabaseAdmin
      .from('cards')
      .select('id')
      .eq('id', 'academy');

    if (checkError) {
      console.error('Erro ao verificar cards existentes:', checkError);
      return NextResponse.json({
        error: 'Erro ao verificar cards existentes',
        details: checkError.message
      }, { status: 500 });
    }

    if (existingCards && existingCards.length > 0) {
      return NextResponse.json({
        success: true,
        message: 'Card Academy já existe',
        action: 'exists'
      });
    }

    // Inserir o card Academy com dados mínimos
    const academyCardData = {
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
      manager_only: false
    };

    console.log('📝 Inserindo card com dados:', academyCardData);

    const { data: insertedCard, error: insertError } = await supabaseAdmin
      .from('cards')
      .insert([academyCardData])
      .select();

    if (insertError) {
      console.error('Erro ao inserir card Academy:', insertError);
      return NextResponse.json({
        error: 'Erro ao inserir card Academy',
        details: insertError.message,
        code: insertError.code,
        hint: insertError.hint
      }, { status: 500 });
    }

    console.log('✅ Card Academy inserido com sucesso!', insertedCard);

    return NextResponse.json({
      success: true,
      message: 'Card Academy criado com sucesso',
      card: insertedCard?.[0] || null,
      action: 'created'
    });

  } catch (error) {
    console.error('❌ Erro geral ao inserir card Academy:', error);
    return NextResponse.json({
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    // Listar todos os cards para debug
    const { data: allCards, error } = await supabaseAdmin
      .from('cards')
      .select('*')
      .order('order', { ascending: true });

    if (error) {
      return NextResponse.json({
        error: 'Erro ao buscar cards',
        details: error.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Lista de todos os cards',
      count: allCards?.length || 0,
      cards: allCards?.map(card => ({
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
