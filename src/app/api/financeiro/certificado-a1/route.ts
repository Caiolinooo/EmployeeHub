import { NextRequest } from 'next/server';
import { garantirNivelFinanceiro } from '@/lib/financeiro/financeiro-auth';
import { finErro, finFail, finOk } from '../../_lib/http';
import { CertificadoA1Error, obterMetaCertificadoA1 } from '@/lib/certificado-a1';

export const dynamic = 'force-dynamic';

/**
 * GET /api/financeiro/certificado-a1
 * Metadados do A1 único da empresa (e-Social). Sem senha, sem bytes.
 */
export async function GET(request: NextRequest) {
  try {
    const gate = await garantirNivelFinanceiro(request, 'view');
    if (!gate.ok) return gate.error;
    const meta = await obterMetaCertificadoA1();
    return finOk(meta);
  } catch (e) {
    if (e instanceof CertificadoA1Error) return finFail(e.message, 404);
    return finErro(e);
  }
}
