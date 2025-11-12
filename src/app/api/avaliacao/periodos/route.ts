import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabase: ReturnType<typeof createClient> | null = null;
if (supabaseUrl && supabaseServiceKey) {
  supabase = createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * GET - Listar períodos de avaliação
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }

    if (!supabase) {
      return NextResponse.json({ success: false, error: 'Supabase não configurado' }, { status: 500 });
    }
    const { data: periodos, error } = await supabase
      .from('periodos_avaliacao')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      periodos,
    });
  } catch (error: any) {
    console.error('Erro ao buscar períodos:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST - Criar novo período de avaliação
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const body = await request.json();

    if (!supabase) {
      return NextResponse.json({ success: false, error: 'Supabase não configurado' }, { status: 500 });
    }
    const { data: periodo, error } = await supabase
      .from('periodos_avaliacao')
      .insert({
        nome: body.nome,
        descricao: body.descricao || null,
        ano: body.ano,
        data_inicio: body.data_inicio,
        data_fim: body.data_fim,
        data_limite_autoavaliacao: body.data_limite_autoavaliacao,
        data_limite_aprovacao: body.data_limite_aprovacao,
        status: body.status || 'planejado',
        ativo: body.ativo !== undefined ? body.ativo : true,
        criacao_automatica_executada: false,
        total_avaliacoes_criadas: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      periodo,
    });
  } catch (error: any) {
    console.error('Erro ao criar período:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
