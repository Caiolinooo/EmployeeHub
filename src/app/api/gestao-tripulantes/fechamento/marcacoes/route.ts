import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkAclPermission, extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { resolveAuthUserId } from '@/lib/gestao-tripulantes/aso-agendamento-auth';
import { isFechamentoRole } from '@/lib/gestao-tripulantes/fechamento-assinatura';
import {
  carregarMarcacoesDoMes,
  mesReferenciaAtualBRT,
  normalizarMesReferencia,
} from '@/lib/gestao-tripulantes/fechamento-periodo-resolver';
import { resolverNomesColaboradores } from '@/lib/gestao-tripulantes/escala-audit-writer';

export const dynamic = 'force-dynamic';

const MAX_ITENS = 2000;

/**
 * GET /api/gestao-tripulantes/fechamento/marcacoes?mesReferencia=YYYY-MM
 * Lista explícita de marcados do mês (R5) + flag lista_confirmada.
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
    // BRT = UTC-3: âncora evita virar o mês cedo demais no fim do dia.
    const mesReferencia =
      normalizarMesReferencia(searchParams.get('mesReferencia')) || mesReferenciaAtualBRT();
    if (!mesReferencia) {
      return NextResponse.json({ error: 'mesReferencia inválido (use YYYY-MM).' }, { status: 400 });
    }

    const { data: config } = await supabaseAdmin
      .from('gt_fechamento_periodos')
      .select('lista_confirmada')
      .eq('mes_referencia', mesReferencia)
      .maybeSingle();

    const rows = await carregarMarcacoesDoMes(mesReferencia);
    const nomes = await resolverNomesColaboradores(rows.map((r) => r.colaborador_id));

    return NextResponse.json({
      success: true,
      mesReferencia,
      listaConfirmada: Boolean(config?.lista_confirmada),
      marcados: rows.map((r) => ({
        colaboradorId: r.colaborador_id,
        nome: nomes.get(r.colaborador_id) || '',
        marcado: Boolean(r.marcado),
        marcadoPorNome: r.marcado_por_nome || null,
      })),
    });
  } catch (error) {
    console.error('[API FechamentoMarcacoes GET]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao carregar marcações do fechamento' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/gestao-tripulantes/fechamento/marcacoes
 * Body: { mesReferencia, listaConfirmada?, itens: [{colaboradorId, marcado}] }
 * Batch upsert. Gate: isFechamentoRole OU ACL gestao-tripulantes.fechamento.marcas.
 */
export async function POST(request: NextRequest) {
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

    const userId = resolveAuthUserId(payload);
    const role = String(payload.role || '').toUpperCase();
    const liberado =
      isFechamentoRole(payload.role) ||
      (userId ? await checkAclPermission(userId, role, 'gestao-tripulantes', 'fechamento.marcas') : false);
    if (!liberado) {
      return NextResponse.json(
        { error: 'Sem permissão para marcar colaboradores no fechamento.' },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const mesReferencia = normalizarMesReferencia(body.mesReferencia);
    if (!mesReferencia) {
      return NextResponse.json(
        { error: 'mesReferencia é obrigatório no formato YYYY-MM.' },
        { status: 400 },
      );
    }
    const itens = Array.isArray(body.itens) ? body.itens : [];
    if (itens.length === 0) {
      return NextResponse.json({ error: 'itens é obrigatório (lista não vazia).' }, { status: 400 });
    }
    if (itens.length > MAX_ITENS) {
      return NextResponse.json(
        { error: `Limite de ${MAX_ITENS} itens por requisição.` },
        { status: 400 },
      );
    }
    for (const item of itens) {
      if (!item || typeof item.colaboradorId !== 'string' || !item.colaboradorId.trim()) {
        return NextResponse.json(
          { error: 'Cada item exige colaboradorId (UUID) e marcado (boolean).' },
          { status: 400 },
        );
      }
    }

    // Nome do ator (best-effort) para a trilha marcado_por_nome.
    let marcadoPorNome: string | null = null;
    if (userId) {
      try {
        const { data } = await supabaseAdmin
          .from('users_unified')
          .select('first_name, last_name, name, email')
          .eq('id', userId)
          .maybeSingle();
        const row = (data || {}) as {
          first_name?: string | null;
          last_name?: string | null;
          name?: string | null;
          email?: string | null;
        };
        marcadoPorNome =
          `${row.first_name || ''} ${row.last_name || ''}`.trim() ||
          (row.name || '').trim() ||
          row.email ||
          null;
      } catch (err) {
        console.error('[API FechamentoMarcacoes POST] ator (best-effort):', err);
      }
    }

    const agora = new Date().toISOString();
    const linhas = itens.map((item: { colaboradorId: string; marcado?: unknown }) => ({
      mes_referencia: mesReferencia,
      colaborador_id: String(item.colaboradorId).trim(),
      marcado: Boolean(item.marcado),
      marcado_por: userId || null,
      marcado_por_nome: marcadoPorNome,
      updated_at: agora,
    }));

    const { error: upErr } = await supabaseAdmin
      .from('gt_fechamento_marcacoes')
      .upsert(linhas, { onConflict: 'mes_referencia,colaborador_id' });
    if (upErr) {
      console.error('[API FechamentoMarcacoes POST]', upErr);
      return NextResponse.json(
        { error: upErr.message || 'Não foi possível gravar as marcações.' },
        { status: 500 },
      );
    }

    // Toggle da confirmação da lista (R5): exige período definido para confirmar.
    let listaConfirmada: boolean | undefined;
    if (typeof body.listaConfirmada === 'boolean') {
      const { data: periodoAtual } = await supabaseAdmin
        .from('gt_fechamento_periodos')
        .select('mes_referencia')
        .eq('mes_referencia', mesReferencia)
        .maybeSingle();
      if (body.listaConfirmada && !periodoAtual) {
        return NextResponse.json(
          {
            error:
              'Defina o período do fechamento antes de confirmar a lista de marcados (PUT /fechamento/periodo).',
          },
          { status: 400 },
        );
      }
      if (periodoAtual) {
        const { error: perErr } = await supabaseAdmin
          .from('gt_fechamento_periodos')
          .update({ lista_confirmada: body.listaConfirmada, updated_at: agora })
          .eq('mes_referencia', mesReferencia);
        if (perErr) {
          console.error('[API FechamentoMarcacoes POST] lista_confirmada:', perErr);
          return NextResponse.json(
            { error: perErr.message || 'Não foi possível atualizar listaConfirmada.' },
            { status: 500 },
          );
        }
        listaConfirmada = body.listaConfirmada;
      }
    }

    // Resposta com nomes resolvidos (paginado — PostgREST trunca em 1000).
    const ids = linhas.map((l: { colaborador_id: string }) => l.colaborador_id);
    const nomes = await resolverNomesColaboradores(ids);
    if (listaConfirmada === undefined) {
      const { data: cfg } = await supabaseAdmin
        .from('gt_fechamento_periodos')
        .select('lista_confirmada')
        .eq('mes_referencia', mesReferencia)
        .maybeSingle();
      listaConfirmada = Boolean(cfg?.lista_confirmada);
    }

    return NextResponse.json({
      success: true,
      mesReferencia,
      listaConfirmada,
      itens: linhas.map((l: { colaborador_id: string; marcado: boolean }) => ({
        colaboradorId: l.colaborador_id,
        nome: nomes.get(l.colaborador_id) || '',
        marcado: l.marcado,
        marcadoPorNome,
      })),
    });
  } catch (error) {
    console.error('[API FechamentoMarcacoes POST]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao gravar marcações do fechamento' },
      { status: 500 },
    );
  }
}
