import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { garantirNivelFinanceiro } from '@/lib/financeiro/financeiro-auth';
import { finErro, finFail, finOk, corpoJson } from '../../../_lib/http';

export const dynamic = 'force-dynamic';

/**
 * PUT /api/financeiro/nfse/municipios/[codigo_ibge] — edição do registry de
 * municípios pelo admin (§7.2 MunicipiosTab): provider_sugerido, wsdl_url e
 * ambiente_urls. Gate admin. Seed do IBGE nunca sobrescreve estes campos.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ codigo_ibge: string }> },
) {
  try {
    const gate = await garantirNivelFinanceiro(request, 'admin');
    if (!gate.ok) return gate.error;

    const { codigo_ibge } = await params;
    const body = await corpoJson(request);
    const updates: Record<string, unknown> = { atualizado_em: new Date().toISOString() };

    if ('provider_sugerido' in body) {
      const p = body.provider_sugerido;
      if (p !== null && !['abrasf202', 'abrasf204', 'nacional', 'proprietario'].includes(String(p))) {
        return finFail('provider_sugerido inválido', 400);
      }
      updates.provider_sugerido = p === null ? null : String(p);
    }
    if ('wsdl_url' in body) {
      const u = body.wsdl_url;
      updates.wsdl_url = u === null || u === '' ? null : String(u);
    }
    if ('ambiente_urls' in body) {
      updates.ambiente_urls = body.ambiente_urls ?? null;
    }

    const { data, error } = await supabaseAdmin
      .from('fin_municipios')
      .update(updates)
      .eq('codigo_ibge', codigo_ibge)
      .select('*')
      .maybeSingle();
    if (error) return finFail(error.message, 500);
    if (!data) return finFail('Município não encontrado', 404);
    return finOk(data);
  } catch (e) {
    return finErro(e);
  }
}
