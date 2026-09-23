import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAllCredentials } from '@/lib/secure-credentials';
import { garantirNivelFinanceiro } from '@/lib/financeiro/financeiro-auth';
import { finErro, finFail, finOk, corpoJson, texto } from '../../../_lib/http';
import type { FinNfseProviderKey } from '@/types/financeiro';

export const dynamic = 'force-dynamic';

const PROVIDERS: FinNfseProviderKey[] = ['abrasf202', 'abrasf204', 'nacional', 'proprietario'];

/**
 * GET /api/financeiro/nfse/config/[id] — registro + `preenchidos`
 * (quais credenciais fin_nfse_<id>_* existem em app_secrets; VALORES NUNCA voltam).
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
      .from('fin_nfse_config')
      .select('*, municipio:fin_municipios(codigo_ibge, nome, uf, provider_sugerido, wsdl_url, ambiente_urls)')
      .eq('id', id)
      .maybeSingle();
    if (error) return finFail(error.message, 500);
    if (!data) return finFail('Configuração NFS-e não encontrada', 404);

    const prefixo = `fin_nfse_${id}_`;
    const todas = await getAllCredentials();
    const preenchidos: Record<string, boolean> = {};
    for (const chave of Object.keys(todas)) {
      if (chave.startsWith(prefixo)) preenchidos[chave.slice(prefixo.length)] = true;
    }

    const { certificado_path: _removido, ...semPath } = data as Record<string, unknown>;
    void _removido; // caminho do .pfx não é exposto em resposta (review P2)
    return finOk({ ...semPath, preenchidos });
  } catch (e) {
    return finErro(e);
  }
}

/** PUT /api/financeiro/nfse/config/[id] — campos + config JSONB (gate edit). */
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
    if ('provider_key' in body || 'providerKey' in body) {
      const p = texto(body.provider_key ?? body.providerKey) as FinNfseProviderKey | undefined;
      if (!p || !PROVIDERS.includes(p)) return finFail('provider_key inválido', 400);
      updates.provider_key = p;
    }
    if ('municipio_id' in body || 'municipioId' in body) {
      const m = texto(body.municipio_id ?? body.municipioId);
      if (!m) return finFail('municipio_id não pode ser vazio', 400);
      updates.municipio_id = m;
    }
    for (const campo of ['inscricao_municipal', 'regime_especial'] as const) {
      if (campo in body) updates[campo] = texto(body[campo]) || null;
    }
    if ('optante_simples' in body) updates.optante_simples = body.optante_simples === true;
    if ('incentivo_fiscal' in body) updates.incentivo_fiscal = body.incentivo_fiscal === true;
    if ('iss_retido_padrao' in body) updates.iss_retido_padrao = body.iss_retido_padrao === true;
    if ('aliquota_iss' in body) {
      if (body.aliquota_iss == null) updates.aliquota_iss = null;
      else {
        const aliquota = Number(body.aliquota_iss);
        if (!Number.isFinite(aliquota) || aliquota < 0 || aliquota > 100) {
          return finFail('aliquota_iss deve estar entre 0 e 100', 400);
        }
        updates.aliquota_iss = aliquota;
      }
    }
    if ('config' in body) {
      if (body.config != null && (typeof body.config !== 'object' || Array.isArray(body.config))) {
        return finFail('config deve ser objeto JSONB', 400);
      }
      updates.config = body.config ?? {};
    }
    // Troca de provider limpa config específica do anterior (review P2) —
    // preserva apenas campos agnósticos (ex.: codigo_lc116_padrao, ambiente).
    if (updates.provider_key) {
      const { data: atual } = await supabaseAdmin
        .from('fin_nfse_config')
        .select('provider_key, config')
        .eq('id', id)
        .maybeSingle();
      const atualRow = atual as { provider_key: string; config: Record<string, unknown> } | null;
      if (atualRow && atualRow.provider_key !== updates.provider_key) {
        if (!('config' in updates)) {
          const agnostico: Record<string, unknown> = {};
          for (const chave of ['codigo_lc116_padrao', 'ambiente']) {
            if (atualRow.config && chave in atualRow.config) agnostico[chave] = atualRow.config[chave];
          }
          updates.config = agnostico;
        }
      }
    }
    if ('rps_serie' in body) updates.rps_serie = texto(body.rps_serie) || '1';
    if ('is_active' in body) updates.is_active = body.is_active === true;

    const { data, error } = await supabaseAdmin
      .from('fin_nfse_config')
      .update(updates)
      .eq('id', id)
      .select('*, municipio:fin_municipios(codigo_ibge, nome, uf)')
      .maybeSingle();
    if (error) return finFail(error.message, 500);
    if (!data) return finFail('Configuração NFS-e não encontrada', 404);
    return finOk(data);
  } catch (e) {
    return finErro(e);
  }
}

/** DELETE /api/financeiro/nfse/config/[id] — soft-delete (gate edit). */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const gate = await garantirNivelFinanceiro(request, 'edit');
    if (!gate.ok) return gate.error;
    const { id } = await params;
    const { error } = await supabaseAdmin
      .from('fin_nfse_config')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) return finFail(error.message, 500);
    return finOk({ ok: true });
  } catch (e) {
    return finErro(e);
  }
}
