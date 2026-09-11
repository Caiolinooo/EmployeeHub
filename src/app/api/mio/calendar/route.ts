import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import type { MIOCalendarEvent } from '@/types/mio';

export const dynamic = 'force-dynamic';

/**
 * Calendar events from OUR database only (gt_historico_embarques + gt_documentos).
 * No live MIO GET.
 */
export async function GET(request: NextRequest) {
  try {
    const token = extractTokenFromHeader(request.headers.get('authorization') || undefined)
      || request.cookies.get('abzToken')?.value
      || request.cookies.get('token')?.value
      || null;
    if (!token || !verifyToken(token)) {
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
    }

    const cpfRaw = request.nextUrl.searchParams.get('cpf') || '';
    const cpfDigits = cpfRaw.replace(/\D/g, '');

    let colaboradorIds: string[] | null = null;
    if (cpfDigits) {
      const { data: cols } = await supabaseAdmin
        .from('gt_colaboradores')
        .select('id, cpf')
        .is('deleted_at', null);
      colaboradorIds = (cols || [])
        .filter((c) => String(c.cpf || '').replace(/\D/g, '') === cpfDigits)
        .map((c) => c.id);
      if (colaboradorIds.length === 0) {
        return NextResponse.json({ success: true, events: [] });
      }
    }

    let embQuery = supabaseAdmin
      .from('gt_historico_embarques')
      .select('id, colaborador_id, data_embarque, data_desembarque, data_prevista_desembarque, local_embarque, origem, gt_colaboradores:colaborador_id (cpf, nome_completo)')
      .is('deleted_at', null)
      .order('data_embarque', { ascending: false })
      .limit(2000);
    if (colaboradorIds) embQuery = embQuery.in('colaborador_id', colaboradorIds);

    let docQuery = supabaseAdmin
      .from('gt_documentos')
      .select('id, colaborador_id, titulo, data_validade, tipo_documento, status_validacao, gt_colaboradores:colaborador_id (cpf)')
      .is('deleted_at', null)
      .in('tipo_documento', ['treinamento', 'aso'])
      .not('data_validade', 'is', null)
      .limit(2000);
    if (colaboradorIds) docQuery = docQuery.in('colaborador_id', colaboradorIds);

    const [embRes, docRes] = await Promise.all([embQuery, docQuery]);

    const events: MIOCalendarEvent[] = [];

    for (const e of embRes.data || []) {
      const col = e.gt_colaboradores as { cpf?: string; nome_completo?: string } | null;
      events.push({
        id: `gt_emb_${e.id}`,
        mio_id: e.id,
        cpf: String(col?.cpf || '').replace(/\D/g, ''),
        type: 'embarque',
        title: `Embarque ${e.local_embarque || ''}`.trim(),
        start: e.data_embarque,
        end: e.data_desembarque || e.data_prevista_desembarque || undefined,
        allDay: true,
        description: col?.nome_completo || '',
        color: e.data_desembarque ? '#808080' : '#4169E1',
      });
    }

    const agora = new Date();
    for (const d of docRes.data || []) {
      if (!d.data_validade) continue;
      const validade = new Date(d.data_validade);
      const dias = Math.ceil((validade.getTime() - agora.getTime()) / (1000 * 60 * 60 * 24));
      if (dias > 90) continue;
      const col = d.gt_colaboradores as { cpf?: string } | null;
      events.push({
        id: `gt_doc_${d.id}`,
        mio_id: d.id,
        cpf: String(col?.cpf || '').replace(/\D/g, ''),
        type: d.tipo_documento === 'aso' ? 'aso' : 'curso',
        title: d.titulo || 'Documento',
        start: d.data_validade,
        allDay: true,
        description: `Validade: ${d.data_validade} (${d.status_validacao})`,
        color: dias <= 0 ? '#FF0000' : dias <= 30 ? '#FF8C00' : '#FFD700',
      });
    }

    return NextResponse.json({ success: true, events });
  } catch (error: any) {
    console.error('Erro na API calendar local:', error);
    return NextResponse.json(
      { success: false, error: 'Falha ao carregar eventos' },
      { status: 500 }
    );
  }
}
