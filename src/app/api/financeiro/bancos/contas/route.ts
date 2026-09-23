import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { garantirNivelFinanceiro } from '@/lib/financeiro/financeiro-auth';
import { finErro, finFail, finOk, corpoJson, texto, paginacao } from '../../_lib/http';
import type { FinContaBancaria } from '@/types/financeiro';

export const dynamic = 'force-dynamic';

/** GET /api/financeiro/bancos/contas?empresaId= — lista (gate view). */
export async function GET(request: NextRequest) {
  try {
    const gate = await garantirNivelFinanceiro(request, 'view');
    if (!gate.ok) return gate.error;

    const { searchParams } = new URL(request.url);
    const { from, to, page, limit } = paginacao(request.url);
    let query = supabaseAdmin
      .from('fin_contas_bancarias')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: true })
      .range(from, to);
    const empresaId = searchParams.get('empresaId');
    if (empresaId) query = query.eq('empresa_id', empresaId);
    const ativo = searchParams.get('isActive');
    if (ativo === 'true' || ativo === 'false') query = query.eq('is_active', ativo === 'true');

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

/** POST /api/financeiro/bancos/contas — cria conta (gate edit). */
export async function POST(request: NextRequest) {
  try {
    const gate = await garantirNivelFinanceiro(request, 'edit');
    if (!gate.ok) return gate.error;

    const body = await corpoJson(request);
    const empresaId = texto(body.empresa_id ?? body.empresaId);
    const bancoCodigo = texto(body.banco_codigo ?? body.bancoCodigo);
    const titularNome = texto(body.titular_nome ?? body.titularNome);
    const titularDocumento = texto(body.titular_documento ?? body.titularDocumento);
    if (!empresaId || !bancoCodigo || !titularNome || !titularDocumento) {
      return finFail('empresa_id, banco_codigo, titular_nome e titular_documento são obrigatórios', 400);
    }
    const tipo = texto(body.tipo) || 'corrente';
    if (!['corrente', 'investimento', 'pagamento'].includes(tipo)) {
      return finFail('tipo inválido', 400);
    }

    const registro: Record<string, unknown> = {
      empresa_id: empresaId,
      banco_codigo: bancoCodigo,
      banco_nome: texto(body.banco_nome ?? body.bancoNome) || null,
      agencia: texto(body.agencia) || null,
      conta: texto(body.conta) || null,
      digito: texto(body.digito) || null,
      tipo,
      titular_nome: titularNome,
      titular_documento: titularDocumento,
      is_active: body.is_active !== false,
    };
    const integracaoId = texto(body.integracao_id ?? body.integracaoId);
    if (integracaoId) registro.integracao_id = integracaoId;

    const { data, error } = await supabaseAdmin
      .from('fin_contas_bancarias')
      .insert(registro)
      .select('*')
      .single();
    if (error) return finFail(error.message, 500);
    return finOk(data as FinContaBancaria, 201);
  } catch (e) {
    return finErro(e);
  }
}
