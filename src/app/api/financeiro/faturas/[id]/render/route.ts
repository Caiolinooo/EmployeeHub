import { NextRequest, NextResponse } from 'next/server';
import { garantirNivelFinanceiro } from '@/lib/financeiro/financeiro-auth';
import { renderFaturaHtml } from '@/lib/financeiro/invoice/render-html';
import { montarFaturaRenderInput } from '../../../_lib/render-input';
import { finErro } from '../../../_lib/http';

export const dynamic = 'force-dynamic';

/**
 * GET /api/financeiro/faturas/[id]/render?formato=html (default)
 * HTML A4 imprimível do 1_Invoice (§6) — iframe do FaturaViewer.
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
    const formato = (searchParams.get('formato') || 'html').toLowerCase();
    if (formato !== 'html') {
      return NextResponse.json(
        { success: false, error: 'formato inválido (use /pdf ou /xlsx)' },
        { status: 400 },
      );
    }
    const input = await montarFaturaRenderInput(id);
    const html = renderFaturaHtml(input);
    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return finErro(e);
  }
}
