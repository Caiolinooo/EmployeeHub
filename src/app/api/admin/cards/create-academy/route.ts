import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    console.log('🎓 Criando card ABZ Academy...');

    // Verificar se já existe
    const { data: existing } = await supabaseAdmin
      .from('cards')
      .select('id')
      .eq('id', 'academy')
      .single();

    if (existing) {
      return NextResponse.json({
        success: true,
        message: 'Card Academy já existe',
        action: 'exists'
      });
    }

    // Criar o card Academy
    const academyCard = {
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
    };

    const { data: newCard, error: insertError } = await supabaseAdmin
      .from('cards')
      .insert(academyCard)
      .select()
      .single();

    if (insertError) {
      console.error('Erro ao criar card Academy:', insertError);
      return NextResponse.json({
        error: 'Erro ao criar card Academy',
        details: insertError.message
      }, { status: 500 });
    }

    console.log('✅ Card Academy criado com sucesso!');

    return NextResponse.json({
      success: true,
      message: 'Card Academy criado com sucesso',
      card: newCard,
      action: 'created'
    });

  } catch (error) {
    console.error('❌ Erro ao criar card Academy:', error);
    return NextResponse.json({
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    // Verificar se o card Academy existe
    const { data: academyCard, error } = await supabaseAdmin
      .from('cards')
      .select('*')
      .eq('id', 'academy')
      .single();

    if (error) {
      return NextResponse.json({
        exists: false,
        message: 'Card Academy não encontrado',
        error: error.message
      });
    }

    return NextResponse.json({
      exists: true,
      message: 'Card Academy encontrado',
      card: academyCard
    });

  } catch (error) {
    return NextResponse.json({
      error: 'Erro interno',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}
