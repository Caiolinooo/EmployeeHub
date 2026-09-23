import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { garantirNivelFinanceiro } from '@/lib/financeiro/financeiro-auth';
import { finErro, finFail, finOk, corpoJson, texto } from '../../../_lib/http';

export const dynamic = 'force-dynamic';

/** GET /api/financeiro/bancos/contas/[id] (gate view). */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const gate = await garantirNivelFinanceiro(request, 'view');
    if (!gate.ok) return gate.error;
    const { id } = await params;
    const { data, error } = await supabaseAdmin
      .from('fin_contas_bancarias')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) return finFail(error.message, 500);
    if (!data) return finFail('Conta bancária não encontrada', 404);
    return finOk(data);
  } catch (e) {
    return finErro(e);
  }
}

/** PUT /api/financeiro/bancos/contas/[id] — parcial (gate edit). */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const gate = await garantirNivelFinanceiro(request, 'edit');
    if (!gate.ok) return gate.error;
    const { id } = await params;
    const body = await corpoJson(request);

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const campo of ['banco_codigo', 'banco_nome', 'agencia', 'conta', 'digito'] as const) {
      if (campo in body) updates[campo] = texto(body[campo]) || (campo === 'banco_codigo' ? undefined : null);
    }
    if ('bancoCodigo' in body) updates.banco_codigo = texto(body.bancoCodigo) || undefined;
    if ('titular_nome' in body || 'titularNome' in body) updates.titular_nome = texto(body.titular_nome ?? body.titularNome);
    if ('titular_documento' in body || 'titularDocumento' in body) updates.titular_documento = texto(body.titular_documento ?? body.titularDocumento);
    if ('tipo' in body) {
      const tipo = texto(body.tipo);
      if (!tipo || !['corrente', 'investimento', 'pagamento'].includes(tipo)) {
        return finFail('tipo inválido', 400);
      }
      updates.tipo = tipo;
    }
    if ('integracao_id' in body || 'integracaoId' in body) updates.integracao_id = texto(body.integracao_id ?? body.integracaoId) || null;
    if ('is_active' in body) updates.is_active = body.is_active === true;
    if (updates.banco_codigo === undefined) delete updates.banco_codigo;

    const { data, error } = await supabaseAdmin
      .from('fin_contas_bancarias')
      .update(updates)
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) return finFail(error.message, 500);
    if (!data) return finFail('Conta bancária não encontrada', 404);
    return finOk(data);
  } catch (e) {
    return finErro(e);
  }
}

/** DELETE — soft-delete (gate edit). */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const gate = await garantirNivelFinanceiro(request, 'edit');
    if (!gate.ok) return gate.error;
    const { id } = await params;
    const { error } = await supabaseAdmin
      .from('fin_contas_bancarias')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) return finFail(error.message, 500);
    return finOk({ ok: true });
  } catch (e) {
    return finErro(e);
  }
}
