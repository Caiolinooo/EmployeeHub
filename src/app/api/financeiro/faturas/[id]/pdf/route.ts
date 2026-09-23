import { NextRequest, NextResponse } from 'next/server';
import { garantirNivelFinanceiro } from '@/lib/financeiro/financeiro-auth';
import { renderFaturaPdf } from '@/lib/financeiro/invoice/render-pdf';
import { montarFaturaRenderInput } from '../../../_lib/render-input';
import { finErro } from '../../../_lib/http';

export const dynamic = 'force-dynamic';

/** GET /api/financeiro/faturas/[id]/pdf — application/pdf (stream, §6). */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const gate = await garantirNivelFinanceiro(request, 'view');
    if (!gate.ok) return gate.error;
    const { id } = await params;
    const input = await montarFaturaRenderInput(id);
    const pdf = await renderFaturaPdf(input);
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="fatura-${input.fatura.numero}-${input.fatura.ano}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return finErro(e);
  }
}
