import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { garantirNivelIndicadores } from '@/lib/indicadores/api-auth';

export const dynamic = 'force-dynamic';

/**
 * PUT /api/indicadores/abas/[id]  { colunas: [{key,label,tipo}] }
 * Atualiza o schema de colunas da aba. Gate: podeEditarIndicadores.
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const gate = await garantirNivelIndicadores(request, 'edit');
    if (gate.error) return gate.error;

    const { id } = await context.params;
    const { data: aba } = await supabaseAdmin.from('rs_abas').select('id').eq('id', id).maybeSingle();
    if (!aba) {
      return NextResponse.json({ success: false, error: 'Aba não encontrada' }, { status: 404 });
    }

    const body = await request.json();
    const colunas = body?.colunas;
    if (!Array.isArray(colunas) || colunas.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Campo "colunas" (lista não vazia) é obrigatório' },
        { status: 400 },
      );
    }
    for (const c of colunas) {
      const tipoValido =
        c?.tipo === 'data' || c?.tipo === 'numero' || c?.tipo === 'percentual' || c?.tipo === 'texto';
      if (!c || typeof c.key !== 'string' || !c.key.trim() || typeof c.label !== 'string' || !tipoValido) {
        return NextResponse.json(
          { success: false, error: 'Cada coluna exige { key, label, tipo: data|numero|percentual|texto }' },
          { status: 400 },
        );
      }
    }

    const { error } = await supabaseAdmin
      .from('rs_abas')
      .update({ colunas, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[indicadores abas PUT]', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro ao atualizar aba' },
      { status: 500 },
    );
  }
}
