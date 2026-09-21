/**
 * Relatório operacional da folha.
 *
 * O sistema já tem embarque, dobra, folga e férias no GT. Este módulo:
 *   1. consolida esses dias em rubricas (sincronizarModulosInternos);
 *   2. calcula INSS/IRRF/FGTS em cima dos valores já apurados (não recomputa
 *      a diária — o cadastro da rubrica tem value 0 e zeraria o lançamento);
 *   3. devolve o relatório por colaborador e o consolidado por centro de custo.
 */

import { supabaseAdmin } from '@/lib/supabase';
import { normalizeCpf } from '@/lib/utils/identity';
import { paginarSelect } from '@/lib/gestao-tripulantes/supabase-paginacao';
import {
  calculateEmployeePayroll,
  type NaturezaFolha,
  type PayrollItem,
  type PerfilCalculo,
} from '@/lib/payroll/calculations';
import {
  sincronizarModulosInternos,
  type CompetenciaFolha,
  type PendenciaCpf,
  type QuadroOperacional,
} from '@/lib/payroll/fontes-dp';

export interface ItemRelatorio {
  code: string;
  name: string;
  type: string;
  quantity: number;
  valor: number;
}

export interface LinhaRelatorioColaborador {
  employeeId: string;
  nome: string;
  cpf: string;
  centroCusto: string;
  diasEmbarcado: number;
  diasDobra: number;
  diasFolga: number;
  diasFolgaIndenizada: number;
  diasFerias: number;
  diasStandby: number;
  diasTreinamento: number;
  bruto: number;
  descontos: number;
  liquido: number;
  inss: number;
  irrf: number;
  fgts: number;
  itens: ItemRelatorio[];
}

export interface BlocoCentroCusto {
  centroCusto: string;
  colaboradores: number;
  diasEmbarcado: number;
  diasDobra: number;
  diasFolga: number;
  diasFolgaIndenizada: number;
  diasFerias: number;
  bruto: number;
  descontos: number;
  liquido: number;
  inss: number;
  irrf: number;
  fgts: number;
}

