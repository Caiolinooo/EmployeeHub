import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAllCredentials } from '@/lib/secure-credentials';
import { garantirNivelFinanceiro } from '@/lib/financeiro/financeiro-auth';
import { getBankAdapter } from '@/lib/financeiro/banks/registry';
import { finErro, finFail, finOk, corpoJson, texto, paginacao } from '../../_lib/http';
import type { FinIntegracaoBanco } from '@/types/financeiro';

export const dynamic = 'force-dynamic';

/**
 * GET /api/financeiro/bancos/integracoes — lista com `preenchidos`
 * (quais credenciais existem em app_secrets — VALORES NUNCA voltam, §2.3).
 */
export async function GET(request: NextRequest) {
  try {
    const gate = await garantirNivelFinanceiro(request, 'view');
    if (!gate.ok) return gate.error;

    const { searchParams } = new URL(request.url);
    const { from, to } = paginacao(request.url);
    let query = supabaseAdmin
      .from('fin_integracoes_banco')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: true })
      .range(from, to);
    const adapterKey = searchParams.get('adapterKey');
    if (adapterKey) query = query.eq('adapter_key', adapterKey);

    const { data, error, count } = await query;
    if (error) return finFail(error.message, 500);
    const integracoes = (data || []) as FinIntegracaoBanco[];

    const todas = await getAllCredentials();
    const itens = integracoes.map((i) => {
      let schema: { key: string }[] = [];
      try {
        schema = getBankAdapter(i.adapter_key).meta.credentialSchema;
      } catch {
        schema = [];
      }
      const preenchidos: Record<string, boolean> = {};
      for (const campo of schema) {
        preenchidos[campo.key] = !!todas[`fin_banco_${i.id}_${campo.key}`];
      }
      preenchidos.pfx_senha = !!todas[`fin_banco_${i.id}_pfx_senha`];
      const { certificado_path, ...semPath } = i as FinIntegracaoBanco & { certificado_path?: string };
      void certificado_path; // caminho do .pfx não é exposto em resposta (review P2)
      return { ...semPath, preenchidos };
    });

    return finOk({
      items: itens,
      total: count || 0,
      totalPages: Math.max(1, Math.ceil((count || 0) / Math.max(1, to - from + 1))),
    });
  } catch (e) {
    return finErro(e);
  }
}

/** POST /api/financeiro/bancos/integracoes {adapterKey, apelido, ambiente} (gate admin). */
export async function POST(request: NextRequest) {
  try {
    const gate = await garantirNivelFinanceiro(request, 'admin');
    if (!gate.ok) return gate.error;

    const body = await corpoJson(request);
    const adapterKey = texto(body.adapterKey ?? body.adapter_key);
    const apelido = texto(body.apelido);
    const ambiente = texto(body.ambiente) || 'sandbox';
    if (!adapterKey || !apelido) return finFail('adapterKey e apelido são obrigatórios', 400);
    if (!['sandbox', 'producao'].includes(ambiente)) return finFail('ambiente deve ser sandbox|producao', 400);

    try {
      getBankAdapter(adapterKey);
    } catch {
      return finFail(`adapter '${adapterKey}' não registrado`, 400);
    }

    const { data, error } = await supabaseAdmin
      .from('fin_integracoes_banco')
      .insert({ adapter_key: adapterKey, apelido, ambiente, status: 'configurando' })
      .select('*')
      .single();
    if (error) return finFail(error.message, 500);
    return finOk(data, 201);
  } catch (e) {
    return finErro(e);
  }
}
