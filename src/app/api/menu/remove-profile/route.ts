import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST() {
  try {
    console.log('🔄 Removendo item "Perfil" do menu...');

    // Remover o item "profile" da tabela menu_items
    const { error } = await supabaseAdmin
      .from('menu_items')
      .delete()
      .eq('id', 'profile');

    if (error) {
      console.error('❌ Erro ao remover item:', error);
      return NextResponse.json(
        { error: 'Erro ao remover item', details: error.message },
        { status: 500 }
      );
    }

    console.log('✅ Item "Perfil" removido com sucesso!');

    return NextResponse.json({
      success: true,
      message: 'Item "Perfil" removido do menu com sucesso'
    });

  } catch (error) {
    console.error('❌ Erro geral:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// GET - Verificar se o item existe
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('menu_items')
      .select('*')
      .eq('id', 'profile')
      .single();

    if (error && error.code !== 'PGRST116') {
      return NextResponse.json(
        { error: 'Erro ao verificar item', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      exists: !!data,
      item: data
    });

  } catch (error) {
    console.error('❌ Erro geral:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

