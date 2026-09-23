import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { garantirNivelFinanceiro } from '@/lib/financeiro/financeiro-auth';
import { emitirNfse } from '@/lib/financeiro/service';
import { atorDeUserId } from '@/lib/financeiro/eventos';
import { finErro, finFail, finOk, corpoJson, texto, paginacao } from '../../_lib/http';

export const dynamic = 'force-dynamic';

/**
 * GET /api/financeiro/nfse/emissoes?faturaId=&status=&page=&limit=
 * Lista de emissões com dados da fatura para a tabela da aba NFS-e (§7.1).
 */
export async function GET(request: NextRequest) {
  try {
    const gate = await garantirNivelFinanceiro(request, 'view');
    if (!gate.ok) return gate.error;

    const { searchParams } = new URL(request.url);
    const { page, limit, from, to } = paginacao(request.url);

    let query = supabaseAdmin
      .from('fin_nfse_emissoes')
      .select('*, fatura:fin_faturas(id, numero, ano, valor_total, status)', { count: 'exact' })
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
 * POST /api/financeiro/nfse/emissoes {faturaId} — §5.2/§6: exige fatura
 * `emitida` + config ativa; moeda ≠ BRL → 409 fatura_moeda_invalida;
 * RPS transacional; estados com eventos.
 */
export async function POST(request: NextRequest) {
  try {
    const gate = await garantirNivelFinanceiro(request, 'edit');
    if (!gate.ok) return gate.error;

    const body = await corpoJson(request);
    const faturaId = texto(body.faturaId ?? body.fatura_id);
    if (!faturaId) return finFail('faturaId é obrigatório', 400);

    const emissao = await emitirNfse(faturaId, await atorDeUserId(gate.user.userId));
    return finOk(emissao, 201);
  } catch (e) {
    return finErro(e);
  }
}
