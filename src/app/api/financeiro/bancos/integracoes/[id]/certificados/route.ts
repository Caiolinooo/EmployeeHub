import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { setCredential } from '@/lib/secure-credentials';
import { garantirNivelFinanceiro } from '@/lib/financeiro/financeiro-auth';
import { finErro, finFail, finOk } from '../../../../_lib/http';

export const dynamic = 'force-dynamic';

const BUCKET_CERTIFICADOS = 'financeiro-certificados';

/**
 * POST /api/financeiro/bancos/integracoes/[id]/certificados (gate admin)
 * Multipart `.pfx` + `senha` → bucket privado financeiro-certificados +
 * fin_integracoes_banco (path/fingerprint/validade) + senha em app_secrets
 * (`fin_banco_<id>_pfx_senha`). Resposta: {fingerprint, validade} — sem segredo.
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

    const form = await request.formData();
    const arquivo = form.get('arquivo') ?? form.get('file');
    const senhaField = form.get('senha') ?? form.get('password');
    const senha = typeof senhaField === 'string' ? senhaField.trim() : '';
    if (!(arquivo instanceof File)) return finFail('arquivo .pfx é obrigatório', 400);
    if (!senha) return finFail('senha do certificado é obrigatória', 400);
    if (!/\.pfx$/i.test(arquivo.name)) return finFail('apenas arquivos .pfx são aceitos', 400);

    const buf = Buffer.from(await arquivo.arrayBuffer());
    const storagePath = `bancos/${id}/${Date.now()}-${arquivo.name.replace(/[^\w.\-]/g, '_')}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from(BUCKET_CERTIFICADOS)
      .upload(storagePath, buf, { upsert: true, contentType: 'application/x-pkcs12' });
    if (upErr) return finFail(`Falha no upload do certificado: ${upErr.message}`, 500);

    const fingerprint = crypto.createHash('sha256').update(buf).digest('hex');
    // Sem OpenSSL nativo no runtime, a data exata (notAfter) do PKCS#12 é
    // obtida na primeira testagem do adapter; aqui gravamos apenas o
    // fingerprint SHA-256 definitivo (validade → null).
    const validade: string | null = null;

    const updates: Record<string, unknown> = {
      certificado_path: storagePath,
      certificado_fingerprint: fingerprint,
      updated_at: new Date().toISOString(),
    };
    if (validade) updates.certificado_validade = validade;
    const { error: updErr } = await supabaseAdmin
      .from('fin_integracoes_banco')
      .update(updates)
      .eq('id', id);
    if (updErr) return finFail(updErr.message, 500);
    await setCredential(`fin_banco_${id}_pfx_senha`, senha, `Senha do .pfx da integração ${id}`, { encrypt: true });

    return finOk({ fingerprint, validade: validade || null });
  } catch (e) {
    return finErro(e);
  }
}
