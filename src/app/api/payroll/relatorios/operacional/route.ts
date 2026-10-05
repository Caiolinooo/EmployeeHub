import { NextRequest, NextResponse } from 'next/server';
import { garantirNivelPayroll } from '@/lib/payroll/payroll-auth';
import { ErroFolhaBloqueada, ErroValidacaoFontes } from '@/lib/payroll/fontes-dp';
import { gerarRelatorioOperacional } from '@/lib/payroll/relatorio-operacional';
import {
  agregarCustosPorDepartamento,
  agregarGuias,
  totalizarCustos,
} from '@/lib/payroll/relatorios-agregacao';

export const dynamic = 'force-dynamic';

const TIPOS_RELATORIO: Record<string, true> = {
  operacional: true,
  custos: true,
  guias: true,
};

/**
 * GET /api/payroll/relatorios/operacional
 * Relatório da competência calculado a partir dos dados do portal
 * (gerarRelatorioOperacional). Params: companyId, month, year,
 * departmentId? e type=operacional|custos|guias.
 * - operacional: relatório completo (colaboradores, centros, totais);
 * - custos: agregação por centro de custo/departamento + TOTAL;
 * - guias: provisões de INSS/IRRF/FGTS da competência.
 */
export async function GET(request: NextRequest) {
  const gate = await garantirNivelPayroll(request, 'view');
  if (!gate.ok) return gate.error;

  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId')?.trim() || '';
    const mes = Number(searchParams.get('month'));
    const ano = Number(searchParams.get('year'));
    const type = searchParams.get('type') || 'operacional';
    const departmentIdParam = searchParams.get('departmentId')?.trim();

    if (!companyId || !Number.isInteger(mes) || mes < 1 || mes > 12 || !Number.isInteger(ano) || ano < 2024) {
      return NextResponse.json(
        { success: false, error: 'companyId, month (1-12) e year (>=2024) são obrigatórios' },
        { status: 400 },
      );
    }
    if (!TIPOS_RELATORIO[type]) {
      return NextResponse.json(
        { success: false, error: "type deve ser 'operacional', 'custos' ou 'guias'" },
        { status: 400 },
      );
    }

    const relatorio = await gerarRelatorioOperacional({
      competencia: { mes, ano },
      companyId,
      departmentId: departmentIdParam || null,
      usuarioId: gate.user.userId,
    });

    if (type === 'custos') {
      const departamentos = agregarCustosPorDepartamento(relatorio.colaboradores);
      return NextResponse.json({
        success: true,
        data: {
          competencia: relatorio.competencia,
          departamentos,
          totais: totalizarCustos(departamentos),
        },
      });
    }

    if (type === 'guias') {
      return NextResponse.json({
        success: true,
        data: { competencia: relatorio.competencia, ...agregarGuias(relatorio.colaboradores) },
      });
    }

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
    console.error('[payroll/relatorios/operacional] erro:', error);
    const mensagem = error instanceof Error ? error.message : 'Erro interno do servidor';
    return NextResponse.json({ success: false, error: mensagem }, { status: 500 });
  }
}
