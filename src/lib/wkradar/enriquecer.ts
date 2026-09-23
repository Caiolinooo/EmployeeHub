/**
 * Enriquecimento WK → portal (orquestração com banco, padrão sync.ts).
 * Regras puras em enriquecer-regras.ts: preenchem VAZIOS em
 * payroll_employees e gt_colaboradores com dados da RadarAPI e dos cards do
 * backup WK — nunca sobrescrevem (exceções confirmadas pelo DP ficam).
 */
import { supabaseAdmin } from '@/lib/supabase';
import { mergeColaborador } from '@/lib/payroll/colaborador-merge';
import { WK_CANDIDATOS_FUNCIONARIOS, wkGetPaginado } from './api-client';
import {
  calcularMudancasGt,
  calcularMudancasPayroll,
  digitos,
  texto,
  type BackupPessoa,
  type ColaboradorGt,
  type DepartamentoPayroll,
  type EmployeePayroll,
  type FuncionarioApi,
} from './enriquecer-regras';

export type { BackupPessoa, FuncionarioApi } from './enriquecer-regras';

export interface RelatorioEnriquecimento {
  fonte: 'api' | 'api+backup';
  funcionariosWk: number;
  gt: { atualizados: number; semMudanca: number; pendencias: string[] };
  payroll: { atualizados: number; semMudanca: number; pendencias: string[] };
  aplicar: boolean;
}

/**
 * Orquestra: puxa funcionários da RadarAPI (paginado), lê as fichas do portal,
 * aplica as regras e grava (aplicar=true) — dry-run por padrão. Idempotente.
 */
export async function enriquecerPortalWk(opcoes: {
  funcionarios?: FuncionarioApi[];
  backupPorCpf?: Map<string, BackupPessoa>;
  aplicar: boolean;
}): Promise<RelatorioEnriquecimento> {
  const { backupPorCpf, aplicar } = opcoes;

  let funcionarios = opcoes.funcionarios;
  if (!funcionarios) {
    const linhas = await wkGetPaginado<Record<string, unknown>>(WK_CANDIDATOS_FUNCIONARIOS[0]);
    funcionarios = linhas.map((l) => ({
      id: Number(l.id),
      codigo: texto(l.codigo),
      nome: texto(l.nome),
      departamento: l.departamento == null ? null : texto(l.departamento),
      cargo: l.cargo == null ? null : texto(l.cargo),
    }));
  }
  const wkPorMatricula = new Map<string, FuncionarioApi>();
  for (const f of funcionarios) wkPorMatricula.set(texto(f.codigo), f);

  const [{ data: gts, error: erroGt }, { data: emps, error: erroEmp }, { data: depts }] =
    await Promise.all([
      supabaseAdmin
        .from('gt_colaboradores')
        .select('id,cpf,matricula,pis_pasep,salario,data_nascimento,matricula_esocial,empresa_id')
        .is('deleted_at', null),
      supabaseAdmin
        .from('payroll_employees')
        .select('id,registration_number,cpf,position,base_salary,pis_pasep,department_id,company_id'),
      supabaseAdmin.from('payroll_departments').select('id,code,name,company_id'),
    ]);
  if (erroGt) throw new Error(`gt_colaboradores: ${erroGt.message}`);
  if (erroEmp) throw new Error(`payroll_employees: ${erroEmp.message}`);

  const cnpjPadrao = '17784306000189'; // ABZ Group — única empresa ativa na folha

  const relatorio: RelatorioEnriquecimento = {
    fonte: backupPorCpf ? 'api+backup' : 'api',
    funcionariosWk: funcionarios.length,
    gt: { atualizados: 0, semMudanca: 0, pendencias: [] },
    payroll: { atualizados: 0, semMudanca: 0, pendencias: [] },
    aplicar,
  };

  // ---- gt_colaboradores ----
  for (const gtRaw of (gts ?? []) as ColaboradorGt[]) {
    const cpf = digitos((gtRaw as unknown as { cpf?: string }).cpf);
    const backup = cpf.length === 11 ? backupPorCpf?.get(cpf) : undefined;
    const resultado = calcularMudancasGt(gtRaw, backup, cnpjPadrao);
    if (!resultado) {
      relatorio.gt.semMudanca++;
      continue;
    }
    if ('pendencia' in resultado) {
      relatorio.gt.pendencias.push(resultado.pendencia);
      continue;
    }
    relatorio.gt.atualizados++;
    if (aplicar) {
      const { error } = await supabaseAdmin
        .from('gt_colaboradores')
        .update(resultado.changes)
        .eq('id', gtRaw.id);
      if (error) throw new Error(`gt_colaboradores ${gtRaw.id}: ${error.message}`);
    }
  }

  // ---- payroll_employees ----
  // Dry-run usa as regras puras para o relatório; a gravação (aplicar=true)
  // passa pelo ponto único de merge (design §3) com os mesmos campos — o
  // service refaz o match por CPF/matrícula e aplica o preenchimento aditivo.
  const departamentos = (depts ?? []) as DepartamentoPayroll[];
  for (const empRaw of (emps ?? []) as EmployeePayroll[]) {
    const cpf = digitos(empRaw.cpf);
    const backup = cpf.length === 11 ? backupPorCpf?.get(cpf) : undefined;
    const wk = wkPorMatricula.get(texto(empRaw.registration_number));
    const changes = calcularMudancasPayroll(empRaw, wk, backup, departamentos);
    if (!changes) {
      relatorio.payroll.semMudanca++;
      continue;
    }
    relatorio.payroll.atualizados++;
    if (aplicar) {
      if (!empRaw.company_id) {
        relatorio.payroll.pendencias.push(
          `payroll_employees ${empRaw.id} sem company_id — merge não aplicado`,
        );
        continue;
      }
      await mergeColaborador(
        supabaseAdmin,
        {
          company_id: empRaw.company_id,
          registration_number: empRaw.registration_number,
          cpf: empRaw.cpf,
          cargo: (changes.position as string | undefined) ?? null,
          pis: (changes.pis_pasep as string | undefined) ?? null,
          base_salary: (changes.base_salary as number | undefined) ?? null,
          department_id: (changes.department_id as string | undefined) ?? null,
        },
        backup ? 'wk_backup' : 'wk_api',
      );
    }
  }

  return relatorio;
}
