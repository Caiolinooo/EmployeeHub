import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import {
  ESCALA_EDICAO_OPERACOES,
  ESCALA_EDICAO_STATUS,
  resolverNomesColaboradores,
  type EscalaEdicaoRow,
} from '@/lib/gestao-tripulantes/escala-audit-writer';
import { normalizarJanelaPeriodoBRT } from '@/lib/gestao-tripulantes/escala-edicoes-periodo';

export const dynamic = 'force-dynamic';

const PAGE_DEFAULT = 50;
const PAGE_MAX = 200;

function colaboradorIdDaEdicao(r: EscalaEdicaoRow): string | null {
  if (r.colaborador_id) return r.colaborador_id;
  const novos = r.dados_novos as { colaborador_id?: string } | null;
  const anteriores = r.dados_anteriores as { colaborador_id?: string } | null;
  return novos?.colaborador_id || anteriores?.colaborador_id || null;
}

/**
 * GET /api/gestao-tripulantes/escala-edicoes
 * Fila de auditoria das edições da escala (R7) — paginada, mais novas primeiro.
 * Query: ?status=aplicada|revertida|rejeitada&operacao=create|update|delete|restore|rejeicao|reversao
 *        &colaboradorId=UUID&embarqueId=UUID&de=YYYY-MM-DD&ate=YYYY-MM-DD&page=1&pageSize=50
 * Período (de/ate) opcional, INCLUSIVO, interpretado em BRT (offset fixo -03:00):
 * filtra created_at por `>= de T00:00:00-03:00` e `<= ate T23:59:59-03:00`.
 * Formato inválido ou de > ate → 400 (validação em escala-edicoes-periodo.ts).
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || undefined;
    const token =
      extractTokenFromHeader(authHeader) ||
      request.cookies.get('abzToken')?.value ||
      request.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Token de autorização necessário' }, { status: 401 });
    }
    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const statusParam = (searchParams.get('status') || '').trim();
    if (statusParam && !(ESCALA_EDICAO_STATUS as readonly string[]).includes(statusParam)) {
      return NextResponse.json(
        { error: `status inválido (use: ${ESCALA_EDICAO_STATUS.join('|')}).` },
        { status: 400 },
      );
    }
    const operacaoParam = (searchParams.get('operacao') || '').trim();
    if (operacaoParam && !(ESCALA_EDICAO_OPERACOES as readonly string[]).includes(operacaoParam)) {
      return NextResponse.json(
        { error: `operacao inválida (use: ${ESCALA_EDICAO_OPERACOES.join('|')}).` },
        { status: 400 },
      );
    }
    const colaboradorId = (searchParams.get('colaboradorId') || '').trim() || undefined;
    const embarqueId = (searchParams.get('embarqueId') || '').trim() || undefined;

    // Período opcional (de/ate, YYYY-MM-DD inclusivos, fuso BRT). Inválido/invertido → 400.
    const janelaRes = normalizarJanelaPeriodoBRT(searchParams.get('de'), searchParams.get('ate'));
    if (!janelaRes.ok) {
      return NextResponse.json({ error: janelaRes.error }, { status: 400 });
    }
    const { createdDe, createdAte } = janelaRes.janela;

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const pageSize = Math.min(
      PAGE_MAX,
      Math.max(1, parseInt(searchParams.get('pageSize') || String(PAGE_DEFAULT), 10) || PAGE_DEFAULT),
    );
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let countQuery = supabaseAdmin
      .from('gt_escala_edicoes')
      .select('id', { count: 'exact', head: true });
    let rowsQuery = supabaseAdmin
      .from('gt_escala_edicoes')
      .select('*')
      .order('created_at', { ascending: false, nullsFirst: false })
      .order('id', { ascending: false });
    if (statusParam) {
      countQuery = countQuery.eq('status', statusParam);
      rowsQuery = rowsQuery.eq('status', statusParam);
    }
    if (operacaoParam) {
      countQuery = countQuery.eq('operacao', operacaoParam);
      rowsQuery = rowsQuery.eq('operacao', operacaoParam);
    }
    if (colaboradorId) {
      countQuery = countQuery.eq('colaborador_id', colaboradorId);
      rowsQuery = rowsQuery.eq('colaborador_id', colaboradorId);
    }
    if (embarqueId) {
      countQuery = countQuery.eq('embarque_id', embarqueId);
      rowsQuery = rowsQuery.eq('embarque_id', embarqueId);
    }
    if (createdDe) {
      countQuery = countQuery.gte('created_at', createdDe);
      rowsQuery = rowsQuery.gte('created_at', createdDe);
    }
    if (createdAte) {
      countQuery = countQuery.lte('created_at', createdAte);
      rowsQuery = rowsQuery.lte('created_at', createdAte);
    }

    const [totalRes, pageRes] = await Promise.all([
      countQuery,
      rowsQuery.range(from, to),
    ]);

    if (totalRes.error) {
      console.error('[API EscalaEdicoes GET] count:', totalRes.error);
      return NextResponse.json(
        { error: totalRes.error.message || 'Erro ao contar edições da escala' },
        { status: 500 },
      );
    }
    if (pageRes.error) {
      console.error('[API EscalaEdicoes GET]', pageRes.error);
      return NextResponse.json(
        { error: pageRes.error.message || 'Erro ao listar edições da escala' },
        { status: 500 },
      );
    }

    const rows = (pageRes.data || []) as EscalaEdicaoRow[];
    const nomes = await resolverNomesColaboradores(rows.map((r) => colaboradorIdDaEdicao(r)));

    return NextResponse.json({
      success: true,
      page,
      pageSize,
      total: totalRes.count ?? rows.length,
      rows: rows.map((r) => ({
        ...r,
        colaboradorNome: nomes.get(colaboradorIdDaEdicao(r) || '') || null,
      })),
    });
  } catch (error) {
    console.error('[API EscalaEdicoes GET]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao listar edições da escala' },
      { status: 500 },
    );
  }
}
