import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { setCredential } from '@/lib/secure-credentials';
import { garantirNivelFinanceiro } from '@/lib/financeiro/financeiro-auth';
import { finErro, finFail, finOk, corpoJson, texto } from '../../../../_lib/http';

export const dynamic = 'force-dynamic';

/**
 * POST /api/financeiro/nfse/config/[id]/credenciais (gate admin)
 * JSON {campo, valor} → app_secrets `fin_nfse_<id>_<campo>` (AES-256-CBC).
 * Multipart .pfx é recusado: o A1 é único da empresa (e-Social).
 * Resposta nunca devolve valores — só {ok}.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const gate = await garantirNivelFinanceiro(request, 'admin');
    if (!gate.ok) return gate.error;
    const { id } = await params;

    const { data: config } = await supabaseAdmin
      .from('fin_nfse_config')
      .select('id')
      .eq('id', id)
      .maybeSingle();
    if (!config) return finFail('Configuração NFS-e não encontrada', 404);

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      return finFail(
        'O certificado A1 é único da empresa e vive no e-Social. Cadastre ou ative em /department/e-social. NFS-e não aceita certificado paralelo.',
        409,
      );
    }

    const body = await corpoJson(request);
    const campo = texto(body.campo);
    const valor = typeof body.valor === 'string' ? body.valor : undefined;
    if (!campo || valor === undefined) return finFail('campo e valor são obrigatórios', 400);
    if (campo === 'pfx_senha') {
      return finFail('O A1 único da empresa é gerenciado em /department/e-social', 409);
    }

    await setCredential(`fin_nfse_${id}_${campo}`, valor, `Credencial NFS-e config ${id} campo ${campo}`, { encrypt: true });
    return finOk({ ok: true });
  } catch (e) {
    return finErro(e);
  }
}
