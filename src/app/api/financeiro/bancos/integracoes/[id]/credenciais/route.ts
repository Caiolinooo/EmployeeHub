import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { setCredential } from '@/lib/secure-credentials';
import { garantirNivelFinanceiro } from '@/lib/financeiro/financeiro-auth';
import { finErro, finFail, finOk, corpoJson, texto } from '../../../../_lib/http';

export const dynamic = 'force-dynamic';

/**
 * POST /api/financeiro/bancos/integracoes/[id]/credenciais {campo, valor}
 * (gate admin) — grava em app_secrets `fin_banco_<id>_<campo>` (AES-256-CBC).
 * A resposta devolve só {ok, campo, preenchido: true} — valor NUNCA volta.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const gate = await garantirNivelFinanceiro(request, 'admin');
    if (!gate.ok) return gate.error;
    const { id } = await params;

    const { data: integ } = await supabaseAdmin
      .from('fin_integracoes_banco')
      .select('id')
      .eq('id', id)
      .maybeSingle();
    if (!integ) return finFail('Integração não encontrada', 404);

    const body = await corpoJson(request);
    const campo = texto(body.campo);
    const valor = typeof body.valor === 'string' ? body.valor : undefined;
    if (!campo || valor === undefined) return finFail('campo e valor são obrigatórios', 400);
    if (campo === 'pfx_senha') {
      return finFail('use /certificados (multipart) para gravar o .pfx e a senha', 400);
    }

    await setCredential(`fin_banco_${id}_${campo}`, valor, `Credencial banco integração ${id} campo ${campo}`, { encrypt: true });
    return finOk({ ok: true, campo, preenchido: true });
  } catch (e) {
    return finErro(e);
  }
}
