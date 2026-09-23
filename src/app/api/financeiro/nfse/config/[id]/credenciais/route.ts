import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { setCredential } from '@/lib/secure-credentials';
import { garantirNivelFinanceiro } from '@/lib/financeiro/financeiro-auth';
import { finErro, finFail, finOk, corpoJson, texto } from '../../../../_lib/http';

export const dynamic = 'force-dynamic';

const BUCKET_CERTIFICADOS = 'financeiro-certificados';

/**
 * POST /api/financeiro/nfse/config/[id]/credenciais (gate admin)
 * JSON {campo, valor} → app_secrets `fin_nfse_<id>_<campo>` (AES-256-CBC).
 * Multipart `.pfx` + `senha` → bucket privado + fin_nfse_config
 * (certificado_path/fingerprint/validade) + senha em app_secrets (`pfx_senha`).
 * Resposta nunca devolve valores — só {ok} / {fingerprint, validade}.
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

    // Upload de certificado A1 (.pfx)
    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      const arquivo = form.get('arquivo') ?? form.get('file');
      const senha = texto(form.get('senha') ?? form.get('password'));
      if (!(arquivo instanceof File)) return finFail('arquivo .pfx é obrigatório', 400);
      if (!senha) return finFail('senha do certificado é obrigatória', 400);
      if (!/\.pfx$/i.test(arquivo.name)) return finFail('apenas arquivos .pfx são aceitos', 400);

      const buf = Buffer.from(await arquivo.arrayBuffer());
      const storagePath = `nfse/${id}/${Date.now()}-${arquivo.name.replace(/[^\w.\-]/g, '_')}`;
      const { error: upErr } = await supabaseAdmin.storage
        .from(BUCKET_CERTIFICADOS)
        .upload(storagePath, buf, { upsert: true, contentType: 'application/x-pkcs12' });
      if (upErr) return finFail(`Falha no upload do certificado: ${upErr.message}`, 500);

      const fingerprint = crypto.createHash('sha256').update(buf).digest('hex');
      // Sem OpenSSL nativo no runtime, a validade real (notAfter do PKCS#12)
      // é obtida na primeira testagem do provider; fingerprint SHA-256
      // definitivo grava aqui.
      const validade: string | null = null;

      const updates: Record<string, unknown> = {
        certificado_path: storagePath,
        certificado_fingerprint: fingerprint,
        updated_at: new Date().toISOString(),
      };
      if (validade) updates.certificado_validade = validade;
      const { error: updErr } = await supabaseAdmin
        .from('fin_nfse_config')
        .update(updates)
        .eq('id', id);
      if (updErr) return finFail(updErr.message, 500);
      await setCredential(`fin_nfse_${id}_pfx_senha`, senha, `Senha do certificado A1 NFS-e config ${id}`, { encrypt: true });

      return finOk({ fingerprint, validade: validade || null });
    }

    // Credencial textual (usuário/token de webservice proprietário etc.)
    const body = await corpoJson(request);
    const campo = texto(body.campo);
    const valor = typeof body.valor === 'string' ? body.valor : undefined;
    if (!campo || valor === undefined) return finFail('campo e valor são obrigatórios', 400);
    if (campo === 'pfx_senha') return finFail('use o upload multipart de certificado para pfx_senha', 400);

    await setCredential(`fin_nfse_${id}_${campo}`, valor, `Credencial NFS-e config ${id} campo ${campo}`, { encrypt: true });
    return finOk({ ok: true });
  } catch (e) {
    return finErro(e);
  }
}
