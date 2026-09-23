import { NextRequest } from 'next/server';
import { garantirNivelFinanceiro } from '@/lib/financeiro/financeiro-auth';
import { gerarFaturaDaFolha } from '@/lib/financeiro/service';
import { atorDeUserId } from '@/lib/financeiro/eventos';
import { finErro, finOk, corpoJson } from '../../_lib/http';

export const dynamic = 'force-dynamic';

/**
 * POST /api/financeiro/faturas/gerar-da-folha {sheetId, clienteId, templateId?}
 * Agrega payroll_employee_summaries da sheet `approved|paid` (agrupamento por
 * colaborador) e cria a fatura com itens origem='folha' (§6).
 */
export async function POST(request: NextRequest) {
  try {
    const gate = await garantirNivelFinanceiro(request, 'edit');
    if (!gate.ok) return gate.error;

    const body = await corpoJson(request);
    const fatura = await gerarFaturaDaFolha(
      {
        sheetId: String(body.sheetId || body.sheet_id || ''),
        clienteId: String(body.clienteId || body.cliente_id || ''),
        templateId: body.templateId ? String(body.templateId) : undefined,
      },
      await atorDeUserId(gate.user.userId),
    );
    return finOk(fatura, 201);
  } catch (e) {
    return finErro(e);
  }
}
