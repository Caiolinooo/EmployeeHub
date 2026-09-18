import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { paginarSelect } from '@/lib/gestao-tripulantes/supabase-paginacao';
import { garantirNivelIndicadores } from '@/lib/indicadores/api-auth';

export const dynamic = 'force-dynamic';

interface LinhaRow {
  id: string;
  dados: Record<string, unknown>;
  ordem: number | null;
}

function compararValores(a: unknown, b: unknown): number {
  if (a === null || a === undefined) {
    return b === null || b === undefined ? 0 : 1; // nulls sempre ao final
  }
  if (b === null || b === undefined) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'pt-BR', { numeric: true });
}

/**
 * GET /api/indicadores/abas/[id]/linhas?pagina=1&porPagina=50&busca=&ordem=<key>&dir=asc|desc
 *
 * Busca/ordenação em JS pós-busca paginada (paginarSelect): PostgREST não tem
 * ilike sobre o texto de um jsonb, e o contrato permite filtro JS simples —
 * assim `total`, paginação e ordenação por qualquer coluna de `dados` ficam
 * exatos. Gate: podeVerIndicadores.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const gate = await garantirNivelIndicadores(request, 'view');
    if (gate.error) return gate.error;

    const { id } = await context.params;
    const { data: aba, error: errAba } = await supabaseAdmin
      .from('rs_abas')
      .select('id, nome, colunas')
      .eq('id', id)
      .maybeSingle();
    if (errAba) {
      return NextResponse.json({ success: false, error: errAba.message }, { status: 500 });
    }
    if (!aba) {
      return NextResponse.json({ success: false, error: 'Aba não encontrada' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const pagina = Math.max(1, Number(searchParams.get('pagina')) || 1);
    const porPagina = Math.min(500, Math.max(1, Number(searchParams.get('porPagina')) || 50));
    const busca = (searchParams.get('busca') || '').trim().toLowerCase();
    const chave = searchParams.get('ordem') || 'ordem';
    const dir = searchParams.get('dir') === 'desc' ? 'desc' : 'asc';

    const vivas = await paginarSelect<LinhaRow>(async (from, to) => {
      const r = await supabaseAdmin
        .from('rs_linhas')
        .select('id, dados, ordem')
        .eq('aba_id', id)
        .is('deleted_at', null)
        .order('ordem', { ascending: true, nullsFirst: false })
        .order('id', { ascending: true })
        .range(from, to);
      return r;
    });
    if (vivas.error) {
      return NextResponse.json({ success: false, error: vivas.error }, { status: 500 });
    }

    let linhas = vivas.rows;
    if (busca) {
      linhas = linhas.filter((l) =>
        Object.values(l.dados || {}).some(
          (v) => v !== null && v !== undefined && String(v).toLowerCase().includes(busca),
        ),
      );
    }

    linhas = [...linhas].sort((x, y) => {
      const vx = chave === 'ordem' ? x.ordem : (x.dados || {})[chave];
      const vy = chave === 'ordem' ? y.ordem : (y.dados || {})[chave];
      const r = compararValores(vx, vy);
      if (vx === null || vx === undefined || vy === null || vy === undefined) return r;
      return dir === 'desc' ? -r : r;
    });

    const total = linhas.length;
    const inicio = (pagina - 1) * porPagina;
    const paginaLinhas = linhas.slice(inicio, inicio + porPagina);

    return NextResponse.json({
      success: true,
      data: {
        aba: { id: aba.id, nome: aba.nome, colunas: aba.colunas },
        linhas: paginaLinhas,
        total,
        pagina,
        porPagina,
      },
    });
  } catch (error) {
    console.error('[indicadores linhas GET]', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro ao listar linhas' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/indicadores/abas/[id]/linhas  { dados }
 * Insere linha manual (ordem = máx. vivo + 1, criado_por = ator).
 * Gate: podeEditarIndicadores.
 */
export async function POST(
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
    const dados = body?.dados;
    if (!dados || typeof dados !== 'object' || Array.isArray(dados)) {
      return NextResponse.json(
        { success: false, error: 'Campo "dados" (objeto) é obrigatório' },
        { status: 400 },
      );
    }

    const { data: ultima } = await supabaseAdmin
      .from('rs_linhas')
      .select('ordem')
      .eq('aba_id', id)
      .is('deleted_at', null)
      .order('ordem', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    const proximaOrdem = Number(ultima?.ordem ?? 0) + 1;

    const { data: nova, error: errIns } = await supabaseAdmin
      .from('rs_linhas')
      .insert({ aba_id: id, dados, ordem: proximaOrdem, criado_por: gate.ator })
      .select('id')
      .single();
    if (errIns || !nova) {
      return NextResponse.json(
        { success: false, error: errIns?.message || 'Falha ao inserir linha' },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, data: { id: nova.id } });
  } catch (error) {
    console.error('[indicadores linhas POST]', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro ao inserir linha' },
      { status: 500 },
    );
  }
}
