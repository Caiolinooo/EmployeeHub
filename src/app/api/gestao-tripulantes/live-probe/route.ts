import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GT v2 (R3) — probe leve de mudança para polling do cliente.
 *
 * Assinatura barata: COUNT + MAX(updated_at)/MAX(created_at) (via ORDER DESC
 * LIMIT 1) das tabelas do escopo. R3: o cliente consulta a cada 15s e só
 * refaz o fetch pesado quando a assinatura muda — toda a semântica de
 * geração/stale-guard do realtime/fechamento continua valendo.
 *
 * NÃO colocar cache HTTP/rotas aqui: a assinatura precisa refletir a escrita
 * imediatamente (Cache-Control: no-store, sem revalidate).
 */

type Escopo = 'escala' | 'fechamento' | 'colaboradores';

const ESCOPOS_VALIDOS: Escopo[] = ['escala', 'fechamento', 'colaboradores'];

async function stampUltima(
  tabela: string,
  coluna: 'updated_at' | 'created_at',
  apenasVivas: boolean,
): Promise<string> {
  try {
    let q = supabaseAdmin.from(tabela).select(coluna).order(coluna, {
      ascending: false,
      nullsFirst: false,
    });
    if (apenasVivas) q = q.is('deleted_at', null);
    const { data, error } = await q.limit(1);
    if (error) return `err`;
    const row = (data || [])[0] as Record<string, unknown> | undefined;
    return (row?.[coluna] as string) || 'none';
  } catch {
    return 'err';
  }
}

async function countTabela(
  tabela: string,
  apenasVivas: boolean,
): Promise<number> {
  try {
    let q = supabaseAdmin.from(tabela).select('id', { count: 'exact', head: true });
    if (apenasVivas) q = q.is('deleted_at', null);
    const { count, error } = await q;
    if (error) return -1;
    return count ?? -1;
  } catch {
    return -1;
  }
}

function parte(tabela: string, count: number, stamps: string[]): string {
  return `${tabela}:${count}:${stamps.join(':')}`;
}

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
    const pedidos = (searchParams.get('escopo') || 'escala')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const invalidos = pedidos.filter((p) => !(ESCOPOS_VALIDOS as string[]).includes(p));
    if (pedidos.length === 0 || invalidos.length > 0) {
      return NextResponse.json(
        { error: `escopo inválido (${invalidos.join(', ') || 'vazio'}). Use: ${ESCOPOS_VALIDOS.join('|')}.` },
        { status: 400 },
      );
    }

    const partes: string[] = [];

    if (pedidos.includes('escala')) {
      // Sem filtro deleted_at: soft-delete/restore muda updated_at e precisa
      // aparecer na assinatura.
      const [count, up, cr] = await Promise.all([
        countTabela('gt_historico_embarques', false),
        stampUltima('gt_historico_embarques', 'updated_at', false),
        stampUltima('gt_historico_embarques', 'created_at', false),
      ]);
      partes.push(parte('gt_emb', count, [up, cr]));
    }

    if (pedidos.includes('fechamento')) {
      const [marcCount, marcUp, perUp, aprUp] = await Promise.all([
        countTabela('gt_fechamento_marcacoes', false),
        stampUltima('gt_fechamento_marcacoes', 'updated_at', false),
        stampUltima('gt_fechamento_periodos', 'updated_at', false),
        stampUltima('gt_relatorios_aprovacoes', 'updated_at', false),
      ]);
      partes.push(parte('gt_marc', marcCount, [marcUp, perUp, aprUp]));
    }

    if (pedidos.includes('colaboradores')) {
      const [count, up] = await Promise.all([
        countTabela('gt_colaboradores', false),
        stampUltima('gt_colaboradores', 'updated_at', false),
      ]);
      partes.push(parte('gt_col', count, [up]));
    }

    const assinatura = partes.join('|');

    return NextResponse.json(
      { success: true, escopo: pedidos, assinatura, emitidaEm: new Date().toISOString() },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  } catch (error) {
    console.error('[API LiveProbe GET]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro no probe de mudanças' },
      { status: 500 },
    );
  }
}