export interface RelatorioOperacional {
  sheetId: string;
  competencia: CompetenciaFolha;
  inseridos: number;
  descartadosPrecedencia: number;
  pendencias: PendenciaCpf[];
  colaboradores: LinhaRelatorioColaborador[];
  centros: BlocoCentroCusto[];
  totais: BlocoCentroCusto;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

function naturezaDoCodigo(code: string): NaturezaFolha {
  if (code === '005' || code === '006') return 'ferias';
  if (code === '007') return 'decimo';
  if (code === '301' || code === '302' || code === '303' || code === '304'
      || code === '305' || code === '306' || code === '307') {
    return 'rescisao';
  }
  return 'mensal';
}

function derivarPerfilDeRules(rules: Record<string, unknown> | null | undefined): PerfilCalculo | undefined {
  if (!rules || typeof rules !== 'object') return undefined;
  const desligado = (v: unknown): boolean => {
    if (typeof v === 'boolean') return !v;
    if (v && typeof v === 'object' && 'enabled' in v) return (v as { enabled?: unknown }).enabled === false;
    return false;
  };
  let tetoVT: number | undefined;
  const vt = rules['vale_transporte'];
  if (vt && typeof vt === 'object' && 'max_percentage_salary' in vt) {
    const teto = (vt as { max_percentage_salary?: unknown }).max_percentage_salary;
    if (typeof teto === 'number') tetoVT = teto;
  }
  const perfil: PerfilCalculo = {
    ignorarInss: desligado(rules['inss']),
    ignorarIrrf: desligado(rules['irrf']),
    ignorarFgts: desligado(rules['fgts']),
    tetoVTPercentual: tetoVT,
  };
  const temRegra = perfil.ignorarInss || perfil.ignorarIrrf || perfil.ignorarFgts || typeof tetoVT === 'number';
  return temRegra ? perfil : undefined;
}

function linhaVazia(parcial: {
  employeeId: string;
  nome: string;
  cpf: string;
  centroCusto: string;
  dias?: Partial<QuadroOperacional>;
}): LinhaRelatorioColaborador {
  const d = parcial.dias;
  return {
    employeeId: parcial.employeeId,
    nome: parcial.nome,
    cpf: parcial.cpf,
    centroCusto: parcial.centroCusto || 'NÃO DEFINIDO',
    diasEmbarcado: d?.diasEmbarcado || 0,
    diasDobra: d?.diasDobra || 0,
    diasFolga: d?.diasFolga || 0,
    diasFolgaIndenizada: d?.diasFolgaIndenizada || 0,
    diasFerias: d?.diasFerias || 0,
    diasStandby: d?.diasStandby || 0,
    diasTreinamento: d?.diasTreinamento || 0,
    bruto: 0,
    descontos: 0,
    liquido: 0,
    inss: 0,
    irrf: 0,
    fgts: 0,
    itens: [],
  };
}

function agregar(linhas: LinhaRelatorioColaborador[], centroCusto: string): BlocoCentroCusto {
  return linhas.reduce<BlocoCentroCusto>((acc, l) => {
    acc.colaboradores += 1;
    acc.diasEmbarcado += l.diasEmbarcado;
    acc.diasDobra += l.diasDobra;
    acc.diasFolga += l.diasFolga;
    acc.diasFolgaIndenizada += l.diasFolgaIndenizada;
    acc.diasFerias += l.diasFerias;
    acc.bruto = round2(acc.bruto + l.bruto);
    acc.descontos = round2(acc.descontos + l.descontos);
    acc.liquido = round2(acc.liquido + l.liquido);
    acc.inss = round2(acc.inss + l.inss);
    acc.irrf = round2(acc.irrf + l.irrf);
    acc.fgts = round2(acc.fgts + l.fgts);
    return acc;
  }, {
    centroCusto,
    colaboradores: 0,
    diasEmbarcado: 0,
    diasDobra: 0,
    diasFolga: 0,
    diasFolgaIndenizada: 0,
    diasFerias: 0,
    bruto: 0,
    descontos: 0,
    liquido: 0,
    inss: 0,
    irrf: 0,
    fgts: 0,
  });
}

interface ItemRow {
  employee_id: string;
  code_id: string;
  quantity: number | null;
  reference_value: number | null;
  calculated_value: number | null;
}

interface CodeRow {
  id: string;
  code: string;
  type: 'provento' | 'desconto' | 'outros';
  name: string;
  calculation_type: PayrollItem['calculationType'] | null;
  value: number | null;
  formula: string | null;
  legal_type: 'inss' | 'irrf' | 'fgts' | null;
}

interface EmpRow {
  id: string;
  name: string;
  cpf: string | null;
  base_salary: number | null;
}

/**
 * Calcula a competência a partir dos dados que o portal já tem
 * (embarques, dobras, folgas, férias) e devolve o relatório.
 * Sheet aprovada/paga → ErroFolhaBloqueada (lançado pela consolidação).
 */
export async function gerarRelatorioOperacional(opts: {
  competencia: CompetenciaFolha;
  companyId: string;
  departmentId?: string | null;
  usuarioId?: string;
}): Promise<RelatorioOperacional> {
  const sync = await sincronizarModulosInternos({
    competencia: opts.competencia,
    companyId: opts.companyId,
    departmentId: opts.departmentId ?? null,
    usuarioId: opts.usuarioId,
  });

  const itensRes = await paginarSelect<ItemRow>(async (from, to) => {
    const r = await supabaseAdmin
      .from('payroll_sheet_items')
      .select('employee_id, code_id, quantity, reference_value, calculated_value')
      .eq('sheet_id', sync.sheetId)
      .order('id')
      .range(from, to);
    return { data: r.data, error: r.error };
  });
  if (itensRes.error) throw new Error(`Erro ao ler itens da folha: ${itensRes.error}`);

  const codeIds = [...new Set(itensRes.rows.map((i) => i.code_id).filter(Boolean))];
  const codes = new Map<string, CodeRow>();
  if (codeIds.length > 0) {
    const { data, error } = await supabaseAdmin
      .from('payroll_codes')
      .select('id, code, type, name, calculation_type, value, formula, legal_type')
      .in('id', codeIds);
    if (error) throw new Error(`Erro ao ler rubricas: ${error.message}`);
    for (const c of (data || []) as CodeRow[]) codes.set(c.id, c);
  }

  const employeeIds = [...new Set(itensRes.rows.map((i) => i.employee_id))];
  const employees = new Map<string, EmpRow>();
  for (let i = 0; i < employeeIds.length; i += 200) {
    const lote = employeeIds.slice(i, i + 200);
    const { data, error } = await supabaseAdmin
      .from('payroll_employees')
      .select('id, name, cpf, base_salary')
      .in('id', lote);
    if (error) throw new Error(`Erro ao ler colaboradores da folha: ${error.message}`);
    for (const e of (data || []) as EmpRow[]) employees.set(e.id, e);
  }

  const { data: perfilRow } = await supabaseAdmin
    .from('payroll_calculation_profiles')
    .select('rules')
    .eq('company_id', opts.companyId)
    .eq('is_default', true)
    .eq('is_active', true)
    .maybeSingle();
  const perfil = derivarPerfilDeRules(perfilRow?.rules as Record<string, unknown> | null);

  const itensPorEmp = new Map<string, ItemRow[]>();
  for (const item of itensRes.rows) {
    const lista = itensPorEmp.get(item.employee_id) || [];
    lista.push(item);
    itensPorEmp.set(item.employee_id, lista);
  }

  const porCpf = new Map<string, LinhaRelatorioColaborador>();
  for (const q of sync.quadros) {
    porCpf.set(q.cpf, linhaVazia({
      employeeId: q.cpf,
      nome: q.nome,
      cpf: q.cpf,
      centroCusto: q.centroCusto,
      dias: q,
    }));
  }

  let totalGross = 0;
  let totalDeductions = 0;
  let totalNet = 0;
  let totalInss = 0;
  let totalIrrf = 0;
  let totalFgts = 0;
  const resumos: Array<Record<string, unknown>> = [];

  for (const [employeeId, itensEmp] of itensPorEmp) {
    const emp = employees.get(employeeId);
    if (!emp) continue;
    const motorItens: PayrollItem[] = [];
    for (const item of itensEmp) {
      const code = codes.get(item.code_id);
      if (!code) continue;
      if (code.legal_type === 'inss' || code.legal_type === 'irrf' || code.legal_type === 'fgts') continue;
      const informado = Number(item.calculated_value);
      const usaInformado = Number.isFinite(informado) && informado !== 0;
      motorItens.push({
        codeId: item.code_id,
        code: code.code,
        type: code.type,
        name: code.name,
        calculationType: code.calculation_type || 'fixed',
        value: Number(code.value || 0),
        quantity: Number(item.quantity || 0),
        referenceValue: Number(item.reference_value || 0),
        ...(code.legal_type ? { legalType: code.legal_type } : {}),
        ...(code.formula ? { formula: code.formula } : {}),
        natureza: naturezaDoCodigo(code.code),
        ...(usaInformado ? { valorInformado: informado } : {}),
      });
    }
    if (motorItens.length === 0) continue;

    const baseFolha = Number(emp.base_salary || 0);
    const diaria = Number(motorItens.find((i) => i.referenceValue)?.referenceValue || 0);
    const result = calculateEmployeePayroll(
      { id: emp.id, name: emp.name, baseSalary: baseFolha > 0 ? baseFolha : round2(diaria * 30) },
      motorItens,
      perfil,
      opts.competencia,
    );

    totalGross += result.grossSalary;
    totalDeductions += result.totalDeductions;
    totalNet += result.netSalary;
    totalInss += result.inssValue;
    totalIrrf += result.irrfValue;
    totalFgts += result.fgtsValue;

    resumos.push({
      sheet_id: sync.sheetId,
      employee_id: emp.id,
      base_salary: result.baseSalary,
      total_earnings: result.totalEarnings,
      total_deductions: result.totalDeductions,
      total_others: result.totalOthers,
      inss_base: result.inssBase,
      irrf_base: result.irrfBase,
      fgts_base: result.fgtsBase,
      inss_value: result.inssValue,
      irrf_value: result.irrfValue,
      fgts_value: result.fgtsValue,
      gross_salary: result.grossSalary,
      net_salary: result.netSalary,
    });

    const cpf = normalizeCpf(emp.cpf || '');
    const chave = cpf.length === 11 ? cpf : emp.id;
    const linha = porCpf.get(chave) || linhaVazia({
      employeeId: emp.id,
      nome: emp.name,
      cpf: cpf || '—',
      centroCusto: 'NÃO DEFINIDO',
    });
    linha.employeeId = emp.id;
    linha.nome = emp.name || linha.nome;
    linha.bruto = result.grossSalary;
    linha.descontos = result.totalDeductions;
    linha.liquido = result.netSalary;
    linha.inss = result.inssValue;
    linha.irrf = result.irrfValue;
    linha.fgts = result.fgtsValue;
    linha.itens = result.items
      .filter((it) => it.calculatedValue !== 0 || it.type === 'provento')
      .map((it) => ({
        code: it.code,
        name: it.name,
        type: it.type,
        quantity: it.quantity,
        valor: it.calculatedValue,
      }));
    porCpf.set(chave, linha);
  }

  if (resumos.length > 0) {
    const { error } = await supabaseAdmin
      .from('payroll_employee_summaries')
      .upsert(resumos, { onConflict: 'sheet_id,employee_id' });
    if (error) throw new Error(`Erro ao gravar resumos da folha: ${error.message}`);
  }

  const colaboradores = [...porCpf.values()].sort((a, b) => {
    const centro = a.centroCusto.localeCompare(b.centroCusto, 'pt-BR');
    if (centro !== 0) return centro;
    return a.nome.localeCompare(b.nome, 'pt-BR');
  });

  const centrosMap = new Map<string, LinhaRelatorioColaborador[]>();
  for (const linha of colaboradores) {
    const lista = centrosMap.get(linha.centroCusto) || [];
    lista.push(linha);
    centrosMap.set(linha.centroCusto, lista);
  }
  const centros = [...centrosMap.entries()]
    .map(([nome, linhas]) => agregar(linhas, nome))
    .sort((a, b) => a.centroCusto.localeCompare(b.centroCusto, 'pt-BR'));

  const { error: sheetError } = await supabaseAdmin
    .from('payroll_sheets')
    .update({
      status: 'calculated',
      total_employees: colaboradores.length,
      total_gross: round2(totalGross),
      total_deductions: round2(totalDeductions),
      total_net: round2(totalNet),
      total_inss: round2(totalInss),
      total_irrf: round2(totalIrrf),
      total_fgts: round2(totalFgts),
      updated_at: new Date().toISOString(),
    })
    .eq('id', sync.sheetId);
  if (sheetError) throw new Error(`Erro ao atualizar totais da folha: ${sheetError.message}`);

  return {
    sheetId: sync.sheetId,
    competencia: opts.competencia,
    inseridos: sync.inseridos,
    descartadosPrecedencia: sync.descartadosPrecedencia,
    pendencias: sync.pendencias,
    colaboradores,
    centros,
    totais: agregar(colaboradores, 'TOTAL'),
  };
}
