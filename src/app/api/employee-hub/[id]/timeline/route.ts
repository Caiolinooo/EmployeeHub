import { NextRequest, NextResponse } from 'next/server';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { getEsocialTimeline } from '@/lib/employee-hub/employee-hub-service';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const token = extractTokenFromHeader(request.headers.get('authorization') || undefined);
    if (!token || !verifyToken(token)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    const { id } = await context.params;

    // Get CPF from colaborador
    const { data: colab } = await supabaseAdmin
      .from('gt_colaboradores')
      .select('cpf')
      .eq('id', id)
      .maybeSingle();

    if (!colab?.cpf) {
      return NextResponse.json({ error: 'Colaborador não encontrado ou sem CPF' }, { status: 404 });
    }

    const cpf = colab.cpf.replace(/\D/g, '');
    const timeline = await getEsocialTimeline(cpf);

    return NextResponse.json({ timeline, cpf });
  } catch (err: any) {
    console.error('[employee-hub/timeline] Error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
