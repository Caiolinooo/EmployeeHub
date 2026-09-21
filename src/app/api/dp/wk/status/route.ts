import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { garantirNivelPayroll } from '@/lib/payroll/payroll-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dp/wk/status
 * Último evento de auditoria wk_sync (payroll_audit_log) + contagens de itens
 * por origem ('wk' | 'gt' | 'manual') das folhas mais recentes.
 * Query: ?companyId=&limit= (folhas por página, máx 24).
 */

interface NovosValoresWkSync {
  fonte?: string;
  competencia?: { mes?: number; ano?: number };
  employees_upsertados?: number;
  itens_criados?: number;
  avisos?: string[];
  por?: string | null;
}

export async function GET(request: NextRequest) {
  const gate = await garantirNivelPayroll(request, 'view');
  if (!gate.ok) return gate.error;

  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const limiteSheets = Math.min(Math.max(Number(searchParams.get('limit')) || 24, 1), 24);

    // Último evento wk_sync (qualquer sheet — a UI mostra "última sincronização").
    const { data: eventos, error: erroEvento } = await supabaseAdmin
      .from('payroll_audit_log')
      .select('record_id, changed_at, changed_by, new_values')
      .contains('new_values', { origem_evento: 'wk_sync' })
      .order('changed_at', { ascending: false })
      .limit(1);
    if (erroEvento) throw new Error(`Falha ao ler payroll_audit_log: ${erroEvento.message}`);

    let ultimoEvento: Record<string, unknown> | null = null;
    const evento = (eventos || [])[0] as { record_id: string; changed_at: string; changed_by: string | null; new_values: NovosValoresWkSync } | undefined;
    if (evento) {
      const novos = evento.new_values || {};
      ultimoEvento = {
        em: evento.changed_at,
        recordId: evento.record_id,
        fonte: novos.fonte ?? null,
        competencia: novos.competencia ?? null,
        employeesUpsertados: novos.employees_upsertados ?? 0,
        itensCriados: novos.itens_criados ?? 0,
        avisos: Array.isArray(novos.avisos) ? novos.avisos : [],
        por: novos.por ?? evento.changed_by ?? null,
      };
    }

    // Folhas recentes + contagens por origem.
    let querySheets = supabaseAdmin
      .from('payroll_sheets')
      .select('id, company_id, department_id, reference_month, reference_year, status, updated_at')
      .order('reference_year', { ascending: false })
      .order('reference_month', { ascending: false })
      .limit(limiteSheets);
    if (companyId) querySheets = querySheets.eq('company_id', companyId);

    const { data: sheets, error: erroSheets } = await querySheets;
    if (erroSheets) throw new Error(`Falha ao ler payroll_sheets: ${erroSheets.message}`);

    const folhas = (sheets || []) as Array<Record<string, unknown>>;
    const contagens = new Map<string, { wk: number; gt: number; manual: number }>();
    if (folhas.length > 0) {
      const { data: itens, error: erroItens } = await supabaseAdmin
        .from('payroll_sheet_items')
        .select('sheet_id, origem')
        .in('sheet_id', folhas.map((s) => String(s.id)));
      if (erroItens) throw new Error(`Falha ao contar payroll_sheet_items: ${erroItens.message}`);

      for (const item of (itens || []) as Array<{ sheet_id: string; origem: string | null }>) {
        let contagem = contagens.get(item.sheet_id);
        if (!contagem) {
          contagem = { wk: 0, gt: 0, manual: 0 };
          contagens.set(item.sheet_id, contagem);
        }
        if (item.origem === 'wk') contagem.wk += 1;
        else if (item.origem === 'gt') contagem.gt += 1;
        else contagem.manual += 1;
      }
    }

    const competencias = folhas.map((s) => {
      const contagem = contagens.get(String(s.id)) || { wk: 0, gt: 0, manual: 0 };
      return {
        sheetId: s.id,
        companyId: s.company_id,
        departmentId: s.department_id ?? null,
        mes: s.reference_month,
        ano: s.reference_year,
        status: s.status,
        itensWk: contagem.wk,
        itensGt: contagem.gt,
        itensManual: contagem.manual,
        atualizadoEm: s.updated_at,
      };
    });

    return NextResponse.json({ success: true, data: { ultimoEvento, competencias } });
  } catch (erro) {
    console.error('[dp/wk/status] erro:', erro);
    return NextResponse.json(
      { success: false, error: erro instanceof Error ? erro.message : 'Erro ao consultar status WK' },
      { status: 500 },
    );
  }
}
