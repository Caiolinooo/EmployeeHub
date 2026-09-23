import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { garantirNivelFinanceiro } from '@/lib/financeiro/financeiro-auth';
import { finErro, finFail, finOk } from '../../../_lib/http';
import type { FinNfseEmissao } from '@/types/financeiro';

export const dynamic = 'force-dynamic';

/**
 * GET /api/financeiro/nfse/emissoes/[id]?xml=1 — emissão; XMLs só com
 * `?xml=1` E nível edit (§6). Nunca devolve credenciais.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const gate = await garantirNivelFinanceiro(request, 'view');
    if (!gate.ok) return gate.error;
    const { id } = await params;

    const { searchParams } = new URL(request.url);
    const querXml = searchParams.get('xml') === '1';
    let podeXml = false;
    if (querXml) {
      const gateXml = await garantirNivelFinanceiro(request, 'edit');
      podeXml = gateXml.ok;
      if (!gateXml.ok) return gateXml.error;
    }

    const { data, error } = await supabaseAdmin
      .from('fin_nfse_emissoes')
      .select('*, fatura:fin_faturas(id, numero, ano, valor_total, status)')
      .eq('id', id)
      .maybeSingle();
    if (error) return finFail(error.message, 500);
    if (!data) return finFail('Emissão não encontrada', 404);
    const emissao = data as FinNfseEmissao & { fatura?: unknown };

    if (!podeXml) {
      const semXml = { ...emissao };
      delete semXml.xml_rps;
      delete semXml.xml_nfse;
      delete semXml.xml_cancelamento;
      return finOk(semXml);
    }
    return finOk(emissao);
  } catch (e) {
    return finErro(e);
  }
}
