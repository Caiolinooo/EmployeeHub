import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase environment variables are not configured');
  }
  
  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * GET - Buscar período específico
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authHeader = request.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const supabase = getSupabaseClient();
    const { data: periodo, error } = await supabase
      .from('periodos_avaliacao')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      periodo,
    });
  } catch (error: any) {
    console.error('Erro ao buscar período:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT - Atualizar período
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authHeader = request.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const body = await request.json();

    const supabase = getSupabaseClient();
    const { data: periodo, error } = await supabase
      .from('periodos_avaliacao')
      .update({
        nome: body.nome,
        descricao: body.descricao || null,
        ano: body.ano,
        data_inicio: body.data_inicio,
        data_fim: body.data_fim,
        data_limite_autoavaliacao: body.data_limite_autoavaliacao,
        data_limite_aprovacao: body.data_limite_aprovacao,
        status: body.status,
        ativo: body.ativo,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)
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
    console.error('Erro ao atualizar período:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Excluir período
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authHeader = request.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('periodos_avaliacao')
      .delete()
      .eq('id', params.id);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: 'Período excluído com sucesso',
    });
  } catch (error: any) {
    console.error('Erro ao excluir período:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
