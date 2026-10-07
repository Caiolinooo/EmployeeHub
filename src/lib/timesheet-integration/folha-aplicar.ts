/**
 * Grava lines do timesheet.approved em payroll_sheet_items (origem timesheet).
 * Sem payroll_employees vinculado: resumo fica pendente, sem lançar em outro CPF.
 * Sheet approved/paid não é alterada.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  competenciaFromPeriodEnd,
  planejarItensFolha,
  type RubricaLine,
} from './folha-lancamento';
import { createSupabaseVinculoStore, resolveVinculoByExternalId } from './vinculo';

export interface AplicarFolhaInput {
  externalId: string;
  periodStart: string;
  periodEnd: string;
  lines: RubricaLine[];
}

export interface AplicarFolhaResult {
  folhaStatus: 'ok' | 'pendente';
  motivo: string | null;
  itens: number;
  avisos: string[];
}

async function gravarResumoFolha(
  db: SupabaseClient,
  input: AplicarFolhaInput,
  result: AplicarFolhaResult,
): Promise<void> {
  const { error } = await db
    .from('ts_timesheet_resumo')
    .update({
      lines: input.lines,
      folha_status: result.folhaStatus,
      folha_motivo: result.motivo,
      updated_at: new Date().toISOString(),
    })
    .eq('colaborador_id', input.externalId)
    .eq('period_start', input.periodStart)
    .eq('period_end', input.periodEnd);
  if (error) throw new Error(`ts_timesheet_resumo folha: ${error.message}`);
}

function pendente(motivo: string, avisos: string[] = []): AplicarFolhaResult {
  return { folhaStatus: 'pendente', motivo, itens: 0, avisos };
}

export async function aplicarHorasAprovadas(
  db: SupabaseClient,
  input: AplicarFolhaInput,
): Promise<AplicarFolhaResult> {
  const store = createSupabaseVinculoStore(db);
  const vinculo = await resolveVinculoByExternalId(store, input.externalId);
  if (!vinculo.payrollEmployeeId || !vinculo.payrollCompanyId || !vinculo.colaborador?.empresa_id) {
    const result = pendente(vinculo.motivo || 'sem_folha');
    await gravarResumoFolha(db, input, result);
    return result;
  }

  const competencia = competenciaFromPeriodEnd(input.periodEnd);
  if (!competencia) {
    const result = pendente('periodo_invalido');
    await gravarResumoFolha(db, input, result);
    return result;
  }

  const { data: sheets, error: sheetError } = await db
    .from('payroll_sheets')
    .select('id, status')
    .eq('company_id', vinculo.payrollCompanyId)
    .eq('reference_month', competencia.mes)
    .eq('reference_year', competencia.ano);
  if (sheetError) throw new Error(`payroll_sheets: ${sheetError.message}`);

  const lista = (sheets || []) as { id: string; status: string | null }[];
  let draft = lista.find((s) => s.status === 'draft');
  if (!draft && lista.some((s) => s.status && s.status !== 'cancelled')) {
    const result = pendente('sheet_fechada');
    await gravarResumoFolha(db, input, result);
    return result;
  }
  if (!draft) {
    const { mes, ano } = competencia;
    const periodStart = `${ano}-${String(mes).padStart(2, '0')}-01`;
    const last = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
    const periodEnd = `${ano}-${String(mes).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
    const { data: criada, error: criarError } = await db
      .from('payroll_sheets')
      .insert({
        company_id: vinculo.payrollCompanyId,
        reference_month: mes,
        reference_year: ano,
        period_start: periodStart,
        period_end: periodEnd,
        status: 'draft',
      })
      .select('id, status')
      .single();
    if (criarError || !criada) {
      throw new Error(`payroll_sheets insert: ${criarError?.message || 'sem retorno'}`);
    }
    draft = criada as { id: string; status: string | null };
  }

  const { data: mapRows, error: mapError } = await db
    .from('payroll_codes')
    .select('id, codigo_timesheet')
    .not('codigo_timesheet', 'is', null)
    .eq('is_active', true);
  if (mapError) throw new Error(`payroll_codes codigo_timesheet: ${mapError.message}`);

  const plano = planejarItensFolha(
    input.lines,
    ((mapRows || []) as { id: string; codigo_timesheet: string | null }[])
      .filter((row) => row.codigo_timesheet)
      .map((row) => ({
        tsCode: String(row.codigo_timesheet),
        payrollCodeId: row.id,
      })),
  );

  const { error: deleteError } = await db
    .from('payroll_sheet_items')
    .delete()
    .eq('sheet_id', draft.id)
    .eq('employee_id', vinculo.payrollEmployeeId)
    .eq('origem', 'timesheet');
  if (deleteError) throw new Error(`payroll_sheet_items delete: ${deleteError.message}`);

  if (plano.itens.length > 0) {
    const { error: insertError } = await db.from('payroll_sheet_items').insert(
      plano.itens.map((item) => ({
        sheet_id: draft.id,
        employee_id: vinculo.payrollEmployeeId,
        code_id: item.payrollCodeId,
        quantity: item.quantity,
        reference_value: 0,
        calculated_value: 0,
        observation: `timesheet:${item.tsCode}`,
        origem: 'timesheet',
      })),
    );
    if (insertError) throw new Error(`payroll_sheet_items insert: ${insertError.message}`);
  }

  const result: AplicarFolhaResult = {
    folhaStatus: 'ok',
    motivo: plano.avisos.length > 0 ? plano.avisos.join('; ') : null,
    itens: plano.itens.length,
    avisos: plano.avisos,
  };
  await gravarResumoFolha(db, input, result);
  return result;
}
