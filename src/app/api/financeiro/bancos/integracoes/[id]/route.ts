import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAllCredentials } from '@/lib/secure-credentials';
import { garantirNivelFinanceiro } from '@/lib/financeiro/financeiro-auth';
import { getBankAdapter } from '@/lib/financeiro/banks/registry';
import { finErro, finFail, finOk, corpoJson, texto } from '../../../_lib/http';

export const dynamic = 'force-dynamic';

/**
 * GET /api/financeiro/bancos/integracoes/[id] — registro + credentialSchema do
 * adapter + `preenchidos` (boolean por campo; VALORES NUNCA voltam, §2.3).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const gate = await garantirNivelFinanceiro(request, 'view');
    if (!gate.ok) return gate.error;
    const { id } = await params;

    const { data, error } = await supabaseAdmin
      .from('fin_integracoes_banco')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) return finFail(error.message, 500);
    if (!data) return finFail('Integração não encontrada', 404);
    const integ = data as Record<string, unknown> & { adapter_key: string };

    let schema: unknown[] = [];
    let certificados: unknown[] = [];
    try {
      const meta = getBankAdapter(integ.adapter_key).meta;
      schema = meta.credentialSchema;
      certificados = meta.certificados;
    } catch {
      // adapter removido do registry — integração fica órfã mas continua listável
    }

    const todas = await getAllCredentials();
    const preenchidos: Record<string, boolean> = {};
    for (const campo of schema as { key: string }[]) {
      preenchidos[campo.key] = !!todas[`fin_banco_${id}_${campo.key}`];
    }
    preenchidos.pfx_senha = !!todas[`fin_banco_${id}_pfx_senha`];

    const { certificado_path: _removido, ...integSemPath } = integ;
    void _removido; // caminho do .pfx não é exposto em resposta (review P2)
    return finOk({ ...integSemPath, credentialSchema: schema, certificados, preenchidos });
  } catch (e) {
    return finErro(e);
  }
}

/** PUT — apelido/ambiente/status/is_active (gate admin). */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const gate = await garantirNivelFinanceiro(request, 'admin');
    if (!gate.ok) return gate.error;
    const { id } = await params;
    const body = await corpoJson(request);

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if ('apelido' in body) {
      const apelido = texto(body.apelido);
      if (!apelido) return finFail('apelido não pode ser vazio', 400);
      updates.apelido = apelido;
    }
    if ('ambiente' in body) {
      const ambiente = texto(body.ambiente);
      if (!ambiente || !['sandbox', 'producao'].includes(ambiente)) {
        return finFail('ambiente deve ser sandbox|producao', 400);
      }
      updates.ambiente = ambiente;
    }
    if ('status' in body) {
      const status = texto(body.status);
      if (!status || !['configurando', 'ativa', 'erro', 'desativada'].includes(status)) {
        return finFail('status inválido', 400);
      }
      updates.status = status;
    }
    if ('is_active' in body) updates.is_active = body.is_active === true;

    const { data, error } = await supabaseAdmin
      .from('fin_integracoes_banco')
      .update(updates)
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) return finFail(error.message, 500);
    if (!data) return finFail('Integração não encontrada', 404);
    return finOk(data);
  } catch (e) {
    return finErro(e);
  }
}

/** DELETE — soft-delete (is_active=false, status=desativada) (gate admin). */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const gate = await garantirNivelFinanceiro(request, 'admin');
    if (!gate.ok) return gate.error;
    const { id } = await params;
    const { error } = await supabaseAdmin
      .from('fin_integracoes_banco')
      .update({ is_active: false, status: 'desativada', updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) return finFail(error.message, 500);
    return finOk({ ok: true });
  } catch (e) {
    return finErro(e);
  }
}
