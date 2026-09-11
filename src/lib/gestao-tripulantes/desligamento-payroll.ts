import { supabaseAdmin } from '@/lib/supabase';
import { formatCpf, normalizeCpf } from '@/lib/utils/identity';
import type { TipoRescisao, VerbaRescisaoPrevista } from './desligamento';

export interface PayrollDesligamentoInput {
  colaboradorId: string;
  nomeCompleto: string;
  cpf: string | null | undefined;
  matricula: string | null | undefined;
  salario: number | null | undefined;
  dataAdmissao: string | null | undefined;
  dataDesligamento: string;
  cargoNome: string | null | undefined;
  tipoRescisao: TipoRescisao;
  avisoPrevioDias: number | null;
  verbas: VerbaRescisaoPrevista[];
  criadoPor: string | null;
}

export interface PayrollDesligamentoResult {
  ok: boolean;
  skipped: boolean;
  sheet_id?: string;
  employee_id?: string;
  item_codes?: string[];
  warning?: string;
}

interface PayrollCodeRow {
  id: string;
  code: string;
  type: string;
}

interface PayrollEmployeeRow {
  id: string;
  company_id: string;
  department_id: string | null;
  status: string;
}

interface PayrollSheetRow {
  id: string;
  status: string;
}

function lastDayOfMonth(year: number, month: number): string {
  const d = new Date(year, month, 0);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function firstDayOfMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

function cpfLookupValues(digits: string): string[] {
  const masked = formatCpf(digits);
  return digits === masked ? [digits] : [digits, masked];
}

async function localizarOuCriarEmployee(
  input: PayrollDesligamentoInput,
): Promise<{ employee: PayrollEmployeeRow | null; warning?: string }> {
  const digits = normalizeCpf(input.cpf || '');
  if (digits.length !== 11) {
    return { employee: null, warning: 'CPF do colaborador ausente ou inválido — folha ignorada' };
  }

  const { data: existing, error: findErr } = await supabaseAdmin
    .from('payroll_employees')
    .select('id, company_id, department_id, status')
    .in('cpf', cpfLookupValues(digits))
    .limit(1)
    .maybeSingle();

  if (findErr) {
    return { employee: null, warning: findErr.message };
  }

  if (existing) {
    const { error: updErr } = await supabaseAdmin
      .from('payroll_employees')
      .update({
        status: 'terminated',
        termination_date: input.dataDesligamento,
        name: input.nomeCompleto,
        base_salary: input.salario ?? undefined,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);

    if (updErr) {
      console.warn('[desligamento/payroll] update employee:', updErr.message);
    }
    return { employee: existing as PayrollEmployeeRow };
  }

  const { data: company, error: companyErr } = await supabaseAdmin
    .from('payroll_companies')
    .select('id')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (companyErr || !company?.id) {
    return {
      employee: null,
      warning: companyErr?.message || 'Nenhuma empresa de folha ativa — folha ignorada',
    };
  }

  const registration =
    (input.matricula && String(input.matricula).trim()) || `GT-${digits.slice(-8)}`;

  const { data: created, error: createErr } = await supabaseAdmin
    .from('payroll_employees')
    .insert({
      employee_id: input.colaboradorId,
      company_id: company.id,
      registration_number: registration,
      name: input.nomeCompleto,
      cpf: formatCpf(digits),
      position: input.cargoNome || null,
      base_salary: input.salario ?? 0,
      admission_date: input.dataAdmissao || null,
      termination_date: input.dataDesligamento,
      status: 'terminated',
    })
    .select('id, company_id, department_id, status')
    .single();

  if (createErr || !created) {
    return {
      employee: null,
      warning: createErr?.message || 'Não foi possível criar o funcionário na folha',
    };
  }

  return { employee: created as PayrollEmployeeRow };
}

async function localizarOuCriarSheet(
  employee: PayrollEmployeeRow,
  input: PayrollDesligamentoInput,
): Promise<{ sheet: PayrollSheetRow | null; warning?: string }> {
  const [yearStr, monthStr] = input.dataDesligamento.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);

  let query = supabaseAdmin
    .from('payroll_sheets')
    .select('id, status')
    .eq('company_id', employee.company_id)
    .eq('reference_month', month)
    .eq('reference_year', year)
    .limit(1);

  if (employee.department_id) {
    query = query.eq('department_id', employee.department_id);
  }

  const { data: existing, error: findErr } = await query.maybeSingle();
  if (findErr) {
    return { sheet: null, warning: findErr.message };
  }

  if (existing) {
    const status = String(existing.status || '');
    if (status === 'approved' || status === 'paid' || status === 'cancelled') {
      return {
        sheet: existing as PayrollSheetRow,
        warning: `Folha do período já está ${status} — itens de rescisão não foram lançados`,
      };
    }
    return { sheet: existing as PayrollSheetRow };
  }

  const { data: created, error: createErr } = await supabaseAdmin
    .from('payroll_sheets')
    .insert({
      company_id: employee.company_id,
      department_id: employee.department_id,
      reference_month: month,
      reference_year: year,
      period_start: firstDayOfMonth(year, month),
      period_end: lastDayOfMonth(year, month),
      status: 'draft',
      total_employees: 1,
      notes: `RESCISAO:${input.colaboradorId} ${input.tipoRescisao} ${input.dataDesligamento}`,
      created_by: input.criadoPor,
    })
    .select('id, status')
    .single();

  if (createErr || !created) {
    const { data: retry } = await supabaseAdmin
      .from('payroll_sheets')
      .select('id, status')
      .eq('company_id', employee.company_id)
      .eq('reference_month', month)
      .eq('reference_year', year)
      .limit(1)
      .maybeSingle();

    if (retry) {
      const status = String(retry.status || '');
      if (status === 'approved' || status === 'paid' || status === 'cancelled') {
        return {
          sheet: retry as PayrollSheetRow,
          warning: `Folha do período já está ${status} — itens de rescisão não foram lançados`,
        };
      }
      return { sheet: retry as PayrollSheetRow };
    }

    return {
      sheet: null,
      warning: createErr?.message || 'Não foi possível criar a folha de rescisão',
    };
  }

  return { sheet: created as PayrollSheetRow };
}

async function inserirItens(
  sheetId: string,
  employeeId: string,
  input: PayrollDesligamentoInput,
  codes: PayrollCodeRow[],
): Promise<string[]> {
  const byCode = new Map(codes.map((c) => [c.code, c]));
  const inserted: string[] = [];

  for (const verba of input.verbas) {
    const codeRow = byCode.get(verba.code);
    if (!codeRow) {
      console.warn(`[desligamento/payroll] rubrica ${verba.code} ausente — item ignorado`);
      continue;
    }

    const quantity =
      verba.code === '301' && input.avisoPrevioDias && input.avisoPrevioDias > 0
        ? input.avisoPrevioDias
        : 1;

    const { error } = await supabaseAdmin.from('payroll_sheet_items').insert({
      sheet_id: sheetId,
      employee_id: employeeId,
      code_id: codeRow.id,
      quantity,
      reference_value: input.salario ?? 0,
      calculated_value: 0,
      observation: `${verba.name}: ${verba.observation} (rescisão ${input.tipoRescisao}; valor a calcular)`,
    });

    if (error) {
      console.warn(`[desligamento/payroll] item ${verba.code}:`, error.message);
      continue;
    }
    inserted.push(verba.code);
  }

  return inserted;
}

/**
 * Best-effort: nunca lança. Tabela/RLS/ausência de empresa → skipped.
 */
export async function tentarIntegrarFolhaRescisao(
  input: PayrollDesligamentoInput,
): Promise<PayrollDesligamentoResult> {
  try {
    const codesNeeded = [...new Set(input.verbas.map((v) => v.code))];
    const { data: codes, error: codesErr } = await supabaseAdmin
      .from('payroll_codes')
      .select('id, code, type')
      .in('code', codesNeeded);

    if (codesErr) {
      console.warn('[desligamento/payroll] skip:', codesErr.message);
      return { ok: false, skipped: true, warning: codesErr.message };
    }

    const found = (codes || []) as PayrollCodeRow[];
    if (found.length === 0) {
      return { ok: false, skipped: true, warning: 'Nenhuma rubrica de rescisão cadastrada na folha' };
    }

    const emp = await localizarOuCriarEmployee(input);
    if (!emp.employee) {
      return { ok: false, skipped: true, warning: emp.warning };
    }

    const sheet = await localizarOuCriarSheet(emp.employee, input);
    if (!sheet.sheet) {
      return {
        ok: false,
        skipped: true,
        employee_id: emp.employee.id,
        warning: sheet.warning,
      };
    }

    if (sheet.warning) {
      return {
        ok: false,
        skipped: true,
        employee_id: emp.employee.id,
        sheet_id: sheet.sheet.id,
        warning: sheet.warning,
      };
    }

    const itemCodes = await inserirItens(sheet.sheet.id, emp.employee.id, input, found);
    return {
      ok: itemCodes.length > 0,
      skipped: itemCodes.length === 0,
      sheet_id: sheet.sheet.id,
      employee_id: emp.employee.id,
      item_codes: itemCodes,
      warning:
        itemCodes.length === 0
          ? 'Folha localizada, mas nenhum item de rescisão foi lançado'
          : undefined,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro inesperado na folha';
    console.warn('[desligamento/payroll] skip:', message);
    return { ok: false, skipped: true, warning: message };
  }
}
