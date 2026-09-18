import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { garantirNivelIndicadores } from '@/lib/indicadores/api-auth';

export const dynamic = 'force-dynamic';

/**
 * PUT /api/indicadores/linhas/[id]  { dados }
 * Atualiza os dados da linha (atualizado_por = ator). Gate: podeEditarIndicadores.
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const gate = await garantirNivelIndicadores(request, 'edit');
    if (gate.error) return gate.error;

    const { id } = await context.params;
    const body = await request.json();
    const dados = body?.dados;
    if (!dados || typeof dados !== 'object' || Array.isArray(dados)) {
      return NextResponse.json(
        { success: false, error: 'Campo "dados" (objeto) é obrigatório' },
        { status: 400 },
      );
    }

    const { error } = await supabaseAdmin
      .from('rs_linhas')
      .update({ dados, atualizado_por: gate.ator, updated_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null);
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[indicadores linhas PUT]', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro ao atualizar linha' },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/indicadores/linhas/[id]
 * Soft delete (deleted_at). Gate: podeEditarIndicadores.
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const gate = await garantirNivelIndicadores(request, 'edit');
    if (gate.error) return gate.error;

    const { id } = await context.params;
    const { error } = await supabaseAdmin
      .from('rs_linhas')
      .update({ deleted_at: new Date().toISOString(), atualizado_por: gate.ator })
      .eq('id', id)
      .is('deleted_at', null);
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[indicadores linhas DELETE]', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro ao excluir linha' },
      { status: 500 },
    );
  }
}
