import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { resolveAuthUserId } from '@/lib/gestao-tripulantes/aso-agendamento-auth';
import { isFechamentoRole } from '@/lib/gestao-tripulantes/fechamento-assinatura';
import {
  carregarPeriodoConfigurado,
  mesReferenciaAtualBRT,
  normalizarMesReferencia,
} from '@/lib/gestao-tripulantes/fechamento-periodo-resolver';

export const dynamic = 'force-dynamic';

/**
 * GET /api/gestao-tripulantes/fechamento/periodo?mesReferencia=YYYY-MM
 * Período manual do fechamento (R2) + flag da lista de marcados (R5).
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
    const mesReferencia =
      normalizarMesReferencia(searchParams.get('mesReferencia')) || mesReferenciaAtualBRT();

    const config = await carregarPeriodoConfigurado(mesReferencia);

    return NextResponse.json({
      success: true,
      mesReferencia,
      periodo: config
        ? {
            mesReferencia: config.mes_referencia,
            dataInicio: config.data_inicio,
            dataFim: config.data_fim,
            listaConfirmada: Boolean(config.lista_confirmada),
            definidoPorNome: config.definido_por_nome || null,
          }
        : null,
    });
  } catch (error) {
    console.error('[API FechamentoPeriodo GET]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao carregar período do fechamento' },
      { status: 500 },
    );
  }
}

function dataIsoValida(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number);
  const dt = new Date(y, m - 1, d, 0, 0, 0, 0);
  return !Number.isNaN(dt.getTime()) && dt.getDate() === d && dt.getMonth() === m - 1;
}

/**
 * PUT /api/gestao-tripulantes/fechamento/periodo
 * Body: { mesReferencia, dataInicio: 'YYYY-MM-DD', dataFim, listaConfirmada? }
 * Gate: isFechamentoRole (mesma família do config do fechamento).
 *
 * R5: `listaConfirmada` só é gravado quando o body traz um boolean — ausente/
 * undefined mantém o valor atual (PUT de período NUNCA desconfirma uma lista
 * já confirmada; mesmo contrato de salvarPeriodoFechamento no service).
 */
export async function PUT(request: NextRequest) {
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
    if (!isFechamentoRole(payload.role)) {
      return NextResponse.json(
        { error: 'Apenas gestores/administradores podem definir o período do fechamento.' },
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
    if (!dataIsoValida(body.dataInicio) || !dataIsoValida(body.dataFim)) {
      return NextResponse.json(
        { error: 'dataInicio e dataFim são obrigatórios no formato YYYY-MM-DD.' },
        { status: 400 },
      );
    }
    if (body.dataFim < body.dataInicio) {
      return NextResponse.json(
        { error: 'dataFim não pode ser anterior a dataInicio.' },
        { status: 400 },
      );
    }

    const userId = resolveAuthUserId(payload);
    let definidoPorNome: string | null = null;
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
        definidoPorNome =
          `${row.first_name || ''} ${row.last_name || ''}`.trim() ||
          (row.name || '').trim() ||
          row.email ||
          null;
      } catch (err) {
        console.error('[API FechamentoPeriodo PUT] ator (best-effort):', err);
      }
    }

    const agora = new Date().toISOString();
    const upsert: Record<string, unknown> = {
      mes_referencia: mesReferencia,
      data_inicio: body.dataInicio,
      data_fim: body.dataFim,
      definido_por: userId || null,
      definido_por_nome: definidoPorNome,
      updated_at: agora,
    };
    // R5: flag ausente = mantém o valor atual (novo registro nasce com o
    // DEFAULT false da tabela — nunca resetamos uma confirmação existente).
    if (typeof body.listaConfirmada === 'boolean') {
      upsert.lista_confirmada = body.listaConfirmada;
    }
    const { data: periodo, error } = await supabaseAdmin
      .from('gt_fechamento_periodos')
      .upsert(upsert, { onConflict: 'mes_referencia' })
      .select()
      .single();

    if (error) {
      console.error('[API FechamentoPeriodo PUT]', error);
      return NextResponse.json(
        { error: error.message || 'Não foi possível gravar o período do fechamento.' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      periodo: {
        mesReferencia: periodo.mes_referencia,
        dataInicio: periodo.data_inicio,
        dataFim: periodo.data_fim,
        listaConfirmada: Boolean(periodo.lista_confirmada),
        definidoPorNome: periodo.definido_por_nome || null,
      },
    });
  } catch (error) {
    console.error('[API FechamentoPeriodo PUT]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao gravar período do fechamento' },
      { status: 500 },
    );
  }
}
