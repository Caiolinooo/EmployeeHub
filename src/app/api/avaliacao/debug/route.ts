import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { data: avaliacoes } = await supabaseAdmin
      .from('avaliacoes_desempenho')
      .select('id, funcionario_id, avaliador_id, status')
      .order('created_at', { ascending: false })
      .limit(5);

    const { data: mapeamento } = await supabaseAdmin
      .from('avaliacao_colaborador_gerente')
      .select('*');

    return NextResponse.json({
      success: true,
      avaliacoes,
      mapeamento,
      aguardando: avaliacoes?.filter(a => a.status === 'aguardando_aprovacao') || []
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
