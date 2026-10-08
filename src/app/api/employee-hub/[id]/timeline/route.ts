import { NextRequest, NextResponse } from 'next/server';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { getEsocialTimeline } from '@/lib/employee-hub/employee-hub-service';
import { supabaseAdmin } from '@/lib/supabase';
import { usuarioPodeVerColaborador } from '@/lib/gestao-tripulantes/empresa-acesso';
import { MENSAGEM_DOCUMENTOS_RESTRITOS } from '@/lib/gestao-tripulantes/documento-escopo';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const token = extractTokenFromHeader(request.headers.get('authorization') || undefined);
    const payload = token ? verifyToken(token) : null;
    if (!payload) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    const { id } = await context.params;
    if (!(await usuarioPodeVerColaborador({ id: payload.userId, role: payload.role }, id))) {
      return NextResponse.json({ error: MENSAGEM_DOCUMENTOS_RESTRITOS }, { status: 403 });
    }

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
