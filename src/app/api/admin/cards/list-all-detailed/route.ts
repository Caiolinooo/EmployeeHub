import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    console.log('📋 Listando todos os cards com detalhes...');

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
      message: 'Lista detalhada de todos os cards',
      count: allCards?.length || 0,
      cards: allCards || []
    });

  } catch (error) {
    return NextResponse.json({
      error: 'Erro interno',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}
