import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    console.log('🎨 Card Social desativado por solicitação do cliente.');
    return NextResponse.json({ ok: true, message: 'Social desativado' });

    // Verificar se o card social já existe
    const { data: existingCard, error: cardError } = await supabaseAdmin
      .from('cards')
      .select('*')
      .eq('id', 'social')
      .single();

    if (existingCard) {
      console.log('✅ Card social já existe');
      return NextResponse.json({
        success: true,
        message: 'Card social já existe',
        card: existingCard
      });
    }

    // Criar card social
    const socialCardData = {
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
    };

    const { data: newCard, error: insertError } = await supabaseAdmin
      .from('cards')
      .insert(socialCardData)
      .select()
      .single();

    if (insertError) {
      console.error('Erro ao inserir card social:', insertError);
      return NextResponse.json({
        error: 'Erro ao inserir card social',
        details: insertError.message
      }, { status: 500 });
    }

    console.log('✅ Card social criado com sucesso!');

    return NextResponse.json({
      success: true,
      message: 'Card social criado com sucesso',
      card: newCard
    });

  } catch (error) {
    console.error('❌ Erro ao criar card social:', error);
    return NextResponse.json({
      error: 'Erro interno ao criar card social',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    // Verificar se o card social existe
    const { data: socialCard, error } = await supabaseAdmin
      .from('cards')
      .select('*')
      .eq('id', 'social')
      .single();

    if (error) {
      return NextResponse.json({
        exists: false,
        error: error.message,
        message: 'Card social não encontrado'
      });
    }

    return NextResponse.json({
      exists: true,
      card: socialCard,
      message: 'Card social encontrado'
    });

  } catch (error) {
    console.error('Erro ao verificar card social:', error);
    return NextResponse.json({
      error: 'Erro interno ao verificar card social',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}
