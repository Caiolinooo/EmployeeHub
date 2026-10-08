import { NextRequest, NextResponse } from 'next/server';
import { garantirNivelPayroll } from '@/lib/payroll/payroll-auth';
import { renderContracheque } from '@/lib/payroll/contracheque';
import { renderContrachequePdf } from '@/lib/payroll/contracheque-pdf';
import { carregarDadosContracheque } from '@/lib/payroll/contracheque-self';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dp/folha/contracheque?sheetId=...&employeeId=...
 * HTML imprimível. `?pdf=1` devolve o PDF. Mesmo payload de /api/contracheque.
 * Gate: nível folha 'view'. Sem resumo calculado → 404.
 */
export async function GET(request: NextRequest) {
  const gate = await garantirNivelPayroll(request, 'view', ['contracheque.view_all']);
  if (!gate.ok) return gate.error;

  const { searchParams } = new URL(request.url);
  const sheetId = searchParams.get('sheetId');
  const employeeId = searchParams.get('employeeId');
  if (!sheetId || !employeeId) {
    return NextResponse.json(
      { success: false, error: 'Informe sheetId e employeeId.' },
      { status: 400 },
    );
  }

  try {
    const dados = await carregarDadosContracheque(sheetId, employeeId);
    if (!dados) {
      return NextResponse.json(
        { success: false, error: 'Sem resumo calculado para este funcionário nesta sheet — rode o cálculo antes.' },
        { status: 404 },
      );
    }

    if (searchParams.get('pdf') === '1') {
      const pdf = await renderContrachequePdf(dados);
      const nome = `contracheque-${dados.competencia.replace('/', '-')}.pdf`;
      return new NextResponse(new Uint8Array(pdf), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${nome}"`,
        },
      });
    }

    return new NextResponse(renderContracheque(dados), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro interno';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
