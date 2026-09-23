import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { garantirNivelFinanceiro } from '@/lib/financeiro/financeiro-auth';
import { finErro, finFail, finOk, corpoJson, texto, paginacao } from '../../_lib/http';
import type { FinNfseProviderKey } from '@/types/financeiro';

export const dynamic = 'force-dynamic';

const PROVIDERS: FinNfseProviderKey[] = ['abrasf202', 'abrasf204', 'nacional', 'proprietario'];

/**
 * GET /api/financeiro/nfse/config?empresaId= — lista com município.
 * Nenhum segredo volta (valores de credencial vivem só em app_secrets).
 */
export async function GET(request: NextRequest) {
  try {
    const gate = await garantirNivelFinanceiro(request, 'view');
    if (!gate.ok) return gate.error;

    const { searchParams } = new URL(request.url);
    const { from, to } = paginacao(request.url);
    let query = supabaseAdmin
      .from('fin_nfse_config')
      .select('*, municipio:fin_municipios(codigo_ibge, nome, uf, provider_sugerido)')
      .order('created_at', { ascending: true })
      .range(from, to);
    const empresaId = searchParams.get('empresaId');
    if (empresaId) query = query.eq('empresa_id', empresaId);

    const { data, error } = await query;
    if (error) return finFail(error.message, 500);
    // caminho do .pfx não é exposto em resposta (review P2)
    const itens = (data || []).map((row) => {
      const { certificado_path: _removido, ...semPath } = row as Record<string, unknown>;
      void _removido;
      return semPath;
    });
    return finOk(itens);
  } catch (e) {
    return finErro(e);
  }
}

/**
 * POST /api/financeiro/nfse/config — cria config por empresa+município
 * (gate edit). UNIQUE (empresa_id, municipio_id) → 409.
 */
export async function POST(request: NextRequest) {
  try {
    const gate = await garantirNivelFinanceiro(request, 'edit');
    if (!gate.ok) return gate.error;

    const body = await corpoJson(request);
    const empresaId = texto(body.empresa_id ?? body.empresaId);
    const municipioId = texto(body.municipio_id ?? body.municipioId);
    const providerKey = texto(body.provider_key ?? body.providerKey) as FinNfseProviderKey | undefined;
    if (!empresaId || !municipioId || !providerKey || !PROVIDERS.includes(providerKey)) {
      return finFail('empresa_id, municipio_id e provider_key válido são obrigatórios', 400);
    }

    const { data: existente } = await supabaseAdmin
      .from('fin_nfse_config')
      .select('id')
      .eq('empresa_id', empresaId)
      .eq('municipio_id', municipioId)
      .maybeSingle();
    if (existente) return finFail('Já existe config NFS-e para esta empresa+município', 409);

    const registro: Record<string, unknown> = {
      empresa_id: empresaId,
      municipio_id: municipioId,
      provider_key: providerKey,
      optante_simples: body.optante_simples === true,
      incentivo_fiscal: body.incentivo_fiscal === true,
      iss_retido_padrao: body.iss_retido_padrao === true,
      config: (body.config ?? {}) as Record<string, unknown>,
      rps_serie: texto(body.rps_serie) || '1',
      is_active: body.is_active !== false,
    };
    for (const campo of ['inscricao_municipal', 'regime_especial'] as const) {
      if (texto(body[campo])) registro[campo] = texto(body[campo]);
    }
    if (body.aliquota_iss != null) {
      const aliquota = Number(body.aliquota_iss);
      if (!Number.isFinite(aliquota) || aliquota < 0 || aliquota > 100) {
        return finFail('aliquota_iss deve estar entre 0 e 100', 400);
      }
      registro.aliquota_iss = aliquota;
    }

    const { data, error } = await supabaseAdmin
      .from('fin_nfse_config')
      .insert(registro)
      .select('*, municipio:fin_municipios(codigo_ibge, nome, uf)')
      .single();
    if (error) return finFail(error.message, 500);
    return finOk(data, 201);
  } catch (e) {
    return finErro(e);
  }
}
