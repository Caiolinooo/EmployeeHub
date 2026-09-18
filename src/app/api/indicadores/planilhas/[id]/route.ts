import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { garantirNivelIndicadores } from '@/lib/indicadores/api-auth';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/indicadores/planilhas/[id]
 * Remove o dataset (cascade: abas + linhas). Gate: podeImportarIndicadores.
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const gate = await garantirNivelIndicadores(request, 'import');
    if (gate.error) return gate.error;

    const { id } = await context.params;
    const { error } = await supabaseAdmin.from('rs_planilhas').delete().eq('id', id);
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[indicadores planilhas DELETE]', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro ao excluir planilha' },
      { status: 500 },
    );
  }
}
