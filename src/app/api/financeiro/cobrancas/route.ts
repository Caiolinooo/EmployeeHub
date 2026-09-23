import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { garantirNivelFinanceiro } from '@/lib/financeiro/financeiro-auth';
import { gerarCobranca } from '@/lib/financeiro/service';
import { atorDeUserId } from '@/lib/financeiro/eventos';
import { finErro, finFail, finOk, corpoJson, texto, paginacao } from '../_lib/http';

export const dynamic = 'force-dynamic';

/** GET /api/financeiro/cobrancas?faturaId=&status=&page=&limit= (gate view). */
export async function GET(request: NextRequest) {
  try {
    const gate = await garantirNivelFinanceiro(request, 'view');
    if (!gate.ok) return gate.error;

    const { searchParams } = new URL(request.url);
    const { page, limit, from, to } = paginacao(request.url);
    let query = supabaseAdmin
      .from('fin_cobrancas')
      .select('*, fatura:fin_faturas(id, numero, ano, status)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);
    const faturaId = searchParams.get('faturaId');
    if (faturaId) query = query.eq('fatura_id', faturaId);
    const status = searchParams.get('status');
    if (status) query = query.eq('status', status);

    const { data, error, count } = await query;
    if (error) return finFail(error.message, 500);
    return finOk({
      items: data || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil((count || 0) / limit)),
    });
  } catch (e) {
    return finErro(e);
  }
}

/**
 * POST /api/financeiro/cobrancas {faturaId, contaBancariaId, tipo:'boleto'|'pix',
 * vencimento?, valor?} — adapter gera → cobrança `gerada` + evento (§6).
 */
export async function POST(request: NextRequest) {
  try {
    const gate = await garantirNivelFinanceiro(request, 'edit');
    if (!gate.ok) return gate.error;

    const body = await corpoJson(request);
    const tipo = texto(body.tipo);
    if (tipo !== 'boleto' && tipo !== 'pix') return finFail("tipo deve ser 'boleto' ou 'pix'", 400);

    const cobranca = await gerarCobranca(
      {
        faturaId: String((body.faturaId ?? body.fatura_id) || ''),
        contaBancariaId: String((body.contaBancariaId ?? body.conta_bancaria_id) || ''),
        tipo,
        vencimento: texto(body.vencimento),
        valor: body.valor != null ? Number(body.valor) : undefined,
      },
      await atorDeUserId(gate.user.userId),
    );
    return finOk(cobranca, 201);
  } catch (e) {
    return finErro(e);
  }
}
