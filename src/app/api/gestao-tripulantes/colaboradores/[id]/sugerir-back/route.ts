import { overlayStatusEscalaHoje } from '@/lib/gestao-tripulantes/dashboard-service';
import { NextRequest, NextResponse } from 'next/server';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { sugerirBack } from '@/lib/gestao-tripulantes/algoritmo-back';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization') || undefined;
    const token = extractTokenFromHeader(authHeader);
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token inválido' }, { status: 401 });

    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const dataInicio = searchParams.get('data_inicio') || new Date().toISOString().split('T')[0];
    const limite = parseInt(searchParams.get('limite') || '5');

    const candidatosRaw = await sugerirBack({
      colaborador_embarcado_id: id,
      data_inicio: dataInicio,
    });

    const sliced = candidatosRaw.slice(0, limite);

    // Enrich with full collaborator data for the modal
    const ids = sliced.map(c => c.colaborador_id);
    const { data: colaboradores } = ids.length > 0
      ? await supabaseAdmin
          .from('gt_vw_colaboradores_completo')
          .select('id,nome_completo,cpf,cargo_nome,empresa_nome,embarcacao_nome,status_embarque,standby,avatar')
          .in('id', ids)
      : { data: [] };

    const overlay = await overlayStatusEscalaHoje(
      ((colaboradores || []) as Array<{ id: string }>).map((c) => ({ ...c, id: c.id })),
    );
    const colMap = new Map((overlay.error ? colaboradores || [] : overlay.rows).map((c: { id: string }) => [c.id, c]));

    const MAX_SCORE = 100;

    const sugestoes = sliced.map(c => {
      const col = colMap.get(c.colaborador_id) || {};
      const justificativas: string[] = [];

      if (c.criterios.mesmo_centro_custo) justificativas.push('Mesmo centro de custo');
      if (c.criterios.mesma_empresa) justificativas.push('Mesma empresa');
      if (c.criterios.mesma_embarcacao) justificativas.push('Mesma embarcação');
      if (c.criterios.mesmo_cargo) justificativas.push('Mesmo cargo');
      if (c.criterios.standby) justificativas.push('Em standby');
      if (c.criterios.substituicoes_anteriores > 0) justificativas.push(`Substituiu ${c.criterios.substituicoes_anteriores}x anteriormente`);
      if (c.criterios.documentos_validos) justificativas.push('Documentos válidos');

      return {
        colaborador: {
          id: c.colaborador_id,
          nome_completo: (col as any).nome_completo || c.nome,
          cpf: (col as any).cpf || '',
          cargo_nome: (col as any).cargo_nome || '',
          empresa_nome: (col as any).empresa_nome || '',
          embarcacao_nome: (col as any).embarcacao_nome || '',
          status_embarque: (col as any).status_embarque || '',
          standby: (col as any).standby || false,
          avatar: (col as any).avatar || null,
        },
        pontuacao: c.score,
        pontuacao_maxima: MAX_SCORE,
        justificativas,
      };
    });

    return NextResponse.json({ success: true, data: sugestoes });
  } catch (error) {
    console.error('Erro ao sugerir back:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
