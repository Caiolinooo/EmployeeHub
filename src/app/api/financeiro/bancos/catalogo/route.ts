import { NextRequest } from 'next/server';
import { garantirNivelFinanceiro } from '@/lib/financeiro/financeiro-auth';
import { finErro, finOk } from '../../_lib/http';
import { BANK_CATALOG } from '@/lib/financeiro/banks/registry';

export const dynamic = 'force-dynamic';

/**
 * GET /api/financeiro/bancos/catalogo — BANK_CATALOG (§3.1) para a UI admin
 * (§7.2): metas + credentialSchema. Nenhum valor de credencial (só o schema).
 */
export async function GET(request: NextRequest) {
  try {
    const gate = await garantirNivelFinanceiro(request, 'view');
    if (!gate.ok) return gate.error;
    return finOk(BANK_CATALOG);
  } catch (e) {
    return finErro(e);
  }
}
