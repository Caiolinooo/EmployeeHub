import { NextRequest, NextResponse } from 'next/server';
import { garantirNivelPayroll } from '@/lib/payroll/payroll-auth';
import { ErroFolhaBloqueada, ErroValidacaoFontes } from '@/lib/payroll/fontes-dp';
import { gerarRelatorioOperacional } from '@/lib/payroll/relatorio-operacional';

export const dynamic = 'force-dynamic';

/**
 * POST /api/dp/folha/calcular
 * Calcula a competência com os dados que o portal já tem (embarques, dobras,
 * folgas, férias) e devolve o relatório por colaborador e por centro de custo.
 * Corpo: { companyId, competencia: { mes, ano }, departmentId? }
 */
export async function POST(request: NextRequest) {
  const gate = await garantirNivelPayroll(request, 'edit');
  if (!gate.ok) return gate.error;

  try {
    const body = (await request.json()) as {
      competencia?: { mes?: unknown; ano?: unknown };
      companyId?: unknown;
      departmentId?: unknown;
    };
    const competencia = {
      mes: Number(body?.competencia?.mes),
      ano: Number(body?.competencia?.ano),
    };
    const companyId = typeof body?.companyId === 'string' ? body.companyId.trim() : '';
    if (!competencia.mes || !competencia.ano || !companyId) {
      return NextResponse.json(
        { success: false, error: 'competencia { mes, ano } e companyId são obrigatórios' },
        { status: 400 },
      );
    }

    const relatorio = await gerarRelatorioOperacional({
      competencia,
      companyId,
      departmentId: typeof body.departmentId === 'string' && body.departmentId ? body.departmentId : null,
      usuarioId: gate.user.userId,
    });

    return NextResponse.json({ success: true, data: relatorio });
  } catch (error) {
    if (error instanceof ErroFolhaBloqueada) {
      return NextResponse.json(
        { success: false, error: error.message, data: { sheetId: error.sheetId, status: error.statusFolha } },
        { status: 409 },
      );
    }
    if (error instanceof ErroValidacaoFontes) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    console.error('[dp/folha/calcular] erro:', error);
    const mensagem = error instanceof Error ? error.message : 'Erro interno do servidor';
    return NextResponse.json({ success: false, error: mensagem }, { status: 500 });
  }
}
